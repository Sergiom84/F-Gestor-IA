"use client";

import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Copy,
  CreditCard,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  FileCog,
  BarChart3,
  ListChecks,
  Mail,
  MoreVertical,
  PackageSearch,
  PenLine,
  Plus,
  Search,
  Settings,
  Sparkles,
  Trash2,
  X
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createSalesInvoice } from "../../commercial-actions";
import { artificialSalesDefaults, artificialSalesDocuments } from "../../_data/artificial-business-data";
import type { ArtificialContactListItem, SalesSectionId } from "../../_data/artificial-business-data";
import type { SalesDocRow } from "../../_lib/types";
import { formatMoney } from "../../_lib/formatters";

type QuoteFormTab = "products" | "totals" | "notes" | "client";
type SalesSettingsPanelId = "numbering" | "payments" | "preferences";
type SalesNotice = {
  tone: "success" | "warning";
  text: string;
};

type SalesSection = {
  id: SalesSectionId;
  label: string;
  title: string;
  createLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  searchLabel: string;
  singularTitle: string;
  dateLabel: string;
  numberLabel: string;
  tableHeaders: {
    date: string;
    number: string;
    client: string;
    clientCode: string;
    total: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    description: string;
    actions: Array<{
      kind: "create" | "contacts" | "quotes" | "orders" | "delivery-notes" | "invoices" | "recurring-invoices";
      label: string;
    }>;
  };
  metrics: Array<{
    label: string;
    description: string;
    tone: "teal" | "indigo" | "green";
    type: "count" | "amount";
    fallbackValue?: number;
  }>;
  tableDescription: string;
  fallbackItemCount?: number;
};

type SalesDocumentRow = {
  id: string;
  status: string;
  date: string;
  number: string;
  reference: string;
  clientCode: string;
  client: string;
  total: number;
};

type QuoteLine = {
  id: number;
  product: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
};

const salesSections: SalesSection[] = [
  {
    id: "quotes",
    label: "Presupuestos",
    title: "Presupuestos",
    createLabel: "Crear presupuesto",
    emptyTitle: "No hay presupuestos.",
    emptyDescription: "Crea un presupuesto o ajusta los filtros para ver resultados.",
    searchLabel: "Buscar presupuestos",
    singularTitle: "Presupuesto de venta",
    dateLabel: "Fecha de presup...",
    numberLabel: "Numero de presupuesto",
    tableHeaders: {
      date: "Fecha de presupuesto",
      number: "Numero de presupuesto",
      client: "Cliente",
      clientCode: "Codigo",
      total: "Total"
    },
    hero: {
      eyebrow: "",
      title: "Presupuestos",
      description: "",
      actions: [
        { kind: "create", label: "Crear presupuesto" },
        { kind: "contacts", label: "Crear cliente" },
        { kind: "orders", label: "Convertir a pedido" }
      ]
    },
    metrics: [
      { label: "Presupuestos", description: "", tone: "indigo", type: "count" },
      { label: "Pendientes", description: "", tone: "teal", type: "count" },
      { label: "Importe ofertado", description: "", tone: "green", type: "amount" }
    ],
    tableDescription: ""
  },
  {
    id: "orders",
    label: "Pedidos",
    title: "Pedidos",
    createLabel: "Crear pedido",
    emptyTitle: "No hay pedidos.",
    emptyDescription: "Crea un pedido o revisa los filtros aplicados.",
    searchLabel: "Buscar pedidos",
    singularTitle: "Pedido de venta",
    dateLabel: "Fecha de pedido",
    numberLabel: "Numero de pedido",
    tableHeaders: {
      date: "Fecha de pedido",
      number: "Numero de pedido",
      client: "Cliente",
      clientCode: "Codigo",
      total: "Total"
    },
    hero: {
      eyebrow: "",
      title: "Pedidos",
      description: "",
      actions: [
        { kind: "create", label: "Crear pedido" },
        { kind: "contacts", label: "Crear cliente" },
        { kind: "delivery-notes", label: "Preparar albaran" }
      ]
    },
    metrics: [
      { label: "Pedidos", description: "", tone: "teal", type: "count" },
      { label: "Pendientes", description: "", tone: "indigo", type: "count" },
      { label: "Importe pedido", description: "", tone: "green", type: "amount" }
    ],
    tableDescription: ""
  },
  {
    id: "delivery-notes",
    label: "Albaranes",
    title: "Albaranes",
    createLabel: "Crear albaran",
    emptyTitle: "No hay albaranes.",
    emptyDescription: "Crea un albaran o cambia los filtros para consultar entregas.",
    searchLabel: "Buscar albaranes",
    singularTitle: "Albaran de venta",
    dateLabel: "Fecha de albaran",
    numberLabel: "Numero de albaran",
    tableHeaders: {
      date: "Fecha de albaran",
      number: "Numero de albaran",
      client: "Cliente",
      clientCode: "Codigo",
      total: "Total"
    },
    hero: {
      eyebrow: "",
      title: "Albaranes",
      description: "",
      actions: [
        { kind: "create", label: "Crear albaran" },
        { kind: "contacts", label: "Crear cliente" },
        { kind: "invoices", label: "Facturar entregas" }
      ]
    },
    metrics: [
      { label: "Albaranes", description: "", tone: "teal", type: "count" },
      { label: "Sin facturar", description: "", tone: "indigo", type: "count" },
      { label: "Importe entregado", description: "", tone: "green", type: "amount" }
    ],
    tableDescription: ""
  },
  {
    id: "invoices",
    label: "Facturas",
    title: "Facturas",
    createLabel: "Crear factura",
    emptyTitle: "No hay facturas.",
    emptyDescription: "Crea una factura o ajusta los filtros para revisar ventas.",
    searchLabel: "Buscar facturas",
    singularTitle: "Factura de venta",
    dateLabel: "Fecha de factura",
    numberLabel: "Numero de factura",
    tableHeaders: {
      date: "Fecha de factura",
      number: "Numero de factura",
      client: "Cliente",
      clientCode: "Codigo",
      total: "Total"
    },
    hero: {
      eyebrow: "",
      title: "Ventas",
      description: "",
      actions: [
        { kind: "create", label: "Crear factura de venta" },
        { kind: "contacts", label: "Crear cliente" },
        { kind: "recurring-invoices", label: "Preparar recordatorio" }
      ]
    },
    metrics: [
      { label: "Facturas de venta", description: "", tone: "teal", type: "count", fallbackValue: 13 },
      { label: "Presupuestos", description: "", tone: "indigo", type: "count", fallbackValue: 4 },
      { label: "Cobros", description: "", tone: "green", type: "amount", fallbackValue: 46004.88 }
    ],
    tableDescription: "",
    fallbackItemCount: 13
  },
  {
    id: "recurring-invoices",
    label: "Facturas recurrentes",
    title: "Facturas recurrentes",
    createLabel: "Crear recurrente",
    emptyTitle: "No hay facturas recurrentes.",
    emptyDescription: "Crea una factura recurrente o revisa los filtros actuales.",
    searchLabel: "Buscar facturas recurrentes",
    singularTitle: "Factura recurrente",
    dateLabel: "Fecha de factura",
    numberLabel: "Numero de factura",
    tableHeaders: {
      date: "Proxima emision",
      number: "Numero de plantilla",
      client: "Cliente",
      clientCode: "Codigo",
      total: "Importe recurrente"
    },
    hero: {
      eyebrow: "",
      title: "Facturas recurrentes",
      description: "",
      actions: [
        { kind: "create", label: "Crear recurrente" },
        { kind: "contacts", label: "Crear cliente" },
        { kind: "invoices", label: "Planificar emision" }
      ]
    },
    metrics: [
      { label: "Recurrentes", description: "", tone: "teal", type: "count" },
      { label: "Proximas", description: "", tone: "indigo", type: "count" },
      { label: "Importe recurrente", description: "", tone: "green", type: "amount" }
    ],
    tableDescription: ""
  }
];

