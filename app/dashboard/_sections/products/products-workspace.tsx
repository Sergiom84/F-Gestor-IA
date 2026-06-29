"use client";

import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  Filter,
  MoreVertical,
  PenLine,
  Plus,
  Search,
  SearchX,
  Trash2,
  X
} from "lucide-react";
import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from "react";
import {
  createDiscountGroup,
  createPriceList,
  createProductService,
  duplicateProductService,
  softDeleteProductService,
  toggleProductServiceActive,
  updateProductService
} from "../../commercial-actions";
import { formatMoney } from "../../_lib/formatters";
import type { DiscountGroupItem, PriceListItem, ProductItem } from "../../_data/commercial-data";

type ProductsView = "product-list" | "product" | "tariffs" | "tariff-form" | "discount-groups" | "discount-form";
type ProductsSectionId = "products" | "tariffs" | "discount-groups";
type ProductsHeroAction = ProductsSectionId | "create" | "create-service" | "create-tariff" | "create-discount-group";
type ProductFormTab = "basic" | "pricing";
type ProductCategory = "product" | "service";
type ProductUnitMeasure = ProductItem["unitMeasure"];

const productUnitMeasureOptions: Array<{ value: ProductUnitMeasure; name: string; abbreviation: string }> = [
  { value: "day", name: "Día", abbreviation: "ds." },
  { value: "hour", name: "Hora", abbreviation: "h" },
  { value: "month", name: "Mes", abbreviation: "ms." },
  { value: "none", name: "No aplica", abbreviation: "" },
  { value: "percentage", name: "Porcentaje", abbreviation: "%" }
];

const productUnitMeasureLabel = (value: ProductUnitMeasure) => {
  const option = productUnitMeasureOptions.find((item) => item.value === value) ?? productUnitMeasureOptions[1]!;
  return option.abbreviation ? `${option.name} - ${option.abbreviation}` : option.name;
};

const productTabs = [
  { id: "basic", label: "Informacion basica" },
  { id: "pricing", label: "Precios y descuentos de venta" }
] satisfies Array<{ id: ProductFormTab; label: string }>;

const tariffColumns = ["Codigo", "Nombre", "Fecha de inicio", "Fecha de fin", "Tipo de ajuste", "Activa", "Editar", "Eliminar"];
const discountGroupColumns = ["Codigo", "Nombre", "Fecha de inicio", "Fecha de fin", "Activo", "Editar", "Eliminar"];
const tariffItemColumns = ["Codigo de producto o servicio", "Nombre", "Unidad de medida", "Activa", "Tramos", "Editar", "Eliminar"];
const discountItemColumns = ["Codigo de producto o servicio", "Nombre", "Unidad de medida", "Activo", "Descuento", "Tramos", "Editar", "Eliminar"];

type ProductsSection = {
  id: ProductsSectionId;
  label: string;
  title: string;
  createLabel: string;
  searchLabel: string;
  tableTitle: string;
  emptyTitle: string;
  emptyDescription: string;
  columns: string[];
  metrics: Array<{
    label: string;
    tone: "teal" | "indigo" | "green";
    value: string;
  }>;
  actions: Array<{
    kind: ProductsHeroAction;
    label: string;
  }>;
};

const productsSections: ProductsSection[] = [
  {
    id: "products",
    label: "Productos y servicios",
    title: "Productos y servicios",
    createLabel: "Crear producto",
    searchLabel: "Buscar productos",
    tableTitle: "Productos y servicios",
    emptyTitle: "No hay productos ni servicios.",
    emptyDescription: "Crea el primer producto o servicio.",
    columns: ["Codigo", "Nombre", "Categoria", "Unidad de medida", "Grupo de impuestos", "Precio", "Estado", "Acciones"],
    metrics: [
      { label: "Productos", tone: "teal", value: "0" },
      { label: "Servicios", tone: "indigo", value: "0" },
      { label: "Valor catalogo", tone: "green", value: "0,00 €" }
    ],
    actions: [
      { kind: "create", label: "Crear producto" },
      { kind: "create-service", label: "Crear servicio" }
    ]
  },
  {
    id: "tariffs",
    label: "Tarifas",
    title: "Tarifas",
    createLabel: "Crear tarifa",
    searchLabel: "Buscar tarifas",
    tableTitle: "Tarifas",
    emptyTitle: "No hay tarifas.",
    emptyDescription: "Crea una tarifa para empezar.",
    columns: tariffColumns.filter((column) => column !== "Editar" && column !== "Eliminar").concat("Acciones"),
    metrics: [
      { label: "Tarifas", tone: "teal", value: "0" },
      { label: "Activas", tone: "indigo", value: "0" },
      { label: "Vigentes", tone: "green", value: "0" }
    ],
    actions: [
      { kind: "create", label: "Crear tarifa" }
    ]
  },
  {
    id: "discount-groups",
    label: "Grupos de descuentos",
    title: "Grupos de descuentos",
    createLabel: "Crear descuento",
    searchLabel: "Buscar grupos de descuentos",
    tableTitle: "Grupos de descuentos",
    emptyTitle: "No hay grupos de descuentos.",
    emptyDescription: "Crea un grupo de descuentos para empezar.",
    columns: discountGroupColumns.filter((column) => column !== "Editar" && column !== "Eliminar").concat("Acciones"),
    metrics: [
      { label: "Grupos", tone: "teal", value: "0" },
      { label: "Activos", tone: "indigo", value: "0" },
      { label: "Vigentes", tone: "green", value: "0" }
    ],
    actions: [
      { kind: "create", label: "Crear descuento" }
    ]
  }
];

