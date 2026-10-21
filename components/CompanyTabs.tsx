"use client";

import { createContext, useContext, useState } from "react";

interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
}

// Si la pestaña que contiene al componente está visible. Las pestañas quedan montadas aunque
// estén ocultas (para no perder estado), así que lo que deba cargarse "al abrir la pestaña"
// (historial, maestro de trabajadores) escucha esto en vez del montaje. Fuera de un selector
// (0 o 1 pestaña) vale true.
const TabActiveContext = createContext(true);

export function useTabActive(): boolean {
  return useContext(TabActiveContext);
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
      <div role="tablist" aria-label="Áreas" className="mb-6 flex gap-2 border-b border-white/10">
        {tabs.map((tab) => {
          const selected = tab.id === activeId;
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`tabpanel-${tab.id}`}
              onClick={() => setActiveId(tab.id)}
              className={
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tk-secondary " +
                (selected
                  ? "border-tk-secondary text-white"
                  : "border-transparent text-tk-medium hover:text-white")
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
        <div
          key={tab.id}
          id={`tabpanel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${tab.id}`}
          hidden={tab.id !== activeId}
        >
          <TabActiveContext.Provider value={tab.id === activeId}>
            {tab.content}
          </TabActiveContext.Provider>
        </div>
      ))}
    </div>
  );
}
