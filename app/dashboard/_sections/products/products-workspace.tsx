"use client";

import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Filter,
  PenLine,
  Plus,
  Search,
  SearchX,
  Trash2,
  X
} from "lucide-react";
import { useMemo, useState } from "react";
import { formatMoney } from "../../_lib/formatters";

type ProductsView = "product-list" | "product" | "tariffs" | "tariff-form" | "discount-groups" | "discount-form";
type ProductFormTab = "basic" | "pricing";
type ProductCategory = "product" | "service";

const productTabs = [
  { id: "basic", label: "Informacion basica" },
  { id: "pricing", label: "Precios y descuentos de venta" }
] satisfies Array<{ id: ProductFormTab; label: string }>;

const tariffColumns = ["Codigo", "Nombre", "Fecha de inicio", "Fecha de fin", "Tipo de ajuste", "Activa", "Editar", "Eliminar"];
const discountGroupColumns = ["Codigo", "Nombre", "Fecha de inicio", "Fecha de fin", "Activo", "Editar", "Eliminar"];
const tariffItemColumns = ["Codigo de producto o servicio", "Nombre", "Unidad de medida", "Activa", "Tramos", "Editar", "Eliminar"];
const discountItemColumns = ["Codigo de producto o servicio", "Nombre", "Unidad de medida", "Activo", "Descuento", "Tramos", "Editar", "Eliminar"];

export function ProductsWorkspace({ organizationName }: { organizationName: string }) {
  const [view, setView] = useState<ProductsView>("product-list");
  const [showNav, setShowNav] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const openProduct = () => { setView("product-list"); setShowNav(false); };
  const openTariffs = () => { setView("tariffs"); setShowNav(false); };
  const openDiscountGroups = () => { setView("discount-groups"); setShowNav(false); };

  return (
    <section className={`products-module-shell${showNav ? "" : " nav-collapsed"}`} aria-label={`Productos y servicios de ${organizationName}`}>
      {showNav ? (
        <aside className="products-secondary-nav" aria-label="Navegacion de productos y servicios">
          <strong>Productos y servicios</strong>
          <button
            className={`products-secondary-main${view === "product-list" || view === "product" ? " active" : ""}`}
            onClick={openProduct}
            type="button"
          >
            <ChevronUp aria-hidden="true" size={19} />
            <span>Precios y descuentos</span>
          </button>
          <button
            className={`products-secondary-sub${view === "tariffs" || view === "tariff-form" ? " active" : ""}`}
            onClick={openTariffs}
            type="button"
          >
            Tarifas
          </button>
          <button
            className={`products-secondary-sub${view === "discount-groups" || view === "discount-form" ? " active" : ""}`}
            onClick={openDiscountGroups}
            type="button"
          >
            Grupos de descuentos
          </button>
        </aside>
      ) : null}

      <div className="products-operation-surface">
        {notice ? (
          <div className="sales-live-notice success" role="status" style={{ marginBottom: "16px" }}>
            <span>{notice}</span>
            <button onClick={() => setNotice(null)} type="button" aria-label="Cerrar aviso">
              <X aria-hidden="true" size={16} />
            </button>
          </div>
        ) : null}
        {view === "product-list" ? (
          <ProductsList
            onBack={() => setShowNav(true)}
            onCreate={() => setView("product")}
          />
        ) : view === "product" ? (
          <ProductServiceForm
            onCancel={() => setView("product-list")}
            onCreate={() => { setView("product-list"); setNotice("Producto guardado en la lista local."); }}
          />
        ) : view === "tariffs" ? (
          <ReferenceList
            columns={tariffColumns}
            onBack={() => setShowNav(true)}
            onCreate={() => setView("tariff-form")}
            searchLabel="Buscar tarifas"
            title="Tarifas"
          />
        ) : view === "tariff-form" ? (
          <TariffForm
            onCancel={openTariffs}
            onCreate={() => { openTariffs(); setNotice("Tarifa guardada en la lista local."); }}
          />
        ) : view === "discount-groups" ? (
          <ReferenceList
            columns={discountGroupColumns}
            focusCreate
            onBack={() => setShowNav(true)}
            onCreate={() => setView("discount-form")}
            searchLabel="Buscar grupos de descuentos"
            title="Grupos de descuentos"
          />
        ) : (
          <DiscountGroupForm
            onCancel={openDiscountGroups}
            onCreate={() => { openDiscountGroups(); setNotice("Grupo de descuentos guardado en la lista local."); }}
          />
        )}
      </div>
    </section>
  );
}

