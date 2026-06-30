"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@/src/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function shortId(uuid: string): string {
  return uuid.slice(0, 8).toUpperCase();
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
  client?: {
    id: string;
    code: string;
    name: string;
    taxId: string;
    clientKind: "self_employed" | "individual";
    applyIrpfByDefault: boolean;
    city: string;
    contactEmail: string;
    contactPhone: string;
    country: string;
    defaultIrpfRate: number;
    fiscalAddress: string;
    postalCode: string;
    province: string;
  };
}> {
  const organizationId = String(formData.get("organization_id") ?? "").trim();

  if (!isUuid(organizationId)) {
    return { error: "Organización inválida." };
  }

  const { supabase } = await getAuthenticatedUser();

  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    return { error: "El nombre es obligatorio." };
  }

  const type = String(formData.get("type") ?? "company").trim();
  const validTypes = ["individual", "company"] as const;
  const clientType = validTypes.includes(type as "individual" | "company") ? (type as "individual" | "company") : "company";
  const taxId = String(formData.get("tax_id") ?? "").trim() || null;
  const fiscalAddress = String(formData.get("fiscal_address") ?? "").trim() || null;
  const city = String(formData.get("city") ?? "").trim() || null;
  const province = String(formData.get("province") ?? "").trim() || null;
  const postalCode = String(formData.get("postal_code") ?? "").trim() || null;
  const country = String(formData.get("country") ?? "ES").trim().slice(0, 2).toUpperCase() || "ES";
  const applyIrpf = String(formData.get("apply_irpf_by_default") ?? "") === "on";
  const irpfRate = applyIrpf ? parseAmount(formData, "default_irpf_rate", 15) : 0;
  const contactEmail = String(formData.get("contact_email") ?? "").trim() || null;
  const contactPhone = String(formData.get("contact_phone") ?? "").trim() || null;
  const vatNumber = String(formData.get("vat_number") ?? "").trim().toUpperCase() || null;

  const { data, error } = await supabase.rpc("create_contact_client", {
    p_apply_irpf_by_default: applyIrpf,
    p_city: city,
    p_contact_email: contactEmail,
    p_contact_phone: contactPhone,
    p_country: country,
    p_default_irpf_rate: irpfRate,
    p_fiscal_address: fiscalAddress,
    p_name: name,
    p_organization_id: organizationId,
    p_postal_code: postalCode,
    p_province: province,
    p_tax_id: taxId,
    p_type: clientType
  });

  const created = Array.isArray(data) ? data[0] : data;

  if (error || !created) {
    return { error: error?.message ?? "No se pudo crear el cliente." };
  }

  // El NIF-IVA intracomunitario se persiste aparte: la RPC no lo recibe y la
  // columna clients.vat_number es aditiva. Si falla (columna ausente) no rompe el alta.
  if (vatNumber) {
    const vatResult = await supabase
      .from("clients")
      .update({ vat_number: vatNumber })
      .eq("id", String(created.id));
    if (vatResult.error) {
      console.error("No se pudo guardar el NIF-IVA del cliente:", vatResult.error.message);
    }
  }

  revalidatePath("/dashboard");
  return {
    client: {
      id: String(created.id),
      code: String(created.code ?? ""),
      name: String(created.name ?? name),
      taxId: String(created.tax_id ?? taxId ?? ""),
      clientKind: String(created.type) === "individual" ? "individual" : "self_employed",
      applyIrpfByDefault: Boolean(created.apply_irpf_by_default),
      city: String(created.city ?? city ?? ""),
      contactEmail: String(created.contact_email ?? contactEmail ?? ""),
      contactPhone: String(created.contact_phone ?? contactPhone ?? ""),
      country: String(created.country ?? country),
      defaultIrpfRate: Number(created.default_irpf_rate ?? irpfRate),
      fiscalAddress: String(created.fiscal_address ?? fiscalAddress ?? ""),
      postalCode: String(created.postal_code ?? postalCode ?? ""),
      province: String(created.province ?? province ?? "")
    }
  };
}

export async function updateContactClient(formData: FormData): Promise<{
  error?: string;
  client?: {
    id: string;
    name: string;
    code: string;
    taxId: string;
    clientKind: "self_employed" | "individual";
    applyIrpfByDefault: boolean;
    city: string;
    contactEmail: string;
    contactPhone: string;
    country: string;
    defaultIrpfRate: number;
    fiscalAddress: string;
    postalCode: string;
    province: string;
  };
}> {
  const clientId = String(formData.get("client_id") ?? "").trim();

  if (!isUuid(clientId)) {
    return { error: "Cliente inválido." };
  }

  const { supabase } = await getAuthenticatedUser();
  const name = String(formData.get("name") ?? "").trim();
  const taxId = String(formData.get("tax_id") ?? "").trim() || null;
  const contactEmail = String(formData.get("contact_email") ?? "").trim() || null;
  const contactPhone = String(formData.get("contact_phone") ?? "").trim() || null;
  const fiscalAddress = String(formData.get("fiscal_address") ?? "").trim() || null;
  const city = String(formData.get("city") ?? "").trim() || null;
  const province = String(formData.get("province") ?? "").trim() || null;
  const postalCode = String(formData.get("postal_code") ?? "").trim() || null;
  const country = String(formData.get("country") ?? "ES").trim().slice(0, 2).toUpperCase() || "ES";
  const applyIrpf = String(formData.get("apply_irpf_by_default") ?? "") === "on";
  const irpfRate = applyIrpf ? parseAmount(formData, "default_irpf_rate", 15) : 0;

  const { data, error } = await supabase
    .from("clients")
    .update({
      name: name || null,
      tax_id: taxId,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      fiscal_address: fiscalAddress,
      city,
      province,
      postal_code: postalCode,
      country,
      apply_irpf_by_default: applyIrpf,
      default_irpf_rate: irpfRate
    })
    .eq("id", clientId)
    .is("deleted_at", null)
    .select("id, name, code, type, tax_id, contact_email, contact_phone, fiscal_address, city, province, postal_code, country, apply_irpf_by_default, default_irpf_rate")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "No se pudo actualizar el cliente." };
  }

  revalidatePath("/dashboard");
  return {
    client: {
      id: String(data.id),
      name: String(data.name ?? ""),
      code: String(data.code ?? ""),
      taxId: String(data.tax_id ?? ""),
      clientKind: String(data.type) === "individual" ? "individual" : "self_employed",
      applyIrpfByDefault: Boolean(data.apply_irpf_by_default),
      city: String(data.city ?? ""),
      contactEmail: String(data.contact_email ?? ""),
      contactPhone: String(data.contact_phone ?? ""),
      country: String(data.country ?? "ES"),
      defaultIrpfRate: Number(data.default_irpf_rate ?? 0),
      fiscalAddress: String(data.fiscal_address ?? ""),
      postalCode: String(data.postal_code ?? ""),
      province: String(data.province ?? "")
    }
  };
}

