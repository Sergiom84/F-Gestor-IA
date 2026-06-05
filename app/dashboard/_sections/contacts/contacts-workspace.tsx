"use client";

import {
  AlertTriangle,
  ChevronDown,
  MoreVertical,
  Paperclip,
  PenLine,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserRound,
  WalletCards
} from "lucide-react";
import { useMemo, useState } from "react";
import { formatMoney } from "../../_lib/formatters";

type ContactSectionId = "clients" | "suppliers" | "employees";
type ClientTabId = "info" | "contacts" | "payment" | "addresses" | "sales";

type ContactListItem = {
  id: string;
  name: string;
  code: string;
  taxId: string;
};

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

const clientRows: ContactListItem[] = [
  { id: "client-43", name: "AIRE NORTE 1649 SL", code: "43", taxId: "B26590299" },
  { id: "client-2", name: "ANA ZORRILLA TORRAS", code: "2", taxId: "01495127N" },
  { id: "client-38", name: "ANDA CONMIGO SL", code: "38", taxId: "B05315700" },
  { id: "client-29", name: "ANDRES MAURICIO GIRALDO", code: "29", taxId: "60056406W" },
  { id: "client-15", name: "ANTONIO LOPEZ DIAZ", code: "15", taxId: "50794342S" },
  { id: "client-23", name: "AUTOALMACENAJE PERSONAL SL", code: "23", taxId: "B86713567" },
  { id: "client-6", name: "CAJICATOLU SL", code: "6", taxId: "B87940912" },
  { id: "client-45", name: "CESAR MANUEL MARINO BRAVO", code: "45", taxId: "53309922Q" }
];

const supplierRows: ContactListItem[] = [
  { id: "supplier-1", name: "BRICOLAJE BRICOMAN SL", code: "102", taxId: "B84402031" },
  { id: "supplier-2", name: "TALLERES PACHE 18 SL", code: "103", taxId: "B87900176" }
];

const employeeRows: ContactListItem[] = [
  { id: "employee-1", name: "MARTA ADMINISTRACION", code: "E01", taxId: "00000001E" }
];

export function ContactsWorkspace({ organizationName }: { organizationName: string }) {
  const [activeSection, setActiveSection] = useState<ContactSectionId>("clients");
  const [isSectionMenuOpen, setIsSectionMenuOpen] = useState(false);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [activeClientTab, setActiveClientTab] = useState<ClientTabId>("info");
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

  return (
    <section className="contacts-workspace" aria-label="Contactos">
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
            <button className="sage-primary-button compact-contact-button" type="button">
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
                  <button type="button">Importar contactos</button>
                  <button type="button">Exportar lista</button>
                  <button type="button">Combinar duplicados</button>
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
        {activeSection !== "clients" ? (
          <ContactCategoryPlaceholder sectionLabel={currentSection.label} />
        ) : selectedClient ? (
          <ClientDetail client={selectedClient} activeTab={activeClientTab} onTabChange={setActiveClientTab} organizationName={organizationName} />
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
  organizationName
}: {
  client: ContactListItem;
  activeTab: ClientTabId;
  onTabChange: (tab: ClientTabId) => void;
  organizationName: string;
}) {
  return (
    <section className="client-detail" aria-label={client.name}>
      <header className="client-detail-header">
        <div className="client-title-row">
          <h1>{client.name}</h1>
          <button className="insights-pill sales-insights-pill" type="button">
            <Sparkles aria-hidden="true" size={18} fill="currentColor" />
            Copilot Insights
          </button>
        </div>
        <div className="client-header-actions">
          <button type="button">
            <WalletCards aria-hidden="true" size={23} />
            Registrar cobro
          </button>
          <button type="button">
            <Paperclip aria-hidden="true" size={25} />
            Ver o adjuntar ficheros
          </button>
          <button className="client-more-button" type="button" aria-label={`Mas acciones de ${client.name}`}>
            <MoreVertical aria-hidden="true" size={27} />
          </button>
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

      <section className="client-tab-panel">
        {activeTab === "info" ? <ClientInfoPanel client={client} /> : null}
        {activeTab === "contacts" ? <ClientContactsPanel /> : null}
        {activeTab === "payment" ? <ClientPaymentPanel /> : null}
        {activeTab === "addresses" ? <ClientAddressesPanel /> : null}
        {activeTab === "sales" ? <ClientSalesPanel organizationName={organizationName} /> : null}
      </section>

      <footer className="client-sticky-bar">
        <button className="quote-cancel-action" type="button">Cancelar</button>
        <button className="client-update-action" disabled type="button">Actualizar</button>
        <button className="client-update-more" disabled type="button" aria-label="Mas opciones de actualizacion">
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

function ClientInfoPanel({ client }: { client: ContactListItem }) {
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
        />
        <ClientAddressCard title="Contacto principal" lines={[]} footerLabel="Editar" isEmpty />
      </section>
    </div>
  );
}

function ClientContactsPanel() {
  return (
    <div className="client-simple-panel">
      <button className="sage-primary-button compact-contact-button" type="button">
        <Plus aria-hidden="true" size={22} />
        Anadir
      </button>
    </div>
  );
}

function ClientPaymentPanel() {
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
      <button className="sage-primary-button compact-contact-button" type="button">
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
          <button type="button">
            <PenLine aria-hidden="true" size={24} fill="currentColor" />
            Editar
          </button>
          <button className="danger" type="button">
            <Trash2 aria-hidden="true" size={24} fill="currentColor" />
            Eliminar
          </button>
        </div>
      </article>
    </div>
  );
}

function ClientAddressesPanel() {
  return (
    <div className="client-simple-panel">
      <button className="sage-primary-button compact-contact-button" type="button">
        <Plus aria-hidden="true" size={22} />
        Anadir
      </button>
      <ClientAddressCard
        title=""
        lines={["CALLE JORGE JUAN 2 ESC 3 PTA 9", "28703 SAN SEBASTIAN DE LOS RE...", "MADRID - ESPANA"]}
        footerLabel="Direccion de entrega por defecto"
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

function ClientAddressCard({
  title,
  lines,
  footerLabel,
  isEmpty = false
}: {
  title: string;
  lines: string[];
  footerLabel: string;
  isEmpty?: boolean;
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
        <button type="button">
          <PenLine aria-hidden="true" size={24} fill="currentColor" />
          Editar
        </button>
      </div>
    </article>
  );
}