export function ProductsWorkspace({
  organizationId,
  organizationName,
  initialProducts,
  initialPriceLists,
  initialDiscountGroups
}: {
  organizationId: string;
  organizationName: string;
  initialProducts?: ProductItem[];
  initialPriceLists?: PriceListItem[];
  initialDiscountGroups?: DiscountGroupItem[];
}) {
  const [view, setView] = useState<ProductsView>("product-list");
  const [notice, setNotice] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductItem[]>(initialProducts ?? []);
  const [priceLists, setPriceLists] = useState<PriceListItem[]>(initialPriceLists ?? []);
  const [discountGroups, setDiscountGroups] = useState<DiscountGroupItem[]>(initialDiscountGroups ?? []);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [createCategory, setCreateCategory] = useState<ProductCategory>("product");

  const activeSectionId = resolveProductsSectionId(view);
  const activeSection = productsSections.find((section) => section.id === activeSectionId) ?? productsSections[0]!;
  const openProduct = () => {
    setEditingProduct(null);
    setView("product-list");
  };
  const openTariffs = () => setView("tariffs");
  const openDiscountGroups = () => setView("discount-groups");
  const openSection = (sectionId: ProductsSectionId) => {
    if (sectionId === "products") {
      openProduct();
    } else if (sectionId === "tariffs") {
      openTariffs();
    } else {
      openDiscountGroups();
    }
  };
  const openCreate = (sectionId: ProductsSectionId) => {
    if (sectionId === "products") {
      setEditingProduct(null);
      setView("product");
    } else if (sectionId === "tariffs") {
      setView("tariff-form");
    } else {
      setView("discount-form");
    }
  };
  const handleHeroAction = (kind: ProductsHeroAction) => {
    if (kind === "create") {
      setCreateCategory("product");
      openCreate(activeSectionId);
      return;
    }

    if (kind === "create-service") {
      setCreateCategory("service");
      setEditingProduct(null);
      setView("product");
      return;
    }

    if (kind === "create-tariff") {
      setView("tariff-form");
      return;
    }

    if (kind === "create-discount-group") {
      setView("discount-form");
      return;
    }

    openSection(kind);
  };

  return (
    <section className="products-module-shell" aria-label={`Productos y servicios de ${organizationName}`}>
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
          <ProductsTemplateView
            activeSection={activeSection}
            activeSectionId={activeSectionId}
            productRows={products}
            priceListRows={priceLists}
            discountGroupRows={discountGroups}
            onHeroAction={handleHeroAction}
            organizationId={organizationId}
            onSectionChange={openSection}
            onEditProduct={(product) => {
              setEditingProduct(product);
              setView("product");
            }}
            onProductsChange={setProducts}
            onNotice={setNotice}
          />
        ) : view === "product" ? (
          <ProductServiceForm
            initialProduct={editingProduct}
            initialCategory={createCategory}
            products={products}
            organizationId={organizationId}
            onCancel={openProduct}
            onSaved={(product) => {
              setProducts((current) => {
                const exists = current.some((item) => item.id === product.id);
                const next = exists
                  ? current.map((item) => item.id === product.id ? product : item)
                  : [...current, product];
                return next.sort((a, b) => a.name.localeCompare(b.name));
              });
              setEditingProduct(null);
              setView("product-list");
              setNotice(`${product.kind === "service" ? "Servicio" : "Producto"} ${product.code} - ${product.name} guardado.`);
            }}
          />
        ) : view === "tariffs" ? (
          <ProductsTemplateView
            activeSection={activeSection}
            activeSectionId={activeSectionId}
            productRows={products}
            priceListRows={priceLists}
            discountGroupRows={discountGroups}
            onHeroAction={handleHeroAction}
            organizationId={organizationId}
            onSectionChange={openSection}
            onEditProduct={(product) => {
              setEditingProduct(product);
              setView("product");
            }}
            onProductsChange={setProducts}
            onNotice={setNotice}
          />
        ) : view === "tariff-form" ? (
          <TariffForm
            organizationId={organizationId}
            onCancel={openTariffs}
            onCreated={(pl) => {
              setPriceLists((current) => [...current, pl].sort((a, b) => a.name.localeCompare(b.name)));
              openTariffs();
              setNotice(`Tarifa ${pl.name} guardada.`);
            }}
          />
        ) : view === "discount-groups" ? (
          <ProductsTemplateView
            activeSection={activeSection}
            activeSectionId={activeSectionId}
            productRows={products}
            priceListRows={priceLists}
            discountGroupRows={discountGroups}
            onHeroAction={handleHeroAction}
            organizationId={organizationId}
            onSectionChange={openSection}
            onEditProduct={(product) => {
              setEditingProduct(product);
              setView("product");
            }}
            onProductsChange={setProducts}
            onNotice={setNotice}
          />
        ) : (
          <DiscountGroupForm
            organizationId={organizationId}
            onCancel={openDiscountGroups}
            onCreated={(dg) => {
              setDiscountGroups((current) => [...current, dg].sort((a, b) => a.name.localeCompare(b.name)));
              openDiscountGroups();
              setNotice(`Grupo de descuentos ${dg.name} guardado.`);
            }}
          />
        )}
      </div>
    </section>
  );
}

