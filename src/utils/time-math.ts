/**
 * Time arithmetic utilities for the Calculadora de Horas tool.
 *
 * All values are kept in MINUTES internally. Negative totals are allowed
 * (the operator carries the sign for inputs; results may go negative).
 *
 * Inputs accepted by the parser:
 *   - "HH:MM"   e.g. "08:30"
 *   - "H:MM"    e.g. "8:30"
 *   - "HHMM"    e.g. "0830" (4 digits, no separator)
 *   - Surrounding whitespace is trimmed.
 *   - Hours may exceed 24 (e.g. "25:30" = 1530 minutes) since these are durations.
 *
 * Inputs rejected (return null):
 *   - Empty string after trim
 *   - Non-numeric characters other than the single ":" separator
 *   - Minutes >= 60
 *   - Negative inputs (sign comes from operator)
 */

export type TimeOperation = { operator: "+" | "-"; minutes: number };

/**
 * Parse a HH:MM-style string into total minutes.
 * Returns null on invalid input.
 */
export function parseHHMM(input: string): number | null {
  if (input === null || input === undefined) return null;
  const raw = String(input).trim();
  if (raw.length === 0) return null;

  // Reject explicit signs — sign comes from the operator, not the value.
  if (raw.startsWith("-") || raw.startsWith("+")) return null;

  let hoursStr: string;
  let minutesStr: string;

  if (raw.includes(":")) {
    const parts = raw.split(":");
    if (parts.length !== 2) return null;
    hoursStr = parts[0];
    minutesStr = parts[1];
    if (hoursStr.length === 0 || minutesStr.length === 0) return null;
    if (minutesStr.length > 2) return null;
  } else {
    // Bare digits — must be exactly 4 digits (HHMM) to disambiguate.
    if (!/^\d{4}$/.test(raw)) return null;
    hoursStr = raw.slice(0, 2);
    minutesStr = raw.slice(2);
  }

  if (!/^\d+$/.test(hoursStr) || !/^\d+$/.test(minutesStr)) return null;

  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (minutes >= 60) return null;
  if (hours < 0 || minutes < 0) return null;

  return hours * 60 + minutes;
}

/**
 * Break a (possibly negative) total in minutes into a presentation object.
 *
 * `display` is always "HH:MM" with the time-of-day portion (mod 24h) when there
 * are positive day rollovers; otherwise it shows the absolute hours/minutes.
 * The `days` value carries any positive overflow days (negative results report
 * `days = 0` and the consumer should rely on the sign).
 */
export function formatHHMM(totalMinutes: number): {
  sign: "+" | "-";
  hours: string;
  minutes: string;
  days: number;
  display: string;
} {
  const safe = Number.isFinite(totalMinutes) ? Math.trunc(totalMinutes) : 0;
  const sign: "+" | "-" = safe < 0 ? "-" : "+";
  const abs = Math.abs(safe);

  if (sign === "+") {
    const days = Math.floor(abs / (24 * 60));
    const remainder = abs - days * 24 * 60;
    const hours = Math.floor(remainder / 60);
    const minutes = remainder % 60;
    const hh = String(hours).padStart(2, "0");
    const mm = String(minutes).padStart(2, "0");
    return { sign, hours: hh, minutes: mm, days, display: `${hh}:${mm}` };
  }

  // Negative results — show absolute hours/minutes (no day wrap, since
  // negative durations don't naturally roll into "previous day" semantics
  // for ad-hoc arithmetic).
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  return { sign, hours: hh, minutes: mm, days: 0, display: `${hh}:${mm}` };
}

/**
 * Sum a list of operations, optionally starting from `initial` minutes.
 * `null` initial is treated as 0 (pure duration sum).
 */
export function sumOperations(
  initial: number | null,
  ops: ReadonlyArray<TimeOperation>,
): number {
  let total = initial ?? 0;
  for (const op of ops) {
    if (!Number.isFinite(op.minutes)) continue;
    total += op.operator === "-" ? -op.minutes : op.minutes;
  }
  return total;
}

/**
 * Convert minutes into decimal hours (e.g. 825 -> 13.75).
 */
export function minutesToDecimalHours(totalMinutes: number): number {
  if (!Number.isFinite(totalMinutes)) return 0;
  return totalMinutes / 60;
}

/**
 * Format minutes as "HH:MM", preserving overflow hours (no day wrap).
 * Examples: 1500 -> "25:00", -90 -> "-01:30", 0 -> "00:00".
 *
 * Used by the calculator to display results that may exceed 24h, matching
 * the reference UX where "25:00" is shown directly rather than "01:00 (+1d)".
 */
export function formatMinutesAsHHMM(totalMinutes: number): string {
  const safe = Number.isFinite(totalMinutes) ? Math.trunc(totalMinutes) : 0;
  const sign = safe < 0 ? "-" : "";
  const abs = Math.abs(safe);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}

