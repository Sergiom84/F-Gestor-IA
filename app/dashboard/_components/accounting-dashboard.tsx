import Link from "next/link";
import {
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  UploadCloud
} from "lucide-react";
import { uploadDocument } from "../actions";
import {
  formatDate,
  formatLabel
} from "../_lib/formatters";
import type {
  DocumentRow,
  FiscalEntityRow,
  Organization,
  OrganizationMember,
  ReviewTaskRow
} from "../_lib/types";
import {
  KpiStatementCard,
  RatioCard,
  SmallIndicatorCard,
  StatusPill
} from "./erp-cards";

export function AccountingDashboard({
  activeOrganization,
  activeMembership,
  documents,
  reviewTasks,
  fiscalEntities,
  documentCount,
  needsReviewCount,
  ocrRequiredCount,
  clientCount,
  fiscalEntityCount,
  cleanDocumentCount,
  automationRate,
  reviewRate,
  uploadCoverage,
  aiBudget
}: {
  activeOrganization: Organization;
  activeMembership: OrganizationMember | null | undefined;
  documents: DocumentRow[];
  reviewTasks: ReviewTaskRow[];
  fiscalEntities: FiscalEntityRow[];
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
    <>
      <section className="dashboard-section" aria-labelledby="profit-title">
        <h2 id="profit-title">Indicadores de control fiscal</h2>
        <div className="statement-grid">
          <KpiStatementCard
            icon={<BarChart3 aria-hidden="true" size={26} />}
            title="Documentos procesados"
            value={documentCount.toLocaleString("es-ES")}
            description="Facturas y documentos registrados en la organizacion activa"
            details={[
              { label: "Correctos", value: cleanDocumentCount.toLocaleString("es-ES") },
              { label: "Por revisar", value: needsReviewCount.toLocaleString("es-ES") }
            ]}
          />
          <KpiStatementCard
            icon={<ClipboardCheck aria-hidden="true" size={26} />}
            title="Control antes del cierre"
            value={`${needsReviewCount.toLocaleString("es-ES")} tareas`}
            description="Revisiones humanas abiertas y validaciones pendientes"
            details={[
              { label: "Revision", value: `${reviewRate}%` },
              { label: "OCR pendiente", value: ocrRequiredCount.toLocaleString("es-ES") }
            ]}
          />
        </div>
      </section>

      <section className="dashboard-section" aria-labelledby="performance-title">
        <h2 id="performance-title">Indicadores de rendimiento</h2>
        <div className="ratio-grid">
          <RatioCard
            title="Automatizacion limpia"
            description="Documentos sin OCR pendiente ni revision humana sobre el total registrado"
            value={`${automationRate}%`}
            leftLabel="Procesados"
            leftValue={cleanDocumentCount.toLocaleString("es-ES")}
            rightLabel="Total"
            rightValue={documentCount.toLocaleString("es-ES")}
          />
          <RatioCard
            title="Cobertura de entidades"
            description="Capacidad para registrar documentos en entidades fiscales activas"
            value={`${uploadCoverage}%`}
            leftLabel="Entidades"
            leftValue={fiscalEntityCount.toLocaleString("es-ES")}
            rightLabel="Clientes"
            rightValue={clientCount.toLocaleString("es-ES")}
          />
          <RatioCard
            title="Presupuesto IA"
            description="Consumo operativo permitido para extraccion y revision asistida"
            value={aiBudget}
            leftLabel="Plan"
            leftValue={formatLabel(activeOrganization.plan)}
            rightLabel="Rol"
            rightValue={formatLabel(activeMembership?.role ?? "miembro")}
          />
        </div>
      </section>

      <section className="bottom-dashboard-grid" aria-label="Actividad documental">
        <div>
          <h2 className="section-heading">Indicadores adicionales</h2>
          <div className="small-card-grid">
            <SmallIndicatorCard
              title="Entidades fiscales"
              value={fiscalEntityCount.toLocaleString("es-ES")}
              description="Sujetos fiscales activos para registrar documentacion."
            />
            <SmallIndicatorCard
              title="Clientes"
              value={clientCount.toLocaleString("es-ES")}
              description="Contactos de negocio disponibles para la operativa fiscal."
            />
            <SmallIndicatorCard
              title="OCR pendiente"
              value={ocrRequiredCount.toLocaleString("es-ES")}
              description="Documentos que requieren lectura avanzada antes de validar."
            />
          </div>
        </div>

        <aside>
          <h2 className="section-heading">Accesos rapidos</h2>
          <div className="quick-card">
            <form className="quick-upload" action={uploadDocument}>
              <input type="hidden" name="organization_id" value={activeOrganization.id} />
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
            <div className="quick-links">
              <a href="#documentos">Consultar documentos recientes</a>
              <a href="#revision">Marcar revisiones</a>
              <a href="#profit-title">Ver control fiscal</a>
            </div>
          </div>
        </aside>
      </section>

      <section className="activity-grid">
        <div className="panel" id="documentos">
          <div className="panel-header">
            <h2>Documentos recientes</h2>
            <span className="row-meta">{documents.length} visibles</span>
          </div>
          {documents.length > 0 ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>Tipo</th>
                    <th>Estado</th>
                    <th>Origen</th>
                    <th>Fecha</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((document) => (
                    <tr key={document.id}>
                      <td>
                        <div className="row-title">{document.title ?? "Documento sin titulo"}</div>
                        {document.failure_reason ? (
                          <div className="row-meta">{document.failure_reason}</div>
                        ) : null}
                      </td>
                      <td>{formatLabel(document.document_type)}</td>
                      <td>
                        <StatusPill status={document.status} />
                      </td>
                      <td>{formatLabel(document.source)}</td>
                      <td>{formatDate(document.created_at)}</td>
                      <td>
                        {document.status === "ocr_required" ? (
                          <span className="row-meta strong">Requiere OCR</span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">No hay documentos visibles en esta organizacion.</div>
          )}
        </div>

        <aside className="panel" id="revision">
          <div className="panel-header">
            <h2>Revision humana</h2>
            <span className="row-meta">{reviewTasks.length} abiertas</span>
          </div>
          {reviewTasks.length > 0 ? (
            <div className="side-list">
              {reviewTasks.map((task) => (
                <div className="side-row" key={task.id}>
                  <FileSearch aria-hidden="true" className="side-row-icon" size={18} />
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
      </section>
    </>
  );
}
