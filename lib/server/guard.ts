import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { allowedTabsFor, canAccessTab, type TabId } from "@/lib/tabs";

// El único cliente legítimo es nuestro propio frontend en el navegador. Comparamos el host del
// Origin contra el header Host del request — NO contra new URL(req.url), que detrás del proxy
// de Vercel puede ser el localhost interno y haría 403 a todo en producción.
// Los navegadores siempre mandan Origin en un POST, pero NO en un fetch GET same-origin: para
// GET se acepta en su lugar Sec-Fetch-Site: same-origin (lo pone el navegador, una página de
// otro sitio no lo puede falsificar). Fail-closed si no hay ninguno de los dos.
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin) {
    if (!host) return false;
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  if (req.method === "GET" || req.method === "HEAD") {
    return req.headers.get("sec-fetch-site") === "same-origin";
  }
  return false;
}

export type GuardResult = { ok: true; email: string } | { ok: false; response: NextResponse };

function deny(error: string, status: number): GuardResult {
  return { ok: false, response: NextResponse.json({ error }, { status }) };
}

// Mismos chequeos y mismo orden que /api/trigger: same-origin → sesión → whitelist. La
// whitelist se revalida en CADA request (una sesión JWT ya emitida sigue viva aunque se saque
// el email) y es la de la pestaña pedida, nunca "pertenece a alguna". `tabId: null` = el
// request no nombró una pestaña válida: se responde 400, pero recién después de confirmar que
// quien pregunta tiene sesión y alguna pestaña (no se deja sondear sin login).
export async function guardTabRequest(req: Request, tabId: TabId | null): Promise<GuardResult> {
  if (!isSameOrigin(req)) return deny("forbidden", 403);

  const session = await auth();
  if (!session) return deny("unauthorized", 401);

  const email = session.user?.email;
  if (!email || allowedTabsFor(email).length === 0) return deny("forbidden", 403);

  if (!tabId) return deny("bad request", 400);
  if (!canAccessTab(email, tabId)) return deny("forbidden", 403);

  return { ok: true, email };
}
