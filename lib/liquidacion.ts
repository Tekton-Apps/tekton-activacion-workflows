// Validación del pedido de liquidación. Compartida: el cliente la usa para habilitar el botón y
// mostrar qué falta; /api/rh/liquidacion la usa como gate real (lista blanca de campos y tipos).
// Sin imports de servidor a propósito, para que pueda ir al bundle del cliente.

export type HuboVariables = "si" | "no" | "no_se";

export interface LiquidacionInput {
  dni: string;
  fecha_cese: string;
  motivo: string;
  hubo_variables_mes: HuboVariables;
  rem_mes_cese?: number;
  bonos_mes?: number;
  comisiones_mes?: number;
}

// `confirmed` se acepta en el body pero no viaja a n8n: lo chequea la route aparte.
const ALLOWED_KEYS = new Set([
  "dni",
  "fecha_cese",
  "motivo",
  "hubo_variables_mes",
  "rem_mes_cese",
  "bonos_mes",
  "comisiones_mes",
  "confirmed",
]);

const AMOUNT_KEYS = ["rem_mes_cese", "bonos_mes", "comisiones_mes"] as const;

const AMOUNT_LABELS: Record<(typeof AMOUNT_KEYS)[number], string> = {
  rem_mes_cese: "La remuneración total afecta del mes",
  bonos_mes: "Los bonos del mes",
  comisiones_mes: "Las comisiones del mes",
};

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  // Round-trip para rechazar fechas imposibles (2026-02-30) que el regex deja pasar.
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export type LiquidacionResult =
  | { ok: true; data: LiquidacionInput }
  | { ok: false; errores: string[] };

export function validateLiquidacion(body: unknown): LiquidacionResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, errores: ["El pedido no tiene el formato esperado."] };
  }
  const input = body as Record<string, unknown>;
  const errores: string[] = [];

  const extra = Object.keys(input).filter((key) => !ALLOWED_KEYS.has(key));
  if (extra.length > 0) {
    errores.push(`Campos no permitidos: ${extra.join(", ")}.`);
  }

  const dni = typeof input.dni === "string" ? input.dni.trim() : "";
  if (!/^\d{8,12}$/.test(dni)) {
    errores.push("Elige un trabajador con DNI válido (8 a 12 dígitos).");
  }

  const fechaCese = typeof input.fecha_cese === "string" ? input.fecha_cese : "";
  if (!isValidIsoDate(fechaCese)) {
    errores.push("Indica una fecha de cese válida.");
  }

  const motivo = typeof input.motivo === "string" ? input.motivo.trim() : "";
  if (motivo.length < 3 || motivo.length > 300) {
    errores.push("El motivo debe tener entre 3 y 300 caracteres.");
  }

  const hubo = input.hubo_variables_mes;
  if (hubo !== "si" && hubo !== "no" && hubo !== "no_se") {
    errores.push("Indica si hubo bonos, comisiones o vacaciones en el mes de cese.");
  }

  const amounts: Partial<Record<(typeof AMOUNT_KEYS)[number], number>> = {};
  for (const key of AMOUNT_KEYS) {
    const value = input[key];
    if (value === undefined || value === null) continue;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      errores.push(`${AMOUNT_LABELS[key]} debe ser un número mayor o igual a 0.`);
      continue;
    }
    amounts[key] = value;
  }

  if (
    hubo === "si" &&
    amounts.rem_mes_cese === undefined &&
    amounts.bonos_mes === undefined &&
    amounts.comisiones_mes === undefined
  ) {
    errores.push(
      "Como hubo variables en el mes, completa la remuneración total afecta o al menos los bonos o las comisiones.",
    );
  }

  if (errores.length > 0) return { ok: false, errores };

  // Payload armado desde cero: solo campos conocidos, ya normalizados. Los montos viajan
  // únicamente si hubo variables; con "no" / "no_se" se descartan aunque vengan.
  const data: LiquidacionInput = {
    dni,
    fecha_cese: fechaCese,
    motivo,
    hubo_variables_mes: hubo as HuboVariables,
    ...(hubo === "si" ? amounts : {}),
  };
  return { ok: true, data };
}
