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
