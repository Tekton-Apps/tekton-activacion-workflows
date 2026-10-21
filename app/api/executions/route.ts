import { NextResponse } from "next/server";
import { guardTabRequest } from "@/lib/server/guard";
import { callN8n, logN8nFailure } from "@/lib/server/n8n";
import {
  EXECUTION_AREAS,
  EXECUTIONS_ENDPOINT,
  normalizeExecutions,
  type ExecutionArea,
} from "@/lib/executions";

// Historial de ejecuciones de un área, leído desde n8n. El área es la pestaña: solo se puede
// pedir la de una pestaña que el usuario tiene (guardTabRequest revalida su whitelist).
export async function GET(req: Request) {
  const areaParam = new URL(req.url).searchParams.get("area");
  // find(===) contra la lista cerrada: nunca se reenvía a n8n un valor arbitrario del cliente.
  const area = EXECUTION_AREAS.find((a) => a === areaParam) ?? null;

  const guard = await guardTabRequest(req, area);
  if (!guard.ok) return guard.response;

  const log = { event: "executions-failed", area, user: guard.email };
  const result = await callN8n(EXECUTIONS_ENDPOINT, {
    method: "GET",
    query: { area: area as ExecutionArea, limit: "30" },
    log,
  });

  if (result.kind === "misconfigured") {
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }
  if (result.kind === "network-error") {
    return NextResponse.json({ error: "upstream failed" }, { status: 502 });
  }
  if (result.status < 200 || result.status >= 300) {
    logN8nFailure(log, result.status);
    return NextResponse.json({ error: "upstream failed" }, { status: 502 });
  }

  return NextResponse.json(normalizeExecutions(result.data), {
    headers: { "Cache-Control": "no-store" },
  });
}
