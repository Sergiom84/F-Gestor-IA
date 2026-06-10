#!/usr/bin/env node
import "dotenv/config";

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const DEFAULT_EMAIL = "sergio.hlara84@gmail.com";
const MONEY_TOLERANCE = 0.01;
const BASE_INVOICE_AMOUNT = 500;
const IVA_RATE = 0.21;
const IRPF_RATE = 0.15;

const args = parseArgs(process.argv.slice(2));
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = path.resolve("output", "e2e-user-feedback", runId);
const artifacts = {
  screenshots: [],
  consoleErrors: [],
  pageErrors: []
};
const report = {
  runId,
  startedAt: new Date().toISOString(),
  baseUrl: args.baseUrl,
  email: args.email,
  issues: [],
  passes: [],
  notes: [],
  artifacts: {
    outputDir,
    screenshots: artifacts.screenshots
  }
};

await main();

async function main() {
  await fs.mkdir(outputDir, { recursive: true });

  if (!args.password && !args.createUser) {
    failConfig(
      "Missing password. Set GFISCAL_E2E_PASSWORD or pass --password. " +
        "The script intentionally does not store the test password in source code."
    );
  }

  const browser = await chromium.launch({
    headless: args.headless,
    slowMo: args.slowMo
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "es-ES",
    timezoneId: "Europe/Madrid"
  });
  const page = await context.newPage();

  page.on("console", (message) => {
    if (message.type() === "error") {
      artifacts.consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    artifacts.pageErrors.push(error.message);
  });

  try {
    await step("auth", async () => {
      if (args.createUser) {
        await createUserThroughUi(page);
      } else {
        await loginThroughUi(page, context);
      }
      await ensureDashboard(page);
    });

    await step("contacts-client-creation", async () => {
      await validateClientCreation(page);
    });

    await step("sales-invoice-irpf-suplido", async () => {
      await validateSalesInvoiceFlow(page);
    });

    await step("quotes-pdf-template-cross-check", async () => {
      await validatePdfTemplateModule(page);
    });

    await step("browser-errors", async () => {
      recordBrowserErrors();
    });
  } catch (error) {
    addIssue("critical", "runner", "Fatal script error", asMessage(error));
    await screenshot(page, "fatal-error").catch(() => {});
  } finally {
    report.finishedAt = new Date().toISOString();
    report.summary = buildSummary();
    await writeReportFiles();

    if (args.keepOpen) {
      console.log(`Browser kept open. Artifacts: ${outputDir}`);
      return;
    }

    await browser.close();
  }

  printSummary();

  if (args.strict && hasBlockingIssues()) {
    process.exitCode = 1;
  }
}

async function loginThroughUi(page, context) {
  await goto(page, "/login");

  if (page.url().includes("/dashboard")) {
    addPass("auth", "Existing browser session reached dashboard");
    return;
  }

  const loginPanel = page.locator(".login-panel").filter({ hasText: "Acceso al panel" }).first();
  await loginPanel.locator('input[name="email"]').fill(args.email);
  await loginPanel.locator('input[name="password"]').fill(args.password);
  await screenshot(page, "01-login-filled");
  await loginPanel.getByRole("button", { name: /Entrar/i }).click();

  await page
    .waitForURL((url) => !url.pathname.includes("/login"), { timeout: args.timeout })
    .catch(async () => {
      addIssue("high", "auth", "UI login did not leave /login", "Trying Supabase session injection fallback.");
      if (args.noAuthFallback) {
        throw new Error("UI login failed and --no-auth-fallback is enabled.");
      }
      await injectSupabaseSession(context);
      await goto(page, "/dashboard");
    });
}

async function createUserThroughUi(page) {
  const email = args.email.includes("@")
    ? args.email
    : `gfiscal-e2e-${Date.now()}@example.com`;
  const password = args.password || `Gfiscal-${Date.now()}`;

  await goto(page, "/login");
  const signupPanel = page.locator(".login-panel").filter({ hasText: "Crear cuenta" }).first();
  await signupPanel.locator('input[name="display_name"]').fill("GFiscal E2E");
  await signupPanel.locator('input[name="email"]').fill(email);
  await signupPanel.locator('input[name="password"]').fill(password);
  await screenshot(page, "01-signup-filled");
  await signupPanel.getByRole("button", { name: /Registrarme/i }).click();
  await waitForUi(page);

  const body = await bodyText(page);
  if (page.url().includes("/login") && normalize(body).includes("revisa tu email")) {
    addIssue(
      "high",
      "auth",
      "Created user requires email confirmation",
      "Use an already confirmed account or create a confirmed fixture user before running the flow."
    );
  } else {
    addPass("auth", "Created user through UI and continued past signup");
  }
}

async function injectSupabaseSession(context) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.SUPABASE_PUBLISHABLE_KEY
    ?? process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !publishableKey) {
    throw new Error("Cannot inject auth fallback without Supabase URL and publishable key env vars.");
  }

  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF
    ?? process.env.SUPABASE_PROJECT_REF
    ?? new URL(supabaseUrl).hostname.split(".")[0];
  const supabase = createClient(supabaseUrl, publishableKey);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: args.email,
    password: args.password
  });

  if (error || !data.session) {
    throw new Error(`Supabase auth fallback failed: ${error?.message ?? "No session returned"}`);
  }

  const cookieBaseName = `sb-${projectRef}-auth-token`;
  const cookieValue = JSON.stringify({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    expires_in: data.session.expires_in,
    token_type: data.session.token_type,
    user: data.session.user
  });
  const origin = new URL(args.baseUrl).origin;
  const chunks = chunkString(cookieValue, 3180);

  await context.addCookies(chunks.map((value, index) => ({
    name: `${cookieBaseName}.${index}`,
    value,
    url: origin,
    path: "/",
    httpOnly: true,
    sameSite: "Lax"
  })));
  addPass("auth", "Supabase session injected after UI login fallback");
}

