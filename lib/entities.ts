import { isEmailAllowed } from "@/lib/allowed-emails";

export type EntityId = "tekton";

export interface Entity {
  id: EntityId;
  label: string;
  // Nombre de la env var de whitelist para esta entidad — misma que usan sus workflows
  // en WORKFLOWS (lib/workflows.ts).
  allowedEmailsEnv: string;
}

export const ENTITIES: readonly Entity[] = [
  { id: "tekton", label: "Tekton", allowedEmailsEnv: "TEKTON_ALLOWED_EMAILS" },
];

export function allowedEntitiesFor(email: string | null | undefined): EntityId[] {
  return ENTITIES.filter((entity) => isEmailAllowed(email, entity.allowedEmailsEnv)).map(
    (entity) => entity.id,
  );
}
