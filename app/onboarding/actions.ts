"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";

type OnboardingResultRow = {
  organization_id: string;
};

export async function createOnboardingWorkspace(formData: FormData) {
  const organizationName = requiredText(formData, "organization_name", 2);

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
      p_organization_name: organizationName
    });

  const rows = Array.isArray(data) ? data as OnboardingResultRow[] : [];
  const row = rows[0];

  if (error || !row) {
    const message = encodeURIComponent(error?.message.slice(0, 160) ?? "No se pudo completar el alta");
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
