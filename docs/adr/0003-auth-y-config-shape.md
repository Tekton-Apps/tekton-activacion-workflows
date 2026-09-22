# Auth.js v5, config por-entidad, y Production directo en v1

Cuatro decisiones tomadas al construir la app de v1, pensadas para no bloquear que se sumen más workflows o entidades después sin tener que rediseñar la estructura:

- **Auth.js v5 (`next-auth`), sin adapter ni base de datos.** Estrategia JWT default + un callback `signIn` que valida el email contra la whitelist. Un solo `auth()` reusable en Server Components y en la API route. El riesgo de "modo mantenimiento" del ecosistema v5 es sobre todo por adapters de DB — al no usar ninguno, no aplica. Implica los nombres de env var `AUTH_SECRET` / `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.
- **Shape de workflows por-entidad desde el día uno.** Cada entrada del array `WORKFLOWS` (`lib/workflows.ts`) trae su propia env var de whitelist (`env.allowedEmails`), aunque hoy solo exista Tekton. Sumar un workflow o entidad nueva es agregar un objeto + env vars nuevas, no rediseñar el tipo.
- **`TEKTON_ALLOWED_EMAILS`, no `ALLOWED_EMAILS`.** Nombre por-entidad desde el principio, no un placeholder global — fijarlo por-entidad ahora cuesta lo mismo y evita un rename cuando se sume una segunda entidad.
- **v1 deploya a Vercel Production (`main`), no a Preview=sandbox.** Los workflows de n8n no tienen sandbox del lado de los datos (siempre escriben sobre Sheets/Drive/Slack reales), así que la separación Preview=sandbox que plantea CLAUDE.md no aísla nada todavía.

## Consequences

La separación de ambientes (Preview=sandbox vs Production) se retoma cuando exista un webhook con sandbox real que sí la necesite. El shape por-entidad y el nombre de whitelist ya están preparados para ese salto; la estrategia de ambientes y el eventual nonce del CSP (ver `0002-csp-unsafe-inline-v1.md`) son lo que quedará por resolver entonces.
