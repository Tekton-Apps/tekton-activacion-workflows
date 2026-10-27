import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isSameOrigin } from "@/lib/server/guard";
import { callN8n, logN8nFailure, n8nAuthFailedResponse } from "@/lib/server/n8n";
import { allowedTabsFor, canAccessTab } from "@/lib/tabs";
import { WORKFLOWS } from "@/lib/workflows";

export async function POST(req: Request) {
  // 1. Same-origin — el más barato, primero. Ver isSameOrigin en lib/server/guard.ts.
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // 2. Sesión.
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 3. Whitelist, primera pasada (check #2) — revalida en CADA request, no solo en el login.
  // Una sesión JWT ya emitida sigue siendo válida aunque se saque el email de la whitelist;
  // esto es lo único que hace efectiva la revocación sin forzar logout. Corta ANTES de tocar
  // el body, así alguien que no tiene NINGUNA pestaña no puede sondear qué workflows
  // existen. Ojo: esto NO alcanza como único chequeo desde que hay más de una pestaña — solo
  // descarta a quien no está en ninguna whitelist. Quién puede correr ESTE workflow puntual
  // se revalida en el paso 5, ya con el workflow resuelto.
  const email = session.user?.email;
  if (!email || allowedTabsFor(email).length === 0) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // 4. Resolver el workflow pedido. El body llega recién acá, ya pasado el chequeo #3.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  // Optional chaining para no explotar si el body es null / no-objeto (JSON válido pero no {}).
  const workflowId = (body as { workflowId?: unknown })?.workflowId;
  if (!workflowId || typeof workflowId !== "string") {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  // find(===), nunca lookup por índice de objeto: evita confusión con __proto__/constructor.
  const workflow = WORKFLOWS.find((w) => w.id === workflowId);
  if (!workflow) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // 5. Whitelist, segunda pasada — la de la pestaña del workflow resuelto. El paso 3 solo
  // prueba pertenencia a ALGUNA pestaña; sin este segundo chequeo, alguien de la whitelist de
  // RH podría pedir un workflowId de contabilidad directo por POST y dispararlo. Recién acá se
  // sabe qué workflow es, así que recién acá se puede confirmar que el email está en SU pestaña.
  if (!canAccessTab(email, workflow.tab)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // 6. Confirmación server-side — el checkbox del cliente es solo UI; el gate real está acá.
  // Se relee del body YA parseado (nunca un segundo req.json()); === true estricto a propósito.
  if ((body as { confirmed?: unknown }).confirmed !== true) {
    return NextResponse.json({ error: "confirmation required" }, { status: 400 });
  }

  // 7. Disparar el webhook de n8n. URL y secret se leen server-side dentro de callN8n (nunca
  // llegan al cliente), vía los NOMBRES de env var que guarda el workflow.
  // request_id y solicitante los pone el servidor, nunca el cliente: request_id cruza este
  // disparo con su fila en el historial de n8n y con los logs de Vercel; el email sale de la
  // sesión ya validada. Ver docs/adr/0004-pestanas-parametros-request-id-historial.md.
  // El webhook responde de inmediato (responseMode onReceived), así que resuelve en ms.
  const requestId = randomUUID();
  const log = {
    event: "trigger-failed",
    workflow: workflow.id,
    request_id: requestId,
    user: email,
  };
  const result = await callN8n(
    { urlEnv: workflow.env.webhookUrl, secretEnv: workflow.env.webhookSecret },
    {
      method: "POST",
      body: { workflow: workflow.id, request_id: requestId, solicitante_email: email },
      log,
    },
  );

  if (result.kind === "misconfigured") {
    // Fail-closed: si falta config, no inventamos un éxito.
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }
  if (result.kind === "auth-failed") return n8nAuthFailedResponse();
  if (result.kind === "network-error") {
    return NextResponse.json({ error: "trigger failed" }, { status: 502 });
  }
  if (result.status < 200 || result.status >= 300) {
    logN8nFailure(log, result.status);
    return NextResponse.json({ error: "trigger failed" }, { status: 502 });
  }

  // 8. Auditoría — solo el disparo exitoso (los rechazos no se loguean en v1). Email en texto
  // plano a propósito: los logs de Vercel no son públicos y el punto es saber quién disparó.
  // Nunca el secret. Se emite recién acá para que solo cuente lo que efectivamente se disparó.
  console.log(
    JSON.stringify({
      event: "trigger",
      ts: new Date().toISOString(),
      workflow: workflow.id,
      request_id: requestId,
      user: email,
      confirmed: true,
    }),
  );

  return NextResponse.json({ ok: true, request_id: requestId });
}
