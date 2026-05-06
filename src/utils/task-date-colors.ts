// Shared color logic for task forecast/term cells. The home dashboard widget
// and the production task preparation page both need the same urgency tiers,
// but the widget lets each instance override thresholds and color tokens.
//
// All Tailwind class strings are listed as LITERAL members of TIER_CLASS so the
// JIT compiler picks them up at build time. Don't construct class names at
// runtime — they'd be tree-shaken.

export type DeadlineColorToken =
  | "red"
  | "rose"
  | "orange"
  | "amber"
  | "yellow"
  | "lime"
  | "green"
  | "emerald"
  | "teal"
  | "cyan"
  | "sky"
  | "blue"
  | "violet"
  | "fuchsia"
  | "pink"
  | "neutral"
  | "gray";

export const DEADLINE_COLOR_TOKENS: readonly DeadlineColorToken[] = [
  "red",
  "rose",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "violet",
  "fuchsia",
  "pink",
  "neutral",
  "gray",
] as const;

export const DEADLINE_COLOR_LABELS: Record<DeadlineColorToken, string> = {
  red: "Vermelho",
  rose: "Rosa escuro",
  orange: "Laranja",
  amber: "Âmbar",
  yellow: "Amarelo",
  lime: "Verde-limão",
  green: "Verde",
  emerald: "Esmeralda",
  teal: "Teal",
  cyan: "Ciano",
  sky: "Azul céu",
  blue: "Azul",
  violet: "Violeta",
  fuchsia: "Fúcsia",
  pink: "Rosa",
  neutral: "Neutro",
  gray: "Cinza",
};

const TEXT_CLASS: Record<DeadlineColorToken, string> = {
  red: "text-red-500",
  rose: "text-rose-500",
  orange: "text-orange-500",
  amber: "text-amber-500",
  yellow: "text-yellow-500",
  lime: "text-lime-500",
  green: "text-green-500",
  emerald: "text-emerald-500",
  teal: "text-teal-500",
  cyan: "text-cyan-500",
  sky: "text-sky-500",
  blue: "text-blue-500",
  violet: "text-violet-500",
  fuchsia: "text-fuchsia-500",
  pink: "text-pink-500",
  neutral: "text-neutral-500",
  gray: "text-gray-500",
};

const SWATCH_CLASS: Record<DeadlineColorToken, string> = {
  red: "bg-red-500",
  rose: "bg-rose-500",
  orange: "bg-orange-500",
  amber: "bg-amber-500",
  yellow: "bg-yellow-500",
  lime: "bg-lime-500",
  green: "bg-green-500",
  emerald: "bg-emerald-500",
  teal: "bg-teal-500",
  cyan: "bg-cyan-500",
  sky: "bg-sky-500",
  blue: "bg-blue-500",
  violet: "bg-violet-500",
  fuchsia: "bg-fuchsia-500",
  pink: "bg-pink-500",
  neutral: "bg-neutral-500",
  gray: "bg-gray-500",
};

export function deadlineColorTextClass(token: DeadlineColorToken): string {
  return TEXT_CLASS[token] ?? "";
}

export function deadlineColorSwatchClass(token: DeadlineColorToken): string {
  return SWATCH_CLASS[token] ?? "bg-muted";
}

export interface ForecastColorConfig {
  enabled: boolean;
  criticalDays: number;
  warningDays: number;
  noticeDays: number;
  criticalColor: DeadlineColorToken;
  warningColor: DeadlineColorToken;
  noticeColor: DeadlineColorToken;
}

export interface TermColorConfig {
  enabled: boolean;
  overdueColor: DeadlineColorToken;
  criticalHours: number;
  criticalColor: DeadlineColorToken;
  onTrackColor: DeadlineColorToken;
}

export const DEFAULT_FORECAST_COLOR_CONFIG: ForecastColorConfig = {
  enabled: true,
  criticalDays: 3,
  warningDays: 7,
  noticeDays: 10,
  criticalColor: "red",
  warningColor: "orange",
  noticeColor: "yellow",
};

export const DEFAULT_TERM_COLOR_CONFIG: TermColorConfig = {
  enabled: true,
  overdueColor: "red",
  criticalHours: 4,
  criticalColor: "amber",
  onTrackColor: "green",
};

export function getForecastColorClass(
  forecastDate: Date | string | null | undefined,
  config: ForecastColorConfig = DEFAULT_FORECAST_COLOR_CONFIG,
): string {
  if (!config.enabled || !forecastDate) return "";
  const now = new Date();
  const forecast = new Date(forecastDate);
  if (Number.isNaN(forecast.getTime())) return "";

  const diffDays = Math.ceil(
    (forecast.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays <= config.criticalDays) return TEXT_CLASS[config.criticalColor];
  if (diffDays <= config.warningDays) return TEXT_CLASS[config.warningColor];
  if (diffDays <= config.noticeDays) return TEXT_CLASS[config.noticeColor];
  return "";
}

export function getTermColorClass(
  term: Date | string | null | undefined,
  config: TermColorConfig = DEFAULT_TERM_COLOR_CONFIG,
): string {
  if (!config.enabled || !term) return "";
  const now = new Date();
  const deadline = new Date(term);
  if (Number.isNaN(deadline.getTime())) return "";

  const diffMs = deadline.getTime() - now.getTime();
  if (diffMs < 0) return TEXT_CLASS[config.overdueColor];

  const hoursRemaining = diffMs / (1000 * 60 * 60);
  if (hoursRemaining <= config.criticalHours) return TEXT_CLASS[config.criticalColor];
  return TEXT_CLASS[config.onTrackColor];
}

export function isOverdue(term: Date | string | null | undefined): boolean {
  if (!term) return false;
  const deadline = new Date(term);
  if (Number.isNaN(deadline.getTime())) return false;
  return deadline.getTime() < Date.now();
}
