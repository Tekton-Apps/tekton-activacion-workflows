# Panel de Triggers

Panel interno de Tekton para correr workflows de n8n manualmente vía webhook, sin entrar a la UI de n8n.

## Language

**Correr (un workflow)**:
Acción de ejecutar un workflow de n8n desde el panel, vía webhook.
_Avoid_: Disparar, ejecutar, lanzar

**Trigger**:
El botón/acción del panel que corre un workflow. Se usa en inglés, sin traducir.
_Avoid_: Disparador, gatillo, activador

**request_id**:
Identificador único (UUID) que el servidor del panel asigna a cada disparo y envía a n8n. Cruza el disparo con su fila en el historial y con los logs de Vercel.

**Historial**:
Lista de ejecuciones de un área (estado, resumen, alertas, link a Drive), leída en vivo desde n8n. El panel no guarda copia.

### Organización

**Tekton**:
La entidad dueña del panel. Es la única entidad; adentro se divide en pestañas.

**Pestaña**:
Área del panel con su propio público y su propia whitelist (`lib/tabs.ts`). Nadie ve una pestaña que no le corresponde. No es lo mismo que una entidad.

**Contabilidad**:
Pestaña con los workflows de P&L. Cada razón social (INC, SAC) tiene su propio workflow y su propia card.

**RH**:
Pestaña de Recursos Humanos para generar liquidaciones de trabajadores cesados.

**Liquidación**:
Cálculo de beneficios sociales de un trabajador que cesa. Se pide desde la pestaña RH con DNI, fecha de cese, motivo y variables del mes; n8n la genera y avisa por correo.

### Workflows

**Workflow INC**:
Convierte el P&L contable de Tekton INC en el P&L de management: recalcula regalías, rentings y vacaciones con el criterio que usa management, no el contable.

**Workflow SAC**:
Lo mismo que Workflow INC, para la razón social Tekton SAC.

### Ambientes

**Sandbox**:
Ambiente donde se corren los workflows con datos que imitan documentos reales, para validar que el workflow y el código funcionan antes de pasarlo a producción. No tiene efecto sobre datos reales del negocio.

**Producción**:
Ambiente donde corren los workflows ya validados en sandbox, con datos y efectos reales sobre el negocio. Un workflow pasa de sandbox a producción una vez que se comprobó que funciona bien.

## Convención de idioma de la UI

Todo texto visible en la app va en **español neutro con tuteo, sin voseo**: "Prueba de nuevo", "avisa en el canal", "Elige un trabajador", "Te llegará un correo" — nunca "Probá", "avisá", "Elegí", "Corré". Preferir "aquí" sobre "acá" en textos visibles. Los comentarios de código pueden seguir en el registro habitual del equipo; la convención aplica a lo que lee el usuario final (incluye mensajes de error y los `errores[]` que devuelve el servidor). Los mensajes que vienen de n8n se muestran tal cual llegan.
