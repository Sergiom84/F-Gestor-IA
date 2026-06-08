"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  MoreVertical,
  Paperclip,
  PenLine,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserRound,
  WalletCards,
  X
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  artificialEmployeeRows
} from "../../_data/artificial-business-data";
import type { ArtificialContactListItem } from "../../_data/artificial-business-data";

type ContactsWorkspaceProps = {
  organizationName: string;
  initialClients?: ArtificialContactListItem[];
  initialSuppliers?: ArtificialContactListItem[];
};
import { formatMoney } from "../../_lib/formatters";

type ContactSectionId = "clients" | "suppliers" | "employees";
type ClientTabId = "info" | "contacts" | "payment" | "addresses" | "sales";
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
  { id: "sales", label: "Condiciones de venta" }
] satisfies Array<{ id: ClientTabId; label: string }>;

const employeeRows: ContactListItem[] = artificialEmployeeRows;

export function ContactsWorkspace({ organizationName, initialClients, initialSuppliers }: ContactsWorkspaceProps) {
  const clientRows: ContactListItem[] = initialClients ?? artificialClientRows;
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
    const label = currentSection.label.toLowerCase();
    setNotice({ tone: "success", text: `Alta de ${label.slice(0, -1)} disponible en la version completa.` });
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
          {activeSection === "clients" ? "45 elementos" : `${filteredRows.length} elementos`}
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
          <NewContactForm sectionLabel={currentSection.label} onCancel={() => setIsCreatingContact(false)} />
        ) : activeSection !== "clients" ? (
          <ContactCategoryPlaceholder sectionLabel={currentSection.label} />
        ) : selectedClient ? (
          <ClientDetail
            client={selectedClient}
            activeTab={activeClientTab}
            onTabChange={setActiveClientTab}
            organizationName={organizationName}
            onNotice={setNotice}
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
  onNotice
}: {
  client: ContactListItem;
  activeTab: ClientTabId;
  onTabChange: (tab: ClientTabId) => void;
  organizationName: string;
  onNotice: (notice: ContactNotice) => void;
}) {
  const [isDirty, setIsDirty] = useState(false);
  const [showClientMenu, setShowClientMenu] = useState(false);

  const handleUpdate = () => {
    onNotice({ tone: "success", text: `${client.name} actualizado.` });
    setIsDirty(false);
  };

  return (
    <section className="client-detail" aria-label={client.name}>
      <header className="client-detail-header">
        <div className="client-title-row">
          <h1>{client.name}</h1>
          <button
            className="insights-pill sales-insights-pill"
            onClick={() => onNotice({ tone: "success", text: "Copilot Insights disponible en la version completa." })}
            type="button"
          >
            <Sparkles aria-hidden="true" size={18} fill="currentColor" />
            Copilot Insights
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
          <div className="contacts-actions-menu">
            <button
              className="client-more-button"
              onClick={() => setShowClientMenu((current) => !current)}
              type="button"
              aria-label={`Mas acciones de ${client.name}`}
            >
              <MoreVertical aria-hidden="true" size={27} />
            </button>
            {showClientMenu ? (
              <div className="contacts-section-menu contacts-actions-popover" role="menu">
                <button onClick={() => { onNotice({ tone: "success", text: "Historial de actividad disponible en la version completa." }); setShowClientMenu(false); }} type="button">Ver actividad</button>
                <button onClick={() => { onNotice({ tone: "success", text: "Envio de comunicaciones disponible en la version completa." }); setShowClientMenu(false); }} type="button">Enviar comunicacion</button>
                <button onClick={() => { onNotice({ tone: "warning", text: "Eliminacion de cliente disponible en la version completa." }); setShowClientMenu(false); }} type="button">Eliminar cliente</button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="client-warning">
        <AlertTriangle aria-hidden="true" size={25} fill="currentColor" />
        <div>
          <strong>Tipo de cliente necesario para la facturacion electronica</strong>
          <p>
            Para que los registros de los clientes se ajusten a los requisitos de la facturacion electronica, selecciona "Empresa" o "Particular" en "Tipo de cliente".
          </p>
        </div>
      </div>

      <div className="client-balance-row">
        <ClientMetric label="Saldo contable" value={6814.72} />
        <ClientMetric label="Importe vencido" value={6814.72} />
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
        {activeTab === "info" ? <ClientInfoPanel client={client} onNotice={onNotice} /> : null}
        {activeTab === "contacts" ? <ClientContactsPanel onNotice={onNotice} /> : null}
        {activeTab === "payment" ? <ClientPaymentPanel onNotice={onNotice} /> : null}
        {activeTab === "addresses" ? <ClientAddressesPanel onNotice={onNotice} /> : null}
        {activeTab === "sales" ? <ClientSalesPanel organizationName={organizationName} /> : null}
      </section>

      <footer className="client-sticky-bar">
        <button className="quote-cancel-action" onClick={() => setIsDirty(false)} type="button">Cancelar</button>
        <button
          className="client-update-action"
          disabled={!isDirty}
          onClick={handleUpdate}
          type="button"
        >
          Actualizar
        </button>
        <button
          className="client-update-more"
          disabled={!isDirty}
          onClick={handleUpdate}
          type="button"
          aria-label="Mas opciones de actualizacion"
        >
          <ChevronDown aria-hidden="true" size={18} />
        </button>
      </footer>
    </section>
  );
}

function ClientMetric({ label, value }: { label: string; value: number }) {
  return (
    <article className="client-metric">
      <strong>{formatMoney(value)}</strong>
      <span>{label}</span>
    </article>
  );
}

function ClientInfoPanel({
  client,
  onNotice
}: {
  client: ContactListItem;
  onNotice: (notice: ContactNotice) => void;
}) {
  return (
    <div className="client-info-grid">
      <section>
        <h2>Informacion de empresa</h2>
        <fieldset className="client-radio-group">
          <legend>Tipo de cliente</legend>
          <label>
            <input defaultChecked name="client-type" type="radio" />
            <span>
              <strong>Empresa</strong>
              <small>Sociedades, autonomos y otras organizaciones</small>
            </span>
          </label>
          <label>
            <input name="client-type" type="radio" />
            <span>
              <strong>Particular</strong>
              <small>Consumidores privados</small>
            </span>
          </label>
        </fieldset>
        <label className="sage-field">
          <span>Codigo *</span>
          <input defaultValue={client.code} disabled />
        </label>
        <label className="sage-field">
          <span>Razon social o nombre *</span>
          <input defaultValue={client.name} />
        </label>
        <label className="sage-field">
          <span>Nombre comercial</span>
          <input defaultValue={client.name} />
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
        <h2>Direccion e informacion de contacto</h2>
        <ClientAddressCard
          title="Direccion principal"
          lines={["CALLE JORGE JUAN 2 ESC 3 PTA 9", "28703 SAN SEBASTIAN DE LOS RE...", "MADRID - ESPANA"]}
          footerLabel="Igual que direccion de entrega"
          onNotice={onNotice}
        />
        <ClientAddressCard title="Contacto principal" lines={[]} footerLabel="Editar" isEmpty onNotice={onNotice} />
      </section>
    </div>
  );
}

function ClientContactsPanel({ onNotice }: { onNotice: (notice: ContactNotice) => void }) {
  return (
    <div className="client-simple-panel">
      <button
        className="sage-primary-button compact-contact-button"
        onClick={() => onNotice({ tone: "success", text: "Alta de contacto disponible en la version completa." })}
        type="button"
      >
        <Plus aria-hidden="true" size={22} />
        Anadir
      </button>
    </div>
  );
}

function ClientPaymentPanel({ onNotice }: { onNotice: (notice: ContactNotice) => void }) {
  return (
    <div className="client-payment-panel">
      <div className="client-payment-fields">
        <label className="sage-field">
          <span>Condiciones de pago</span>
          <select defaultValue="iban">
            <option value="iban">No. de IBAN:ES83 0049 4999 7926 1605 19</option>
          </select>
        </label>
        <label className="sage-field">
          <span>Forma de pago</span>
          <select defaultValue="transferencia">
            <option value="transferencia">Transferencia</option>
          </select>
        </label>
        <label className="sage-field client-token-select">
          <span>Dias de pago de cliente</span>
          <select defaultValue="1">
            <option value="1">1 x</option>
          </select>
        </label>
      </div>
      <button
        className="sage-primary-button compact-contact-button"
        onClick={() => onNotice({ tone: "success", text: "Alta de condicion de pago disponible en la version completa." })}
        type="button"
      >
        <Plus aria-hidden="true" size={22} />
        Anadir
      </button>
      <article className="client-payment-card">
        <div>
          <p>1.er vencimiento</p>
          <strong>100 %</strong>
          <strong>A pagar despues de 1 dia</strong>
        </div>
        <div className="client-card-actions">
          <button onClick={() => onNotice({ tone: "success", text: "Edicion de condicion de pago disponible en la version completa." })} type="button">
            <PenLine aria-hidden="true" size={24} fill="currentColor" />
            Editar
          </button>
          <button className="danger" onClick={() => onNotice({ tone: "warning", text: "Condicion de pago eliminada de la vista." })} type="button">
            <Trash2 aria-hidden="true" size={24} fill="currentColor" />
            Eliminar
          </button>
        </div>
      </article>
    </div>
  );
}

function ClientAddressesPanel({ onNotice }: { onNotice: (notice: ContactNotice) => void }) {
  return (
    <div className="client-simple-panel">
      <button
        className="sage-primary-button compact-contact-button"
        onClick={() => onNotice({ tone: "success", text: "Alta de direccion disponible en la version completa." })}
        type="button"
      >
        <Plus aria-hidden="true" size={22} />
        Anadir
      </button>
      <ClientAddressCard
        title=""
        lines={["CALLE JORGE JUAN 2 ESC 3 PTA 9", "28703 SAN SEBASTIAN DE LOS RE...", "MADRID - ESPANA"]}
        footerLabel="Direccion de entrega por defecto"
        onNotice={onNotice}
      />
    </div>
  );
}

function ClientSalesPanel({ organizationName }: { organizationName: string }) {
  return (
    <div className="client-sales-grid">
      <section>
        <h2>Condiciones de venta</h2>
        <label className="sage-field client-short-field">
          <span>Codigo de tarifa</span>
          <select defaultValue="">
            <option value="">Seleccionar...</option>
            <option>{organizationName}</option>
          </select>
        </label>
        <label className="sage-field">
          <span>Nombre de tarifa</span>
          <input disabled />
        </label>
        <label className="sage-field client-short-field">
          <span>Codigo de grupo de descuentos</span>
          <select defaultValue="">
            <option value="">Seleccionar...</option>
          </select>
        </label>
        <label className="sage-field">
          <span>Nombre de grupo de descuentos</span>
          <input disabled />
        </label>
        <label className="sage-field client-discount-field">
          <span>% descuento a cliente</span>
          <input defaultValue="0,00" />
        </label>
      </section>

      <section>
        <h2>Gestion de documentos de venta</h2>
        <ClientBlockToggle title="Bloquear facturas" description="No se van a poder crear facturas para este cliente." />
        <ClientBlockToggle title="Bloquear albaranes" description="No se van a poder crear albaranes para este cliente." />
        <ClientBlockToggle title="Bloquear pedidos" description="No se van a poder crear pedidos para este cliente." />
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
        <button type="button">OFF</button>
      </div>
    </div>
  );
}

function NewContactForm({ sectionLabel, onCancel }: { sectionLabel: string; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [taxId, setTaxId] = useState("");
  const [email, setEmail] = useState("");
  const canCreate = name.trim().length > 0 && code.trim().length > 0;

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
          <label className="sage-field">
            <span>Codigo *</span>
            <input value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
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
            <span>Pais</span>
            <select defaultValue="ES - ES">
              <option>ES - ES</option>
              <option>PT - PT</option>
              <option>FR - FR</option>
            </select>
          </label>
        </section>
      </div>
      <footer className="client-sticky-bar">
        <button className="quote-cancel-action" onClick={onCancel} type="button">Cancelar</button>
        <button className="client-update-action" disabled={!canCreate} type="button">Crear</button>
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
