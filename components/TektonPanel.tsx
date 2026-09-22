import type { WorkflowTrigger } from "@/lib/workflows";
import { TektonWorkflowCard } from "@/components/TektonWorkflowCard";

// Ya no quedan razones sociales de Tekton en estado placeholder (INC y SAC están dadas de
// alta en lib/workflows.ts): cada una se renderiza vía TektonWorkflowCard y su propio
// `configured` decide si el botón está activo o dice "No configurado".
// Tema oscuro a propósito (bg-tk-black, texto blanco/cian): coherente con el <header> cuando
// la pestaña Tekton está activa (AppShell.tsx). Antes era claro (bg-tk-light) y quedaba
// desalineado del resto de la marca — ver la referencia del sitio real de Tekton.
export function TektonPanel({
  workflows,
}: {
  // Ya resueltos por el Server Component (page.tsx): filtrados por entity === "tekton" y
  // con `configured` calculado leyendo process.env.
  workflows: { workflow: WorkflowTrigger; configured: boolean }[];
}) {
  return (
    <div className="rounded-tk-lg bg-tk-black p-6 font-tk-sans sm:p-8">
      <div className="h-1 w-12 rounded-tk-full bg-tk-secondary" />

      <h2 className="mt-4 font-tk-display text-2xl italic text-white">Tekton</h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-tk-secondary/80">
        Cada botón corre el workflow de n8n de su propia razón social. Se habilitan cuando
        el webhook correspondiente esté configurado.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {workflows.map(({ workflow, configured }) => (
          <TektonWorkflowCard key={workflow.id} workflow={workflow} configured={configured} />
        ))}
      </div>
    </div>
  );
}
