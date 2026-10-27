"use client";

import { createContext, useContext, useEffect, useState } from "react";

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

// Última pestaña usada, por navegador. Es solo una comodidad: si el storage no está disponible
// (modo privado, bloqueado) se abre la primera permitida.
const LAST_TAB_KEY = "tekton:ultima-pestana";

function readLastTab(): string | null {
  try {
    return window.localStorage.getItem(LAST_TAB_KEY);
  } catch {
    return null;
  }
}

function saveLastTab(id: string) {
  try {
    window.localStorage.setItem(LAST_TAB_KEY, id);
  } catch {
    // Sin storage no se recuerda; no es un error para el usuario.
  }
}

// Todas las pestañas que llegan acá ya están autorizadas — el filtro por email pasó en el
// Server Component (page.tsx), antes de que este árbol exista. Con 0 o 1 pestaña no hay nada
// que "cambiar", así que no se renderiza el selector.
export function CompanyTabs({ tabs }: { tabs: Tab[] }) {
  const [activeId, setActiveId] = useState<string | undefined>(tabs[0]?.id);
  // localStorage solo existe en el navegador: el HTML del servidor sale con la primera pestaña y
  // al montar se pasa a la última usada. Hasta entonces ninguna pestaña está "activa", para no
  // pedir el historial de una pestaña que no es la que se va a mostrar.
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const last = readLastTab();
    // Solo si sigue siendo una pestaña permitida para esta persona.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- leer localStorage al montar
    if (last && tabs.some((tab) => tab.id === last)) setActiveId(last);
    setRestored(true);
  }, [tabs]);

  function selectTab(id: string) {
    setActiveId(id);
    saveLastTab(id);
  }

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
              onClick={() => selectTab(tab.id)}
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
          <TabActiveContext.Provider value={restored && tab.id === activeId}>
            {tab.content}
          </TabActiveContext.Provider>
        </div>
      ))}
    </div>
  );
}
