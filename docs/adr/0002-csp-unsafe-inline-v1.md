# CSP usa 'unsafe-inline' en script-src, no nonce por request

El CSP original (`script-src 'self'`) bloqueaba los scripts inline que Next.js necesita para hidratar la app — rompía toda interacción (checkbox, botón) tanto en dev como, muy probablemente, en producción (el streaming de RSC también inyecta scripts inline). Las dos alternativas reales eran un nonce por request (correcto, pero requiere agregar `middleware.ts`, revirtiendo esa decisión del plan de v1) o `'unsafe-inline'` en `script-src` (más simple, pero permite ejecutar cualquier script inline inyectado). Se eligió `'unsafe-inline'`: v1 no tiene ninguna superficie real de inyección (sin inputs de usuario reflejados en la página, acceso restringido a 2 personas por whitelist), así que el costo de `middleware.ts` no se justifica todavía.

## Consequences

Revisar esta decisión si se agregan inputs de usuario que se reflejen en la página, o si el panel crece a más entidades/usuarios — en ese momento el costo de un nonce por request probablemente sí se justifica.
