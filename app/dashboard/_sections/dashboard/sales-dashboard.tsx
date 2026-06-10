import {
  BadgeEuro,
  ExternalLink,
  FileSearch,
  FileText,
  MoreVertical,
  ShoppingCart,
  Users
} from "lucide-react";
import type { ReactNode } from "react";
import { SmallIndicatorCard } from "../../_components/erp-cards";
import {
  artificialSalesDashboardRows,
  artificialSalesDashboardTotals,
  artificialSalesDocuments
} from "../../_data/artificial-business-data";

type SalesDashboardMetrics = {
  pendingCollection?: number;
  pendingPayment?: number;
  overdueCollection?: number;
  overduePayment?: number;
  purchaseInvoicesTotal?: number;
};
import { formatMoney } from "../../_lib/formatters";
import type { SalesInvoiceRow } from "../../_lib/types";

export function SalesDashboard({
  clientCount,
  documentCount,
  fiscalEntityCount,
  pendingCollection: pendingCollectionProp,
  pendingPayment: pendingPaymentProp,
  overdueCollection: overdueCollectionProp,
  overduePayment: overduePaymentProp,
  purchaseInvoicesTotal: purchaseInvoicesTotalProp
}: {
  clientCount: number;
  documentCount: number;
  fiscalEntityCount: number;
} & SalesDashboardMetrics) {
  const pendingCollection = pendingCollectionProp ?? artificialSalesDashboardTotals.pendingCollection;
  const pendingPayment = pendingPaymentProp ?? artificialSalesDashboardTotals.pendingPayment;
  const overdueCollection = overdueCollectionProp ?? artificialSalesDashboardTotals.overdueCollection;
  const overduePayment = overduePaymentProp ?? artificialSalesDashboardTotals.overduePayment;
  const purchaseInvoicesTotal = purchaseInvoicesTotalProp ?? artificialSalesDashboardTotals.purchaseInvoicesTotal;
  const convertedQuotes = artificialSalesDocuments.quotes.filter((q) => q.status === "Cerrado").length;
  const activeClients = clientCount;

  return (
    <div className="sales-dashboard-view">
      <section className="dashboard-section" aria-labelledby="outstanding-title">
        <h2 id="outstanding-title">Importes pendientes</h2>
        <div className="outstanding-grid">
          <OutstandingAmountCard
            icon={<FileText aria-hidden="true" size={27} />}
            title="Pendiente de cobro"
            amount={pendingCollection}
            overdueAmount={overdueCollection}
            links={["Ver vencimientos", "Ver antiguedad de saldos"]}
          />
          <OutstandingAmountCard
            icon={<BadgeEuro aria-hidden="true" size={27} />}
            title="Pendiente de pago"
            amount={pendingPayment}
            overdueAmount={overduePayment}
            links={["Ver vencimientos", "Ver antiguedad de saldos"]}
          />
        </div>
      </section>

      <section className="sales-overview-grid" aria-label="Indicadores de ventas y compras">
        <SalesSummaryTile
          icon={<BadgeEuro aria-hidden="true" size={25} />}
          tone="green"
          value={formatMoney(pendingCollection)}
          description='Total de facturas contabilizadas desde "Facturas de venta" (ejercicio en curso hasta la fecha)'
        />
        <SalesSummaryTile
          icon={<ShoppingCart aria-hidden="true" size={25} />}
          tone="rose"
          value={formatMoney(purchaseInvoicesTotal)}
          description='Total de facturas contabilizadas desde "Facturas de compra" (ejercicio en curso hasta la fecha)'
        />
        <SalesSummaryTile
          icon={<Users aria-hidden="true" size={25} />}
          tone="blue"
          value={activeClients.toLocaleString("es-ES")}
          description="Clientes activos"
        />
        <aside className="sales-quick-card">
          <h2>Accesos rapidos</h2>
          <div className="quick-links">
            <a href="#sales-customers">Crear clientes</a>
            <a href="#sales-suppliers">Crear proveedores</a>
            <a href="#sales-invoices">Crear facturas de venta</a>
            <a href="#purchase-upload">Subir facturas de compra</a>
          </div>
        </aside>
      </section>

      <SalesInvoiceTable rows={artificialSalesDashboardRows} totalItems={artificialSalesDashboardRows.length} />

      <section className="quotes-dashboard-grid" aria-label="Presupuestos">
        <div className="quotes-side-stack">
          <SmallIndicatorCard
            title="Presupuestos pendientes"
            value={formatMoney(0)}
            description="Total de todos los presupuestos pendientes"
          />
          <SalesSummaryTile
            icon={<FileText aria-hidden="true" size={23} />}
            tone="green"
            value={convertedQuotes.toLocaleString("es-ES")}
            description="Presupuestos convertidos en otro documento de venta"
          />
        </div>
        <section className="sales-table-card">
          <div className="sales-table-heading">
            <h2>Presupuestos pendientes</h2>
            <p>Consulta todos los presupuestos pendientes.</p>
          </div>
          <div className="sales-table-wrap quote-table">
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Fecha de presup...</th>
                  <th>Numero de presupuesto</th>
                  <th>Cliente</th>
                  <th>Codigo de cliente</th>
                  <th>Total</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={6}>
                    <div className="table-empty-state">
                      <FileSearch aria-hidden="true" size={76} />
                      <div>
                        <strong>Esta lista esta en blanco.</strong>
                        <p>La busqueda no ha dado ningun resultado. Intentalo de nuevo.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6}>Elementos: 0</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="sales-table-actions">
            <a href="#quotes">Ver todos los presupuestos</a>
            <a href="#quote-reminders">Preparar recordatorios</a>
          </div>
        </section>
      </section>

      <section className="sales-footnote-grid" aria-label="Cobertura operacional">
        <SmallIndicatorCard
          title="Organizaciones fiscales"
          value={fiscalEntityCount.toLocaleString("es-ES")}
          description="Entidades disponibles para clasificar ventas, compras y documentos."
        />
        <SmallIndicatorCard
          title="Documentos conectados"
          value={documentCount.toLocaleString("es-ES")}
          description="Base documental actual para alimentar el futuro modulo comercial."
        />
      </section>
    </div>
  );
}