function ProductsTemplateView({
  activeSection,
  activeSectionId,
  organizationId,
  productRows,
  priceListRows,
  discountGroupRows,
  onHeroAction,
  onSectionChange,
  onEditProduct,
  onProductsChange,
  onNotice
}: {
  activeSection: ProductsSection;
  activeSectionId: ProductsSectionId;
  organizationId: string;
  productRows: ProductItem[];
  priceListRows: PriceListItem[];
  discountGroupRows: DiscountGroupItem[];
  onHeroAction: (kind: ProductsHeroAction) => void;
  onSectionChange: (sectionId: ProductsSectionId) => void;
  onEditProduct: (product: ProductItem) => void;
  onProductsChange: Dispatch<SetStateAction<ProductItem[]>>;
  onNotice: (notice: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<"all" | "product" | "service">("all");
  const [openActionMenu, setOpenActionMenu] = useState<{ id: string; left: number; top: number } | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const isProductsSection = activeSectionId === "products";
  const isTariffsSection = activeSectionId === "tariffs";
  const normalizedQuery = query.trim().toLowerCase();
  const visibleProducts = isProductsSection
    ? productRows.filter((product) => (
      (categoryFilter === "all" || product.kind === categoryFilter)
      && (
        !normalizedQuery
        || product.name.toLowerCase().includes(normalizedQuery)
        || product.code.toLowerCase().includes(normalizedQuery)
      )
    ))
    : [];
  const visiblePriceLists = isTariffsSection
    ? priceListRows.filter((pl) => (
      !normalizedQuery
      || pl.name.toLowerCase().includes(normalizedQuery)
      || pl.code.toLowerCase().includes(normalizedQuery)
    ))
    : [];
  const visibleDiscountGroups = activeSectionId === "discount-groups"
    ? discountGroupRows.filter((dg) => (
      !normalizedQuery
      || dg.name.toLowerCase().includes(normalizedQuery)
      || dg.code.toLowerCase().includes(normalizedQuery)
    ))
    : [];

  useEffect(() => {
    if (!openActionMenu) return;

    const closeOnOutsideInteraction = (event: PointerEvent) => {
      const target = event.target;

      if (target instanceof Element && target.closest(".products-row-actions, .products-actions-popover")) {
        return;
      }

      setOpenActionMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenActionMenu(null);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsideInteraction);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideInteraction);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openActionMenu]);

  const toggleProductActionMenu = (productId: string, button: HTMLButtonElement) => {
    setOpenActionMenu((current) => {
      if (current?.id === productId) return null;

      const rect = button.getBoundingClientRect();
      const menuWidth = 170;
      const menuHeight = 178;
      const gap = 8;
      const safeMargin = 12;
      const preferredLeft = rect.left + (rect.width / 2) - (menuWidth / 2);
      const left = Math.min(
        Math.max(preferredLeft, safeMargin),
        window.innerWidth - menuWidth - safeMargin
      );
      const hasSpaceBelow = rect.bottom + gap + menuHeight <= window.innerHeight - safeMargin;
      const top = hasSpaceBelow
        ? rect.bottom + gap
        : Math.max(rect.top - menuHeight - gap, safeMargin);

      return { id: productId, left, top };
    });
  };

  const adjustmentTypeLabel = (type: string) => {
    if (type === "fixed_price") return "Precio fijo";
    if (type === "percentage_discount") return "Descuento porcentual";
    if (type === "tiered") return "Precio por tramo";
    return type;
  };
  const mapDuplicatedProduct = (product: NonNullable<Awaited<ReturnType<typeof duplicateProductService>>["product"]>): ProductItem => {
    const unitMeasureOptions = ["day", "hour", "month", "none", "percentage"] as const;
    const unitMeasure = unitMeasureOptions.includes(product.unit_measure as ProductUnitMeasure)
      ? product.unit_measure as ProductUnitMeasure
      : "hour";

    return {
      id: product.id,
      code: product.code ?? "",
      name: product.name,
      kind: product.kind,
      description: product.description ?? "",
      unitMeasure,
      unitPrice: Number(product.unit_price),
      taxRate: product.tax_rate === null ? null : Number(product.tax_rate),
      isActive: product.is_active
    };
  };
  const runProductAction = async (
    product: ProductItem,
    action: () => Promise<{ error?: string }>,
    successMessage: string
  ) => {
    setPendingActionId(product.id);
    setOpenActionMenu(null);

    const result = await action();
    setPendingActionId(null);

    if (result.error) {
      onNotice(`No se pudo actualizar ${product.name}: ${result.error}`);
      return false;
    }

    onNotice(successMessage);
    return true;
  };
  const handleDuplicateProduct = async (product: ProductItem) => {
    setPendingActionId(product.id);
    setOpenActionMenu(null);

    const result = await duplicateProductService(organizationId, product.id);
    setPendingActionId(null);

    if (result.error || !result.product) {
      onNotice(`No se pudo duplicar ${product.name}: ${result.error ?? "error desconocido"}`);
      return;
    }

    const duplicatedProduct = mapDuplicatedProduct(result.product);
    onProductsChange((current) => [...current, duplicatedProduct].sort((a, b) => a.name.localeCompare(b.name)));
    onNotice(`${duplicatedProduct.kind === "service" ? "Servicio" : "Producto"} ${duplicatedProduct.name} duplicado.`);
  };
  const metrics = isProductsSection
    ? [
      { label: "Productos", tone: "teal" as const, value: String(productRows.filter((p) => p.kind === "product").length) },
      { label: "Servicios", tone: "indigo" as const, value: String(productRows.filter((p) => p.kind === "service").length) },
      { label: "Valor catalogo", tone: "green" as const, value: formatMoney(productRows.reduce((sum, p) => sum + (p.isActive ? p.unitPrice : 0), 0)) }
    ]
    : isTariffsSection
    ? [
      { label: "Tarifas", tone: "teal" as const, value: String(priceListRows.length) },
      { label: "Activas", tone: "indigo" as const, value: String(priceListRows.filter((pl) => pl.isActive).length) },
      { label: "Vigentes", tone: "green" as const, value: String(priceListRows.filter((pl) => pl.isActive && !pl.endDate).length) }
    ]
    : activeSectionId === "discount-groups"
    ? [
      { label: "Grupos", tone: "teal" as const, value: String(discountGroupRows.length) },
      { label: "Activos", tone: "indigo" as const, value: String(discountGroupRows.filter((dg) => dg.isActive).length) },
      { label: "Vigentes", tone: "green" as const, value: String(discountGroupRows.filter((dg) => dg.isActive && !dg.endDate).length) }
    ]
    : activeSection.metrics;

  return (
    <section className="products-list-view product-template-view" aria-label={activeSection.title}>
      <ProductSectionTabs
        activeSectionId={activeSectionId}
        onSectionChange={onSectionChange}
        sections={productsSections}
      />
      <ProductTemplateHero activeSection={activeSection} onAction={onHeroAction} />
      <ProductMetricGrid activeSection={{ ...activeSection, metrics }} />
      <div className="products-list-toolbar">
        <span aria-hidden="true" />
        <div className="products-toolbar-actions">
          <label className="sales-search-control">
            <Search aria-hidden="true" size={24} />
            <input
              aria-label={activeSection.searchLabel}
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
      </div>

      {showFilters ? (
        <div className="sales-filter-strip">
          <span>Filtros activos</span>
          <button type="button">Estado: todos</button>
          <button type="button">Vigencia: actual</button>
        </div>
      ) : null}

      {showColumns ? (
        <div className="sales-filter-strip columns-strip">
          <span>Columnas visibles</span>
          {activeSection.columns.map((column) => (
            <button key={column} type="button">{column}</button>
          ))}
        </div>
      ) : null}

      <div className="products-reference-panel product-template-table-panel">
        <div className="sales-template-table-head">
          <h2>{activeSection.tableTitle}</h2>
          {isProductsSection ? (
            <div className="products-category-filter" role="tablist" aria-label="Filtrar por categoria">
              {([
                { id: "all", label: "Todos" },
                { id: "product", label: "Productos" },
                { id: "service", label: "Servicios" }
              ] as const).map((option) => (
                <button
                  aria-selected={categoryFilter === option.id}
                  className={`products-category-filter-button${categoryFilter === option.id ? " active" : ""}`}
                  key={option.id}
                  onClick={() => setCategoryFilter(option.id)}
                  role="tab"
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <table className="products-data-table">
          <thead>
            <tr>
              {activeSection.columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          {visibleProducts.length > 0 ? (
            <tbody>
              {visibleProducts.map((product) => (
                <tr key={product.id}>
                  <td>{product.code || "—"}</td>
                  <td>{product.name}</td>
                  <td>{product.kind === "service" ? "Servicio" : "Producto"}</td>
                  <td>{productUnitMeasureLabel(product.unitMeasure)}</td>
                  <td>{product.taxRate === null ? "—" : `${product.taxRate} %`}</td>
                  <td>{formatMoney(product.unitPrice)}</td>
                  <td>{product.isActive ? "Activo" : "Inactivo"}</td>
                  <td>
                    <div className="products-row-actions">
                      <button
                        aria-expanded={openActionMenu?.id === product.id}
                        aria-label={`Acciones de ${product.name}`}
                        className="sage-table-button"
                        disabled={pendingActionId === product.id}
                        onClick={(event) => toggleProductActionMenu(product.id, event.currentTarget)}
                        type="button"
                      >
                        <MoreVertical aria-hidden="true" size={22} />
                      </button>
                      {openActionMenu?.id === product.id ? (
                        <div
                          className="sales-popover products-actions-popover"
                          role="menu"
                          style={{ left: `${openActionMenu.left}px`, top: `${openActionMenu.top}px` }}
                        >
                          <button
                            onClick={() => {
                              setOpenActionMenu(null);
                              onEditProduct(product);
                            }}
                            type="button"
                          >
                            Editar
                          </button>
                          <button onClick={() => { void handleDuplicateProduct(product); }} type="button">
                            Duplicar
                          </button>
                          <button
                            onClick={() => {
                              void runProductAction(
                                product,
                                () => toggleProductServiceActive(organizationId, product.id, !product.isActive),
                                `${product.name} ${product.isActive ? "desactivado" : "activado"}.`
                              ).then((ok) => {
                                if (!ok) return;
                                onProductsChange((current) => current.map((item) => (
                                  item.id === product.id ? { ...item, isActive: !item.isActive } : item
                                )));
                              });
                            }}
                            type="button"
                          >
                            {product.isActive ? "Desactivar" : "Activar"}
                          </button>
                          <button
                            className="danger"
                            onClick={() => {
                              void runProductAction(
                                product,
                                () => softDeleteProductService(organizationId, product.id),
                                `${product.name} eliminado.`
                              ).then((ok) => {
                                if (!ok) return;
                                onProductsChange((current) => current.filter((item) => item.id !== product.id));
                              });
                            }}
                            type="button"
                          >
                            Eliminar
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          ) : null}
          {visiblePriceLists.length > 0 ? (
            <tbody>
              {visiblePriceLists.map((pl) => (
                <tr key={pl.id}>
                  <td>{pl.code}</td>
                  <td>{pl.name}</td>
                  <td>{pl.startDate ?? "—"}</td>
                  <td>{pl.endDate ?? "—"}</td>
                  <td>{adjustmentTypeLabel(pl.adjustmentType)}</td>
                  <td>{pl.isActive ? "Sí" : "No"}</td>
                  <td>—</td>
                </tr>
              ))}
            </tbody>
          ) : null}
          {visibleDiscountGroups.length > 0 ? (
            <tbody>
              {visibleDiscountGroups.map((dg) => (
                <tr key={dg.id}>
                  <td>{dg.code}</td>
                  <td>{dg.name}</td>
                  <td>{dg.startDate ?? "—"}</td>
                  <td>{dg.endDate ?? "—"}</td>
                  <td>{dg.isActive ? "Sí" : "No"}</td>
                  <td>—</td>
                </tr>
              ))}
            </tbody>
          ) : null}
        </table>
        {isProductsSection && visibleProducts.length === 0 ? (
          <div className="products-empty-state">
            <SearchX aria-hidden="true" size={94} strokeWidth={2.7} />
            <strong>{activeSection.emptyTitle}</strong>
            <p>{activeSection.emptyDescription}</p>
          </div>
        ) : isTariffsSection && visiblePriceLists.length === 0 ? (
          <div className="products-empty-state">
            <SearchX aria-hidden="true" size={94} strokeWidth={2.7} />
            <strong>{activeSection.emptyTitle}</strong>
            <p>{activeSection.emptyDescription}</p>
          </div>
        ) : activeSectionId === "discount-groups" && visibleDiscountGroups.length === 0 ? (
          <div className="products-empty-state">
            <SearchX aria-hidden="true" size={94} strokeWidth={2.7} />
            <strong>{activeSection.emptyTitle}</strong>
            <p>{activeSection.emptyDescription}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ProductTemplateHero({
  activeSection,
  onAction
}: {
  activeSection: ProductsSection;
  onAction: (kind: ProductsHeroAction) => void;
}) {
  return (
    <section className="sales-template-hero product-template-hero" aria-label={activeSection.title}>
      <div>
        <h1>{activeSection.title}</h1>
      </div>
      <div className="sales-template-hero-actions">
        {activeSection.actions.map((action) => (
          <button key={action.label} onClick={() => onAction(action.kind)} type="button">{action.label}</button>
        ))}
      </div>
    </section>
  );
}

function ProductMetricGrid({ activeSection }: { activeSection: ProductsSection }) {
  return (
    <section className="sales-template-metrics product-template-metrics" aria-label={`Resumen de ${activeSection.label.toLowerCase()}`}>
      {activeSection.metrics.map((metric) => (
        <article className="sales-template-metric" key={metric.label}>
          <span className={`sales-template-metric-icon ${metric.tone}`}>
            <BarChart3 aria-hidden="true" size={20} strokeWidth={2.3} />
          </span>
          <strong>{metric.value}</strong>
          <h2>{metric.label}</h2>
        </article>
      ))}
    </section>
  );
}

function ProductSectionTabs({
  activeSectionId,
  onSectionChange,
  sections
}: {
  activeSectionId: ProductsSectionId;
  onSectionChange: (sectionId: ProductsSectionId) => void;
  sections: ProductsSection[];
}) {
  return (
    <div className="fiscal-tabs sales-section-tabs product-section-tabs" role="tablist" aria-label="Subsecciones de productos y servicios">
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

function resolveProductsSectionId(view: ProductsView): ProductsSectionId {
  if (view === "tariffs" || view === "tariff-form") {
    return "tariffs";
  }

  if (view === "discount-groups" || view === "discount-form") {
    return "discount-groups";
  }

  return "products";
}

const taxGroupOptions = [
  { label: "General - 21 %", rate: 21 },
  { label: "Reducido - 10 %", rate: 10 },
  { label: "Superreducido - 4 %", rate: 4 },
  { label: "Exento - 0 %", rate: 0 }
];

// Propone el siguiente codigo correlativo por categoria: PR-001 para productos, SE-001 para servicios.
function suggestNextProductCode(products: ProductItem[], category: ProductCategory): string {
  const prefix = category === "service" ? "SE" : "PR";
  const maxNumeric = products
    .filter((product) => product.kind === category)
    .reduce((max, product) => {
      const numeric = Number(String(product.code).replace(/\D/g, ""));
      return Number.isFinite(numeric) && numeric > max ? numeric : max;
    }, 0);

  return `${prefix}-${String(maxNumeric + 1).padStart(3, "0")}`;
}

function ProductServiceForm({
  initialProduct,
  initialCategory = "product",
  products = [],
  organizationId,
  onCancel,
  onSaved
}: {
  initialProduct?: ProductItem | null;
  initialCategory?: ProductCategory;
  products?: ProductItem[];
  organizationId: string;
  onCancel: () => void;
  onSaved: (product: ProductItem) => void;
}) {
  const [activeTab, setActiveTab] = useState<ProductFormTab>("basic");
  const [category, setCategory] = useState<ProductCategory>(initialProduct?.kind ?? initialCategory);
  const [codeEdited, setCodeEdited] = useState(false);
  const [code, setCode] = useState(initialProduct?.code ?? suggestNextProductCode(products, initialProduct?.kind ?? initialCategory));
  // Al cambiar de categoria, si el codigo no se ha tocado a mano, reproponemos el prefijo (PR-/SE-).
  const changeCategory = (nextCategory: ProductCategory) => {
    setCategory(nextCategory);
    if (!initialProduct && !codeEdited) {
      setCode(suggestNextProductCode(products, nextCategory));
    }
  };
  const [name, setName] = useState(initialProduct?.name ?? "");
  const [unitMeasure, setUnitMeasure] = useState<ProductUnitMeasure>(initialProduct?.unitMeasure ?? "hour");
  const [description, setDescription] = useState(initialProduct?.description ?? "");
  const [internalComments, setInternalComments] = useState("");
  const [price, setPrice] = useState(initialProduct ? String(initialProduct.unitPrice).replace(".", ",") : "");
  const [discountPercent, setDiscountPercent] = useState("");
  const [taxGroup, setTaxGroup] = useState(
    taxGroupOptions.find((option) => option.rate === (initialProduct?.taxRate ?? 21))?.label ?? taxGroupOptions[0]!.label
  );
  const [inactive, setInactive] = useState(initialProduct ? !initialProduct.isActive : false);
  const [blockOrders, setBlockOrders] = useState(false);
  const [blockDeliveryNotes, setBlockDeliveryNotes] = useState(false);
  const [blockInvoices, setBlockInvoices] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const taxRate = taxGroupOptions.find((option) => option.label === taxGroup)?.rate ?? 21;
  const priceValue = parseSpanishNumber(price);
  const discountPercentValue = parseSpanishNumber(discountPercent);
  const discountAmount = priceValue * (discountPercentValue / 100);
  const discountedPrice = Math.max(priceValue - discountAmount, 0);
  const taxAmount = discountedPrice * (taxRate / 100);
  const priceWithTax = discountedPrice + taxAmount;
  const isEditing = Boolean(initialProduct);
  const canCreate = code.trim().length > 0 && name.trim().length > 0 && !isSaving;

  const requestCreate = () => {
    if (activeTab === "basic") {
      window.alert(`Dirígete a Precios y descuento de venta para continuar con la ${isEditing ? "edición" : "creación"} del Servicio.`);
      setActiveTab("pricing");
      return;
    }

    void submitProduct();
  };

  const submitProduct = async () => {
    const formData = new FormData();

    formData.set("organization_id", organizationId);
    if (initialProduct) {
      formData.set("product_id", initialProduct.id);
    }
    formData.set("code", code.trim());
    formData.set("name", name.trim());
    formData.set("kind", category);
    formData.set("unit_measure", unitMeasure);
    formData.set("unit_price", String(priceValue));
    formData.set("tax_rate", String(taxRate));
    formData.set("is_active", String(!inactive));
    formData.set("description", description.trim());

    setSubmitError(null);
    setIsSaving(true);

    const savedProductId = initialProduct?.id ?? "";

    if (initialProduct) {
      const result = await updateProductService(formData);

      setIsSaving(false);

      if (result.error) {
        setSubmitError(result.error);
        return;
      }
    } else {
      const result = await createProductService(formData);

      setIsSaving(false);

      if (result.error || !result.product) {
        setSubmitError(result.error ?? "No se pudo guardar el producto o servicio.");
        return;
      }

      formData.set("product_id", result.product.id);
    }

    onSaved({
      id: initialProduct?.id ?? String(formData.get("product_id") ?? savedProductId),
      code: code.trim(),
      name: name.trim(),
      kind: category,
      description: description.trim(),
      unitMeasure,
      unitPrice: priceValue,
      taxRate,
      isActive: !inactive
    });
  };

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
                onChange={() => changeCategory("product")}
                type="radio"
              />
              <span>Producto</span>
            </label>
            <label className="product-radio-row">
              <input
                checked={category === "service"}
                onChange={() => changeCategory("service")}
                type="radio"
              />
              <span>Servicio</span>
            </label>
          </fieldset>

          <label className="sage-field product-code-field">
            <span>Codigo <RequiredMark /></span>
            <input
              onChange={(event) => { setCode(event.target.value); setCodeEdited(true); }}
              value={code}
            />
          </label>

          <label className="sage-field product-name-field">
            <span>Nombre <RequiredMark /></span>
            <input onChange={(event) => setName(event.target.value)} value={name} />
          </label>

          <label className="sage-field product-unit-field">
            <span>Unidad de medida</span>
            <ProductUnitMeasurePicker value={unitMeasure} onChange={setUnitMeasure} />
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
            <select value={taxGroup} onChange={(event) => setTaxGroup(event.target.value)}>
              {taxGroupOptions.map((option) => (
                <option key={option.label}>{option.label}</option>
              ))}
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
                <input inputMode="decimal" onChange={(event) => setPrice(event.target.value)} placeholder="0,00" value={price} />
              </label>
              <label className="sage-field product-money-field">
                <span>Porcentaje de descuento</span>
                <input inputMode="decimal" onChange={(event) => setDiscountPercent(event.target.value)} placeholder="0,00" value={discountPercent} />
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
              <label className="sage-field product-money-field product-price-with-tax-field">
                <span>Precio con IVA y descuento</span>
                <input readOnly value={formatMoney(priceWithTax)} />
              </label>
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

      {submitError ? <div className="sales-live-notice warning" role="alert">{submitError}</div> : null}
      <ProductStickyBar
        canCreate={canCreate}
        isPending={isSaving}
        onCancel={onCancel}
        onCreate={requestCreate}
        submitLabel={isEditing ? "Guardar" : "Crear"}
        summaries={[
          { label: "Precio", value: priceValue },
          { label: "Precio con IVA y descuento", value: priceWithTax }
        ]}
      />
    </section>
  );
}

type TariffItemRow = { id: number };
type DiscountItemRow = { id: number };

function TariffForm({
  organizationId,
  onCancel,
  onCreated
}: {
  organizationId: string;
  onCancel: () => void;
  onCreated: (pl: PriceListItem) => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [adjustmentType, setAdjustmentType] = useState("Precio fijo");
  const [startDate, setStartDate] = useState("10/06/2026");
  const [endDate, setEndDate] = useState("");
  const [active, setActive] = useState(true);
  const [items, setItems] = useState<TariffItemRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const canCreate = code.trim().length > 0 && name.trim().length > 0 && !isSaving;

  const submit = async () => {
    const formData = new FormData();
    formData.set("organization_id", organizationId);
    formData.set("code", code.trim());
    formData.set("name", name.trim());
    formData.set("adjustment_type", adjustmentType);
    formData.set("start_date", startDate);
    formData.set("end_date", endDate);
    formData.set("is_active", String(active));
    setSubmitError(null);
    setIsSaving(true);
    const result = await createPriceList(formData);
    setIsSaving(false);
    if (result.error || !result.priceList) {
      setSubmitError(result.error ?? "No se pudo guardar la tarifa.");
      return;
    }
    const adjustmentTypeMap: Record<string, PriceListItem["adjustmentType"]> = {
      "Precio fijo": "fixed_price",
      "Descuento porcentual": "percentage_discount",
      "Precio por tramo": "tiered"
    };
    onCreated({
      id: result.priceList.id,
      code: code.trim(),
      name: name.trim(),
      adjustmentType: adjustmentTypeMap[adjustmentType] ?? "fixed_price",
      startDate: startDate || null,
      endDate: endDate || null,
      isActive: active
    });
  };

  return (
    <section className="product-reference-form" aria-label="Tarifa">
      <ReferenceFormHeader onCancel={onCancel} title="Tarifa" />
      <div className="product-reference-grid tariff-reference-grid">
        <RequiredTextField label="Codigo" onChange={setCode} value={code} />
        <RequiredTextField label="Nombre" onChange={setName} value={name} />
        <label className="sage-field">
          <span>Tipo de ajuste <RequiredMark /></span>
          <select value={adjustmentType} onChange={(e) => setAdjustmentType(e.target.value)}>
            <option>Precio fijo</option>
            <option>Descuento porcentual</option>
            <option>Precio por tramo</option>
          </select>
        </label>
        <label className="sage-field">
          <span>Fecha de inicio</span>
          <DateInput value={startDate} onChange={setStartDate} />
        </label>
        <label className="sage-field">
          <span>Fecha de fin</span>
          <DateInput value={endDate} onChange={setEndDate} />
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
      {submitError ? <div className="sales-live-notice warning" role="alert">{submitError}</div> : null}
      <ProductStickyBar canCreate={canCreate} isPending={isSaving} onCancel={onCancel} onCreate={() => { void submit(); }} />
    </section>
  );
}

function DiscountGroupForm({
  organizationId,
  onCancel,
  onCreated
}: {
  organizationId: string;
  onCancel: () => void;
  onCreated: (dg: DiscountGroupItem) => void;
}) {
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("10/06/2026");
  const [endDate, setEndDate] = useState("");
  const [active, setActive] = useState(true);
  const [items, setItems] = useState<DiscountItemRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const canCreate = code.trim().length > 0 && description.trim().length > 0 && !isSaving;

  const submit = async () => {
    const formData = new FormData();
    formData.set("organization_id", organizationId);
    formData.set("code", code.trim());
    formData.set("name", description.trim());
    formData.set("start_date", startDate);
    formData.set("end_date", endDate);
    formData.set("is_active", String(active));
    setSubmitError(null);
    setIsSaving(true);
    const result = await createDiscountGroup(formData);
    setIsSaving(false);
    if (result.error || !result.discountGroup) {
      setSubmitError(result.error ?? "No se pudo guardar el grupo de descuentos.");
      return;
    }
    onCreated({
      id: result.discountGroup.id,
      code: code.trim(),
      name: description.trim(),
      startDate: startDate || null,
      endDate: endDate || null,
      isActive: active
    });
  };

  return (
    <section className="product-reference-form" aria-label="Grupo de descuentos">
      <ReferenceFormHeader onCancel={onCancel} title="Grupo de descuentos" />
      <div className="product-reference-grid discount-reference-grid">
        <RequiredTextField label="Codigo" onChange={setCode} value={code} />
        <RequiredTextField label="Descripcion" onChange={setDescription} value={description} />
        <label className="sage-field">
          <span>Fecha de inicio</span>
          <DateInput value={startDate} onChange={setStartDate} />
        </label>
        <label className="sage-field">
          <span>Fecha de fin</span>
          <DateInput value={endDate} onChange={setEndDate} />
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
      {submitError ? <div className="sales-live-notice warning" role="alert">{submitError}</div> : null}
      <ProductStickyBar canCreate={canCreate} isPending={isSaving} onCancel={onCancel} onCreate={() => { void submit(); }} />
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

function DateInput({
  defaultValue,
  value,
  onChange
}: {
  defaultValue?: string;
  value?: string;
  onChange?: (v: string) => void;
}) {
  return (
    <span className="date-input-shell">
      {value !== undefined
        ? <input value={value} onChange={(e) => onChange?.(e.target.value)} />
        : <input defaultValue={defaultValue ?? ""} />
      }
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
  isPending = false,
  onCancel,
  onCreate,
  submitLabel = "Crear",
  summaries = []
}: {
  canCreate: boolean;
  isPending?: boolean;
  onCancel?: () => void;
  onCreate?: () => void;
  submitLabel?: string;
  summaries?: Array<{ label: string; value: number }>;
}) {
  return (
    <footer className="quote-sticky-bar product-sticky-bar">
      {summaries.map((summary) => (
        <SummaryBox key={summary.label} label={summary.label} value={summary.value} />
      ))}
      <button className="quote-cancel-action" onClick={onCancel} type="button">Cancelar</button>
      <button className="quote-create-action" disabled={!canCreate} onClick={canCreate ? onCreate : undefined} type="button">
        {isPending ? "Guardando..." : submitLabel}
      </button>
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

function ProductUnitMeasurePicker({
  value,
  onChange
}: {
  value: ProductUnitMeasure;
  onChange: (value: ProductUnitMeasure) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = productUnitMeasureOptions.find((option) => option.value === value) ?? productUnitMeasureOptions[1]!;

  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [isOpen]);

  return (
    <div className="product-unit-picker" ref={pickerRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="product-unit-trigger"
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setIsOpen(false);
          }
        }}
        type="button"
      >
        <span>{productUnitMeasureLabel(selectedOption.value)}</span>
        <ChevronDown aria-hidden="true" size={18} />
      </button>

      {isOpen ? (
        <div className="product-unit-menu" role="listbox" aria-label="Unidad de medida">
          <div className="product-unit-menu-head" aria-hidden="true">
            <span>Nombre</span>
            <span>Abreviatura</span>
          </div>
          {productUnitMeasureOptions.map((option) => (
            <button
              aria-selected={option.value === value}
              className={option.value === value ? "is-selected" : ""}
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              role="option"
              type="button"
            >
              <span>{option.name}</span>
              <span>{option.abbreviation || "—"}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
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
