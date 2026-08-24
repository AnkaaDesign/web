import { TRUCK_MANUFACTURER_LABELS } from "../constants";
import { TRUCK_MANUFACTURER } from "../constants";

/**
 * Get human-readable label for truck manufacturer
 */
export function getTruckManufacturerLabel(manufacturer: TRUCK_MANUFACTURER): string {
  return TRUCK_MANUFACTURER_LABELS[manufacturer] || manufacturer;
}

/**
 * Format truck spot to full descriptive format
 * @param spot - Truck spot value (e.g., "B1_F2_V3")
 * @returns Formatted string (e.g., "Barracão 1 - Faixa 2 - Vaga 3")
 */
export function formatTruckSpot(spot: string | null | undefined): string {
  if (!spot) return "-";

  if (spot === "YARD_WAIT") return "Pátio de Espera";
  if (spot === "YARD_EXIT") return "Pátio de Saída";

  // Parse the spot format: B{garage}_F{lane}_V{spot}
  const match = spot.match(/^B(\d+)_F(\d+)_V(\d+)$/);

  if (!match) {
    // If format doesn't match, return the original value with underscores replaced by dashes
    return spot.replace(/_/g, "-");
  }

  const [, garage, lane, vaga] = match;
  return `Barracão ${garage} - Faixa ${lane} - Vaga ${vaga}`;
}

// =====================================================================
// Placa e chassi — fonte única de verdade (espelho de api/src/utils/truck.ts)
// =====================================================================
// Placa antiga:   AAA9999 → exibida ABC-1234 (com hífen)
// Placa Mercosul: AAA9A99 → exibida ABC1D23  (sem hífen)
// Os dois padrões só divergem na 5ª posição. A limpeza mora em
// `utils/cleaners.ts` (`cleanPlate`/`cleanChassis`) e a exibição em
// `utils/formatters.ts` (`formatPlate`/`formatChassis`).

export const PLATE_OLD_REGEX = /^[A-Z]{3}[0-9]{4}$/;
export const PLATE_MERCOSUL_REGEX = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;
/** União exata dos dois formatos brasileiros. */
export const PLATE_REGEX = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

/**
 * Máscara POSICIONAL da placa. Validar a regex inteira a cada tecla travaria o
 * campo no 4º caractere; aqui cada posição tem seu alfabeto e os dois padrões
 * convivem sem ramificar — "antiga ou Mercosul" só se decide quando o 5º
 * caractere chega.
 */
export const PLATE_MASK: RegExp[] = [/[A-Z]/, /[A-Z]/, /[A-Z]/, /[0-9]/, /[A-Z0-9]/, /[0-9]/, /[0-9]/];

export const PLATE_LENGTH = 7;
export const CHASSIS_LENGTH = 17;

/**
 * VIN conforme ISO 3779: 17 caracteres, alfabeto sem I, O nem Q — a norma as
 * proíbe justamente porque se confundem com 1 e 0. Os 3 registros legados que
 * violavam isso eram erro de digitação e foram corrigidos em 24/08 (`O`→`0` em
 * `94BF1543LLR041427`, `I`→`1` em `9A9CFF253T1DV8848`), provados pelos irmãos
 * de série na própria base — 68 dos 69 chassis `9A9CFF` têm `1` na 11ª posição.
 */
export const CHASSIS_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/;
/** Só o tamanho/alfabeto amplo — usado para separar as duas mensagens de erro. */
export const CHASSIS_LENGTH_REGEX = /^[A-Z0-9]{17}$/;
/** Letras que a ISO 3779 proíbe no VIN. */
export const CHASSIS_FORBIDDEN_LETTERS = /[IOQ]/;

export const PLATE_INVALID_MESSAGE = "Formato de placa inválido (ex: ABC-1234 ou ABC1D23)";
export const CHASSIS_INVALID_MESSAGE = "Número do chassi deve ter exatamente 17 caracteres alfanuméricos";
export const CHASSIS_FORBIDDEN_LETTERS_MESSAGE =
  "Número do chassi não pode conter as letras I, O ou Q — confira se são os dígitos 1 ou 0";

/**
 * Aplica a máscara posicional, descartando o caractere que não cabe na posição.
 * Use na DIGITAÇÃO; `cleanPlate` basta para um valor que já veio pronto.
 */
export function maskPlateInput(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .split("")
    .filter((char, index) => index < PLATE_LENGTH && PLATE_MASK[index].test(char))
    .join("");
}

export function isValidPlate(value: string | null | undefined): boolean {
  if (typeof value !== "string") return false;
  return PLATE_REGEX.test(value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
}

export function isValidChassis(value: string | null | undefined): boolean {
  if (typeof value !== "string") return false;
  return CHASSIS_REGEX.test(value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
}
