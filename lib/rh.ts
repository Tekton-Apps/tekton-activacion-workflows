// Endpoints de n8n de la pestaña RH y el shape del maestro de trabajadores.

export const RH_WORKERS_ENDPOINT = {
  urlEnv: "N8N_TEKTON_RH_WORKERS_URL",
  secretEnv: "N8N_TEKTON_RH_WORKERS_SECRET",
};

export const RH_LIQ_ENDPOINT = {
  urlEnv: "N8N_TEKTON_RH_LIQ_URL",
  secretEnv: "N8N_TEKTON_RH_LIQ_SECRET",
};

export interface Worker {
  dni: string;
  // Viene de n8n ya como "APELLIDO Nombre".
  nombre: string;
  cargo: string;
  estado: "activo" | "cesado";
  fecha_cese: string | null;
}

// El webhook responde un array; se acepta también { trabajadores: [...] } por si cambia.
export function normalizeWorkers(data: unknown): Worker[] {
  const rows = Array.isArray(data)
    ? data
    : Array.isArray((data as { trabajadores?: unknown } | null)?.trabajadores)
      ? (data as { trabajadores: unknown[] }).trabajadores
      : [];

  return rows
    .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
    .map((row) => ({
      dni: String(row.dni ?? "").trim(),
      nombre: String(row.nombre ?? "").trim(),
      cargo: String(row.cargo ?? ""),
      estado: row.estado === "cesado" ? ("cesado" as const) : ("activo" as const),
      fecha_cese: typeof row.fecha_cese === "string" && row.fecha_cese ? row.fecha_cese : null,
    }))
    .filter((worker) => worker.dni && worker.nombre);
}