async function ensureDashboard(page) {
  await goto(page, "/dashboard");

  if (page.url().includes("/onboarding")) {
    await screenshot(page, "02-onboarding-blocker");
    addIssue(
      "critical",
      "auth",
      "Authenticated user lands in onboarding",
      "The user cannot test clients or invoices until the account has an organization."
    );
    return;
  }

  if (page.url().includes("/login")) {
    throw new Error("Could not reach dashboard after login.");
  }

  await page.locator("main").waitFor({ timeout: args.timeout });
  await screenshot(page, "02-dashboard");
  addPass("auth", "Dashboard loaded");
}

async function validateClientCreation(page) {
  await goto(page, "/dashboard?module=contacts");
  await page.locator('section[aria-label="Contactos"]').waitFor({ timeout: args.timeout });
  await screenshot(page, "10-contacts");

  const addClicked = await clickByText(page.locator('section[aria-label="Contactos"]'), ["anadir", "crear cliente", "nuevo cliente"]);
  if (!addClicked) {
    addIssue("critical", "clients", "Cannot find client Add button", "Expected an Anadir/Crear cliente action in Contactos.");
    return;
  }

  const form = page.locator('section[aria-label="Nuevo cliente"]').first();
  await form.waitFor({ timeout: args.timeout });
  await screenshot(page, "11-new-client-empty");

  const createButton = form.getByRole("button", { name: /^Crear$/i });
  if (await createButton.isDisabled()) {
    addPass("clients", "Create button starts disabled while required fields are empty");
  } else {
    addIssue("medium", "clients", "Create button starts enabled", "The empty client form should not be submittable.");
  }

  const clientName = `Cliente E2E IRPF ${Date.now()}`;
  await fillField(form, "Razon social o nombre", clientName);
  await fillField(form, "NIF/CIF", "B12345678");
  await fillField(form, "E-mail", "cliente.e2e@example.com");

  if (await createButton.isDisabled()) {
    addIssue(
      "high",
      "clients",
      "Client creation stays disabled without manual code",
      "The feedback asks whether the code is automatic; currently the user must type Codigo * before Crear is enabled."
    );
  } else {
    addPass("clients", "Client can be created without manually entering a code");
  }

  await assertTextMissing(form, ["domicilio", "direccion", "calle", "codigo postal", "poblacion", "provincia"], {
    severity: "high",
    area: "clients",
    title: "New client form has no address fields",
    details: "The customer requested domicilio/address during client creation."
  });

  await assertTextMissing(form, ["irpf", "retencion", "retencion irpf"], {
    severity: "medium",
    area: "clients",
    title: "New client form has no default IRPF/retention setting",
    details: "The customer suggested assigning the retention behavior at client creation time."
  });

  await fillField(form, "Codigo", `E2E-${Date.now().toString().slice(-6)}`);

  if (await createButton.isEnabled()) {
    addPass("clients", "Create button enables after manual code and name");
  } else {
    addIssue("critical", "clients", "Create button remains disabled after required fields", "Codigo and Razon social are filled.");
    await screenshot(page, "12-new-client-still-disabled");
    return;
  }

  await screenshot(page, "12-new-client-filled");
  await createButton.click();
  await waitForBusySubmit(form);
  await page.getByText(clientName).first().waitFor({ timeout: args.timeout }).catch(() => {});
  await waitForUi(page);
  await screenshot(page, "13-new-client-after-create");

  const search = page.locator('input[placeholder*="Buscar"], input[type="search"]').first();
  if (await search.count()) {
    await search.fill(clientName);
    await waitForUi(page);
  }

  const body = normalize(await bodyText(page));
  if (body.includes(normalize(clientName))) {
    addPass("clients", "Created client appears in the contacts list");
  } else {
    addIssue(
      "critical",
      "clients",
      "Client Create action does not add the client to the list",
      "After clicking Crear, the form closes but the new client is not visible. This matches the customer blocker."
    );
  }
}

