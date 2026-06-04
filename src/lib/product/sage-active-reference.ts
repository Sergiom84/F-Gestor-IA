export type SageReferenceModuleId =
  | "dashboard"
  | "sales"
  | "purchases"
  | "contacts"
  | "products"
  | "banks"
  | "accounting"
  | "tax"
  | "reports"
  | "settings"
  | "documents"
  | "copilot";

export type GfiscalReferenceStatus =
  | "scaffolded"
  | "partially_connected"
  | "backlog";

export type SageReferenceModule = {
  id: SageReferenceModuleId;
  label: string;
  sageKeys: string[];
  purpose: string;
  primaryEntities: string[];
  quickActions: string[];
  lists: string[];
  forms: string[];
  settings: string[];
  gfiscalStatus: GfiscalReferenceStatus;
  nextDataModel: string[];
};

export const sageActiveCaptureRoot =
  "C:\\Users\\sergi\\Documents\\Software\\SADGE_Asor-IA";

export const sageActiveReferenceSources = [
  {
    path: "mainui.es.active.sage.com/sage-active-2026052.js",
    use: "Main captured Sage Active UI bundle. Useful for menu keys, module names, dashboard concepts and route vocabulary."
  },
  {
    path: "assets.sbc.sage.com/sbc.common.translations.ui/2.324.1/umd/index.js",
    use: "Shared translation bundle. Useful for labels, empty states, actions, reports and settings vocabulary."
  },
  {
    path: "mainui.es.active.sage.com/static/css/main.d250d7005f7908417071.css",
    use: "Captured visual system. Useful for dashboard proportions, tables, spacing, borders and Sage-like neutral colors."
  },
  {
    path: "bff.es.active.sage.com/api/contractedfeatures/byorganization.html",
    use: "Captured feature availability response. Useful for deciding which functional areas existed in the Sage session."
  },
  {
    path: "bff.es.active.sage.com/api/technicalfeatureflags/ui.html",
    use: "Captured UI feature flags. Useful for backlog signals, not for direct runtime behavior."
  }
] as const;

export const sageActiveFeatureSignals = [
  "Core",
  "Accounting",
  "Sales",
  "Copilot",
  "ui_paymentsIn",
  "ui_simplifiedInvoices_51920",
  "ui_simplified_purchase_invoice_by_email",
  "ui_onlinePaymentShowInfo_54101",
  "ui_eInvoicingAccounting_51346",
  "ui_salesWithholdings",
  "ui_showCopilotFinanceAgent=false"
] as const;

export const sageActiveDesignSignals = {
  fontFamily: ["Sage UI", "Sage Text", "Arial", "sans-serif"],
  pageBackground: "#eef2f4",
  cardBackground: "#ffffff",
  cardBorder: "#ccd6db",
  mutedBorder: "#c8d4df",
  sageGreen: "#008a45",
  sageGreenDark: "#006f2f",
  overdueRed: "#ce3550",
  warningOrange: "#ff812d",
  tableHeader: "#cbd6dc",
  cardRadiusPx: 8,
  layout: [
    "left module sidebar",
    "tabbed dashboard header",
    "white cards with thin neutral borders",
    "dense business tables with sticky-looking summary footer",
    "green text links for primary actions"
  ]
} as const;

