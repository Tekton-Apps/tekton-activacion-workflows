"use client";

import { useState } from "react";
import type { WorkflowTrigger } from "@/lib/workflows";

function Spinner() {
  return (
    <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle
        className="opacity-30"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

// `configured` lo calcula el Server Component (page.tsx) leyendo process.env server-side:
// si al workflow le faltan sus env vars de webhook, la card se renderiza deshabilitada en vez
// de un botón que dispararía un 500. Es el fail-closed también en el render, no solo en la API.
export function TektonWorkflowCard({
  workflow,
  configured,
}: {
  workflow: WorkflowTrigger;
  configured: boolean;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<"success" | "error" | null>(null);

  async function handleClick() {
    // Limpiar el error anterior antes de reintentar. Sin esto el panel rojo sigue en
    // pantalla durante el reintento, contradiciendo al spinner que dice que está andando.
    setResult(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId: workflow.id, confirmed: true }),
      });
      setResult(res.ok ? "success" : "error");
    } catch {
      setResult("error");
    } finally {
      setSubmitting(false);
    }
  }

  // Los cuatro estados comparten el mismo cascarón para que todas las cards midan igual en
  // el grid: `h-full` + `flex-col`, y la zona de acción empujada al fondo con `mt-auto`.
  return (
    <article
      className={
        "flex h-full flex-col overflow-hidden rounded-tk-lg border bg-tk-primary shadow-sm " +
        (configured
          ? "border-white/10 transition-shadow hover:border-tk-secondary hover:shadow-md"
          : "border-white/10")
      }
    >
      {/* Barra de acento: mismo rol que en WorkflowCard, con el cian de marca Tekton. */}
      <div className={configured ? "h-1 bg-tk-secondary" : "h-1 bg-white/10"} />

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <h2
            className={
              "text-base font-semibold leading-snug " +
              (configured ? "text-white" : "text-tk-medium")
            }
          >
            {workflow.label}
          </h2>
          {!configured && (
            <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-medium text-tk-medium">
              No configurado
            </span>
          )}
        </div>

        <p
          className={
            "mt-2 text-sm leading-relaxed " +
            (configured ? "text-tk-secondary/80" : "text-tk-medium")
          }
        >
          {workflow.description}
        </p>

        <div className="mt-auto pt-5">
          {!configured ? (
            <p className="border-t border-white/10 pt-4 text-sm text-tk-medium">
              Falta cargar el webhook de este workflow en n8n. Cuando esté, la card se
              habilita sola.
            </p>
          ) : result === "success" ? (
            <div
              role="status"
              className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm leading-relaxed text-emerald-200"
            >
              <span className="font-semibold">Listo. </span>
              {workflow.successMessage}
            </div>
          ) : (
            <>
              {result === "error" && (
                <div
                  role="alert"
                  className="mb-3 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm leading-relaxed text-red-200"
                >
                  <span className="font-semibold">No se pudo disparar el workflow. </span>
                  Probá de nuevo; si vuelve a fallar, avisá en el canal.
                </div>
              )}

              <label
                className={
                  "flex items-start gap-2.5 border-t border-white/10 pt-4 text-sm " +
                  (submitting
                    ? "cursor-default text-tk-medium"
                    : "cursor-pointer text-tk-secondary/80")
                }
              >
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={submitting}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-0.5 size-4 shrink-0 accent-tk-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tk-secondary"
                />
                <span>{workflow.confirmationQuestion}</span>
              </label>

              <button
                type="button"
                disabled={!confirmed || submitting}
                aria-busy={submitting}
                aria-label={`Ejecutar workflow: ${workflow.label}`}
                onClick={handleClick}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-tk-md bg-tk-secondary px-4 py-2.5 text-sm font-semibold text-tk-primary transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tk-secondary disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-tk-medium"
              >
                {submitting ? (
                  <>
                    <Spinner />
                    Enviando…
                  </>
                ) : (
                  "Ejecutar workflow"
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
