import React from "react";

import { SECULLUM_JUSTIFICATIVAS, TONE_CLASSES } from "../../../constants/secullum-justifications";
import { cn } from "@/lib/utils";

// Resolves a Secullum text token (FOLGA / FÉRIAS / ATESTAD / FALTA I / FERIADO / …)
// to the per-justificativa tone defined in SECULLUM_JUSTIFICATIVAS so the
// list/day-view tables match the absences calendar's color story instead of
// flatly painting every justification amber.
const ABREVIADO_TO_TONE: Record<string, keyof typeof TONE_CLASSES> = (() => {
  const map: Record<string, keyof typeof TONE_CLASSES> = {};
  for (const j of Object.values(SECULLUM_JUSTIFICATIVAS)) {
    map[j.abreviado.toUpperCase()] = j.tone;
    map[j.label.toUpperCase()] = j.tone;
  }
  // Common synonyms that don't appear verbatim in the catalog.
  map["FERIAS"] = "violet";
  map["FÉRIAS"] = "violet";
  map["FOLGA"] = "emerald";
  map["FERIADO"] = "cyan";
  map["DAY OFF"] = "emerald";
  return map;
})();

function getJustificationTone(text: string): keyof typeof TONE_CLASSES {
  return ABREVIADO_TO_TONE[text.toUpperCase()] ?? "amber";
}

// Time / justification cell — HH:MM passes through plain; anything else (FÉRIAS,
// ATESTAD, FOLGA, …) gets the per-justificativa tone color.
export function renderTimeValue(value: string | undefined | null): React.ReactNode {
  if (!value || value === "" || value === "null") {
    return <span className="text-muted-foreground">-</span>;
  }
  const trimmed = String(value).trim();
  const display = trimmed.toLowerCase().includes("day off") ? "FOLGA" : trimmed;

  if (/^\d{1,2}:\d{2}$/.test(display)) {
    return <span className="text-sm">{display}</span>;
  }

  const tone = getJustificationTone(display);
  return (
    <span
      className={cn(
        "text-xs font-semibold uppercase tracking-wide",
        TONE_CLASSES[tone].text,
      )}
    >
      {display}
    </span>
  );
}

// Aggregate hour cell (NORMAL / EX50% / DSR / …).
// `kind` controls the polarity:
//   "good"      → positive = green, negative = red  (default — for credit columns)
//   "bad"       → positive = red,   negative = red  (debit columns: FALTAS, ATRASO, ADIAN)
//   "neutral"   → no color           (e.g. AJUSTE, where sign isn't pejorative)
export function renderHourValue(
  value: string | undefined | null,
  kind: "good" | "bad" | "neutral" = "good",
): React.ReactNode {
  if (!value || value === "" || value === "null") {
    return <span className="text-muted-foreground">-</span>;
  }

  const isZero = value === "00:00" || value === "0:00";
  const isNegative = value.startsWith("-");

  let color = "text-muted-foreground";
  if (!isZero) {
    if (kind === "good") color = isNegative ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400";
    else if (kind === "bad") color = "text-red-600 dark:text-red-400";
    // neutral leaves the muted color
  }

  return <span className={cn("text-sm", color)}>{value}</span>;
}
