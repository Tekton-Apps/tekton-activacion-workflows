import type { TabId } from "@/lib/tabs";

// Historial de ejecuciones leído desde la Data Table de ejecuciones de n8n (webhook de
// N8N_TEKTON_EJECUCIONES_URL). Sin copia propia: ver docs/adr/0004-pestanas-parametros-request-id-historial.md.

export type ExecutionArea = Extract<TabId, "rh" | "contabilidad">;

export const EXECUTION_AREAS: readonly ExecutionArea[] = ["rh", "contabilidad"];

export const EXECUTIONS_ENDPOINT = {
  urlEnv: "N8N_TEKTON_EJECUCIONES_URL",
  secretEnv: "N8N_TEKTON_EJECUCIONES_SECRET",
};

export type ExecutionEstado =
  | "en_proceso"
  | "ok"
  | "ok_con_alertas"
  | "bloqueado"
  | "error"
  | "sin_respuesta";

export interface Execution {
  request_id: string;
  estado: ExecutionEstado | string;
  resumen: string;
  version: string | null;
  // Solo https:// — cualquier otro esquema se descarta en el servidor.
  link: string | null;
  alertas_rojas: string[];
  alertas_amarillas: string[];
  error_mensaje: string;
  creado_el: string | null;
  solicitante_email: string;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}

function strList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(str).filter(Boolean);
  // n8n guarda las alertas como texto JSON; el webhook ya las parsea, pero por las dudas.
  if (typeof value === "string" && value.trim().startsWith("[")) {
    try {
      return strList(JSON.parse(value));
    } catch {
      return [];
    }
  }
  return [];
}

function safeLink(value: unknown): string | null {
  const raw = str(value);
  if (!raw) return null;
  try {
    return new URL(raw).protocol === "https:" ? raw : null;
  } catch {
    return null;
  }
}

// Tolerante a lo que devuelva el webhook: acepta un array directo o { filas | data: [...] },
// y cada campo faltante cae a un valor neutro en vez de romper la tabla.
export function normalizeExecutions(data: unknown): Execution[] {
  const record = data as { filas?: unknown; data?: unknown } | null;
  const rows = Array.isArray(data)
    ? data
    : Array.isArray(record?.filas)
      ? record.filas
      : Array.isArray(record?.data)
        ? record.data
        : [];

  return rows
    .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
    .map((row) => {
      const version = str(row.version);
      return {
        request_id: str(row.request_id),
        estado: str(row.estado) || "en_proceso",
        resumen: str(row.resumen),
        version: version || null,
        link: safeLink(row.link),
        alertas_rojas: strList(row.alertas_rojas),
        alertas_amarillas: strList(row.alertas_amarillas),
        error_mensaje: str(row.error_mensaje),
        creado_el: str(row.creado_el) || str(row.createdAt) || null,
        solicitante_email: str(row.solicitante_email),
      };
    });
}
