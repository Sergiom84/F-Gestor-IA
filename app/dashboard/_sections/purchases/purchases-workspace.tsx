"use client";

import {
  AlertTriangle,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  Cpu,
  FileText,
  Filter,
  FolderOpen,
  Mail,
  PenLine,
  Plus,
  Search,
  Sparkles,
  UploadCloud,
  X
} from "lucide-react";
import type { ReactNode } from "react";
import { useTransition, useMemo, useRef, useState } from "react";
import { markPurchaseInvoicePaid, softDeletePurchaseInvoice } from "../../commercial-actions";
import { artificialPurchaseRows } from "../../_data/artificial-business-data";
import type {
  ArtificialPurchaseInvoiceRow,
  ArtificialPurchaseTabId
} from "../../_data/artificial-business-data";
import { formatMoney } from "../../_lib/formatters";
import type { PurchaseDocRow } from "../../_lib/types";

type PurchaseTabId = ArtificialPurchaseTabId;
type PurchaseInvoiceRow = ArtificialPurchaseInvoiceRow;
type PurchaseNotice = { tone: "success" | "warning"; text: string };
type PurchaseInvoiceFormValues = {
  description: string;
  invoiceDate: string;
  invoiceNumber: string;
  supplier: string;
  total: string;
};

const purchaseTabs: Array<{ id: PurchaseTabId; label: string }> = [
  { id: "all", label: "Todas" },
  { id: "review", label: "Por revisar" },
  { id: "pay", label: "Por pagar" },
  { id: "paid", label: "Pagadas" }
];

type PurchasesWorkspaceProps = {
  organizationName: string;
  initialInvoices?: PurchaseInvoiceRow[];
};

