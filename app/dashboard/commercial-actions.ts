"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@/src/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

async function getAuthenticatedUser() {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return { supabase, user };
}

export async function markPurchaseInvoicePaid(invoiceId: string): Promise<void> {
  if (!isUuid(invoiceId)) return;

  const { supabase } = await getAuthenticatedUser();

  await supabase
    .from("purchase_invoices")
    .update({ status: "paid", updated_at: new Date().toISOString() })
    .eq("id", invoiceId);

  revalidatePath("/dashboard");
}

export async function softDeletePurchaseInvoice(invoiceId: string): Promise<void> {
  if (!isUuid(invoiceId)) return;

  const { supabase } = await getAuthenticatedUser();

  await supabase
    .from("purchase_invoices")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", invoiceId);

  revalidatePath("/dashboard");
}

export async function createPurchaseInvoice(formData: FormData): Promise<{ error?: string }> {
  const organizationId = String(formData.get("organization_id") ?? "").trim();
  const fiscalEntityId = String(formData.get("fiscal_entity_id") ?? "").trim();

  if (!isUuid(organizationId) || !isUuid(fiscalEntityId)) {
    return { error: "Organización o entidad fiscal inválida." };
  }

  const { supabase, user } = await getAuthenticatedUser();

  const supplierIdRaw = String(formData.get("supplier_id") ?? "").trim();
  const supplierId = isUuid(supplierIdRaw) ? supplierIdRaw : null;

  const invoiceNumber = String(formData.get("invoice_number") ?? "").trim() || null;
  const issueDateRaw = String(formData.get("issue_date") ?? "").trim();
  const issueDate = issueDateRaw || null;
  const dueDateRaw = String(formData.get("due_date") ?? "").trim();
  const dueDate = dueDateRaw || null;
  const totalAmountRaw = Number(String(formData.get("total_amount") ?? "0").replace(",", "."));
  const totalAmount = Number.isFinite(totalAmountRaw) ? totalAmountRaw : 0;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const { error } = await supabase
    .from("purchase_invoices")
    .insert({
      organization_id: organizationId,
      fiscal_entity_id: fiscalEntityId,
      supplier_id: supplierId,
      invoice_number: invoiceNumber,
      issue_date: issueDate,
      due_date: dueDate,
      total_amount: totalAmount,
      notes,
      status: "open",
      created_by: user.id
    });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  return {};
}

export async function createContactClient(formData: FormData): Promise<{
  error?: string;
  client?: { id: string; code: string; name: string; taxId: string };
}> {
  const organizationId = String(formData.get("organization_id") ?? "").trim();

  if (!isUuid(organizationId)) {
    return { error: "Organización inválida." };
  }

  const { supabase, user } = await getAuthenticatedUser();

  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    return { error: "El nombre es obligatorio." };
  }

  const type = String(formData.get("type") ?? "company").trim();
  const validTypes = ["individual", "company"] as const;
  const clientType = validTypes.includes(type as "individual" | "company") ? (type as "individual" | "company") : "company";
  const code = String(formData.get("code") ?? "").trim() || await buildClientCode(organizationId);
  const taxId = String(formData.get("tax_id") ?? "").trim() || null;
  const fiscalAddress = String(formData.get("fiscal_address") ?? "").trim() || null;
  const city = String(formData.get("city") ?? "").trim() || null;
  const province = String(formData.get("province") ?? "").trim() || null;
  const postalCode = String(formData.get("postal_code") ?? "").trim() || null;
  const country = String(formData.get("country") ?? "ES").trim().slice(0, 2).toUpperCase() || "ES";
  const applyIrpf = String(formData.get("apply_irpf_by_default") ?? "") === "on";
  const irpfRate = applyIrpf ? parseAmount(formData, "default_irpf_rate", 15) : 0;

  let clientInsertResult = await supabase
    .from("clients")
    .insert({
      organization_id: organizationId,
      code,
      name,
      type: clientType,
      tax_id: taxId,
      contact_email: String(formData.get("contact_email") ?? "").trim() || null,
      contact_phone: String(formData.get("contact_phone") ?? "").trim() || null,
      fiscal_address: fiscalAddress,
      city,
      province,
      postal_code: postalCode,
      country,
      apply_irpf_by_default: applyIrpf,
      default_irpf_rate: irpfRate,
      created_by: user.id
    })
    .select("id, code, name, tax_id")
    .single();

  if (clientInsertResult.error) {
    clientInsertResult = await supabase
      .from("clients")
      .insert({
        organization_id: organizationId,
        name,
        type: clientType,
        contact_email: String(formData.get("contact_email") ?? "").trim() || null,
        contact_phone: String(formData.get("contact_phone") ?? "").trim() || null,
        notes: [
          code ? `Codigo: ${code}` : null,
          taxId ? `NIF/CIF: ${taxId}` : null,
          fiscalAddress ? `Domicilio: ${fiscalAddress}` : null,
          [postalCode, city, province].filter(Boolean).join(" ") || null,
          applyIrpf ? `IRPF por defecto: ${irpfRate}%` : null
        ].filter(Boolean).join("\n") || null,
        created_by: user.id
      })
      .select("id, name")
      .single();
  }

  if (clientInsertResult.error || !clientInsertResult.data) {
    return { error: clientInsertResult.error?.message ?? "No se pudo crear el cliente." };
  }

  revalidatePath("/dashboard");
  return {
    client: {
      id: clientInsertResult.data.id as string,
      code: String("code" in clientInsertResult.data ? clientInsertResult.data.code ?? code : code),
      name: String(clientInsertResult.data.name ?? name),
      taxId: String("tax_id" in clientInsertResult.data ? clientInsertResult.data.tax_id ?? taxId ?? "" : taxId ?? "")
    }
  };
}

