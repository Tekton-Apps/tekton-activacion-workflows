"use client";

import { CompanyTabs } from "@/components/CompanyTabs";
import type { EntityId } from "@/lib/entities";

interface Tab {
  id: EntityId;
  label: string;
  content: React.ReactNode;
}

// Con una sola entidad (Tekton) el header no necesita levantar estado de "cuál pestaña está
// activa" — CompanyTabs ya colapsa a renderizar el contenido directo cuando hay 0 o 1 pestaña.
// Este componente queda como el shell fijo de marca Tekton (header oscuro + logo textual).
export function AppShell({
  tabs,
  email,
  signOutAction,
}: {
  tabs: Tab[];
  email: string | null | undefined;
  signOutAction: () => Promise<void>;
}) {
  return (
    <div className="min-h-screen bg-tk-black">
      <header className="border-b border-tk-primary bg-tk-primary">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="font-tk-display text-xl italic text-white">Tekton</span>
            <span aria-hidden="true" className="h-6 w-px bg-tk-secondary/40" />
            <h1 className="text-sm font-semibold text-tk-secondary sm:text-base">
              Tekton · Panel de Triggers
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* En mobile se oculta el email para que el header no se parta en dos líneas. */}
            <span className="hidden text-sm text-tk-secondary/80 sm:block">{email}</span>
            {/* Server action pasada como prop desde page.tsx (server component): sigue siendo
                la misma `signOut` de auth.ts, esto solo mueve dónde se renderiza el form. */}
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded-lg border border-tk-secondary/30 px-3 py-1.5 text-sm font-medium text-tk-secondary transition-colors hover:border-tk-secondary hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tk-secondary"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <CompanyTabs tabs={tabs} />
      </main>
    </div>
  );
}
