# Panel de Triggers

Panel interno de Tekton para correr workflows de n8n manualmente vía webhook, sin entrar a la UI de n8n.

## Language

**Correr (un workflow)**:
Acción de ejecutar un workflow de n8n desde el panel, vía webhook.
_Avoid_: Disparar, ejecutar, lanzar

**Trigger**:
El botón/acción del panel que corre un workflow. Se usa en inglés, sin traducir.
_Avoid_: Disparador, gatillo, activador

### Organización

**Tekton**:
La entidad dueña del panel. Cada razón social (INC, SAC) tiene su propio workflow y su propia card.

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
