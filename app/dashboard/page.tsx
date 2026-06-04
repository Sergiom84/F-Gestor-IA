import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  BadgeEuro,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ExternalLink,
  FileSearch,
  FileText,
  Landmark,
  LayoutDashboard,
  LogOut,
  MoreVertical,
  PackageSearch,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  UploadCloud,
  Users
} from "lucide-react";
import { signOut } from "../login/actions";
import { uploadDocument } from "./actions";
import { createClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";

type DashboardPageProps = {
  searchParams?: Promise<{
    org?: string;
    module?: string;
    tab?: string;
    uploaded?: string;
    onboarded?: string;
    error?: string;
  }>;
};

type OrganizationMember = {
  organization_id: string;
  role: string;
};

type Organization = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  ai_monthly_budget_cents: number;
};

type DocumentRow = {
  id: string;
  title: string | null;
  document_type: string;
  status: string;
  source: string;
  created_at: string;
  failure_reason: string | null;
};

type ReviewTaskRow = {
  id: string;
  status: string;
  reason: string;
  priority: number;
  document_id: string;
  created_at: string;
};

type FiscalEntityRow = {
  id: string;
  legal_name: string;
  tax_id: string | null;
};

type DashboardTab = "accounting" | "sales" | "news";

type AppModule =
  | "dashboard"
  | "sales"
  | "purchases"
  | "contacts"
  | "products"
  | "banks"
  | "accounting"
  | "tax"
  | "reports";

type SalesInvoiceRow = {
  id: string;
  status: string;
  invoiceDate: string;
  invoiceNumber: string;
  customer: string;
  customerCode: string;
  total: number;
};

const salesInvoiceSeedRows: SalesInvoiceRow[] = [
  {
    id: "0013",
    status: "Vencida",
    invoiceDate: "30/05/2026",
    invoiceNumber: "0013",
    customer: "INTERVENCIONES ORIENTADAS SL",
    customerCode: "47",
    total: 18856.11
  },
  {
    id: "0012",
    status: "Vencida",
    invoiceDate: "25/05/2026",
    invoiceNumber: "0012",
    customer: "SANSANO OIL SERVICE SL",
    customerCode: "24",
    total: 1294.70
  },
  {
    id: "0011",
    status: "Vencida",
    invoiceDate: "25/05/2026",
    invoiceNumber: "0011",
    customer: "FENIX DISTRIBUCIONES SL",
    customerCode: "26",
    total: -1452
  }
];

const navigationItems = [
  { label: "Cuadros de mando", icon: LayoutDashboard, module: "dashboard" },
  { label: "Ventas", icon: BarChart3, module: "sales" },
  { label: "Compras", icon: ShoppingCart, module: "purchases" },
  { label: "Contactos", icon: Users, module: "contacts" },
  { label: "Productos y servicios", icon: PackageSearch, module: "products" },
  { label: "Bancos", icon: Landmark, module: "banks" },
  { label: "Contabilidad", icon: SlidersHorizontal, module: "accounting" },
  { label: "Declaraciones", icon: BadgeEuro, module: "tax" },
  { label: "Informes", icon: FileText, module: "reports" }
] satisfies Array<{ label: string; icon: typeof LayoutDashboard; module: AppModule }>;

