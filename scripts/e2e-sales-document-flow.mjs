#!/usr/bin/env node
import "dotenv/config";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const DEFAULT_EMAIL = "sergio.hlara84@gmail.com";

const args = parseArgs(process.argv.slice(2));
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = path.resolve("output", "e2e-sales-document-flow", runId);
const stamp = Date.now().toString().slice(-6);
const fixtures = {
  clientName: `Sociedad E2E ${stamp} SL`,
  productName: `Producto E2E ${stamp}`,
  serviceName: `Servicio E2E ${stamp}`
};
const runState = {
  createdUserId: null,
  organizationId: null
};

if (args.createUser) {
  await createConfirmedUser();
}

if (!args.password) {
  console.error("Missing password. Set GFISCAL_E2E_PASSWORD, pass --password, or run with --create-user.");
  process.exit(2);
}

await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: args.headless, slowMo: args.slowMo });
const context = await browser.newContext({
  viewport: { width: 1440, height: 920 },
  locale: "es-ES",
  timezoneId: "Europe/Madrid"
});
const page = await context.newPage();
const report = { runId, baseUrl: args.baseUrl, email: args.email, fixtures, passes: [], screenshots: [] };
let fatalError = null;

try {
  await login(page);
  await createClientContact(page);
  await createProductOrService(page, "product", fixtures.productName);
  await createProductOrService(page, "service", fixtures.serviceName);
  await createSalesDocument(page, "quotes", "Presupuesto de venta");
  await createSalesDocument(page, "invoices", "Factura de venta");
} catch (error) {
  fatalError = error;
  await screenshot(page, "fatal-error").catch(() => {});
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
} finally {
  if (!args.keepOpen) await browser.close();
  report.cleanup = await cleanupFixture();
  await writeReport(fatalError);
  if (!fatalError && report.cleanup.errors.length === 0) {
    console.log(`Sales document E2E OK. Artifacts: ${outputDir}`);
  }
}

async function login(page) {
  await goto(page, "/login");
  if (!page.url().includes("/dashboard")) {
    const loginPanel = page.locator(".login-panel").filter({ hasText: "Acceso al panel" }).first();
    await loginPanel.locator('input[name="email"]').fill(args.email);
    await loginPanel.locator('input[name="password"]').fill(args.password);
    await screenshot(page, "01-login");
    await loginPanel.getByRole("button", { name: /Entrar/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: args.timeout });
  }

  await ensureWorkspace(page);
  pass("auth", "Dashboard loaded");
}

async function ensureWorkspace(page) {
  await goto(page, "/dashboard");

  if (page.url().includes("/onboarding")) {
    await page.locator(".onboarding-panel").waitFor({ timeout: args.timeout });
    await fillByLabel(page.locator(".onboarding-panel"), "Nombre del despacho", `GFiscal E2E ${stamp}`);
    await screenshot(page, "02-onboarding-filled");
    await page.getByRole("button", { name: /Crear|Guardar|Continuar|Alta/i }).click();
    await page.waitForURL((url) => url.pathname.includes("/dashboard"), { timeout: args.timeout });
  }

  await page.locator("main").waitFor({ timeout: args.timeout });
  rememberOrganizationFromUrl(page.url());
}

async function createClientContact(page) {
  await goto(page, "/dashboard?module=contacts");
  await clickByText(page.locator("main"), ["Crear cliente", "Anadir", "Añadir"]);
  const form = page.locator('section[aria-label="Nuevo cliente"]').first();
  await form.waitFor({ timeout: args.timeout });

  await clickByText(form, ["Sociedad"]);
  await fillByLabel(form, "Razon social o nombre", fixtures.clientName);
  await fillByLabel(form, "NIF/CIF", `B${stamp.padStart(8, "0").slice(0, 8)}`);
  await fillByLabel(form, "Codigo postal", "28013");
  await fillByLabel(form, "Poblacion", "Madrid");
  await fillByLabel(form, "Domicilio", "Calle Mayor 1");
  await fillByLabel(form, "E-mail", `cliente.e2e.${stamp}@example.com`);
  await screenshot(page, "10-client-filled");
  await form.getByRole("button", { name: /^Crear$/i }).click();
  await page.getByText(fixtures.clientName).first().waitFor({ timeout: args.timeout });
  pass("contacts", "Created sociedad client");
}

async function createProductOrService(page, kind, name) {
  await goto(page, "/dashboard?module=products");
  await clickByText(page.locator("main"), [kind === "service" ? "Crear servicio" : "Crear producto"]);
  const form = page.locator('section[aria-label="Alta de producto o servicio"]').first();
  await form.waitFor({ timeout: args.timeout });

  await fillByLabel(form, "Nombre", name);
  await fillByLabel(form, "Descripcion", `${name} descripcion PDF`);
  await clickByText(form, ["Precios y descuentos de venta"]);
  await fillByLabel(form, "Precio", kind === "service" ? "150" : "80");
  await screenshot(page, `20-${kind}-filled`);
  await form.getByRole("button", { name: /^Crear$/i }).click();
  await page.getByText(name).first().waitFor({ timeout: args.timeout });
  pass("products", `Created ${kind}`);
}

