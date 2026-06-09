import {
  BadgeEuro,
  BarChart3,
  FileSignature,
  FileText,
  Landmark,
  LayoutDashboard,
  PackageSearch,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  Users
} from "lucide-react";
import { getSageReferenceModule } from "@/src/lib/product/sage-active-reference";
import type { SageReferenceModuleId } from "@/src/lib/product/sage-active-reference";
import type { AppModule } from "./types";

export type ModuleDefinition = {
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
};

export const navigationItems = [
  { label: "Dashboard", icon: LayoutDashboard, module: "dashboard" },
  { label: "Ventas", icon: BarChart3, module: "sales" },
  { label: "Presupuestos", icon: FileSignature, module: "quotes" },
  { label: "Compras", icon: ShoppingCart, module: "purchases" },
  { label: "Contactos", icon: Users, module: "contacts" },
  { label: "Productos y servicios", icon: PackageSearch, module: "products" },
  { label: "Bancos", icon: Landmark, module: "banks" },
  { label: "Contabilidad", icon: SlidersHorizontal, module: "accounting" },
  { label: "Declaraciones", icon: BadgeEuro, module: "tax" },
  { label: "Informes", icon: FileText, module: "reports" },
  { label: "Configuracion", icon: Settings, module: "settings" }
] satisfies Array<{ label: string; icon: typeof LayoutDashboard; module: AppModule }>;

function referenceQuickActions(module: AppModule, fallback: string[]): string[] {
  return getSageReferenceModule(module as SageReferenceModuleId)?.quickActions ?? fallback;
}

