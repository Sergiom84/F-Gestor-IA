"use client";

import {
  ArrowUp,
  ChevronDown,
  Cpu,
  FileText,
  Filter,
  FolderOpen,
  Mail,
  MoreVertical,
  PenLine,
  Plus,
  Search,
  Sparkles,
  UploadCloud,
  X
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useRef, useState } from "react";
import {
  artificialPurchaseRows,
  artificialPurchaseTabs
} from "../../_data/artificial-business-data";
import type {
  ArtificialPurchaseInvoiceRow,
  ArtificialPurchaseTabId
} from "../../_data/artificial-business-data";
import { formatMoney } from "../../_lib/formatters";

type PurchaseTabId = ArtificialPurchaseTabId;
type PurchaseInvoiceRow = ArtificialPurchaseInvoiceRow;

const purchaseTabs = artificialPurchaseTabs;
const purchaseRows: PurchaseInvoiceRow[] = artificialPurchaseRows;

export function PurchasesWorkspace({ organizationName }: { organizationName: string }) {
  const [activeTab, setActiveTab] = useState<PurchaseTabId>("all");
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [showEmailPanel, setShowEmailPanel] = useState(true);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => {
    const byTab = activeTab === "all"
      ? purchaseRows
      : purchaseRows.filter((row) => row.tab === activeTab);
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
  }, [activeTab, query]);

  const addManualInvoice = () => {
    setActiveTab("review");
    setQuery("");
  };

  const registerFiles = (files: FileList | null) => {
    if (!files?.length) {
      return;
    }

    setUploadedFiles(Array.from(files).map((file) => file.name));
    setActiveTab("review");
  };

  return (
    <section className="purchases-workspace" aria-label="Facturas de compra">
      <header className="purchases-header">
        <div>
          <div className="sales-operation-title">
            <h1>Facturas de compra</h1>
            <button className="insights-pill sales-insights-pill" type="button">
              <Sparkles aria-hidden="true" size={18} fill="currentColor" />
              Copilot Insights
            </button>
          </div>
          <p>
            Introduce los datos de las facturas de compra en tus registros contables mediante la subida de un PDF o una imagen. Tambien lo puedes hacer manualmente.
          </p>
        </div>
        <button className="purchase-email-link" title={organizationName} type="button">Ver direccion de e-mail</button>
      </header>

      {showEmailPanel ? (
        <section className="purchase-mail-panel" aria-label="Clasificacion por e-mail">
          <button className="purchase-dismiss-button" onClick={() => setShowEmailPanel(false)} type="button">
            <X aria-hidden="true" size={31} />
            No volver a mostrar
          </button>
          <h2>Clasificacion automatica de facturas de compras recibidas por e-mail</h2>
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
              placeholder="Buscar..."
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
        {purchaseTabs.map((tab) => (
          <button
            aria-selected={activeTab === tab.id}
            className={`purchase-tab${activeTab === tab.id ? " active" : ""}`}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
            {tab.count ? <span>{tab.count}</span> : null}
          </button>
        ))}
      </div>

      <section className="purchase-table-panel" aria-label="Listado de facturas de compra">
        <div className="purchase-table-wrap">
          <table className="purchase-table">
            <thead>
              <tr>
                <th>Fecha de import...</th>
                <th>Nombre de fichero</th>
                <th>Estado</th>
                <th>Descripcion</th>
                <th>Proveedor <ArrowUp aria-hidden="true" size={17} /></th>
                <th>Fecha de factura</th>
                <th>Numero de factura</th>
                <th>Total</th>
                <th>Editar</th>
                <th>Acciones</th>
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
                    <button className="sage-table-button" type="button" aria-label={`Editar ${row.invoiceNumber}`}>
                      <PenLine aria-hidden="true" size={25} fill="currentColor" />
                    </button>
                  </td>
                  <td>
                    <button className="sage-table-button" type="button" aria-label={`Acciones ${row.invoiceNumber}`}>
                      <MoreVertical aria-hidden="true" size={25} />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={10}>
                    <div className="sales-empty-list">
                      <FileText aria-hidden="true" size={64} />
                      <strong>Esta lista esta en blanco.</strong>
                      <p>No hay facturas de compra para los filtros actuales.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
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