function ProductsList({ onBack, onCreate }: { onBack: () => void; onCreate: () => void }) {
  return (
    <section className="products-list-view" aria-label="Productos y servicios">
      <div className="products-list-breadcrumb">
        <button className="products-back-button" onClick={onBack} type="button">
          ← Productos y servicios
        </button>
        <h1>Precios y descuentos</h1>
      </div>
      <div className="products-list-toolbar">
        <button className="sage-primary-button" onClick={onCreate} type="button">
          <Plus aria-hidden="true" size={22} />
          Crear
        </button>
        <div className="products-toolbar-actions">
          <label className="sales-search-control">
            <Search aria-hidden="true" size={24} />
            <input aria-label="Buscar productos" placeholder="Buscar..." type="search" />
          </label>
          <button className="sage-outline-button" type="button">
            <Filter aria-hidden="true" size={20} fill="currentColor" />
            Filtrar
          </button>
        </div>
      </div>
      <div className="products-reference-panel">
        <table className="products-data-table">
          <thead>
            <tr>
              <th>Codigo</th>
              <th>Nombre</th>
              <th>Categoria</th>
              <th>Grupo de impuestos</th>
              <th>Precio</th>
              <th>Estado</th>
              <th>Editar</th>
              <th>Eliminar</th>
            </tr>
          </thead>
        </table>
        <div className="products-empty-state">
          <SearchX aria-hidden="true" size={94} strokeWidth={2.7} />
          <strong>Esta lista esta en blanco.</strong>
          <p>Crea el primer producto o servicio.</p>
        </div>
      </div>
    </section>
  );
}