export async function createSupplier(formData: FormData): Promise<{ error?: string }> {
  const organizationId = String(formData.get("organization_id") ?? "").trim();

  if (!isUuid(organizationId)) {
    return { error: "Organización inválida." };
  }

  const { supabase, user } = await getAuthenticatedUser();

  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    return { error: "El nombre es obligatorio." };
  }

  const { error } = await supabase
    .from("suppliers")
    .insert({
      organization_id: organizationId,
      name,
      tax_id: String(formData.get("tax_id") ?? "").trim() || null,
      contact_email: String(formData.get("contact_email") ?? "").trim() || null,
      contact_phone: String(formData.get("contact_phone") ?? "").trim() || null,
      created_by: user.id
    });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  return {};
}

export async function createProductService(formData: FormData): Promise<{ error?: string }> {
  const organizationId = String(formData.get("organization_id") ?? "").trim();

  if (!isUuid(organizationId)) {
    return { error: "Organización inválida." };
  }

  const { supabase, user } = await getAuthenticatedUser();

  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    return { error: "El nombre es obligatorio." };
  }

  const kind = String(formData.get("kind") ?? "service").trim();
  const validKinds = ["product", "service"] as const;
  const productKind = validKinds.includes(kind as "product" | "service") ? (kind as "product" | "service") : "service";

  const unitPriceRaw = Number(String(formData.get("unit_price") ?? "0").replace(",", "."));
  const unitPrice = Number.isFinite(unitPriceRaw) ? unitPriceRaw : 0;

  const taxRateRaw = String(formData.get("tax_rate") ?? "").trim();
  const taxRate = taxRateRaw ? Number(taxRateRaw.replace(",", ".")) : null;

  const { error } = await supabase
    .from("products_services")
    .insert({
      organization_id: organizationId,
      code: String(formData.get("code") ?? "").trim() || null,
      name,
      kind: productKind,
      description: String(formData.get("description") ?? "").trim() || null,
      unit_price: unitPrice,
      tax_rate: taxRate,
      is_active: true,
      created_by: user.id
    });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  return {};
}

export async function createSalesQuote(formData: FormData): Promise<{ error?: string }> {
  const organizationId = String(formData.get("organization_id") ?? "").trim();
  const fiscalEntityId = String(formData.get("fiscal_entity_id") ?? "").trim();
  const clientId = String(formData.get("client_id") ?? "").trim();

  if (!isUuid(organizationId) || !isUuid(fiscalEntityId) || !isUuid(clientId)) {
    return { error: "Organización, entidad fiscal o cliente inválido." };
  }

  const { supabase, user } = await getAuthenticatedUser();

  const quoteDateRaw = String(formData.get("quote_date") ?? "").trim();
  const totalAmountRaw = Number(String(formData.get("total_amount") ?? "0").replace(",", "."));
  const totalAmount = Number.isFinite(totalAmountRaw) ? totalAmountRaw : 0;

  const { error } = await supabase
    .from("sales_quotes")
    .insert({
      organization_id: organizationId,
      fiscal_entity_id: fiscalEntityId,
      client_id: clientId,
      quote_number: String(formData.get("quote_number") ?? "").trim() || null,
      quote_date: quoteDateRaw || null,
      currency: "EUR",
      status: "open",
      total_amount: totalAmount,
      notes: String(formData.get("notes") ?? "").trim() || null,
      created_by: user.id
    });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  return {};
}

type SalesInvoiceLineInput = {
  description?: string;
  discount?: number;
  product?: string;
  quantity?: number;
  unitPrice?: number;
};