const fallbackSalesDocuments: Record<SalesSectionId, SalesDocumentRow[]> = {
  quotes: [
    { id: "quote-0013", status: "Pendiente", date: "30/05/2026", number: "0013", reference: "REF-013", clientCode: "47", client: "INTERVENCIONES ORIENTADAS SL", total: 18856.11 },
    { id: "quote-0012", status: "Pendiente", date: "25/05/2026", number: "0012", reference: "REF-012", clientCode: "24", client: "SANSANO OIL SERVICE SL", total: 1294.70 },
    { id: "quote-0011", status: "Borrador", date: "25/05/2026", number: "0011", reference: "REF-011", clientCode: "26", client: "FENIX DISTRIBUCIONES SL", total: -1452.00 }
  ],
  orders: [
    { id: "order-0021", status: "Confirmado", date: "31/05/2026", number: "0021", reference: "PED-021", clientCode: "47", client: "INTERVENCIONES ORIENTADAS SL", total: 7450.00 },
    { id: "order-0020", status: "Preparacion", date: "28/05/2026", number: "0020", reference: "PED-020", clientCode: "18", client: "TALLERES NORTE SL", total: 2380.40 },
    { id: "order-0019", status: "Pendiente", date: "24/05/2026", number: "0019", reference: "PED-019", clientCode: "33", client: "GRUPO ALMAZARA SL", total: 980.00 }
  ],
  "delivery-notes": [
    { id: "delivery-009", status: "Entregado", date: "30/05/2026", number: "0009", reference: "ALB-009", clientCode: "47", client: "INTERVENCIONES ORIENTADAS SL", total: 4210.25 },
    { id: "delivery-008", status: "Pendiente", date: "27/05/2026", number: "0008", reference: "ALB-008", clientCode: "24", client: "SANSANO OIL SERVICE SL", total: 1680.90 },
    { id: "delivery-007", status: "Facturable", date: "21/05/2026", number: "0007", reference: "ALB-007", clientCode: "26", client: "FENIX DISTRIBUCIONES SL", total: 950.00 }
  ],
  invoices: [
    { id: "invoice-0013", status: "Vencida", date: "30/05/2026", number: "0013", reference: "FAC-013", clientCode: "47", client: "INTERVENCIONES ORIENTADAS SL", total: 18856.11 },
    { id: "invoice-0012", status: "Vencida", date: "25/05/2026", number: "0012", reference: "FAC-012", clientCode: "24", client: "SANSANO OIL SERVICE SL", total: 1294.70 },
    { id: "invoice-0011", status: "Vencida", date: "25/05/2026", number: "0011", reference: "FAC-011", clientCode: "26", client: "FENIX DISTRIBUCIONES SL", total: -1452.00 }
  ],
  "recurring-invoices": [
    { id: "recurring-006", status: "Activa", date: "01/06/2026", number: "R-0006", reference: "REC-006", clientCode: "47", client: "INTERVENCIONES ORIENTADAS SL", total: 1200.00 },
    { id: "recurring-005", status: "Activa", date: "05/06/2026", number: "R-0005", reference: "REC-005", clientCode: "24", client: "SANSANO OIL SERVICE SL", total: 850.00 },
    { id: "recurring-004", status: "Pausada", date: "10/06/2026", number: "R-0004", reference: "REC-004", clientCode: "26", client: "FENIX DISTRIBUCIONES SL", total: 640.00 }
  ]
};

function normalizeSalesDocuments(initialDocuments?: Record<SalesSectionId, SalesDocumentRow[]>): Record<SalesSectionId, SalesDocumentRow[]> {
  const source = initialDocuments ?? artificialSalesDocuments;
  const hasRows = Object.values(source).some((rows) => rows.length > 0);

  return hasRows ? source : fallbackSalesDocuments;
}

const salesSectionIds = new Set<SalesSectionId>(salesSections.map((section) => section.id));

function resolveSalesSectionId(value: string | null): SalesSectionId | null {
  return value && salesSectionIds.has(value as SalesSectionId) ? value as SalesSectionId : null;
}

type SalesWorkspaceProps = {
  clients: ArtificialContactListItem[];
  fiscalEntities: Array<{ id: string; name: string }>;
  organizationId: string;
  organizationName: string;
  initialDocuments?: Record<SalesSectionId, SalesDocumentRow[]>;
};