export async function softDeleteContactClient(clientId: string): Promise<{ error?: string }> {
  if (!isUuid(clientId)) {
    return { error: "Cliente inválido." };
  }

  const { supabase } = await getAuthenticatedUser();

  const linkedCounts = await Promise.all([
    supabase
      .from("sales_invoices")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .is("deleted_at", null),
    supabase
      .from("sales_quotes")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .is("deleted_at", null),
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .is("deleted_at", null),
    supabase
      .from("fiscal_entities")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .is("deleted_at", null)
  ]);

  const invoiceCount = linkedCounts[0]?.count ?? 0;
  const quoteCount = linkedCounts[1]?.count ?? 0;
  const documentCount = linkedCounts[2]?.count ?? 0;
  const fiscalEntityCount = linkedCounts[3]?.count ?? 0;

  if (fiscalEntityCount > 0) {
    return { error: "Este cliente es la base de una entidad fiscal y no se puede eliminar." };
  }

  if (invoiceCount > 0 || quoteCount > 0 || documentCount > 0) {
    return {
      error: "Este cliente tiene documentos vinculados. Elimina o reasigna sus presupuestos, facturas o documentos antes de borrarlo."
    };
  }

  const { error } = await supabase
    .from("clients")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", clientId)
    .is("deleted_at", null);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  return {};
}

export async function getContactClientDeleteSummary(clientId: string): Promise<{
  error?: string;
  summary?: {
    pendingQuotes: number;
    pendingInvoices: number;
    outstandingBalance: number;
    linkedDocuments: number;
    isFiscalEntityClient: boolean;
  };
}> {
  if (!isUuid(clientId)) {
    return { error: "Cliente inválido." };
  }

  const { supabase } = await getAuthenticatedUser();

  const [quotesResult, invoicesResult, maturitiesResult, documentsResult, fiscalEntityResult] = await Promise.all([
    supabase
      .from("sales_quotes")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .is("deleted_at", null)
      .in("status", ["draft", "open", "sent"]),
    supabase
      .from("sales_invoices")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .is("deleted_at", null)
      .in("status", ["draft", "open", "sent", "overdue"]),
    supabase
      .from("commercial_maturities")
      .select("outstanding_amount, sales_invoices!inner(client_id)")
      .eq("sales_invoices.client_id", clientId)
      .eq("direction", "receivable")
      .is("deleted_at", null)
      .in("status", ["open", "overdue", "partial"]),
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .is("deleted_at", null),
    supabase
      .from("fiscal_entities")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .is("deleted_at", null)
  ]);

  const outstandingBalance = (maturitiesResult.data ?? []).reduce((sum, row) => {
    const amount = Number((row as { outstanding_amount: number | null }).outstanding_amount ?? 0);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  return {
    summary: {
      pendingQuotes: quotesResult.count ?? 0,
      pendingInvoices: invoicesResult.count ?? 0,
      outstandingBalance,
      linkedDocuments: documentsResult.count ?? 0,
      isFiscalEntityClient: (fiscalEntityResult.count ?? 0) > 0
    }
  };
}

export type ClientAddressRecord = {
  id: string;
  label: string;
  addressLine: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  isDefaultDelivery: boolean;
};

export async function listClientAddresses(clientId: string): Promise<{ error?: string; addresses?: ClientAddressRecord[] }> {
  if (!isUuid(clientId)) {
    return { error: "Cliente inválido." };
  }

  const { supabase } = await getAuthenticatedUser();
  const { data, error } = await supabase
    .from("client_addresses")
    .select("id, label, address_line, city, province, postal_code, country, is_default_delivery")
    .eq("client_id", clientId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    return { error: error.message };
  }

  return {
    addresses: (data ?? []).map((row) => ({
      id: String(row.id),
      label: String(row.label ?? "Direccion"),
      addressLine: String(row.address_line ?? ""),
      city: String(row.city ?? ""),
      province: String(row.province ?? ""),
      postalCode: String(row.postal_code ?? ""),
      country: String(row.country ?? "ES"),
      isDefaultDelivery: Boolean(row.is_default_delivery)
    }))
  };
}

export async function createClientAddress(formData: FormData): Promise<{ error?: string; address?: ClientAddressRecord }> {
  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!isUuid(clientId)) {
    return { error: "Cliente inválido." };
  }

  const { supabase } = await getAuthenticatedUser();
  const label = String(formData.get("label") ?? "").trim() || "Direccion";
  const addressLine = String(formData.get("address_line") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const province = String(formData.get("province") ?? "").trim();
  const postalCode = String(formData.get("postal_code") ?? "").trim();
  const country = String(formData.get("country") ?? "ES").trim().slice(0, 2).toUpperCase() || "ES";
  const isDefaultDelivery = String(formData.get("is_default_delivery") ?? "") === "on";

  const { data: clientRow, error: clientError } = await supabase
    .from("clients")
    .select("organization_id")
    .eq("id", clientId)
    .is("deleted_at", null)
    .single();

  if (clientError || !clientRow) {
    return { error: clientError?.message ?? "No se encontró el cliente." };
  }

  const { data, error } = await supabase
    .from("client_addresses")
    .insert({
      organization_id: clientRow.organization_id,
      client_id: clientId,
      label,
      address_line: addressLine,
      city,
      province,
      postal_code: postalCode,
      country,
      is_default_delivery: isDefaultDelivery
    })
    .select("id, label, address_line, city, province, postal_code, country, is_default_delivery")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "No se pudo crear la dirección." };
  }

  revalidatePath("/dashboard");
  return {
    address: {
      id: String(data.id),
      label: String(data.label ?? label),
      addressLine: String(data.address_line ?? addressLine),
      city: String(data.city ?? city),
      province: String(data.province ?? province),
      postalCode: String(data.postal_code ?? postalCode),
      country: String(data.country ?? country),
      isDefaultDelivery: Boolean(data.is_default_delivery)
    }
  };
}

export async function updateClientAddress(formData: FormData): Promise<{ error?: string; address?: ClientAddressRecord }> {
  const addressId = String(formData.get("address_id") ?? "").trim();
  if (!isUuid(addressId)) {
    return { error: "Dirección inválida." };
  }

  const { supabase } = await getAuthenticatedUser();
  const label = String(formData.get("label") ?? "").trim() || "Direccion";
  const addressLine = String(formData.get("address_line") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const province = String(formData.get("province") ?? "").trim();
  const postalCode = String(formData.get("postal_code") ?? "").trim();
  const country = String(formData.get("country") ?? "ES").trim().slice(0, 2).toUpperCase() || "ES";
  const isDefaultDelivery = String(formData.get("is_default_delivery") ?? "") === "on";

  const { data, error } = await supabase
    .from("client_addresses")
    .update({
      label,
      address_line: addressLine,
      city,
      province,
      postal_code: postalCode,
      country,
      is_default_delivery: isDefaultDelivery
    })
    .eq("id", addressId)
    .is("deleted_at", null)
    .select("id, label, address_line, city, province, postal_code, country, is_default_delivery")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "No se pudo actualizar la dirección." };
  }

  revalidatePath("/dashboard");
  return {
    address: {
      id: String(data.id),
      label: String(data.label ?? label),
      addressLine: String(data.address_line ?? addressLine),
      city: String(data.city ?? city),
      province: String(data.province ?? province),
      postalCode: String(data.postal_code ?? postalCode),
      country: String(data.country ?? country),
      isDefaultDelivery: Boolean(data.is_default_delivery)
    }
  };
}

