import { isEmailAllowed } from "@/lib/allowed-emails";

// Pestañas del panel, separadas de la entidad (Tekton es la única entidad; las pestañas son
// áreas con públicos distintos). Ver docs/adr/0004-pestanas-parametros-request-id-historial.md.
// El `content` de cada pestaña lo arma page.tsx: este registro solo decide quién la ve.
export type TabId = "contabilidad" | "rh";

export interface Tab {
  id: TabId;
  label: string;
  // Nombre de la env var de whitelist de esta pestaña. La usan page.tsx (qué se renderiza) y
  // cada API route (revalidación por request), nunca "pertenece a alguna whitelist".
  allowedEmailsEnv: string;
}

export const TABS: readonly Tab[] = [
  { id: "contabilidad", label: "Contabilidad", allowedEmailsEnv: "TEKTON_ALLOWED_EMAILS" },
  { id: "rh", label: "RH", allowedEmailsEnv: "TEKTON_RH_ALLOWED_EMAILS" },
];

export function getTab(id: TabId): Tab {
  // find(===) sobre un union cerrado: siempre existe, el throw es solo para el compilador.
  const tab = TABS.find((t) => t.id === id);
  if (!tab) throw new Error(`Pestaña desconocida: ${id}`);
  return tab;
}

export function canAccessTab(email: string | null | undefined, id: TabId): boolean {
  return isEmailAllowed(email, getTab(id).allowedEmailsEnv);
}

export function allowedTabsFor(email: string | null | undefined): TabId[] {
  return TABS.filter((tab) => isEmailAllowed(email, tab.allowedEmailsEnv)).map((tab) => tab.id);
}
