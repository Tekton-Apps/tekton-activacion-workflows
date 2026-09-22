# Panel de Triggers — Tekton

## Qué es esto
App interna que corre manualmente workflows de n8n vía webhook, sin entrar a la UI de n8n.
NO crea ni edita workflows de n8n — eso vive en el repo separado "n8n agent builder". Este repo solo llama webhooks, nunca toca el JSON de un workflow.
v1: los workflows de Tekton ("Workflow INC" y "Workflow SAC", uno por razón social), con whitelist propia y deploy en Vercel Production (`main`). Ver `docs/adr/0003-auth-y-config-shape.md`.

## Stack
- Next.js + TypeScript, deploy en Vercel.
- Auth: Google OAuth (Auth.js / NextAuth), restringido a whitelist de emails en env var.
- Sin base de datos en v1. No agregar Supabase "por si acaso" — si no hay DB, no hay RLS que mantener, y es una superficie de ataque menos.
- Historial de ejecuciones: NO se duplica en este repo. n8n ya lo guarda. Este panel solo corre workflows, no reporta.

## Ambientes
Un solo repo. Sandbox y producción se manejan con env vars distintas por ambiente de Vercel — no repos ni deploys separados. v1 usa **Production (`main`) directamente**: los workflows de n8n no tienen sandbox del lado de los datos (siempre escriben sobre Sheets/Drive/Slack reales), así que la distinción Preview=sandbox no aísla nada todavía y se retoma cuando exista un webhook con sandbox real. Ver `docs/adr/0003-auth-y-config-shape.md`.

Cada ambiente tiene su propia URL de webhook de n8n por workflow, su propio secret, y su propia whitelist de emails. Nunca reusar ni mezclar env vars entre ambientes.

Variables por ambiente:
- `N8N_TEKTON_INC_WEBHOOK_URL` / `N8N_TEKTON_INC_WEBHOOK_SECRET`, `N8N_TEKTON_SAC_WEBHOOK_URL` / `N8N_TEKTON_SAC_WEBHOOK_SECRET` — un par por cada workflow de `lib/workflows.ts` (ver `.env.example` para la lista completa; agregar un workflow nuevo suma otro par acá)
- `TEKTON_ALLOWED_EMAILS` (lista separada por comas — ver `lib/entities.ts`)
- `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` (Auth.js v5)

## Seguridad — no negociable

**Autenticación del webhook (resuelto):** el nodo Webhook de n8n valida un header `X-Webhook-Secret` (Header Auth). El login de Google filtra quién ve el botón; el secret del header impide que alguien corra el workflow con solo tener la URL. Si la URL se filtra (logs, Slack, historial de n8n) sin el secret, no alcanza para dispararlo.

- El secret vive solo como env var server-side (`N8N_TEKTON_INC_WEBHOOK_SECRET`, `N8N_TEKTON_SAC_WEBHOOK_SECRET`). Nunca en código, nunca expuesto al cliente.
- El botón de "correr" (el trigger) llama a una API route propia de Next.js (`/api/trigger`, genérica: recibe `{ workflowId, confirmed }` y busca el workflow en `WORKFLOWS`). Esa API route es la única que conoce el secret y hace el POST a n8n. El navegador del usuario nunca ve la URL real del webhook ni el secret.

Además:
- Whitelist de emails chequeada server-side en cada request a la API route, no solo en el login inicial — y específica del workflow pedido (`/api/trigger` valida contra la whitelist de ESE workflow, no contra "pertenece a alguna whitelist en general"), para que sumar un workflow o entidad nueva con su propia whitelist no habilite cruzarse a disparar los de otro.
- Security headers estándar (CSP, X-Frame-Options, HSTS) configurados en `next.config.ts`. El CSP usa `'unsafe-inline'` en `script-src` — ver `docs/adr/0002-csp-unsafe-inline-v1.md`.
- CORS: la API route solo acepta requests del propio dominio.
- No loguear el secret del webhook, nunca. El email del usuario que dispara el workflow SÍ se loguea en texto plano en los logs de Vercel (auditoría: saber quién disparó) — los logs de Vercel no son públicos, requieren acceso al proyecto. Solo se loguean disparos exitosos, no los rechazos (v1).

## Prioridad de v1
Velocidad de shipeo esta semana. No sobre-construir para la escala que todavía no existe: nada de DB, nada de skills de diseño pesados, nada de herramientas de arquitectura para un repo de menos de 10 archivos.

## Terminología del proyecto
Ver `CONTEXT.md` — glosario del negocio (verbos, entidades, ambientes) generado con `/grill-with-docs`.

## Cuándo esto deja de ser v1 (revisar entonces, no antes)

- Se suma un tercer workflow, o una segunda entidad además de Tekton: `lib/workflows.ts` sigue siendo un array hardcodeado (cada entrada trae su propio par de env vars y su propia referencia de whitelist) y `lib/entities.ts` un registro chico (id + nombre de env var de whitelist por entidad) — evaluar recién ahí si el volumen justifica una tabla o DB. Mientras sea un puñado de workflows sin altas/bajas en runtime, no lo justifica (agregar DB dispara RLS obligatorio desde el día uno, sin contrapartida real todavía).
- Repo pasa de ~20 archivos → recién ahí vale la pena una herramienta de indexado de dependencias.
- Ambiente de producción real, más usuarios → recién ahí vale la pena invertir en pulir el diseño del dashboard y en QA automatizado de los flujos de login/whitelist/trigger antes de cada deploy.
- Pendiente, y no de código: la pantalla de consentimiento de Google OAuth está en modo Testing con lista de test users — cualquier correo nuevo necesita cargarse ahí a mano o Google lo bloquea antes de llegar a nuestra whitelist.

## `.claude/skills/` es la copia congelada — no reinstalar

`.claude/skills/*` (commiteado en este repo) es la copia de referencia y confiable de los skills de Claude Code para este proyecto. `.agents/skills/` es una copia local gitignoreada, en teoría reconstituible con `npx skills@latest add mattpocock/skills` a partir de `skills-lock.json`.

**No correr ese comando para "reconstituir" o "actualizar" skills.** Verificado el 2026-09-03: la fuente (`mattpocock/skills` en GitHub) tuvo deriva significativa desde que se generó el lockfile — 8 de los 41 skills listados ya no existen en la fuente, y de los 33 restantes, 30 traen contenido distinto al congelado acá (confirmado archivo por archivo, no solo por hash). El comando no valida ni alerta sobre nada de esto: sobreescribe `skills-lock.json` con lo que encuentre en upstream en ese momento, sin comparar contra la versión anterior ni pedir confirmación.

Si en el futuro se quiere modernizar algún skill puntual, hacerlo a mano — comparando explícitamente contra la fuente, nunca con un `add` ciego.