export function SalesWorkspace({ clients, fiscalEntities, organizationId, organizationName, initialDocuments }: SalesWorkspaceProps) {
  const searchParams = useSearchParams();
  const sectionFromUrl = resolveSalesSectionId(searchParams.get("salesSection"));
  const [activeSectionId, setActiveSectionId] = useState<SalesSectionId>(sectionFromUrl ?? "invoices");
  const isFallbackData = !Object.values(initialDocuments ?? artificialSalesDocuments).some((rows) => rows.length > 0);
  const [documentsBySection, setDocumentsBySection] = useState<Record<SalesSectionId, SalesDocumentRow[]>>(() => normalizeSalesDocuments(initialDocuments));
  const [isCreating, setIsCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [activeSettingsPanel, setActiveSettingsPanel] = useState<SalesSettingsPanelId | null>(null);
  const [notice, setNotice] = useState<SalesNotice | null>(null);
  const activeSection = salesSections.find((section) => section.id === activeSectionId) ?? salesSections[0]!;

  useEffect(() => {
    if (sectionFromUrl) {
      setActiveSectionId(sectionFromUrl);
    }
  }, [sectionFromUrl]);

  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return documentsBySection[activeSectionId];
    }

    return documentsBySection[activeSectionId].filter((row) => (
      row.status.toLowerCase().includes(normalizedQuery)
      || row.date.toLowerCase().includes(normalizedQuery)
      || row.number.toLowerCase().includes(normalizedQuery)
      || row.reference.toLowerCase().includes(normalizedQuery)
      || row.clientCode.toLowerCase().includes(normalizedQuery)
      || row.client.toLowerCase().includes(normalizedQuery)
    ));
  }, [activeSectionId, documentsBySection, query]);

  const openSection = (sectionId: SalesSectionId) => {
    const nextParams = new URLSearchParams(searchParams.toString());

    nextParams.set("module", "sales");
    nextParams.set("salesSection", sectionId);
    setActiveSectionId(sectionId);
    setIsCreating(false);
    setQuery("");
    setShowFilters(false);
    setShowColumns(false);
    setActiveSettingsPanel(null);
    window.history.pushState(null, "", `/dashboard?${nextParams.toString()}`);
  };

  const openContacts = () => {
    const nextParams = new URLSearchParams(searchParams.toString());

    nextParams.set("module", "contacts");
    nextParams.delete("salesSection");
    window.history.pushState(null, "", `/dashboard?${nextParams.toString()}`);
    window.location.assign(`/dashboard?${nextParams.toString()}`);
  };

  const deleteDocument = (rowId: string) => {
    setDocumentsBySection((current) => ({
      ...current,
      [activeSectionId]: current[activeSectionId].filter((row) => row.id !== rowId)
    }));
    setNotice({ tone: "warning", text: `${activeSection.singularTitle} ${rowId.split("-").at(-1)} eliminado de la vista.` });
  };

  const duplicateDocument = (row: SalesDocumentRow) => {
    const copyNumber = `${row.number}-C`;
    const copy: SalesDocumentRow = {
      ...row,
      id: `${row.id}-copy-${Date.now()}`,
      number: copyNumber,
      reference: row.reference ? `${row.reference} copia` : "Copia",
      status: "Borrador"
    };

    setDocumentsBySection((current) => ({
      ...current,
      [activeSectionId]: [copy, ...current[activeSectionId]]
    }));
    setNotice({ tone: "success", text: `Duplicado creado como ${copyNumber}.` });
  };

  const updateDocumentStatus = (rowId: string, status: string) => {
    setDocumentsBySection((current) => ({
      ...current,
      [activeSectionId]: current[activeSectionId].map((row) => (
        row.id === rowId ? { ...row, status } : row
      ))
    }));
    setNotice({ tone: "success", text: `Estado actualizado a ${status}.` });
  };

  return (
    <section className="sales-module-shell sections-collapsed" aria-label="Modulo de ventas">
      <div className="sales-operation-surface">
        {isCreating ? (
          <QuoteForm
            clients={clients}
            fiscalEntities={fiscalEntities}
            organizationId={organizationId}
            section={activeSection}
            onCancel={() => setIsCreating(false)}
            onCreated={(invoice) => {
              setDocumentsBySection((current) => ({
                ...current,
                [activeSectionId]: [invoice, ...current[activeSectionId]]
              }));
              setIsCreating(false);
              setNotice({ tone: "success", text: `Factura ${invoice.number} creada.` });
            }}
            onPersistenceError={(message) => {
              setNotice({ tone: "warning", text: `Factura creada en la vista, pero no se pudo guardar: ${message}` });
            }}
          />
        ) : (
          <DocumentList
            activeSection={activeSection}
            activeSectionId={activeSectionId}
            isFallbackData={isFallbackData}
            organizationName={organizationName}
            rows={rows}
            sections={salesSections}
            query={query}
            showColumns={showColumns}
            showFilters={showFilters}
            showSettings={showSettings}
            activeSettingsPanel={activeSettingsPanel}
            notice={notice}
            onHeroAction={(kind) => {
              if (kind === "create") {
                setIsCreating(true);
                return;
              }

              if (kind === "contacts") {
                openContacts();
                return;
              }

              openSection(kind);
            }}
            onDeleteDocument={deleteDocument}
            onDuplicateDocument={duplicateDocument}
            onQueryChange={setQuery}
            onSectionChange={openSection}
            onShowNotice={setNotice}
            onSettingsPanelChange={setActiveSettingsPanel}
            onToggleColumns={() => setShowColumns((current) => !current)}
            onToggleFilters={() => setShowFilters((current) => !current)}
            onToggleSettings={() => setShowSettings((current) => !current)}
            onUpdateDocumentStatus={updateDocumentStatus}
          />
        )}
      </div>
    </section>
  );
}

