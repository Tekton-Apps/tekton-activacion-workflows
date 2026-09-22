import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isEmailAllowed } from "@/lib/allowed-emails";
import { ENTITIES } from "@/lib/entities";
import { WORKFLOWS } from "@/lib/workflows";

// El único cliente legítimo es nuestro propio frontend en el navegador, que siempre
// manda el header Origin en un POST. Comparamos el host del Origin contra el header Host
// del request — NO contra new URL(req.url), que detrás del proxy de Vercel puede ser el
// localhost interno y haría 403 a todo en producción. Fail-closed si falta u origin inválido.
function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  // 1. Same-origin — el más barato, primero.
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
  // el body, así alguien que no pertenece a NINGUNA entidad no puede sondear qué workflows
  // existen. Ojo: esto NO alcanza como único chequeo desde que hay más de una entidad — solo
  // descarta a quien no está en ninguna whitelist. Quién puede correr ESTE workflow puntual
  // se revalida en el paso 5, ya con el workflow resuelto.
  const email = session.user?.email;
  if (!ENTITIES.some((entity) => isEmailAllowed(email, entity.allowedEmailsEnv))) {
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

  // 5. Whitelist, segunda pasada — específica del workflow resuelto. El paso 3 solo prueba
  // pertenencia a ALGUNA entidad; si en el futuro se suma otra entidad, alguien de esa
  // whitelist pasaría ese filtro y, sin este segundo chequeo, podría pedir un workflowId de
  // Tekton directo por POST y dispararlo. Recién acá se sabe qué workflow es, así que recién
  // acá se puede confirmar que el email está específicamente en SU whitelist.
  if (!isEmailAllowed(email, workflow.env.allowedEmails)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // 6. Confirmación server-side — el checkbox del cliente es solo UI; el gate real está acá.
  // Se relee del body YA parseado (nunca un segundo req.json()); === true estricto a propósito.
  if ((body as { confirmed?: unknown }).confirmed !== true) {
    return NextResponse.json({ error: "confirmation required" }, { status: 400 });
  }

  // 7. Disparar el webhook de n8n. URL y secret se leen server-side (nunca llegan al cliente),
  // vía los NOMBRES de env var que guarda el workflow — la indirección del shape por-entidad.
  const webhookUrl = process.env[workflow.env.webhookUrl];
  const webhookSecret = process.env[workflow.env.webhookSecret];
  if (!webhookUrl || !webhookSecret) {
    // Fail-closed: si falta config, no inventamos un éxito. No logueamos el valor del secret.
    console.error(
      `Config faltante: ${workflow.env.webhookUrl} o ${workflow.env.webhookSecret} no están seteadas`,
    );
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "X-Webhook-Secret": webhookSecret,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ workflow: workflow.id }),
      // El webhook responde de inmediato (responseMode onReceived), así que resuelve en ms.
      // El timeout solo es una guarda contra una conexión colgada, no contra los ~40 nodos.
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error(
        JSON.stringify({
          event: "trigger-failed",
          ts: new Date().toISOString(),
          workflow: workflow.id,
          user: email,
          status: res.status,
        }),
      );
      return NextResponse.json({ error: "trigger failed" }, { status: 502 });
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "trigger-failed",
        ts: new Date().toISOString(),
        workflow: workflow.id,
        user: email,
        status: "network-error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
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
      user: email,
      confirmed: true,
    }),
  );

  return NextResponse.json({ ok: true });
}
