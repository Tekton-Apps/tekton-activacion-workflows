"use client";

import { useCallback, useEffect, useState } from "react";
import { useTabActive } from "@/components/CompanyTabs";
import type { Execution, ExecutionArea } from "@/lib/executions";

const ESTADOS: Record<string, { label: string; className: string }> = {
  en_proceso: { label: "En proceso", className: "border-tk-tertiary/40 bg-tk-tertiary/15 text-sky-200" },
  ok: { label: "OK", className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" },
  ok_con_alertas: {
    label: "OK con alertas",
    className: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  },
  bloqueado: { label: "Bloqueado", className: "border-red-400/30 bg-red-400/10 text-red-200" },
  error: { label: "Error", className: "border-red-400/30 bg-red-400/10 text-red-200" },
  sin_respuesta: { label: "Sin respuesta", className: "border-white/10 bg-white/5 text-tk-medium" },
};

const dateFormat = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Lima",
});

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormat.format(date);
}

function plural(n: number, singular: string, pluralForm: string) {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

type LoadState =
  | { status: "loading" }
  | { status: "ok"; rows: Execution[] }
  | { status: "error" };

// Historial leído desde n8n (vía /api/executions). No se refresca solo: carga cada vez que se
// abre la pestaña, cuando cambia `refreshKey` (ej. después de "Generar") y con "Actualizar".
export function ExecutionHistory({
  area,
  configured,
  refreshKey = 0,
}: {
  area: ExecutionArea;
  configured: boolean;
  refreshKey?: number;
}) {
  const active = useTabActive();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const res = await fetch(`/api/executions?area=${area}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setState({ status: "ok", rows: (await res.json()) as Execution[] });
    } catch {
      setState({ status: "error" });
    }
  }, [area]);

  useEffect(() => {
    // Sin config no se pide nada: la sección se muestra como "No configurado".
    if (!configured || !active) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de datos externos al abrir la pestaña
    void load();
  }, [configured, active, load, refreshKey]);

  return (
    <section aria-labelledby={`historial-${area}`} className="mt-10">
      <div className="flex items-center justify-between gap-3">
        <h3 id={`historial-${area}`} className="text-base font-semibold text-white">
          Historial
        </h3>
        {configured ? (
          <button
            type="button"
            onClick={() => void load()}
            disabled={state.status === "loading"}
            className="rounded-tk-md border border-tk-secondary/30 px-3 py-1.5 text-sm font-medium text-tk-secondary transition-colors hover:border-tk-secondary hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tk-secondary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {state.status === "loading" ? "Cargando…" : "Actualizar"}
          </button>
        ) : (
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-medium text-tk-medium">
            No configurado
          </span>
        )}
      </div>

      <div className="mt-3" aria-live="polite">
        {!configured ? (
          <p className="text-sm text-tk-medium">
            Falta configurar el webhook de historial. Cuando esté, las ejecuciones aparecerán aquí.
          </p>
        ) : state.status === "error" ? (
          <div
            role="alert"
            className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200"
          >
            No se pudo cargar el historial. Prueba con «Actualizar»; si sigue fallando, avisa en el
            canal.
          </div>
        ) : state.status === "loading" ? (
          <p className="text-sm text-tk-medium">Cargando historial…</p>
        ) : state.rows.length === 0 ? (
          <p className="text-sm text-tk-medium">Todavía no hay ejecuciones registradas.</p>
        ) : (
          <div className="overflow-x-auto rounded-tk-lg border border-white/10">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-wide text-tk-medium">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Fecha</th>
                  <th scope="col" className="px-3 py-2 font-medium">Resumen</th>
                  <th scope="col" className="px-3 py-2 font-medium">Solicitante</th>
                  <th scope="col" className="px-3 py-2 font-medium">Estado</th>
                  <th scope="col" className="px-3 py-2 font-medium">Drive</th>
                  <th scope="col" className="px-3 py-2 font-medium">Alertas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {state.rows.map((row, i) => {
                  const estado = ESTADOS[row.estado] ?? {
                    label: row.estado,
                    className: "border-white/10 bg-white/5 text-tk-medium",
                  };
                  const totalAlertas = row.alertas_rojas.length + row.alertas_amarillas.length;
                  return (
                    <tr key={row.request_id || i} className="align-top">
                      <td className="whitespace-nowrap px-3 py-2.5 text-tk-secondary/80">
                        {formatDate(row.creado_el)}
                      </td>
                      <td className="px-3 py-2.5 text-white">
                        {row.resumen || "—"}
                        {row.error_mensaje && (
                          <p className="mt-1 text-xs text-red-300">{row.error_mensaje}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-tk-secondary/80">
                        {row.solicitante_email || "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={
                            "inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium " +
                            estado.className
                          }
                        >
                          {estado.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {row.link ? (
                          <a
                            href={row.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-tk-secondary underline underline-offset-2 hover:text-white"
                          >
                            Abrir
                          </a>
                        ) : (
                          <span className="text-tk-medium">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {totalAlertas === 0 ? (
                          <span className="text-tk-medium">—</span>
                        ) : (
                          <details>
                            <summary className="cursor-pointer whitespace-nowrap text-tk-secondary/80 hover:text-white">
                              {[
                                row.alertas_rojas.length > 0 &&
                                  plural(row.alertas_rojas.length, "roja", "rojas"),
                                row.alertas_amarillas.length > 0 &&
                                  plural(row.alertas_amarillas.length, "amarilla", "amarillas"),
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </summary>
                            <ul className="mt-2 space-y-1 text-xs">
                              {row.alertas_rojas.map((alerta, j) => (
                                <li key={`r${j}`} className="text-red-300">
                                  <span className="sr-only">Roja: </span>● {alerta}
                                </li>
                              ))}
                              {row.alertas_amarillas.map((alerta, j) => (
                                <li key={`a${j}`} className="text-amber-200">
                                  <span className="sr-only">Amarilla: </span>● {alerta}
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
