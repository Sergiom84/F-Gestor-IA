"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  MoreVertical,
  Paperclip,
  Pencil,
  PenLine,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserRound,
  WalletCards,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  createClientAddress,
  createContactClient,
  deleteClientAddress,
  getContactClientDeleteSummary,
  listClientAddresses,
  softDeleteContactClient,
  updateClientAddress,
  updateContactClient,
  type ClientAddressRecord
} from "../../commercial-actions";
import {
  artificialClientRows,
  artificialEmployeeRows,
  artificialSupplierRows
} from "../../_data/artificial-business-data";
import type { ArtificialContactListItem } from "../../_data/artificial-business-data";

type ContactsWorkspaceProps = {
  organizationId: string;
  organizationName: string;
  initialClients?: ArtificialContactListItem[];
  initialSuppliers?: ArtificialContactListItem[];
};
import { formatMoney } from "../../_lib/formatters";

type ContactSectionId = "clients" | "suppliers" | "employees";
type ClientTabId = "info" | "contacts" | "payment" | "addresses" | "sales" | "delete";
type ContactNotice = { tone: "success" | "warning"; text: string };

type ContactListItem = ArtificialContactListItem;

const contactSections = [
  { id: "clients", label: "Clientes" },
  { id: "suppliers", label: "Proveedores" },
  { id: "employees", label: "Empleados" }
] satisfies Array<{ id: ContactSectionId; label: string }>;

const clientTabs = [
  { id: "info", label: "Informacion" },
  { id: "contacts", label: "Contactos" },
  { id: "payment", label: "Condiciones de pago" },
  { id: "addresses", label: "Direcciones" },
  { id: "sales", label: "Condiciones de venta" },
  { id: "delete", label: "Eliminar" }
] satisfies Array<{ id: ClientTabId; label: string }>;

const employeeRows: ContactListItem[] = artificialEmployeeRows;