async function validateSalesInvoiceFlow(page) {
  await goto(page, "/dashboard?module=sales&salesSection=invoices");
  await page.locator('section[aria-label="Modulo de ventas"]').waitFor({ timeout: args.timeout });
  await screenshot(page, "20-sales-invoices");

  const clicked = await clickByText(page.locator('section[aria-label="Modulo de ventas"]'), [
    "crear factura de venta",
    "crear factura",
    "nueva factura"
  ]);
  if (!clicked) {
    addIssue("critical", "sales", "Cannot find Create invoice action", "Expected Crear factura de venta in Ventas > Facturas.");
    return;
  }

  const form = page.locator('section[aria-label="Factura de venta"]').first();
  await form.waitFor({ timeout: args.timeout });
  await screenshot(page, "21-sales-invoice-empty");

  await assertTextMissing(form, ["irpf", "retencion"], {
    severity: "high",
    area: "sales",
    title: "Sales invoice form has no IRPF/retention control",
    details: "The invoice flow only exposes IVA totals, so the user cannot apply 15% IRPF from this screen."
  });
  await assertTextMissing(form, ["suplido"], {
    severity: "high",
    area: "sales",
    title: "Sales invoice form has no suplido field",
    details: "The requested manual suplido amount cannot be entered in Ventas > Facturas."
  });
  await assertTextMissing(form, ["plantilla", "pdf"], {
    severity: "medium",
    area: "sales",
    title: "Sales invoice form has no PDF template action",
    details: "The customer asked for PDF templates in the invoice area."
  });

  await fillField(form, "Referencia", `E2E-IRPF-${Date.now().toString().slice(-5)}`);
  await fillField(form, "Razon social o nombre", "TABLAMAX SL");

  const addedLine = await clickByText(form, ["anadir"]);
  if (!addedLine) {
    addIssue("critical", "sales", "Cannot add invoice line", "Expected Anadir inside Productos y servicios.");
    return;
  }

  await form.locator('input[aria-label="Producto o servicio"]').last().fill("Servicio");
  await form.locator('input[aria-label="Descripcion"]').last().fill("Administrativos y contables");
  await form.locator('input[aria-label="Cantidad"]').last().fill("1");
  await form.locator('input[aria-label="Precio unitario"]').last().fill(String(BASE_INVOICE_AMOUNT));
  await form.locator('input[aria-label="Descuento"]').last().fill("0");
  await waitForUi(page);
  await screenshot(page, "22-sales-invoice-line-filled");

  const base = await readSummaryAmount(form, "Total base imponible");
  const iva = await readSummaryAmount(form, "Total IVA");
  const total = await readSummaryAmount(form, "Total");
  const expectedIva = BASE_INVOICE_AMOUNT * IVA_RATE;
  const expectedIrpf = BASE_INVOICE_AMOUNT * IRPF_RATE;
  const expectedTotalWithIrpf = BASE_INVOICE_AMOUNT + expectedIva - expectedIrpf;

  assertMoney("sales", "Base imponible", base, BASE_INVOICE_AMOUNT);
  assertMoney("sales", "IVA 21%", iva, expectedIva);

  if (isClose(total, expectedTotalWithIrpf)) {
    addPass("sales", `Invoice total applies IVA 21% and IRPF 15% (${formatEuro(total)})`);
  } else {
    addIssue(
      "high",
      "sales",
      "Invoice total ignores IRPF 15%",
      `For base ${formatEuro(BASE_INVOICE_AMOUNT)}, expected ${formatEuro(expectedTotalWithIrpf)} with IVA 21% and IRPF 15%, but UI shows ${formatEuro(total)}.`
    );
  }

  const totalsTabClicked = await clickByText(form, ["totales y descuentos"]);
  if (totalsTabClicked) {
    await waitForUi(page);
    await screenshot(page, "23-sales-totals-tab");
    await assertTextMissing(form, ["irpf", "retencion", "suplido"], {
      severity: "high",
      area: "sales",
      title: "Totals tab still lacks IRPF and suplido",
      details: "Totals y descuentos only allows discounts, not tax withholding or suplido."
    });
  }

  const clientTabClicked = await clickByText(form, ["informacion de cliente"]);
  if (clientTabClicked) {
    await waitForUi(page);
    await screenshot(page, "24-sales-client-tab");
    const clientTabText = normalize(await form.textContent());
    if (clientTabText.includes("direccion de entrega") && clientTabText.includes("direccion de facturacion")) {
      addPass("sales", "Invoice client tab includes delivery and billing address placeholders");
    } else {
      addIssue("medium", "sales", "Invoice client tab does not expose billing/delivery address placeholders");
    }
    if (!clientTabText.includes("irpf") && !clientTabText.includes("retencion")) {
      addIssue(
        "medium",
        "sales",
        "Invoice client info tab has no client-level retention setting",
        "There is no visible way to inherit IRPF behavior from the selected client."
      );
    }
  }

  const createButton = form.getByRole("button", { name: /^Crear$/i });
  const wasEnabled = await createButton.isEnabled();
  if (!wasEnabled) {
    addIssue("critical", "sales", "Invoice Create button remains disabled after client and line", "A user cannot emit the invoice.");
    return;
  }
  addPass("sales", "Invoice Create button enables after client and line");

  await createButton.click();
  await waitForBusySubmit(form);
  await waitForUi(page);
  const stillOnForm = await form.isVisible().catch(() => false);
  if (stillOnForm) {
    addIssue(
      "high",
      "sales",
      "Invoice Create button has no visible effect",
      "Clicking Crear leaves the user in the same form without confirmation, persistence, or validation feedback."
    );
  } else {
    addPass("sales", "Invoice Create action leaves the form after submit");
  }
  await screenshot(page, "25-sales-after-create");
}

