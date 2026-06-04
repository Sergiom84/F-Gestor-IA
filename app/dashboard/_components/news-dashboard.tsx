import { SmallIndicatorCard } from "./erp-cards";

export function NewsDashboard() {
  return (
    <section className="dashboard-section">
      <h2>Novedades</h2>
      <div className="small-card-grid">
        <SmallIndicatorCard
          title="Copilot Insights"
          value="Activo"
          description="Proxima superficie para avisos, recomendaciones y tareas sugeridas."
        />
        <SmallIndicatorCard
          title="Sage Active"
          value="2026"
          description="Referencia visual y funcional conectada al material local."
        />
      </div>
    </section>
  );
}
