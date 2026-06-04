"use client";

import {
  CalendarDays,
  ChevronDown,
  FileText,
  Filter,
  ListChecks,
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
import { useMemo, useState } from "react";
import { formatMoney } from "../_lib/formatters";

type SalesSectionId = "quotes" | "orders" | "delivery-notes" | "invoices" | "recurring-invoices";
type QuoteFormTab = "products" | "totals" | "notes" | "client";

type SalesSection = {
  id: SalesSectionId;
  label: string;
  title: string;
  singularTitle: string;
  dateLabel: string;
  numberLabel: string;
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

const seedRows: Record<SalesSectionId, SalesDocumentRow[]> = {
  quotes: [
    {
      id: "quote-0001",
      status: "Cerrado",
      date: "06/04/2026",
      number: "0001",
      reference: "",
      clientCode: "32",
      client: "GENESIS BIENESTAR SL",
      total: 6265.38
    }
  ],
  orders: [],
  "delivery-notes": [],
  invoices: [],
  "recurring-invoices": []
};

export function SalesWorkspace({ organizationName }: { organizationName: string }) {
  const [activeSectionId, setActiveSectionId] = useState<SalesSectionId>("quotes");
  const [isCreating, setIsCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const activeSection = salesSections.find((section) => section.id === activeSectionId) ?? salesSections[0]!;
  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return seedRows[activeSectionId];
    }

    return seedRows[activeSectionId].filter((row) => (
      row.status.toLowerCase().includes(normalizedQuery)
      || row.date.toLowerCase().includes(normalizedQuery)
      || row.number.toLowerCase().includes(normalizedQuery)
      || row.reference.toLowerCase().includes(normalizedQuery)
      || row.clientCode.toLowerCase().includes(normalizedQuery)
      || row.client.toLowerCase().includes(normalizedQuery)
    ));
  }, [activeSectionId, query]);

  const openSection = (sectionId: SalesSectionId) => {
    setActiveSectionId(sectionId);
    setIsCreating(false);
    setQuery("");
    setShowFilters(false);
    setShowColumns(false);
  };

  return (
    <section className="sales-module-shell" aria-label="Modulo de ventas">
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
            onCreate={() => setIsCreating(true)}
            onQueryChange={setQuery}
            onToggleColumns={() => setShowColumns((current) => !current)}
            onToggleFilters={() => setShowFilters((current) => !current)}
            onToggleSettings={() => setShowSettings((current) => !current)}
          />
        )}
      </div>
    </section>
  );
}

function DocumentList({
  activeSection,
  organizationName,
  rows,
  query,
  showColumns,
  showFilters,
  showSettings,
  onCreate,
  onQueryChange,
  onToggleColumns,
  onToggleFilters,
  onToggleSettings
}: {
  activeSection: SalesSection;
  organizationName: string;
  rows: SalesDocumentRow[];
  query: string;
  showColumns: boolean;
  showFilters: boolean;
  showSettings: boolean;
  onCreate: () => void;
  onQueryChange: (value: string) => void;
  onToggleColumns: () => void;
  onToggleFilters: () => void;
  onToggleSettings: () => void;
}) {
  return (
    <>
      <header className="sales-operation-header">
        <div className="sales-operation-title">
          <h1>{activeSection.title}</h1>
          <button className="insights-pill sales-insights-pill" type="button">
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
              <button type="button">Numeracion de ventas</button>
              <button type="button">Condiciones de pago</button>
              <button type="button">Preferencias de {organizationName}</button>
            </div>
          ) : null}
        </div>
      </header>

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
                    <button className="sage-table-button" type="button" aria-label={`Editar ${row.number}`}>
                      <PenLine aria-hidden="true" size={25} fill="currentColor" />
                    </button>
                  </td>
                  <td>
                    <button className="sage-table-button danger" type="button" aria-label={`Eliminar ${row.number}`}>
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
    </>
  );
}

function QuoteForm({ section, onCancel }: { section: SalesSection; onCancel: () => void }) {
  const [activeTab, setActiveTab] = useState<QuoteFormTab>("products");
  const [client, setClient] = useState("");
  const [reference, setReference] = useState("");
  const [quoteDate, setQuoteDate] = useState("2026-06-04");
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
              <option value="GENESIS BIENESTAR SL">GENESIS BIENESTAR SL</option>
              <option value="INTERVENCIONES ORIENTADAS SL">INTERVENCIONES ORIENTADAS SL</option>
              <option value="SANSANO OIL SERVICE SL">SANSANO OIL SERVICE SL</option>
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