async function validatePdfTemplateModule(page) {
  await goto(page, "/dashboard?module=quotes");
  await completeQuotesFirstUseIfNeeded(page);
  await waitForUi(page);
  await screenshot(page, "30-quotes-module");

  const body = normalize(await bodyText(page));
  if (!body.includes("formato pdf") && !body.includes("plantilla editable")) {
    addIssue(
      "low",
      "pdf",
      "Could not find the PDF template area in Presupuestos",
      "The script checks this as a cross-reference because the Sales invoice form does not expose PDF templates."
    );
    return;
  }

  addNote(
    "pdf",
    "Presupuestos contains a separate PDF template area. This does not solve the customer's Sales > Facturas flow unless it is integrated there."
  );

  const pdfTemplateCard = page.locator(".template-card").filter({ hasText: /Plantilla editable para facturas|PDF/i }).first();
  if (await pdfTemplateCard.count()) {
    await pdfTemplateCard.click();
  } else if (!await clickByText(page.locator("main"), ["nueva factura pdf", "plantilla editable"])) {
    addIssue("low", "pdf", "PDF template card is visible but not clickable by the script");
    return;
  }

  await waitForUi(page);
  await screenshot(page, "31-quotes-pdf-template");
  const pdfText = normalize(await bodyText(page));
  const hasIrpf = pdfText.includes("irpf");
  const hasSuplido = pdfText.includes("suplido");
  const hasTaxes = pdfText.includes("impuestos");

  if (hasIrpf && hasSuplido && hasTaxes) {
    addPass("pdf", "Separate PDF template exposes Impuestos, IRPF and suplido");
  } else {
    addIssue(
      "medium",
      "pdf",
      "Separate PDF template does not expose all requested tax/suplido fields",
      `Detected: impuestos=${hasTaxes}, irpf=${hasIrpf}, suplido=${hasSuplido}.`
    );
  }
}

