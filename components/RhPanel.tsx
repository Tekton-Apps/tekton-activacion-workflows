"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { useTabActive } from "@/components/CompanyTabs";
import { ExecutionHistory } from "@/components/ExecutionHistory";
import { WorkerCombobox } from "@/components/WorkerCombobox";
import { validateLiquidacion, type HuboVariables } from "@/lib/liquidacion";
import { isN8nConfigError, N8N_CONFIG_ERROR_MESSAGE } from "@/lib/n8n-errors";
import type { Worker } from "@/lib/rh";

const HUBO_OPTIONS: { value: HuboVariables; label: string }[] = [
  { value: "si", label: "Sí" },
  { value: "no", label: "No" },
  { value: "no_se", label: "No sé" },
];

const INPUT_CLASS =
  "w-full rounded-tk-md border border-white/15 bg-tk-black px-3 py-2 text-sm text-white placeholder:text-tk-medium focus:border-tk-secondary focus:outline-none disabled:opacity-50";

// "" → no informado; cualquier otra cosa se convierte y la valida lib/liquidacion.ts.
function parseAmount(raw: string): number | undefined {
  return raw.trim() === "" ? undefined : Number(raw);
}

type WorkersState =
  | { status: "idle" | "loading" }
  // config: n8n rechazó el secret (ver lib/n8n-errors.ts) — reintentar no lo arregla.
  | { status: "error"; config: boolean }
  | { status: "ok"; workers: Worker[] };

type SubmitResult =
  | { kind: "ok"; version: string | null }
  | { kind: "errores"; errores: string[] }
  | { kind: "error"; config: boolean };

