"use client";

import { useEffect, useId, useMemo, useState } from "react";
import type { Worker } from "@/lib/rh";

// Máximo de opciones renderizadas: el maestro puede tener cientos de filas y la lista es para
// elegir, no para recorrer. Se avisa cuando hay más y se pide seguir escribiendo.
const MAX_OPTIONS = 50;

// Sin tildes ni mayúsculas: "Núñez" se encuentra escribiendo "nunez".
function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function workerLabel(worker: Worker): string {
  return `${worker.nombre} · ${worker.dni}`;
}

// Combobox propio (patrón ARIA "combobox con listbox"): el foco queda siempre en el input y la
// opción activa se anuncia con aria-activedescendant. Teclado: ↑ ↓ mueven, Enter elige,
// Esc cierra (y con la lista cerrada, borra el texto).
export function WorkerCombobox({
  workers,
  value,
  onChange,
  disabled,
  labelId,
}: {
  workers: Worker[];
  value: Worker | null;
  onChange: (worker: Worker | null) => void;
  disabled?: boolean;
  labelId: string;
}) {
  const listId = useId();
  const [query, setQuery] = useState(value ? workerLabel(value) : "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Si ya hay uno elegido y el texto es su etiqueta, se muestran todos (para poder cambiarlo).
  const matches = useMemo(() => {
    const q = normalize(query.trim());
    if (!q || (value && query === workerLabel(value))) return workers;
    return workers.filter(
      (worker) => normalize(worker.nombre).includes(q) || worker.dni.includes(q),
    );
  }, [workers, query, value]);
  const visible = matches.slice(0, MAX_OPTIONS);

  const optionId = (index: number) => `${listId}-opt-${index}`;

  useEffect(() => {
    if (open && activeIndex >= 0) {
      document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: "nearest" });
    }
    // optionId depende solo de listId, que es estable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeIndex]);

  function select(worker: Worker) {
    onChange(worker);
    setQuery(workerLabel(worker));
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) {
          setOpen(true);
          setActiveIndex(0);
        } else {
          setActiveIndex((i) => Math.min(i + 1, visible.length - 1));
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        if (open) setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        if (open && activeIndex >= 0 && visible[activeIndex]) {
          e.preventDefault();
          select(visible[activeIndex]);
        }
        break;
      case "Escape":
        if (open) {
          e.preventDefault();
          setOpen(false);
          setActiveIndex(-1);
        } else if (query) {
          e.preventDefault();
          setQuery("");
          onChange(null);
        }
        break;
    }
  }

  return (
    <div className="relative">
      <input
        type="text"
        role="combobox"
        aria-labelledby={labelId}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        placeholder="Busca por apellido, nombre o DNI"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          // Editar el texto deshace la selección: el DNI que viaja es siempre el de una opción.
          if (value) onChange(null);
          setOpen(true);
          setActiveIndex(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          setActiveIndex(-1);
        }}
        onKeyDown={handleKeyDown}
        className="w-full rounded-tk-md border border-white/15 bg-tk-black px-3 py-2 text-sm text-white placeholder:text-tk-medium focus:border-tk-secondary focus:outline-none disabled:opacity-60"
      />

      <ul
        id={listId}
        role="listbox"
        aria-labelledby={labelId}
        hidden={!open}
        className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-tk-md border border-white/15 bg-tk-primary py-1 shadow-lg"
      >
        {visible.length === 0 ? (
          <li role="presentation" className="px-3 py-2 text-sm text-tk-medium">
            Sin resultados.
          </li>
        ) : (
          visible.map((worker, index) => {
            const isActive = index === activeIndex;
            const isSelected = value?.dni === worker.dni;
            return (
              <li
                key={worker.dni}
                id={optionId(index)}
                role="option"
                aria-selected={isSelected}
                // mousedown + preventDefault: elegir con el mouse sin que el input pierda el foco
                // (el blur cerraría la lista antes del click).
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(worker)}
                onMouseEnter={() => setActiveIndex(index)}
                className={
                  "flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm " +
                  (isActive ? "bg-white/10 text-white" : "text-tk-secondary/90")
                }
              >
                <span>
                  {workerLabel(worker)}
                  {worker.cargo && (
                    <span className="ml-2 text-xs text-tk-medium">{worker.cargo}</span>
                  )}
                </span>
                {worker.estado === "cesado" && (
                  <span className="shrink-0 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-xs text-amber-200">
                    Cesado
                  </span>
                )}
              </li>
            );
          })
        )}
        {matches.length > MAX_OPTIONS && (
          <li role="presentation" className="px-3 py-2 text-xs text-tk-medium">
            Mostrando {MAX_OPTIONS} de {matches.length}. Sigue escribiendo para filtrar.
          </li>
        )}
      </ul>
    </div>
  );
}
