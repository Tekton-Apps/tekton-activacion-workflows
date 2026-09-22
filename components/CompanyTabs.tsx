"use client";

import { useState } from "react";

interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
}

// Todas las pestañas que llegan acá ya están autorizadas — el filtro por email pasó en el
// Server Component (page.tsx), antes de que este árbol exista. Con 0 o 1 pestaña no hay nada
// que "cambiar", así que no se renderiza el selector.
export function CompanyTabs({ tabs }: { tabs: Tab[] }) {
  const [activeId, setActiveId] = useState<string | undefined>(tabs[0]?.id);

  if (tabs.length <= 1) {
    return <>{tabs[0]?.content ?? null}</>;
  }

  return (
    <div>
      <div role="tablist" aria-label="Empresa" className="mb-6 flex gap-2 border-b border-slate-200">
        {tabs.map((tab) => {
          const selected = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveId(tab.id)}
              className={
                "border-b-2 px-3 py-2 text-sm font-medium transition-colors " +
                (selected
                  ? "border-tk-primary text-tk-primary"
                  : "border-transparent text-slate-500 hover:text-slate-700")
              }
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Todas quedan montadas (nunca desmontadas) para no perder el estado de cada pestaña.
          Ocultar con `hidden` alcanza: no hay nada más caro que reflow acá adentro. */}
      {tabs.map((tab) => (
        <div key={tab.id} role="tabpanel" hidden={tab.id !== activeId}>
          {tab.content}
        </div>
      ))}
    </div>
  );
}
