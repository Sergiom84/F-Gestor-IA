"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Copy,
  FileSearch,
  Landmark,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UploadCloud,
  Wallet,
  type LucideIcon
} from "lucide-react";
import { uploadDocument } from "../actions";
import {
  formatDate,
  formatLabel
} from "../_lib/formatters";
import type {
  DocumentRow,
  FiscalEntityRow,
  ReviewTaskRow
} from "../_lib/types";
import { StatusPill } from "./erp-cards";
import { AreaChart, Donut, Sparkline } from "./Charts";

type Kpi = {
  label: string;
  icon: LucideIcon;
  value: string;
  delta: string;
  tone: "up" | "down" | "warn";
  spark: number[];
};

type DashboardMetrics = {
  aiBudget: string;
  automationRate: number;
  cleanDocumentCount: number;
  documentCount: number;
  fiscalEntityCount: number;
  needsReviewCount: number;
  ocrRequiredCount: number;
  reviewRate: number;
  uploadCoverage: number;
};

export function KpiHero({ metrics }: { metrics: DashboardMetrics }) {
  const kpis: Kpi[] = [
    {
      label: "Documentos procesados",
      icon: Wallet,
      value: metrics.documentCount.toLocaleString("es-ES"),
      delta: `${metrics.automationRate}% limpios`,
      tone: "up",
      spark: sparkFrom(metrics.cleanDocumentCount, metrics.documentCount)
    },
    {
      label: "Por revisar",
      icon: ArrowDownLeft,
      value: metrics.needsReviewCount.toLocaleString("es-ES"),
      delta: `${metrics.reviewRate}% del total`,
      tone: metrics.needsReviewCount > 0 ? "warn" : "up",
      spark: sparkFrom(metrics.needsReviewCount, metrics.documentCount)
    },
    {
      label: "OCR pendiente",
      icon: ArrowUpRight,
      value: metrics.ocrRequiredCount.toLocaleString("es-ES"),
      delta: metrics.ocrRequiredCount > 0 ? "Atencion" : "Sin bloqueo",
      tone: metrics.ocrRequiredCount > 0 ? "down" : "up",
      spark: sparkFrom(metrics.ocrRequiredCount, metrics.documentCount)
    },
    {
      label: "Presupuesto IA",
      icon: Landmark,
      value: metrics.aiBudget,
      delta: `${metrics.fiscalEntityCount} entidades`,
      tone: metrics.uploadCoverage > 0 ? "up" : "warn",
      spark: sparkFrom(metrics.fiscalEntityCount, Math.max(metrics.fiscalEntityCount, 1))
    }
  ];

  return (
    <section className="kpi-hero">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        const DeltaIcon = kpi.tone === "up" ? TrendingUp : kpi.tone === "down" ? TrendingDown : Clock;
        const sparkColor = kpi.tone === "warn" ? "#b06a00" : kpi.tone === "down" ? "#c0476f" : "var(--ft-accent)";

        return (
          <article className="kpi-card" key={kpi.label}>
            <div className="kpi-top">
              <span className="kpi-label">{kpi.label}</span>
              <span className="kpi-ic"><Icon aria-hidden="true" size={18} /></span>
            </div>
            <div className="kpi-value">{kpi.value}</div>
            <div className="kpi-foot">
              <span className={`kpi-delta ${kpi.tone}`}>
                <DeltaIcon aria-hidden="true" size={13} />
                {kpi.delta}
              </span>
              <Sparkline data={kpi.spark} color={sparkColor} />
            </div>
          </article>
        );
      })}
    </section>
  );
}

export function AssistantPanel({
  needsReviewCount,
  ocrRequiredCount
}: {
  needsReviewCount: number;
  ocrRequiredCount: number;
}) {
  const insights = [
    {
      tone: needsReviewCount > 0 ? "warn" : "ok",
      icon: needsReviewCount > 0 ? AlertTriangle : CheckCircle2,
      title: needsReviewCount > 0
        ? `${needsReviewCount.toLocaleString("es-ES")} revisiones humanas siguen abiertas`
        : "No hay revisiones humanas abiertas",
      meta: needsReviewCount > 0 ? "Validaciones pendientes antes del cierre" : "La bandeja esta despejada",
      cta: "Revisar",
      href: "#revision"
    },
    {
      tone: ocrRequiredCount > 0 ? "info" : "ok",
      icon: ocrRequiredCount > 0 ? Copy : CheckCircle2,
      title: ocrRequiredCount > 0
        ? `${ocrRequiredCount.toLocaleString("es-ES")} documentos requieren OCR avanzado`
        : "OCR al dia en los documentos visibles",
      meta: ocrRequiredCount > 0 ? "Conviene procesarlos antes de extraer datos fiscales" : "Sin bloqueos de lectura",
      cta: "Ver",
      href: "#documentos"
    },
    {
      tone: "ok",
      icon: CheckCircle2,
      title: "Control documental listo para seguir operando",
      meta: "Sube nuevas facturas PDF desde el panel rapido",
      cta: "Subir",
      href: "#subida"
    }
  ] as const;

  return (
    <section className="copilot-card">
      <div className="copilot-head">
        <span className="copilot-badge"><Sparkles aria-hidden="true" size={20} fill="currentColor" /></span>
        <div>
          <h3>Asistente · Qué mirar hoy</h3>
          <p>Sugerencias y alertas generadas sobre tus documentos y obligaciones.</p>
        </div>
      </div>
      <div className="copilot-list">
        {insights.map((insight) => {
          const Icon = insight.icon;

          return (
            <a className="copilot-row" href={insight.href} key={insight.title}>
              <span className={`copilot-dot ${insight.tone}`}><Icon aria-hidden="true" size={16} /></span>
              <span className="ct"><strong>{insight.title}</strong><span>{insight.meta}</span></span>
              <span className="copilot-cta">{insight.cta} →</span>
            </a>
          );
        })}
      </div>
    </section>
  );
}