export async function deleteClientAddress(addressId: string): Promise<{ error?: string }> {
  if (!isUuid(addressId)) {
    return { error: "Dirección inválida." };
  }

  const { supabase } = await getAuthenticatedUser();
  const { error } = await supabase
    .from("client_addresses")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", addressId)
    .is("deleted_at", null);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  return {};
}

export async function createSupplier(formData: FormData): Promise<{ error?: string; supplier?: {
  id: string;
  contactEmail: string;
  contactPhone: string;
  code: string;
  name: string;
  taxId: string;
} }> {
  const organizationId = String(formData.get("organization_id") ?? "").trim();

  if (!isUuid(organizationId)) {
    return { error: "Organización inválida." };
  }

  const { supabase, user } = await getAuthenticatedUser();

  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    return { error: "El nombre es obligatorio." };
  }

  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      organization_id: organizationId,
      name,
      tax_id: String(formData.get("tax_id") ?? "").trim() || null,
      contact_email: String(formData.get("contact_email") ?? "").trim() || null,
      contact_phone: String(formData.get("contact_phone") ?? "").trim() || null,
      created_by: user.id
    })
    .select("id, name, tax_id, contact_email, contact_phone")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "No se pudo crear el proveedor." };
  }

  revalidatePath("/dashboard");
  return {
    supplier: {
      id: data.id as string,
      code: shortId(data.id as string),
      name: String(data.name ?? name),
      taxId: String(data.tax_id ?? ""),
      contactEmail: String(data.contact_email ?? ""),
      contactPhone: String(data.contact_phone ?? "")
    }
  };
}

export async function createEmployee(formData: FormData): Promise<{ error?: string; employee?: {
  id: string;
  code: string;
  contactEmail: string;
  contactPhone: string;
  department: string;
  name: string;
  role: string;
  taxId: string;
} }> {
  const organizationId = String(formData.get("organization_id") ?? "").trim();

  if (!isUuid(organizationId)) {
    return { error: "Organización inválida." };
  }

  const { supabase, user } = await getAuthenticatedUser();
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    return { error: "El nombre es obligatorio." };
  }

  const code = String(formData.get("code") ?? "").trim() || null;

  const { data, error } = await supabase
    .from("employees")
    .insert({
      organization_id: organizationId,
      code,
      name,
      tax_id: String(formData.get("tax_id") ?? "").trim() || null,
      contact_email: String(formData.get("contact_email") ?? "").trim() || null,
      contact_phone: String(formData.get("contact_phone") ?? "").trim() || null,
      role: String(formData.get("role") ?? "").trim() || null,
      department: String(formData.get("department") ?? "").trim() || null,
      created_by: user.id
    })
    .select("id, code, name, tax_id, contact_email, contact_phone, role, department")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "No se pudo crear el empleado." };
  }

  revalidatePath("/dashboard");
  return {
    employee: {
      id: data.id as string,
      code: String(data.code ?? shortId(data.id as string)),
      name: String(data.name ?? name),
      taxId: String(data.tax_id ?? ""),
      contactEmail: String(data.contact_email ?? ""),
      contactPhone: String(data.contact_phone ?? ""),
      role: String(data.role ?? ""),
      department: String(data.department ?? "")
    }
  };
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
  const unitMeasureRaw = String(formData.get("unit_measure") ?? "hour").trim();
  const validUnitMeasures = ["day", "hour", "month", "none", "percentage"] as const;
  const unitMeasure = validUnitMeasures.includes(unitMeasureRaw as typeof validUnitMeasures[number])
    ? unitMeasureRaw
    : "hour";

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
      unit_measure: unitMeasure,
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

export async function updateProductService(formData: FormData): Promise<{ error?: string }> {
  const organizationId = String(formData.get("organization_id") ?? "").trim();
  const productId = String(formData.get("product_id") ?? "").trim();

  if (!isUuid(organizationId) || !isUuid(productId)) {
    return { error: "Producto u organización inválidos." };
  }

  const { supabase } = await getAuthenticatedUser();
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    return { error: "El nombre es obligatorio." };
  }

  const kind = String(formData.get("kind") ?? "service").trim();
  const validKinds = ["product", "service"] as const;
  const productKind = validKinds.includes(kind as "product" | "service") ? (kind as "product" | "service") : "service";
  const unitMeasureRaw = String(formData.get("unit_measure") ?? "hour").trim();
  const validUnitMeasures = ["day", "hour", "month", "none", "percentage"] as const;
  const unitMeasure = validUnitMeasures.includes(unitMeasureRaw as typeof validUnitMeasures[number])
    ? unitMeasureRaw
    : "hour";
  const unitPriceRaw = Number(String(formData.get("unit_price") ?? "0").replace(",", "."));
  const unitPrice = Number.isFinite(unitPriceRaw) ? unitPriceRaw : 0;
  const taxRateRaw = String(formData.get("tax_rate") ?? "").trim();
  const taxRate = taxRateRaw ? Number(taxRateRaw.replace(",", ".")) : null;

  const { error } = await supabase
    .from("products_services")
    .update({
      code: String(formData.get("code") ?? "").trim() || null,
      name,
      kind: productKind,
      description: String(formData.get("description") ?? "").trim() || null,
      unit_measure: unitMeasure,
      unit_price: unitPrice,
      tax_rate: taxRate,
      is_active: String(formData.get("is_active") ?? "true") === "true",
      updated_at: new Date().toISOString()
    })
    .eq("id", productId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  return {};
}

export async function toggleProductServiceActive(
  organizationId: string,
  productId: string,
  isActive: boolean
): Promise<{ error?: string }> {
  if (!isUuid(organizationId) || !isUuid(productId)) {
    return { error: "Producto u organización inválidos." };
  }

  const { supabase } = await getAuthenticatedUser();
  const { error } = await supabase
    .from("products_services")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", productId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  return {};
}

export async function softDeleteProductService(
  organizationId: string,
  productId: string
): Promise<{ error?: string }> {
  if (!isUuid(organizationId) || !isUuid(productId)) {
    return { error: "Producto u organización inválidos." };
  }

  const { supabase } = await getAuthenticatedUser();
  const { error } = await supabase
    .from("products_services")
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", productId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  return {};
}