export async function createSalesInvoice(formData: FormData): Promise<{ error?: string; invoice?: { id: string; number: string; total: number } }> {
  const organizationId = String(formData.get("organization_id") ?? "").trim();

  if (!isUuid(organizationId)) {
    return { error: "Organización inválida." };
  }

  const { supabase, user } = await getAuthenticatedUser();
  const fiscalEntityId = await resolveFiscalEntityId(organizationId, user.id);

  if (!fiscalEntityId) {
    return { error: "No hay entidad fiscal activa para emitir la factura." };
  }

  const clientId = await resolveSalesClientId(organizationId, formData);

  if (!clientId) {
    return { error: "Selecciona o introduce un cliente." };
  }

  const lines = parseSalesInvoiceLines(formData);

  if (lines.length === 0) {
    return { error: "Añade al menos una línea de producto o servicio." };
  }

  const subtotalAmount = roundMoney(lines.reduce((sum, line) => {
    const quantity = numberOrDefault(line.quantity, 1);
    const unitPrice = numberOrDefault(line.unitPrice, 0);
    const discountRate = numberOrDefault(line.discount, 0);
    const gross = quantity * unitPrice;

    return sum + gross - (gross * discountRate / 100);
  }, 0));
  const taxAmount = roundMoney(subtotalAmount * 0.21);
  const retentionRate = clampPercent(parseAmount(formData, "retention_rate", 0));
  const retentionAmount = roundMoney(subtotalAmount * retentionRate / 100);
  const suplidoAmount = Math.max(parseAmount(formData, "suplido_amount", 0), 0);
  const totalAmount = roundMoney(subtotalAmount + taxAmount - retentionAmount + suplidoAmount);
  const invoiceNumber = String(formData.get("invoice_number") ?? "").trim()
    || `VENTA-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Date.now().toString().slice(-5)}`;

  let invoiceInsertResult = await supabase
    .from("sales_invoices")
    .insert({
      organization_id: organizationId,
      fiscal_entity_id: fiscalEntityId,
      client_id: clientId,
      invoice_number: invoiceNumber,
      reference: String(formData.get("reference") ?? "").trim() || null,
      issue_date: String(formData.get("issue_date") ?? "").trim() || null,
      currency: "EUR",
      status: "draft",
      subtotal_amount: subtotalAmount,
      tax_amount: taxAmount,
      retention_rate: retentionRate,
      retention_amount: retentionAmount,
      suplido_amount: suplidoAmount,
      pdf_template: String(formData.get("pdf_template") ?? "standard").trim() || "standard",
      total_amount: totalAmount,
      notes: String(formData.get("notes") ?? "").trim() || null,
      created_by: user.id
    })
    .select("id, invoice_number")
    .single();

  if (invoiceInsertResult.error) {
    invoiceInsertResult = await supabase
      .from("sales_invoices")
      .insert({
        organization_id: organizationId,
        fiscal_entity_id: fiscalEntityId,
        client_id: clientId,
        invoice_number: invoiceNumber,
        issue_date: String(formData.get("issue_date") ?? "").trim() || null,
        currency: "EUR",
        status: "draft",
        subtotal_amount: subtotalAmount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        notes: [
          String(formData.get("reference") ?? "").trim() ? `Referencia: ${String(formData.get("reference") ?? "").trim()}` : null,
          `Retencion IRPF ${retentionRate}%: -${retentionAmount.toFixed(2)} EUR`,
          suplidoAmount ? `Suplido: ${suplidoAmount.toFixed(2)} EUR` : null,
          `Plantilla PDF: ${String(formData.get("pdf_template") ?? "standard")}`,
          String(formData.get("notes") ?? "").trim() || null
        ].filter(Boolean).join("\n"),
        created_by: user.id
      })
      .select("id, invoice_number")
      .single();
  }

  if (invoiceInsertResult.error || !invoiceInsertResult.data) {
    return { error: invoiceInsertResult.error?.message ?? "No se pudo crear la factura." };
  }

  const invoice = invoiceInsertResult.data;

  const lineRows = lines.map((line, index) => {
    const quantity = numberOrDefault(line.quantity, 1);
    const unitPrice = numberOrDefault(line.unitPrice, 0);
    const discountRate = clampPercent(numberOrDefault(line.discount, 0));
    const gross = quantity * unitPrice;

    return {
      organization_id: organizationId,
      sales_invoice_id: invoice.id,
      line_index: index,
      description: line.description?.trim() || line.product?.trim() || "Servicio",
      quantity,
      unit_price: unitPrice,
      tax_rate: 21,
      line_total: roundMoney(gross - (gross * discountRate / 100))
    };
  });

  let linesResult = await supabase
    .from("sales_invoice_lines")
    .insert(lineRows.map((line, index) => ({
      ...line,
      discount_rate: clampPercent(numberOrDefault(lines[index]?.discount, 0))
    })));

  if (linesResult.error) {
    linesResult = await supabase
      .from("sales_invoice_lines")
      .insert(lineRows);
  }

  if (linesResult.error) {
    return { error: linesResult.error.message };
  }

  revalidatePath("/dashboard");
  return {
    invoice: {
      id: invoice.id as string,
      number: String(invoice.invoice_number ?? invoiceNumber),
      total: totalAmount
    }
  };
}

