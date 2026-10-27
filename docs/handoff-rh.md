# Handoff — pestaña RH (liquidaciones) e historial de ejecuciones

Rama: `feat/rh-liquidaciones`. No mergear a `main` (despliega a Production en Vercel) hasta completar los pendientes de abajo.

Última actualización: 2026-10-27.

## Estado

- Implementado: ADR 0004 (`docs/adr/0004-pestanas-parametros-request-id-historial.md`), `lib/tabs.ts`, `lib/server/guard.ts`, `lib/server/n8n.ts`, routes `/api/rh/workers`, `/api/rh/liquidacion`, `/api/executions`, `request_id` en `/api/trigger`, `RhPanel`, `WorkerCombobox`, `ExecutionHistory`, UI en español neutro.
- `tsc`, `lint` y `build` pasan.
- n8n: los webhooks de RH (`N8N_TEKTON_RH_WORKERS_URL` GET, `N8N_TEKTON_RH_LIQ_URL` POST) y de ejecuciones (`N8N_TEKTON_EJECUCIONES_URL` GET) están publicados en modo Sandbox (`MODO_SANDBOX = si`: las copias van a la carpeta Sandbox y no marcan cesados). Cada uno tiene su propia credencial Header Auth: **Header RH Trabajadores**, **Header RH Liquidación**, **Header Ejecuciones**.
- Los P&L SAC e INC registran en la Data Table de ejecuciones solo en borrador. Mientras no se publiquen, el historial de contabilidad sale vacío.

## Pruebas locales aprobadas (2026-10-27)

Contra las URLs de producción de los webhooks (publicados en Sandbox), no las de prueba de n8n.

- Combobox de trabajadores (búsqueda sin tildes).
- "Generar liquidación" con 200; 422 con mensaje claro; "Sí" sin montos; "No sé".
- Historial de las dos pestañas.
- Permisos: sin el correo en `TEKTON_RH_ALLOWED_EMAILS`, la pestaña RH desaparece y `/api/rh/workers` responde 403.
- Secreto incorrecto: el usuario ve "No se pudo conectar con el sistema. Avisa a Luca." y se loguea `n8n-auth-failed` con el nombre de la env var.

## Cambios de este commit

- Correcciones a–c de la sesión anterior aplicadas:
  - Cada webhook usa su propia credencial Header Auth, nunca la de "Header SAC" (`CLAUDE.md`, `.env.example`).
  - Las pruebas locales van contra las URLs de producción de los webhooks (`.env.example`).
  - `CompanyTabs` vuelve a los estilos anteriores y conserva solo el contexto de pestaña visible.
- Secreto rechazado por n8n (401/403): `callN8n` lo detecta, las routes responden con un código propio (`lib/n8n-errors.ts`) y la UI muestra "No se pudo conectar con el sistema. Avisa a Luca." en las cards de contabilidad, el formulario de RH y el historial. `/api/trigger` pasa a usar `callN8n`.
- Historial (`components/ExecutionHistory.tsx`):
  - Se carga solo el de la pestaña visible; el de la otra, al abrirla.
  - Una sola llamada por carga, también con el doble montaje de React en dev: los pedidos en vuelo se comparten.
  - Carga en segundo plano: cambiar de pestaña nunca espera, y la carga de la pestaña que se deja se cancela.
  - "Actualizar" y "Generar" recargan sin vaciar la tabla.
  - Sin refresco automático: carga al abrir la pestaña, después de "Generar" y con "Actualizar".
- Pestaña inicial (`components/CompanyTabs.tsx`): la última usada, guardada en `localStorage` (`tekton:ultima-pestana`, con try/catch). Si no hay ninguna o ya no está permitida, se abre la primera permitida. Hasta leerla no se pide ningún historial.
- Medición en build de producción local (`npm run build && npm start`), tiempo hasta ver el historial: primera carga ~2.8–2.9 s y siguientes ~0.7 s. Casi todo es la respuesta de n8n: la primera llamada tras un rato sin uso es la lenta.

## Pendientes

1. PR de `feat/rh-liquidaciones` a `main`.
2. Env vars en Vercel (Production): `TEKTON_RH_ALLOWED_EMAILS`, `N8N_TEKTON_RH_WORKERS_URL` / `_SECRET`, `N8N_TEKTON_RH_LIQ_URL` / `_SECRET`, `N8N_TEKTON_EJECUCIONES_URL` / `_SECRET`.
3. Test users de OAuth: cargar a las personas de RH en la pantalla de consentimiento de Google (modo Testing), o Google las bloquea antes de llegar a la whitelist.
4. Publicar los P&L SAC e INC (registro en la Data Table de ejecuciones) el mismo día del deploy.

## Mejoras futuras (no implementar todavía)

- Aviso en tiempo real cuando cambia una ejecución (por ejemplo, con Supabase Realtime), en vez de recargar con "Actualizar". Hoy no hay base de datos (ver `CLAUDE.md`): sumarla implica RLS desde el primer día.
- Si la última pestaña usada es RH, al abrir la app se ve Contabilidad un instante antes de cambiar, porque el servidor no lee `localStorage`. Se evita guardando la pestaña en una cookie.

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
