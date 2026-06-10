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

export async function createPurchaseInvoice(formData: FormData): Promise<{ error?: string; invoice?: { id: string } }> {
  const organizationId = String(formData.get("organization_id") ?? "").trim();

  if (!isUuid(organizationId)) {
    return { error: "Organización inválida." };
  }

  const { supabase, user } = await getAuthenticatedUser();

  const fiscalEntityIdRaw = String(formData.get("fiscal_entity_id") ?? "").trim();
  let fiscalEntityId = isUuid(fiscalEntityIdRaw) ? fiscalEntityIdRaw : null;

  if (!fiscalEntityId) {
    const fiscalEntity = await resolveFiscalEntityId(organizationId, user.id);

    if (!fiscalEntity.id) {
      return { error: fiscalEntity.error ?? "No hay entidad fiscal activa para registrar la compra." };
    }

    fiscalEntityId = fiscalEntity.id;
  }

  const supplierIdRaw = String(formData.get("supplier_id") ?? "").trim();
  let supplierId = isUuid(supplierIdRaw) ? supplierIdRaw : null;
  const supplierName = String(formData.get("supplier_name") ?? "").trim();

  if (!supplierId && supplierName) {
    const supplierResult = await resolvePurchaseSupplierId(supabase, organizationId, supplierName, user.id);

    if (supplierResult.error) {
      return { error: supplierResult.error };
    }

    supplierId = supplierResult.id;
  }

  const invoiceNumber = String(formData.get("invoice_number") ?? "").trim() || null;
  const issueDateRaw = String(formData.get("issue_date") ?? "").trim();
  const issueDate = issueDateRaw || null;
  const dueDateRaw = String(formData.get("due_date") ?? "").trim();
  const dueDate = dueDateRaw || null;
  const totalAmountRaw = Number(String(formData.get("total_amount") ?? "0").replace(",", "."));
  const totalAmount = Number.isFinite(totalAmountRaw) ? totalAmountRaw : 0;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const { data, error } = await supabase
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
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "No se pudo crear la factura de compra." };
  }

  revalidatePath("/dashboard");
  return { invoice: { id: data.id as string } };
}

async function resolvePurchaseSupplierId(
  supabase: Awaited<ReturnType<typeof createSupabaseClient>>,
  organizationId: string,
  supplierName: string,
  userId: string
): Promise<{ error?: string; id: string | null }> {
  const { data: existing } = await supabase
    .from("suppliers")
    .select("id")
    .eq("organization_id", organizationId)
    .ilike("name", supplierName)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (typeof existing?.id === "string") {
    return { id: existing.id };
  }

  const { data: created, error } = await supabase
    .from("suppliers")
    .insert({
      organization_id: organizationId,
      name: supplierName,
      created_by: userId
    })
    .select("id")
    .single();

  if (error || !created) {
    return { error: error?.message ?? "No se pudo crear el proveedor.", id: null };
  }

  return { id: created.id as string };
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

export async function createProductService(formData: FormData): Promise<{ error?: string; product?: { id: string } }> {
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

  const { data, error } = await supabase
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
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "No se pudo crear el producto o servicio." };
  }

  revalidatePath("/dashboard");
  return { product: { id: data.id as string } };
}