async function resolveFiscalEntityId(organizationId: string, userId: string): Promise<string | null> {
  const supabase = await createSupabaseClient();
  const { data } = await supabase
    .from("fiscal_entities")
    .select("id")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (typeof data?.id === "string") {
    return data.id;
  }

  const { data: organization } = await supabase
    .from("organizations")
    .select("name, billing_email, country")
    .eq("id", organizationId)
    .maybeSingle<{ name: string; billing_email: string | null; country: string | null }>();
  const legalName = organization?.name?.trim() || "Entidad fiscal";

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert({
      organization_id: organizationId,
      name: legalName,
      type: "company",
      contact_email: organization?.billing_email ?? null,
      status: "active",
      notes: "Cliente interno creado automaticamente para emitir facturas.",
      created_by: userId
    })
    .select("id")
    .single();

  if (clientError || !client?.id) {
    return null;
  }

  const { data: createdEntity, error: entityError } = await supabase
    .from("fiscal_entities")
    .insert({
      organization_id: organizationId,
      client_id: client.id,
      legal_name: legalName,
      tax_id_country: "ES",
      entity_type: "company",
      country: organization?.country ?? "ES",
      status: "active",
      created_by: userId
    })
    .select("id")
    .single();

  if (entityError || !createdEntity?.id) {
    return null;
  }

  await supabase
    .from("fiscal_entity_members")
    .insert({
      organization_id: organizationId,
      fiscal_entity_id: createdEntity.id,
      user_id: userId,
      access_role: "uploader",
      can_upload: true,
      status: "active",
      created_by: userId
    });

  return createdEntity.id as string;
}

async function resolveSalesClientId(organizationId: string, formData: FormData): Promise<string | null> {
  const supabase = await createSupabaseClient();
  const clientId = String(formData.get("client_id") ?? "").trim();

  if (isUuid(clientId)) {
    return clientId;
  }

  const name = String(formData.get("client_name") ?? "").trim();

  if (!name) {
    return null;
  }

  const { data: existing } = await supabase
    .from("clients")
    .select("id")
    .eq("organization_id", organizationId)
    .ilike("name", name)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (typeof existing?.id === "string") {
    return existing.id;
  }

  let clientInsertResult = await supabase
    .from("clients")
    .insert({
      organization_id: organizationId,
      code: await buildClientCode(organizationId),
      name,
      type: "company",
      contact_email: String(formData.get("client_email") ?? "").trim() || null,
      contact_phone: String(formData.get("client_phone") ?? "").trim() || null,
      country: "ES",
      apply_irpf_by_default: Number(formData.get("retention_rate") ?? 0) > 0,
      default_irpf_rate: clampPercent(parseAmount(formData, "retention_rate", 0)),
      created_by: (await supabase.auth.getUser()).data.user?.id ?? null
    })
    .select("id")
    .single();

  if (clientInsertResult.error) {
    clientInsertResult = await supabase
      .from("clients")
      .insert({
        organization_id: organizationId,
        name,
        type: "company",
        contact_email: String(formData.get("client_email") ?? "").trim() || null,
        contact_phone: String(formData.get("client_phone") ?? "").trim() || null,
        notes: `Cliente creado desde factura. IRPF: ${clampPercent(parseAmount(formData, "retention_rate", 0))}%`,
        created_by: (await supabase.auth.getUser()).data.user?.id ?? null
      })
      .select("id")
      .single();
  }

  if (clientInsertResult.error) {
    return null;
  }

  return typeof clientInsertResult.data?.id === "string" ? clientInsertResult.data.id : null;
}

async function buildClientCode(organizationId: string): Promise<string> {
  const supabase = await createSupabaseClient();
  const { count } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);
  const nextNumber = (count ?? 0) + 1;

  return `CLI-${String(nextNumber).padStart(4, "0")}`;
}

function parseSalesInvoiceLines(formData: FormData): SalesInvoiceLineInput[] {
  const raw = String(formData.get("lines_json") ?? "[]");

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((line): line is SalesInvoiceLineInput => typeof line === "object" && line !== null)
      .filter((line) => numberOrDefault(line.quantity, 0) > 0 && numberOrDefault(line.unitPrice, 0) >= 0);
  } catch {
    return [];
  }
}

function parseAmount(formData: FormData, key: string, fallback: number): number {
  const value = String(formData.get(key) ?? "").trim().replace(/\./g, "").replace(",", ".");
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function numberOrDefault(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