async function completeQuotesFirstUseIfNeeded(page) {
  const configModal = page.locator(".config-modal").first();

  if (!await configModal.isVisible().catch(() => false)) {
    return;
  }

  addNote("pdf", "Presupuestos opened the first-use document configuration modal; filling the minimum required field.");
  const firstInput = configModal.locator('input:not([type="file"])').first();
  await firstInput.fill("TABLAMAX SL");
  await configModal.locator(".config-modal-actions button").first().click();
  await waitForUi(page);

  if (await configModal.isVisible().catch(() => false)) {
    addIssue(
      "low",
      "pdf",
      "Could not close first-use document configuration modal",
      "The PDF template cross-check is blocked until the initial document configuration is saved."
    );
  }
}

async function assertTextMissing(scope, needles, issue) {
  const text = normalize(await scope.textContent());
  const found = needles.filter((needle) => text.includes(normalize(needle)));

  if (found.length === 0) {
    addIssue(issue.severity, issue.area, issue.title, issue.details);
    return;
  }

  addPass(issue.area, `Found requested field/control text: ${found.join(", ")}`);
}

async function waitForBusySubmit(scope) {
  const busyButton = scope.getByRole("button", { name: /Creando/i }).first();

  if (await busyButton.isVisible().catch(() => false)) {
    await busyButton.waitFor({ state: "hidden", timeout: args.timeout }).catch(() => {});
  }
}

async function fillField(scope, labelText, value) {
  const label = scope.locator("label").filter({ hasText: new RegExp(escapeRegExp(labelText), "i") }).first();
  await label.waitFor({ timeout: args.timeout });
  const control = label.locator("input, textarea, select").first();
  const tagName = await control.evaluate((element) => element.tagName.toLowerCase());

  if (tagName === "select") {
    await control.selectOption({ label: value }).catch(async () => {
      await control.selectOption(value);
    });
    return;
  }

  await control.fill(value);
}

async function readSummaryAmount(scope, label) {
  const box = scope.locator(".quote-summary-box").filter({ hasText: label }).last();
  await box.waitFor({ timeout: args.timeout });
  const raw = await box.locator("strong").innerText();
  return parseEuro(raw);
}

async function clickByText(scope, labels) {
  const normalizedLabels = labels.map(normalize);
  const candidates = await scope.locator("button, a, [role='button']").all();

  for (const candidate of candidates) {
    const text = normalize(await candidate.textContent().catch(() => ""));
    const aria = normalize(await candidate.getAttribute("aria-label").catch(() => ""));
    const title = normalize(await candidate.getAttribute("title").catch(() => ""));
    const haystack = `${text} ${aria} ${title}`.trim();

    if (haystack && normalizedLabels.some((label) => haystack.includes(label))) {
      await candidate.click();
      return true;
    }
  }

  return false;
}

