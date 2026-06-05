import type {
  Organization,
  OrganizationMember
} from "../../_lib/types";
import {
  BarChart3,
  LineChart
} from "lucide-react";
import type { ReactNode } from "react";
import { formatMoney } from "../../_lib/formatters";

type AccountingDashboardMetric = {
  label: string;
  value: number;
};

const accountingValues = {
  grossProfit: 33557.13,
  sales: 38020.56,
  purchases: 4463.43,
  profitBeforeTax: 32950.35,
  operatingResult: 32950.35,
  financialResult: 0,
  exceptionalResult: 0,
  assets: 47069.64,
  netWorth: 32950.35,
  treasury: 0,
  workingCapital: 32950.35,
  staffCosts: 0
};

const additionalIndicators = [
  {
    title: "Saldo de tesorería",
    value: accountingValues.treasury,
    description: "Saldo de cuentas bancarias y efectivo (ejercicio en curso hasta la fecha)"
  },
  {
    title: "Capital circulante",
    value: accountingValues.workingCapital,
    description: "Suma de activo corriente, existencias y trabajos en curso menos deudas no financieras e ingresos diferidos"
  },
  {
    title: "Gastos de personal",
    value: accountingValues.staffCosts,
    description: "Gastos de personal (ejercicio en curso hasta la fecha)"
  }
];

export function AccountingDashboard({
  activeOrganization
}: {
  activeOrganization: Organization;
  activeMembership: OrganizationMember | null | undefined;
  documents: unknown[];
  reviewTasks: unknown[];
  fiscalEntities: unknown[];
  documentCount: number;
  needsReviewCount: number;
  ocrRequiredCount: number;
  clientCount: number;
  fiscalEntityCount: number;
  cleanDocumentCount: number;
  automationRate: number;
  reviewRate: number;
  uploadCoverage: number;
  aiBudget: string;
}) {
  return (
    <section className="accounting-dashboard-view" aria-label={`Cuadro de mando contable de ${activeOrganization.name}`}>
      <DashboardSection title="Indicadores de pérdidas y ganancias">
        <div className="accounting-profit-grid">
          <AccountingWideCard
            icon={<BarChart3 aria-hidden="true" size={28} strokeWidth={3} />}
            title="Beneficio bruto"
            description="Ventas menos compras (ejercicio en curso hasta la fecha)"
            value={accountingValues.grossProfit}
            metrics={[
              { label: "Ventas", value: accountingValues.sales },
              { label: "Compras", value: accountingValues.purchases }
            ]}
          />
          <AccountingWideCard
            icon={<LineChart aria-hidden="true" size={28} strokeWidth={3} />}
            title="Resultado antes de impuestos sobre beneficios"
            description="Suma de resultado de explotación, resultado financiero y resultados excepcionales antes de impuestos sobre beneficios (ejercicio en curso hasta la fecha)"
            value={accountingValues.profitBeforeTax}
            metrics={[
              { label: "Resultado de explotación", value: accountingValues.operatingResult },
              { label: "Resultado financiero", value: accountingValues.financialResult },
              { label: "Resultados excepcionales", value: accountingValues.exceptionalResult }
            ]}
          />
        </div>
      </DashboardSection>

      <DashboardSection title="Indicadores de rendimiento">
        <div className="accounting-performance-grid">
          <AccountingRatioCard
            title="Rendimiento sobre ventas"
            description="Resultado de explotación dividido entre ventas por 100 (ejercicio en curso hasta la fecha)"
            ratio="87%"
            metrics={[
              { label: "Resultado de explotación", value: accountingValues.operatingResult },
              { label: "Ventas", value: accountingValues.sales }
            ]}
          />
          <AccountingRatioCard
            title="Rendimiento sobre activos"
            description="Resultado de explotación dividido entre activos por 100 (ejercicio en curso hasta la fecha)"
            ratio="70%"
            metrics={[
              { label: "Resultado de explotación", value: accountingValues.operatingResult },
              { label: "Activos", value: accountingValues.assets }
            ]}
          />
          <AccountingRatioCard
            title="Rendimiento sobre patrimonio neto"
            description="Resultado neto dividido entre patrimonio neto por 100 (ejercicio en curso hasta la fecha)"
            ratio="100%"
            metrics={[
              { label: "Resultado neto", value: accountingValues.profitBeforeTax },
              { label: "Patrimonio neto", value: accountingValues.netWorth }
            ]}
          />
        </div>
      </DashboardSection>

      <section className="accounting-bottom-grid">
        <div>
          <h2>Indicadores financieros adicionales</h2>
          <div className="accounting-additional-grid">
            {additionalIndicators.map((indicator) => (
              <article className="accounting-simple-card" key={indicator.title}>
                <h3>{indicator.title}</h3>
                <strong>{formatMoney(indicator.value)}</strong>
                <p>{indicator.description}</p>
              </article>
            ))}
          </div>
        </div>

        <aside className="accounting-quick-panel" aria-label="Accesos rápidos">
          <h2>Accesos rápidos</h2>
          <div className="accounting-quick-card">
            <a href={`/dashboard?org=${activeOrganization.id}&module=accounting`}>Crear asientos</a>
            <a href={`/dashboard?org=${activeOrganization.id}&module=accounting`}>Marcar apuntes</a>
            <a href={`/dashboard?org=${activeOrganization.id}&module=accounting`}>Consultar libro mayor</a>
          </div>
        </aside>
      </section>
    </section>
  );
}

function DashboardSection({
  children,
  title
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="accounting-dashboard-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function AccountingWideCard({
  description,
  icon,
  metrics,
  title,
  value
}: {
  description: string;
  icon: ReactNode;
  metrics: AccountingDashboardMetric[];
  title: string;
  value: number;
}) {
  return (
    <article className="accounting-wide-card">
      <div className="accounting-card-heading">
        <span className="accounting-card-icon">{icon}</span>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <strong>{formatMoney(value)}</strong>
      </div>
      <MetricRow metrics={metrics} />
    </article>
  );
}

function AccountingRatioCard({
  description,
  metrics,
  ratio,
  title
}: {
  description: string;
  metrics: AccountingDashboardMetric[];
  ratio: string;
  title: string;
}) {
  return (
    <article className="accounting-ratio-card">
      <h3>{title}</h3>
      <p>{description}</p>
      <strong className="accounting-ratio-value">{ratio}</strong>
      <MetricRow metrics={metrics} />
    </article>
  );
}

function MetricRow({ metrics }: { metrics: AccountingDashboardMetric[] }) {
  return (
    <div className={`accounting-metric-row cols-${metrics.length}`}>
      {metrics.map((metric) => (
        <div className="accounting-metric" key={metric.label}>
          <span>{metric.label}</span>
          <strong>{formatMoney(metric.value)}</strong>
        </div>
      ))}
    </div>
  );
}
