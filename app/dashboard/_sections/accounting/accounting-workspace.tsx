"use client";

import {
  BarChart3,
  Check,
  ChevronDown,
  Filter,
  Loader2,
  MoreVertical,
  Plus,
  Search,
  SearchX,
  Trash2,
  X
} from "lucide-react";
import type { ReactNode } from "react";
import { Fragment, useMemo, useState } from "react";
import {
  closeClosingPeriod,
  createAccountingEntry,
  createClosingPeriod,
  createFixedAsset,
  deleteAccountingEntry,
  getAccountingEntryLines,
  lockClosingPeriod,
  markAccountingLines,
  postAccountingEntry,
  writeOffFixedAsset
} from "../../accounting-actions";
import type { ClosingPeriodItem, EntryItem, FixedAssetItem, JournalItem, UnmatchedLineItem } from "../../_data/accounting-data";
import { formatMoney } from "../../_lib/formatters";

type AccountingSectionId = "entries" | "matching" | "closings" | "fixed-assets" | "fixed-asset-transactions";

type AccountingSection = {
  id: AccountingSectionId;
  label: string;
  title: string;
};

const SECTIONS: AccountingSection[] = [
  { id: "entries", label: "Asientos", title: "Asientos" },
  { id: "matching", label: "Marcaje", title: "Marcaje" },
  { id: "closings", label: "Cierres", title: "Cierres" },
  { id: "fixed-assets", label: "Inmovilizado", title: "Inmovilizado" },
  { id: "fixed-asset-transactions", label: "Transacciones", title: "Transacciones de inmovilizado" }
];