function DocumentList({
  activeSection,
  activeSectionId,
  isFallbackData,
  activeSettingsPanel,
  notice,
  organizationName,
  rows,
  sections,
  query,
  showColumns,
  showFilters,
  showSettings,
  onHeroAction,
  onDeleteDocument,
  onDuplicateDocument,
  onQueryChange,
  onSectionChange,
  onSettingsPanelChange,
  onShowNotice,
  onToggleColumns,
  onToggleFilters,
  onToggleSettings,
  onUpdateDocumentStatus
}: {
  activeSection: SalesSection;
  activeSectionId: SalesSectionId;
  isFallbackData: boolean;
  activeSettingsPanel: SalesSettingsPanelId | null;
  notice: SalesNotice | null;
  organizationName: string;
  rows: SalesDocumentRow[];
  sections: SalesSection[];
  query: string;
  showColumns: boolean;
  showFilters: boolean;
  showSettings: boolean;
  onHeroAction: (kind: SalesSection["hero"]["actions"][number]["kind"]) => void;
  onDeleteDocument: (rowId: string) => void;
  onDuplicateDocument: (row: SalesDocumentRow) => void;
  onQueryChange: (value: string) => void;
  onSectionChange: (sectionId: SalesSectionId) => void;
  onSettingsPanelChange: (panel: SalesSettingsPanelId | null) => void;
  onShowNotice: (notice: SalesNotice | null) => void;
  onToggleColumns: () => void;
  onToggleFilters: () => void;
  onToggleSettings: () => void;
  onUpdateDocumentStatus: (rowId: string, status: string) => void;
}) {
  const [selectedRow, setSelectedRow] = useState<SalesDocumentRow | null>(null);
  const [rowPendingDelete, setRowPendingDelete] = useState<SalesDocumentRow | null>(null);
  const [showAssistant, setShowAssistant] = useState(false);
  const totalAmount = rows.reduce((sum, row) => sum + row.total, 0);
  const openSettingsPanel = (panel: SalesSettingsPanelId) => {
    onSettingsPanelChange(panel);
    setSelectedRow(null);
    setRowPendingDelete(null);
    onToggleSettings();
  };

  return (
    <>
      <header className="sales-operation-header">
        <div className="sales-operation-title">
          <SalesSectionTabs
            activeSectionId={activeSectionId}
            onSectionChange={onSectionChange}
            sections={sections}
          />
        </div>
        <div className="sales-settings-menu">
          <button className="sales-settings-button" onClick={onToggleSettings} type="button">
            <Settings aria-hidden="true" size={27} fill="currentColor" />
            <span>Configuracion</span>
            <ChevronDown aria-hidden="true" size={15} />
          </button>
          {showSettings ? (
            <div className="sales-popover settings-popover" role="menu">
              <button onClick={() => openSettingsPanel("numbering")} type="button">
                <FileCog aria-hidden="true" size={18} />
                Numeracion de ventas
              </button>
              <button onClick={() => openSettingsPanel("payments")} type="button">
                <CreditCard aria-hidden="true" size={18} />
                Condiciones de pago
              </button>
              <button onClick={() => openSettingsPanel("preferences")} type="button">
                <Mail aria-hidden="true" size={18} />
                Preferencias de {organizationName}
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {notice ? (
        <div className={`sales-live-notice ${notice.tone}`} role="status">
          {notice.tone === "success" ? <CheckCircle2 aria-hidden="true" size={18} /> : <AlertTriangle aria-hidden="true" size={18} />}
          <span>{notice.text}</span>
          <button onClick={() => onShowNotice(null)} type="button" aria-label="Cerrar aviso">
            <X aria-hidden="true" size={16} />
          </button>
        </div>
      ) : null}

      {showAssistant ? (
        <SalesAssistantPanel activeSection={activeSection} rows={rows} />
      ) : null}

      {activeSettingsPanel ? (
        <SalesSettingsPanel
          activePanel={activeSettingsPanel}
          activeSection={activeSection}
          organizationName={organizationName}
          onClose={() => onSettingsPanelChange(null)}
          onSave={(message) => {
            onSettingsPanelChange(null);
            onShowNotice({ tone: "success", text: message });
          }}
        />
      ) : null}

      <SalesHero activeSection={activeSection} onAction={onHeroAction} />
      <SalesMetricGrid activeSection={activeSection} isFallbackData={isFallbackData} rows={rows} totalAmount={totalAmount} />

      <div className="sales-list-toolbar">
        <span aria-hidden="true" />
        <div className="sales-toolbar-actions">
          <label className="sales-search-control">
            <Search aria-hidden="true" size={25} />
            <input
              aria-label={activeSection.searchLabel}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Buscar..."
              type="search"
              value={query}
            />
          </label>
          <button className="sage-outline-button" onClick={onToggleFilters} type="button">
            <Filter aria-hidden="true" size={20} fill="currentColor" />
            Filtrar
          </button>
          <button className="sage-outline-button" onClick={onToggleColumns} type="button">
            Personalizar
            <ChevronDown aria-hidden="true" size={15} />
          </button>
        </div>
      </div>

      {showFilters ? (
        <div className="sales-filter-strip">
          <span>Filtros activos</span>
          <button type="button">Estado: todos</button>
          <button type="button">Fecha: ejercicio actual</button>
          <button type="button">Cliente: todos</button>
        </div>
      ) : null}

      {showColumns ? (
        <div className="sales-filter-strip columns-strip">
          <span>Columnas visibles</span>
          {[
            "Estado",
            activeSection.tableHeaders.date,
            activeSection.tableHeaders.number,
            activeSection.tableHeaders.client,
            activeSection.tableHeaders.clientCode,
            activeSection.tableHeaders.total
          ].map((column) => (
            <label key={column}>
              <input defaultChecked type="checkbox" />
              {column}
            </label>
          ))}
        </div>
      ) : null}

      <section className="sage-list-panel sales-template-table-panel" aria-label={activeSection.title}>
        <div className="sales-template-table-head">
          <div>
            <h2>{activeSection.title}</h2>
            {activeSection.tableDescription ? <p>{activeSection.tableDescription}</p> : null}
          </div>
        </div>
        <div className="sales-document-table-wrap">
          <table className="sales-document-table">
            <thead>
              <tr>
                <th>Estado</th>
                <th>{activeSection.tableHeaders.date}</th>
                <th>{activeSection.tableHeaders.number}</th>
                <th>{activeSection.tableHeaders.client}</th>
                <th>{activeSection.tableHeaders.clientCode}</th>
                <th>{activeSection.tableHeaders.total}</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? rows.map((row) => (
                <tr key={row.id}>
                  <td><span className="closed-badge">{row.status}</span></td>
                  <td>{row.date}</td>
                  <td>{row.number}</td>
                  <td>{row.client}</td>
                  <td>{row.clientCode}</td>
                  <td>{formatMoney(row.total)}</td>
                  <td className="sales-row-actions-cell">
                    <button
                      className="sage-table-button"
                      onClick={() => {
                        setSelectedRow(row);
                        setRowPendingDelete(null);
                        onSettingsPanelChange(null);
                      }}
                      type="button"
                      aria-label={`Abrir acciones de ${row.number}`}
                    >
                      <MoreVertical aria-hidden="true" size={22} />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7}>
                    <div className="sales-empty-list">
                      <FileText aria-hidden="true" size={64} />
                      <strong>{activeSection.emptyTitle}</strong>
                      <p>{activeSection.emptyDescription}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={7}>Elementos: {isFallbackData && activeSection.fallbackItemCount ? activeSection.fallbackItemCount : rows.length}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {selectedRow ? (
        <SalesDocumentPanel
          activeSection={activeSection}
          row={selectedRow}
          onClose={() => setSelectedRow(null)}
          onDuplicate={() => {
            onDuplicateDocument(selectedRow);
            setSelectedRow(null);
          }}
          onSave={() => {
            onUpdateDocumentStatus(selectedRow.id, "Revisado");
            setSelectedRow(null);
          }}
        />
      ) : null}

      {rowPendingDelete ? (
        <DeleteDocumentPanel
          activeSection={activeSection}
          row={rowPendingDelete}
          onCancel={() => setRowPendingDelete(null)}
          onConfirm={() => {
            onDeleteDocument(rowPendingDelete.id);
            setRowPendingDelete(null);
          }}
        />
      ) : null}
    </>
  );
}

function SalesHero({
  activeSection,
  onAction
}: {
  activeSection: SalesSection;
  onAction: (kind: SalesSection["hero"]["actions"][number]["kind"]) => void;
}) {
  return (
    <section className="sales-template-hero" aria-label={activeSection.title}>
      <div>
        {activeSection.hero.eyebrow ? <span>{activeSection.hero.eyebrow}</span> : null}
        <h1>{activeSection.hero.title}</h1>
        {activeSection.hero.description ? <p>{activeSection.hero.description}</p> : null}
      </div>
      <div className="sales-template-hero-actions">
        {activeSection.hero.actions.map((action) => (
          <button key={action.label} onClick={() => onAction(action.kind)} type="button">{action.label}</button>
        ))}
      </div>
    </section>
  );
}

function SalesMetricGrid({
  activeSection,
  isFallbackData,
  rows,
  totalAmount
}: {
  activeSection: SalesSection;
  isFallbackData: boolean;
  rows: SalesDocumentRow[];
  totalAmount: number;
}) {
  const count = rows.length;
  const pendingCount = rows.filter((row) => /pendiente|vencida|preparacion|borrador|facturable/i.test(row.status)).length;
  const values = activeSection.metrics.map((metric, index) => ({
    ...metric,
    value: metric.type === "amount"
      ? formatMoney(isFallbackData && metric.fallbackValue !== undefined ? metric.fallbackValue : totalAmount)
      : String(isFallbackData && metric.fallbackValue !== undefined ? metric.fallbackValue : index === 1 ? pendingCount : count)
  }));

  return (
    <section className="sales-template-metrics" aria-label={`Resumen de ${activeSection.label.toLowerCase()}`}>
      {values.map((metric) => (
        <article className="sales-template-metric" key={metric.label}>
          <span className={`sales-template-metric-icon ${metric.tone}`}>
            <BarChart3 aria-hidden="true" size={20} strokeWidth={2.3} />
          </span>
          <strong>{metric.value}</strong>
          <h2>{metric.label}</h2>
          {metric.description ? <p>{metric.description}</p> : null}
        </article>
      ))}
    </section>
  );
}

function SalesSectionTabs({
  activeSectionId,
  onSectionChange,
  sections
}: {
  activeSectionId: SalesSectionId;
  onSectionChange: (sectionId: SalesSectionId) => void;
  sections: SalesSection[];
}) {
  return (
    <div className="fiscal-tabs sales-section-tabs" role="tablist" aria-label="Subsecciones de ventas">
      {sections.map((section) => (
        <button
          className={`tab${section.id === activeSectionId ? " active" : ""}`}
          key={section.id}
          onClick={() => onSectionChange(section.id)}
          role="tab"
          type="button"
        >
          {section.label}
        </button>
      ))}
    </div>
  );
}

function SalesAssistantPanel({
  activeSection,
  rows
}: {
  activeSection: SalesSection;
  rows: SalesDocumentRow[];
}) {
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const topClient = rows[0]?.client ?? "Sin cliente destacado";

  return (
    <section className="sales-action-panel insights-panel" aria-label="Asistente de ventas">
      <div>
        <Sparkles aria-hidden="true" size={22} fill="currentColor" />
        <h2>Resumen inteligente de {activeSection.label.toLowerCase()}</h2>
      </div>
      <p>
        Hay {rows.length} documento{rows.length === 1 ? "" : "s"} en la vista por {formatMoney(total)}.
        Cliente con mas actividad: {topClient}.
      </p>
      <div className="sales-action-grid">
        <span>Proxima accion</span>
        <strong>{rows.length > 0 ? "Revisar vencimiento y preparar envio" : "Crear el primer documento de la seccion"}</strong>
      </div>
    </section>
  );
}

function SalesSettingsPanel({
  activePanel,
  activeSection,
  organizationName,
  onClose,
  onSave
}: {
  activePanel: SalesSettingsPanelId;
  activeSection: SalesSection;
  organizationName: string;
  onClose: () => void;
  onSave: (message: string) => void;
}) {
  const panelTitle = {
    numbering: "Numeracion de ventas",
    payments: "Condiciones de pago",
    preferences: `Preferencias de ${organizationName}`
  }[activePanel];

  return (
    <section className="sales-action-panel settings-detail-panel" aria-label={panelTitle}>
      <header>
        <div>
          {activePanel === "numbering" ? <FileCog aria-hidden="true" size={22} /> : null}
          {activePanel === "payments" ? <CreditCard aria-hidden="true" size={22} /> : null}
          {activePanel === "preferences" ? <Mail aria-hidden="true" size={22} /> : null}
          <h2>{panelTitle}</h2>
        </div>
        <button className="panel-icon-button" onClick={onClose} type="button" aria-label="Cerrar panel">
          <X aria-hidden="true" size={18} />
        </button>
      </header>

      {activePanel === "numbering" ? (
        <div className="settings-panel-grid">
          <label className="sage-field">
            <span>Serie activa</span>
            <select defaultValue={activeSection.id.toUpperCase()}>
              <option>{activeSection.id.toUpperCase()}</option>
              <option>VENTA-2026</option>
              <option>RECT-2026</option>
            </select>
          </label>
          <label className="sage-field">
            <span>Siguiente numero</span>
            <input defaultValue={artificialSalesDefaults.nextNumber} />
          </label>
          <label className="sage-field">
            <span>Formato visible</span>
            <input defaultValue={`${activeSection.label.slice(0, 3).toUpperCase()}-2026-${artificialSalesDefaults.nextNumber}`} />
          </label>
          <label className="sage-field">
            <span>Reinicio</span>
            <select defaultValue="Anual">
              <option>Anual</option>
              <option>Mensual</option>
              <option>Nunca</option>
            </select>
          </label>
        </div>
      ) : null}

      {activePanel === "payments" ? (
        <div className="settings-panel-grid">
          <label className="sage-field">
            <span>Condicion por defecto</span>
            <select defaultValue="30 dias">
              <option>Contado</option>
              <option>15 dias</option>
              <option>30 dias</option>
              <option>60 dias</option>
            </select>
          </label>
          <label className="sage-field">
            <span>Metodo preferido</span>
            <select defaultValue="Transferencia">
              <option>Transferencia</option>
              <option>Domiciliacion</option>
              <option>Tarjeta</option>
            </select>
          </label>
          <label className="sage-field">
            <span>Cuenta bancaria</span>
            <input defaultValue="ES** **** **** **** 4210" />
          </label>
          <label className="sage-field">
            <span>Recordatorio</span>
            <select defaultValue="3 dias antes">
              <option>Sin recordatorio</option>
              <option>3 dias antes</option>
              <option>En vencimiento</option>
            </select>
          </label>
        </div>
      ) : null}

      {activePanel === "preferences" ? (
        <div className="settings-panel-grid">
          <label className="sage-field">
            <span>Email de envio</span>
            <input defaultValue={artificialSalesDefaults.settingsEmail} type="email" />
          </label>
          <label className="sage-field">
            <span>Plantilla PDF</span>
            <select defaultValue="Profesional">
              <option>Profesional</option>
              <option>Compacta</option>
              <option>Detallada</option>
            </select>
          </label>
          <label className="sage-field span-2">
            <span>Mensaje por defecto</span>
            <input defaultValue={`Adjuntamos ${activeSection.singularTitle.toLowerCase()} para su revision.`} />
          </label>
        </div>
      ) : null}

      <footer>
        <button className="sage-outline-button" onClick={onClose} type="button">Cancelar</button>
        <button className="sage-primary-button" onClick={() => onSave(`${panelTitle} guardado para ${activeSection.label}.`)} type="button">
          Guardar cambios
        </button>
      </footer>
    </section>
  );
}

function SalesDocumentPanel({
  activeSection,
  row,
  onClose,
  onDuplicate,
  onSave
}: {
  activeSection: SalesSection;
  row: SalesDocumentRow;
  onClose: () => void;
  onDuplicate: () => void;
  onSave: () => void;
}) {
  return (
    <section className="sales-action-panel document-detail-panel" aria-label={`Editar ${row.number}`}>
      <header>
        <div>
          <PenLine aria-hidden="true" size={22} />
          <h2>{activeSection.singularTitle} {row.number}</h2>
        </div>
        <button className="panel-icon-button" onClick={onClose} type="button" aria-label="Cerrar edicion">
          <X aria-hidden="true" size={18} />
        </button>
      </header>

      <div className="document-detail-grid">
        <label className="sage-field">
          <span>Estado</span>
          <select defaultValue={row.status}>
            <option>Borrador</option>
            <option>Pendiente</option>
            <option>Preparado</option>
            <option>Revisado</option>
            <option>Cerrado</option>
            <option>Emitida</option>
          </select>
        </label>
        <label className="sage-field">
          <span>Fecha</span>
          <input defaultValue={row.date} />
        </label>
        <label className="sage-field">
          <span>Cliente</span>
          <input defaultValue={row.client} />
        </label>
        <label className="sage-field">
          <span>Total</span>
          <input defaultValue={formatMoney(row.total)} />
        </label>
      </div>

      <div className="document-action-strip">
        <button className="sage-outline-button" onClick={onDuplicate} type="button">
          <Copy aria-hidden="true" size={18} />
          Duplicar
        </button>
        <button className="sage-outline-button" type="button">
          <Eye aria-hidden="true" size={18} />
          Vista previa
        </button>
        <button className="sage-primary-button" onClick={onSave} type="button">
          Guardar revision
        </button>
      </div>
    </section>
  );
}

function DeleteDocumentPanel({
  activeSection,
  row,
  onCancel,
  onConfirm
}: {
  activeSection: SalesSection;
  row: SalesDocumentRow;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <section className="sales-action-panel delete-panel" aria-label={`Eliminar ${row.number}`}>
      <header>
        <div>
          <AlertTriangle aria-hidden="true" size={22} />
          <h2>Eliminar {activeSection.singularTitle.toLowerCase()} {row.number}</h2>
        </div>
      </header>
      <p>Se quitara de la lista local de trabajo. En produccion esta accion deberia pedir confirmacion persistente.</p>
      <footer>
        <button className="sage-outline-button" onClick={onCancel} type="button">Cancelar</button>
        <button className="sage-danger-button" onClick={onConfirm} type="button">Eliminar</button>
      </footer>
    </section>
  );
}

function QuoteForm({
  clients,
  fiscalEntities,
  organizationId,
  section,
  onCancel,
  onCreated,
  onPersistenceError
}: {
  clients: ArtificialContactListItem[];
  fiscalEntities: Array<{ id: string; name: string }>;
  organizationId: string;
  section: SalesSection;
  onCancel: () => void;
  onCreated: (invoice: SalesDocumentRow) => void;
  onPersistenceError: (message: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<QuoteFormTab>("products");
  const [clientId, setClientId] = useState("");
  const [client, setClient] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [reference, setReference] = useState("");
  const [quoteDate, setQuoteDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [retentionRate, setRetentionRate] = useState(15);
  const [suplidoAmount, setSuplidoAmount] = useState(0);
  const [pdfTemplate, setPdfTemplate] = useState("standard");
  const [customMessage, setCustomMessage] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const subtotal = lines.reduce((total, line) => {
    const rawLineTotal = line.quantity * line.unitPrice;
    const discountAmount = rawLineTotal * (line.discount / 100);

    return total + rawLineTotal - discountAmount;
  }, 0);
  const clientDiscount = subtotal * (discountPercent / 100);
  const taxableBase = Math.max(subtotal - clientDiscount, 0);
  const taxTotal = taxableBase * 0.21;
  const retentionTotal = taxableBase * (retentionRate / 100);
  const total = taxableBase + taxTotal - retentionTotal + suplidoAmount;
  const canCreate = client.trim().length > 0 && lines.length > 0 && !isSaving;

  const selectClient = (nextClientId: string) => {
    setClientId(nextClientId);
    const selectedClient = clients.find((item) => item.id === nextClientId);

    if (!selectedClient) {
      return;
    }

    setClient(selectedClient.name);
    setClientEmail(selectedClient.contactEmail ?? "");
    if (selectedClient.applyIrpfByDefault) {
      setRetentionRate(selectedClient.defaultIrpfRate ?? 15);
    }
  };

  const addLine = () => {
    setLines((current) => [
      ...current,
      {
        id: Date.now(),
        product: "",
        description: "",
        quantity: 1,
        unitPrice: 0,
        discount: 0
      }
    ]);
  };

  const duplicateLine = (line: QuoteLine) => {
    setLines((current) => [
      ...current,
      {
        ...line,
        id: Date.now()
      }
    ]);
  };

  const updateLine = (id: number, patch: Partial<QuoteLine>) => {
    setLines((current) => current.map((line) => (
      line.id === id ? { ...line, ...patch } : line
    )));
  };

  const removeLine = (id: number) => {
    setLines((current) => current.filter((line) => line.id !== id));
  };

  const submitInvoice = async () => {
    const formData = new FormData();

    const invoiceNumber = `VENTA-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Date.now().toString().slice(-5)}`;

    formData.set("organization_id", organizationId);
    formData.set("client_id", clientId);
    formData.set("client_name", client);
    formData.set("client_email", clientEmail);
    formData.set("client_phone", clientPhone);
    formData.set("invoice_number", invoiceNumber);
    formData.set("reference", reference);
    formData.set("issue_date", quoteDate);
    formData.set("retention_rate", String(retentionRate));
    formData.set("suplido_amount", String(suplidoAmount));
    formData.set("pdf_template", pdfTemplate);
    formData.set("notes", [customMessage, internalNotes].filter(Boolean).join("\n\n"));
    formData.set("lines_json", JSON.stringify(lines));

    setSubmitError(null);
    setIsSaving(true);

    onCreated({
      id: `invoice-pending-${Date.now()}`,
      status: "Borrador",
      date: new Date(quoteDate).toLocaleDateString("es-ES"),
      number: invoiceNumber,
      reference,
      clientCode: clients.find((item) => item.id === clientId)?.code ?? "",
      client,
      total
    });

    void createSalesInvoice(formData).then((result) => {
      if (result.error || !result.invoice) {
        onPersistenceError(result.error ?? "No se pudo crear la factura.");
      }
    });
  };

  return (
    <section className="quote-form-screen" aria-label={section.singularTitle}>
      <header className="quote-form-heading">
        <h1>{section.singularTitle}</h1>
        <button className="quote-close-button" onClick={onCancel} type="button" aria-label="Cerrar formulario">
          <X aria-hidden="true" size={34} />
        </button>
      </header>

      <section className="quote-main-card" aria-label="Datos generales">
        <div className="quote-top-grid">
          <label className="sage-field">
            <span>Cliente</span>
            <select value={clientId} onChange={(event) => selectClient(event.target.value)}>
              <option value="">Seleccionar...</option>
              {clients.map((clientOption) => (
                <option key={clientOption.id} value={clientOption.id}>{clientOption.name}</option>
              ))}
            </select>
          </label>
          <label className="sage-field">
            <span>Prefijo</span>
            <select defaultValue="N/A">
              <option>N/A</option>
              <option>VENTA</option>
              <option>2026</option>
            </select>
          </label>
          <label className="sage-field">
            <span>Plantilla PDF</span>
            <select value={pdfTemplate} onChange={(event) => setPdfTemplate(event.target.value)}>
              <option value="standard">Factura estandar</option>
              <option value="tablamax">TABLAMAX con impuestos y suplido</option>
            </select>
          </label>
          <label className="sage-field">
            <span>Referencia</span>
            <input value={reference} onChange={(event) => setReference(event.target.value)} />
          </label>
          <label className="sage-field compact-date">
            <span>{section.dateLabel.replace("...", "uesto")} *</span>
            <span className="date-input-shell">
              <input value={quoteDate} onChange={(event) => setQuoteDate(event.target.value)} type="date" />
              <CalendarDays aria-hidden="true" size={24} fill="currentColor" />
            </span>
          </label>
        </div>

        <div className="quote-contact-grid">
          <label className="sage-field">
            <span>Razon social o nombre</span>
            <input value={client} onChange={(event) => setClient(event.target.value)} />
          </label>
          <label className="sage-field">
            <span>Nombre</span>
            <input />
          </label>
          <label className="sage-field">
            <span>E-mail</span>
            <input onChange={(event) => setClientEmail(event.target.value)} type="email" value={clientEmail} />
          </label>
          <label className="sage-field span-2">
            <span>Telefono</span>
            <input onChange={(event) => setClientPhone(event.target.value)} value={clientPhone} />
          </label>
          <label className="sage-field span-2">
            <span>Pais *</span>
            <select defaultValue="ES - ES">
              <option>ES - ES</option>
              <option>PT - PT</option>
              <option>FR - FR</option>
            </select>
          </label>
        </div>
      </section>

      <div className="quote-tabs" role="tablist" aria-label="Secciones del presupuesto">
        <QuoteTab activeTab={activeTab} id="products" label="Productos y servicios" onSelect={setActiveTab} />
        <QuoteTab activeTab={activeTab} id="totals" label="Totales y descuentos" onSelect={setActiveTab} />
        <QuoteTab activeTab={activeTab} id="notes" label="Notas" onSelect={setActiveTab} />
        <QuoteTab activeTab={activeTab} id="client" label="Informacion de cliente" onSelect={setActiveTab} />
      </div>

      <section className="quote-tab-panel">
        {activeTab === "products" ? (
          <ProductsTab
            lines={lines}
            onAddLine={addLine}
            onDuplicateLine={duplicateLine}
            onRemoveLine={removeLine}
            onUpdateLine={updateLine}
          />
        ) : null}
        {activeTab === "totals" ? (
          <TotalsTab
            clientDiscount={clientDiscount}
            discountPercent={discountPercent}
            productDiscount={subtotal - lines.reduce((totalLine, line) => totalLine + line.quantity * line.unitPrice, 0)}
            subtotal={subtotal}
            taxableBase={taxableBase}
            retentionRate={retentionRate}
            retentionTotal={retentionTotal}
            suplidoAmount={suplidoAmount}
            onDiscountPercentChange={setDiscountPercent}
            onRetentionRateChange={setRetentionRate}
            onSuplidoAmountChange={setSuplidoAmount}
          />
        ) : null}
        {activeTab === "notes" ? (
          <NotesTab
            customMessage={customMessage}
            internalNotes={internalNotes}
            onCustomMessageChange={setCustomMessage}
            onInternalNotesChange={setInternalNotes}
          />
        ) : null}
        {activeTab === "client" ? <ClientInfoTab pdfTemplate={pdfTemplate} onPdfTemplateChange={setPdfTemplate} /> : null}
      </section>

      {submitError ? <div className="sales-live-notice warning" role="alert">{submitError}</div> : null}
      <QuoteStickyBar
        canCreate={canCreate}
        isPending={isSaving}
        taxableBase={taxableBase}
        taxTotal={taxTotal}
        retentionTotal={retentionTotal}
        suplidoAmount={suplidoAmount}
        total={total}
        onCancel={onCancel}
        onCreate={submitInvoice}
      />
    </section>
  );
}

function QuoteTab({
  activeTab,
  id,
  label,
  onSelect
}: {
  activeTab: QuoteFormTab;
  id: QuoteFormTab;
  label: string;
  onSelect: (tab: QuoteFormTab) => void;
}) {
  return (
    <button
      aria-selected={activeTab === id}
      className={`quote-tab${activeTab === id ? " active" : ""}`}
      onClick={() => onSelect(id)}
      role="tab"
      type="button"
    >
      {label}
    </button>
  );
}

function ProductsTab({
  lines,
  onAddLine,
  onDuplicateLine,
  onRemoveLine,
  onUpdateLine
}: {
  lines: QuoteLine[];
  onAddLine: () => void;
  onDuplicateLine: (line: QuoteLine) => void;
  onRemoveLine: (id: number) => void;
  onUpdateLine: (id: number, patch: Partial<QuoteLine>) => void;
}) {
  const [lineMenuId, setLineMenuId] = useState<number | null>(null);

  const runLineAction = (action: () => void) => {
    action();
    setLineMenuId(null);
  };

  return (
    <div className="quote-products-panel">
      <button className="sage-primary-button" onClick={onAddLine} type="button">
        <Plus aria-hidden="true" size={23} />
        Anadir
      </button>

      <div className="quote-lines-wrap">
        <table className="quote-lines-table">
          <thead>
            <tr>
              <th aria-label="Seleccion" />
              <th>Producto o servicio</th>
              <th>Descripcion</th>
              <th>Cantidad</th>
              <th>Precio unita...</th>
              <th>Descuento</th>
              <th>Eliminar</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {lines.length > 0 ? lines.map((line) => (
              <tr key={line.id}>
                <td><PackageSearch aria-hidden="true" size={20} /></td>
                <td>
                  <input
                    aria-label="Producto o servicio"
                    onChange={(event) => onUpdateLine(line.id, { product: event.target.value })}
                    value={line.product}
                  />
                </td>
                <td>
                  <input
                    aria-label="Descripcion"
                    onChange={(event) => onUpdateLine(line.id, { description: event.target.value })}
                    value={line.description}
                  />
                </td>
                <td>
                  <input
                    aria-label="Cantidad"
                    min="0"
                    onChange={(event) => onUpdateLine(line.id, { quantity: Number(event.target.value) })}
                    type="number"
                    value={line.quantity}
                  />
                </td>
                <td>
                  <input
                    aria-label="Precio unitario"
                    min="0"
                    onChange={(event) => onUpdateLine(line.id, { unitPrice: Number(event.target.value) })}
                    type="number"
                    value={line.unitPrice}
                  />
                </td>
                <td>
                  <input
                    aria-label="Descuento"
                    min="0"
                    max="100"
                    onChange={(event) => onUpdateLine(line.id, { discount: Number(event.target.value) })}
                    type="number"
                    value={line.discount}
                  />
                </td>
                <td>
                  <button className="sage-table-button danger" onClick={() => onRemoveLine(line.id)} type="button">
                    <Trash2 aria-hidden="true" size={22} fill="currentColor" />
                  </button>
                </td>
                <td>
                  <div className="quote-line-actions">
                    <button
                      aria-expanded={lineMenuId === line.id}
                      className="sage-table-button"
                      onClick={() => setLineMenuId((current) => current === line.id ? null : line.id)}
                      type="button"
                      aria-label="Mas acciones"
                    >
                      <MoreVertical aria-hidden="true" size={22} />
                    </button>
                    {lineMenuId === line.id ? (
                      <div className="sales-popover quote-line-popover" role="menu">
                        <button onClick={() => runLineAction(() => onDuplicateLine(line))} type="button">Duplicar linea</button>
                        <button onClick={() => runLineAction(() => onUpdateLine(line.id, { discount: 0 }))} type="button">Quitar descuento</button>
                        <button onClick={() => runLineAction(() => onRemoveLine(line.id))} type="button">Eliminar linea</button>
                      </div>
                    ) : null}
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={8}>
                  <div className="quote-line-empty">
                    <ListChecks aria-hidden="true" size={42} />
                    <span>Anade productos o servicios para activar la creacion.</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TotalsTab({
  clientDiscount,
  discountPercent,
  productDiscount,
  retentionRate,
  retentionTotal,
  subtotal,
  suplidoAmount,
  taxableBase,
  onDiscountPercentChange,
  onRetentionRateChange,
  onSuplidoAmountChange
}: {
  clientDiscount: number;
  discountPercent: number;
  productDiscount: number;
  retentionRate: number;
  retentionTotal: number;
  subtotal: number;
  suplidoAmount: number;
  taxableBase: number;
  onDiscountPercentChange: (value: number) => void;
  onRetentionRateChange: (value: number) => void;
  onSuplidoAmountChange: (value: number) => void;
}) {
  return (
    <div className="totals-panel">
      <SummaryBox label="Total sin descuento de producto" value={subtotal} />
      <SummaryBox label="Descuento total de producto" value={Math.abs(productDiscount)} />
      <SummaryBox label="Total sin descuento de cliente" value={subtotal} />
      <label className="sage-field discount-field">
        <span>% descuento a cliente</span>
        <input
          onChange={(event) => onDiscountPercentChange(Number(event.target.value))}
          type="number"
          value={discountPercent}
        />
      </label>
      <SummaryBox label="Descuento de cliente" value={clientDiscount} />
      <SummaryBox label="Total base imponible" value={taxableBase} />
      <label className="sage-field discount-field">
        <span>IRPF / retencion %</span>
        <input
          max="100"
          min="0"
          onChange={(event) => onRetentionRateChange(Number(event.target.value))}
          type="number"
          value={retentionRate}
        />
      </label>
      <SummaryBox label="Retencion IRPF" value={-retentionTotal} />
      <label className="sage-field discount-field">
        <span>Suplido</span>
        <input
          min="0"
          onChange={(event) => onSuplidoAmountChange(Number(event.target.value))}
          type="number"
          value={suplidoAmount}
        />
      </label>
    </div>
  );
}

function SummaryBox({ label, value }: { label: string; value: number }) {
  return (
    <article className="quote-summary-box">
      <strong>{formatMoney(value)}</strong>
      <span>{label}</span>
    </article>
  );
}

function NotesTab({
  customMessage,
  internalNotes,
  onCustomMessageChange,
  onInternalNotesChange
}: {
  customMessage: string;
  internalNotes: string;
  onCustomMessageChange: (value: string) => void;
  onInternalNotesChange: (value: string) => void;
}) {
  return (
    <div className="notes-panel">
      <label className="sage-textarea-field">
        <span>Mensaje personalizado</span>
        <small>Anade un mensaje personalizado a la version en PDF del presupuesto.</small>
        <textarea maxLength={500} onChange={(event) => onCustomMessageChange(event.target.value)} value={customMessage} />
        <em>Quedan {500 - customMessage.length} caracteres.</em>
      </label>
      <label className="sage-textarea-field">
        <span>Notas</span>
        <small>Anade notas a este presupuesto. No se muestran al cliente.</small>
        <textarea maxLength={1000} onChange={(event) => onInternalNotesChange(event.target.value)} value={internalNotes} />
        <em>Quedan {1000 - internalNotes.length} caracteres.</em>
      </label>
    </div>
  );
}

function ClientInfoTab({
  pdfTemplate,
  onPdfTemplateChange
}: {
  pdfTemplate: string;
  onPdfTemplateChange: (value: string) => void;
}) {
  return (
    <div className="client-info-panel">
      <section>
        <h2>Informacion de empresa</h2>
        <label className="sage-field">
          <span>Codigo de cliente</span>
          <input disabled />
        </label>
        <label className="sage-field">
          <span>Tipo de identificacion</span>
          <input disabled defaultValue="NIF/DNI/NIE" />
        </label>
        <label className="sage-field">
          <span>Numero de identificacion</span>
          <input />
        </label>
        <label className="sage-field">
          <span>NIF-IVA</span>
          <input />
        </label>
        <label className="sage-field">
          <span>Idioma</span>
          <small>Se aplica a los titulos de las secciones y a las cabeceras de las columnas de los PDF de los documentos de venta.</small>
          <select defaultValue="">
            <option value="">Seleccionar...</option>
            <option>Espanol</option>
            <option>Portugues</option>
          </select>
        </label>

        <h2>Informacion de precios y descuentos</h2>
        <label className="sage-field">
          <span>Codigo de tarifa</span>
          <select defaultValue="">
            <option value="">Seleccionar...</option>
            <option>GENERAL</option>
          </select>
        </label>
        <label className="sage-field">
          <span>Nombre de tarifa</span>
          <input disabled />
        </label>
        <label className="sage-field">
          <span>Codigo de grupo de descuentos</span>
          <select defaultValue="">
            <option value="">Seleccionar...</option>
            <option>MAYORISTA</option>
          </select>
        </label>
        <label className="sage-field">
          <span>Nombre de grupo de descuentos</span>
          <input disabled />
        </label>
        <div className="sage-toggle-row">
          <span>Recargo de equivalencia</span>
          <button type="button">OFF</button>
        </div>
        <label className="sage-field">
          <span>Plantilla PDF</span>
          <select value={pdfTemplate} onChange={(event) => onPdfTemplateChange(event.target.value)}>
            <option value="standard">Factura estandar</option>
            <option value="tablamax">TABLAMAX con impuestos y suplido</option>
          </select>
        </label>
      </section>

      <section>
        <h2>Direccion e informacion de contacto</h2>
        <label className="sage-field">
          <span>Tipo de e-mail</span>
          <input disabled defaultValue="Personalizado" />
        </label>
        <label className="sage-field">
          <span>E-mail de factura</span>
          <input type="email" />
        </label>
        <AddressBox title="Direccion de entrega" />
        <AddressBox title="Direccion de facturacion" />
      </section>
    </div>
  );
}

function AddressBox({ title }: { title: string }) {
  return (
    <div className="address-box">
      <span>{title}</span>
      <div className="address-box-body" />
      <div className="address-box-actions">
        <button type="button">
          <PenLine aria-hidden="true" size={22} fill="currentColor" />
          Editar
        </button>
        <button type="button">Cambiar</button>
      </div>
    </div>
  );
}

function QuoteStickyBar({
  canCreate,
  isPending,
  onCancel,
  onCreate,
  retentionTotal,
  suplidoAmount,
  taxableBase,
  taxTotal,
  total
}: {
  canCreate: boolean;
  isPending: boolean;
  onCancel: () => void;
  onCreate: () => void;
  retentionTotal: number;
  suplidoAmount: number;
  taxableBase: number;
  taxTotal: number;
  total: number;
}) {
  return (
    <footer className="quote-sticky-bar">
      <SummaryBox label="Total base imponible" value={taxableBase} />
      <SummaryBox label="Total IVA" value={taxTotal} />
      <SummaryBox label="Retencion IRPF" value={-retentionTotal} />
      <SummaryBox label="Suplido" value={suplidoAmount} />
      <SummaryBox label="Total" value={total} />
      <button className="quote-cancel-action" onClick={onCancel} type="button">Cancelar</button>
      <button className="quote-create-action" disabled={!canCreate} onClick={onCreate} type="button">
        {isPending ? "Creando..." : "Crear"}
      </button>
      <button className="quote-create-more" disabled={!canCreate} type="button" aria-label="Mas opciones de creacion">
        <ChevronDown aria-hidden="true" size={18} />
      </button>
    </footer>
  );
}

