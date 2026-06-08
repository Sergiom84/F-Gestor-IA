"use client";

import {
  CalendarDays,
  Check,
  ChevronDown,
  Download,
  Eye,
  Filter,
  MoreVertical,
  PenLine,
  Plus,
  Search,
  SearchX,
  Settings,
  Trash2,
  X
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  artificialClosingPeriods,
  artificialMatchingCategories,
  artificialMatchingLines,
  artificialMatchingSubjects
} from "../../_data/artificial-business-data";
import type {
  ArtificialClosingPeriod,
  ArtificialMatchingLine,
  ArtificialMatchingSubject
} from "../../_data/artificial-business-data";
import { formatMoney } from "../../_lib/formatters";

type AccountingSectionId = "entries" | "matching" | "closings" | "fixed-assets" | "fixed-asset-transactions";
type EntryView = "list" | "form";
type MatchingStatus = "Apuntes sin marcar" | "Apuntes marcados" | "Todos";

type AccountingSection = {
  id: AccountingSectionId;
  label: string;
  group?: "matching" | "closings";
};

type MatchingSubject = ArtificialMatchingSubject;
type MatchingLine = ArtificialMatchingLine;
type ClosingPeriod = ArtificialClosingPeriod;

const accountingSections: AccountingSection[] = [
  { id: "entries", label: "Asientos" },
  { id: "matching", label: "Marcaje", group: "matching" },
  { id: "closings", label: "Cierres", group: "closings" },
  { id: "fixed-assets", label: "Inmovilizado" },
  { id: "fixed-asset-transactions", label: "Transacciones de inmovilizado" }
];

const matchingCategories = artificialMatchingCategories;
const matchingSubjects: MatchingSubject[] = artificialMatchingSubjects;
const matchingLines: Record<string, MatchingLine[]> = artificialMatchingLines;
const closingPeriods: ClosingPeriod[] = artificialClosingPeriods;

export function AccountingWorkspace({ organizationName }: { organizationName: string }) {
  const [activeSectionId, setActiveSectionId] = useState<AccountingSectionId>("entries");
  const [entryView, setEntryView] = useState<EntryView>("list");
  const activeSection = accountingSections.find((section) => section.id === activeSectionId) ?? accountingSections[0]!;

  const openSection = (sectionId: AccountingSectionId) => {
    setActiveSectionId(sectionId);
    setEntryView("list");
  };

  return (
    <section className="accounting-module-shell" aria-label={`Contabilidad de ${organizationName}`}>
      <aside className="accounting-secondary-nav" aria-label="Navegacion de contabilidad">
        {accountingSections.map((section) => (
          <button
            className={`accounting-secondary-link${section.id === activeSectionId ? " active" : ""}${section.group ? " grouped" : ""}`}
            key={section.id}
            onClick={() => openSection(section.id)}
            type="button"
          >
            {section.group ? <ChevronDown aria-hidden="true" size={22} /> : null}
            <span>{section.label}</span>
          </button>
        ))}
      </aside>

      <div className="accounting-operation-surface">
        {activeSection.id === "entries" ? (
          entryView === "form" ? (
            <EntryForm onCancel={() => setEntryView("list")} />
          ) : (
            <EntriesList onCreate={() => setEntryView("form")} />
          )
        ) : activeSection.id === "matching" ? (
          <MatchingWorkspace />
        ) : activeSection.id === "closings" ? (
          <ClosingsWorkspace />
        ) : activeSection.id === "fixed-assets" ? (
          <ReferenceWorkspace
            title="Inmovilizado"
            description=""
            columns={["Codigo", "Descripcion", "Fecha de alta", "Cuenta", "Valor", "Estado", "Editar", "Eliminar"]}
          />
        ) : (
          <ReferenceWorkspace
            title="Transacciones de inmovilizado"
            description="Operaciones de alta, baja, amortizacion y regularizacion de activos."
            columns={["Fecha", "Activo", "Tipo", "Cuenta", "Importe", "Estado", "Editar", "Eliminar"]}
          />
        )}
      </div>
    </section>
  );
}

