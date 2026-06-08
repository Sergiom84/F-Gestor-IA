"use client";

import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Copy,
  CreditCard,
  Eye,
  FileText,
  Filter,
  FileCog,
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
import {
  artificialSalesCustomers,
  artificialSalesDefaults,
  artificialSalesDocuments
} from "../../_data/artificial-business-data";
import type {
  ArtificialSalesDocumentRow,
  SalesSectionId
} from "../../_data/artificial-business-data";
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
  singularTitle: string;
  dateLabel: string;
  numberLabel: string;
};

type SalesDocumentRow = ArtificialSalesDocumentRow;

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
    title: "Presupuestos de venta",
    singularTitle: "Presupuesto de venta",
    dateLabel: "Fecha de presup...",
    numberLabel: "Numero de presupuesto"
  },
  {
    id: "orders",
    label: "Pedidos",
    title: "Pedidos de venta",
    singularTitle: "Pedido de venta",
    dateLabel: "Fecha de pedido",
    numberLabel: "Numero de pedido"
  },
  {
    id: "delivery-notes",
    label: "Albaranes",
    title: "Albaranes de venta",
    singularTitle: "Albaran de venta",
    dateLabel: "Fecha de albaran",
    numberLabel: "Numero de albaran"
  },
  {
    id: "invoices",
    label: "Facturas",
    title: "Facturas de venta",
    singularTitle: "Factura de venta",
    dateLabel: "Fecha de factura",
    numberLabel: "Numero de factura"
  },
  {
    id: "recurring-invoices",
    label: "Facturas recurrentes",
    title: "Facturas recurrentes",
    singularTitle: "Factura recurrente",
    dateLabel: "Fecha de factura",
    numberLabel: "Numero de factura"
  }
];

const salesSectionIds = new Set<SalesSectionId>(salesSections.map((section) => section.id));

function resolveSalesSectionId(value: string | null): SalesSectionId | null {
  return value && salesSectionIds.has(value as SalesSectionId) ? value as SalesSectionId : null;
}

type SalesWorkspaceProps = {
  organizationName: string;
  initialDocuments?: Record<SalesSectionId, SalesDocumentRow[]>;
};