function OutstandingAmountCard({
  icon,
  title,
  amount,
  overdueAmount,
  links
}: {
  icon: ReactNode;
  title: string;
  amount: number;
  overdueAmount: number;
  links: string[];
}) {
  return (
    <article className="outstanding-card">
      <div className="outstanding-title">
        <span>{icon}</span>
        <h3>{title}</h3>
      </div>
      <p>
        <span>Importe vencido:</span> {formatMoney(overdueAmount)}
      </p>
      <div className="outstanding-bar" aria-hidden="true" />
      <strong>{formatMoney(amount)} Total</strong>
      <div className="outstanding-actions">
        {links.map((link) => (
          <a href="#sales-vencimientos" key={link}>{link}</a>
        ))}
      </div>
    </article>
  );
}

function SalesSummaryTile({
  icon,
  tone,
  value,
  description
}: {
  icon: ReactNode;
  tone: "green" | "rose" | "blue";
  value: string;
  description: string;
}) {
  return (
    <article className="sales-summary-tile">
      <span className={`sales-tile-icon ${tone}`}>{icon}</span>
      <div>
        <strong>{value}</strong>
        <p>{description}</p>
      </div>
    </article>
  );
}

function SalesInvoiceTable({ rows, totalItems }: { rows: SalesInvoiceRow[]; totalItems: number }) {
  return (
    <section className="sales-table-card" id="sales-invoices">
      <div className="sales-table-heading">
        <h2>Facturas de venta vencidas</h2>
        <p>Consulta todas las facturas de venta que han vencido.</p>
      </div>
      <div className="sales-table-wrap">
        <table className="sales-table">
          <thead>
            <tr>
              <th>Estado</th>
              <th>Fecha de factura</th>
              <th>Numero de factura</th>
              <th>Cliente</th>
              <th>Codigo de cliente</th>
              <th>Total</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td><span className="expired-badge">{row.status}</span></td>
                <td>{row.invoiceDate}</td>
                <td>
                  <a className="invoice-link" href={`#invoice-${row.invoiceNumber}`}>
                    {row.invoiceNumber}
                    <ExternalLink aria-hidden="true" size={17} />
                  </a>
                </td>
                <td>{row.customer}</td>
                <td>{row.customerCode}</td>
                <td>{formatMoney(row.total)}</td>
                <td>
                  <button className="table-icon-button" type="button" aria-label={`Acciones ${row.invoiceNumber}`}>
                    <MoreVertical aria-hidden="true" size={22} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={7}>Elementos: {totalItems.toLocaleString("es-ES")}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="sales-table-actions">
        <a href="#all-sales-invoices">Ver todas las facturas</a>
        <a href="#sales-reminders">Preparar recordatorios</a>
      </div>
    </section>
  );
}