export function PurchasesWorkspace({ organizationName, initialInvoices }: PurchasesWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<PurchaseTabId>("all");
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [showEmailPanel, setShowEmailPanel] = useState(true);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [invoices, setInvoices] = useState<PurchaseInvoiceRow[]>(initialInvoices ?? artificialPurchaseRows);
  const [showAssistant, setShowAssistant] = useState(false);
  const [showEmailAddress, setShowEmailAddress] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedRow, setSelectedRow] = useState<PurchaseInvoiceRow | null>(null);
  const [notice, setNotice] = useState<PurchaseNotice | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  const rows = useMemo(() => {
    const byTab = activeTab === "all"
      ? invoices
      : invoices.filter((row) => row.tab === activeTab);
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return byTab;
    }

    return byTab.filter((row) => (
      row.importDate.toLowerCase().includes(normalizedQuery)
      || row.fileName.toLowerCase().includes(normalizedQuery)
      || row.status.toLowerCase().includes(normalizedQuery)
      || row.description.toLowerCase().includes(normalizedQuery)
      || row.supplier.toLowerCase().includes(normalizedQuery)
      || row.invoiceDate.toLowerCase().includes(normalizedQuery)
      || row.invoiceNumber.toLowerCase().includes(normalizedQuery)
    ));
  }, [activeTab, invoices, query]);

  const addManualInvoice = () => {
    setActiveTab("review");
    setQuery("");
    setShowCreateForm(true);
  };

  const createManualInvoice = (values: PurchaseInvoiceFormValues) => {
    const totalValue = parseSpanishAmount(values.total);
    const invoice: PurchaseInvoiceRow = {
      id: `manual-${Date.now()}`,
      importDate: new Date().toLocaleDateString("es-ES"),
      fileName: "Alta manual",
      status: "Pendiente",
      tab: "review",
      description: values.description.trim() || "Factura creada manualmente",
      supplier: values.supplier.trim(),
      invoiceDate: values.invoiceDate ? formatDateForDisplay(values.invoiceDate) : "",
      invoiceNumber: values.invoiceNumber.trim(),
      total: totalValue
    };

    setInvoices((current) => [invoice, ...current]);
    setActiveTab("review");
    setQuery("");
    setShowCreateForm(false);
    setNotice({ tone: "success", text: "Factura de compra creada." });
  };

  const registerFiles = (files: FileList | null) => {
    if (!files?.length) {
      return;
    }

    setUploadedFiles(Array.from(files).map((file) => file.name));
    setActiveTab("review");
  };

  const markAsPaid = (rowId: string) => {
    setInvoices((current) => current.map((row) =>
      row.id === rowId ? { ...row, status: "Pagada" as const, tab: "paid" as const } : row
    ));
    setNotice({ tone: "success", text: "Factura marcada como pagada." });
    setSelectedRow(null);
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(rowId)) {
      startTransition(() => { void markPurchaseInvoicePaid(rowId); });
    }
  };

  const deleteInvoice = (rowId: string) => {
    setInvoices((current) => current.filter((r) => r.id !== rowId));
    setNotice({ tone: "warning", text: "Factura eliminada." });
    if (selectedRow?.id === rowId) {
      setSelectedRow(null);
    }
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(rowId)) {
      startTransition(() => { void softDeletePurchaseInvoice(rowId); });
    }
  };

  return (
    <section className="purchases-workspace" aria-label="Facturas de compra">
      <header className="purchases-header">
        <div>
          <div className="sales-operation-title">
            <h1>Facturas de compra</h1>
            <button
              className="insights-pill sales-insights-pill"
              onClick={() => {
                setShowAssistant((current) => !current);
                setShowEmailAddress(false);
              }}
              type="button"
            >
              <Sparkles aria-hidden="true" size={18} fill="currentColor" />
              Asistente
            </button>
          </div>
          <p>
            Introduce los datos de las facturas de compra subiendo un PDF o una imagen. Tambien puedes hacerlo manualmente.
          </p>
        </div>
        <button
          className="purchase-email-link"
          onClick={() => {
            setShowEmailAddress((current) => !current);
          setShowAssistant(false);
        }}
        title={organizationName}
        type="button"
      >
        <Mail aria-hidden="true" size={15} />
        Ver direccion de e-mail
      </button>
      </header>

      {notice ? (
        <div className={`sales-live-notice ${notice.tone}`} role="status">
          {notice.tone === "success"
            ? <CheckCircle2 aria-hidden="true" size={18} />
            : <AlertTriangle aria-hidden="true" size={18} />}
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} type="button" aria-label="Cerrar aviso">
            <X aria-hidden="true" size={16} />
          </button>
        </div>
      ) : null}

      {showAssistant ? <PurchaseAssistantPanel rows={rows} /> : null}

      {showEmailAddress ? (
        <PurchaseEmailPanel
          organizationName={organizationName}
          onClose={() => setShowEmailAddress(false)}
        />
      ) : null}

      {showEmailPanel ? (
        <section className="purchase-mail-panel" aria-label="Clasificacion por e-mail">
          <button className="purchase-dismiss-button" onClick={() => setShowEmailPanel(false)} type="button">
            <X aria-hidden="true" size={31} />
            No volver a mostrar
          </button>
          <h2>Clasificacion automatica de facturas recibidas por e-mail</h2>
          <div className="purchase-mail-steps">
            <PurchaseStep
              icon={<Mail aria-hidden="true" size={66} />}
              title="Recepcion de e-mail"
              description="Los documentos recibidos por e-mail se detectan automaticamente."
            />
            <PurchaseStep
              icon={<Cpu aria-hidden="true" size={66} />}
              title="Procesamiento con IA"
              description="Nuestra IA extrae datos de facturas, recibos de pagos y gastos."
            />
            <PurchaseStep
              icon={<FolderOpen aria-hidden="true" size={66} />}
              title="Organizacion"
              description='Los documentos se clasifican para facilitar su revision. Los encontraras en la pestana "Por revisar" con la etiqueta "Bajo valoracion".'
            />
          </div>
        </section>
      ) : null}

      <section className="purchase-intake-row" aria-label="Entrada de facturas">
        <button className="sage-primary-button purchase-create-button" onClick={addManualInvoice} type="button">
          <Plus aria-hidden="true" size={22} />
          Crear
        </button>

        <label
          className="purchase-drop-zone"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            registerFiles(event.dataTransfer.files);
          }}
        >
          <input
            accept="application/pdf,image/*"
            multiple
            onChange={(event) => registerFiles(event.target.files)}
            ref={fileInputRef}
            type="file"
          />
          <UploadCloud aria-hidden="true" size={96} />
          <span>
            <strong>Arrastra los ficheros hasta aqui</strong>
            <small>O abre el explorador de ficheros</small>
          </span>
        </label>

        <div className="purchase-toolbar">
          <label className="sales-search-control">
            <Search aria-hidden="true" size={25} />
            <input
              aria-label="Buscar facturas de compra"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar facturas, proveedores, importes..."
              type="search"
              value={query}
            />
          </label>
          <button className="sage-outline-button" onClick={() => setShowFilters((current) => !current)} type="button">
            <Filter aria-hidden="true" size={20} fill="currentColor" />
            Filtrar
          </button>
          <button className="sage-outline-button" onClick={() => setShowColumns((current) => !current)} type="button">
            Personalizar
            <ChevronDown aria-hidden="true" size={15} />
          </button>
        </div>
      </section>

      {uploadedFiles.length > 0 ? (
        <div className="purchase-upload-strip">
          <strong>{uploadedFiles.length} fichero(s) listo(s) para revisar</strong>
          <span>{uploadedFiles.join(", ")}</span>
        </div>
      ) : null}

      {showCreateForm ? (
        <PurchaseInvoiceForm
          onCancel={() => setShowCreateForm(false)}
          onCreate={createManualInvoice}
        />
      ) : null}

      {showFilters ? (
        <div className="sales-filter-strip purchase-filter-strip">
          <span>Filtros activos</span>
          <button type="button">Estado: todos</button>
          <button type="button">Proveedor: todos</button>
          <button type="button">Fecha: importacion reciente</button>
        </div>
      ) : null}

      {showColumns ? (
        <div className="sales-filter-strip columns-strip purchase-filter-strip">
          <span>Columnas visibles</span>
          {["Fecha de importacion", "Nombre de fichero", "Estado", "Descripcion", "Proveedor", "Fecha de factura", "Numero de factura"].map((column) => (
            <label key={column}>
              <input defaultChecked type="checkbox" />
              {column}
            </label>
          ))}
        </div>
      ) : null}

      <div className="purchase-tabs" role="tablist" aria-label="Estado de facturas de compra">
        {purchaseTabs.map((tab) => {
          const tabCount = tab.id === "all" ? 0 : invoices.filter((row) => row.tab === tab.id).length;

          return (
            <button
              aria-selected={activeTab === tab.id}
              className={`purchase-tab${activeTab === tab.id ? " active" : ""}`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              type="button"
            >
              {tab.label}
              {tabCount > 0 ? <span>{tabCount}</span> : null}
            </button>
          );
        })}
      </div>

      <section className="purchase-table-panel" aria-label="Listado de facturas de compra">
        <div className="purchase-table-wrap">
          <table className="purchase-table">
            <thead>
              <tr>
                <th>Fecha de importacion</th>
                <th>Nombre de fichero</th>
                <th>Estado</th>
                <th>Descripcion</th>
                <th>Proveedor <ArrowUp aria-hidden="true" size={17} /></th>
                <th>Fecha de factura</th>
                <th>Numero de factura</th>
                <th>Total</th>
                <th>Editar</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.importDate}</td>
                  <td>{row.fileName}</td>
                  <td><span className={`purchase-status ${row.status.toLowerCase()}`}>{row.status}</span></td>
                  <td>{row.description}</td>
                  <td>{row.supplier}</td>
                  <td>{row.invoiceDate}</td>
                  <td>{row.invoiceNumber}</td>
                  <td>{formatMoney(row.total)}</td>
                  <td>
                    <button
                      className="sage-table-button"
                      onClick={() => {
                        setSelectedRow(row);
                      }}
                      type="button"
                      aria-label={`Editar ${row.invoiceNumber}`}
                    >
                      <PenLine aria-hidden="true" size={25} fill="currentColor" />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={9}>
                    <div className="sales-empty-list">
                      <FileText aria-hidden="true" size={64} />
                      <strong>Esta lista esta en blanco</strong>
                      <p>No hay facturas de compra para los filtros actuales. Sube un PDF o crea una manualmente.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="purchase-table-footer">Elementos: {rows.length}</footer>

      {selectedRow ? (
        <PurchaseDetailPanel
          row={selectedRow}
          onClose={() => setSelectedRow(null)}
          onMarkPaid={() => markAsPaid(selectedRow.id)}
          onDelete={() => deleteInvoice(selectedRow.id)}
        />
      ) : null}
    </section>
  );
}