// ============================================================================
// Calculator expression evaluator
// ============================================================================

type Operator = "+" | "-" | "*" | "/";

type Token =
  | { kind: "num"; value: number } // value is in minutes (or scalar — context-dependent)
  | { kind: "op"; op: Operator };

/**
 * Tokenize a calculator input string.
 *
 * Rules:
 *   - Digits accumulate into a number-token until a non-digit/non-colon char.
 *   - A colon `:` inside a digit run elevates that token to a TIME literal.
 *     The number before the colon is hours, after is minutes.
 *   - Operators `+ - * /` end the current token.
 *   - Whitespace is ignored.
 *
 * Returns null if the input contains an unrecognized character or a malformed
 * time literal (e.g. multiple colons, minutes >= 60, missing minutes part).
 */
function tokenize(input: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  const len = input.length;

  while (i < len) {
    const ch = input[i];

    if (ch === " " || ch === "\t" || ch === "\n") {
      i++;
      continue;
    }

    if (ch === "+" || ch === "-" || ch === "*" || ch === "/") {
      tokens.push({ kind: "op", op: ch });
      i++;
      continue;
    }

    if (/[0-9:]/.test(ch)) {
      // Consume the run of digits + at most one colon.
      let start = i;
      let hasColon = false;
      while (i < len && /[0-9:]/.test(input[i])) {
        if (input[i] === ":") {
          if (hasColon) return null; // two colons in one number — malformed
          hasColon = true;
        }
        i++;
      }
      const slice = input.slice(start, i);

      if (hasColon) {
        const parts = slice.split(":");
        if (parts.length !== 2) return null;
        const [hStr, mStr] = parts;
        if (hStr.length === 0 || mStr.length === 0) return null;
        const hours = Number(hStr);
        const minutes = Number(mStr);
        if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
        if (minutes >= 60) return null;
        if (hours < 0 || minutes < 0) return null;
        tokens.push({ kind: "num", value: hours * 60 + minutes });
      } else {
        if (slice.length === 0) return null;
        const n = Number(slice);
        if (!Number.isFinite(n)) return null;
        // Pure number (no colon) → treated as MINUTES scalar.
        tokens.push({ kind: "num", value: n });
      }
      continue;
    }

    // Unrecognized character.
    return null;
  }

  return tokens;
}

export type EvaluateResult =
  | { ok: true; minutes: number }
  | { ok: false; error: string };

/**
 * Evaluate a calculator expression string and return the result in minutes.
 *
 * Semantics (left-to-right, equal precedence — simple-calculator style, NOT BODMAS):
 *   - `+` / `-`: add/subtract minute values.
 *   - `*`: multiply (RHS is treated as a scalar; even if RHS contains a colon,
 *          its evaluated minute value is used as the scalar multiplier).
 *   - `/`: divide; division by zero returns an error.
 *
 * Empty input returns 0 minutes. Trailing/dangling operators are an error.
 */
export function evaluateTimeExpression(input: string): EvaluateResult {
  const trimmed = String(input ?? "").trim();
  if (trimmed.length === 0) {
    return { ok: true, minutes: 0 };
  }

  const tokens = tokenize(trimmed);
  if (tokens === null) {
    return { ok: false, error: "Sintaxe inválida" };
  }
  if (tokens.length === 0) {
    return { ok: true, minutes: 0 };
  }

  // First token must be a number (no leading operator support — keep it simple).
  if (tokens[0].kind !== "num") {
    return { ok: false, error: "Expressão começa com operador" };
  }

  let acc = (tokens[0] as { kind: "num"; value: number }).value;
  let i = 1;

  while (i < tokens.length) {
    const opTok = tokens[i];
    if (opTok.kind !== "op") {
      // Two numbers in a row — malformed.
      return { ok: false, error: "Operandos consecutivos" };
    }
    const numTok = tokens[i + 1];
    if (!numTok || numTok.kind !== "num") {
      // Dangling operator or two operators in a row.
      return { ok: false, error: "Operador sem operando" };
    }

    const rhs = numTok.value;
    switch (opTok.op) {
      case "+":
        acc = acc + rhs;
        break;
      case "-":
        acc = acc - rhs;
        break;
      case "*":
        acc = acc * rhs;
        break;
      case "/":
        if (rhs === 0) {
          return { ok: false, error: "Divisão por zero" };
        }
        acc = acc / rhs;
        break;
    }

    i += 2;
  }

  if (!Number.isFinite(acc)) {
    return { ok: false, error: "Resultado inválido" };
  }

  // Round to nearest whole minute — calculator works in integer minutes.
  return { ok: true, minutes: Math.round(acc) };
}