function EntriesList({ onCreate }: { onCreate: () => void }) {
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <header className="accounting-operation-header">
        <h1>Asientos</h1>
        <div className="accounting-header-actions">
          <button className="accounting-text-action" type="button">
            <Download aria-hidden="true" size={22} />
            Importar asientos
          </button>
          <div className="sales-settings-menu">
            <button className="sales-settings-button" onClick={() => setShowSettings((current) => !current)} type="button">
              <Settings aria-hidden="true" size={27} fill="currentColor" />
              <span>Configuracion</span>
              <ChevronDown aria-hidden="true" size={15} />
            </button>
            {showSettings ? (
              <div className="sales-popover settings-popover" role="menu">
                <button type="button">Diarios contables</button>
                <button type="button">Plan contable</button>
                <button type="button">Periodos y cierres</button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <section className="accounting-list-toolbar" aria-label="Filtros de asientos">
        <button className="sage-primary-button" onClick={onCreate} type="button">
          <Plus aria-hidden="true" size={22} />
          Crear
        </button>
        <AccountingField label="Diario">
          <select defaultValue="">
            <option value="">Seleccionar...</option>
            <option>VEN - Facturas emitidas</option>
            <option>COM - Facturas recibidas</option>
            <option>GEN - Operaciones generales</option>
          </select>
        </AccountingField>
        <AccountingField label="Ejercicio">
          <select defaultValue="2026">
            <option>2026</option>
            <option>2025</option>
          </select>
        </AccountingField>
        <AccountingField label="Mes">
          <select defaultValue="Junio">
            <option>Junio</option>
            <option>Mayo</option>
            <option>Abril</option>
          </select>
        </AccountingField>
        <AccountingField label="Fecha de inicio">
          <DateInput defaultValue="01/06/2026" />
        </AccountingField>
        <AccountingField label="Fecha de fin">
          <DateInput defaultValue="30/06/2026" />
        </AccountingField>
        <div className="accounting-toolbar-spacer" />
        <label className="sales-search-control">
          <Search aria-hidden="true" size={25} />
          <input
            aria-label="Buscar asientos"
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
      </section>

      {showFilters ? (
        <div className="sales-filter-strip accounting-filter-strip">
          <span>Filtros activos</span>
          <button type="button">Pendientes</button>
          <button type="button">Descuadrados</button>
          <button type="button">Importados</button>
        </div>
      ) : null}

      <section className="sage-list-panel accounting-list-panel" aria-label="Lista de asientos">
        <AccountingTable
          columns={["Numero", "Diario", "Fecha", "Numero de docu...", "Fecha de docum...", "Estado", "Cuenta", "Tercero", "Descripcion", "Editar", "Eliminar"]}
          minWidth={1320}
        >
          <tr>
            <td colSpan={11}>
              <AccountingEmptyState
                title="Esta lista esta en blanco."
                description="La busqueda no ha dado ningun resultado. Intentalo de nuevo."
              />
            </td>
          </tr>
        </AccountingTable>
      </section>
    </>
  );
}

function EntryForm({ onCancel }: { onCancel: () => void }) {
  return (
    <section className="accounting-entry-form" aria-label="Formulario de asiento">
      <header className="accounting-form-header">
        <div>
          <h1>Asiento</h1>
          <p>Utiliza esta funcion para crear y actualizar asientos.</p>
        </div>
        <button className="quote-close-button" onClick={onCancel} type="button" aria-label="Cerrar formulario de asiento">
          <X aria-hidden="true" size={34} />
        </button>
      </header>

      <section className="entry-main-card">
        <div className="entry-main-grid">
          <label className="sage-field entry-journal-field required-error">
            <span>Diario <RequiredMark /></span>
            <strong>Campo obligatorio</strong>
            <select defaultValue="">
              <option value="">Seleccionar...</option>
              <option>GEN - Operaciones generales</option>
              <option>VEN - Facturas emitidas</option>
              <option>COM - Facturas recibidas</option>
            </select>
          </label>
          <label className="sage-field">
            <span>Fecha <RequiredMark /></span>
            <DateInput defaultValue="04/06/2026" />
          </label>
          <label className="sage-field entry-description-field">
            <span>Descripcion</span>
            <input />
          </label>
          <label className="sage-field">
            <span>Fecha de documento</span>
            <DateInput defaultValue="04/06/2026" />
          </label>
          <label className="sage-field">
            <span>Numero de documento</span>
            <input />
          </label>
          <label className="sage-field">
            <span>Divisa</span>
            <input disabled value="EUR" readOnly />
          </label>
        </div>
      </section>

      <section className="sage-list-panel entry-lines-panel" aria-label="Lineas del asiento">
        <AccountingTable columns={["Cuenta", "Tercero", "Descripcion", "Debe", "Haber", "Editar", "Eliminar"]} minWidth={920}>
          <tr>
            <td colSpan={7} className="entry-empty-row">Esta lista esta en blanco.</td>
          </tr>
        </AccountingTable>
      </section>

      <button className="entry-balance-button" disabled type="button">Saldar</button>
    </section>
  );
}

function MatchingWorkspace() {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(matchingSubjects[0]?.id ?? null);
  const [status, setStatus] = useState<MatchingStatus>("Apuntes sin marcar");
  const [showFilters, setShowFilters] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const selectedSubject = matchingSubjects.find((subject) => subject.id === selectedSubjectId) ?? null;
  const lines = selectedSubject ? (matchingLines[selectedSubject.id] ?? []) : [];
  const filteredSubjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return matchingSubjects.filter((subject) => {
      const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(subject.category);
      const matchesQuery = !normalizedQuery
        || subject.name.toLowerCase().includes(normalizedQuery)
        || subject.type.toLowerCase().includes(normalizedQuery);

      return matchesCategory && matchesQuery;
    });
  }, [query, selectedCategories]);
  const balance = lines.reduce((total, line) => total + line.debit - line.credit, 0);

  const toggleCategory = (category: string) => {
    setSelectedCategories((current) => (
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category]
    ));
  };

  const categoryLabel = selectedCategories.length === 0
    ? "Seleccionar..."
    : `${selectedCategories.length} seleccionadas`;

  return (
    <section className="matching-workspace" aria-label="Marcaje contable">
      <aside className="matching-left-pane">
        <header className="matching-pane-header">
          <h1>Marcaje</h1>
          <ChevronDown aria-hidden="true" size={25} />
        </header>

        <div className="matching-category-select">
          <button
            aria-expanded={showCategoryMenu}
            className="matching-category-button"
            onClick={() => setShowCategoryMenu((current) => !current)}
            type="button"
          >
            <span>{categoryLabel}</span>
            <ChevronDown aria-hidden="true" size={19} />
          </button>
          {showCategoryMenu ? (
            <div className="matching-category-menu">
              <label className="matching-check-row">
                <input
                  checked={selectedCategories.length === matchingCategories.length}
                  onChange={() => setSelectedCategories(selectedCategories.length === matchingCategories.length ? [] : matchingCategories)}
                  type="checkbox"
                />
                <span>Seleccionar todo</span>
              </label>
              {matchingCategories.map((category) => (
                <label className="matching-check-row" key={category}>
                  <input checked={selectedCategories.includes(category)} onChange={() => toggleCategory(category)} type="checkbox" />
                  <span>{category}</span>
                </label>
              ))}
            </div>
          ) : null}
        </div>

        <label className="sales-search-control matching-search-control">
          <Search aria-hidden="true" size={25} />
          <input
            aria-label="Buscar tercero o cuenta"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar..."
            type="search"
            value={query}
          />
        </label>

        <div className="matching-subject-list">
          {filteredSubjects.map((subject) => (
            <button
              className={`matching-subject-row${subject.id === selectedSubject?.id ? " active" : ""}`}
              key={subject.id}
              onClick={() => setSelectedSubjectId(subject.id)}
              type="button"
            >
              <span>
                <strong>{subject.name}</strong>
                <small>{subject.count}</small>
                <small>{formatMoney(subject.amount)}</small>
              </span>
              <em>{subject.type}</em>
            </button>
          ))}
        </div>
        <footer className="matching-count">{filteredSubjects.length} elementos</footer>
      </aside>

      <section className="matching-main-pane">
        <h1>{selectedSubject?.name ?? "—"}</h1>
        <div className="matching-filter-grid">
          <AccountingField label="Estado">
            <select value={status} onChange={(event) => setStatus(event.target.value as MatchingStatus)}>
              <option>Apuntes sin marcar</option>
              <option>Apuntes marcados</option>
              <option>Todos</option>
            </select>
          </AccountingField>
          <AccountingField label="Inicio de ejercicio">
            <select defaultValue="2025">
              <option>2025</option>
              <option>2026</option>
            </select>
          </AccountingField>
          <AccountingField label="Fin de ejercicio">
            <input disabled value="2026" readOnly />
          </AccountingField>
        </div>

        <div className="matching-actions-row">
          <button className="sage-outline-button" disabled={lines.length === 0} type="button">
            Exportar
            <ChevronDown aria-hidden="true" size={15} />
          </button>
          <button className="sage-outline-button" onClick={() => setShowColumns((current) => !current)} type="button">Personalizar</button>
          <button className="sage-outline-button" onClick={() => setShowFilters((current) => !current)} type="button">
            <Filter aria-hidden="true" size={20} fill="currentColor" />
            Filtrar
          </button>
        </div>

        {showColumns || showFilters ? (
          <div className="sales-filter-strip accounting-filter-strip">
            <span>{showColumns ? "Columnas" : "Filtros"}</span>
            <button type="button">Diario</button>
            <button type="button">Cuenta</button>
            <button type="button">Marca</button>
          </div>
        ) : null}

        <section className="matching-table-shell" aria-label="Apuntes para marcar">
          <AccountingTable
            columns={["", "Diario", "Fecha", "Nume...", "Numero de docum...", "Cuenta", "Descripcion", "D", "Marca", "Ver"]}
            minWidth={1220}
          >
            {lines.length > 0 ? (
              lines.map((line) => (
                <tr key={line.id}>
                  <td><input aria-label={`Seleccionar ${line.description}`} type="checkbox" /></td>
                  <td>{line.journal}</td>
                  <td>{line.date}</td>
                  <td>{line.entryNumber}</td>
                  <td>{line.documentNumber}</td>
                  <td>{line.account}</td>
                  <td>{line.description}</td>
                  <td>{line.debit > 0 ? formatMoney(line.debit) : ""}</td>
                  <td>{line.mark}</td>
                  <td>
                    <button className="sage-table-button" type="button" aria-label="Ver apunte">
                      <Eye aria-hidden="true" size={20} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={10}>
                  <AccountingEmptyState
                    title="Esta lista esta en blanco."
                    description="No hay apuntes para la combinacion seleccionada."
                  />
                </td>
              </tr>
            )}
          </AccountingTable>
          <div className="matching-table-footer" />
        </section>

        <footer className="matching-sticky-bar">
          <SummaryBox label="Saldo de cuenta" value={formatMoney(selectedSubject?.amount ?? 0)} />
          <SummaryBox label="Descuadre" value={formatMoney(balance - (selectedSubject?.amount ?? 0))} />
          <button className="matching-cancel-button" type="button">Cancelar</button>
          <button className="entry-balance-button matching-mark-button" disabled={lines.length === 0} type="button">Marcar</button>
        </footer>
      </section>
    </section>
  );
}

function ClosingsWorkspace() {
  return (
    <section className="closings-workspace" aria-label="Cierres contables">
      <header className="accounting-operation-header">
        <h1>Cierres</h1>
        <div className="accounting-header-actions">
          <button className="sage-outline-button" type="button">
            <Download aria-hidden="true" size={20} />
            Exportar
          </button>
          <button className="sage-primary-button" type="button">
            <Check aria-hidden="true" size={20} />
            Preparar cierre
          </button>
        </div>
      </header>

      <section className="closing-summary-grid" aria-label="Resumen de cierres">
        <ClosingCard title="Cierre mensual" value="Sin datos" description="" />
        <ClosingCard title="Cierre de ejercicio" value="Sin datos" description="" />
        <ClosingCard title="FEC" value="Sin datos" description="" />
      </section>

      <section className="sage-list-panel accounting-list-panel" aria-label="Periodos de cierre">
        <AccountingTable columns={["Periodo", "Tipo", "Estado", "Controles", "Fecha", "Acciones"]} minWidth={900}>
          {closingPeriods.map((period) => (
            <tr key={period.id}>
              <td>{period.period}</td>
              <td>{period.kind}</td>
              <td><span className={`closing-status ${period.status.toLowerCase()}`}>{period.status}</span></td>
              <td>{period.checks}</td>
              <td>{period.date}</td>
              <td>
                <button className="sage-table-button" type="button" aria-label={`Editar ${period.period}`}>
                  <MoreVertical aria-hidden="true" size={20} />
                </button>
              </td>
            </tr>
          ))}
        </AccountingTable>
      </section>
    </section>
  );
}

function ReferenceWorkspace({
  title,
  description,
  columns
}: {
  title: string;
  description: string;
  columns: string[];
}) {
  return (
    <section className="accounting-reference-workspace" aria-label={title}>
      <header className="accounting-operation-header">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <button className="sage-primary-button" type="button">
          <Plus aria-hidden="true" size={22} />
          Crear
        </button>
      </header>
      <section className="sage-list-panel accounting-list-panel" aria-label={`Lista de ${title}`}>
        <AccountingTable columns={columns} minWidth={980}>
          <tr>
            <td colSpan={columns.length}>
              <AccountingEmptyState
                title="Esta lista esta en blanco."
                description="Cuando conectemos el modelo contable real, los registros apareceran aqui."
              />
            </td>
          </tr>
        </AccountingTable>
      </section>
    </section>
  );
}

function AccountingField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="accounting-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function AccountingTable({
  columns,
  minWidth,
  children
}: {
  columns: string[];
  minWidth: number;
  children: ReactNode;
}) {
  return (
    <div className="accounting-table-wrap">
      <table className="accounting-table" style={{ minWidth }}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function AccountingEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="accounting-empty-state">
      <SearchX aria-hidden="true" size={76} />
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function DateInput({ defaultValue }: { defaultValue: string }) {
  return (
    <span className="date-input-shell">
      <input defaultValue={defaultValue} />
      <CalendarDays aria-hidden="true" size={21} />
    </span>
  );
}

function RequiredMark() {
  return <span aria-hidden="true" className="required-mark">*</span>;
}

function SummaryBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="matching-summary-box">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function ClosingCard({ title, value, description }: { title: string; value: string; description: string }) {
  return (
    <article className="closing-card">
      <span>{title}</span>
      <strong>{value}</strong>
      <p>{description}</p>
    </article>
  );
}