export function ChartRow({ metrics }: { metrics: DashboardMetrics }) {
  const clean = metrics.cleanDocumentCount;
  const review = metrics.needsReviewCount;
  const ocr = metrics.ocrRequiredCount;
  const total = Math.max(metrics.documentCount, 1);
  const ingresos = sparkFrom(clean + metrics.fiscalEntityCount, total + metrics.fiscalEntityCount);
  const gastos = sparkFrom(review + ocr, total);

  return (
    <section className="chart-row">
      <div className="chart-card">
        <div className="chart-head">
          <div><h3>Procesados vs. pendientes</h3><p>Actividad documental · organizacion activa</p></div>
          <div className="chart-legend">
            <span className="lg"><i style={{ background: "var(--ft-accent)" }} />Limpios</span>
            <span className="lg"><i style={{ background: "#c0476f" }} />Pendientes</span>
          </div>
        </div>
        <AreaChart ingresos={ingresos} gastos={gastos} />
        <div className="bars-x">{["Inicio", "Carga", "OCR", "IA", "Revision", "Cierre"].map((label) => <span key={label}>{label}</span>)}</div>
      </div>
      <div className="chart-card donut-wrap">
        <div className="chart-head" style={{ width: "100%" }}>
          <div><h3>Automatización</h3><p>Documentos sin intervención</p></div>
        </div>
        <Donut pct={metrics.automationRate} label="limpios" />
        <div className="donut-legend">
          <div><span className="k"><i style={{ background: "var(--ft-accent)" }} />Procesados solos</span><b>{clean.toLocaleString("es-ES")}</b></div>
          <div><span className="k"><i style={{ background: "var(--ft-line)" }} />Requieren revisión</span><b>{(review + ocr).toLocaleString("es-ES")}</b></div>
        </div>
      </div>
    </section>
  );
}

export function QuickUpload({
  activeOrganizationId,
  fiscalEntities
}: {
  activeOrganizationId: string;
  fiscalEntities: FiscalEntityRow[];
}) {
  return (
    <div className="quick-card" id="subida">
      <form className="quick-upload" action={uploadDocument}>
        <input type="hidden" name="organization_id" value={activeOrganizationId} />
        <label className="field">
          <span>Entidad fiscal</span>
          <select className="select" name="fiscal_entity_id" required disabled={fiscalEntities.length === 0}>
            {fiscalEntities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.legal_name}{entity.tax_id ? ` · ${entity.tax_id}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="field file-drop">
          <UploadCloud aria-hidden="true" size={20} />
          <span>Subir facturas PDF</span>
          <input name="files" type="file" accept="application/pdf" multiple required />
        </label>
        <button className="button" type="submit" disabled={fiscalEntities.length === 0}>
          Encolar documentos
        </button>
      </form>
    </div>
  );
}

export function DocsPanel({ docs }: { docs: DocumentRow[] }) {
  return (
    <div className="panel" id="documentos">
      <div className="panel-header"><h2>Documentos recientes</h2><span className="row-meta">{docs.length} visibles</span></div>
      {docs.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Documento</th><th>Tipo</th><th>Estado</th><th>Origen</th><th>Fecha</th></tr></thead>
            <tbody>
              {docs.map((document) => (
                <tr key={document.id}>
                  <td>
                    <div className="row-title">{document.title ?? "Documento sin titulo"}</div>
                    {document.failure_reason ? <div className="row-meta">{document.failure_reason}</div> : null}
                  </td>
                  <td>{formatLabel(document.document_type)}</td>
                  <td><StatusPill status={document.status} /></td>
                  <td>{formatLabel(document.source)}</td>
                  <td>{formatDate(document.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">No hay documentos visibles en esta organizacion.</div>
      )}
    </div>
  );
}

export function ReviewPanel({ tasks }: { tasks: ReviewTaskRow[] }) {
  return (
    <aside className="panel" id="revision">
      <div className="panel-header"><h2>Revisión humana</h2><span className="row-meta">{tasks.length} abiertas</span></div>
      {tasks.length > 0 ? (
        <div className="side-list">
          {tasks.map((task) => (
            <div className="side-row" key={task.id}>
              <span className="side-row-icon"><FileSearch aria-hidden="true" size={18} /></span>
              <Link className="row-title link-row" href={`/dashboard/review/${task.id}`}>
                {formatLabel(task.reason)}
              </Link>
              <div className="row-meta">Prioridad {task.priority} · {formatDate(task.created_at)}</div>
              <StatusPill status={task.status} />
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <CheckCircle2 aria-hidden="true" size={24} />
          No hay revisiones abiertas.
        </div>
      )}
    </aside>
  );
}

function sparkFrom(value: number, max: number): number[] {
  const base = Math.max(value, 0);
  const ceiling = Math.max(max, base, 1);
  return [0.48, 0.55, 0.51, 0.64, 0.6, 0.72].map((factor, index) => {
    const trend = base * factor + index * Math.max(ceiling * 0.025, 0.2);
    return Math.max(trend, 0.1);
  });
}