function PurchaseAssistantPanel({ rows }: { rows: PurchaseInvoiceRow[] }) {
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const topSupplier = rows[0]?.supplier ?? "Sin proveedor destacado";

  return (
    <section className="sales-action-panel insights-panel" aria-label="Asistente de compras">
      <div>
        <Sparkles aria-hidden="true" size={22} fill="currentColor" />
        <h2>Resumen inteligente de facturas de compra</h2>
      </div>
      <p>
        Hay {rows.length} factura{rows.length === 1 ? "" : "s"} en la vista por {formatMoney(total)}.
        Proveedor con mas actividad: {topSupplier}.
      </p>
      <div className="sales-action-grid">
        <span>Proxima accion</span>
        <strong>{rows.length > 0 ? "Revisar vencimientos y preparar pagos" : "Sube la primera factura de compra"}</strong>
      </div>
    </section>
  );
}

function PurchaseEmailPanel({
  organizationName,
  onClose
}: {
  organizationName: string;
  onClose: () => void;
}) {
  const emailSlug = organizationName.toLowerCase().replace(/\s+/g, "-");

  return (
    <section className="sales-action-panel insights-panel" aria-label="Direccion de e-mail">
      <div>
        <Mail aria-hidden="true" size={22} />
        <h2>Direccion de e-mail de {organizationName}</h2>
      </div>
      <p>Reenvía tus facturas de compra a esta dirección y se clasificarán automáticamente:</p>
      <strong>facturas@{emailSlug}.gfiscal.local</strong>
      <footer>
        <button className="sage-outline-button" onClick={onClose} type="button">Cerrar</button>
      </footer>
    </section>
  );
}