export function RhPanel({
  formConfigured,
  historyConfigured,
}: {
  // Calculados por page.tsx leyendo process.env: el formulario necesita los webhooks de
  // trabajadores y de liquidación; el historial, el de ejecuciones.
  formConfigured: boolean;
  historyConfigured: boolean;
}) {
  const active = useTabActive();
  const ids = useId();

  const [workersState, setWorkersState] = useState<WorkersState>({ status: "idle" });
  const [worker, setWorker] = useState<Worker | null>(null);
  const [fechaCese, setFechaCese] = useState("");
  const [motivo, setMotivo] = useState("");
  const [hubo, setHubo] = useState<HuboVariables | "">("");
  const [rem, setRem] = useState("");
  const [bonos, setBonos] = useState("");
  const [comisiones, setComisiones] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  const loadWorkers = useCallback(async () => {
    setWorkersState({ status: "loading" });
    try {
      const res = await fetch("/api/rh/workers", { cache: "no-store" });
      if (!res.ok) {
        const data: unknown = await res.json().catch(() => null);
        setWorkersState({ status: "error", config: isN8nConfigError(data) });
        return;
      }
      setWorkersState({ status: "ok", workers: (await res.json()) as Worker[] });
    } catch {
      setWorkersState({ status: "error", config: false });
    }
  }, []);

  // El maestro se pide la primera vez que se abre la pestaña (no en cada apertura: cambia
  // poco y re-pedirlo resetearía el combobox mientras se llena el formulario).
  useEffect(() => {
    if (!formConfigured || !active || workersState.status !== "idle") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de datos externos al abrir la pestaña
    void loadWorkers();
  }, [formConfigured, active, workersState.status, loadWorkers]);

  // "o bien": si se informa el total, bonos/comisiones no aplican (ya están incluidos), y al revés.
  const usesTotal = rem.trim() !== "";
  const usesDesglose = bonos.trim() !== "" || comisiones.trim() !== "";

  const payload = {
    dni: worker?.dni ?? "",
    fecha_cese: fechaCese,
    motivo,
    hubo_variables_mes: hubo,
    ...(hubo === "si"
      ? usesTotal
        ? { rem_mes_cese: parseAmount(rem) }
        : { bonos_mes: parseAmount(bonos), comisiones_mes: parseAmount(comisiones) }
      : {}),
  };
  const validation = validateLiquidacion(payload);
  const touched = Boolean(worker || fechaCese || motivo || hubo);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validation.ok || !confirmed) return;
    setResult(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/rh/liquidacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validation.data, confirmed: true }),
      });
      const data = (await res.json().catch(() => null)) as {
        version?: string | null;
        errores?: string[];
        error?: string;
      } | null;
      if (res.ok) {
        setResult({ kind: "ok", version: data?.version ?? null });
        // Evita un segundo envío accidental del mismo pedido.
        setConfirmed(false);
      } else if (Array.isArray(data?.errores) && data.errores.length > 0) {
        setResult({ kind: "errores", errores: data.errores });
      } else {
        setResult({ kind: "error", config: isN8nConfigError(data) });
      }
      if (res.ok || res.status === 422) setHistoryKey((k) => k + 1);
    } catch {
      setResult({ kind: "error", config: false });
    } finally {
      setSubmitting(false);
    }
  }

  const workers = workersState.status === "ok" ? workersState.workers : [];

  return (
    <div className="rounded-tk-lg bg-tk-black p-6 font-tk-sans sm:p-8">
      <div className="h-1 w-12 rounded-tk-full bg-tk-secondary" />
      <h2 className="mt-4 font-tk-display text-2xl italic text-white">RH · Liquidaciones</h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-tk-secondary/80">
        Genera la liquidación de un trabajador cesado. El cálculo corre en n8n; cuando termine,
        te llegará un correo con el enlace al documento.
      </p>

      {!formConfigured ? (
        <div className="mt-6 flex items-start justify-between gap-3 rounded-tk-lg border border-white/10 bg-tk-primary p-5">
          <p className="text-sm text-tk-medium">
            Falta configurar los webhooks de liquidaciones. Cuando estén, el formulario se
            habilita solo.
          </p>
          <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-medium text-tk-medium">
            No configurado
          </span>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          noValidate
          className="mt-6 space-y-5 rounded-tk-lg border border-white/10 bg-tk-primary p-5"
        >
          {/* Trabajador */}
          <div>
            <label id={`${ids}-worker`} className="mb-1.5 block text-sm font-medium text-white">
              Trabajador
            </label>
            {workersState.status === "error" ? (
              <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">
                {workersState.config
                  ? N8N_CONFIG_ERROR_MESSAGE
                  : "No se pudo cargar la lista de trabajadores."}
                <button
                  type="button"
                  onClick={() => void loadWorkers()}
                  className="shrink-0 font-semibold underline underline-offset-2"
                >
                  Reintentar
                </button>
              </div>
            ) : (
              <WorkerCombobox
                workers={workers}
                value={worker}
                onChange={(w) => {
                  setWorker(w);
                  // Si ya figura cesado en el maestro, se propone su fecha de cese.
                  if (w?.fecha_cese && !fechaCese) setFechaCese(w.fecha_cese);
                }}
                disabled={workersState.status !== "ok" || submitting}
                labelId={`${ids}-worker`}
              />
            )}
            {workersState.status === "loading" && (
              <p className="mt-1 text-xs text-tk-medium">Cargando trabajadores…</p>
            )}
          </div>

          {/* Fecha de cese */}
          <div>
            <label htmlFor={`${ids}-fecha`} className="mb-1.5 block text-sm font-medium text-white">
              Fecha de cese
            </label>
            <input
              id={`${ids}-fecha`}
              type="date"
              value={fechaCese}
              disabled={submitting}
              onChange={(e) => setFechaCese(e.target.value)}
              className={INPUT_CLASS + " sm:max-w-xs"}
            />
          </div>

          {/* Motivo */}
          <div>
            <label htmlFor={`${ids}-motivo`} className="mb-1.5 block text-sm font-medium text-white">
              Motivo
            </label>
            <textarea
              id={`${ids}-motivo`}
              value={motivo}
              maxLength={300}
              rows={3}
              disabled={submitting}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Por ejemplo: renuncia voluntaria"
              className={INPUT_CLASS}
            />
            <p className="mt-1 text-right text-xs text-tk-medium">{motivo.trim().length}/300</p>
          </div>

          {/* Variables del mes */}
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-white">
              ¿Hubo bonos, comisiones o vacaciones en el mes de cese?
            </legend>
            <div className="flex flex-wrap gap-4">
              {HUBO_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-2 text-sm text-tk-secondary/90"
                >
                  <input
                    type="radio"
                    name={`${ids}-hubo`}
                    value={option.value}
                    checked={hubo === option.value}
                    disabled={submitting}
                    onChange={() => setHubo(option.value)}
                    className="size-4 accent-tk-secondary"
                  />
                  {option.label}
                </label>
              ))}
            </div>

            {hubo === "si" && (
              <div className="mt-4 space-y-4 rounded-tk-md border border-white/10 bg-tk-black/40 p-4">
                <p id={`${ids}-ayuda`} className="text-xs leading-relaxed text-tk-secondary/80">
                  Completa la <strong>remuneración total afecta del mes</strong> si la tienes: ya
                  incluye bonos, comisiones y vacaciones, así que no hace falta desglosarlos. Si
                  no la tienes, completa los bonos y las comisiones del mes por separado.
                </p>
                <div>
                  <label htmlFor={`${ids}-rem`} className="mb-1.5 block text-sm font-medium text-white">
                    Remuneración total afecta del mes (S/)
                  </label>
                  <input
                    id={`${ids}-rem`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={rem}
                    aria-describedby={`${ids}-ayuda`}
                    disabled={submitting || usesDesglose}
                    onChange={(e) => setRem(e.target.value)}
                    className={INPUT_CLASS + " sm:max-w-xs"}
                  />
                </div>
                <p className="text-xs font-medium uppercase tracking-wide text-tk-medium">o bien</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor={`${ids}-bonos`} className="mb-1.5 block text-sm font-medium text-white">
                      Bonos del mes (S/)
                    </label>
                    <input
                      id={`${ids}-bonos`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      value={bonos}
                      disabled={submitting || usesTotal}
                      onChange={(e) => setBonos(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label htmlFor={`${ids}-comisiones`} className="mb-1.5 block text-sm font-medium text-white">
                      Comisiones del mes (S/)
                    </label>
                    <input
                      id={`${ids}-comisiones`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      value={comisiones}
                      disabled={submitting || usesTotal}
                      onChange={(e) => setComisiones(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>
              </div>
            )}
          </fieldset>

          {/* Resultado */}
          <div aria-live="polite">
            {result?.kind === "ok" && (
              <div role="status" className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm leading-relaxed text-emerald-200">
                <span className="font-semibold">
                  Solicitud recibida{result.version ? ` (V${result.version})` : ""}.
                </span>{" "}
                Te llegará un correo cuando termine.
              </div>
            )}
            {result?.kind === "errores" && (
              <div role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm leading-relaxed text-red-200">
                <p className="font-semibold">No se pudo generar la liquidación:</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {result.errores.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
            {result?.kind === "error" && (
              <div role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm leading-relaxed text-red-200">
                {result.config ? (
                  N8N_CONFIG_ERROR_MESSAGE
                ) : (
                  <>
                    <span className="font-semibold">No se pudo enviar la solicitud. </span>
                    Prueba de nuevo; si vuelve a fallar, avisa en el canal.
                  </>
                )}
              </div>
            )}
          </div>

          {/* Confirmación + envío */}
          <div className="border-t border-white/10 pt-4">
            {touched && !validation.ok && (
              <ul className="mb-3 list-disc space-y-0.5 pl-5 text-xs text-tk-medium">
                {validation.errores.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            )}
            <label
              className={
                "flex items-start gap-2.5 text-sm " +
                (submitting ? "cursor-default text-tk-medium" : "cursor-pointer text-tk-secondary/80")
              }
            >
              <input
                type="checkbox"
                checked={confirmed}
                disabled={submitting}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-tk-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tk-secondary"
              />
              <span>Confirmo que los datos son correctos y quiero generar la liquidación.</span>
            </label>
            <button
              type="submit"
              disabled={!validation.ok || !confirmed || submitting}
              aria-busy={submitting}
              className="mt-3 w-full rounded-tk-md bg-tk-secondary px-4 py-2.5 text-sm font-semibold text-tk-primary transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tk-secondary disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-tk-medium sm:w-auto"
            >
              {submitting ? "Enviando…" : "Generar liquidación"}
            </button>
          </div>
        </form>
      )}

      <ExecutionHistory area="rh" configured={historyConfigured} refreshKey={historyKey} />
    </div>
  );
}
