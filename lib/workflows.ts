import type { TabId } from "@/lib/tabs";

export interface WorkflowTrigger {
  id: string;
  // Pestaña donde se muestra la card. La whitelist del workflow es la de su pestaña
  // (lib/tabs.ts): /api/trigger la revalida contra ESA pestaña, no contra cualquiera.
  tab: TabId;
  label: string;
  confirmationQuestion: string;
  successMessage: string;
  // Requerido a propósito: la card la muestra bajo el label. Estos botones escriben sobre
  // Sheets, Drive y Slack reales, así que ningún workflow debería llegar al panel sin
  // explicar qué hace. Si se agrega uno sin description, no compila.
  description: string;
  env: {
    webhookUrl: string;
    webhookSecret: string;
  };
}

// Copia genérica compartida por los workflows que todavía no tienen un texto propio.
const GENERIC_CONFIRMATION = "Confirmo que quiero correr este workflow ahora.";
const GENERIC_SUCCESS =
  "Solicitud enviada. Recibirás la confirmación cuando termine.";

export const WORKFLOWS: readonly WorkflowTrigger[] = [
  {
    id: "tekton-inc",
    tab: "contabilidad",
    label: "Workflow INC",
    description:
      "Convierte el P&L contable de Tekton INC en el P&L de management: recalcula " +
      "regalías, rentings y vacaciones con el criterio que usa management, no el contable.",
    confirmationQuestion: GENERIC_CONFIRMATION,
    successMessage: GENERIC_SUCCESS,
    env: {
      webhookUrl: "N8N_TEKTON_INC_WEBHOOK_URL",
      webhookSecret: "N8N_TEKTON_INC_WEBHOOK_SECRET",
    },
  },
  {
    id: "tekton-sac",
    tab: "contabilidad",
    label: "Workflow SAC",
    description:
      "Convierte el P&L contable de Tekton SAC en el P&L de management: recalcula " +
      "regalías, rentings y vacaciones con el criterio que usa management, no el contable.",
    confirmationQuestion: GENERIC_CONFIRMATION,
    successMessage: GENERIC_SUCCESS,
    env: {
      webhookUrl: "N8N_TEKTON_SAC_WEBHOOK_URL",
      webhookSecret: "N8N_TEKTON_SAC_WEBHOOK_SECRET",
    },
  },
];
