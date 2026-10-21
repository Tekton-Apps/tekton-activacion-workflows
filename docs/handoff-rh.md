# Handoff — pestaña RH (liquidaciones) e historial de ejecuciones

Rama: `feat/rh-liquidaciones`. No mergear a `main` (despliega a Production en Vercel) hasta completar los pasos siguientes.

## Estado

- Lo implementado: ADR 0004 (`docs/adr/0004-pestanas-parametros-request-id-historial.md`), `lib/tabs.ts`, `lib/server/guard.ts`, `lib/server/n8n.ts`, routes `/api/rh/workers`, `/api/rh/liquidacion`, `/api/executions`, `request_id` en `/api/trigger`, `RhPanel`, `WorkerCombobox`, `ExecutionHistory`, UI en español neutro. `tsc`, `lint` y `build` pasan. **Sin probar en navegador.**
- n8n: los webhooks de `N8N_TEKTON_RH_WORKERS_URL` (GET), `N8N_TEKTON_EJECUCIONES_URL` (GET) y `N8N_TEKTON_RH_LIQ_URL` (POST, workflow "Generar liquidación") existen pero aún no están publicados. Se publicarán en modo Sandbox (`MODO_SANDBOX = si`: las copias van a la carpeta Sandbox y no marcan cesados), con una credencial header auth propia cada uno: **Header RH Trabajadores**, **Header RH Liquidación**, **Header Ejecuciones**.
- Los P&L SAC e INC ya registran en la Data Table de ejecuciones solo en borrador. Luca los publica el mismo día del deploy de la app; mientras tanto, el historial de contabilidad sale vacío.

## Correcciones pendientes (hacer primero en la próxima sesión)

a) Nunca reutilizar el secreto de "Header SAC" para webhooks de RH o de ejecuciones. Corregir la tabla de env vars y cualquier doc o comentario que lo sugiera.

b) La guía de pruebas locales va contra las URLs de producción de los webhooks (publicados en Sandbox), no contra las URLs de prueba (test) de n8n.

c) Revertir el cambio de estilos de `components/CompanyTabs.tsx` (de claro a oscuro), que no se pidió. Conservar solo el contexto de pestaña visible (`TabActiveContext` / `useTabActive`).

## Cómo retomar en otra computadora

- `git fetch && git checkout feat/rh-liquidaciones && npm install`.
- Crear `.env.local` a mano (ver `.env.example`; solo nombres, nunca commitear valores):
  - `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
  - `TEKTON_ALLOWED_EMAILS` (whitelist de contabilidad)
  - `TEKTON_RH_ALLOWED_EMAILS`
  - `N8N_TEKTON_RH_WORKERS_URL`, `N8N_TEKTON_RH_WORKERS_SECRET`
  - `N8N_TEKTON_RH_LIQ_URL`, `N8N_TEKTON_RH_LIQ_SECRET`
  - `N8N_TEKTON_EJECUCIONES_URL`, `N8N_TEKTON_EJECUCIONES_SECRET`
  - `N8N_TEKTON_INC_WEBHOOK_URL`, `N8N_TEKTON_INC_WEBHOOK_SECRET`
  - `N8N_TEKTON_SAC_WEBHOOK_URL`, `N8N_TEKTON_SAC_WEBHOOK_SECRET`
- Redirect URI local: `http://localhost:3000/api/auth/callback/google` en el OAuth client de Google.

## Pasos siguientes

1. Aplicar las correcciones a–c.
2. Cuando Luca confirme que los webhooks están publicados en Sandbox, probar en local: combobox (búsqueda sin tildes), Generar con 200, 422 y "Sí" sin montos, historial de las dos pestañas y permisos (403 sin whitelist).
3. Recién después: PR a `main`, env vars en Vercel (Production) y test users de OAuth para las personas de RH (ver TEKTON_RH_ALLOWED_EMAILS en Vercel).
