import type { WorkflowTrigger } from "@/lib/workflows";
import { ExecutionHistory } from "@/components/ExecutionHistory";
import { TektonWorkflowCard } from "@/components/TektonWorkflowCard";

// Pestaña de contabilidad: una card por razón social (INC, SAC), cada una con su propio
// `configured`, y debajo el historial del área leído desde n8n.
// Tema oscuro a propósito (bg-tk-black, texto blanco/cian): coherente con el <header>
// (AppShell.tsx) — ver la referencia del sitio real de Tekton.
export function TektonPanel({
  workflows,
  historyConfigured,
}: {
  // Ya resueltos por el Server Component (page.tsx): filtrados por tab === "contabilidad" y
  // con `configured` calculado leyendo process.env.
  workflows: { workflow: WorkflowTrigger; configured: boolean }[];
  historyConfigured: boolean;
}) {
  return (
    <div className="rounded-tk-lg bg-tk-black p-6 font-tk-sans sm:p-8">
      <div className="h-1 w-12 rounded-tk-full bg-tk-secondary" />

      <h2 className="mt-4 font-tk-display text-2xl italic text-white">Contabilidad</h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-tk-secondary/80">
        Cada botón corre el workflow de n8n de su propia razón social. Se habilitan cuando
        el webhook correspondiente esté configurado.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {workflows.map(({ workflow, configured }) => (
          <TektonWorkflowCard key={workflow.id} workflow={workflow} configured={configured} />
        ))}
      </div>

      <ExecutionHistory area="contabilidad" configured={historyConfigured} />
    </div>
  );
}
