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

export async function createContactClient(formData: FormData): Promise<{ error?: string }> {
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

  const { error } = await supabase
    .from("clients")
    .insert({
      organization_id: organizationId,
      name,
      type: clientType,
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