function ProductServiceForm({ onCancel, onCreate }: { onCancel: () => void; onCreate: () => void }) {
  const [activeTab, setActiveTab] = useState<ProductFormTab>("basic");
  const [category, setCategory] = useState<ProductCategory>("product");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [internalComments, setInternalComments] = useState("");
  const [price, setPrice] = useState("0,00");
  const [discountPercent, setDiscountPercent] = useState("0,00");
  const [inactive, setInactive] = useState(false);
  const [blockOrders, setBlockOrders] = useState(false);
  const [blockDeliveryNotes, setBlockDeliveryNotes] = useState(false);
  const [blockInvoices, setBlockInvoices] = useState(false);
  const priceValue = parseSpanishNumber(price);
  const discountPercentValue = parseSpanishNumber(discountPercent);
  const discountAmount = priceValue * (discountPercentValue / 100);
  const discountedPrice = Math.max(priceValue - discountAmount, 0);
  const taxAmount = discountedPrice * 0.21;
  const priceWithTax = discountedPrice + taxAmount;
  const canCreate = code.trim().length > 0 && name.trim().length > 0;

  return (
    <section className="product-form-screen" aria-label="Alta de producto o servicio">
      <header className="product-form-close-row">
        <button className="quote-close-button" onClick={onCancel} type="button" aria-label="Cerrar formulario">
          <X aria-hidden="true" size={34} />
        </button>
      </header>

      <div className="quote-tabs products-form-tabs" role="tablist" aria-label="Secciones del producto o servicio">
        {productTabs.map((tab) => (
          <button
            aria-selected={activeTab === tab.id}
            className={`quote-tab${activeTab === tab.id ? " active" : ""}`}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "basic" ? (
        <div className="product-form-panel product-basic-panel">
          <fieldset className="product-category-group">
            <legend>Categoria</legend>
            <label className="product-radio-row">
              <input
                checked={category === "product"}
                onChange={() => setCategory("product")}
                type="radio"
              />
              <span>Producto</span>
            </label>
            <label className="product-radio-row">
              <input
                checked={category === "service"}
                onChange={() => setCategory("service")}
                type="radio"
              />
              <span>Servicio</span>
            </label>
          </fieldset>

          <label className="sage-field product-code-field">
            <span>Codigo <RequiredMark /></span>
            <input onChange={(event) => setCode(event.target.value)} value={code} />
          </label>

          <label className="sage-field product-name-field">
            <span>Nombre <RequiredMark /></span>
            <input onChange={(event) => setName(event.target.value)} value={name} />
          </label>

          <label className="sage-field product-unit-field">
            <span>Unidad de medida</span>
            <select defaultValue="Unidad - uds.">
              <option>Unidad - uds.</option>
              <option>Hora - h</option>
              <option>Dia - d</option>
            </select>
          </label>

          <label className="sage-field product-date-field">
            <span>Fecha de alta</span>
            <DateInput defaultValue="04/06/2026" />
          </label>

          <div className="sage-toggle-row product-status-toggle">
            <span>Inactivo</span>
            <ToggleButton active={inactive} activeLabel="ON" inactiveLabel="OFF" onToggle={() => setInactive((current) => !current)} />
          </div>

          <label className="sage-field product-tax-field">
            <span>Grupo de impuestos <RequiredMark /></span>
            <select defaultValue="General - 21 %">
              <option>General - 21 %</option>
              <option>Reducido - 10 %</option>
              <option>Exento - 0 %</option>
            </select>
          </label>

          <label className="sage-textarea-field product-description-field">
            <span>Descripcion</span>
            <textarea
              maxLength={2500}
              onChange={(event) => setDescription(event.target.value)}
              value={description}
            />
            <em>Quedan {2500 - description.length} caracteres.</em>
          </label>

          <label className="sage-textarea-field product-comments-field">
            <span>Comentarios internos</span>
            <textarea
              maxLength={250}
              onChange={(event) => setInternalComments(event.target.value)}
              value={internalComments}
            />
            <em>Quedan {250 - internalComments.length} caracteres.</em>
          </label>
        </div>
      ) : (
        <div className="product-form-panel product-pricing-panel">
          <section className="product-price-definition">
            <h2>Definicion de precio unitario</h2>
            <div className="product-price-grid">
              <label className="sage-field product-money-field">
                <span>Precio</span>
                <input inputMode="decimal" onChange={(event) => setPrice(event.target.value)} value={price} />
              </label>
              <label className="sage-field product-money-field">
                <span>Porcentaje de descuento</span>
                <input inputMode="decimal" onChange={(event) => setDiscountPercent(event.target.value)} value={discountPercent} />
              </label>
              <label className="sage-field product-money-field">
                <span>Importe de descuento</span>
                <input readOnly value={formatMoney(discountAmount)} />
              </label>
              <label className="sage-field product-money-field">
                <span>Precio con descuento</span>
                <input readOnly value={formatMoney(discountedPrice)} />
              </label>
              <label className="sage-field product-money-field">
                <span>Cuota de impuesto</span>
                <input readOnly value={formatMoney(taxAmount)} />
              </label>
              <SummaryBox label="Precio con IVA y descuento" value={priceWithTax} />
              <label className="sage-field product-account-field">
                <span>Cuenta contable</span>
                <select defaultValue="700000000 - Ventas de mercaderias">
                  <option>700000000 - Ventas de mercaderias</option>
                  <option>705000000 - Prestaciones de servicios</option>
                </select>
              </label>
            </div>
          </section>

          <InlineEmptyTable columns={["Codigo", "Nombre", "Tipo de ajuste", "Fecha de inicio", "Fecha de fin", "Estado", "Valor de ajuste", "Tramos", "Ver"]} title="Tarifas" />
          <InlineEmptyTable columns={["Codigo", "Nombre", "Fecha de inicio", "Fecha de fin", "Estado", "% descuento a cliente", "Tramos", "Ver"]} title="Grupos de descuentos" />

          <section className="product-document-management">
            <h2>Gestion de documentos de venta</h2>
            <DocumentBlockToggle
              active={blockOrders}
              description="No se van a poder crear pedidos de venta para este producto o servicio."
              label="Bloquear pedidos"
              onToggle={() => setBlockOrders((current) => !current)}
            />
            <DocumentBlockToggle
              active={blockDeliveryNotes}
              description="No se van a poder crear albaranes para este producto o servicio."
              label="Bloquear albaranes"
              onToggle={() => setBlockDeliveryNotes((current) => !current)}
            />
            <DocumentBlockToggle
              active={blockInvoices}
              description="No se van a poder crear facturas de venta para este producto o servicio."
              label="Bloquear facturas"
              onToggle={() => setBlockInvoices((current) => !current)}
            />
          </section>
        </div>
      )}

      <ProductStickyBar
        canCreate={canCreate}
        onCancel={onCancel}
        onCreate={onCreate}
        summaries={[
          { label: "Precio", value: priceValue },
          { label: "Precio con IVA y descuento", value: priceWithTax }
        ]}
      />
    </section>
  );
}

function ReferenceList({
  columns,
  focusCreate = false,
  onBack,
  onCreate,
  searchLabel,
  title
}: {
  columns: string[];
  focusCreate?: boolean;
  onBack: () => void;
  onCreate: () => void;
  searchLabel: string;
  title: string;
}) {
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const emptyMessage = useMemo(() => (
    query.trim().length > 0
      ? "La busqueda no ha dado ningun resultado. Intentalo de nuevo."
      : "La busqueda no ha dado ningun resultado. Intentalo de nuevo."
  ), [query]);

  return (
    <section className="products-list-view" aria-label={title}>
      <div className="products-list-breadcrumb">
        <button className="products-back-button" onClick={onBack} type="button">
          ← Productos y servicios
        </button>
      </div>
      <h1>{title}</h1>
      <div className="products-list-toolbar">
        <button className={`sage-primary-button${focusCreate ? " focused" : ""}`} onClick={onCreate} type="button">
          <Plus aria-hidden="true" size={22} />
          Crear
        </button>
        <div className="products-toolbar-actions">
          <label className="sales-search-control">
            <Search aria-hidden="true" size={24} />
            <input
              aria-label={searchLabel}
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
        </div>
      </div>

      {showFilters ? (
        <div className="sales-filter-strip">
          <span>Filtros</span>
          <button type="button">Activos</button>
          <button type="button">Fecha vigente</button>
        </div>
      ) : null}

      <div className="products-reference-panel">
        <table className="products-data-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
        </table>
        <div className="products-empty-state">
          <SearchX aria-hidden="true" size={94} strokeWidth={2.7} />
          <strong>Esta lista esta en blanco.</strong>
          <p>{emptyMessage}</p>
        </div>
      </div>
    </section>
  );
}

type TariffItemRow = { id: number };
type DiscountItemRow = { id: number };

function TariffForm({ onCancel, onCreate }: { onCancel: () => void; onCreate: () => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);
  const [items, setItems] = useState<TariffItemRow[]>([]);
  const canCreate = code.trim().length > 0 && name.trim().length > 0;

  return (
    <section className="product-reference-form" aria-label="Tarifa">
      <ReferenceFormHeader onCancel={onCancel} title="Tarifa" />
      <div className="product-reference-grid tariff-reference-grid">
        <RequiredTextField
          label="Codigo"
          onChange={setCode}
          value={code}
        />
        <RequiredTextField
          label="Nombre"
          onChange={setName}
          value={name}
        />
        <label className="sage-field">
          <span>Tipo de ajuste <RequiredMark /></span>
          <select defaultValue="Precio fijo">
            <option>Precio fijo</option>
            <option>Descuento porcentual</option>
            <option>Precio por tramo</option>
          </select>
        </label>
        <label className="sage-field">
          <span>Fecha de inicio</span>
          <DateInput defaultValue="04/06/2026" />
        </label>
        <label className="sage-field">
          <span>Fecha de fin</span>
          <DateInput defaultValue="" />
        </label>
        <div className="sage-toggle-row product-status-toggle">
          <span>Activa</span>
          <ToggleButton active={active} activeLabel="ON" inactiveLabel="OFF" onToggle={() => setActive((current) => !current)} />
        </div>
      </div>
      <button
        className="sage-primary-button product-add-line-button"
        onClick={() => setItems((current) => [...current, { id: Date.now() }])}
        type="button"
      >
        <Plus aria-hidden="true" size={22} />
        Anadir
      </button>
      <FormItemsTable
        columns={tariffItemColumns}
        items={items}
        onRemoveItem={(id) => setItems((current) => current.filter((item) => item.id !== id))}
      />
      <ProductStickyBar canCreate={canCreate} onCancel={onCancel} onCreate={onCreate} />
    </section>
  );
}

function DiscountGroupForm({ onCancel, onCreate }: { onCancel: () => void; onCreate: () => void }) {
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [items, setItems] = useState<DiscountItemRow[]>([]);
  const canCreate = code.trim().length > 0 && description.trim().length > 0;

  return (
    <section className="product-reference-form" aria-label="Grupo de descuentos">
      <ReferenceFormHeader onCancel={onCancel} title="Grupo de descuentos" />
      <div className="product-reference-grid discount-reference-grid">
        <RequiredTextField
          label="Codigo"
          onChange={setCode}
          value={code}
        />
        <RequiredTextField
          label="Descripcion"
          onChange={setDescription}
          value={description}
        />
        <label className="sage-field">
          <span>Fecha de inicio</span>
          <DateInput defaultValue="04/06/2026" />
        </label>
        <label className="sage-field">
          <span>Fecha de fin</span>
          <DateInput defaultValue="" />
        </label>
        <div className="sage-toggle-row product-status-toggle">
          <span>Activo</span>
          <ToggleButton active={active} activeLabel="ON" inactiveLabel="OFF" onToggle={() => setActive((current) => !current)} />
        </div>
      </div>
      <button
        className="sage-primary-button product-add-line-button"
        onClick={() => setItems((current) => [...current, { id: Date.now() }])}
        type="button"
      >
        <Plus aria-hidden="true" size={22} />
        Anadir
      </button>
      <FormItemsTable
        columns={discountItemColumns}
        items={items}
        onRemoveItem={(id) => setItems((current) => current.filter((item) => item.id !== id))}
      />
      <ProductStickyBar canCreate={canCreate} onCancel={onCancel} onCreate={onCreate} />
    </section>
  );
}

function ReferenceFormHeader({ onCancel, title }: { onCancel: () => void; title: string }) {
  return (
    <header className="product-reference-header">
      <h1>{title}</h1>
      <button className="quote-close-button" onClick={onCancel} type="button" aria-label={`Cerrar ${title}`}>
        <X aria-hidden="true" size={34} />
      </button>
    </header>
  );
}

function RequiredTextField({
  label,
  onChange,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const isInvalid = value.trim().length === 0;

  return (
    <label className={`sage-field product-required-field${isInvalid ? " invalid" : ""}`}>
      <span>{label} <RequiredMark /></span>
      {isInvalid ? <strong>Campo obligatorio</strong> : null}
      <input
        aria-invalid={isInvalid}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}

function DateInput({ defaultValue }: { defaultValue: string }) {
  return (
    <span className="date-input-shell">
      <input defaultValue={defaultValue} />
      <CalendarDays aria-hidden="true" size={23} />
    </span>
  );
}

function ToggleButton({
  active,
  activeLabel,
  inactiveLabel,
  onToggle
}: {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
  onToggle: () => void;
}) {
  return (
    <button className={`products-toggle-button${active ? " on" : ""}`} onClick={onToggle} type="button">
      {active ? activeLabel : inactiveLabel}
    </button>
  );
}

function DocumentBlockToggle({
  active,
  description,
  label,
  onToggle
}: {
  active: boolean;
  description: string;
  label: string;
  onToggle: () => void;
}) {
  return (
    <div className="product-block-toggle">
      <strong>{label}</strong>
      <p>{description}</p>
      <ToggleButton active={active} activeLabel="ON" inactiveLabel="OFF" onToggle={onToggle} />
    </div>
  );
}

function InlineEmptyTable({ columns, title }: { columns: string[]; title: string }) {
  return (
    <section className="product-inline-table-section">
      <h3>{title}</h3>
      <div className="product-inline-table-wrap">
        <table className="products-data-table product-inline-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={columns.length}>Esta lista esta en blanco.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FormItemsTable({
  columns,
  items = [],
  onRemoveItem
}: {
  columns: string[];
  items?: Array<{ id: number }>;
  onRemoveItem?: (id: number) => void;
}) {
  return (
    <div className="product-form-table-wrap">
      <table className="products-data-table product-form-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.length > 0 ? items.map((item) => (
            <tr key={item.id}>
              {columns.slice(0, -2).map((col) => (
                <td key={col}><input className="products-table-input" /></td>
              ))}
              <td>
                <button className="sage-table-button" type="button" aria-label="Editar">
                  <PenLine aria-hidden="true" size={20} fill="currentColor" />
                </button>
              </td>
              <td>
                <button
                  className="sage-table-button danger"
                  onClick={() => onRemoveItem?.(item.id)}
                  type="button"
                  aria-label="Eliminar"
                >
                  <Trash2 aria-hidden="true" size={20} fill="currentColor" />
                </button>
              </td>
            </tr>
          )) : (
            <tr>
              <td colSpan={columns.length}>Esta lista esta en blanco.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ProductStickyBar({
  canCreate,
  onCancel,
  onCreate,
  summaries = []
}: {
  canCreate: boolean;
  onCancel?: () => void;
  onCreate?: () => void;
  summaries?: Array<{ label: string; value: number }>;
}) {
  return (
    <footer className="quote-sticky-bar product-sticky-bar">
      {summaries.map((summary) => (
        <SummaryBox key={summary.label} label={summary.label} value={summary.value} />
      ))}
      <button className="quote-cancel-action" onClick={onCancel} type="button">Cancelar</button>
      <button className="quote-create-action" disabled={!canCreate} onClick={canCreate ? onCreate : undefined} type="button">Crear</button>
      <button className="quote-create-more" disabled={!canCreate} type="button" aria-label="Mas opciones de creacion">
        <ChevronDown aria-hidden="true" size={18} />
      </button>
    </footer>
  );
}

function SummaryBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="quote-summary-box">
      <strong>{formatMoney(value)}</strong>
      <span>{label}</span>
    </div>
  );
}

function RequiredMark() {
  return <em className="required-mark">*</em>;
}

function parseSpanishNumber(value: string): number {
  const normalized = value
    .replace(/\s/g, "")
    .replace(/[\u20ac%]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number.parseFloat(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}