async function createSalesDocument(page, section, formTitle) {
  await goto(page, `/dashboard?module=sales&salesSection=${section}`);
  await clickByText(page.locator("main"), [section === "quotes" ? "Crear presupuesto" : "Crear factura"]);
  const form = page.locator(`section[aria-label="${formTitle}"]`).first();
  await form.waitFor({ timeout: args.timeout });

  await selectByLabel(form, "Cliente", fixtures.clientName);
  await ensureDocumentLine(form);
  await fillFirstVisible(form.locator('input[aria-label="Producto o servicio"]'), section === "quotes" ? fixtures.productName : fixtures.serviceName);
  await fillFirstVisible(form.locator('textarea[aria-label="Descripcion"], input[aria-label="Descripcion"]'), `${formTitle} con lineas E2E`);
  await fillFirstVisible(form.locator('input[aria-label="Cantidad"]'), "1");
  await fillFirstVisible(form.locator('input[aria-label="Precio unitario"]'), section === "quotes" ? "80" : "150");
  await screenshot(page, `30-${section}-filled`);
  await form.getByRole("button", { name: /^Crear$/i }).click();

  const dialog = page.locator(".sales-print-modal:visible").last();
  await dialog.waitFor({ timeout: args.timeout });
  await dialog.getByRole("tab", { name: /Formato PDF/i }).waitFor({ timeout: args.timeout });
  await dialog.getByRole("tab", { name: /Formato Plantilla/i }).click();
  await dialog.locator(".preview-panel").waitFor({ timeout: args.timeout });
  await screenshot(page, `31-${section}-preview-template`);
  await dialog.getByRole("button", { name: /Guardar borrador|Cerrar/i }).last().click();
  pass("sales", `Created ${section} and previewed PDF/template formats`);
}

async function ensureDocumentLine(form) {
  if (await form.locator('input[aria-label="Producto o servicio"]').count()) {
    return;
  }

  await clickByText(form, ["Anadir linea", "Añadir linea", "Anadir", "Añadir"]);
}

async function createConfirmedUser() {
  const admin = createAdminClient("--create-user");

  args.email ||= `gfiscal-e2e-sales-${Date.now()}@example.com`;
  args.password ||= `Gfiscal-${Date.now()}!Aa`;

  const { data, error } = await admin.auth.admin.createUser({
    email: args.email,
    password: args.password,
    email_confirm: true,
    user_metadata: { display_name: "GFiscal E2E Sales" }
  });

  if (error) {
    console.error(`Could not create E2E user: ${error.message}`);
    process.exit(2);
  }

  runState.createdUserId = data.user?.id ?? null;
  console.log(`Created confirmed E2E user ${args.email}`);
}