function isoToDisplay(iso: string): string {
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function AccountingWorkspace({
  organizationId,
  organizationName,
  journals,
  initialEntries,
  initialFixedAssets,
  initialClosings,
  initialUnmatchedLines
}: {
  organizationId: string;
  organizationName: string;
  journals: JournalItem[];
  initialEntries: EntryItem[];
  initialFixedAssets: FixedAssetItem[];
  initialClosings: ClosingPeriodItem[];
  initialUnmatchedLines: UnmatchedLineItem[];
}) {
  const [activeSectionId, setActiveSectionId] = useState<AccountingSectionId>("entries");
  const [entryView, setEntryView] = useState<"list" | "form">("list");
  const [entries, setEntries] = useState<EntryItem[]>(initialEntries);
  const [fixedAssets, setFixedAssets] = useState<FixedAssetItem[]>(initialFixedAssets);
  const [closings, setClosings] = useState<ClosingPeriodItem[]>(initialClosings);
  const [unmatchedLines, setUnmatchedLines] = useState<UnmatchedLineItem[]>(initialUnmatchedLines);
  const [closingFormOpen, setClosingFormOpen] = useState(false);
  const [importNotice, setImportNotice] = useState(false);

  const activeSection = SECTIONS.find((s) => s.id === activeSectionId) ?? SECTIONS[0]!;

  const metrics = useMemo(() => {
    const posted = entries.filter((e) => e.status === "posted").length;
    const drafts = entries.filter((e) => e.status === "draft").length;
    const uniqueAccounts = new Set(unmatchedLines.map((l) => l.accountCode)).size;
    const matchingBalance = unmatchedLines.reduce((s, l) => s + l.debit - l.credit, 0);
    const openClosings = closings.filter((c) => c.status === "open").length;
    const closedClosings = closings.filter((c) => c.status !== "open").length;
    const activeAssets = fixedAssets.filter((a) => a.status === "active").length;
    const totalValue = fixedAssets.reduce((s, a) => s + a.acquisitionValue, 0);

    return {
      entries: [
        { label: "Asientos", tone: "teal" as const, value: String(entries.length) },
        { label: "Contabilizados", tone: "indigo" as const, value: String(posted) },
        { label: "Borradores", tone: "green" as const, value: String(drafts) }
      ],
      matching: [
        { label: "Cuentas", tone: "teal" as const, value: String(uniqueAccounts) },
        { label: "Sin marcar", tone: "indigo" as const, value: String(unmatchedLines.length) },
        { label: "Saldo", tone: "green" as const, value: formatMoney(matchingBalance) }
      ],
      closings: [
        { label: "Periodos", tone: "teal" as const, value: String(closings.length) },
        { label: "Abiertos", tone: "indigo" as const, value: String(openClosings) },
        { label: "Cerrados", tone: "green" as const, value: String(closedClosings) }
      ],
      "fixed-assets": [
        { label: "Activos", tone: "teal" as const, value: String(activeAssets) },
        { label: "Altas", tone: "indigo" as const, value: String(fixedAssets.length) },
        { label: "Valor", tone: "green" as const, value: formatMoney(totalValue) }
      ],
      "fixed-asset-transactions": [
        { label: "Transacciones", tone: "teal" as const, value: "0" },
        { label: "Pendientes", tone: "indigo" as const, value: "0" },
        { label: "Importe", tone: "green" as const, value: "0,00 €" }
      ]
    };
  }, [entries, unmatchedLines, closings, fixedAssets]);

  const openSection = (id: AccountingSectionId) => {
    setActiveSectionId(id);
    setEntryView("list");
    setClosingFormOpen(false);
  };

  type HeroAction = { label: string; action: () => void; disabled?: boolean };
  const heroActions: HeroAction[] =
    activeSectionId === "entries"
      ? [
          { label: "Crear asiento", action: () => { setActiveSectionId("entries"); setEntryView("form"); } },
          { label: "Importar asientos", action: () => setImportNotice(true) }
        ]
      : activeSectionId === "closings"
        ? [{ label: "Preparar cierre", action: () => setClosingFormOpen(true) }]
        : activeSectionId === "fixed-asset-transactions"
          ? [{ label: "Ver transacciones", action: () => undefined, disabled: true }]
          : [];

  if (activeSectionId === "entries" && entryView === "form") {
    return (
      <section className="accounting-module-shell" aria-label={`Contabilidad de ${organizationName}`}>
        <div className="accounting-operation-surface">
          <EntryForm
            organizationId={organizationId}
            journals={journals}
            onCancel={() => setEntryView("list")}
            onEntryCreated={(entry) => {
              setEntries((prev) => [entry, ...prev]);
              setEntryView("list");
            }}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="accounting-module-shell" aria-label={`Contabilidad de ${organizationName}`}>
      <div className="accounting-operation-surface">
        <section className="accounting-template-view" aria-label={activeSection.title}>
          <AccountingSectionTabs
            activeSectionId={activeSectionId}
            onSectionChange={openSection}
          />
          <section className="sales-template-hero accounting-template-hero" aria-label={activeSection.title}>
            <div>
              <h1>{activeSection.title}</h1>
            </div>
            {heroActions.length > 0 ? (
              <div className="sales-template-hero-actions">
                {heroActions.map((a) => (
                  <button
                    disabled={a.disabled}
                    key={a.label}
                    onClick={a.action}
                    type="button"
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            ) : null}
          </section>
          <section
            className="sales-template-metrics accounting-template-metrics"
            aria-label={`Resumen de ${activeSection.label.toLowerCase()}`}
          >
            {metrics[activeSectionId].map((metric) => (
              <article className="sales-template-metric" key={metric.label}>
                <span className={`sales-template-metric-icon ${metric.tone}`}>
                  <BarChart3 aria-hidden="true" size={20} strokeWidth={2.3} />
                </span>
                <strong>{metric.value}</strong>
                <h2>{metric.label}</h2>
              </article>
            ))}
          </section>

          {importNotice && activeSectionId === "entries" && (
            <div className="accounting-import-notice" role="status">
              <span>La importación de asientos estará disponible próximamente.</span>
              <button type="button" aria-label="Cerrar aviso" onClick={() => setImportNotice(false)}>✕</button>
            </div>
          )}

          {activeSectionId === "entries" ? (
            <EntriesList
              entries={entries}
              onPost={async (id) => {
                const result = await postAccountingEntry(id);
                if (!result.error) setEntries((prev) => prev.map((e) => e.id === id ? { ...e, status: "posted" } : e));
                return result;
              }}
              onDelete={async (id) => {
                const result = await deleteAccountingEntry(id);
                if (!result.error) setEntries((prev) => prev.filter((e) => e.id !== id));
                return result;
              }}
            />
          ) : activeSectionId === "matching" ? (
            <MatchingWorkspace
              unmatchedLines={unmatchedLines}
              onMarked={(ids) => setUnmatchedLines((prev) => prev.filter((l) => !ids.includes(l.id)))}
            />
          ) : activeSectionId === "closings" ? (
            <ClosingsWorkspace
              closings={closings}
              organizationId={organizationId}
              formOpen={closingFormOpen}
              onFormClose={() => setClosingFormOpen(false)}
              onPeriodCreated={(period) => { setClosings((prev) => [period, ...prev]); setClosingFormOpen(false); }}
              onPeriodClosed={(id) => setClosings((prev) => prev.map((p) => p.id === id ? { ...p, status: "closed" } : p))}
              onPeriodLocked={(id) => setClosings((prev) => prev.map((p) => p.id === id ? { ...p, status: "locked" } : p))}
            />
          ) : activeSectionId === "fixed-assets" ? (
            <FixedAssetsWorkspace
              fixedAssets={fixedAssets}
              organizationId={organizationId}
              onAssetCreated={(asset) => setFixedAssets((prev) => [asset, ...prev])}
              onAssetWrittenOff={(id) => setFixedAssets((prev) => prev.filter((a) => a.id !== id))}
            />
          ) : (
            <section className="sage-list-panel accounting-list-panel" aria-label="Transacciones de inmovilizado">
              <div className="sales-template-table-head"><h2>Transacciones de inmovilizado</h2></div>
              <div style={{ padding: "2rem" }}>
                <AccountingEmptyState
                  title="Transacciones de inmovilizado."
                  description="Esta sección estará disponible próximamente."
                />
              </div>
            </section>
          )}
        </section>
      </div>
    </section>
  );
}

function AccountingSectionTabs({
  activeSectionId,
  onSectionChange
}: {
  activeSectionId: AccountingSectionId;
  onSectionChange: (id: AccountingSectionId) => void;
}) {
  return (
    <div className="fiscal-tabs sales-section-tabs accounting-section-tabs" role="tablist" aria-label="Subsecciones de contabilidad">
      {SECTIONS.map((section) => (
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

// ─── Entries list ────────────────────────────────────────────────────────────

type LoadedLine = {
  id: string;
  lineIndex: number;
  accountCode: string;
  thirdPartyName: string;
  description: string;
  debit: number;
  credit: number;
  matchingMark: string | null;
};

function EntriesList({
  entries,
  onPost,
  onDelete
}: {
  entries: EntryItem[];
  onPost: (id: string) => Promise<{ error?: string }>;
  onDelete: (id: string) => Promise<{ error?: string }>;
}) {
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [linesCache, setLinesCache] = useState<Record<string, LoadedLine[]>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  const filtered = entries.filter((e) => {
    const q = query.toLowerCase();
    return !q
      || e.description.toLowerCase().includes(q)
      || e.documentNumber.toLowerCase().includes(q)
      || e.journalCode.toLowerCase().includes(q)
      || String(e.entryNumber ?? "").includes(q);
  });

  const handleToggleLines = async (entryId: string) => {
    if (expandedId === entryId) { setExpandedId(null); return; }
    setExpandedId(entryId);
    if (!linesCache[entryId]) {
      setLoadingId(entryId);
      const result = await getAccountingEntryLines(entryId);
      setLoadingId(null);
      if (result.lines) setLinesCache((prev) => ({ ...prev, [entryId]: result.lines! }));
    }
  };

  const handlePost = async (entryId: string) => {
    const result = await onPost(entryId);
    if (result.error) setRowError((prev) => ({ ...prev, [entryId]: result.error! }));
  };

  const handleDelete = async (entryId: string) => {
    const result = await onDelete(entryId);
    if (result.error) setRowError((prev) => ({ ...prev, [entryId]: result.error! }));
  };

  return (
    <>
      <section className="accounting-list-toolbar" aria-label="Filtros de asientos">
        <label className="sales-search-control" style={{ marginLeft: "auto" }}>
          <Search aria-hidden="true" size={25} />
          <input
            aria-label="Buscar asientos"
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar..."
            type="search"
            value={query}
          />
        </label>
      </section>

      <section className="sage-list-panel accounting-list-panel" aria-label="Lista de asientos">
        <div className="sales-template-table-head">
          <h2>Asientos</h2>
        </div>
        <AccountingTable
          columns={["Num.", "Diario", "Fecha", "Doc.", "Descripcion", "Estado", "Debe", "Haber", "Acciones"]}
          minWidth={1100}
        >
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={9}>
                <AccountingEmptyState
                  title="Sin asientos."
                  description={entries.length === 0 ? "Crea el primer asiento con el botón de arriba." : "La búsqueda no ha dado ningún resultado."}
                />
              </td>
            </tr>
          ) : (
            filtered.map((entry) => (
              <Fragment key={entry.id}>
                <tr>
                  <td>{entry.entryNumber ?? "—"}</td>
                  <td>{entry.journalCode}</td>
                  <td>{entry.entryDate}</td>
                  <td>{entry.documentNumber || "—"}</td>
                  <td>{entry.description || "—"}</td>
                  <td><EntryStatusBadge status={entry.status} /></td>
                  <td>{formatMoney(entry.totalDebit)}</td>
                  <td>{formatMoney(entry.totalCredit)}</td>
                  <td>
                    <div className="sage-table-actions">
                      <button
                        className="sage-table-button"
                        onClick={() => handleToggleLines(entry.id)}
                        title="Ver líneas"
                        type="button"
                      >
                        {loadingId === entry.id
                          ? <Loader2 aria-hidden="true" size={16} className="animate-spin" />
                          : <ChevronDown aria-hidden="true" size={16} style={expandedId === entry.id ? { transform: "rotate(180deg)" } : undefined} />
                        }
                      </button>
                      {entry.status === "draft" ? (
                        <button
                          className="sage-table-button"
                          onClick={() => handlePost(entry.id)}
                          title="Contabilizar"
                          type="button"
                        >
                          <Check aria-hidden="true" size={16} />
                        </button>
                      ) : null}
                      <button
                        className="sage-table-button"
                        onClick={() => handleDelete(entry.id)}
                        title="Eliminar"
                        type="button"
                      >
                        <Trash2 aria-hidden="true" size={16} />
                      </button>
                    </div>
                    {rowError[entry.id] ? (
                      <p className="sage-row-error">{rowError[entry.id]}</p>
                    ) : null}
                  </td>
                </tr>
                {expandedId === entry.id ? (
                  <tr className="entry-lines-row">
                    <td colSpan={9}>
                      <div className="entry-lines-panel">
                        {loadingId === entry.id ? (
                          <p className="entry-lines-loading"><Loader2 size={16} className="animate-spin" /> Cargando líneas…</p>
                        ) : (
                          <AccountingTable
                            columns={["Cuenta", "Tercero", "Descripcion", "Debe", "Haber", "Marca"]}
                            minWidth={700}
                          >
                            {(linesCache[entry.id] ?? []).length === 0 ? (
                              <tr><td colSpan={6}><em style={{ padding: "0.5rem 1rem", display: "block" }}>Sin líneas.</em></td></tr>
                            ) : (
                              (linesCache[entry.id] ?? []).map((line) => (
                                <tr key={line.id}>
                                  <td>{line.accountCode}</td>
                                  <td>{line.thirdPartyName || "—"}</td>
                                  <td>{line.description || "—"}</td>
                                  <td>{line.debit > 0 ? formatMoney(line.debit) : ""}</td>
                                  <td>{line.credit > 0 ? formatMoney(line.credit) : ""}</td>
                                  <td>{line.matchingMark || "—"}</td>
                                </tr>
                              ))
                            )}
                          </AccountingTable>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))
          )}
        </AccountingTable>
      </section>
    </>
  );
}

function EntryStatusBadge({ status }: { status: string }) {
  const cls = status === "posted" ? "entry-status posted" : "entry-status draft";
  const label = status === "posted" ? "Contabilizado" : "Borrador";
  return <span className={cls}>{label}</span>;
}

// ─── Entry form ───────────────────────────────────────────────────────────────

type LineDraft = {
  key: string;
  accountCode: string;
  accountDescription: string;
  thirdPartyName: string;
  description: string;
  debit: string;
  credit: string;
};

function emptyLine(): LineDraft {
  return { key: crypto.randomUUID(), accountCode: "", accountDescription: "", thirdPartyName: "", description: "", debit: "", credit: "" };
}

function EntryForm({
  organizationId,
  journals,
  onCancel,
  onEntryCreated
}: {
  organizationId: string;
  journals: JournalItem[];
  onCancel: () => void;
  onEntryCreated: (entry: EntryItem) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [journalId, setJournalId] = useState(journals[0]?.id ?? "");
  const [entryDate, setEntryDate] = useState(today);
  const [description, setDescription] = useState("");
  const [documentDate, setDocumentDate] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine(), emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const updateLine = (key: string, field: keyof LineDraft, value: string) => {
    setLines((prev) => prev.map((l) => l.key === key ? { ...l, [field]: value } : l));
  };

  const removeLine = (key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  };

  const handleBalance = () => {
    const diff = Math.round((totalDebit - totalCredit) * 100) / 100;
    if (Math.abs(diff) < 0.01) return;
    const balanceLine = emptyLine();
    balanceLine.description = "Saldo";
    if (diff > 0) balanceLine.credit = diff.toFixed(2);
    else balanceLine.debit = Math.abs(diff).toFixed(2);
    setLines((prev) => [...prev, balanceLine]);
  };

  const handleSave = async () => {
    setFormError("");
    setSaving(true);

    const formData = new FormData();
    formData.set("organization_id", organizationId);
    formData.set("journal_id", journalId);
    formData.set("entry_date", entryDate);
    formData.set("document_date", documentDate);
    formData.set("document_number", documentNumber);
    formData.set("description", description);
    formData.set("lines_json", JSON.stringify(
      lines.map((l) => ({
        accountCode: l.accountCode,
        accountDescription: l.accountDescription,
        thirdPartyName: l.thirdPartyName,
        description: l.description,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0
      }))
    ));

    const result = await createAccountingEntry(formData);
    setSaving(false);

    if (result.error) { setFormError(result.error); return; }

    const selectedJournal = journals.find((j) => j.id === journalId);
    onEntryCreated({
      id: result.entry!.id,
      journalId,
      journalCode: selectedJournal?.code ?? "",
      journalName: selectedJournal?.name ?? "",
      entryNumber: result.entry!.number,
      entryDate: isoToDisplay(entryDate),
      documentDate: isoToDisplay(documentDate),
      documentNumber,
      description,
      status: "draft",
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100
    });
  };

  return (
    <section className="accounting-entry-form" aria-label="Formulario de asiento">
      <header className="accounting-form-header">
        <div>
          <h1>Asiento</h1>
        </div>
        <button className="quote-close-button" onClick={onCancel} type="button" aria-label="Cerrar formulario">
          <X aria-hidden="true" size={34} />
        </button>
      </header>

      <section className="entry-main-card">
        <div className="entry-main-grid">
          <label className="sage-field entry-journal-field">
            <span>Diario <span aria-hidden="true" className="required-mark">*</span></span>
            <select value={journalId} onChange={(e) => setJournalId(e.target.value)}>
              {journals.map((j) => (
                <option key={j.id} value={j.id}>{j.code} — {j.name}</option>
              ))}
            </select>
          </label>
          <label className="sage-field">
            <span>Fecha <span aria-hidden="true" className="required-mark">*</span></span>
            <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required />
          </label>
          <label className="sage-field entry-description-field">
            <span>Descripcion</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Concepto del asiento" />
          </label>
          <label className="sage-field">
            <span>Fecha de documento</span>
            <input type="date" value={documentDate} onChange={(e) => setDocumentDate(e.target.value)} />
          </label>
          <label className="sage-field">
            <span>Numero de documento</span>
            <input value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} placeholder="Ej. FAC-2026-001" />
          </label>
          <label className="sage-field">
            <span>Divisa</span>
            <input disabled value="EUR" readOnly />
          </label>
        </div>
      </section>

      <section className="sage-list-panel entry-lines-panel" aria-label="Lineas del asiento">
        <div className="sales-template-table-head">
          <h2>Apuntes</h2>
          <button
            className="sage-outline-button entry-add-line-button"
            onClick={() => setLines((prev) => [...prev, emptyLine()])}
            type="button"
          >
            <Plus aria-hidden="true" size={16} />
            Añadir línea
          </button>
        </div>
        <AccountingTable
          columns={["Cuenta", "Descripcion cuenta", "Tercero", "Descripcion", "Debe", "Haber", ""]}
          minWidth={960}
        >
          {lines.map((line) => (
            <tr key={line.key}>
              <td>
                <input
                  className="sage-inline-input"
                  value={line.accountCode}
                  onChange={(e) => updateLine(line.key, "accountCode", e.target.value)}
                  placeholder="4000"
                />
              </td>
              <td>
                <input
                  className="sage-inline-input"
                  value={line.accountDescription}
                  onChange={(e) => updateLine(line.key, "accountDescription", e.target.value)}
                  placeholder="Proveedores"
                />
              </td>
              <td>
                <input
                  className="sage-inline-input"
                  value={line.thirdPartyName}
                  onChange={(e) => updateLine(line.key, "thirdPartyName", e.target.value)}
                  placeholder="Nombre"
                />
              </td>
              <td>
                <input
                  className="sage-inline-input"
                  value={line.description}
                  onChange={(e) => updateLine(line.key, "description", e.target.value)}
                  placeholder="Concepto"
                />
              </td>
              <td>
                <input
                  className="sage-inline-input entry-amount-input"
                  inputMode="decimal"
                  value={line.debit}
                  onChange={(e) => updateLine(line.key, "debit", e.target.value)}
                  placeholder="0,00"
                />
              </td>
              <td>
                <input
                  className="sage-inline-input entry-amount-input"
                  inputMode="decimal"
                  value={line.credit}
                  onChange={(e) => updateLine(line.key, "credit", e.target.value)}
                  placeholder="0,00"
                />
              </td>
              <td>
                <button
                  className="sage-table-button"
                  disabled={lines.length <= 2}
                  onClick={() => removeLine(line.key)}
                  title="Eliminar línea"
                  type="button"
                >
                  <Trash2 aria-hidden="true" size={15} />
                </button>
              </td>
            </tr>
          ))}
          <tr className="entry-totals-row">
            <td colSpan={4} style={{ textAlign: "right", fontWeight: 600 }}>Total</td>
            <td style={{ fontWeight: 600 }}>{formatMoney(totalDebit)}</td>
            <td style={{ fontWeight: 600 }}>{formatMoney(totalCredit)}</td>
            <td />
          </tr>
        </AccountingTable>
      </section>

      {formError ? <p className="sage-form-error" role="alert">{formError}</p> : null}

      <div className="entry-form-footer">
        <button
          className="entry-balance-button"
          disabled={balanced}
          onClick={handleBalance}
          type="button"
        >
          Saldar
          {!balanced ? (
            <span className="entry-balance-diff">
              {totalDebit > totalCredit
                ? `+${formatMoney(totalDebit - totalCredit)} Haber`
                : `+${formatMoney(totalCredit - totalDebit)} Debe`}
            </span>
          ) : null}
        </button>
        <button
          className="sage-primary-button"
          disabled={saving || !balanced || !journalId || !entryDate}
          onClick={handleSave}
          type="button"
        >
          {saving ? <Loader2 aria-hidden="true" size={16} className="animate-spin" /> : null}
          Guardar asiento
        </button>
      </div>
    </section>
  );
}

// ─── Matching workspace ───────────────────────────────────────────────────────

type AccountGroup = {
  code: string;
  lines: UnmatchedLineItem[];
  balance: number;
};

function MatchingWorkspace({
  unmatchedLines,
  onMarked
}: {
  unmatchedLines: UnmatchedLineItem[];
  onMarked: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState("");

  const groups: AccountGroup[] = useMemo(() => {
    const map = new Map<string, AccountGroup>();
    for (const line of unmatchedLines) {
      const key = line.accountCode || "(sin cuenta)";
      const g = map.get(key) ?? { code: key, lines: [], balance: 0 };
      g.lines.push(line);
      g.balance += line.debit - line.credit;
      map.set(key, g);
    }
    return Array.from(map.values());
  }, [unmatchedLines]);

  const filteredGroups = useMemo(() => {
    const q = query.toLowerCase();
    return !q ? groups : groups.filter((g) => g.code.toLowerCase().includes(q) || g.lines.some((l) => l.thirdPartyName.toLowerCase().includes(q)));
  }, [groups, query]);

  const activeGroup = filteredGroups.find((g) => g.code === selectedAccount) ?? filteredGroups[0] ?? null;
  const activeLines = activeGroup?.lines ?? [];

  const toggleLine = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === activeLines.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(activeLines.map((l) => l.id)));
  };

  const handleMark = async () => {
    if (selectedIds.size === 0) return;
    setMarking(true);
    setMarkError("");
    const mark = crypto.randomUUID().slice(0, 8);
    const result = await markAccountingLines(Array.from(selectedIds), mark);
    setMarking(false);
    if (result.error) { setMarkError(result.error); return; }
    onMarked(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const balance = activeLines.filter((l) => selectedIds.has(l.id)).reduce((s, l) => s + l.debit - l.credit, 0);

  return (
    <section className="matching-workspace" aria-label="Marcaje contable">
      <aside className="matching-left-pane">
        <label className="sales-search-control matching-search-control">
          <Search aria-hidden="true" size={25} />
          <input
            aria-label="Buscar cuenta o tercero"
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar..."
            type="search"
            value={query}
          />
        </label>
        <div className="matching-subject-list">
          {filteredGroups.length === 0 ? (
            <p style={{ padding: "1rem", opacity: 0.6 }}>Sin apuntes sin marcar.</p>
          ) : (
            filteredGroups.map((g) => (
              <button
                className={`matching-subject-row${g.code === activeGroup?.code ? " active" : ""}`}
                key={g.code}
                onClick={() => { setSelectedAccount(g.code); setSelectedIds(new Set()); }}
                type="button"
              >
                <span>
                  <strong>{g.code}</strong>
                  <small>{g.lines.length}</small>
                  <small>{formatMoney(g.balance)}</small>
                </span>
              </button>
            ))
          )}
        </div>
        <footer className="matching-count">{filteredGroups.length} cuentas</footer>
      </aside>

      <section className="matching-main-pane">
        <h1>{activeGroup?.code ?? "—"}</h1>

        <section className="matching-table-shell" aria-label="Apuntes para marcar">
          <AccountingTable
            columns={["", "Diario", "Fecha", "Num.", "Doc.", "Tercero", "Descripcion", "Debe", "Haber"]}
            minWidth={1100}
          >
            {activeLines.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <AccountingEmptyState title="Sin apuntes." description="No hay apuntes sin marcar para esta cuenta." />
                </td>
              </tr>
            ) : (
              <>
                <tr>
                  <td>
                    <input
                      aria-label="Seleccionar todo"
                      checked={selectedIds.size === activeLines.length && activeLines.length > 0}
                      onChange={toggleAll}
                      type="checkbox"
                    />
                  </td>
                  <td colSpan={8} style={{ fontWeight: 600 }}>Seleccionar todo</td>
                </tr>
                {activeLines.map((line) => (
                  <tr key={line.id}>
                    <td>
                      <input
                        aria-label={`Seleccionar ${line.description || line.accountCode}`}
                        checked={selectedIds.has(line.id)}
                        onChange={() => toggleLine(line.id)}
                        type="checkbox"
                      />
                    </td>
                    <td>{line.journalCode}</td>
                    <td>{line.entryDate}</td>
                    <td>{line.entryNumber ?? "—"}</td>
                    <td>{line.documentNumber || "—"}</td>
                    <td>{line.thirdPartyName || "—"}</td>
                    <td>{line.description || "—"}</td>
                    <td>{line.debit > 0 ? formatMoney(line.debit) : ""}</td>
                    <td>{line.credit > 0 ? formatMoney(line.credit) : ""}</td>
                  </tr>
                ))}
              </>
            )}
          </AccountingTable>
        </section>

        {markError ? <p className="sage-form-error" role="alert">{markError}</p> : null}

        <footer className="matching-sticky-bar">
          <div className="matching-summary-box">
            <strong>{formatMoney(activeGroup?.balance ?? 0)}</strong>
            <span>Saldo cuenta</span>
          </div>
          <div className="matching-summary-box">
            <strong>{formatMoney(balance)}</strong>
            <span>Seleccionado</span>
          </div>
          <button
            className="entry-balance-button matching-mark-button"
            disabled={selectedIds.size === 0 || marking}
            onClick={handleMark}
            type="button"
          >
            {marking ? <Loader2 aria-hidden="true" size={16} className="animate-spin" /> : null}
            Marcar ({selectedIds.size})
          </button>
        </footer>
      </section>
    </section>
  );
}

// ─── Closings workspace ───────────────────────────────────────────────────────

function ClosingsWorkspace({
  closings,
  organizationId,
  formOpen,
  onFormClose,
  onPeriodCreated,
  onPeriodClosed,
  onPeriodLocked
}: {
  closings: ClosingPeriodItem[];
  organizationId: string;
  formOpen: boolean;
  onFormClose: () => void;
  onPeriodCreated: (period: ClosingPeriodItem) => void;
  onPeriodClosed: (id: string) => void;
  onPeriodLocked: (id: string) => void;
}) {
  const [period, setPeriod] = useState("");
  const [kind, setKind] = useState<"monthly" | "annual">("monthly");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [rowError, setRowError] = useState<Record<string, string>>({});

  const handleCreate = async () => {
    setFormError("");
    if (!period.trim()) { setFormError("El período es obligatorio (ej. 2026-06)."); return; }
    setSaving(true);
    const formData = new FormData();
    formData.set("organization_id", organizationId);
    formData.set("period", period.trim());
    formData.set("kind", kind);
    const result = await createClosingPeriod(formData);
    setSaving(false);
    if (result.error) { setFormError(result.error); return; }
    onPeriodCreated({ id: result.period!.id, period: period.trim(), kind, status: "open", closingDate: "" });
    setPeriod("");
  };

  const handleClose = async (id: string) => {
    const result = await closeClosingPeriod(id);
    if (result.error) setRowError((prev) => ({ ...prev, [id]: result.error! }));
    else onPeriodClosed(id);
  };

  const handleLock = async (id: string) => {
    const result = await lockClosingPeriod(id);
    if (result.error) setRowError((prev) => ({ ...prev, [id]: result.error! }));
    else onPeriodLocked(id);
  };

  return (
    <section className="closings-workspace" aria-label="Cierres contables">
      {formOpen ? (
        <section className="entry-main-card" aria-label="Nuevo período de cierre">
          <div className="entry-main-grid">
            <label className="sage-field">
              <span>Período <span aria-hidden="true" className="required-mark">*</span></span>
              <input
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="2026-06"
              />
            </label>
            <label className="sage-field">
              <span>Tipo</span>
              <select value={kind} onChange={(e) => setKind(e.target.value as "monthly" | "annual")}>
                <option value="monthly">Mensual</option>
                <option value="annual">Anual</option>
              </select>
            </label>
          </div>
          {formError ? <p className="sage-form-error" role="alert">{formError}</p> : null}
          <div className="entry-form-footer">
            <button className="sage-outline-button" onClick={onFormClose} type="button">Cancelar</button>
            <button
              className="sage-primary-button"
              disabled={saving}
              onClick={handleCreate}
              type="button"
            >
              {saving ? <Loader2 aria-hidden="true" size={16} className="animate-spin" /> : null}
              Crear período
            </button>
          </div>
        </section>
      ) : null}

      <section className="sage-list-panel accounting-list-panel" aria-label="Periodos de cierre">
        <div className="sales-template-table-head">
          <h2>Periodos de cierre</h2>
        </div>
        <AccountingTable columns={["Periodo", "Tipo", "Estado", "Fecha cierre", "Acciones"]} minWidth={800}>
          {closings.length === 0 ? (
            <tr>
              <td colSpan={5}>
                <AccountingEmptyState title="Sin períodos de cierre." description="Usa el botón Preparar cierre para crear el primero." />
              </td>
            </tr>
          ) : (
            closings.map((p) => (
              <tr key={p.id}>
                <td>{p.period}</td>
                <td>{p.kind === "monthly" ? "Mensual" : "Anual"}</td>
                <td><ClosingStatusBadge status={p.status} /></td>
                <td>{p.closingDate || "—"}</td>
                <td>
                  <div className="sage-table-actions">
                    {p.status === "open" ? (
                      <button className="sage-table-button" onClick={() => handleClose(p.id)} title="Cerrar período" type="button">
                        <Check aria-hidden="true" size={16} />
                      </button>
                    ) : null}
                    {p.status === "closed" ? (
                      <button className="sage-table-button" onClick={() => handleLock(p.id)} title="Bloquear" type="button">
                        <MoreVertical aria-hidden="true" size={16} />
                      </button>
                    ) : null}
                  </div>
                  {rowError[p.id] ? <p className="sage-row-error">{rowError[p.id]}</p> : null}
                </td>
              </tr>
            ))
          )}
        </AccountingTable>
      </section>
    </section>
  );
}

function ClosingStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = { open: "closing-status open", closed: "closing-status closed", locked: "closing-status locked" };
  const labels: Record<string, string> = { open: "Abierto", closed: "Cerrado", locked: "Bloqueado" };
  return <span className={map[status] ?? "closing-status open"}>{labels[status] ?? status}</span>;
}

// ─── Fixed assets workspace ───────────────────────────────────────────────────

function FixedAssetsWorkspace({
  fixedAssets,
  organizationId,
  onAssetCreated,
  onAssetWrittenOff
}: {
  fixedAssets: FixedAssetItem[];
  organizationId: string;
  onAssetCreated: (asset: FixedAssetItem) => void;
  onAssetWrittenOff: (id: string) => void;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [code, setCode] = useState("");
  const [assetDescription, setAssetDescription] = useState("");
  const [acquisitionDate, setAcquisitionDate] = useState("");
  const [accountCode, setAccountCode] = useState("");
  const [acquisitionValue, setAcquisitionValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [rowError, setRowError] = useState<Record<string, string>>({});

  const handleCreate = async () => {
    setFormError("");
    const formData = new FormData();
    formData.set("organization_id", organizationId);
    formData.set("code", code.trim());
    formData.set("description", assetDescription.trim());
    formData.set("acquisition_date", acquisitionDate);
    formData.set("account_code", accountCode.trim());
    formData.set("acquisition_value", acquisitionValue);
    setSaving(true);
    const result = await createFixedAsset(formData);
    setSaving(false);
    if (result.error) { setFormError(result.error); return; }
    onAssetCreated({
      id: result.asset!.id,
      code: code.trim(),
      description: assetDescription.trim(),
      acquisitionDate: isoToDisplay(acquisitionDate),
      accountCode: accountCode.trim(),
      acquisitionValue: parseFloat(acquisitionValue.replace(",", ".")) || 0,
      accumulatedDepreciation: 0,
      status: "active"
    });
    setCode(""); setAssetDescription(""); setAcquisitionDate(""); setAccountCode(""); setAcquisitionValue("");
    setFormOpen(false);
  };

  const handleWriteOff = async (id: string) => {
    const result = await writeOffFixedAsset(id);
    if (result.error) setRowError((prev) => ({ ...prev, [id]: result.error! }));
    else onAssetWrittenOff(id);
  };

  return (
    <section className="accounting-reference-workspace" aria-label="Inmovilizado">
      {formOpen ? (
        <section className="entry-main-card" aria-label="Nuevo activo">
          <div className="entry-main-grid">
            <label className="sage-field">
              <span>Código <span aria-hidden="true" className="required-mark">*</span></span>
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="INM-001" />
            </label>
            <label className="sage-field entry-description-field">
              <span>Descripcion <span aria-hidden="true" className="required-mark">*</span></span>
              <input value={assetDescription} onChange={(e) => setAssetDescription(e.target.value)} placeholder="Ordenador portátil" />
            </label>
            <label className="sage-field">
              <span>Fecha de alta</span>
              <input type="date" value={acquisitionDate} onChange={(e) => setAcquisitionDate(e.target.value)} />
            </label>
            <label className="sage-field">
              <span>Cuenta contable</span>
              <input value={accountCode} onChange={(e) => setAccountCode(e.target.value)} placeholder="217" />
            </label>
            <label className="sage-field">
              <span>Valor de adquisicion</span>
              <input inputMode="decimal" value={acquisitionValue} onChange={(e) => setAcquisitionValue(e.target.value)} placeholder="1.500,00" />
            </label>
          </div>
          {formError ? <p className="sage-form-error" role="alert">{formError}</p> : null}
          <div className="entry-form-footer">
            <button className="sage-outline-button" onClick={() => setFormOpen(false)} type="button">Cancelar</button>
            <button className="sage-primary-button" disabled={saving} onClick={handleCreate} type="button">
              {saving ? <Loader2 aria-hidden="true" size={16} className="animate-spin" /> : null}
              Crear activo
            </button>
          </div>
        </section>
      ) : null}

      <section className="sage-list-panel accounting-list-panel" aria-label="Lista de inmovilizado">
        <div className="sales-template-table-head">
          <h2>Inmovilizado</h2>
          {!formOpen ? (
            <button
              className="sage-outline-button entry-add-line-button"
              onClick={() => setFormOpen(true)}
              type="button"
            >
              <Plus aria-hidden="true" size={16} />
              Crear activo
            </button>
          ) : null}
        </div>
        <AccountingTable
          columns={["Codigo", "Descripcion", "Fecha alta", "Cuenta", "Valor", "Estado", "Acciones"]}
          minWidth={980}
        >
          {fixedAssets.length === 0 ? (
            <tr>
              <td colSpan={7}>
                <AccountingEmptyState title="Sin activos." description="Usa el botón Crear activo para registrar el primero." />
              </td>
            </tr>
          ) : (
            fixedAssets.map((asset) => (
              <tr key={asset.id}>
                <td>{asset.code}</td>
                <td>{asset.description}</td>
                <td>{asset.acquisitionDate || "—"}</td>
                <td>{asset.accountCode || "—"}</td>
                <td>{formatMoney(asset.acquisitionValue)}</td>
                <td>
                  <span className={`closing-status ${asset.status}`}>
                    {asset.status === "active" ? "Activo" : asset.status === "sold" ? "Vendido" : "Dado de baja"}
                  </span>
                </td>
                <td>
                  <div className="sage-table-actions">
                    {asset.status === "active" ? (
                      <button
                        className="sage-table-button"
                        onClick={() => handleWriteOff(asset.id)}
                        title="Dar de baja"
                        type="button"
                      >
                        <Trash2 aria-hidden="true" size={16} />
                      </button>
                    ) : null}
                  </div>
                  {rowError[asset.id] ? <p className="sage-row-error">{rowError[asset.id]}</p> : null}
                </td>
              </tr>
            ))
          )}
        </AccountingTable>
      </section>
    </section>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

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
          <tr>{columns.map((col) => <th key={col}>{col}</th>)}</tr>
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