async function goto(page, pathname) {
  const url = new URL(pathname, args.baseUrl);
  await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: args.timeout });
  await waitForUi(page);
}

async function waitForUi(page) {
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(args.settleMs);
}

async function bodyText(page) {
  return page.locator("body").textContent({ timeout: args.timeout }).catch(() => "");
}

async function screenshot(page, name) {
  const file = path.join(outputDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  artifacts.screenshots.push(file);
  return file;
}

async function step(name, callback) {
  console.log(`\n== ${name} ==`);
  await callback();
}

function recordBrowserErrors() {
  const uniqueConsoleErrors = [...new Set(artifacts.consoleErrors)].slice(0, 12);
  const uniquePageErrors = [...new Set(artifacts.pageErrors)].slice(0, 12);

  for (const error of uniqueConsoleErrors) {
    addIssue("medium", "browser", "Console error", error.slice(0, 300));
  }

  for (const error of uniquePageErrors) {
    addIssue("high", "browser", "Runtime page error", error.slice(0, 300));
  }

  if (uniqueConsoleErrors.length === 0 && uniquePageErrors.length === 0) {
    addPass("browser", "No console/page errors captured");
  }
}

async function writeReportFiles() {
  await fs.writeFile(path.join(outputDir, "report.json"), JSON.stringify(report, null, 2));
  await fs.writeFile(path.join(outputDir, "report.md"), buildMarkdownReport());
}

function buildMarkdownReport() {
  const lines = [
    "# GFiscal user feedback E2E report",
    "",
    `- Run: ${report.runId}`,
    `- Base URL: ${report.baseUrl}`,
    `- User: ${report.email}`,
    `- Started: ${report.startedAt}`,
    `- Finished: ${report.finishedAt ?? ""}`,
    "",
    "## Summary",
    "",
    `- Critical: ${countBySeverity("critical")}`,
    `- High: ${countBySeverity("high")}`,
    `- Medium: ${countBySeverity("medium")}`,
    `- Low: ${countBySeverity("low")}`,
    `- Passes: ${report.passes.length}`,
    "",
    "## Issues",
    ""
  ];

  if (report.issues.length === 0) {
    lines.push("No issues detected.", "");
  } else {
    for (const issue of report.issues) {
      lines.push(`- [${issue.severity.toUpperCase()}] [${issue.area}] ${issue.title}`);
      if (issue.details) {
        lines.push(`  ${issue.details}`);
      }
    }
    lines.push("");
  }

  lines.push("## Passes", "");
  for (const pass of report.passes) {
    lines.push(`- [${pass.area}] ${pass.title}`);
  }

  lines.push("", "## Notes", "");
  for (const note of report.notes) {
    lines.push(`- [${note.area}] ${note.text}`);
  }

  lines.push("", "## Screenshots", "");
  for (const shot of artifacts.screenshots) {
    lines.push(`- ${shot}`);
  }

  return `${lines.join("\n")}\n`;
}

function printSummary() {
  console.log("\n== Report ==");
  console.log(`Artifacts: ${outputDir}`);
  console.log(`Issues: ${report.issues.length} (${report.summary})`);
  console.log(`Passes: ${report.passes.length}`);

  for (const issue of report.issues) {
    console.log(`[${issue.severity.toUpperCase()}] [${issue.area}] ${issue.title}`);
  }
}

function buildSummary() {
  return `critical=${countBySeverity("critical")}, high=${countBySeverity("high")}, medium=${countBySeverity("medium")}, low=${countBySeverity("low")}`;
}

function hasBlockingIssues() {
  return report.issues.some((issue) => issue.severity === "critical" || issue.severity === "high");
}

function countBySeverity(severity) {
  return report.issues.filter((issue) => issue.severity === severity).length;
}

function addIssue(severity, area, title, details = "") {
  const issue = { severity, area, title, details };
  report.issues.push(issue);
  console.log(`[${severity.toUpperCase()}] [${area}] ${title}`);
  if (details) {
    console.log(`  ${details}`);
  }
}

function addPass(area, title) {
  report.passes.push({ area, title });
  console.log(`[OK] [${area}] ${title}`);
}

function addNote(area, text) {
  report.notes.push({ area, text });
  console.log(`[NOTE] [${area}] ${text}`);
}

function assertMoney(area, label, actual, expected) {
  if (isClose(actual, expected)) {
    addPass(area, `${label} is ${formatEuro(actual)}`);
    return;
  }

  addIssue("high", area, `${label} amount mismatch`, `Expected ${formatEuro(expected)}, got ${formatEuro(actual)}.`);
}

function isClose(actual, expected) {
  return Number.isFinite(actual) && Math.abs(actual - expected) <= MONEY_TOLERANCE;
}

function parseEuro(value) {
  const normalizedValue = String(value)
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number(normalizedValue);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function formatEuro(value) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR"
  }).format(value);
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function chunkString(value, size) {
  const chunks = [];
  for (let index = 0; index < value.length; index += size) {
    chunks.push(value.slice(index, index + size));
  }
  return chunks;
}