function PurchaseDetailPanel({
  row,
  onClose,
  onMarkPaid,
  onDelete
}: {
  row: PurchaseInvoiceRow;
  onClose: () => void;
  onMarkPaid: () => void;
  onDelete: () => void;
}) {
  return (
    <section className="sales-action-panel document-detail-panel" aria-label={`Editar ${row.invoiceNumber}`}>
      <header>
        <div>
          <PenLine aria-hidden="true" size={22} />
          <h2>Factura {row.invoiceNumber}</h2>
        </div>
        <button className="panel-icon-button" onClick={onClose} type="button" aria-label="Cerrar edicion">
          <X aria-hidden="true" size={18} />
        </button>
      </header>

      <div className="document-detail-grid">
        <label className="sage-field">
          <span>Estado</span>
          <select defaultValue={row.status}>
            <option>Vencida</option>
            <option>Pendiente</option>
            <option>Pagada</option>
          </select>
        </label>
        <label className="sage-field">
          <span>Fecha de factura</span>
          <input defaultValue={row.invoiceDate} />
        </label>
        <label className="sage-field">
          <span>Proveedor</span>
          <input defaultValue={row.supplier} />
        </label>
        <label className="sage-field">
          <span>Total</span>
          <input defaultValue={formatMoney(row.total)} />
        </label>
      </div>

      <div className="document-action-strip">
        <button className="sage-danger-button" onClick={onDelete} type="button">Eliminar</button>
        <button className="sage-primary-button" onClick={onMarkPaid} type="button">Marcar pagada</button>
      </div>
    </section>
  );
}

function PurchaseInvoiceForm({
  onCancel,
  onCreate
}: {
  onCancel: () => void;
  onCreate: (values: PurchaseInvoiceFormValues) => void;
}) {
  const [supplier, setSupplier] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [total, setTotal] = useState("");
  const [description, setDescription] = useState("");
  const canCreate = supplier.trim().length > 0 && invoiceNumber.trim().length > 0;

  return (
    <section className="purchase-create-form" aria-label="Nueva factura de compra">
      <header className="purchase-form-header">
        <h1>Nueva factura de compra</h1>
        <button className="quote-close-button" onClick={onCancel} type="button" aria-label="Cerrar formulario">
          <X aria-hidden="true" size={34} />
        </button>
      </header>

      <div className="purchase-form-grid">
        <label className="sage-field">
          <span>Proveedor *</span>
          <input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Nombre o codigo de proveedor" />
        </label>
        <label className="sage-field">
          <span>Numero de factura *</span>
          <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
        </label>
        <label className="sage-field">
          <span>Fecha de factura</span>
          <input value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} type="date" />
        </label>
        <label className="sage-field">
          <span>Total</span>
          <input value={total} onChange={(e) => setTotal(e.target.value)} inputMode="decimal" placeholder="0,00" />
        </label>
        <label className="sage-textarea-field purchase-form-full-width">
          <span>Descripcion</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} />
        </label>
      </div>

      <footer className="purchase-form-footer">
        <button className="quote-cancel-action" onClick={onCancel} type="button">Cancelar</button>
        <button
          className="sage-primary-button"
          disabled={!canCreate}
          onClick={() => onCreate({ description, invoiceDate, invoiceNumber, supplier, total })}
          type="button"
        >
          Crear
        </button>
      </footer>
    </section>
  );
}

function parseSpanishAmount(value: string): number {
  const normalized = value
    .replace(/\s/g, "")
    .replace(/[\u20ac]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number.parseFloat(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDateForDisplay(value: string): string {
  const [year, month, day] = value.split("-");

  return year && month && day ? `${day}/${month}/${year}` : value;
}

function PurchaseStep({
  icon,
  title,
  description
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <article className="purchase-step">
      <span>{icon}</span>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </article>
  );
}