export async function duplicateProductService(
  organizationId: string,
  productId: string
): Promise<{
  error?: string;
  product?: {
    id: string;
    code: string | null;
    name: string;
    kind: "product" | "service";
    description: string | null;
    unit_measure: string | null;
    unit_price: number;
    tax_rate: number | null;
    is_active: boolean;
  };
}> {
  if (!isUuid(organizationId) || !isUuid(productId)) {
    return { error: "Producto u organización inválidos." };
  }

  const { supabase, user } = await getAuthenticatedUser();
  const { data: source, error: sourceError } = await supabase
    .from("products_services")
    .select("code, name, kind, description, unit_measure, unit_price, tax_rate, is_active")
    .eq("id", productId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .single();

  if (sourceError || !source) {
    return { error: sourceError?.message ?? "No se encontró el producto o servicio." };
  }

  let copyCode = source.code ? `${source.code}-COPIA` : null;

  if (copyCode) {
    for (let index = 2; index <= 99; index += 1) {
      const { data: existing } = await supabase
        .from("products_services")
        .select("id")
        .eq("organization_id", organizationId)
        .ilike("code", copyCode)
        .is("deleted_at", null)
        .maybeSingle();

      if (!existing) break;
      copyCode = `${source.code}-COPIA-${index}`;
    }
  }

  const { data, error } = await supabase
    .from("products_services")
    .insert({
      organization_id: organizationId,
      code: copyCode,
      name: `${source.name} copia`,
      kind: source.kind,
      description: source.description,
      unit_measure: source.unit_measure ?? "hour",
      unit_price: source.unit_price,
      tax_rate: source.tax_rate,
      is_active: source.is_active,
      created_by: user.id
    })
    .select("id, code, name, kind, description, unit_measure, unit_price, tax_rate, is_active")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "No se pudo duplicar el producto o servicio." };
  }

  revalidatePath("/dashboard");
  return { product: data as NonNullable<Awaited<ReturnType<typeof duplicateProductService>>["product"]> };
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

  const templateId = await resolveSalesTemplateId(supabase, organizationId, formData);

  const lines = applyDocumentFiscalRules(parseSalesInvoiceLines(formData), "quote");

  if (lines.length === 0) {
    return { error: "Añade al menos una línea de producto o servicio." };
  }

  const quoteDateRaw = String(formData.get("quote_date") ?? "").trim();
  const { subtotalAmount, taxAmount, retentionAmount } = calculateSalesLinesTotals(lines);
  const retentionRate = subtotalAmount > 0 ? roundMoney(retentionAmount * 100 / subtotalAmount) : 0;
  const suplidoAmount = 0;
  const totalAmount = roundMoney(subtotalAmount + taxAmount - retentionAmount + suplidoAmount);
  const created = await createSalesDocumentTransaction(supabase, {
    kind: "quote",
    organizationId,
    fiscalEntityId: fiscalEntity.id,
    clientId: clientResult.id,
    documentDate: quoteDateRaw || null,
    numberPrefix: String(formData.get("number_prefix") ?? "").trim() || null,
    reference: String(formData.get("reference") ?? "").trim() || null,
    status: "open",
    subtotalAmount,
    taxAmount,
    retentionRate,
    retentionAmount,
    suplidoAmount,
    pdfTemplate: String(formData.get("pdf_template") ?? "standard").trim() || "standard",
    templateId,
    totalAmount,
    notes: String(formData.get("notes") ?? "").trim() || null,
    createdBy: user.id,
    lines: lines.map((line, index) => buildSalesLineRow(organizationId, line, index))
  });

  if (created.error || !created.document) {
    return { error: created.error ?? "No se pudo crear el presupuesto." };
  }

  revalidatePath("/dashboard");
  return {
    quote: {
      id: created.document.id,
      number: created.document.number,
      total: totalAmount
    }
  };
}

export async function createSalesOrder(formData: FormData): Promise<{ error?: string; order?: { id: string; number: string; total: number } }> {
  const organizationId = String(formData.get("organization_id") ?? "").trim();

  if (!isUuid(organizationId)) {
    return { error: "Organización inválida." };
  }

  const { supabase, user } = await getAuthenticatedUser();
  const fiscalEntity = await resolveFiscalEntityId(organizationId, user.id);

  if (!fiscalEntity.id) {
    return { error: fiscalEntity.error ?? "No hay entidad fiscal activa para crear el pedido." };
  }

  const clientResult = await resolveSalesClientId(organizationId, formData);

  if (!clientResult.id) {
    return { error: clientResult.error ?? "Selecciona o introduce un cliente." };
  }

  const templateId = await resolveSalesTemplateId(supabase, organizationId, formData);

  const lines = applyDocumentFiscalRules(parseSalesInvoiceLines(formData), "order");

  if (lines.length === 0) {
    return { error: "Añade al menos una línea de producto o servicio." };
  }

  const orderDateRaw = String(formData.get("order_date") ?? "").trim();
  const { subtotalAmount, taxAmount, retentionAmount } = calculateSalesLinesTotals(lines);
  const retentionRate = subtotalAmount > 0 ? roundMoney(retentionAmount * 100 / subtotalAmount) : 0;
  const suplidoAmount = 0;
  const totalAmount = roundMoney(subtotalAmount + taxAmount - retentionAmount + suplidoAmount);
  const created = await createSalesDocumentTransaction(supabase, {
    kind: "order",
    organizationId,
    fiscalEntityId: fiscalEntity.id,
    clientId: clientResult.id,
    documentDate: orderDateRaw || null,
    numberPrefix: String(formData.get("number_prefix") ?? "").trim() || null,
    reference: String(formData.get("reference") ?? "").trim() || null,
    status: "open",
    subtotalAmount,
    taxAmount,
    retentionRate,
    retentionAmount,
    suplidoAmount,
    pdfTemplate: String(formData.get("pdf_template") ?? "standard").trim() || "standard",
    templateId,
    totalAmount,
    notes: String(formData.get("notes") ?? "").trim() || null,
    createdBy: user.id,
    lines: lines.map((line, index) => buildSalesLineRow(organizationId, line, index))
  });

  if (created.error || !created.document) {
    return { error: created.error ?? "No se pudo crear el pedido." };
  }

  revalidatePath("/dashboard");
  return {
    order: {
      id: created.document.id,
      number: created.document.number,
      total: totalAmount
    }
  };
}

