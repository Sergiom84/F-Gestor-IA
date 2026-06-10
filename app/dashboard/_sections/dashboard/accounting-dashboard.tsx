import type { ReactNode } from "react";
import { BarChart3, LineChart } from "lucide-react";
import { readAccountingDashboardData } from "../../_data/accounting-dashboard-data";
import { formatMoney } from "../../_lib/formatters";

type AccountingDashboardMetric = {
  label: string;
  value: number;
};

function ratio(numerator: number, denominator: number): string {
  if (denominator === 0) return "—";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

export async function AccountingDashboard({
  organizationId
}: {
  organizationId: string;
}) {
  const d = await readAccountingDashboardData(organizationId);

  const additionalIndicators = [
    {
      title: "Saldo de tesorería",
      value: d.treasury,
      description: "Saldo de cuentas bancarias y efectivo (ejercicio en curso hasta la fecha)"
    },
    {
      title: "Capital circulante",
      value: d.workingCapital,
      description:
        "Suma de activo corriente, existencias y trabajos en curso menos deudas no financieras e ingresos diferidos"
    },
    {
      title: "Gastos de personal",
      value: d.staffCosts,
      description: "Gastos de personal (ejercicio en curso hasta la fecha)"
    }
  ];

  return (
    <section className="accounting-dashboard-view">
      <DashboardSection title="Indicadores de pérdidas y ganancias">
        <div className="accounting-profit-grid">
          <AccountingWideCard
            icon={<BarChart3 aria-hidden="true" size={28} strokeWidth={3} />}
            title="Beneficio bruto"
            description="Ventas menos compras (ejercicio en curso hasta la fecha)"
            value={d.grossProfit}
            metrics={[
              { label: "Ventas", value: d.sales },
              { label: "Compras", value: d.purchases }
            ]}
          />
          <AccountingWideCard
            icon={<LineChart aria-hidden="true" size={28} strokeWidth={3} />}
            title="Resultado antes de impuestos sobre beneficios"
            description="Suma de resultado de explotación, resultado financiero y resultados excepcionales antes de impuestos sobre beneficios (ejercicio en curso hasta la fecha)"
            value={d.profitBeforeTax}
            metrics={[
              { label: "Resultado de explotación", value: d.operatingResult },
              { label: "Resultado financiero", value: d.financialResult },
              { label: "Resultados excepcionales", value: d.exceptionalResult }
            ]}
          />
        </div>
      </DashboardSection>

      <DashboardSection title="Indicadores de rendimiento">
        <div className="accounting-performance-grid">
          <AccountingRatioCard
            title="Rendimiento sobre ventas"
            description="Resultado de explotación dividido entre ventas por 100 (ejercicio en curso hasta la fecha)"
            ratio={ratio(d.operatingResult, d.sales)}
            metrics={[
              { label: "Resultado de explotación", value: d.operatingResult },
              { label: "Ventas", value: d.sales }
            ]}
          />
          <AccountingRatioCard
            title="Rendimiento sobre activos"
            description="Resultado de explotación dividido entre activos por 100 (ejercicio en curso hasta la fecha)"
            ratio={ratio(d.operatingResult, d.assets)}
            metrics={[
              { label: "Resultado de explotación", value: d.operatingResult },
              { label: "Activos", value: d.assets }
            ]}
          />
          <AccountingRatioCard
            title="Rendimiento sobre patrimonio neto"
            description="Resultado neto dividido entre patrimonio neto por 100 (ejercicio en curso hasta la fecha)"
            ratio={ratio(d.profitBeforeTax, d.netWorth)}
            metrics={[
              { label: "Resultado neto", value: d.profitBeforeTax },
              { label: "Patrimonio neto", value: d.netWorth }
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
            <a
              href={`/dashboard?org=${organizationId}&module=accounting&section=entries`}
            >
              Crear asientos
            </a>
            <a
              href={`/dashboard?org=${organizationId}&module=accounting&section=matching`}
            >
              Marcar apuntes
            </a>
            <a
              href={`/dashboard?org=${organizationId}&module=accounting&section=entries`}
            >
              Consultar libro mayor
            </a>
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
  ratio: ratioValue,
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
      <strong className="accounting-ratio-value">{ratioValue}</strong>
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
