import type { AppModule, DashboardTab } from "./types";

export function formatDashboardError(error: string): string {
  const messages: Record<string, string> = {
    missing_file: "Selecciona un PDF antes de subir.",
    unsupported_file: "Solo se admiten PDFs en esta primera superficie.",
    upload_scope: "La entidad fiscal no pertenece a la organizacion activa o no tienes permiso.",
    document_create: "No se pudo crear el documento.",
    storage_upload: "No se pudo subir el PDF a Storage.",
    file_register: "El archivo se subio, pero no pudo registrarse en la base.",
    review_not_found: "No se encontro la tarea de revision."
  };

  return messages[error] ?? "La operacion no se pudo completar.";
}

export function formatLabel(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-ES", {
    currency: "EUR",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat("es-ES", {
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    style: "currency"
  }).format(value);
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

export function resolveDashboardTab(value: string | undefined): DashboardTab {
  if (value === "sales" || value === "news") {
    return value;
  }

  return "accounting";
}

export function resolveAppModule(value: string | undefined): AppModule {
  const modules = new Set<AppModule>([
    "dashboard",
    "sales",
    "purchases",
    "contacts",
    "products",
    "banks",
    "accounting",
    "tax",
    "reports"
  ]);

  return value && modules.has(value as AppModule) ? value as AppModule : "dashboard";
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getDisplayName(email: string | undefined): string {
  if (!email) {
    return "USUARIO";
  }

  return (email.split("@").at(0) ?? "USUARIO").replace(/[._-]+/g, " ").toUpperCase();
}