export const moduleCatalog: Record<AppModule, ModuleDefinition> = {
  dashboard: {
    title: "Dashboard",
    eyebrow: "Inicio",
    description: "Indicadores, importes pendientes, actividad documental y accesos rapidos.",
    quickActions: referenceQuickActions("dashboard", ["Ver contabilidad", "Ver ventas y compras", "Revisar novedades"]),
    stats: [],
    tableTitle: "Actividad reciente",
    tableDescription: "Resumen de los ultimos movimientos.",
    tableHeaders: ["Elemento", "Estado", "Fecha", "Acciones"],
    emptyTitle: "Sin actividad",
    emptyDescription: "Todavia no hay movimientos para mostrar."
  },
  sales: {
    title: "Ventas",
    eyebrow: "",
    description: "",
    quickActions: referenceQuickActions("sales", ["Crear factura", "Crear cliente", "Preparar recordatorio"]),
    stats: [],
    tableTitle: "Ventas",
    tableDescription: "",
    tableHeaders: ["Estado", "Fecha", "Numero", "Cliente", "Total", "Acciones"],
    emptyTitle: "No hay facturas de venta.",
    emptyDescription: "Crea una factura o importa ventas para empezar a controlar cobros."
  },
  quotes: {
    title: "Presupuestos",
    eyebrow: "Active_Quotes",
    description: "Generador de presupuestos y facturas imprimibles con plantilla propia.",
    quickActions: ["Crear presupuesto", "Crear factura", "Imprimir o exportar PDF"],
    stats: [
      { label: "Documentos", value: "0", description: "Presupuestos y facturas guardados en este dispositivo." },
      { label: "Plantillas", value: "2", description: "Formato de presupuesto y factura disponibles." },
      { label: "Exportaciones", value: "0", description: "PDF generados desde el generador." }
    ],
    tableTitle: "Documentos guardados",
    tableDescription: "Historial local de presupuestos y facturas generados.",
    tableHeaders: ["Tipo", "Cliente", "Fecha", "Total", "Acciones"],
    emptyTitle: "No hay documentos guardados.",
    emptyDescription: "Crea un presupuesto o factura para empezar."
  },
  purchases: {
    title: "Compras",
    eyebrow: "Active_Purchase",
    description: "Facturas de compra, proveedores, gastos, pagos y documentos simplificados.",
    quickActions: referenceQuickActions("purchases", ["Subir facturas de compra", "Crear proveedores", "Introducir gastos"]),
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
    quickActions: referenceQuickActions("contacts", ["Crear clientes", "Crear proveedores", "Consultar por tercero"]),
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
    quickActions: referenceQuickActions("products", ["Crear producto", "Crear servicio", "Actualizar precios"]),
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
    description: "",
    quickActions: referenceQuickActions("banks", ["Importar extracto", "Conciliar movimientos", "Crear cuenta bancaria"]),
    stats: [
      { label: "Cuentas", value: "0", description: "" },
      { label: "Movimientos", value: "0", description: "" },
      { label: "Sin conciliar", value: "0", description: "" }
    ],
    tableTitle: "Movimientos bancarios",
    tableDescription: "",
    tableHeaders: ["Fecha", "Cuenta", "Descripcion", "Importe", "Estado", "Acciones"],
    emptyTitle: "No hay movimientos bancarios.",
    emptyDescription: "Conecta una cuenta o importa un extracto para empezar."
  },
  accounting: {
    title: "Contabilidad",
    eyebrow: "Active_Accounting",
    description: "Asientos, libro mayor, marcaje, cuentas contables, cierres y FEC.",
    quickActions: referenceQuickActions("accounting", ["Crear asientos", "Consultar libro mayor", "Marcar apuntes"]),
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
    description: "",
    quickActions: referenceQuickActions("tax", ["Preparar declaracion", "Revisar IVA", "Ver obligaciones"]),
    stats: [
      { label: "Declaraciones", value: "0", description: "" },
      { label: "IVA", value: "Pendiente", description: "" },
      { label: "VeriFactu", value: "Preparado", description: "" }
    ],
    tableTitle: "Obligaciones fiscales",
    tableDescription: "",
    tableHeaders: ["Modelo", "Periodo", "Estado", "Vencimiento", "Importe", "Acciones"],
    emptyTitle: "No hay declaraciones pendientes.",
    emptyDescription: "Configura impuestos y periodos para activar el calendario fiscal."
  },
  reports: {
    title: "Informes",
    eyebrow: "Active_ReportAccounting",
    description: "",
    quickActions: referenceQuickActions("reports", ["Ejecutar informe", "Exportar balance", "Guardar favorito"]),
    stats: [
      { label: "Informes", value: "0", description: "" },
      { label: "Favoritos", value: "0", description: "" },
      { label: "Exportaciones", value: "0", description: "" }
    ],
    tableTitle: "Biblioteca de informes",
    tableDescription: "",
    tableHeaders: ["Informe", "Area", "Periodo", "Ultima ejecucion", "Estado", "Acciones"],
    emptyTitle: "No hay informes guardados.",
    emptyDescription: "Los informes financieros y fiscales apareceran aqui cuando se configuren."
  },
  settings: {
    title: "Configuracion",
    eyebrow: "Active_Settings",
    description: "",
    quickActions: referenceQuickActions("settings", ["Configurar empresa", "Gestionar usuarios", "Revisar impuestos"]),
    stats: [
      { label: "Usuarios", value: "0", description: "" },
      { label: "Permisos", value: "Base", description: "" },
      { label: "Integraciones", value: "0", description: "" }
    ],
    tableTitle: "Ajustes principales",
    tableDescription: "",
    tableHeaders: ["Area", "Estado", "Responsable", "Ultimo cambio", "Acciones"],
    emptyTitle: "No hay ajustes personalizados.",
    emptyDescription: "Los ajustes avanzados apareceran aqui cuando se conecten al modelo real."
  }
};

export function applyModuleLiveValues(
  module: AppModule,
  stats: ModuleDefinition["stats"],
  counts: {
    clientCount: number;
    documentCount: number;
    fiscalEntityCount: number;
    needsReviewCount: number;
    ocrRequiredCount: number;
    memberCount: number;
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

    if (module === "settings" && stat.label === "Usuarios") {
      return { ...stat, value: counts.memberCount.toLocaleString("es-ES") };
    }

    return stat;
  });
}