type SalesInvoiceLineInput = {
  description?: string;
  discount?: number;
  product?: string;
  productId?: string;
  quantity?: number;
  taxRate?: number;
  retentionRate?: number;
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

  const templateId = await resolveSalesTemplateId(supabase, organizationId, formData);

  const lines = parseSalesInvoiceLines(formData);

  if (lines.length === 0) {
    return { error: "Añade al menos una línea de producto o servicio." };
  }

  const { subtotalAmount, taxAmount, retentionAmount } = calculateSalesLinesTotals(lines);
  const retentionRate = subtotalAmount > 0 ? roundMoney(retentionAmount * 100 / subtotalAmount) : 0;
  const suplidoAmount = Math.max(parseAmount(formData, "suplido_amount", 0), 0);
  const totalAmount = roundMoney(subtotalAmount + taxAmount - retentionAmount + suplidoAmount);
  const created = await createSalesDocumentTransaction(supabase, {
    kind: "invoice",
    organizationId,
    fiscalEntityId: fiscalEntity.id,
    clientId: clientResult.id,
    documentDate: String(formData.get("issue_date") ?? "").trim() || null,
    numberPrefix: String(formData.get("number_prefix") ?? "").trim() || null,
    reference: String(formData.get("reference") ?? "").trim() || null,
    status: "draft",
    subtotalAmount,
    taxAmount,
    retentionRate,
    retentionAmount,
    suplidoAmount,
    pdfTemplate: String(formData.get("pdf_template") ?? "standard").trim() || "standard",
    templateId,
    totalAmount,
    notes: String(formData.get("notes") ?? "").trim() || null,
    createdBy: user.id,
    lines: lines.map((line, index) => buildSalesLineRow(organizationId, line, index))
  });

  if (created.error || !created.document) {
    return { error: created.error ?? "No se pudo crear la factura." };
  }

  revalidatePath("/dashboard");
  return {
    invoice: {
      id: created.document.id,
      number: created.document.number,
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

function lineProductServiceId(line: SalesInvoiceLineInput): string | null {
  const productId = String(line.productId ?? "").trim();

  return isUuid(productId) ? productId : null;
}

function lineTaxRate(line: SalesInvoiceLineInput): number {
  return clampPercent(numberOrDefault(line.taxRate, 21));
}

function lineRetentionRate(line: SalesInvoiceLineInput): number {
  return clampPercent(numberOrDefault(line.retentionRate, 0));
}

// El IRPF se calcula por linea: pueden coexistir lineas con retencion y sin ella
// en la misma factura, asi que la retencion total es la suma por linea.
function calculateSalesLinesTotals(lines: SalesInvoiceLineInput[]): { subtotalAmount: number; taxAmount: number; retentionAmount: number } {
  return lines.reduce((totals, line) => {
    const quantity = numberOrDefault(line.quantity, 1);
    const unitPrice = numberOrDefault(line.unitPrice, 0);
    const discountRate = clampPercent(numberOrDefault(line.discount, 0));
    const gross = quantity * unitPrice;
    const lineTotal = roundMoney(gross - (gross * discountRate / 100));
    const lineTaxAmount = roundMoney(lineTotal * (lineTaxRate(line) / 100));
    const lineRetentionAmount = roundMoney(lineTotal * (lineRetentionRate(line) / 100));

    return {
      subtotalAmount: roundMoney(totals.subtotalAmount + lineTotal),
      taxAmount: roundMoney(totals.taxAmount + lineTaxAmount),
      retentionAmount: roundMoney(totals.retentionAmount + lineRetentionAmount)
    };
  }, { subtotalAmount: 0, taxAmount: 0, retentionAmount: 0 });
}

function buildSalesLineRow(organizationId: string, line: SalesInvoiceLineInput, index: number) {
  const quantity = numberOrDefault(line.quantity, 1);
  const unitPrice = numberOrDefault(line.unitPrice, 0);
  const discountRate = clampPercent(numberOrDefault(line.discount, 0));
  const gross = quantity * unitPrice;

  return {
    organization_id: organizationId,
    product_service_id: lineProductServiceId(line),
    line_index: index,
    description: line.description?.trim() || line.product?.trim() || "Servicio",
    quantity,
    unit_price: unitPrice,
    tax_rate: lineTaxRate(line),
    retention_rate: lineRetentionRate(line),
    discount_rate: discountRate,
    line_total: roundMoney(gross - (gross * discountRate / 100))
  };
}

// Reglas fiscales aplicadas en servidor (no fiables solo desde la UI):
// presupuesto sin IVA ni IRPF; IRPF/suplido solo en facturas (y recurrentes).
function documentFiscalFlags(kind: SalesDocumentKind): { iva: boolean; retention: boolean; suplido: boolean } {
  const retention = kind === "invoice" || kind === "recurring-invoice";
  return { iva: kind !== "quote", retention, suplido: retention };
}

function applyDocumentFiscalRules(lines: SalesInvoiceLineInput[], kind: SalesDocumentKind): SalesInvoiceLineInput[] {
  const flags = documentFiscalFlags(kind);
  if (flags.iva && flags.retention) return lines;
  return lines.map((line) => {
    const next: SalesInvoiceLineInput = { ...line };
    if (!flags.iva) next.taxRate = 0;
    if (!flags.retention) next.retentionRate = 0;
    return next;
  });
}

// Devuelve el id de plantilla solo si es un UUID valido, pertenece a la
// organizacion y esta creada para Ventas.
async function resolveSalesTemplateId(
  supabase: Awaited<ReturnType<typeof getAuthenticatedUser>>["supabase"],
  organizationId: string,
  formData: FormData
): Promise<string | null> {
  const id = String(formData.get("document_template_id") ?? "").trim();
  if (!isUuid(id)) return null;

  const { data } = await supabase
    .from("sales_document_templates")
    .select("id")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .eq("scope", "sales")
    .maybeSingle();

  return data ? id : null;
}

export type SalesDocumentKind = "invoice" | "quote" | "order" | "delivery-note" | "recurring-invoice";

type SalesDocumentRpcRow = {
  document_id?: unknown;
  document_number?: unknown;
  document_date?: unknown;
  client_name?: unknown;
  total_amount?: unknown;
  status?: unknown;
};

function salesDocumentRpcRow(data: unknown): SalesDocumentRpcRow | null {
  const row = Array.isArray(data) ? data[0] : data;
  return row && typeof row === "object" ? row as SalesDocumentRpcRow : null;
}

async function createSalesDocumentTransaction(
  supabase: Awaited<ReturnType<typeof getAuthenticatedUser>>["supabase"],
  input: {
    kind: SalesDocumentKind;
    organizationId: string;
    fiscalEntityId: string;
    clientId: string;
    documentDate: string | null;
    numberPrefix: string | null;
    reference: string | null;
    status: string;
    subtotalAmount: number;
    taxAmount: number;
    retentionRate: number;
    retentionAmount: number;
    suplidoAmount: number;
    pdfTemplate: string;
    templateId: string | null;
    totalAmount: number;
    notes: string | null;
    frequency?: string | null;
    createdBy: string;
    lines: Array<Record<string, unknown>>;
  }
): Promise<{
  error?: string;
  document?: { id: string; number: string; date: string; client: string; total: number; status: string };
}> {
  const { data, error } = await supabase.rpc("create_sales_document", {
    p_client_id: input.clientId,
    p_created_by: input.createdBy,
    p_currency: "EUR",
    p_document_date: input.documentDate,
    p_fiscal_entity_id: input.fiscalEntityId,
    p_frequency: input.frequency ?? null,
    p_kind: input.kind,
    p_lines: input.lines,
    p_notes: input.notes,
    p_number_prefix: input.numberPrefix,
    p_organization_id: input.organizationId,
    p_pdf_template: input.pdfTemplate,
    p_reference: input.reference,
    p_retention_amount: input.retentionAmount,
    p_retention_rate: input.retentionRate,
    p_sales_document_template_id: input.templateId,
    p_status: input.status,
    p_subtotal_amount: input.subtotalAmount,
    p_suplido_amount: input.suplidoAmount,
    p_tax_amount: input.taxAmount,
    p_total_amount: input.totalAmount
  });

  if (error) {
    return { error: error.message };
  }

  const row = salesDocumentRpcRow(data);
  const id = row?.document_id;

  if (typeof id !== "string") {
    return { error: "No se pudo confirmar la creación del documento." };
  }

  return {
    document: {
      id,
      number: String(row?.document_number ?? ""),
      date: String(row?.document_date ?? ""),
      client: String(row?.client_name ?? "—"),
      total: Number(row?.total_amount ?? input.totalAmount),
      status: String(row?.status ?? input.status)
    }
  };
}
export type SalesDocumentStatusDetail = {
  currentStatus: string;
  createdAt: string | null;
  createdByName: string;
  eventAt: string | null;
  notes: string;
  isPaid: boolean;
};

export type SalesQuoteLineDetail = {
  id: string;
  productOrService: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountRate: number;
  taxableBase: number;
  taxRate: number | null;
  retentionRate: number | null;
  status: string;
};

type SalesDocumentLineResult = {
  id: string;
  description: string | null;
  quantity: number | null;
  unit_price: number | null;
  discount_rate: number | null;
  line_total: number | null;
  tax_rate: number | null;
  retention_rate?: number | null;
  products_services?: { code?: string | null; name?: string | null } | null;
};

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

function salesDocumentTable(kind: SalesDocumentKind): "sales_invoices" | "sales_quotes" | "sales_orders" | "sales_delivery_notes" | "sales_recurring_invoices" {
  if (kind === "quote") return "sales_quotes";
  if (kind === "order") return "sales_orders";
  if (kind === "delivery-note") return "sales_delivery_notes";
  if (kind === "recurring-invoice") return "sales_recurring_invoices";
  return "sales_invoices";
}

function salesDocumentLineConfig(kind: SalesDocumentKind): {
  table: "sales_invoice_lines" | "sales_quote_lines" | "sales_order_lines" | "sales_delivery_note_lines" | "sales_recurring_invoice_lines";
  documentColumn: "sales_invoice_id" | "sales_quote_id" | "sales_order_id" | "sales_delivery_note_id" | "sales_recurring_invoice_id";
  hasProductService: boolean;
} {
  if (kind === "quote") {
    return { table: "sales_quote_lines", documentColumn: "sales_quote_id", hasProductService: true };
  }

  if (kind === "order") {
    return { table: "sales_order_lines", documentColumn: "sales_order_id", hasProductService: true };
  }

  if (kind === "delivery-note") {
    return { table: "sales_delivery_note_lines", documentColumn: "sales_delivery_note_id", hasProductService: false };
  }

  if (kind === "recurring-invoice") {
    return { table: "sales_recurring_invoice_lines", documentColumn: "sales_recurring_invoice_id", hasProductService: false };
  }

  return { table: "sales_invoice_lines", documentColumn: "sales_invoice_id", hasProductService: true };
}

export async function updateSalesDocumentStatus(
  kind: SalesDocumentKind,
  documentId: string,
  status: string,
  options?: { notes?: string; isPaid?: boolean }
): Promise<{ error?: string; detail?: SalesDocumentStatusDetail }> {
  if (!isUuid(documentId)) {
    return { error: "Documento inválido." };
  }

  if (!SALES_DOCUMENT_STATUSES.has(status)) {
    return { error: "Estado inválido." };
  }

  const { supabase } = await getAuthenticatedUser();
  const table = salesDocumentTable(kind);
  const documentResult = await supabase
    .from(table)
    .select("organization_id, status, created_at, created_by")
    .eq("id", documentId)
    .maybeSingle();

  if (documentResult.error || !documentResult.data) {
    return { error: documentResult.error?.message ?? "Documento no encontrado." };
  }

  const { error } = await supabase
    .from(table)
    .update({ status })
    .eq("id", documentId);

  if (error) {
    return { error: error.message };
  }

  const eventInsert = await supabase
    .from("sales_document_status_events")
    .insert({
      organization_id: documentResult.data.organization_id,
      document_kind: kind,
      document_id: documentId,
      status,
      notes: options?.notes?.trim() || null,
      metadata: {
        is_paid: Boolean(options?.isPaid)
      }
    })
    .select("created_at, notes, metadata")
    .single();

  if (eventInsert.error || !eventInsert.data) {
    return { error: eventInsert.error?.message ?? "No se pudo registrar el historial del estado." };
  }

  const profileResult = documentResult.data.created_by
    ? await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", documentResult.data.created_by)
      .maybeSingle()
    : { data: null, error: null };

  revalidatePath("/dashboard");
  return {
    detail: {
      createdAt: documentResult.data.created_at ?? null,
      createdByName: profileResult.data?.display_name?.trim() || "Usuario de la organizacion",
      currentStatus: status,
      eventAt: eventInsert.data.created_at ?? null,
      isPaid: Boolean((eventInsert.data.metadata as { is_paid?: boolean } | null)?.is_paid),
      notes: String(eventInsert.data.notes ?? "")
    }
  };
}

export async function getSalesDocumentStatusDetail(
  kind: SalesDocumentKind,
  documentId: string
): Promise<{ error?: string; detail?: SalesDocumentStatusDetail }> {
  if (!isUuid(documentId)) {
    return { error: "Documento inválido." };
  }

  const { supabase } = await getAuthenticatedUser();
  const table = salesDocumentTable(kind);
  const documentResult = await supabase
    .from(table)
    .select("organization_id, status, created_at, created_by")
    .eq("id", documentId)
    .maybeSingle();

  if (documentResult.error || !documentResult.data) {
    return { error: documentResult.error?.message ?? "Documento no encontrado." };
  }

  const [profileResult, eventResult] = await Promise.all([
    documentResult.data.created_by
      ? supabase
        .from("profiles")
        .select("display_name")
        .eq("id", documentResult.data.created_by)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("sales_document_status_events")
      .select("status, notes, metadata, created_at")
      .eq("document_kind", kind)
      .eq("document_id", documentId)
      .eq("status", documentResult.data.status)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  return {
    detail: {
      createdAt: documentResult.data.created_at ?? null,
      createdByName: profileResult.data?.display_name?.trim() || "Usuario de la organizacion",
      currentStatus: String(documentResult.data.status),
      eventAt: eventResult.data?.created_at ?? null,
      isPaid: Boolean((eventResult.data?.metadata as { is_paid?: boolean } | null)?.is_paid),
      notes: String(eventResult.data?.notes ?? "")
    }
  };
}

export async function getSalesDocumentNotes(kind: SalesDocumentKind, documentId: string): Promise<{ error?: string; notes?: string }> {
  if (!isUuid(documentId)) {
    return { error: "Documento inválido." };
  }

  const { supabase } = await getAuthenticatedUser();
  const { data, error } = await supabase
    .from(salesDocumentTable(kind))
    .select("notes")
    .eq("id", documentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) {
    return { error: error?.message ?? "Documento no encontrado." };
  }

  return { notes: String(data.notes ?? "") };
}

export async function updateSalesDocumentNotes(kind: SalesDocumentKind, documentId: string, notes: string): Promise<{ error?: string }> {
  if (!isUuid(documentId)) {
    return { error: "Documento inválido." };
  }

  const { supabase } = await getAuthenticatedUser();
  const { error } = await supabase
    .from(salesDocumentTable(kind))
    .update({ notes: notes.trim() || null })
    .eq("id", documentId)
    .is("deleted_at", null);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  return {};
}

export async function getSalesDocumentLineDetails(
  kind: SalesDocumentKind,
  documentId: string
): Promise<{ error?: string; lines?: SalesQuoteLineDetail[] }> {
  if (!isUuid(documentId)) {
    return { error: "Documento inválido." };
  }

  const { supabase } = await getAuthenticatedUser();
  const lineConfig = salesDocumentLineConfig(kind);
  const selectColumns = lineConfig.hasProductService
    ? "id, description, quantity, unit_price, discount_rate, line_total, tax_rate, retention_rate, products_services!product_service_id(code, name)"
    : "id, description, quantity, unit_price, discount_rate, line_total, tax_rate, retention_rate";
  const { data, error } = await supabase
    .from(lineConfig.table)
    .select(selectColumns as "id, description, quantity, unit_price, discount_rate, line_total, tax_rate")
    .eq(lineConfig.documentColumn, documentId)
    .order("line_index", { ascending: true });

  if (error) {
    return { error: error.message };
  }

  return {
    lines: ((data ?? []) as unknown as SalesDocumentLineResult[]).map((line) => {
      const product = line.products_services ?? null;
      const productLabel = product?.name
        ? [product.code, product.name].filter(Boolean).join(" - ")
        : String(line.description ?? "Servicio").split("\n")[0] || "Servicio";

      return {
        id: String(line.id),
        productOrService: productLabel,
        description: String(line.description ?? ""),
        quantity: Number(line.quantity ?? 0),
        unitPrice: Number(line.unit_price ?? 0),
        discountRate: Number(line.discount_rate ?? 0),
        taxableBase: Number(line.line_total ?? 0),
        taxRate: line.tax_rate === null ? null : Number(line.tax_rate),
        retentionRate: line.retention_rate === null || line.retention_rate === undefined ? null : Number(line.retention_rate),
        status: "Completa"
      };
    })
  };
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
  const { data, error } = await supabase.rpc("duplicate_sales_document", {
    p_created_by: user.id,
    p_document_id: documentId,
    p_kind: kind
  });

  if (error) {
    return { error: error.message };
  }

  const row = salesDocumentRpcRow(data);
  const id = row?.document_id;

  if (typeof id !== "string") {
    return { error: "No se pudo confirmar el duplicado." };
  }

  revalidatePath("/dashboard");
  return {
    document: {
      id,
      number: String(row?.document_number ?? ""),
      date: String(row?.document_date ?? ""),
      client: String(row?.client_name ?? "—"),
      total: Number(row?.total_amount ?? 0),
      status: String(row?.status ?? "draft")
    }
  };
}

export async function createSalesDeliveryNote(formData: FormData): Promise<{ error?: string; note?: { id: string; number: string; total: number } }> {
  const organizationId = String(formData.get("organization_id") ?? "").trim();

  if (!isUuid(organizationId)) {
    return { error: "Organización inválida." };
  }

  const { supabase, user } = await getAuthenticatedUser();
  const fiscalEntity = await resolveFiscalEntityId(organizationId, user.id);

  if (!fiscalEntity.id) {
    return { error: fiscalEntity.error ?? "No hay entidad fiscal activa para crear el albarán." };
  }

  const clientResult = await resolveSalesClientId(organizationId, formData);

  if (!clientResult.id) {
    return { error: clientResult.error ?? "Selecciona o introduce un cliente." };
  }

  const templateId = await resolveSalesTemplateId(supabase, organizationId, formData);

  const lines = applyDocumentFiscalRules(parseSalesInvoiceLines(formData), "delivery-note");

  if (lines.length === 0) {
    return { error: "Añade al menos una línea de producto o servicio." };
  }

  const noteDateRaw = String(formData.get("note_date") ?? "").trim();
  const { subtotalAmount, taxAmount, retentionAmount } = calculateSalesLinesTotals(lines);
  const retentionRate = subtotalAmount > 0 ? roundMoney(retentionAmount * 100 / subtotalAmount) : 0;
  const suplidoAmount = 0;
  const totalAmount = roundMoney(subtotalAmount + taxAmount - retentionAmount + suplidoAmount);
  const created = await createSalesDocumentTransaction(supabase, {
    kind: "delivery-note",
    organizationId,
    fiscalEntityId: fiscalEntity.id,
    clientId: clientResult.id,
    documentDate: noteDateRaw || null,
    numberPrefix: String(formData.get("number_prefix") ?? "").trim() || null,
    reference: String(formData.get("reference") ?? "").trim() || null,
    status: "open",
    subtotalAmount,
    taxAmount,
    retentionRate,
    retentionAmount,
    suplidoAmount,
    pdfTemplate: String(formData.get("pdf_template") ?? "standard").trim() || "standard",
    templateId,
    totalAmount,
    notes: String(formData.get("notes") ?? "").trim() || null,
    createdBy: user.id,
    lines: lines.map((line, index) => buildSalesLineRow(organizationId, line, index))
  });

  if (created.error || !created.document) {
    return { error: created.error ?? "No se pudo crear el albarán." };
  }

  revalidatePath("/dashboard");
  return {
    note: {
      id: created.document.id,
      number: created.document.number,
      total: totalAmount
    }
  };
}

export async function createSalesRecurringInvoice(formData: FormData): Promise<{ error?: string; recurring?: { id: string; number: string; total: number } }> {
  const organizationId = String(formData.get("organization_id") ?? "").trim();

  if (!isUuid(organizationId)) {
    return { error: "Organización inválida." };
  }

  const { supabase, user } = await getAuthenticatedUser();
  const fiscalEntity = await resolveFiscalEntityId(organizationId, user.id);

  if (!fiscalEntity.id) {
    return { error: fiscalEntity.error ?? "No hay entidad fiscal activa para crear la factura recurrente." };
  }

  const clientResult = await resolveSalesClientId(organizationId, formData);

  if (!clientResult.id) {
    return { error: clientResult.error ?? "Selecciona o introduce un cliente." };
  }

  const templateId = await resolveSalesTemplateId(supabase, organizationId, formData);

  const lines = parseSalesInvoiceLines(formData);

  if (lines.length === 0) {
    return { error: "Añade al menos una línea de producto o servicio." };
  }

  const nextIssueDateRaw = String(formData.get("next_issue_date") ?? "").trim();
  const frequency = String(formData.get("frequency") ?? "monthly").trim();
  const { subtotalAmount, taxAmount, retentionAmount } = calculateSalesLinesTotals(lines);
  const retentionRate = subtotalAmount > 0 ? roundMoney(retentionAmount * 100 / subtotalAmount) : 0;
  const suplidoAmount = Math.max(parseAmount(formData, "suplido_amount", 0), 0);
  const totalAmount = roundMoney(subtotalAmount + taxAmount - retentionAmount + suplidoAmount);
  const created = await createSalesDocumentTransaction(supabase, {
    kind: "recurring-invoice",
    organizationId,
    fiscalEntityId: fiscalEntity.id,
    clientId: clientResult.id,
    documentDate: nextIssueDateRaw || null,
    numberPrefix: String(formData.get("number_prefix") ?? "").trim() || null,
    reference: String(formData.get("reference") ?? "").trim() || null,
    status: "open",
    subtotalAmount,
    taxAmount,
    retentionRate,
    retentionAmount,
    suplidoAmount,
    pdfTemplate: String(formData.get("pdf_template") ?? "standard").trim() || "standard",
    templateId,
    totalAmount,
    notes: String(formData.get("notes") ?? "").trim() || null,
    frequency,
    createdBy: user.id,
    lines: lines.map((line, index) => buildSalesLineRow(organizationId, line, index))
  });

  if (created.error || !created.document) {
    return { error: created.error ?? "No se pudo crear la plantilla recurrente." };
  }

  revalidatePath("/dashboard");
  return {
    recurring: {
      id: created.document.id,
      number: created.document.number,
      total: totalAmount
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

export async function createPriceList(formData: FormData): Promise<{ error?: string; priceList?: { id: string } }> {
  const organizationId = String(formData.get("organization_id") ?? "").trim();

  if (!isUuid(organizationId)) {
    return { error: "Organización inválida." };
  }

  const code = String(formData.get("code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();

  if (!code) return { error: "El código es obligatorio." };
  if (!name) return { error: "El nombre es obligatorio." };

  const adjustmentTypeLabel = String(formData.get("adjustment_type") ?? "").trim();
  const adjustmentTypeMap: Record<string, string> = {
    "Precio fijo": "fixed_price",
    "Descuento porcentual": "percentage_discount",
    "Precio por tramo": "tiered"
  };
  const adjustmentType = adjustmentTypeMap[adjustmentTypeLabel] ?? "fixed_price";

  const startDateRaw = String(formData.get("start_date") ?? "").trim();
  const endDateRaw = String(formData.get("end_date") ?? "").trim();
  const startDate = parseSpanishDateToISO(startDateRaw);
  const endDate = parseSpanishDateToISO(endDateRaw);
  const isActive = formData.get("is_active") === "true";

  const { supabase, user } = await getAuthenticatedUser();

  const { data, error: insertError } = await supabase
    .from("price_lists")
    .insert({
      organization_id: organizationId,
      code,
      name,
      adjustment_type: adjustmentType,
      start_date: startDate,
      end_date: endDate,
      is_active: isActive,
      created_by: user.id
    })
    .select("id")
    .single();

  if (insertError || !data) {
    return { error: insertError?.message ?? "No se pudo crear la tarifa." };
  }

  revalidatePath("/dashboard");
  return { priceList: { id: data.id as string } };
}

export async function createDiscountGroup(formData: FormData): Promise<{ error?: string; discountGroup?: { id: string } }> {
  const organizationId = String(formData.get("organization_id") ?? "").trim();

  if (!isUuid(organizationId)) {
    return { error: "Organización inválida." };
  }

  const code = String(formData.get("code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();

  if (!code) return { error: "El código es obligatorio." };
  if (!name) return { error: "El nombre o descripción es obligatorio." };

  const startDateRaw = String(formData.get("start_date") ?? "").trim();
  const endDateRaw = String(formData.get("end_date") ?? "").trim();
  const startDate = parseSpanishDateToISO(startDateRaw);
  const endDate = parseSpanishDateToISO(endDateRaw);
  const isActive = formData.get("is_active") === "true";

  const { supabase, user } = await getAuthenticatedUser();

  const { data, error: insertError } = await supabase
    .from("discount_groups")
    .insert({
      organization_id: organizationId,
      code,
      name,
      start_date: startDate,
      end_date: endDate,
      is_active: isActive,
      created_by: user.id
    })
    .select("id")
    .single();

  if (insertError || !data) {
    return { error: insertError?.message ?? "No se pudo crear el grupo de descuentos." };
  }

  revalidatePath("/dashboard");
  return { discountGroup: { id: data.id as string } };
}

function parseSpanishDateToISO(value: string): string | null {
  if (!value.trim()) return null;
  const parts = value.trim().split("/");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  if (!day || !month || !year) return null;
  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

// --- Plantillas de documentos de venta (con nombre, seleccionables en Ventas) ---

export type SalesDocumentTemplate = {
  id: string;
  name: string;
  format: "pdf" | "template";
  scope: "sales" | "quotes";
  config: Record<string, unknown>;
  isDefault: boolean;
};

function mapTemplateRow(row: {
  id: unknown;
  name: unknown;
  format: unknown;
  scope: unknown;
  config: unknown;
  is_default: unknown;
}): SalesDocumentTemplate {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    format: row.format === "template" ? "template" : "pdf",
    scope: row.scope === "quotes" ? "quotes" : "sales",
    config: (row.config && typeof row.config === "object" ? row.config : {}) as Record<string, unknown>,
    isDefault: Boolean(row.is_default)
  };
}

export async function listSalesTemplates(organizationId: string): Promise<{ error?: string; templates: SalesDocumentTemplate[] }> {
  if (!isUuid(organizationId)) return { templates: [] };

  const { supabase } = await getAuthenticatedUser();
  const { data, error } = await supabase
    .from("sales_document_templates")
    .select("id, name, format, scope, config, is_default")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  if (error) return { error: error.message, templates: [] };

  return { templates: (data ?? []).map(mapTemplateRow) };
}

export async function saveSalesTemplate(input: {
  organizationId: string;
  id?: string;
  name: string;
  format: "pdf" | "template";
  scope?: "sales" | "quotes";
  config: Record<string, unknown>;
  isDefault?: boolean;
}): Promise<{ error?: string; template?: SalesDocumentTemplate }> {
  if (!isUuid(input.organizationId)) return { error: "Organización inválida." };

  const name = input.name.trim();
  if (!name) return { error: "El nombre de la plantilla es obligatorio." };

  const { supabase, user } = await getAuthenticatedUser();
  const scope = input.scope === "quotes" ? "quotes" : "sales";
  const format = input.format === "template" ? "template" : "pdf";

  // Solo una plantilla por defecto por ambito.
  if (input.isDefault) {
    await supabase
      .from("sales_document_templates")
      .update({ is_default: false })
      .eq("organization_id", input.organizationId)
      .eq("scope", scope);
  }

  const row = {
    organization_id: input.organizationId,
    name,
    format,
    scope,
    config: input.config,
    is_default: Boolean(input.isDefault)
  };

  const result = input.id && isUuid(input.id)
    ? await supabase
        .from("sales_document_templates")
        .update(row)
        .eq("id", input.id)
        .eq("organization_id", input.organizationId)
        .select("id, name, format, scope, config, is_default")
        .single()
    : await supabase
        .from("sales_document_templates")
        .insert({ ...row, created_by: user.id })
        .select("id, name, format, scope, config, is_default")
        .single();

  if (result.error || !result.data) {
    return { error: result.error?.message ?? "No se pudo guardar la plantilla." };
  }

  revalidatePath("/dashboard");
  return { template: mapTemplateRow(result.data) };
}

export async function deleteSalesTemplate(organizationId: string, id: string): Promise<{ error?: string }> {
  if (!isUuid(organizationId) || !isUuid(id)) return { error: "Datos inválidos." };

  const { supabase } = await getAuthenticatedUser();
  const { error } = await supabase
    .from("sales_document_templates")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return {};
}
