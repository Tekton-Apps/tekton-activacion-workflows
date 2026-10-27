"use client";

import { useEffect, useState } from "react";
import { useTabActive } from "@/components/CompanyTabs";
import type { Execution, ExecutionArea } from "@/lib/executions";
import { isN8nConfigError, N8N_CONFIG_ERROR_MESSAGE } from "@/lib/n8n-errors";

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
  // `rows`: lo último que se mostró, para no vaciar la tabla mientras recarga.
  | { status: "loading"; rows?: Execution[] }
  | { status: "ok"; rows: Execution[] }
  | { status: "error"; config: boolean };

type LoadResult = Exclude<LoadState, { status: "loading" }>;

interface InflightRequest {
  promise: Promise<LoadResult>;
  controller: AbortController;
  subscribers: number;
}

// Pedidos en vuelo, por clave (área + refreshKey + "Actualizar"). Si el mismo pedido ya salió, se
// reusa en vez de volver a pegarle a n8n: cubre el doble montaje de StrictMode en dev (efecto →
// cleanup → efecto). Se borra al resolver, así que reabrir la pestaña pide de nuevo.
const inflight = new Map<string, InflightRequest>();

function subscribeExecutions(area: ExecutionArea, key: string) {
  let entry = inflight.get(key);
  if (!entry) {
    const controller = new AbortController();
    const promise = (async (): Promise<LoadResult> => {
      try {
        const res = await fetch(`/api/executions?area=${area}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) {
          const data: unknown = await res.json().catch(() => null);
          return { status: "error", config: isN8nConfigError(data) };
        }
        return { status: "ok", rows: (await res.json()) as Execution[] };
      } catch {
        return { status: "error", config: false };
      } finally {
        if (inflight.get(key)?.controller === controller) inflight.delete(key);
      }
    })();
    entry = { promise, controller, subscribers: 0 };
    inflight.set(key, entry);
  }
  const request = entry;
  request.subscribers++;
  let released = false;
  return {
    promise: request.promise,
    // Al cambiar de pestaña se cancela el pedido si nadie más lo espera. Diferido un tick porque
    // StrictMode hace cleanup y se vuelve a suscribir enseguida: ahí no hay que cancelar.
    release() {
      if (released) return;
      released = true;
      request.subscribers--;
      setTimeout(() => {
        if (request.subscribers === 0 && inflight.get(key) === request) {
          inflight.delete(key);
          request.controller.abort();
        }
      }, 0);
    },
  };
}

// Historial leído desde n8n (vía /api/executions). No se refresca solo: carga cada vez que se
// abre la pestaña, cuando cambia `refreshKey` (ej. después de "Generar") y con "Actualizar".
// Carga en segundo plano: nunca bloquea el cambio de pestaña, y si la pestaña se cierra antes de
// que vuelva, el pedido se cancela y la respuesta se ignora.
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
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    // Sin config no se pide nada: la sección se muestra como "No configurado". Pestaña oculta
    // tampoco: se pide recién al abrirla.
    if (!configured || !active) return;
    let current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de datos externos al abrir la pestaña
    setState((prev) => ({
      status: "loading",
      rows: prev.status === "error" ? undefined : prev.rows,
    }));
    const request = subscribeExecutions(area, `${area}:${refreshKey}:${reloadCount}`);
    void request.promise.then((result) => {
      if (current) setState(result);
    });
    return () => {
      current = false;
      request.release();
    };
  }, [configured, active, area, refreshKey, reloadCount]);

  const rows = state.status === "error" ? undefined : state.rows;

  return (
    <section aria-labelledby={`historial-${area}`} className="mt-10">
      <div className="flex items-center justify-between gap-3">
        <h3 id={`historial-${area}`} className="text-base font-semibold text-white">
          Historial
        </h3>
        {configured ? (
          <button
            type="button"
            onClick={() => setReloadCount((n) => n + 1)}
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
            {state.config
              ? N8N_CONFIG_ERROR_MESSAGE
              : "No se pudo cargar el historial. Prueba con «Actualizar»; si sigue fallando, avisa en el canal."}
          </div>
        ) : !rows ? (
          <p className="text-sm text-tk-medium">Cargando historial…</p>
        ) : rows.length === 0 ? (
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
                {rows.map((row, i) => {
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