async function cleanupFixture() {
  const cleanup = {
    requested: args.cleanup,
    skippedReason: null,
    organizationId: runState.organizationId,
    userId: runState.createdUserId,
    deletedOrganization: false,
    deletedUser: false,
    errors: []
  };

  if (!args.cleanup) {
    return cleanup;
  }

  if (!args.createUser) {
    cleanup.skippedReason = "--cleanup solo se ejecuta con usuarios creados por --create-user.";
    console.log(`[SKIP] [cleanup] ${cleanup.skippedReason}`);
    return cleanup;
  }

  if (args.keepOpen) {
    cleanup.skippedReason = "--cleanup se omite con --keep-open para no invalidar la sesión abierta.";
    console.log(`[SKIP] [cleanup] ${cleanup.skippedReason}`);
    return cleanup;
  }

  if (!runState.createdUserId) {
    cleanup.errors.push("No hay id de usuario temporal para limpiar.");
    process.exitCode = 1;
    return cleanup;
  }

  const admin = createAdminClient("--cleanup");
  let organizationId = runState.organizationId;
  if (!organizationId) {
    try {
      organizationId = await findCreatedOrganizationId(admin, runState.createdUserId);
    } catch (error) {
      cleanup.errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  cleanup.organizationId = organizationId;
  cleanup.userId = runState.createdUserId;

  if (organizationId) {
    const deleteOrganization = await admin
      .from("organizations")
      .delete()
      .eq("id", organizationId)
      .select("id")
      .maybeSingle();

    if (deleteOrganization.error) {
      cleanup.errors.push(`No se pudo borrar la organización temporal: ${deleteOrganization.error.message}`);
    } else {
      cleanup.deletedOrganization = Boolean(deleteOrganization.data?.id);
    }
  } else {
    cleanup.skippedReason = "No se encontró organización temporal asociada al usuario.";
  }

  const deleteUser = await admin.auth.admin.deleteUser(runState.createdUserId, false);
  if (deleteUser.error) {
    cleanup.errors.push(`No se pudo borrar el usuario temporal: ${deleteUser.error.message}`);
  } else {
    cleanup.deletedUser = true;
  }

  if (cleanup.errors.length > 0) {
    for (const error of cleanup.errors) {
      console.error(`[ERROR] [cleanup] ${error}`);
    }
    process.exitCode = 1;
  } else {
    console.log(`[OK] [cleanup] Removed temporary user${organizationId ? " and organization" : ""}`);
  }

  return cleanup;
}

async function findCreatedOrganizationId(admin, userId) {
  const { data, error } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo localizar la organización temporal: ${error.message}`);
  }

  return data?.organization_id ?? null;
}

function createAdminClient(reason) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(`${reason} requires SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.`);
    process.exit(2);
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

function rememberOrganizationFromUrl(currentUrl) {
  const organizationId = new URL(currentUrl).searchParams.get("org");
  if (organizationId) {
    runState.organizationId = organizationId;
  }
}

async function goto(page, pathname) {
  await page.goto(new URL(pathname, args.baseUrl).toString(), { waitUntil: "domcontentloaded", timeout: args.timeout });
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(args.settleMs);
}

async function fillByLabel(scope, labelText, value) {
  const label = await findLabel(scope, labelText);
  await label.waitFor({ timeout: args.timeout });
  const control = label.locator("input, textarea, select").first();
  const tag = await control.evaluate((element) => element.tagName.toLowerCase());
  if (tag === "select") {
    await control.selectOption({ label: value }).catch(() => control.selectOption(value));
  } else {
    await control.fill(value);
  }
}

async function selectByLabel(scope, labelText, optionLabel) {
  const label = await findLabel(scope, labelText);
  await label.waitFor({ timeout: args.timeout });
  await label.locator("select").first().selectOption({ label: optionLabel });
}

async function findLabel(scope, labelText) {
  const direct = scope.locator("label").filter({ hasText: new RegExp(escapeRegExp(labelText), "i") }).first();
  if (await direct.count()) {
    return direct;
  }

  const normalizedNeedle = normalize(labelText);
  const labels = await scope.locator("label").all();
  for (const label of labels) {
    const text = normalize(await label.textContent().catch(() => ""));
    if (text.includes(normalizedNeedle)) {
      return label;
    }
  }

  return direct;
}

async function fillFirstVisible(locator, value) {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    if (await candidate.isVisible().catch(() => false)) {
      await candidate.fill(value);
      return;
    }
  }
  throw new Error(`No visible field found for value ${value}`);
}

async function clickByText(scope, labels) {
  const normalized = labels.map(normalize);
  const candidates = await scope.locator("button, a, [role='button'], label").all();
  for (const candidate of candidates) {
    const text = normalize(await candidate.textContent().catch(() => ""));
    if (normalized.some((label) => text.includes(label))) {
      await candidate.click();
      return;
    }
  }
  throw new Error(`Could not find clickable text: ${labels.join(", ")}`);
}

async function screenshot(page, name) {
  const file = path.join(outputDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  report.screenshots.push(file);
}

function pass(area, title) {
  report.passes.push({ area, title });
  console.log(`[OK] [${area}] ${title}`);
}

async function writeReport(error) {
  await fs.writeFile(path.join(outputDir, "report.json"), JSON.stringify({ ...report, error: error ? String(error) : null }, null, 2));
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

function parseArgs(argv) {
  const parsed = {
    baseUrl: process.env.GFISCAL_BASE_URL
      ?? process.env.BASE_URL
      ?? process.env.npm_config_base_url
      ?? "http://localhost:3000",
    email: process.env.GFISCAL_E2E_EMAIL
      ?? process.env.GFISCAL_TEST_EMAIL
      ?? process.env.npm_config_email
      ?? "",
    password: process.env.GFISCAL_E2E_PASSWORD
      ?? process.env.GFISCAL_TEST_PASSWORD
      ?? process.env.npm_config_password
      ?? "",
    headless: process.env.HEADLESS !== "false",
    keepOpen: process.env.npm_config_keep_open === "true",
    createUser: process.env.npm_config_create_user === "true",
    cleanup: process.env.npm_config_cleanup === "true",
    slowMo: Number(process.env.GFISCAL_E2E_SLOW_MO ?? process.env.npm_config_slow_mo ?? 0),
    timeout: Number(process.env.GFISCAL_E2E_TIMEOUT_MS ?? process.env.npm_config_timeout ?? 20000),
    settleMs: Number(process.env.GFISCAL_E2E_SETTLE_MS ?? process.env.npm_config_settle_ms ?? 350)
  };

  if (process.env.npm_config_headed === "true") parsed.headless = false;
  if (process.env.npm_config_headless === "true") parsed.headless = true;

  for (const arg of argv) {
    if (arg === "--headed") parsed.headless = false;
    else if (arg === "--headless") parsed.headless = true;
    else if (arg === "--keep-open") parsed.keepOpen = true;
    else if (arg === "--create-user") parsed.createUser = true;
    else if (arg === "--cleanup") parsed.cleanup = true;
    else if (arg.startsWith("--base-url=")) parsed.baseUrl = arg.slice("--base-url=".length);
    else if (arg.startsWith("--email=")) parsed.email = arg.slice("--email=".length);
    else if (arg.startsWith("--password=")) parsed.password = arg.slice("--password=".length);
  }

  if (!parsed.email && !parsed.createUser) {
    parsed.email = DEFAULT_EMAIL;
  }

  return parsed;
}
