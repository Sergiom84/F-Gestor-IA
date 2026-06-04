"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";

type OnboardingResultRow = {
  organization_id: string;
  client_id: string;
  fiscal_entity_id: string;
};

const CLIENT_TYPES = new Set(["individual", "company"]);
const FISCAL_ENTITY_TYPES = new Set(["self_employed", "company", "other"]);

export async function createOnboardingWorkspace(formData: FormData) {
  const organizationName = requiredText(formData, "organization_name", 2);
  const clientName = requiredText(formData, "client_name", 2);
  const fiscalEntityLegalName = requiredText(formData, "fiscal_entity_legal_name", 2);
  const fiscalEntityTaxId = optionalText(formData, "fiscal_entity_tax_id");
  const clientType = enumValue(formData, "client_type", CLIENT_TYPES, "company");
  const fiscalEntityType = enumValue(formData, "fiscal_entity_type", FISCAL_ENTITY_TYPES, "company");

  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .rpc("create_onboarding_workspace", {
      p_organization_name: organizationName,
      p_client_name: clientName,
      p_fiscal_entity_legal_name: fiscalEntityLegalName,
      p_fiscal_entity_tax_id: fiscalEntityTaxId,
      p_client_type: clientType,
      p_fiscal_entity_type: fiscalEntityType
    });

  const rows = Array.isArray(data) ? data as OnboardingResultRow[] : [];
  const row = rows[0];

  if (error || !row) {
    const message = encodeURIComponent(error?.message.slice(0, 160) ?? "No se pudo completar el onboarding");
    redirect(`/onboarding?error=${message}`);
  }

  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  redirect(`/dashboard?org=${row.organization_id}&onboarded=1`);
}

function requiredText(formData: FormData, key: string, minLength: number): string {
  const value = optionalText(formData, key);

  if (!value || value.length < minLength) {
    redirect(`/onboarding?error=${encodeURIComponent(`Completa ${key} con al menos ${minLength} caracteres`)}`);
  }

  return value;
}

function optionalText(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value ? value : null;
}

function enumValue(formData: FormData, key: string, allowed: Set<string>, fallback: string): string {
  const value = String(formData.get(key) ?? fallback).trim();
  return allowed.has(value) ? value : fallback;
}