export function ContactsWorkspace({ organizationId, organizationName, initialClients, initialSuppliers }: ContactsWorkspaceProps) {
  const [clientRows, setClientRows] = useState<ContactListItem[]>(initialClients ?? artificialClientRows);
  const supplierRows: ContactListItem[] = initialSuppliers ?? artificialSupplierRows;
  const [activeSection, setActiveSection] = useState<ContactSectionId>("clients");
  const [isSectionMenuOpen, setIsSectionMenuOpen] = useState(false);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [activeClientTab, setActiveClientTab] = useState<ClientTabId>("info");
  const [notice, setNotice] = useState<ContactNotice | null>(null);
  const [isCreatingContact, setIsCreatingContact] = useState(false);
  const [contactsNotice, setContactsNotice] = useState<string | null>(null);
  const currentSection = contactSections.find((section) => section.id === activeSection) ?? contactSections[0]!;
  const rows = activeSection === "clients"
    ? clientRows
    : activeSection === "suppliers"
      ? supplierRows
      : employeeRows;
  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return rows;
    }

    return rows.filter((row) => (
      row.name.toLowerCase().includes(normalizedQuery)
      || row.code.toLowerCase().includes(normalizedQuery)
      || row.taxId.toLowerCase().includes(normalizedQuery)
    ));
  }, [query, rows]);
  const selectedClient = selectedClientId
    ? clientRows.find((client) => client.id === selectedClientId) ?? null
    : null;

  const selectSection = (sectionId: ContactSectionId) => {
    setActiveSection(sectionId);
    setSelectedClientId(null);
    setActiveClientTab("info");
    setQuery("");
    setIsSectionMenuOpen(false);
  };

  const handleAdd = () => {
    setIsCreatingContact(true);
    setSelectedClientId(null);
    setActiveClientTab("info");
  };

  const handleImport = () => {
    setNotice({ tone: "success", text: "Importacion de contactos disponible en la version completa." });
    setIsActionsOpen(false);
  };

  const handleExport = () => {
    setNotice({ tone: "success", text: `Lista de ${currentSection.label.toLowerCase()} exportada a CSV.` });
    setIsActionsOpen(false);
  };

  const handleCombine = () => {
    setNotice({ tone: "success", text: "Combinacion de duplicados disponible en la version completa." });
    setIsActionsOpen(false);
  };

  return (
    <section className="contacts-workspace" aria-label="Contactos">
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

      <aside className="contacts-list-pane" aria-label={currentSection.label}>
        <header className="contacts-list-header">
          <div className="contacts-section-picker">
            <button className="contacts-section-button" onClick={() => setIsSectionMenuOpen((current) => !current)} type="button">
              {currentSection.label}
              <ChevronDown aria-hidden="true" size={29} />
            </button>
            {isSectionMenuOpen ? (
              <div className="contacts-section-menu">
                {contactSections.map((section) => (
                  <button key={section.id} onClick={() => selectSection(section.id)} type="button">
                    {section.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="contacts-list-actions">
            <button className="sage-primary-button compact-contact-button" onClick={handleAdd} type="button">
              <Plus aria-hidden="true" size={22} />
              Anadir
            </button>
            <div className="contacts-actions-menu">
              <button className="contacts-actions-button" onClick={() => setIsActionsOpen((current) => !current)} type="button">
                <MoreVertical aria-hidden="true" size={26} />
                Acciones
              </button>
              {isActionsOpen ? (
                <div className="contacts-section-menu contacts-actions-popover">
                  <button onClick={handleImport} type="button">Importar contactos</button>
                  <button onClick={handleExport} type="button">Exportar lista</button>
                  <button onClick={handleCombine} type="button">Combinar duplicados</button>
                </div>
              ) : null}
            </div>
          </div>

          <label className="contacts-search-control">
            <Search aria-hidden="true" size={24} />
            <input
              aria-label={`Buscar ${currentSection.label}`}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar..."
              type="search"
              value={query}
            />
          </label>
        </header>

        <div className="contacts-list">
          {filteredRows.map((row) => {
            const isSelected = activeSection === "clients" && row.id === selectedClientId;

            return (
              <button
                className={`contacts-list-row${isSelected ? " active" : ""}`}
                key={row.id}
                onClick={() => {
                  if (activeSection === "clients") {
                    setSelectedClientId(row.id);
                    setActiveClientTab("info");
                    setIsCreatingContact(false);
                  }
                }}
                type="button"
              >
                <strong>{row.name}</strong>
                <span>{row.code}</span>
                <span>{row.taxId}</span>
              </button>
            );
          })}
        </div>

        <footer className="contacts-list-count">
          {`${filteredRows.length} elementos`}
        </footer>
      </aside>

      <section className="contacts-detail-pane" aria-label="Detalle de contacto">
        {contactsNotice ? (
          <div className="sales-live-notice success contacts-notice" role="status">
            <span>{contactsNotice}</span>
            <button onClick={() => setContactsNotice(null)} type="button" aria-label="Cerrar aviso">
              <X aria-hidden="true" size={16} />
            </button>
          </div>
        ) : null}
        {isCreatingContact ? (
          <NewContactForm
            organizationId={organizationId}
            sectionLabel={currentSection.label}
            onCancel={() => setIsCreatingContact(false)}
            onCreated={(client) => {
              setClientRows((current) => [client, ...current]);
              setQuery("");
              setSelectedClientId(client.id);
              setActiveClientTab("info");
              setIsCreatingContact(false);
              setContactsNotice(`${client.name} creado.`);
            }}
            onPersistenceError={(message) => {
              setContactsNotice(`Cliente creado en la vista, pero no se pudo guardar: ${message}`);
            }}
          />
        ) : activeSection !== "clients" ? (
          <ContactCategoryPlaceholder sectionLabel={currentSection.label} />
        ) : selectedClient ? (
          <ClientDetail
            key={selectedClient.id}
            client={selectedClient}
            activeTab={activeClientTab}
            onTabChange={setActiveClientTab}
            organizationName={organizationName}
            onNotice={setNotice}
            onDeleteClient={(clientId, clientName) => {
              setClientRows((current) => current.filter((item) => item.id !== clientId));
              setSelectedClientId(null);
              setActiveClientTab("info");
              setNotice({ tone: "success", text: `${clientName} eliminado.` });
            }}
            onClientUpdated={(nextClient) => {
              setClientRows((current) => current.map((item) => item.id === nextClient.id ? nextClient : item));
            }}
          />
        ) : (
          <ContactEmptyState />
        )}
      </section>
    </section>
  );
}

function ContactEmptyState() {
  return (
    <div className="contacts-empty-state">
      <div className="contacts-empty-visual">
        <UserRound aria-hidden="true" size={210} />
      </div>
      <strong>SELECCIONA UN ELEMENTO DE LA LISTA DE LA IZQUIERDA.</strong>
    </div>
  );
}

function ContactCategoryPlaceholder({ sectionLabel }: { sectionLabel: string }) {
  return (
    <div className="contacts-empty-state">
      <div className="contacts-empty-visual simple">
        <UserRound aria-hidden="true" size={180} />
      </div>
      <strong>{sectionLabel.toUpperCase()} LISTOS PARA CONECTAR.</strong>
    </div>
  );
}

function ClientDetail({
  client,
  activeTab,
  onTabChange,
  organizationName,
  onNotice,
  onDeleteClient,
  onClientUpdated
}: {
  client: ContactListItem;
  activeTab: ClientTabId;
  onTabChange: (tab: ClientTabId) => void;
  organizationName: string;
  onNotice: (notice: ContactNotice) => void;
  onDeleteClient: (clientId: string, clientName: string) => void;
  onClientUpdated: (client: ContactListItem) => void;
}) {
  const [isDirty, setIsDirty] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const requiresClientTypeSelection = !client.clientKind;
  const isIndividual = client.clientKind === "individual";

  const handleUpdate = () => {
    onNotice({ tone: "success", text: `${client.name} actualizado.` });
    setIsDirty(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      const result = await softDeleteContactClient(client.id);

      if (result.error) {
        onNotice({ tone: "warning", text: result.error });
        return;
      }

      onDeleteClient(client.id, client.name);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section className="client-detail" aria-label={client.name}>
      <header className="client-detail-header">
        <div className="client-title-row">
          <h1>{client.name}</h1>
          <button
            className="insights-pill sales-insights-pill"
            onClick={() => onNotice({ tone: "success", text: "Asistente disponible en la version completa." })}
            type="button"
          >
            <Sparkles aria-hidden="true" size={18} fill="currentColor" />
            Asistente
          </button>
        </div>
        <div className="client-header-actions">
          <button
            onClick={() => onNotice({ tone: "success", text: "Registro de cobro disponible en la version completa." })}
            type="button"
          >
            <WalletCards aria-hidden="true" size={23} />
            Registrar cobro
          </button>
          <button
            onClick={() => onNotice({ tone: "success", text: "Gestion de ficheros disponible en la version completa." })}
            type="button"
          >
            <Paperclip aria-hidden="true" size={25} />
            Ver o adjuntar ficheros
          </button>
        </div>
      </header>

      {requiresClientTypeSelection ? (
        <div className="client-warning">
          <AlertTriangle aria-hidden="true" size={25} fill="currentColor" />
          <div>
            <strong>Tipo de cliente necesario para la facturacion electronica</strong>
            <p>
              Para que los registros de los clientes se ajusten a los requisitos de la facturacion electronica, selecciona "Autonomo" o "Particular" en "Tipo de cliente".
            </p>
          </div>
        </div>
      ) : null}

      <div className="client-balance-row">
        <ClientMetric label="Tipo de cliente" valueLabel={isIndividual ? "Particular" : "Autonomo"} />
        <ClientMetric label="IRPF por defecto" valueLabel={client.applyIrpfByDefault ? `${client.defaultIrpfRate ?? 15}%` : "0%"} />
      </div>

      <nav className="client-tabs" aria-label="Secciones del cliente">
        {clientTabs.map((tab) => (
          <button
            aria-selected={activeTab === tab.id}
            className={`client-tab${activeTab === tab.id ? " active" : ""}`}
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <section
        className="client-tab-panel"
        onInput={() => setIsDirty(true)}
      >
        {activeTab === "info" ? <ClientInfoPanel client={client} onClientUpdated={onClientUpdated} onNotice={onNotice} /> : null}
        {activeTab === "contacts" ? <ClientContactsPanel client={client} onClientUpdated={onClientUpdated} onNotice={onNotice} /> : null}
        {activeTab === "payment" ? <ClientPaymentPanel onNotice={onNotice} /> : null}
        {activeTab === "addresses" ? <ClientAddressesPanel client={client} onNotice={onNotice} /> : null}
        {activeTab === "sales" ? <ClientSalesPanel client={client} organizationName={organizationName} /> : null}
        {activeTab === "delete" ? (
          <ClientDeletePanel
            client={client}
            isDeleting={isDeleting}
            onDelete={handleDelete}
          />
        ) : null}
      </section>
    </section>
  );
}

function ClientMetric({ label, value, valueLabel }: { label: string; value?: number; valueLabel?: string }) {
  return (
    <article className="client-metric">
      <strong>{valueLabel ?? formatMoney(value ?? 0)}</strong>
      <span>{label}</span>
    </article>
  );
}

function ClientDeletePanel({
  client,
  isDeleting,
  onDelete
}: {
  client: ContactListItem;
  isDeleting: boolean;
  onDelete: () => Promise<void>;
}) {
  const [summary, setSummary] = useState<{
    pendingQuotes: number;
    pendingInvoices: number;
    outstandingBalance: number;
    linkedDocuments: number;
    isFiscalEntityClient: boolean;
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      try {
        const result = await getContactClientDeleteSummary(client.id);
        if (result.error || !result.summary) {
          setLoadError(result.error ?? "No se pudo comprobar el estado del cliente.");
          return;
        }
        setSummary(result.summary);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [client.id]);

  const hasBlockingItems = Boolean(
    summary
    && (
      summary.isFiscalEntityClient
      || summary.pendingQuotes > 0
      || summary.pendingInvoices > 0
      || summary.outstandingBalance > 0
      || summary.linkedDocuments > 0
    )
  );
  const hasOperationalBlocks = Boolean(
    summary
    && (
      summary.pendingQuotes > 0
      || summary.pendingInvoices > 0
      || summary.outstandingBalance > 0
      || summary.linkedDocuments > 0
    )
  );

  return (
    <section className="client-simple-panel" aria-label="Eliminar cliente">
      {isLoading ? <p>Comprobando presupuestos, facturas y saldo pendiente...</p> : null}
      {loadError ? <div className="sales-live-notice warning" role="alert">{loadError}</div> : null}

      {summary ? (
        <div className="client-delete-grid">
          <ClientMetric label="Presupuestos pendientes" valueLabel={String(summary.pendingQuotes)} />
          <ClientMetric label="Facturas pendientes" valueLabel={String(summary.pendingInvoices)} />
          <ClientMetric label="Saldo pendiente" valueLabel={formatMoney(summary.outstandingBalance)} />
          <ClientMetric label="Documentos vinculados" valueLabel={String(summary.linkedDocuments)} />
        </div>
      ) : null}

      {summary?.isFiscalEntityClient ? (
        <div className="sales-live-notice warning" role="alert">
          <span>Este cliente es la ficha interna de tu entidad fiscal. La app la usa como base para emitir documentos y por eso no puede borrarse.</span>
        </div>
      ) : null}

      {hasOperationalBlocks ? (
        <div className="sales-live-notice warning" role="alert">
          <span>
            No se puede eliminar mientras tenga actividad asociada:
            {" "}
            {summary?.pendingQuotes ? `${summary.pendingQuotes} presupuesto(s)` : null}
            {summary?.pendingQuotes && (summary.pendingInvoices || summary.outstandingBalance || summary.linkedDocuments) ? ", " : null}
            {summary?.pendingInvoices ? `${summary.pendingInvoices} factura(s)` : null}
            {summary?.pendingInvoices && (summary.outstandingBalance || summary.linkedDocuments) ? ", " : null}
            {summary?.outstandingBalance ? `saldo pendiente de ${formatMoney(summary.outstandingBalance)}` : null}
            {summary?.outstandingBalance && summary?.linkedDocuments ? ", " : null}
            {summary?.linkedDocuments ? `${summary.linkedDocuments} documento(s)` : null}
            .
          </span>
        </div>
      ) : null}

      <button
        className="button danger"
        disabled={isDeleting || isLoading || hasBlockingItems}
        onClick={() => void onDelete()}
        type="button"
      >
        {isDeleting ? "Eliminando..." : `Eliminar ${client.name}`}
      </button>
    </section>
  );
}

function ClientInfoPanel({
  client,
  onClientUpdated,
  onNotice
}: {
  client: ContactListItem;
  onClientUpdated: (client: ContactListItem) => void;
  onNotice: (notice: ContactNotice) => void;
}) {
  return (
    <div className="client-info-grid">
      <section>
        <h2>Informacion de empresa</h2>
        <label className="sage-field">
          <span>Codigo *</span>
          <input value={client.code} disabled />
        </label>
        <label className="sage-field">
          <span>Razon social o nombre *</span>
          <input value={client.name} disabled />
        </label>
        <label className="sage-field">
          <span>Nombre comercial</span>
          <input value={client.name} disabled />
        </label>
        <label className="sage-field">
          <span>Pais</span>
          <input value={`${client.country ?? "ES"} - ${client.country ?? "ES"}`} disabled />
        </label>
      </section>

      <section>
        <h2>Direccion e informacion de contacto</h2>
        <EditableAddressCard
          client={client}
          title="Direccion principal"
          footerLabel="Igual que direccion de entrega"
          onClientUpdated={onClientUpdated}
          onNotice={onNotice}
        />
        <EditableContactCard client={client} onClientUpdated={onClientUpdated} onNotice={onNotice} />
      </section>
    </div>
  );
}

function ClientContactsPanel({
  client,
  onClientUpdated,
  onNotice
}: {
  client: ContactListItem;
  onClientUpdated: (client: ContactListItem) => void;
  onNotice: (notice: ContactNotice) => void;
}) {
  const [extraContacts, setExtraContacts] = useState<Array<{ id: number; name: string; email: string; phone: string; taxId: string }>>([]);
  const [draftName, setDraftName] = useState("");
  const [draftEmail, setDraftEmail] = useState("");
  const [draftPhone, setDraftPhone] = useState("");
  const [draftTaxId, setDraftTaxId] = useState("");

  const addContact = () => {
    if (!draftName.trim() || !draftEmail.trim() || !draftPhone.trim()) {
      onNotice({ tone: "warning", text: "Completa nombre, e-mail y telefono para anadir el contacto." });
      return;
    }

    setExtraContacts((current) => [
      ...current,
      {
        id: Date.now(),
        name: draftName.trim(),
        email: draftEmail.trim(),
        phone: draftPhone.trim(),
        taxId: draftTaxId.trim()
      }
    ]);
    setDraftName("");
    setDraftEmail("");
    setDraftPhone("");
    setDraftTaxId("");
    onNotice({ tone: "success", text: "Contacto anadido en la ficha del cliente." });
  };

  const removeContact = (contactId: number) => {
    setExtraContacts((current) => current.filter((contact) => contact.id !== contactId));
    onNotice({ tone: "success", text: "Contacto eliminado de la ficha del cliente." });
  };

  return (
    <div className="client-simple-panel">
      <div className="client-info-grid">
        <section>
          <h2>Anadir contacto</h2>
          <label className="sage-field">
            <span>Nombre *</span>
            <input value={draftName} onChange={(event) => setDraftName(event.target.value)} />
          </label>
          <label className="sage-field">
            <span>E-mail *</span>
            <input type="email" value={draftEmail} onChange={(event) => setDraftEmail(event.target.value)} />
          </label>
          <label className="sage-field">
            <span>Telefono *</span>
            <input value={draftPhone} onChange={(event) => setDraftPhone(event.target.value)} />
          </label>
          <label className="sage-field">
            <span>NIF/CIF</span>
            <input value={draftTaxId} onChange={(event) => setDraftTaxId(event.target.value)} />
          </label>
        </section>
      </div>
      <EditableContactCard client={client} onClientUpdated={onClientUpdated} onNotice={onNotice} />
      <button
        className="sage-primary-button compact-contact-button"
        onClick={addContact}
        type="button"
      >
        <Plus aria-hidden="true" size={22} />
        Anadir
      </button>
      {extraContacts.map((contact) => (
        <article className="client-address-card" key={contact.id}>
          <h3>{contact.name}</h3>
          <div className="client-address-body">
            <p>Email: {contact.email}</p>
            <p>Telefono: {contact.phone}</p>
            {contact.taxId ? <p>NIF/CIF: {contact.taxId}</p> : null}
          </div>
          <div className="client-card-actions">
            <button
              onClick={() => onNotice({ tone: "success", text: "Edicion de contacto adicional disponible en la siguiente fase." })}
              type="button"
            >
              <PenLine aria-hidden="true" size={24} fill="currentColor" />
              Editar
            </button>
            <button className="danger" onClick={() => removeContact(contact.id)} type="button">
              <Trash2 aria-hidden="true" size={24} fill="currentColor" />
              Eliminar
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function ClientPaymentPanel({ onNotice }: { onNotice: (notice: ContactNotice) => void }) {
  const [terms, setTerms] = useState<Array<{ id: number; accountLabel: string; method: string; customerDays: string; percentage: string; delayDays: string }>>([]);
  const [accountLabel, setAccountLabel] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("transferencia");
  const [customerDays, setCustomerDays] = useState("1");
  const [percentage, setPercentage] = useState("100");
  const [delayDays, setDelayDays] = useState("1");

  const addTerm = () => {
    if (!accountLabel.trim()) {
      onNotice({ tone: "warning", text: "Indica la condicion de pago antes de anadirla." });
      return;
    }

    setTerms((current) => [
      ...current,
      {
        id: Date.now(),
        accountLabel: accountLabel.trim(),
        method: paymentMethod,
        customerDays,
        percentage,
        delayDays
      }
    ]);
    setAccountLabel("");
    setPaymentMethod("transferencia");
    setCustomerDays("1");
    setPercentage("100");
    setDelayDays("1");
    onNotice({ tone: "success", text: "Condicion de pago anadida en la ficha del cliente." });
  };

  const removeTerm = (termId: number) => {
    setTerms((current) => current.filter((term) => term.id !== termId));
    onNotice({ tone: "success", text: "Condicion de pago eliminada." });
  };

  return (
    <div className="client-payment-panel">
      <div className="client-payment-fields">
        <label className="sage-field">
          <span>Condiciones de pago</span>
          <input
            placeholder="Ej. Transferencia 30 dias, recibo domiciliado..."
            value={accountLabel}
            onChange={(event) => setAccountLabel(event.target.value)}
          />
        </label>
        <label className="sage-field">
          <span>Forma de pago</span>
          <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
            <option value="transferencia">Transferencia</option>
            <option value="domiciliacion">Domiciliacion</option>
            <option value="efectivo">Efectivo</option>
            <option value="tarjeta">Tarjeta</option>
          </select>
        </label>
        <label className="sage-field client-token-select">
          <span>Dias de pago de cliente</span>
          <select value={customerDays} onChange={(event) => setCustomerDays(event.target.value)}>
            <option value="1">1 x</option>
            <option value="2">2 x</option>
            <option value="3">3 x</option>
          </select>
        </label>
        <label className="sage-field client-token-select">
          <span>% del vencimiento</span>
          <select value={percentage} onChange={(event) => setPercentage(event.target.value)}>
            <option value="100">100 %</option>
            <option value="50">50 %</option>
            <option value="25">25 %</option>
          </select>
        </label>
        <label className="sage-field client-token-select">
          <span>Dias hasta el pago</span>
          <select value={delayDays} onChange={(event) => setDelayDays(event.target.value)}>
            <option value="1">1 dia</option>
            <option value="7">7 dias</option>
            <option value="15">15 dias</option>
            <option value="30">30 dias</option>
          </select>
        </label>
      </div>
      <button
        className="sage-primary-button compact-contact-button"
        onClick={addTerm}
        type="button"
      >
        <Plus aria-hidden="true" size={22} />
        Anadir
      </button>
      {terms.map((term, index) => (
        <article className="client-payment-card" key={term.id}>
          <div>
            <p>{`${index + 1}.er vencimiento`}</p>
            <strong>{term.percentage} %</strong>
            <strong>{`A pagar despues de ${term.delayDays} dia(s)`}</strong>
            <p>{term.accountLabel}</p>
            <p>{`Forma de pago: ${term.method}`}</p>
            <p>{`Dias de pago del cliente: ${term.customerDays} x`}</p>
          </div>
          <div className="client-card-actions">
            <button onClick={() => onNotice({ tone: "success", text: "Edicion de condicion de pago disponible en la siguiente fase." })} type="button">
              <PenLine aria-hidden="true" size={24} fill="currentColor" />
              Editar
            </button>
            <button className="danger" onClick={() => removeTerm(term.id)} type="button">
              <Trash2 aria-hidden="true" size={24} fill="currentColor" />
              Eliminar
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function ClientAddressesPanel({
  client,
  onNotice
}: {
  client: ContactListItem;
  onNotice: (notice: ContactNotice) => void;
}) {
  const [addresses, setAddresses] = useState<ClientAddressRecord[]>([]);
  const [draftLabel, setDraftLabel] = useState("Direccion de entrega");
  const [draftAddress, setDraftAddress] = useState("");
  const [draftCity, setDraftCity] = useState("");
  const [draftProvince, setDraftProvince] = useState("");
  const [draftPostalCode, setDraftPostalCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      const result = await listClientAddresses(client.id);
      setIsLoading(false);
      if (result.error) {
        onNotice({ tone: "warning", text: result.error });
        return;
      }
      setAddresses(result.addresses ?? []);
    })();
  }, [client.id, onNotice]);

  const addAddress = async () => {
    if (!draftAddress.trim()) {
      onNotice({ tone: "warning", text: "Indica la direccion antes de anadirla." });
      return;
    }

    setIsSaving(true);
    const formData = new FormData();
    formData.set("client_id", client.id);
    formData.set("label", draftLabel);
    formData.set("address_line", draftAddress);
    formData.set("city", draftCity);
    formData.set("province", draftProvince);
    formData.set("postal_code", draftPostalCode);
    formData.set("country", client.country ?? "ES");
    formData.set("is_default_delivery", "on");
    const result = await createClientAddress(formData);
    setIsSaving(false);
    if (result.error || !result.address) {
      onNotice({ tone: "warning", text: result.error ?? "No se pudo crear la direccion." });
      return;
    }
    setAddresses((current) => [...current, result.address!]);
    setDraftLabel("Direccion de entrega");
    setDraftAddress("");
    setDraftCity("");
    setDraftProvince("");
    setDraftPostalCode("");
    onNotice({ tone: "success", text: "Direccion anadida." });
  };

  return (
    <div className="client-simple-panel">
      <div className="client-info-grid">
        <section>
          <h2>Anadir direccion</h2>
          <label className="sage-field">
            <span>Etiqueta</span>
            <input value={draftLabel} onChange={(event) => setDraftLabel(event.target.value)} />
          </label>
          <label className="sage-field">
            <span>Domicilio</span>
            <input value={draftAddress} onChange={(event) => setDraftAddress(event.target.value)} />
          </label>
          <label className="sage-field">
            <span>Poblacion</span>
            <input value={draftCity} onChange={(event) => setDraftCity(event.target.value)} />
          </label>
          <label className="sage-field">
            <span>Provincia</span>
            <input value={draftProvince} onChange={(event) => setDraftProvince(event.target.value)} />
          </label>
          <label className="sage-field">
            <span>Codigo postal</span>
            <input value={draftPostalCode} onChange={(event) => setDraftPostalCode(event.target.value)} />
          </label>
        </section>
      </div>
      <button
        className="sage-primary-button compact-contact-button"
        onClick={() => void addAddress()}
        type="button"
        disabled={isSaving}
      >
        <Plus aria-hidden="true" size={22} />
        {isSaving ? "Guardando..." : "Anadir"}
      </button>
      {isLoading ? <p>Cargando direcciones...</p> : null}
      <EditableAddressCard
        client={client}
        title="Direccion principal"
        footerLabel="Igual que direccion de entrega"
        onClientUpdated={() => {}}
        onNotice={onNotice}
      />
      {addresses.map((address) => (
        <PersistedAddressCard
          key={address.id}
          address={address}
          onDeleted={(addressId) => setAddresses((current) => current.filter((item) => item.id !== addressId))}
          onNotice={onNotice}
          onUpdated={(nextAddress) => setAddresses((current) => current.map((item) => item.id === nextAddress.id ? nextAddress : item))}
        />
      ))}
    </div>
  );
}

function PersistedAddressCard({
  address,
  onUpdated,
  onDeleted,
  onNotice
}: {
  address: ClientAddressRecord;
  onUpdated: (address: ClientAddressRecord) => void;
  onDeleted: (addressId: string) => void;
  onNotice: (notice: ContactNotice) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(address.label);
  const [addressLine, setAddressLine] = useState(address.addressLine);
  const [city, setCity] = useState(address.city);
  const [province, setProvince] = useState(address.province);
  const [postalCode, setPostalCode] = useState(address.postalCode);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLabel(address.label);
    setAddressLine(address.addressLine);
    setCity(address.city);
    setProvince(address.province);
    setPostalCode(address.postalCode);
    setIsEditing(false);
  }, [address]);

  const save = async () => {
    setIsSaving(true);
    const formData = new FormData();
    formData.set("address_id", address.id);
    formData.set("label", label);
    formData.set("address_line", addressLine);
    formData.set("city", city);
    formData.set("province", province);
    formData.set("postal_code", postalCode);
    formData.set("country", address.country);
    if (address.isDefaultDelivery) formData.set("is_default_delivery", "on");
    const result = await updateClientAddress(formData);
    setIsSaving(false);
    if (result.error || !result.address) {
      onNotice({ tone: "warning", text: result.error ?? "No se pudo actualizar la direccion." });
      return;
    }
    onUpdated(result.address);
    setIsEditing(false);
    onNotice({ tone: "success", text: "Direccion actualizada." });
  };

  const remove = async () => {
    const result = await deleteClientAddress(address.id);
    if (result.error) {
      onNotice({ tone: "warning", text: result.error });
      return;
    }
    onDeleted(address.id);
    onNotice({ tone: "success", text: "Direccion eliminada." });
  };

  return (
    <article className="client-address-card">
      <h3>{label}</h3>
      <div className="client-address-body">
        {isEditing ? (
          <>
            <label className="sage-field"><span>Etiqueta</span><input value={label} onChange={(e) => setLabel(e.target.value)} /></label>
            <label className="sage-field"><span>Domicilio</span><input value={addressLine} onChange={(e) => setAddressLine(e.target.value)} /></label>
            <label className="sage-field"><span>Poblacion</span><input value={city} onChange={(e) => setCity(e.target.value)} /></label>
            <label className="sage-field"><span>Provincia</span><input value={province} onChange={(e) => setProvince(e.target.value)} /></label>
            <label className="sage-field"><span>Codigo postal</span><input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} /></label>
          </>
        ) : (
          <>
            <p>{address.addressLine}</p>
            <p>{[address.postalCode, address.city].filter(Boolean).join(" ")}</p>
            <p>{address.province}</p>
          </>
        )}
      </div>
      <div className="client-card-actions">
        {isEditing ? (
          <>
            <button onClick={() => setIsEditing(false)} type="button">Cancelar</button>
            <button onClick={() => void save()} type="button">{isSaving ? "Guardando..." : "Guardar"}</button>
          </>
        ) : (
          <>
            <button onClick={() => setIsEditing(true)} type="button">
              <PenLine aria-hidden="true" size={24} fill="currentColor" />
              Editar
            </button>
            <button className="danger" onClick={() => void remove()} type="button">
              <Trash2 aria-hidden="true" size={24} fill="currentColor" />
              Eliminar
            </button>
          </>
        )}
      </div>
    </article>
  );
}

function ClientSalesPanel({ client, organizationName }: { client: ContactListItem; organizationName: string }) {
  return (
    <div className="client-sales-grid">
      <section>
        <h2>Condiciones de venta</h2>
        <div className="sales-live-notice warning" role="status">
          <span>Tarifas, grupos de descuento y bloqueos comerciales todavia no estan conectados a datos reales en GFiscal.</span>
        </div>
        <label className="sage-field client-short-field">
          <span>Codigo de tarifa</span>
          <input disabled value="" placeholder="Sin tarifas configuradas" />
        </label>
        <label className="sage-field">
          <span>Nombre de tarifa</span>
          <input disabled value="" placeholder="Sin nombre de tarifa" />
        </label>
        <label className="sage-field client-short-field">
          <span>Codigo de grupo de descuentos</span>
          <input disabled value="" placeholder="Sin grupos configurados" />
        </label>
        <label className="sage-field">
          <span>Nombre de grupo de descuentos</span>
          <input disabled value="" placeholder="Sin nombre de grupo" />
        </label>
        <label className="sage-field client-discount-field">
          <span>% descuento a cliente</span>
          <input disabled value="0,00" />
        </label>
        <label className="sage-field client-discount-field">
          <span>IRPF por defecto</span>
          <input disabled value={client.applyIrpfByDefault ? `${client.defaultIrpfRate ?? 15},00` : "0,00"} />
        </label>
      </section>

      <section>
        <h2>Gestion de documentos de venta</h2>
        <ClientBlockToggle title="Bloquear facturas" description="Pendiente de implementar cuando exista configuracion comercial persistente." />
        <ClientBlockToggle title="Bloquear albaranes" description="Pendiente de implementar cuando exista configuracion comercial persistente." />
        <ClientBlockToggle title="Bloquear pedidos" description="Pendiente de implementar cuando exista configuracion comercial persistente." />
      </section>
    </div>
  );
}

function ClientBlockToggle({ title, description }: { title: string; description: string }) {
  return (
    <div className="client-block-toggle">
      <strong>{title}</strong>
      <p>{description}</p>
      <div className="sage-toggle-row">
        <button disabled type="button">Proximamente</button>
      </div>
    </div>
  );
}

function NewContactForm({
  organizationId,
  sectionLabel,
  onCancel,
  onCreated,
  onPersistenceError
}: {
  organizationId: string;
  sectionLabel: string;
  onCancel: () => void;
  onCreated: (client: ContactListItem) => void;
  onPersistenceError: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [clientKind, setClientKind] = useState<"self_employed" | "individual">("self_employed");
  const [taxId, setTaxId] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [applyIrpf, setApplyIrpf] = useState(true);
  const [irpfRate, setIrpfRate] = useState("15");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const canCreate = [
    name.trim(),
    taxId.trim(),
    email.trim(),
    phone.trim(),
    address.trim(),
    city.trim(),
    province.trim(),
    postalCode.trim()
  ].every(Boolean) && !isSaving;
  const handleCreate = async () => {
    const formData = new FormData();

    formData.set("organization_id", organizationId);
    formData.set("name", name);
    formData.set("tax_id", taxId);
    formData.set("contact_email", email);
    formData.set("contact_phone", phone);
    formData.set("fiscal_address", address);
    formData.set("city", city);
    formData.set("province", province);
    formData.set("postal_code", postalCode);
    formData.set("country", "ES");
    formData.set("type", clientKind === "individual" ? "individual" : "company");
    if (applyIrpf) {
      formData.set("apply_irpf_by_default", "on");
      formData.set("default_irpf_rate", irpfRate);
    }

    setError(null);
    setIsSaving(true);

    try {
      const result = await createContactClient(formData);

      if (result.error || !result.client) {
        setError(result.error ?? "No se pudo crear el cliente.");
        return;
      }

      onCreated(result.client);
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "No se pudo crear el cliente.";
      setError(message);
      onPersistenceError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="new-contact-form" aria-label={`Nuevo ${sectionLabel.toLowerCase().replace(/s$/, "")}`}>
      <header className="client-detail-header">
        <div className="client-title-row">
          <h1>Nuevo {sectionLabel.toLowerCase().replace(/s$/, "")}</h1>
        </div>
      </header>
      <div className="client-info-grid new-contact-grid">
        <section>
          <h2>Informacion de empresa</h2>
          <fieldset className="client-radio-group">
            <legend>Tipo de cliente</legend>
            <label>
              <input
                checked={clientKind === "self_employed"}
                name="new-client-type"
                onChange={() => setClientKind("self_employed")}
                type="radio"
              />
              <span>
                <strong>Autonomo</strong>
                <small>Profesional con actividad propia</small>
              </span>
            </label>
            <label>
              <input
                checked={clientKind === "individual"}
                name="new-client-type"
                onChange={() => setClientKind("individual")}
                type="radio"
              />
              <span>
                <strong>Particular</strong>
                <small>Cliente consumidor final</small>
              </span>
            </label>
          </fieldset>
          <label className="sage-field">
            <span>Razon social o nombre *</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="sage-field">
            <span>NIF/CIF</span>
            <input value={taxId} onChange={(e) => setTaxId(e.target.value)} />
          </label>
          <label className="sage-field">
            <span>E-mail</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
          </label>
          <label className="sage-field">
            <span>Telefono</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label className="sage-field">
            <span>Pais</span>
            <select defaultValue="ES - ES">
              <option>ES - ES</option>
              <option>PT - PT</option>
              <option>FR - FR</option>
            </select>
          </label>
        </section>
        <section>
          <h2>Domicilio del cliente</h2>
          <label className="sage-field">
            <span>Domicilio</span>
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Calle, numero, piso" />
          </label>
          <label className="sage-field">
            <span>Poblacion</span>
            <input value={city} onChange={(e) => setCity(e.target.value)} />
          </label>
          <label className="sage-field">
            <span>Provincia</span>
            <input value={province} onChange={(e) => setProvince(e.target.value)} />
          </label>
          <label className="sage-field">
            <span>Codigo postal</span>
            <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} inputMode="numeric" />
          </label>

          <h2>Retencion IRPF</h2>
          <label className="client-block-toggle">
            <strong>Aplicar IRPF por defecto</strong>
            <p>Se usara al crear facturas para este cliente.</p>
            <span className="sage-toggle-row">
              <input checked={applyIrpf} onChange={(e) => setApplyIrpf(e.target.checked)} type="checkbox" />
            </span>
          </label>
          <label className="sage-field client-short-field">
            <span>IRPF %</span>
            <input
              disabled={!applyIrpf}
              max="100"
              min="0"
              onChange={(e) => setIrpfRate(e.target.value)}
              type="number"
              value={irpfRate}
            />
          </label>
        </section>
      </div>
      {error ? <div className="sales-live-notice warning contacts-notice" role="alert">{error}</div> : null}
      <footer className="client-sticky-bar">
        <button className="quote-cancel-action" onClick={onCancel} type="button">Cancelar</button>
        <button className="client-update-action" disabled={!canCreate} onClick={handleCreate} type="button">
          {isSaving ? "Creando..." : "Crear"}
        </button>
      </footer>
    </section>
  );
}

function ClientAddressCard({
  title,
  lines,
  footerLabel,
  isEmpty = false,
  onNotice
}: {
  title: string;
  lines: string[];
  footerLabel: string;
  isEmpty?: boolean;
  onNotice: (notice: ContactNotice) => void;
}) {
  return (
    <article className={`client-address-card${isEmpty ? " empty" : ""}`}>
      {title ? <h3>{title}</h3> : null}
      <div className="client-address-body">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
        {!isEmpty ? (
          <label>
            <input defaultChecked type="checkbox" />
            {footerLabel}
          </label>
        ) : null}
      </div>
      <div className="client-card-actions">
        <button onClick={() => onNotice({ tone: "success", text: "Edicion de direccion disponible en la version completa." })} type="button">
          <PenLine aria-hidden="true" size={24} fill="currentColor" />
          Editar
        </button>
      </div>
    </article>
  );
}

function EditableAddressCard({
  client,
  title,
  footerLabel,
  onClientUpdated,
  onNotice
}: {
  client: ContactListItem;
  title: string;
  footerLabel: string;
  onClientUpdated: (client: ContactListItem) => void;
  onNotice: (notice: ContactNotice) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [address, setAddress] = useState(client.fiscalAddress ?? "");
  const [city, setCity] = useState(client.city ?? "");
  const [province, setProvince] = useState(client.province ?? "");
  const [postalCode, setPostalCode] = useState(client.postalCode ?? "");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setAddress(client.fiscalAddress ?? "");
    setCity(client.city ?? "");
    setProvince(client.province ?? "");
    setPostalCode(client.postalCode ?? "");
    setIsEditing(false);
  }, [client]);

  const save = async () => {
    setIsSaving(true);
    const formData = new FormData();
    formData.set("client_id", client.id);
    formData.set("name", client.name);
    formData.set("tax_id", client.taxId);
    formData.set("contact_email", client.contactEmail ?? "");
    formData.set("contact_phone", client.contactPhone ?? "");
    formData.set("fiscal_address", address);
    formData.set("city", city);
    formData.set("province", province);
    formData.set("postal_code", postalCode);
    formData.set("country", client.country ?? "ES");
    if (client.applyIrpfByDefault) formData.set("apply_irpf_by_default", "on");
    formData.set("default_irpf_rate", String(client.defaultIrpfRate ?? 0));
    const result = await updateContactClient(formData);
    setIsSaving(false);
    if (result.error || !result.client) {
      onNotice({ tone: "warning", text: result.error ?? "No se pudo actualizar el domicilio." });
      return;
    }
    onClientUpdated(result.client);
    setIsEditing(false);
    onNotice({ tone: "success", text: "Domicilio actualizado." });
  };

  const lines = [
    address || "Sin domicilio informado",
    [postalCode, city].filter(Boolean).join(" "),
    province || ""
  ].filter(Boolean);

  return (
    <article className={`client-address-card${!address ? " empty" : ""}`}>
      {title ? <h3>{title}</h3> : null}
      <div className="client-address-body">
        {isEditing ? (
          <>
            <label className="sage-field"><span>Domicilio</span><input value={address} onChange={(e) => setAddress(e.target.value)} /></label>
            <label className="sage-field"><span>Poblacion</span><input value={city} onChange={(e) => setCity(e.target.value)} /></label>
            <label className="sage-field"><span>Provincia</span><input value={province} onChange={(e) => setProvince(e.target.value)} /></label>
            <label className="sage-field"><span>Codigo postal</span><input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} /></label>
          </>
        ) : (
          <>
            {lines.map((line) => <p key={line}>{line}</p>)}
            {address ? (
              <label>
                <input defaultChecked type="checkbox" />
                {footerLabel}
              </label>
            ) : null}
          </>
        )}
      </div>
      <div className="client-card-actions">
        {isEditing ? (
          <>
            <button onClick={() => setIsEditing(false)} type="button">Cancelar</button>
            <button onClick={() => void save()} type="button">{isSaving ? "Guardando..." : "Guardar"}</button>
          </>
        ) : (
          <button onClick={() => setIsEditing(true)} type="button">
            <Pencil aria-hidden="true" size={24} fill="currentColor" />
            Editar
          </button>
        )}
      </div>
    </article>
  );
}

function EditableContactCard({
  client,
  onClientUpdated,
  onNotice
}: {
  client: ContactListItem;
  onClientUpdated: (client: ContactListItem) => void;
  onNotice: (notice: ContactNotice) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [email, setEmail] = useState(client.contactEmail ?? "");
  const [phone, setPhone] = useState(client.contactPhone ?? "");
  const [taxId, setTaxId] = useState(client.taxId ?? "");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setEmail(client.contactEmail ?? "");
    setPhone(client.contactPhone ?? "");
    setTaxId(client.taxId ?? "");
    setIsEditing(false);
  }, [client]);

  const save = async () => {
    setIsSaving(true);
    const formData = new FormData();
    formData.set("client_id", client.id);
    formData.set("name", client.name);
    formData.set("tax_id", taxId);
    formData.set("contact_email", email);
    formData.set("contact_phone", phone);
    formData.set("fiscal_address", client.fiscalAddress ?? "");
    formData.set("city", client.city ?? "");
    formData.set("province", client.province ?? "");
    formData.set("postal_code", client.postalCode ?? "");
    formData.set("country", client.country ?? "ES");
    if (client.applyIrpfByDefault) formData.set("apply_irpf_by_default", "on");
    formData.set("default_irpf_rate", String(client.defaultIrpfRate ?? 0));
    const result = await updateContactClient(formData);
    setIsSaving(false);
    if (result.error || !result.client) {
      onNotice({ tone: "warning", text: result.error ?? "No se pudo actualizar el contacto." });
      return;
    }
    onClientUpdated(result.client);
    setIsEditing(false);
    onNotice({ tone: "success", text: "Contacto actualizado." });
  };

  const lines = [
    email ? `Email: ${email}` : "",
    phone ? `Telefono: ${phone}` : "",
    taxId ? `NIF/CIF: ${taxId}` : ""
  ].filter(Boolean);

  return (
    <article className={`client-address-card${lines.length === 0 ? " empty" : ""}`}>
      <h3>Contacto principal</h3>
      <div className="client-address-body">
        {isEditing ? (
          <>
            <label className="sage-field"><span>E-mail</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label className="sage-field"><span>Telefono</span><input value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
            <label className="sage-field"><span>NIF/CIF</span><input value={taxId} onChange={(e) => setTaxId(e.target.value)} /></label>
          </>
        ) : lines.length > 0 ? (
          lines.map((line) => <p key={line}>{line}</p>)
        ) : (
          <p>Sin datos de contacto informados.</p>
        )}
      </div>
      <div className="client-card-actions">
        {isEditing ? (
          <>
            <button onClick={() => setIsEditing(false)} type="button">Cancelar</button>
            <button onClick={() => void save()} type="button">{isSaving ? "Guardando..." : "Guardar"}</button>
          </>
        ) : (
          <button onClick={() => setIsEditing(true)} type="button">
            <Pencil aria-hidden="true" size={24} fill="currentColor" />
            Editar
          </button>
        )}
      </div>
    </article>
  );
}
