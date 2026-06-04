import { FileSearch } from "lucide-react";
import { applyModuleLiveValues, moduleCatalog } from "../_lib/module-catalog";
import { slugify } from "../_lib/formatters";
import type { AppModule } from "../_lib/types";
import { SmallIndicatorCard } from "./erp-cards";

export function ModuleWorkspace({
  module,
  clientCount,
  documentCount,
  fiscalEntityCount,
  needsReviewCount,
  ocrRequiredCount
}: {
  module: AppModule;
  clientCount: number;
  documentCount: number;
  fiscalEntityCount: number;
  needsReviewCount: number;
  ocrRequiredCount: number;
}) {
  const definition = moduleCatalog[module];
  const stats = applyModuleLiveValues(module, definition.stats, {
    clientCount,
    documentCount,
    fiscalEntityCount,
    needsReviewCount,
    ocrRequiredCount
  });

  return (
    <section className="module-workspace" aria-labelledby={`${module}-module-title`}>
      <div className="module-hero">
        <div>
          <span className="module-eyebrow">{definition.eyebrow}</span>
          <h2 id={`${module}-module-title`}>{definition.title}</h2>
          <p>{definition.description}</p>
        </div>
        <div className="module-action-strip">
          {definition.quickActions.slice(0, 2).map((action) => (
            <a href={`#${module}-${slugify(action)}`} key={action}>{action}</a>
          ))}
        </div>
      </div>

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
              <a href={`#${module}-${slugify(action)}`} key={action}>{action}</a>
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
