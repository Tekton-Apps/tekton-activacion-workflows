import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { guardTabRequest } from "@/lib/server/guard";
import { callN8n, logN8nFailure, n8nAuthFailedResponse } from "@/lib/server/n8n";
import { validateLiquidacion } from "@/lib/liquidacion";
import { RH_LIQ_ENDPOINT } from "@/lib/rh";

function strList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

export async function POST(req: Request) {
  // 1-3. Same-origin, sesión y whitelist de RH — antes de tocar el body.
  const guard = await guardTabRequest(req, "rh");
  if (!guard.ok) return guard.response;
  const email = guard.email;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  // 4. Lista blanca de campos y tipos (lib/liquidacion.ts). Los errores se devuelven con el
  // mismo shape que el 422 de n8n para que la UI los muestre igual.
  const validation = validateLiquidacion(body);
  if (!validation.ok) {
    return NextResponse.json({ errores: validation.errores }, { status: 400 });
  }

  // 5. Confirmación server-side, igual que /api/trigger: === true estricto.
  if ((body as { confirmed?: unknown }).confirmed !== true) {
    return NextResponse.json(
      { errores: ["Confirma que los datos son correctos antes de generar."] },
      { status: 400 },
    );
  }

  // 6. Payload a n8n armado desde cero: datos ya validados + request_id y solicitante puestos
  // por el servidor (nunca el body del cliente tal cual).
  const requestId = randomUUID();
  const log = { event: "rh-liquidacion-failed", request_id: requestId, user: email };
  const result = await callN8n(RH_LIQ_ENDPOINT, {
    method: "POST",
    body: { ...validation.data, request_id: requestId, solicitante_email: email },
    log,
  });

  if (result.kind === "misconfigured") {
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }
  if (result.kind === "auth-failed") return n8nAuthFailedResponse();
  if (result.kind === "network-error") {
    return NextResponse.json({ error: "upstream failed" }, { status: 502 });
  }

  // 7. n8n rechazó por reglas de negocio: se reenvían sus errores tal cual vienen.
  if (result.status === 422) {
    const errores = strList((result.data as { errores?: unknown } | null)?.errores);
    return NextResponse.json(
      { errores: errores.length > 0 ? errores : ["n8n rechazó la solicitud sin detallar el motivo."] },
      { status: 422 },
    );
  }

  if (result.status < 200 || result.status >= 300) {
    logN8nFailure(log, result.status);
    return NextResponse.json({ error: "upstream failed" }, { status: 502 });
  }

  // 8. Auditoría — solo el disparo aceptado, igual que /api/trigger. Nunca el secret.
  console.log(
    JSON.stringify({
      event: "trigger",
      ts: new Date().toISOString(),
      workflow: "rh-liquidacion",
      request_id: requestId,
      user: email,
      confirmed: true,
    }),
  );

  const data = (result.data ?? {}) as { request_id?: unknown; version?: unknown; estado?: unknown };
  return NextResponse.json({
    request_id: typeof data.request_id === "string" ? data.request_id : requestId,
    version:
      typeof data.version === "string" || typeof data.version === "number"
        ? String(data.version)
        : null,
    estado: typeof data.estado === "string" ? data.estado : "en_proceso",
  });
}
