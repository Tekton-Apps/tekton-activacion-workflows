import { NextResponse } from "next/server";
import { guardTabRequest } from "@/lib/server/guard";
import { callN8n, logN8nFailure, n8nAuthFailedResponse } from "@/lib/server/n8n";
import { RH_WORKERS_ENDPOINT, normalizeWorkers } from "@/lib/rh";

// Maestro de trabajadores para el combobox de la pestaña RH. Solo lectura: no se loguea el
// éxito (no es un disparo), sí las fallas.
export async function GET(req: Request) {
  const guard = await guardTabRequest(req, "rh");
  if (!guard.ok) return guard.response;

  const log = { event: "rh-workers-failed", user: guard.email };
  const result = await callN8n(RH_WORKERS_ENDPOINT, { method: "GET", log });

  if (result.kind === "misconfigured") {
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }
  if (result.kind === "auth-failed") return n8nAuthFailedResponse();
  if (result.kind === "network-error") {
    return NextResponse.json({ error: "upstream failed" }, { status: 502 });
  }
  if (result.status < 200 || result.status >= 300) {
    logN8nFailure(log, result.status);
    return NextResponse.json({ error: "upstream failed" }, { status: 502 });
  }

  return NextResponse.json(normalizeWorkers(result.data), {
    headers: { "Cache-Control": "no-store" },
  });
}
