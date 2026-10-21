// Cliente mínimo para los webhooks de n8n. URL y secret se leen server-side a partir de los
// NOMBRES de env var; nunca llegan al cliente y nunca se loguean.

export interface N8nEndpoint {
  urlEnv: string;
  secretEnv: string;
}

export function isN8nConfigured({ urlEnv, secretEnv }: N8nEndpoint): boolean {
  return Boolean(process.env[urlEnv] && process.env[secretEnv]);
}

export type N8nResult =
  | { kind: "response"; status: number; data: unknown }
  | { kind: "misconfigured" }
  | { kind: "network-error" };

export async function callN8n(
  endpoint: N8nEndpoint,
  options: {
    method: "GET" | "POST";
    query?: Record<string, string>;
    body?: unknown;
    // Contexto para el log de error (event, user, request_id…). Nunca el secret.
    log: Record<string, unknown>;
  },
): Promise<N8nResult> {
  const baseUrl = process.env[endpoint.urlEnv];
  const secret = process.env[endpoint.secretEnv];
  if (!baseUrl || !secret) {
    // Fail-closed: si falta config no inventamos una respuesta. No logueamos valores.
    console.error(`Config faltante: ${endpoint.urlEnv} o ${endpoint.secretEnv} no están seteadas`);
    return { kind: "misconfigured" };
  }

  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    console.error(`Config inválida: ${endpoint.urlEnv} no es una URL`);
    return { kind: "misconfigured" };
  }
  for (const [key, value] of Object.entries(options.query ?? {})) {
    url.searchParams.set(key, value);
  }

  try {
    const res = await fetch(url, {
      method: options.method,
      headers: {
        "X-Webhook-Secret": secret,
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
      // Guarda contra una conexión colgada; los webhooks responden en segundos.
      signal: AbortSignal.timeout(10_000),
    });
    // Un cuerpo vacío o que no sea JSON queda como null: cada route decide qué hacer.
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    return { kind: "response", status: res.status, data };
  } catch (err) {
    console.error(
      JSON.stringify({
        ...options.log,
        ts: new Date().toISOString(),
        status: "network-error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return { kind: "network-error" };
  }
}

export function logN8nFailure(log: Record<string, unknown>, status: number) {
  console.error(JSON.stringify({ ...log, ts: new Date().toISOString(), status }));
}