export const sageActiveModules: SageReferenceModule[] = [
  {
    id: "dashboard",
    label: "Cuadros de mando",
    sageKeys: [
      "home",
      "dashboard",
      "accounting_dashboard",
      "sales_dashboard",
      "monitoring_outstanding_amounts",
      "profit_loss_indicators",
      "performance_indicators",
      "sales_outstanding_sales_invoices",
      "sales_pending_offers"
    ],
    purpose:
      "Mostrar indicadores clave por area, accesos rapidos y listas operativas que necesitan atencion.",
    primaryEntities: [
      "dashboard_snapshots",
      "dashboard_widgets",
      "commercial_maturities",
      "review_tasks",
      "documents"
    ],
    quickActions: [
      "Ver contabilidad",
      "Ver ventas y compras",
      "Crear asientos",
      "Crear facturas",
      "Preparar recordatorios"
    ],
    lists: [
      "Facturas de venta vencidas",
      "Presupuestos pendientes",
      "Documentos pendientes de revision",
      "Novedades"
    ],
    forms: [],
    settings: ["dashboard_preferences", "organization_period"],
    gfiscalStatus: "partially_connected",
    nextDataModel: [
      "dashboard_widget_state",
      "commercial_maturity_snapshot",
      "sales_purchase_kpi_snapshot"
    ]
  },
  {
    id: "sales",
    label: "Ventas",
    sageKeys: [
      "Active_Sales",
      "salesinvoices",
      "salesoffers",
      "salesorders",
      "salesdeliverynotes",
      "salesreceipts",
      "salesInvoiceFormTitle",
      "salesInvoiceOverdueReminderEmails"
    ],
    purpose:
      "Gestionar facturas emitidas, presupuestos, pedidos, albaranes, cobros y recordatorios.",
    primaryEntities: [
      "sales_invoices",
      "sales_invoice_lines",
      "sales_quotes",
      "sales_orders",
      "sales_delivery_notes",
      "sales_receipts",
      "customers",
      "payment_terms"
    ],
    quickActions: [
      "Crear facturas de venta",
      "Crear clientes",
      "Ver todas las facturas",
      "Preparar recordatorios",
      "Ver todos los presupuestos"
    ],
    lists: [
      "Facturas de venta vencidas",
      "Presupuestos pendientes",
      "Facturas recientes",
      "Cobros pendientes"
    ],
    forms: [
      "sales_invoice_form",
      "sales_quote_form",
      "sales_order_form",
      "sales_delivery_note_form",
      "sales_receipt_form"
    ],
    settings: ["sales_numbering", "payment_terms", "customer_defaults"],
    gfiscalStatus: "scaffolded",
    nextDataModel: [
      "sales_invoices",
      "sales_invoice_lines",
      "sales_quotes",
      "commercial_maturities",
      "payment_reminders"
    ]
  },
  {
    id: "purchases",
    label: "Compras",
    sageKeys: [
      "Active_Purchase",
      "purchases_invoices",
      "simplifiedPurchaseInvoiceTitlesDescriptionsAndErrors",
      "purchasecategories",
      "UploadPurchase",
      "GACPurchaseAutomation"
    ],
    purpose:
      "Gestionar facturas recibidas, proveedores, gastos, categorias de compra y automatizacion documental.",
    primaryEntities: [
      "purchase_invoices",
      "purchase_invoice_lines",
      "suppliers",
      "purchase_categories",
      "expenses",
      "documents",
      "document_files"
    ],
    quickActions: [
      "Subir facturas de compra",
      "Crear proveedores",
      "Importar compras o ventas",
      "Introducir gastos"
    ],
    lists: [
      "Facturas de compra pendientes",
      "Gastos recientes",
      "Documentos en automatizacion",
      "Proveedores activos"
    ],
    forms: [
      "purchase_invoice_form",
      "supplier_form",
      "expense_form",
      "purchase_category_form"
    ],
    settings: ["purchase_categories", "supplier_defaults", "purchase_email_inbox"],
    gfiscalStatus: "partially_connected",
    nextDataModel: [
      "purchase_invoices",
      "purchase_invoice_lines",
      "suppliers",
      "purchase_categories",
      "supplier_payment_maturities"
    ]
  },
  {
    id: "contacts",
    label: "Contactos",
    sageKeys: [
      "Active_ThirdParty",
      "customers",
      "suppliers",
      "thirdparty",
      "thirdpartyledger",
      "thirdparybalance"
    ],
    purpose:
      "Centralizar clientes, proveedores, terceros, direcciones, cuentas y saldos por contacto.",
    primaryEntities: [
      "customers",
      "suppliers",
      "third_parties",
      "contact_people",
      "addresses",
      "third_party_balances"
    ],
    quickActions: [
      "Crear clientes",
      "Crear proveedores",
      "Consultar mayor de tercero",
      "Ver saldos"
    ],
    lists: [
      "Clientes activos",
      "Proveedores activos",
      "Terceros recientes",
      "Saldos por tercero"
    ],
    forms: ["customer_form", "supplier_form", "third_party_form", "address_form"],
    settings: ["customer_defaults", "supplier_defaults", "contact_tax_defaults"],
    gfiscalStatus: "scaffolded",
    nextDataModel: [
      "customers_extended",
      "suppliers",
      "contact_people",
      "addresses",
      "third_party_balances"
    ]
  },
  {
    id: "products",
    label: "Productos y servicios",
    sageKeys: [
      "Active_Product",
      "productsandservices",
      "prices",
      "discounts",
      "producttypes",
      "specialpricesanddiscounts"
    ],
    purpose:
      "Mantener catalogo vendible, tipos de producto, servicios, precios, descuentos e impuestos.",
    primaryEntities: [
      "products_services",
      "product_types",
      "prices",
      "discounts",
      "tax_groups"
    ],
    quickActions: [
      "Crear producto",
      "Crear servicio",
      "Actualizar precios",
      "Configurar descuentos"
    ],
    lists: [
      "Productos y servicios",
      "Precios",
      "Descuentos",
      "Tipos de producto"
    ],
    forms: ["product_service_form", "price_form", "discount_form", "product_type_form"],
    settings: ["default_tax_group", "price_lists", "discount_rules"],
    gfiscalStatus: "scaffolded",
    nextDataModel: [
      "products_services",
      "product_prices",
      "discount_rules",
      "product_tax_defaults"
    ]
  },
  {
    id: "banks",
    label: "Bancos",
    sageKeys: [
      "Active_Bank",
      "banks",
      "bankTransactionReconciliation",
      "paymentmeans",
      "organizationbankingrules"
    ],
    purpose:
      "Gestionar cuentas bancarias, movimientos, reglas, medios de pago y conciliacion.",
    primaryEntities: [
      "bank_accounts",
      "bank_transactions",
      "bank_rules",
      "reconciliations",
      "payment_methods"
    ],
    quickActions: [
      "Importar extracto",
      "Conciliar movimientos",
      "Crear cuenta bancaria",
      "Configurar reglas"
    ],
    lists: [
      "Cuentas bancarias",
      "Movimientos pendientes",
      "Reglas bancarias",
      "Conciliaciones recientes"
    ],
    forms: ["bank_account_form", "bank_rule_form", "payment_method_form"],
    settings: ["banking_rules", "payment_methods", "online_payment_info"],
    gfiscalStatus: "scaffolded",
    nextDataModel: [
      "bank_accounts",
      "bank_transactions",
      "bank_reconciliations",
      "bank_rules"
    ]
  },
  {
    id: "accounting",
    label: "Contabilidad",
    sageKeys: [
      "Active_Accounting",
      "bookentries",
      "generalledger",
      "trialbalance",
      "balancesheet",
      "incomestatement",
      "journals",
      "accountlist",
      "monthlyclosing",
      "annualclosing",
      "fec"
    ],
    purpose:
      "Registrar asientos, consultar mayor, balances, cuentas, diarios, marcaje y cierres.",
    primaryEntities: [
      "accounting_entries",
      "accounting_entry_lines",
      "journals",
      "ledger_accounts",
      "matching_marks",
      "accounting_periods",
      "closing_runs"
    ],
    quickActions: [
      "Crear asientos",
      "Marcar apuntes",
      "Consultar libro mayor",
      "Lanzar cierre mensual"
    ],
    lists: [
      "Asientos recientes",
      "Libro mayor",
      "Balance de sumas y saldos",
      "Cierres"
    ],
    forms: [
      "book_entry_form",
      "journal_form",
      "ledger_account_form",
      "matching_form",
      "closing_form"
    ],
    settings: ["chart_of_accounts", "journals", "accounting_periods", "closing_rules"],
    gfiscalStatus: "scaffolded",
    nextDataModel: [
      "accounting_entries",
      "accounting_entry_lines",
      "ledger_accounts",
      "journals",
      "accounting_periods"
    ]
  },
  {
    id: "tax",
    label: "Declaraciones",
    sageKeys: [
      "Active_Tax",
      "Active_TaxDeclaration",
      "vattypes",
      "vat_returns",
      "legalobligations",
      "taxforms",
      "antifraud",
      "eInvoice",
      "eReporting",
      "eInvoicingAndeReporting",
      "verifactu"
    ],
    purpose:
      "Preparar impuestos, obligaciones legales, IVA, e-invoicing, e-reporting y trazabilidad normativa.",
    primaryEntities: [
      "tax_declarations",
      "vat_returns",
      "legal_obligations",
      "regulatory_events",
      "e_invoice_submissions",
      "verifactu_records"
    ],
    quickActions: [
      "Preparar declaracion",
      "Revisar IVA",
      "Ver obligaciones",
      "Consultar eventos VeriFactu"
    ],
    lists: [
      "Declaraciones pendientes",
      "Obligaciones legales",
      "Eventos regulatorios",
      "Envios electronicos"
    ],
    forms: ["tax_declaration_form", "vat_return_form", "legal_obligation_form"],
    settings: ["tax_authority_details", "vat_types", "verifactu_settings"],
    gfiscalStatus: "partially_connected",
    nextDataModel: [
      "tax_declarations",
      "vat_returns",
      "legal_obligations",
      "e_invoice_submissions",
      "verifactu_records"
    ]
  },
  {
    id: "reports",
    label: "Informes",
    sageKeys: [
      "Active_ReportAccounting",
      "reports",
      "financialReport",
      "reportdesigner",
      "balancesheet",
      "incomestatement",
      "trialbalance"
    ],
    purpose:
      "Exponer informes financieros, fiscales y operativos con ejecuciones y exportaciones.",
    primaryEntities: [
      "report_definitions",
      "report_runs",
      "report_exports",
      "report_favorites"
    ],
    quickActions: [
      "Ejecutar informe",
      "Exportar balance",
      "Guardar favorito",
      "Abrir disenador"
    ],
    lists: [
      "Informes financieros",
      "Informes fiscales",
      "Ejecuciones recientes",
      "Favoritos"
    ],
    forms: ["report_filter_form", "report_definition_form"],
    settings: ["report_templates", "export_formats"],
    gfiscalStatus: "scaffolded",
    nextDataModel: [
      "report_definitions",
      "report_runs",
      "report_exports",
      "report_favorites"
    ]
  },
  {
    id: "settings",
    label: "Configuracion",
    sageKeys: [
      "organization",
      "configuration",
      "organizationsalessetup",
      "counters",
      "paymenttermsandmeans",
      "taxAuthorityDetails"
    ],
    purpose:
      "Configurar organizacion, numeradores, condiciones de pago, medios de pago e impuestos.",
    primaryEntities: [
      "organization_settings",
      "numbering_sequences",
      "payment_terms",
      "email_templates",
      "tax_authority_profiles"
    ],
    quickActions: [
      "Editar organizacion",
      "Configurar numeradores",
      "Configurar pagos",
      "Configurar autoridad fiscal"
    ],
    lists: [
      "Numeradores",
      "Condiciones de pago",
      "Medios de pago",
      "Plantillas"
    ],
    forms: [
      "organization_settings_form",
      "numbering_sequence_form",
      "payment_term_form",
      "tax_authority_form"
    ],
    settings: [
      "organization_settings",
      "sales_setup",
      "payment_terms_and_means",
      "tax_authority_details"
    ],
    gfiscalStatus: "backlog",
    nextDataModel: [
      "organization_settings",
      "numbering_sequences",
      "payment_terms",
      "email_templates"
    ]
  },
  {
    id: "documents",
    label: "Documentos",
    sageKeys: [
      "fileManagement",
      "UploadPurchase",
      "GACPurchaseAutomation",
      "documentslayoutcopilotdetection"
    ],
    purpose:
      "Recibir, procesar y revisar documentos antes de convertirlos en datos fiscales o contables.",
    primaryEntities: [
      "documents",
      "document_files",
      "document_pages",
      "document_text_chunks",
      "processing_jobs",
      "document_extractions",
      "review_tasks"
    ],
    quickActions: [
      "Subir documentos",
      "Revisar extracciones",
      "Ver errores",
      "Planificar OCR"
    ],
    lists: [
      "Documentos recientes",
      "Tareas de revision",
      "Jobs en curso",
      "Documentos con OCR requerido"
    ],
    forms: ["document_upload_form", "review_task_form"],
    settings: ["document_storage", "ai_budget", "ocr_policy"],
    gfiscalStatus: "partially_connected",
    nextDataModel: [
      "document_inbox_filters",
      "document_error_events",
      "document_assignment_rules"
    ]
  },
  {
    id: "copilot",
    label: "Copilot Insights",
    sageKeys: [
      "Copilot",
      "Copilot Insights",
      "home.cards.insights",
      "creditControlTile",
      "ui_showCopilotFinanceAgent"
    ],
    purpose:
      "Mostrar recomendaciones, explicaciones y alertas contextuales generadas por IA con auditoria.",
    primaryEntities: [
      "ai_requests",
      "ai_responses",
      "ai_cost_events",
      "insight_cards",
      "recommendations"
    ],
    quickActions: [
      "Ver insights",
      "Explicar indicador",
      "Preparar recordatorio",
      "Revisar riesgo"
    ],
    lists: [
      "Insights activos",
      "Recomendaciones",
      "Alertas de cobro",
      "Coste IA"
    ],
    forms: ["insight_feedback_form"],
    settings: ["ai_budget", "insight_preferences"],
    gfiscalStatus: "backlog",
    nextDataModel: [
      "insight_cards",
      "recommendations",
      "ai_feedback",
      "ai_guardrails"
    ]
  }
];

export const sageActiveDataBacklog = [
  "sales_invoices",
  "sales_invoice_lines",
  "sales_quotes",
  "sales_orders",
  "sales_delivery_notes",
  "sales_receipts",
  "commercial_maturities",
  "payment_reminders",
  "purchase_invoices",
  "purchase_invoice_lines",
  "suppliers",
  "purchase_categories",
  "products_services",
  "product_prices",
  "discount_rules",
  "bank_accounts",
  "bank_transactions",
  "bank_reconciliations",
  "payment_terms",
  "numbering_sequences",
  "tax_declarations",
  "vat_returns",
  "legal_obligations",
  "report_definitions",
  "report_runs",
  "insight_cards"
] as const;

export function getSageReferenceModule(
  id: SageReferenceModuleId
): SageReferenceModule | null {
  return sageActiveModules.find((module) => module.id === id) ?? null;
}