export function SalesWorkspace({ organizationName, initialDocuments }: SalesWorkspaceProps) {
  const searchParams = useSearchParams();
  const sectionFromUrl = resolveSalesSectionId(searchParams.get("salesSection"));
  const [activeSectionId, setActiveSectionId] = useState<SalesSectionId>(sectionFromUrl ?? "quotes");
  const [documentsBySection, setDocumentsBySection] = useState<Record<SalesSectionId, SalesDocumentRow[]>>(initialDocuments ?? artificialSalesDocuments);
  const [showSectionNav, setShowSectionNav] = useState(sectionFromUrl === null);
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
      setShowSectionNav(false);
    } else {
      setShowSectionNav(true);
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
    setShowSectionNav(false);
    window.history.pushState(null, "", `/dashboard?${nextParams.toString()}`);
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
    <section className={`sales-module-shell${showSectionNav ? "" : " sections-collapsed"}`} aria-label="Modulo de ventas">
      {showSectionNav ? (
        <aside className="sales-secondary-nav" aria-label="Documentos de ventas">
          {salesSections.map((section) => (
            <button
              className={`sales-secondary-link${section.id === activeSectionId ? " active" : ""}`}
              key={section.id}
              onClick={() => openSection(section.id)}
              type="button"
            >
              <span>{section.label}</span>
            </button>
          ))}
        </aside>
      ) : null}

      <div className="sales-operation-surface">
        {isCreating ? (
          <QuoteForm section={activeSection} onCancel={() => setIsCreating(false)} />
        ) : (
          <DocumentList
            activeSection={activeSection}
            organizationName={organizationName}
            rows={rows}
            query={query}
            showColumns={showColumns}
            showFilters={showFilters}
            showSettings={showSettings}
            activeSettingsPanel={activeSettingsPanel}
            notice={notice}
            onCreate={() => setIsCreating(true)}
            onDeleteDocument={deleteDocument}
            onDuplicateDocument={duplicateDocument}
            onQueryChange={setQuery}
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
  activeSettingsPanel,
  notice,
  organizationName,
  rows,
  query,
  showColumns,
  showFilters,
  showSettings,
  onCreate,
  onDeleteDocument,
  onDuplicateDocument,
  onQueryChange,
  onSettingsPanelChange,
  onShowNotice,
  onToggleColumns,
  onToggleFilters,
  onToggleSettings,
  onUpdateDocumentStatus
}: {
  activeSection: SalesSection;
  activeSettingsPanel: SalesSettingsPanelId | null;
  notice: SalesNotice | null;
  organizationName: string;
  rows: SalesDocumentRow[];
  query: string;
  showColumns: boolean;
  showFilters: boolean;
  showSettings: boolean;
  onCreate: () => void;
  onDeleteDocument: (rowId: string) => void;
  onDuplicateDocument: (row: SalesDocumentRow) => void;
  onQueryChange: (value: string) => void;
  onSettingsPanelChange: (panel: SalesSettingsPanelId | null) => void;
  onShowNotice: (notice: SalesNotice | null) => void;
  onToggleColumns: () => void;
  onToggleFilters: () => void;
  onToggleSettings: () => void;
  onUpdateDocumentStatus: (rowId: string, status: string) => void;
}) {
  const [selectedRow, setSelectedRow] = useState<SalesDocumentRow | null>(null);
  const [rowPendingDelete, setRowPendingDelete] = useState<SalesDocumentRow | null>(null);
  const [showInsights, setShowInsights] = useState(false);
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
          <h1>{activeSection.title}</h1>
          <button
            className="insights-pill sales-insights-pill"
            onClick={() => {
              setShowInsights((current) => !current);
              onSettingsPanelChange(null);
            }}
            type="button"
          >
            <Sparkles aria-hidden="true" size={18} fill="currentColor" />
            Copilot Insights
          </button>
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

      {showInsights ? (
        <SalesInsightsPanel activeSection={activeSection} rows={rows} />
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

      <div className="sales-list-toolbar">
        <button className="sage-primary-button" onClick={onCreate} type="button">
          <Plus aria-hidden="true" size={22} />
          Crear
        </button>
        <div className="sales-toolbar-actions">
          <label className="sales-search-control">
            <Search aria-hidden="true" size={25} />
            <input
              aria-label={`Buscar en ${activeSection.title}`}
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
          {["Estado", "Fecha", activeSection.numberLabel, "Referencia", "Cliente", "Total"].map((column) => (
            <label key={column}>
              <input defaultChecked type="checkbox" />
              {column}
            </label>
          ))}
        </div>
      ) : null}

      <section className="sage-list-panel" aria-label={activeSection.title}>
        <div className="sales-document-table-wrap">
          <table className="sales-document-table">
            <thead>
              <tr>
                <th>Estado</th>
                <th>{activeSection.dateLabel}</th>
                <th>{activeSection.numberLabel}</th>
                <th>Referencia</th>
                <th>Codigo de cliente</th>
                <th>Cliente</th>
                <th>Total</th>
                <th>Editar</th>
                <th>Eliminar</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? rows.map((row) => (
                <tr key={row.id}>
                  <td><span className="closed-badge">{row.status}</span></td>
                  <td>{row.date}</td>
                  <td>{row.number}</td>
                  <td>{row.reference || "-"}</td>
                  <td>{row.clientCode}</td>
                  <td>{row.client}</td>
                  <td>{formatMoney(row.total)}</td>
                  <td>
                    <button
                      className="sage-table-button"
                      onClick={() => {
                        setSelectedRow(row);
                        setRowPendingDelete(null);
                        onSettingsPanelChange(null);
                      }}
                      type="button"
                      aria-label={`Editar ${row.number}`}
                    >
                      <PenLine aria-hidden="true" size={25} fill="currentColor" />
                    </button>
                  </td>
                  <td>
                    <button
                      className="sage-table-button danger"
                      onClick={() => {
                        setRowPendingDelete(row);
                        setSelectedRow(null);
                        onSettingsPanelChange(null);
                      }}
                      type="button"
                      aria-label={`Eliminar ${row.number}`}
                    >
                      <Trash2 aria-hidden="true" size={25} fill="currentColor" />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={9}>
                    <div className="sales-empty-list">
                      <FileText aria-hidden="true" size={64} />
                      <strong>Esta lista esta en blanco.</strong>
                      <p>No hay documentos para los filtros actuales.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
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

function SalesInsightsPanel({
  activeSection,
  rows
}: {
  activeSection: SalesSection;
  rows: SalesDocumentRow[];
}) {
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const topClient = rows[0]?.client ?? "Sin cliente destacado";

  return (
    <section className="sales-action-panel insights-panel" aria-label="Insights de ventas">
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

function QuoteForm({ section, onCancel }: { section: SalesSection; onCancel: () => void }) {
  const [activeTab, setActiveTab] = useState<QuoteFormTab>("products");
  const [client, setClient] = useState("");
  const [reference, setReference] = useState("");
  const [quoteDate, setQuoteDate] = useState(artificialSalesDefaults.quoteDate);
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [customMessage, setCustomMessage] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const subtotal = lines.reduce((total, line) => {
    const rawLineTotal = line.quantity * line.unitPrice;
    const discountAmount = rawLineTotal * (line.discount / 100);

    return total + rawLineTotal - discountAmount;
  }, 0);
  const clientDiscount = subtotal * (discountPercent / 100);
  const taxableBase = Math.max(subtotal - clientDiscount, 0);
  const taxTotal = taxableBase * 0.21;
  const total = taxableBase + taxTotal;
  const canCreate = client.trim().length > 0 && lines.length > 0;

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

  const updateLine = (id: number, patch: Partial<QuoteLine>) => {
    setLines((current) => current.map((line) => (
      line.id === id ? { ...line, ...patch } : line
    )));
  };

  const removeLine = (id: number) => {
    setLines((current) => current.filter((line) => line.id !== id));
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
            <select value={client} onChange={(event) => setClient(event.target.value)}>
              <option value="">Seleccionar...</option>
              {artificialSalesCustomers.map((customer) => (
                <option key={customer} value={customer}>{customer}</option>
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
            <input type="email" />
          </label>
          <label className="sage-field span-2">
            <span>Telefono</span>
            <input />
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
          <ProductsTab lines={lines} onAddLine={addLine} onRemoveLine={removeLine} onUpdateLine={updateLine} />
        ) : null}
        {activeTab === "totals" ? (
          <TotalsTab
            clientDiscount={clientDiscount}
            discountPercent={discountPercent}
            productDiscount={subtotal - lines.reduce((totalLine, line) => totalLine + line.quantity * line.unitPrice, 0)}
            subtotal={subtotal}
            taxableBase={taxableBase}
            onDiscountPercentChange={setDiscountPercent}
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
        {activeTab === "client" ? <ClientInfoTab /> : null}
      </section>

      <QuoteStickyBar canCreate={canCreate} taxableBase={taxableBase} taxTotal={taxTotal} total={total} onCancel={onCancel} />
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
  onRemoveLine,
  onUpdateLine
}: {
  lines: QuoteLine[];
  onAddLine: () => void;
  onRemoveLine: (id: number) => void;
  onUpdateLine: (id: number, patch: Partial<QuoteLine>) => void;
}) {
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
                  <button className="sage-table-button" type="button" aria-label="Mas acciones">
                    <MoreVertical aria-hidden="true" size={22} />
                  </button>
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
  subtotal,
  taxableBase,
  onDiscountPercentChange
}: {
  clientDiscount: number;
  discountPercent: number;
  productDiscount: number;
  subtotal: number;
  taxableBase: number;
  onDiscountPercentChange: (value: number) => void;
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

function ClientInfoTab() {
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
  taxableBase,
  taxTotal,
  total,
  onCancel
}: {
  canCreate: boolean;
  taxableBase: number;
  taxTotal: number;
  total: number;
  onCancel: () => void;
}) {
  return (
    <footer className="quote-sticky-bar">
      <SummaryBox label="Total base imponible" value={taxableBase} />
      <SummaryBox label="Total IVA" value={taxTotal} />
      <SummaryBox label="Total" value={total} />
      <button className="quote-cancel-action" onClick={onCancel} type="button">Cancelar</button>
      <button className="quote-create-action" disabled={!canCreate} type="button">
        Crear
      </button>
      <button className="quote-create-more" disabled={!canCreate} type="button" aria-label="Mas opciones de creacion">
        <ChevronDown aria-hidden="true" size={18} />
      </button>
    </footer>
  );
}