const moduleCatalog: Record<AppModule, {
  title: string;
  eyebrow: string;
  description: string;
  quickActions: string[];
  stats: Array<{ label: string; value: string; description: string }>;
  tableTitle: string;
  tableDescription: string;
  tableHeaders: string[];
  emptyTitle: string;
  emptyDescription: string;
}> = {
  dashboard: {
    title: "Cuadros de mando",
    eyebrow: "Inicio",
    description: "Indicadores, importes pendientes, actividad documental y accesos rapidos.",
    quickActions: ["Ver contabilidad", "Ver ventas y compras", "Revisar novedades"],
    stats: [],
    tableTitle: "Actividad reciente",
    tableDescription: "Resumen de los ultimos movimientos.",
    tableHeaders: ["Elemento", "Estado", "Fecha", "Acciones"],
    emptyTitle: "Sin actividad",
    emptyDescription: "Todavia no hay movimientos para mostrar."
  },
  sales: {
    title: "Ventas",
    eyebrow: "Active_Sales",
    description: "Facturas de venta, presupuestos, cobros, clientes y recordatorios.",
    quickActions: ["Crear facturas de venta", "Crear clientes", "Preparar recordatorios", "Ver todas las facturas"],
    stats: [
      { label: "Facturas de venta", value: "0", description: "Documentos de venta listos para emitir o consultar." },
      { label: "Presupuestos", value: "0", description: "Ofertas pendientes de aprobacion o conversion." },
      { label: "Cobros", value: "0,00 €", description: "Pagos registrados contra vencimientos abiertos." }
    ],
    tableTitle: "Facturas de venta",
    tableDescription: "Lista operativa para consultar, emitir y hacer seguimiento de facturas.",
    tableHeaders: ["Estado", "Fecha", "Numero", "Cliente", "Total", "Acciones"],
    emptyTitle: "No hay facturas de venta.",
    emptyDescription: "Crea una factura o importa ventas para empezar a controlar cobros."
  },
  purchases: {
    title: "Compras",
    eyebrow: "Active_Purchase",
    description: "Facturas de compra, proveedores, gastos, pagos y documentos simplificados.",
    quickActions: ["Subir facturas de compra", "Crear proveedores", "Importar compras o ventas", "Introducir gastos"],
    stats: [
      { label: "Facturas de compra", value: "0", description: "Documentos de proveedor registrados." },
      { label: "OCR pendiente", value: "0", description: "Compras esperando captura o validacion." },
      { label: "Pagos", value: "0,00 €", description: "Pagos pendientes o conciliados con proveedores." }
    ],
    tableTitle: "Facturas de compra",
    tableDescription: "Bandeja para revisar compras, asociarlas a proveedor y contabilizarlas.",
    tableHeaders: ["Estado", "Fecha", "Proveedor", "Referencia", "Total", "Acciones"],
    emptyTitle: "No hay facturas de compra.",
    emptyDescription: "Sube documentos de compra para alimentar la bandeja."
  },
  contacts: {
    title: "Contactos",
    eyebrow: "Active_ThirdParty",
    description: "Clientes, proveedores y terceros usados por ventas, compras y contabilidad.",
    quickActions: ["Crear clientes", "Crear proveedores", "Importar clientes o proveedores", "Consultar por tercero"],
    stats: [
      { label: "Clientes", value: "0", description: "Contactos que reciben facturas de venta." },
      { label: "Proveedores", value: "0", description: "Contactos asociados a compras y pagos." },
      { label: "Terceros", value: "0", description: "Registros disponibles para analitica contable." }
    ],
    tableTitle: "Directorio de contactos",
    tableDescription: "Vista base para clientes, proveedores y terceros.",
    tableHeaders: ["Tipo", "Nombre", "NIF", "Email", "Estado", "Acciones"],
    emptyTitle: "No hay contactos creados.",
    emptyDescription: "Crea clientes y proveedores habituales para acelerar facturas e informes."
  },
  products: {
    title: "Productos y servicios",
    eyebrow: "Active_Product",
    description: "Catalogo de articulos, servicios, tarifas, precios y grupos de descuentos.",
    quickActions: ["Crear producto o servicio", "Importar productos y servicios", "Editar tarifas", "Configurar descuentos"],
    stats: [
      { label: "Productos", value: "0", description: "Articulos disponibles para documentos comerciales." },
      { label: "Servicios", value: "0", description: "Servicios facturables recurrentes o puntuales." },
      { label: "Tarifas", value: "0", description: "Listas de precios y descuentos configuradas." }
    ],
    tableTitle: "Catalogo",
    tableDescription: "Productos y servicios que se pueden usar en ventas y compras.",
    tableHeaders: ["Codigo", "Nombre", "Tipo", "Precio", "IVA", "Acciones"],
    emptyTitle: "El catalogo esta vacio.",
    emptyDescription: "Crea productos o servicios para acelerar la emision de facturas."
  },
  banks: {
    title: "Bancos",
    eyebrow: "Active_Bank",
    description: "Cuentas bancarias, efectivo, extractos, conciliacion y movimientos.",
    quickActions: ["Crear cuenta bancaria", "Importar extracto bancario", "Procesar transacciones bancarias", "Conciliar pagos"],
    stats: [
      { label: "Cuentas", value: "0", description: "Cuentas bancarias o efectivo configuradas." },
      { label: "Movimientos", value: "0", description: "Transacciones pendientes de procesar." },
      { label: "Sin conciliar", value: "0", description: "Asientos bancarios no conciliados." }
    ],
    tableTitle: "Movimientos bancarios",
    tableDescription: "Transacciones para importar, clasificar y conciliar.",
    tableHeaders: ["Fecha", "Cuenta", "Descripcion", "Importe", "Estado", "Acciones"],
    emptyTitle: "No hay movimientos bancarios.",
    emptyDescription: "Conecta una cuenta o importa un extracto para empezar."
  },
  accounting: {
    title: "Contabilidad",
    eyebrow: "Active_Accounting",
    description: "Asientos, libro mayor, marcaje, cuentas contables, cierres y FEC.",
    quickActions: ["Crear asientos", "Consultar libro mayor", "Marcar apuntes", "Crear o editar cuenta contable"],
    stats: [
      { label: "Asientos", value: "0", description: "Apuntes generados o registrados manualmente." },
      { label: "Por marcar", value: "0", description: "Movimientos pendientes de conciliacion o marcaje." },
      { label: "Cierre mensual", value: "Abierto", description: "Estado de cierre del periodo actual." }
    ],
    tableTitle: "Asientos recientes",
    tableDescription: "Actividad contable generada desde documentos y procesos manuales.",
    tableHeaders: ["Fecha", "Diario", "Cuenta", "Descripcion", "Importe", "Acciones"],
    emptyTitle: "No hay asientos visibles.",
    emptyDescription: "Crea asientos o aprueba documentos para generar actividad contable."
  },
  tax: {
    title: "Declaraciones",
    eyebrow: "Active_TaxDeclaration",
    description: "IVA, modelos oficiales, VeriFactu, obligaciones legales y presentaciones.",
    quickActions: ["Crear declaracion de IVA", "Configurar IVA", "Presentar declaracion", "Ver obligaciones legales"],
    stats: [
      { label: "Declaraciones", value: "0", description: "Modelos preparados o presentados." },
      { label: "IVA", value: "Pendiente", description: "Proxima liquidacion por revisar." },
      { label: "VeriFactu", value: "Preparado", description: "Superficie para estado normativo de facturas." }
    ],
    tableTitle: "Obligaciones fiscales",
    tableDescription: "Modelos y declaraciones pendientes de preparar o presentar.",
    tableHeaders: ["Modelo", "Periodo", "Estado", "Vencimiento", "Importe", "Acciones"],
    emptyTitle: "No hay declaraciones pendientes.",
    emptyDescription: "Configura impuestos y periodos para activar el calendario fiscal."
  },
  reports: {
    title: "Informes",
    eyebrow: "Active_ReportAccounting",
    description: "Informes financieros, cierre de ejercicio, clientes, proveedores y favoritos.",
    quickActions: ["Informes financieros", "Ejecutar informe de cierre", "Marcar un informe como favorito", "Exportar datos"],
    stats: [
      { label: "Informes", value: "0", description: "Vistas guardadas o disponibles para consulta." },
      { label: "Favoritos", value: "0", description: "Informes marcados para acceso rapido." },
      { label: "Exportaciones", value: "0", description: "Descargas generadas en el periodo." }
    ],
    tableTitle: "Biblioteca de informes",
    tableDescription: "Informes clave para analizar actividad, resultados y cumplimiento.",
    tableHeaders: ["Informe", "Area", "Periodo", "Ultima ejecucion", "Estado", "Acciones"],
    emptyTitle: "No hay informes guardados.",
    emptyDescription: "Los informes financieros y fiscales apareceran aqui cuando se configuren."
  }
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const params = await searchParams;
  const { data: memberships, error: membershipsError } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .returns<OrganizationMember[]>();

  assertNoError(membershipsError, "No se pudieron cargar las organizaciones");

  const organizationIds = memberships?.map((membership) => membership.organization_id) ?? [];
  const organizations = organizationIds.length > 0
    ? await readOrganizations(organizationIds)
    : [];
  const activeOrganization = organizations.find((organization) => organization.id === params?.org)
    ?? organizations[0]
    ?? null;
  const activeMembership = activeOrganization
    ? memberships?.find((membership) => membership.organization_id === activeOrganization.id)
    : null;

  if (!activeOrganization) {
    redirect("/onboarding");
  }

  const [
    documents,
    reviewTasks,
    documentCount,
    needsReviewCount,
    ocrRequiredCount,
    clientCount,
    fiscalEntityCount,
    fiscalEntities
  ] = await Promise.all([
    readDocuments(activeOrganization.id),
    readReviewTasks(activeOrganization.id),
    readDocumentCount(activeOrganization.id),
    readNeedsReviewCount(activeOrganization.id),
    readOcrRequiredCount(activeOrganization.id),
    readClientCount(activeOrganization.id),
    readFiscalEntityCount(activeOrganization.id),
    readFiscalEntities(activeOrganization.id)
  ]);

  const cleanDocumentCount = Math.max(documentCount - needsReviewCount - ocrRequiredCount, 0);
  const automationRate = documentCount > 0 ? Math.round((cleanDocumentCount / documentCount) * 100) : 0;
  const reviewRate = documentCount > 0 ? Math.round((needsReviewCount / documentCount) * 100) : 0;
  const uploadCoverage = fiscalEntityCount > 0 ? 100 : 0;
  const displayName = getDisplayName(user.email);
  const aiBudget = formatCurrency(activeOrganization.ai_monthly_budget_cents / 100);
  const activeModule = resolveAppModule(params?.module);
  const activeTab = resolveDashboardTab(params?.tab);
  const moduleHref = (module: AppModule) => `/dashboard?org=${activeOrganization.id}&module=${module}`;
  const tabHref = (tab: DashboardTab) => `/dashboard?org=${activeOrganization.id}&module=dashboard&tab=${tab}`;

  return (
    <main className="fiscal-shell">
      <aside className="fiscal-sidebar" aria-label="Navegacion principal">
        <div className="sidebar-brand" aria-label="GFiscal">
          <span className="sidebar-brand-mark">GF</span>
          <span>GFiscal</span>
        </div>
        <nav className="sidebar-nav">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.module;

            return (
              <Link className={`sidebar-link${isActive ? " active" : ""}`} href={moduleHref(item.module)} key={item.label}>
                <Icon aria-hidden="true" size={23} strokeWidth={2.7} />
                <span>{item.label}</span>
                {!isActive ? <ChevronRight aria-hidden="true" className="sidebar-chevron" size={15} /> : null}
              </Link>
            );
          })}
        </nav>
      </aside>

      <section className="fiscal-workbench">
        <header className="fiscal-header">
          <div className="fiscal-title-block">
            <div className="fiscal-title-row">
              <h1>Hola, {displayName}</h1>
              <span className="insights-pill">
                <Sparkles aria-hidden="true" size={18} fill="currentColor" />
                Copilot Insights
              </span>
            </div>
            <p>
              En esta pagina se muestra informacion clave sobre tu negocio. GFiscal actualiza tus KPI documentales en tiempo real.
            </p>
          </div>
          <div className="fiscal-header-actions">
            <form className="org-switcher" action="/dashboard">
              <label htmlFor="org">Organizacion</label>
              <input type="hidden" name="module" value={activeModule} />
              {activeModule === "dashboard" ? <input type="hidden" name="tab" value={activeTab} /> : null}
              <select id="org" name="org" defaultValue={activeOrganization.id}>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
              <button className="button compact secondary" type="submit">
                Cambiar
              </button>
            </form>
            <form action={signOut}>
              <button className="icon-action" aria-label="Salir" type="submit" title={user.email ?? "Salir"}>
                <LogOut aria-hidden="true" size={19} />
              </button>
            </form>
          </div>
        </header>

        {activeModule === "dashboard" ? (
          <div className="fiscal-tabs" role="tablist" aria-label="Secciones del cuadro de mando">
            <Link className={`tab${activeTab === "accounting" ? " active" : ""}`} href={tabHref("accounting")} role="tab">
              Contabilidad
            </Link>
            <Link className={`tab${activeTab === "sales" ? " active" : ""}`} href={tabHref("sales")} role="tab">
              Ventas y compras
            </Link>
            <Link className={`tab${activeTab === "news" ? " active" : ""}`} href={tabHref("news")} role="tab">
              Novedades
            </Link>
          </div>
        ) : null}

        {params?.uploaded ? (
          <div className="notice success">Documento subido y encolado para procesamiento.</div>
        ) : null}

        {params?.onboarded ? (
          <div className="notice success">Alta inicial completada. Ya puedes subir tu primer PDF.</div>
        ) : null}

        {params?.error ? (
          <div className="notice danger">{formatDashboardError(params.error)}</div>
        ) : null}

        {activeModule !== "dashboard" ? (
          <ModuleWorkspace
            module={activeModule}
            clientCount={clientCount}
            documentCount={documentCount}
            fiscalEntityCount={fiscalEntityCount}
            needsReviewCount={needsReviewCount}
            ocrRequiredCount={ocrRequiredCount}
          />
        ) : activeTab === "accounting" ? (
          <>
            <section className="dashboard-section" aria-labelledby="profit-title">
              <h2 id="profit-title">Indicadores de control fiscal</h2>
              <div className="statement-grid">
                <KpiStatementCard
                  icon={<BarChart3 aria-hidden="true" size={26} />}
                  title="Documentos procesados"
                  value={documentCount.toLocaleString("es-ES")}
                  description="Facturas y documentos registrados en la organizacion activa"
                  details={[
                    { label: "Correctos", value: cleanDocumentCount.toLocaleString("es-ES") },
                    { label: "Por revisar", value: needsReviewCount.toLocaleString("es-ES") }
                  ]}
                />
                <KpiStatementCard
                  icon={<ClipboardCheck aria-hidden="true" size={26} />}
                  title="Control antes del cierre"
                  value={`${needsReviewCount.toLocaleString("es-ES")} tareas`}
                  description="Revisiones humanas abiertas y validaciones pendientes"
                  details={[
                    { label: "Revision", value: `${reviewRate}%` },
                    { label: "OCR pendiente", value: ocrRequiredCount.toLocaleString("es-ES") }
                  ]}
                />
              </div>
            </section>

        <section className="dashboard-section" aria-labelledby="performance-title">
          <h2 id="performance-title">Indicadores de rendimiento</h2>
          <div className="ratio-grid">
            <RatioCard
              title="Automatizacion limpia"
              description="Documentos sin OCR pendiente ni revision humana sobre el total registrado"
              value={`${automationRate}%`}
              leftLabel="Procesados"
              leftValue={cleanDocumentCount.toLocaleString("es-ES")}
              rightLabel="Total"
              rightValue={documentCount.toLocaleString("es-ES")}
            />
            <RatioCard
              title="Cobertura de entidades"
              description="Capacidad para registrar documentos en entidades fiscales activas"
              value={`${uploadCoverage}%`}
              leftLabel="Entidades"
              leftValue={fiscalEntityCount.toLocaleString("es-ES")}
              rightLabel="Clientes"
              rightValue={clientCount.toLocaleString("es-ES")}
            />
            <RatioCard
              title="Presupuesto IA"
              description="Consumo operativo permitido para extraccion y revision asistida"
              value={aiBudget}
              leftLabel="Plan"
              leftValue={formatLabel(activeOrganization.plan)}
              rightLabel="Rol"
              rightValue={formatLabel(activeMembership?.role ?? "miembro")}
            />
          </div>
        </section>

        <section className="bottom-dashboard-grid" aria-label="Actividad documental">
          <div>
            <h2 className="section-heading">Indicadores adicionales</h2>
            <div className="small-card-grid">
              <SmallIndicatorCard
                title="Entidades fiscales"
                value={fiscalEntityCount.toLocaleString("es-ES")}
                description="Sujetos fiscales activos para registrar documentacion."
              />
              <SmallIndicatorCard
                title="Clientes"
                value={clientCount.toLocaleString("es-ES")}
                description="Contactos de negocio disponibles para la operativa fiscal."
              />
              <SmallIndicatorCard
                title="OCR pendiente"
                value={ocrRequiredCount.toLocaleString("es-ES")}
                description="Documentos que requieren lectura avanzada antes de validar."
              />
            </div>
          </div>

          <aside>
            <h2 className="section-heading">Accesos rapidos</h2>
            <div className="quick-card">
              <form className="quick-upload" action={uploadDocument} encType="multipart/form-data">
                <input type="hidden" name="organization_id" value={activeOrganization.id} />
                <label className="field">
                  <span>Entidad fiscal</span>
                  <select className="select" name="fiscal_entity_id" required disabled={fiscalEntities.length === 0}>
                    {fiscalEntities.map((entity) => (
                      <option key={entity.id} value={entity.id}>
                        {entity.legal_name}{entity.tax_id ? ` · ${entity.tax_id}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field file-drop">
                  <UploadCloud aria-hidden="true" size={20} />
                  <span>Subir facturas PDF</span>
                  <input name="files" type="file" accept="application/pdf" multiple required />
                </label>
                <button className="button" type="submit" disabled={fiscalEntities.length === 0}>
                  Encolar documentos
                </button>
              </form>
              <div className="quick-links">
                <a href="#documentos">Consultar documentos recientes</a>
                <a href="#revision">Marcar revisiones</a>
                <a href="#profit-title">Ver control fiscal</a>
              </div>
            </div>
          </aside>
        </section>

        <section className="activity-grid">
          <div className="panel" id="documentos">
            <div className="panel-header">
              <h2>Documentos recientes</h2>
              <span className="row-meta">{documents.length} visibles</span>
            </div>
            {documents.length > 0 ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Documento</th>
                      <th>Tipo</th>
                      <th>Estado</th>
                      <th>Origen</th>
                      <th>Fecha</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((document) => (
                      <tr key={document.id}>
                        <td>
                          <div className="row-title">{document.title ?? "Documento sin titulo"}</div>
                          {document.failure_reason ? (
                            <div className="row-meta">{document.failure_reason}</div>
                          ) : null}
                        </td>
                        <td>{formatLabel(document.document_type)}</td>
                        <td>
                          <StatusPill status={document.status} />
                        </td>
                        <td>{formatLabel(document.source)}</td>
                        <td>{formatDate(document.created_at)}</td>
                        <td>
                          {document.status === "ocr_required" ? (
                            <span className="row-meta strong">Requiere OCR</span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">No hay documentos visibles en esta organizacion.</div>
            )}
          </div>

          <aside className="panel" id="revision">
            <div className="panel-header">
              <h2>Revision humana</h2>
              <span className="row-meta">{reviewTasks.length} abiertas</span>
            </div>
            {reviewTasks.length > 0 ? (
              <div className="side-list">
                {reviewTasks.map((task) => (
                  <div className="side-row" key={task.id}>
                    <FileSearch aria-hidden="true" className="side-row-icon" size={18} />
                    <Link className="row-title link-row" href={`/dashboard/review/${task.id}`}>
                      {formatLabel(task.reason)}
                    </Link>
                    <div className="row-meta">Prioridad {task.priority} · {formatDate(task.created_at)}</div>
                    <StatusPill status={task.status} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <CheckCircle2 aria-hidden="true" size={24} />
                No hay revisiones abiertas.
              </div>
            )}
          </aside>
        </section>
          </>
        ) : activeTab === "sales" ? (
          <SalesDashboard
            clientCount={clientCount}
            documentCount={documentCount}
            fiscalEntityCount={fiscalEntityCount}
          />
        ) : (
          <NewsDashboard />
        )}
      </section>
    </main>
  );

  async function readOrganizations(ids: string[]): Promise<Organization[]> {
    const { data, error } = await supabase
      .from("organizations")
      .select("id, name, slug, plan, status, ai_monthly_budget_cents")
      .in("id", ids)
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .returns<Organization[]>();

    assertNoError(error, "No se pudieron cargar las organizaciones");
    return data ?? [];
  }

  async function readDocuments(organizationId: string): Promise<DocumentRow[]> {
    const { data, error } = await supabase
      .from("documents")
      .select("id, title, document_type, status, source, created_at, failure_reason")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(12)
      .returns<DocumentRow[]>();

    assertNoError(error, "No se pudieron cargar los documentos");
    return data ?? [];
  }

  async function readReviewTasks(organizationId: string): Promise<ReviewTaskRow[]> {
    const { data, error } = await supabase
      .from("review_tasks")
      .select("id, status, reason, priority, document_id, created_at")
      .eq("organization_id", organizationId)
      .in("status", ["open", "in_review"])
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(8)
      .returns<ReviewTaskRow[]>();

    assertNoError(error, "No se pudieron cargar las revisiones");
    return data ?? [];
  }

  async function readDocumentCount(organizationId: string): Promise<number> {
    const { count, error } = await supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("deleted_at", null);

    assertNoError(error, "No se pudo contar documentos");
    return count ?? 0;
  }

  async function readNeedsReviewCount(organizationId: string): Promise<number> {
    const { count, error } = await supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "needs_review")
      .is("deleted_at", null);

    assertNoError(error, "No se pudo contar revision");
    return count ?? 0;
  }

  async function readOcrRequiredCount(organizationId: string): Promise<number> {
    const { count, error } = await supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "ocr_required")
      .is("deleted_at", null);

    assertNoError(error, "No se pudo contar OCR pendiente");
    return count ?? 0;
  }

  async function readClientCount(organizationId: string): Promise<number> {
    const { count, error } = await supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("deleted_at", null);

    assertNoError(error, "No se pudo contar clientes");
    return count ?? 0;
  }

  async function readFiscalEntityCount(organizationId: string): Promise<number> {
    const { count, error } = await supabase
      .from("fiscal_entities")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("deleted_at", null);

    assertNoError(error, "No se pudo contar entidades fiscales");
    return count ?? 0;
  }

  async function readFiscalEntities(organizationId: string): Promise<FiscalEntityRow[]> {
    const { data, error } = await supabase
      .from("fiscal_entities")
      .select("id, legal_name, tax_id")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("legal_name", { ascending: true })
      .returns<FiscalEntityRow[]>();

    assertNoError(error, "No se pudieron cargar las entidades fiscales");
    return data ?? [];
  }
}

function SalesDashboard({
  clientCount,
  documentCount,
  fiscalEntityCount
}: {
  clientCount: number;
  documentCount: number;
  fiscalEntityCount: number;
}) {
  const pendingCollection = 46004.88;
  const pendingPayment = 6455.46;
  const purchaseInvoicesTotal = 6134.97;
  const convertedQuotes = Math.max(Math.min(documentCount, 1), 1);
  const activeClients = clientCount > 0 ? clientCount : 45;

  return (
    <>
      <section className="dashboard-section" aria-labelledby="outstanding-title">
        <h2 id="outstanding-title">Importes pendientes</h2>
        <div className="outstanding-grid">
          <OutstandingAmountCard
            icon={<FileText aria-hidden="true" size={27} />}
            title="Pendiente de cobro"
            amount={pendingCollection}
            links={["Ver vencimientos", "Ver antiguedad de saldos"]}
          />
          <OutstandingAmountCard
            icon={<BadgeEuro aria-hidden="true" size={27} />}
            title="Pendiente de pago"
            amount={pendingPayment}
            links={["Ver vencimientos", "Ver antiguedad de saldos"]}
          />
        </div>
      </section>

      <section className="sales-overview-grid" aria-label="Indicadores de ventas y compras">
        <SalesSummaryTile
          icon={<BadgeEuro aria-hidden="true" size={25} />}
          tone="green"
          value={formatMoney(pendingCollection)}
          description='Total de facturas contabilizadas desde "Facturas de venta" (ejercicio en curso hasta la fecha)'
        />
        <SalesSummaryTile
          icon={<ShoppingCart aria-hidden="true" size={25} />}
          tone="rose"
          value={formatMoney(purchaseInvoicesTotal)}
          description='Total de facturas contabilizadas desde "Facturas de compra" (ejercicio en curso hasta la fecha)'
        />
        <SalesSummaryTile
          icon={<Users aria-hidden="true" size={25} />}
          tone="blue"
          value={activeClients.toLocaleString("es-ES")}
          description="Clientes activos"
        />
        <aside className="sales-quick-card">
          <h2>Accesos rapidos</h2>
          <div className="quick-links">
            <a href="#sales-customers">Crear clientes</a>
            <a href="#sales-suppliers">Crear proveedores</a>
            <a href="#sales-invoices">Crear facturas de venta</a>
            <a href="#purchase-upload">Subir facturas de compra</a>
          </div>
        </aside>
      </section>

      <SalesInvoiceTable rows={salesInvoiceSeedRows} totalItems={13} />

      <section className="quotes-dashboard-grid" aria-label="Presupuestos">
        <div className="quotes-side-stack">
          <SmallIndicatorCard
            title="Presupuestos pendientes"
            value={formatMoney(0)}
            description="Total de todos los presupuestos pendientes"
          />
          <SalesSummaryTile
            icon={<FileText aria-hidden="true" size={23} />}
            tone="green"
            value={convertedQuotes.toLocaleString("es-ES")}
            description="Presupuestos convertidos en otro documento de venta"
          />
        </div>
        <section className="sales-table-card">
          <div className="sales-table-heading">
            <h2>Presupuestos pendientes</h2>
            <p>Consulta todos los presupuestos pendientes.</p>
          </div>
          <div className="sales-table-wrap quote-table">
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Fecha de presup...</th>
                  <th>Numero de presupuesto</th>
                  <th>Cliente</th>
                  <th>Codigo de cliente</th>
                  <th>Total</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={6}>
                    <div className="table-empty-state">
                      <FileSearch aria-hidden="true" size={76} />
                      <div>
                        <strong>Esta lista esta en blanco.</strong>
                        <p>La busqueda no ha dado ningun resultado. Intentalo de nuevo.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6}>Elementos: 0</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="sales-table-actions">
            <a href="#quotes">Ver todos los presupuestos</a>
            <a href="#quote-reminders">Preparar recordatorios</a>
          </div>
        </section>
      </section>

      <section className="sales-footnote-grid" aria-label="Cobertura operacional">
        <SmallIndicatorCard
          title="Organizaciones fiscales"
          value={fiscalEntityCount.toLocaleString("es-ES")}
          description="Entidades disponibles para clasificar ventas, compras y documentos."
        />
        <SmallIndicatorCard
          title="Documentos conectados"
          value={documentCount.toLocaleString("es-ES")}
          description="Base documental actual para alimentar el futuro modulo comercial."
        />
      </section>
    </>
  );
}

function ModuleWorkspace({
  module,
  clientCount,
  documentCount,
  fiscalEntityCount,
  needsReviewCount,
  ocrRequiredCount
}: {
  module: AppModule;
  clientCount: number;
  documentCount: number;
  fiscalEntityCount: number;
  needsReviewCount: number;
  ocrRequiredCount: number;
}) {
  const definition = moduleCatalog[module];
  const stats = applyModuleLiveValues(module, definition.stats, {
    clientCount,
    documentCount,
    fiscalEntityCount,
    needsReviewCount,
    ocrRequiredCount
  });

  return (
    <section className="module-workspace" aria-labelledby={`${module}-module-title`}>
      <div className="module-hero">
        <div>
          <span className="module-eyebrow">{definition.eyebrow}</span>
          <h2 id={`${module}-module-title`}>{definition.title}</h2>
          <p>{definition.description}</p>
        </div>
        <div className="module-action-strip">
          {definition.quickActions.slice(0, 2).map((action) => (
            <a href={`#${module}-${slugify(action)}`} key={action}>{action}</a>
          ))}
        </div>
      </div>

      <div className="module-stats-grid">
        {stats.map((stat) => (
          <SmallIndicatorCard
            title={stat.label}
            value={stat.value}
            description={stat.description}
            key={stat.label}
          />
        ))}
      </div>

      <section className="module-layout-grid">
        <aside className="module-quick-panel">
          <h3>Accesos rapidos</h3>
          <div className="quick-links">
            {definition.quickActions.map((action) => (
              <a href={`#${module}-${slugify(action)}`} key={action}>{action}</a>
            ))}
          </div>
        </aside>

        <section className="sales-table-card module-table-card">
          <div className="sales-table-heading">
            <h2>{definition.tableTitle}</h2>
            <p>{definition.tableDescription}</p>
          </div>
          <div className="sales-table-wrap module-table-wrap">
            <table className="sales-table module-table">
              <thead>
                <tr>
                  {definition.tableHeaders.map((header) => (
                    <th key={header}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={definition.tableHeaders.length}>
                    <div className="table-empty-state">
                      <FileSearch aria-hidden="true" size={76} />
                      <div>
                        <strong>{definition.emptyTitle}</strong>
                        <p>{definition.emptyDescription}</p>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={definition.tableHeaders.length}>Elementos: 0</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      </section>

      <section className="module-roadmap-card">
        <h3>Siguiente conexion de datos</h3>
        <p>
          Esta superficie ya tiene estructura visual y taxonomia de Sage Active. El siguiente paso es conectar sus tarjetas y tablas al modelo real de GFiscal.
        </p>
      </section>
    </section>
  );
}

function OutstandingAmountCard({
  icon,
  title,
  amount,
  links
}: {
  icon: ReactNode;
  title: string;
  amount: number;
  links: string[];
}) {
  return (
    <article className="outstanding-card">
      <div className="outstanding-title">
        <span>{icon}</span>
        <h3>{title}</h3>
      </div>
      <p>
        {formatMoney(amount)} <span>Importe vencido:</span>
      </p>
      <div className="outstanding-bar" aria-hidden="true" />
      <strong>{formatMoney(amount)} Total</strong>
      <div className="outstanding-actions">
        {links.map((link) => (
          <a href="#sales-vencimientos" key={link}>{link}</a>
        ))}
      </div>
    </article>
  );
}

function SalesSummaryTile({
  icon,
  tone,
  value,
  description
}: {
  icon: ReactNode;
  tone: "green" | "rose" | "blue";
  value: string;
  description: string;
}) {
  return (
    <article className="sales-summary-tile">
      <span className={`sales-tile-icon ${tone}`}>{icon}</span>
      <div>
        <strong>{value}</strong>
        <p>{description}</p>
      </div>
    </article>
  );
}

function SalesInvoiceTable({ rows, totalItems }: { rows: SalesInvoiceRow[]; totalItems: number }) {
  return (
    <section className="sales-table-card" id="sales-invoices">
      <div className="sales-table-heading">
        <h2>Facturas de venta vencidas</h2>
        <p>Consulta todas las facturas de venta que han vencido.</p>
      </div>
      <div className="sales-table-wrap">
        <table className="sales-table">
          <thead>
            <tr>
              <th>Estado</th>
              <th>Fecha de factura</th>
              <th>Numero de factura</th>
              <th>Cliente</th>
              <th>Codigo de cliente</th>
              <th>Total</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td><span className="expired-badge">{row.status}</span></td>
                <td>{row.invoiceDate}</td>
                <td>
                  <a className="invoice-link" href={`#invoice-${row.invoiceNumber}`}>
                    {row.invoiceNumber}
                    <ExternalLink aria-hidden="true" size={17} />
                  </a>
                </td>
                <td>{row.customer}</td>
                <td>{row.customerCode}</td>
                <td>{formatMoney(row.total)}</td>
                <td>
                  <button className="table-icon-button" type="button" aria-label={`Acciones ${row.invoiceNumber}`}>
                    <MoreVertical aria-hidden="true" size={22} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={7}>Elementos: {totalItems.toLocaleString("es-ES")}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="sales-table-actions">
        <a href="#all-sales-invoices">Ver todas las facturas</a>
        <a href="#sales-reminders">Preparar recordatorios</a>
      </div>
    </section>
  );
}

function NewsDashboard() {
  return (
    <section className="dashboard-section">
      <h2>Novedades</h2>
      <div className="small-card-grid">
        <SmallIndicatorCard
          title="Copilot Insights"
          value="Activo"
          description="Proxima superficie para avisos, recomendaciones y tareas sugeridas."
        />
        <SmallIndicatorCard
          title="Sage Active"
          value="2026"
          description="Referencia visual y funcional conectada al material local."
        />
      </div>
    </section>
  );
}

function KpiStatementCard({
  icon,
  title,
  value,
  description,
  details
}: {
  icon: ReactNode;
  title: string;
  value: string;
  description: string;
  details: Array<{ label: string; value: string }>;
}) {
  return (
    <article className="statement-card">
      <div className="statement-icon">{icon}</div>
      <div className="statement-copy">
        <div className="statement-heading">
          <h3>{title}</h3>
          <strong>{value}</strong>
        </div>
        <p>{description}</p>
        <div className="statement-details">
          {details.map((detail) => (
            <div key={detail.label}>
              <span>{detail.label}</span>
              <strong>{detail.value}</strong>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function RatioCard({
  title,
  description,
  value,
  leftLabel,
  leftValue,
  rightLabel,
  rightValue
}: {
  title: string;
  description: string;
  value: string;
  leftLabel: string;
  leftValue: string;
  rightLabel: string;
  rightValue: string;
}) {
  return (
    <article className="ratio-card">
      <h3>{title}</h3>
      <p>{description}</p>
      <strong className="ratio-value">{value}</strong>
      <div className="ratio-details">
        <div>
          <span>{leftLabel}</span>
          <strong>{leftValue}</strong>
        </div>
        <div>
          <span>{rightLabel}</span>
          <strong>{rightValue}</strong>
        </div>
      </div>
    </article>
  );
}

function SmallIndicatorCard({
  title,
  value,
  description
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <article className="small-indicator-card">
      <h3>{title}</h3>
      <strong>{value}</strong>
      <p>{description}</p>
    </article>
  );
}

function StatusPill({ status }: { status: string }) {
  const knownStatuses = new Set([
    "uploaded",
    "queued",
    "extracting_text",
    "text_extracted",
    "ocr_required",
    "ocr_processing",
    "ai_processing",
    "needs_review",
    "open",
    "in_review",
    "failed",
    "rejected",
    "approved",
    "succeeded"
  ]);
  const className = knownStatuses.has(status)
    ? `status-pill ${status}`
    : "status-pill default";

  return <span className={className}>{formatLabel(status)}</span>;
}

function formatDashboardError(error: string): string {
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

function formatLabel(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-ES", {
    currency: "EUR",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("es-ES", {
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    style: "currency"
  }).format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function resolveDashboardTab(value: string | undefined): DashboardTab {
  if (value === "sales" || value === "news") {
    return value;
  }

  return "accounting";
}

function resolveAppModule(value: string | undefined): AppModule {
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

function applyModuleLiveValues(
  module: AppModule,
  stats: Array<{ label: string; value: string; description: string }>,
  counts: {
    clientCount: number;
    documentCount: number;
    fiscalEntityCount: number;
    needsReviewCount: number;
    ocrRequiredCount: number;
  }
) {
  return stats.map((stat) => {
    if (module === "contacts" && stat.label === "Clientes") {
      return { ...stat, value: counts.clientCount.toLocaleString("es-ES") };
    }

    if (module === "purchases" && stat.label === "OCR pendiente") {
      return { ...stat, value: counts.ocrRequiredCount.toLocaleString("es-ES") };
    }

    if (module === "accounting" && stat.label === "Por marcar") {
      return { ...stat, value: counts.needsReviewCount.toLocaleString("es-ES") };
    }

    if (module === "reports" && stat.label === "Informes") {
      return { ...stat, value: counts.documentCount.toLocaleString("es-ES") };
    }

    if (module === "tax" && stat.label === "Declaraciones") {
      return { ...stat, value: counts.fiscalEntityCount.toLocaleString("es-ES") };
    }

    return stat;
  });
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getDisplayName(email: string | undefined): string {
  if (!email) {
    return "USUARIO";
  }

  return (email.split("@").at(0) ?? "USUARIO").replace(/[._-]+/g, " ").toUpperCase();
}

function assertNoError(error: { message: string } | null, message: string): void {
  if (error) {
    throw new Error(`${message}: ${error.message}`);
  }
}
