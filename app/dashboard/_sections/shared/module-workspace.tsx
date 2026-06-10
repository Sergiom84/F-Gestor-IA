"use client";

import { FileSearch, Plus, UploadCloud, X } from "lucide-react";
import { useState } from "react";
import { SmallIndicatorCard } from "../../_components/erp-cards";
import { applyModuleLiveValues, moduleCatalog } from "../../_lib/module-catalog";
import type { AppModule } from "../../_lib/types";

export function ModuleWorkspace({
  module,
  clientCount,
  documentCount,
  fiscalEntityCount,
  needsReviewCount,
  ocrRequiredCount,
  memberCount = 0
}: {
  module: AppModule;
  clientCount: number;
  documentCount: number;
  fiscalEntityCount: number;
  needsReviewCount: number;
  ocrRequiredCount: number;
  memberCount?: number;
}) {
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const definition = moduleCatalog[module];
  const stats = applyModuleLiveValues(module, definition.stats, {
    clientCount,
    documentCount,
    fiscalEntityCount,
    needsReviewCount,
    ocrRequiredCount,
    memberCount
  });

  const handleAction = (action: string) => {
    setActiveAction((current) => (current === action ? null : action));
    setActionNotice(null);
  };

  const completeAction = (message: string) => {
    setActionNotice(message);
    setActiveAction(null);
  };

  return (
    <section className="module-workspace" aria-labelledby={`${module}-module-title`}>
      <div className="module-hero">
        <div>
          <span className="module-eyebrow">{definition.eyebrow}</span>
          <h2 id={`${module}-module-title`}>{definition.title}</h2>
          <p>{definition.description}</p>
        </div>
        <div className="module-action-strip">
          {definition.quickActions.slice(0, 2).map((action, index) => (
            <button
              key={action}
              className={index === 0 ? "sage-primary-button" : "sage-ghost-link"}
              onClick={() => handleAction(action)}
              type="button"
            >
              {action}
            </button>
          ))}
        </div>
      </div>

      {activeAction ? (
        <ActionPanel
          action={activeAction}
          module={module}
          onClose={() => setActiveAction(null)}
          onComplete={completeAction}
        />
      ) : null}

      {actionNotice ? (
        <div className="sales-live-notice success module-action-notice" role="status">
          <span>{actionNotice}</span>
          <button onClick={() => setActionNotice(null)} type="button" aria-label="Cerrar aviso">
            <X aria-hidden="true" size={16} />
          </button>
        </div>
      ) : null}

      <div className="module-stats-grid">
        {stats.map((stat) => (
          <SmallIndicatorCard
            title={stat.label}
            value={stat.value}
            description={stat.description}
            key={stat.label}
          />
        ))}
      </div>

      <section className="module-layout-grid">
        <aside className="module-quick-panel">
          <h3>Accesos rapidos</h3>
          <div className="quick-links">
            {definition.quickActions.map((action) => (
              <button
                key={action}
                className={`quick-link-button${activeAction === action ? " active" : ""}`}
                onClick={() => handleAction(action)}
                type="button"
              >
                {action}
              </button>
            ))}
          </div>
        </aside>

        <section className="sales-table-card module-table-card">
          <div className="sales-table-heading">
            <h2>{definition.tableTitle}</h2>
            <p>{definition.tableDescription}</p>
          </div>
          <div className="sales-table-wrap module-table-wrap">
            <table className="sales-table module-table">
              <thead>
                <tr>
                  {definition.tableHeaders.map((header) => (
                    <th key={header}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={definition.tableHeaders.length}>
                    <div className="table-empty-state">
                      <FileSearch aria-hidden="true" size={76} />
                      <div>
                        <strong>{definition.emptyTitle}</strong>
                        <p>{definition.emptyDescription}</p>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={definition.tableHeaders.length}>Elementos: 0</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      </section>

      <section className="module-roadmap-card">
        <h3>Siguiente conexion de datos</h3>
        <p>
          Esta superficie ya tiene estructura visual y taxonomia de Sage Active. El siguiente paso es conectar sus tarjetas y tablas al modelo real de GFiscal.
        </p>
      </section>
    </section>
  );
}

function ActionPanel({
  action,
  module,
  onClose,
  onComplete
}: {
  action: string;
  module: AppModule;
  onClose: () => void;
  onComplete: (message: string) => void;
}) {
  const isImport = action.toLowerCase().includes("importar") || action.toLowerCase().includes("subir") || action.toLowerCase().includes("ejecutar");
  const isCreate = action.toLowerCase().includes("crear") || action.toLowerCase().includes("anadir");

  return (
    <div className="module-action-panel" role="region" aria-label={action}>
      <div className="module-action-panel-header">
        <h3>{action}</h3>
        <button className="panel-icon-button" onClick={onClose} type="button" aria-label="Cerrar panel">
          <X aria-hidden="true" size={18} />
        </button>
      </div>

      {isImport ? (
        <ImportActionBody action={action} onClose={onClose} onComplete={onComplete} />
      ) : isCreate ? (
        <CreateActionBody action={action} module={module} onClose={onClose} onComplete={onComplete} />
      ) : (
        <ComingSoonBody action={action} module={module} onComplete={onComplete} />
      )}
    </div>
  );
}

function ImportActionBody({ action, onClose, onComplete }: { action: string; onClose: () => void; onComplete: (message: string) => void }) {
  const [files, setFiles] = useState<string[]>([]);

  const registerFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    setFiles(Array.from(fileList).map((f) => f.name));
  };

  return (
    <div className="module-action-body">
      <label
        className="purchase-drop-zone module-drop-zone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); registerFiles(e.dataTransfer.files); }}
      >
        <input
          accept="application/pdf,text/csv,application/vnd.ms-excel,.xlsx,.ofx,.qif"
          multiple
          onChange={(e) => registerFiles(e.target.files)}
          type="file"
        />
        <UploadCloud aria-hidden="true" size={72} />
        <span>
          <strong>Arrastra los ficheros hasta aqui</strong>
          <small>PDF, CSV, Excel, OFX o QIF</small>
        </span>
      </label>
      {files.length > 0 ? (
        <div className="purchase-upload-strip">
          <strong>{files.length} fichero(s) listo(s)</strong>
          <span>{files.join(", ")}</span>
        </div>
      ) : null}
      <div className="module-action-footer">
        <button className="quote-cancel-action" onClick={onClose} type="button">Cancelar</button>
        <button
          className="sage-primary-button"
          disabled={files.length === 0}
          onClick={() => onComplete(`${action}: ${files.length} fichero(s) preparado(s) para procesar.`)}
          type="button"
        >
          Importar
        </button>
      </div>
    </div>
  );
}

function CreateActionBody({ action, module, onClose, onComplete }: { action: string; module: AppModule; onClose: () => void; onComplete: (message: string) => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const canCreate = name.trim().length > 0;

  const fieldLabel = module === "banks" ? "Nombre del banco" : "Nombre";
  const codeLabel = module === "banks" ? "IBAN / numero de cuenta" : "Codigo";

  return (
    <div className="module-action-body">
      <div className="module-create-grid">
        <label className="sage-field">
          <span>{fieldLabel} *</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="sage-field">
          <span>{codeLabel}</span>
          <input value={code} onChange={(e) => setCode(e.target.value)} />
        </label>
        {module === "banks" ? (
          <label className="sage-field">
            <span>Alias</span>
            <input placeholder="Ej. Cuenta principal" />
          </label>
        ) : null}
      </div>
      <div className="module-action-footer">
        <button className="quote-cancel-action" onClick={onClose} type="button">Cancelar</button>
        <button
          className="sage-primary-button"
          disabled={!canCreate}
          onClick={() => onComplete(`${action}: ${name.trim()} queda preparado en la vista local.`)}
          type="button"
        >
          Crear
        </button>
      </div>
    </div>
  );
}

function ComingSoonBody({ action, module, onComplete }: { action: string; module: AppModule; onComplete: (message: string) => void }) {
  const isBanks = module === "banks";

  return (
    <div className="module-action-body module-coming-soon">
      <p>
        <strong>{action}</strong> {isBanks ? "abre un flujo preparado para la conexion bancaria real." : "estara disponible cuando esta seccion se conecte al modelo real de datos."}
      </p>
      <p className="module-coming-soon-sub">Esta superficie tiene la estructura y logica visual preparada.</p>
      {isBanks ? (
        <div className="module-action-footer">
          <button className="sage-primary-button" onClick={() => onComplete(`${action}: revision registrada en la vista local.`)} type="button">
            Registrar revision
          </button>
        </div>
      ) : null}
    </div>
  );
}