function asMessage(error) {
  return error instanceof Error ? error.stack ?? error.message : String(error);
}

function failConfig(message) {
  console.error(message);
  process.exit(2);
}

function parseArgs(argv) {
  const parsed = {
    baseUrl: process.env.GFISCAL_BASE_URL
      ?? process.env.BASE_URL
      ?? process.env.npm_config_base_url
      ?? "http://localhost:3000",
    email: process.env.GFISCAL_E2E_EMAIL
      ?? process.env.GFISCAL_TEST_EMAIL
      ?? process.env.npm_config_email
      ?? DEFAULT_EMAIL,
    password: process.env.GFISCAL_E2E_PASSWORD
      ?? process.env.GFISCAL_TEST_PASSWORD
      ?? process.env.npm_config_password
      ?? "",
    headless: process.env.HEADLESS !== "false",
    slowMo: Number(process.env.GFISCAL_E2E_SLOW_MO ?? process.env.npm_config_slow_mo ?? 0),
    timeout: Number(process.env.GFISCAL_E2E_TIMEOUT_MS ?? process.env.npm_config_timeout ?? 20000),
    settleMs: Number(process.env.GFISCAL_E2E_SETTLE_MS ?? process.env.npm_config_settle_ms ?? 350),
    strict: process.env.npm_config_strict === "true",
    keepOpen: process.env.npm_config_keep_open === "true",
    createUser: process.env.npm_config_create_user === "true",
    noAuthFallback: process.env.npm_config_no_auth_fallback === "true"
  };

  if (process.env.npm_config_headed === "true") parsed.headless = false;
  if (process.env.npm_config_headless === "true") parsed.headless = true;

  for (const arg of argv) {
    if (arg === "--headed") parsed.headless = false;
    else if (arg === "--headless") parsed.headless = true;
    else if (arg === "--strict") parsed.strict = true;
    else if (arg === "--keep-open") parsed.keepOpen = true;
    else if (arg === "--create-user") parsed.createUser = true;
    else if (arg === "--no-auth-fallback") parsed.noAuthFallback = true;
    else if (arg.startsWith("--base-url=")) parsed.baseUrl = arg.slice("--base-url=".length);
    else if (arg.startsWith("--email=")) parsed.email = arg.slice("--email=".length);
    else if (arg.startsWith("--password=")) parsed.password = arg.slice("--password=".length);
    else if (arg.startsWith("--slow-mo=")) parsed.slowMo = Number(arg.slice("--slow-mo=".length));
    else if (arg.startsWith("--timeout=")) parsed.timeout = Number(arg.slice("--timeout=".length));
    else if (arg.startsWith("--settle-ms=")) parsed.settleMs = Number(arg.slice("--settle-ms=".length));
  }

  return parsed;
}