export async function createSalesQuote(formData: FormData): Promise<{ error?: string; quote?: { id: string; number: string; total: number } }> {
  const organizationId = String(formData.get("organization_id") ?? "").trim();

  if (!isUuid(organizationId)) {
    return { error: "Organización inválida." };
  }

  const { supabase, user } = await getAuthenticatedUser();
  const fiscalEntity = await resolveFiscalEntityId(organizationId, user.id);

  if (!fiscalEntity.id) {
    return { error: fiscalEntity.error ?? "No hay entidad fiscal activa para crear el presupuesto." };
  }

  const clientResult = await resolveSalesClientId(organizationId, formData);

  if (!clientResult.id) {
    return { error: clientResult.error ?? "Selecciona o introduce un cliente." };
  }

  const lines = parseSalesInvoiceLines(formData);

  if (lines.length === 0) {
    return { error: "Añade al menos una línea de producto o servicio." };
  }

  const quoteDateRaw = String(formData.get("quote_date") ?? "").trim();
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
  const numberResult = await supabase.rpc("next_document_number", {
    target_organization_id: organizationId,
    target_doc_type: "sales_quote",
    target_prefix: String(formData.get("number_prefix") ?? "").trim() || null
  });

  if (numberResult.error || !numberResult.data) {
    return { error: numberResult.error?.message ?? "No se pudo asignar numero de presupuesto." };
  }

  const quoteNumber = String(numberResult.data);

  const { data, error } = await supabase
    .from("sales_quotes")
    .insert({
      organization_id: organizationId,
      fiscal_entity_id: fiscalEntity.id,
      client_id: clientResult.id,
      quote_number: quoteNumber,
      quote_date: quoteDateRaw || null,
      currency: "EUR",
      status: "open",
      total_amount: totalAmount,
      notes: [
        String(formData.get("reference") ?? "").trim() ? `Referencia: ${String(formData.get("reference") ?? "").trim()}` : null,
        `Base imponible: ${subtotalAmount.toFixed(2)} EUR`,
        `IVA 21%: ${taxAmount.toFixed(2)} EUR`,
        retentionRate ? `Retencion IRPF ${retentionRate}%: -${retentionAmount.toFixed(2)} EUR` : null,
        suplidoAmount ? `Suplido: ${suplidoAmount.toFixed(2)} EUR` : null,
        `Plantilla PDF: ${String(formData.get("pdf_template") ?? "standard")}`,
        String(formData.get("notes") ?? "").trim() || null
      ].filter(Boolean).join("\n"),
      created_by: user.id
    })
    .select("id, quote_number")
    .single();

  if (error || !data) {
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  return {
    quote: {
      id: data.id as string,
      number: String(data.quote_number ?? quoteNumber),
      total: totalAmount
    }
  };
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
  const fiscalEntity = await resolveFiscalEntityId(organizationId, user.id);

  if (!fiscalEntity.id) {
    return { error: fiscalEntity.error ?? "No hay entidad fiscal activa para emitir la factura." };
  }

  const clientResult = await resolveSalesClientId(organizationId, formData);

  if (!clientResult.id) {
    return { error: clientResult.error ?? "Selecciona o introduce un cliente." };
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
  const numberResult = await supabase.rpc("next_document_number", {
    target_organization_id: organizationId,
    target_doc_type: "sales_invoice",
    target_prefix: String(formData.get("number_prefix") ?? "").trim() || null
  });

  if (numberResult.error || !numberResult.data) {
    return { error: numberResult.error?.message ?? "No se pudo asignar numero de factura." };
  }

  const invoiceNumber = String(numberResult.data);

  let invoiceInsertResult = await supabase
    .from("sales_invoices")
    .insert({
      organization_id: organizationId,
      fiscal_entity_id: fiscalEntity.id,
      client_id: clientResult.id,
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
        fiscal_entity_id: fiscalEntity.id,
        client_id: clientResult.id,
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

async function resolveFiscalEntityId(organizationId: string, userId: string): Promise<{ error?: string; id: string | null }> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("fiscal_entities")
    .select("id")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (typeof data?.id === "string") {
    return { id: data.id };
  }

  if (error) {
    return { error: error.message, id: null };
  }

  const { data: ensuredEntityId, error: ensureError } = await supabase
    .rpc("ensure_default_fiscal_entity", { p_organization_id: organizationId });

  if (typeof ensuredEntityId === "string") {
    return { id: ensuredEntityId };
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
    return { error: ensureError?.message ?? clientError?.message ?? "No se pudo crear el cliente interno de la entidad fiscal.", id: null };
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
    return { error: ensureError?.message ?? entityError?.message ?? "No se pudo crear la entidad fiscal.", id: null };
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

  return { id: createdEntity.id as string };
}

async function resolveSalesClientId(organizationId: string, formData: FormData): Promise<{ error?: string; id: string | null }> {
  const supabase = await createSupabaseClient();
  const clientId = String(formData.get("client_id") ?? "").trim();

  if (isUuid(clientId)) {
    return { id: clientId };
  }

  const name = String(formData.get("client_name") ?? "").trim();

  if (!name) {
    return { id: null };
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
    return { id: existing.id };
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
    const { data: ensuredClientId, error: ensureClientError } = await supabase
      .rpc("ensure_sales_client", {
        p_email: String(formData.get("client_email") ?? "").trim() || null,
        p_irpf_rate: clampPercent(parseAmount(formData, "retention_rate", 0)),
        p_name: name,
        p_organization_id: organizationId,
        p_phone: String(formData.get("client_phone") ?? "").trim() || null
      });

    if (typeof ensuredClientId === "string") {
      return { id: ensuredClientId };
    }

    return { error: ensureClientError?.message ?? clientInsertResult.error.message, id: null };
  }

  return typeof clientInsertResult.data?.id === "string"
    ? { id: clientInsertResult.data.id }
    : { error: "No se pudo crear el cliente.", id: null };
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

export type SalesDocumentKind = "invoice" | "quote";

export type SalesConfigPayload = {
  numbering?: { series?: string; nextNumber?: string; format?: string; reset?: string };
  payments?: { term?: string; method?: string; bankAccount?: string; reminder?: string };
  preferences?: { email?: string; pdfTemplate?: string; message?: string };
};

const SALES_DOCUMENT_STATUSES = new Set([
  "draft",
  "open",
  "booked",
  "sent",
  "accepted",
  "rejected",
  "overdue",
  "paid",
  "cancelled"
]);

function salesDocumentTable(kind: SalesDocumentKind): "sales_invoices" | "sales_quotes" {
  return kind === "quote" ? "sales_quotes" : "sales_invoices";
}

export async function updateSalesDocumentStatus(
  kind: SalesDocumentKind,
  documentId: string,
  status: string
): Promise<{ error?: string }> {
  if (!isUuid(documentId)) {
    return { error: "Documento inválido." };
  }

  if (!SALES_DOCUMENT_STATUSES.has(status)) {
    return { error: "Estado inválido." };
  }

  const { supabase } = await getAuthenticatedUser();
  const { error } = await supabase
    .from(salesDocumentTable(kind))
    .update({ status })
    .eq("id", documentId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  return {};
}

export async function softDeleteSalesDocument(
  kind: SalesDocumentKind,
  documentId: string
): Promise<{ error?: string }> {
  if (!isUuid(documentId)) {
    return { error: "Documento inválido." };
  }

  const { supabase } = await getAuthenticatedUser();
  const { error } = await supabase
    .from(salesDocumentTable(kind))
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", documentId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  return {};
}

export async function duplicateSalesDocument(
  kind: SalesDocumentKind,
  documentId: string
): Promise<{
  error?: string;
  document?: { id: string; number: string; date: string; client: string; total: number; status: string };
}> {
  if (!isUuid(documentId)) {
    return { error: "Documento inválido." };
  }

  const { supabase, user } = await getAuthenticatedUser();

  if (kind === "quote") {
    const { data: original, error: readError } = await supabase
      .from("sales_quotes")
      .select("organization_id, fiscal_entity_id, client_id, quote_number, quote_date, currency, total_amount, notes, clients!client_id(name)")
      .eq("id", documentId)
      .single();

    if (readError || !original) {
      return { error: readError?.message ?? "Presupuesto no encontrado." };
    }

    const copyNumberResult = await supabase.rpc("next_document_number", {
      target_organization_id: original.organization_id,
      target_doc_type: "sales_quote",
      target_prefix: null
    });

    if (copyNumberResult.error || !copyNumberResult.data) {
      return { error: copyNumberResult.error?.message ?? "No se pudo asignar numero al duplicado." };
    }

    const copyNumber = String(copyNumberResult.data);
    const { data: copy, error: insertError } = await supabase
      .from("sales_quotes")
      .insert({
        organization_id: original.organization_id,
        fiscal_entity_id: original.fiscal_entity_id,
        client_id: original.client_id,
        quote_number: copyNumber,
        quote_date: original.quote_date,
        currency: original.currency,
        status: "draft",
        total_amount: original.total_amount,
        notes: original.notes,
        created_by: user.id
      })
      .select("id, quote_number, quote_date, total_amount")
      .single();

    if (insertError || !copy) {
      return { error: insertError?.message ?? "No se pudo duplicar el presupuesto." };
    }

    revalidatePath("/dashboard");
    return {
      document: {
        id: copy.id as string,
        number: String(copy.quote_number ?? copyNumber),
        date: String(copy.quote_date ?? ""),
        client: (original.clients as { name?: string } | null)?.name ?? "—",
        total: Number(copy.total_amount),
        status: "draft"
      }
    };
  }

  const { data: original, error: readError } = await supabase
    .from("sales_invoices")
    .select("organization_id, fiscal_entity_id, client_id, invoice_number, issue_date, currency, subtotal_amount, tax_amount, retention_rate, retention_amount, suplido_amount, pdf_template, total_amount, notes, clients!client_id(name)")
    .eq("id", documentId)
    .single();

  if (readError || !original) {
    return { error: readError?.message ?? "Factura no encontrada." };
  }

  const copyNumberResult = await supabase.rpc("next_document_number", {
    target_organization_id: original.organization_id,
    target_doc_type: "sales_invoice",
    target_prefix: null
  });

  if (copyNumberResult.error || !copyNumberResult.data) {
    return { error: copyNumberResult.error?.message ?? "No se pudo asignar numero al duplicado." };
  }

  const copyNumber = String(copyNumberResult.data);
  const { data: copy, error: insertError } = await supabase
    .from("sales_invoices")
    .insert({
      organization_id: original.organization_id,
      fiscal_entity_id: original.fiscal_entity_id,
      client_id: original.client_id,
      invoice_number: copyNumber,
      issue_date: original.issue_date,
      currency: original.currency,
      status: "draft",
      subtotal_amount: original.subtotal_amount,
      tax_amount: original.tax_amount,
      retention_rate: original.retention_rate,
      retention_amount: original.retention_amount,
      suplido_amount: original.suplido_amount,
      pdf_template: original.pdf_template,
      total_amount: original.total_amount,
      notes: original.notes,
      created_by: user.id
    })
    .select("id, invoice_number, issue_date, total_amount")
    .single();

  if (insertError || !copy) {
    return { error: insertError?.message ?? "No se pudo duplicar la factura." };
  }

  const { data: originalLines } = await supabase
    .from("sales_invoice_lines")
    .select("organization_id, line_index, description, quantity, unit_price, tax_rate, line_total")
    .eq("sales_invoice_id", documentId)
    .order("line_index", { ascending: true });

  if (originalLines && originalLines.length > 0) {
    await supabase
      .from("sales_invoice_lines")
      .insert(originalLines.map((line) => ({ ...line, sales_invoice_id: copy.id })));
  }

  revalidatePath("/dashboard");
  return {
    document: {
      id: copy.id as string,
      number: String(copy.invoice_number ?? copyNumber),
      date: String(copy.issue_date ?? ""),
      client: (original.clients as { name?: string } | null)?.name ?? "—",
      total: Number(copy.total_amount),
      status: "draft"
    }
  };
}

export async function saveSalesConfigSection(
  organizationId: string,
  section: "numbering" | "payments" | "preferences",
  values: Record<string, string>
): Promise<{ error?: string }> {
  if (!isUuid(organizationId)) {
    return { error: "Organización inválida." };
  }

  const { supabase } = await getAuthenticatedUser();
  const { data: existing } = await supabase
    .from("sales_config")
    .select("payload")
    .eq("organization_id", organizationId)
    .maybeSingle();

  const payload = {
    ...((existing?.payload as SalesConfigPayload | null) ?? {}),
    [section]: values
  };

  const { error } = await supabase
    .from("sales_config")
    .upsert({ organization_id: organizationId, payload }, { onConflict: "organization_id" });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  return {};
}
