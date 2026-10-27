// Código que devuelven las API routes cuando n8n rechaza nuestro X-Webhook-Secret (401/403):
// es un error de configuración (secret o credencial Header Auth desalineados), no algo que el
// usuario pueda arreglar reintentando. Compartido entre server y cliente; sin nada secreto.
export const N8N_CONFIG_ERROR = "n8n-config";

export const N8N_CONFIG_ERROR_MESSAGE = "No se pudo conectar con el sistema. Avisa a Luca.";

export function isN8nConfigError(data: unknown): boolean {
  return (data as { error?: unknown } | null)?.error === N8N_CONFIG_ERROR;
}
