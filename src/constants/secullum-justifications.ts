// Secullum justification (Justificativa) catalog and category mapping.
//
// Secullum stores all off-work records (vacation, sick leave, falta, dispensa,
// training, etc.) in a single FuncionariosAfastamentos table, distinguished
// only by JustificativaId. Our app exposes two distinct user-facing pages —
// "Ausências" (planned) and "Faltas" (unplanned) — by partitioning the
// JustificativaId space below. Re-categorization is a one-line edit.
//
// JustificativaIds are sourced from GET /Justificativas?filtro=1 (see absence.har).

export type SecullumJustificativaCategory = "AUSENCIA" | "FALTA";

export interface SecullumJustificativaMeta {
  id: number;
  abreviado: string;
  label: string;
  category: SecullumJustificativaCategory;
  // Tailwind text/badge tone, used by both list pages and the calendar tooltip.
  tone:
    | "violet"
    | "blue"
    | "emerald"
    | "amber"
    | "red"
    | "orange"
    | "slate"
    | "cyan"
    | "pink"
    | "indigo";
  // Tabler icon name string (resolved via tabler-icons-mapping).
  icon: string;
}

export const SECULLUM_JUSTIFICATIVAS: Record<number, SecullumJustificativaMeta> = {
  1: { id: 1, abreviado: "ATESTAD", label: "Atestado Médico", category: "FALTA", tone: "amber", icon: "stethoscope" },
  2: { id: 2, abreviado: "FÉRIAS", label: "Férias", category: "AUSENCIA", tone: "violet", icon: "beach" },
  3: { id: 3, abreviado: "FALTA I", label: "Falta sem Justificativa", category: "FALTA", tone: "red", icon: "userX" },
  4: { id: 4, abreviado: "ESQUECE", label: "Esquecimento de Marcação", category: "FALTA", tone: "orange", icon: "clockX" },
  5: { id: 5, abreviado: "Declarç", label: "Declaração", category: "AUSENCIA", tone: "slate", icon: "fileDescription" },
  6: { id: 6, abreviado: "Treinam", label: "Treinamento", category: "AUSENCIA", tone: "cyan", icon: "school" },
  7: { id: 7, abreviado: "Cadastr", label: "Cadastro", category: "AUSENCIA", tone: "indigo", icon: "userPlus" },
  8: { id: 8, abreviado: "folga", label: "Folga", category: "AUSENCIA", tone: "emerald", icon: "calendarOff" },
  9: { id: 9, abreviado: "LIC PAT", label: "Licença Maternidade/Paternidade", category: "AUSENCIA", tone: "pink", icon: "babyCarriage" },
  10: { id: 10, abreviado: "Dispens", label: "Dispensa", category: "AUSENCIA", tone: "blue", icon: "doorExit" },
  11: { id: 11, abreviado: "AT OBTO", label: "Atestado por Óbito", category: "FALTA", tone: "slate", icon: "heart" },
  12: { id: 12, abreviado: "Compens", label: "Compensação", category: "AUSENCIA", tone: "emerald", icon: "arrowsRightLeft" },
  13: { id: 13, abreviado: "FALTA 2", label: "Falta com Justificativa", category: "FALTA", tone: "red", icon: "userX" },
};

export const AUSENCIA_JUSTIFICATIVA_IDS = Object.values(SECULLUM_JUSTIFICATIVAS)
  .filter((j) => j.category === "AUSENCIA")
  .map((j) => j.id);

export const FALTA_JUSTIFICATIVA_IDS = Object.values(SECULLUM_JUSTIFICATIVAS)
  .filter((j) => j.category === "FALTA")
  .map((j) => j.id);

export const getJustificativaMeta = (id: number): SecullumJustificativaMeta | undefined =>
  SECULLUM_JUSTIFICATIVAS[id];

export const getJustificativaCategory = (id: number): SecullumJustificativaCategory | null =>
  SECULLUM_JUSTIFICATIVAS[id]?.category ?? null;

export const getJustificativaLabel = (id: number, fallbackDescricao?: string): string =>
  SECULLUM_JUSTIFICATIVAS[id]?.label ?? fallbackDescricao ?? `#${id}`;

// Tone → Tailwind class tuple. Used for Badge backgrounds, calendar corner-flag
// fill, and tooltip dot color. Keys MUST match the `tone` values above.
export const TONE_CLASSES: Record<
  SecullumJustificativaMeta["tone"],
  { bg: string; text: string; ring: string; corner: string }
> = {
  violet: { bg: "bg-violet-100 dark:bg-violet-900/20", text: "text-violet-700 dark:text-violet-300", ring: "ring-violet-500", corner: "border-t-violet-500" },
  blue: { bg: "bg-blue-100 dark:bg-blue-900/20", text: "text-blue-700 dark:text-blue-300", ring: "ring-blue-500", corner: "border-t-blue-500" },
  emerald: { bg: "bg-emerald-100 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-300", ring: "ring-emerald-500", corner: "border-t-emerald-500" },
  amber: { bg: "bg-amber-100 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-300", ring: "ring-amber-500", corner: "border-t-amber-500" },
  red: { bg: "bg-red-100 dark:bg-red-900/20", text: "text-red-700 dark:text-red-300", ring: "ring-red-500", corner: "border-t-red-500" },
  orange: { bg: "bg-orange-100 dark:bg-orange-900/20", text: "text-orange-700 dark:text-orange-300", ring: "ring-orange-500", corner: "border-t-orange-500" },
  slate: { bg: "bg-slate-100 dark:bg-slate-900/20", text: "text-slate-700 dark:text-slate-300", ring: "ring-slate-500", corner: "border-t-slate-500" },
  cyan: { bg: "bg-cyan-100 dark:bg-cyan-900/20", text: "text-cyan-700 dark:text-cyan-300", ring: "ring-cyan-500", corner: "border-t-cyan-500" },
  pink: { bg: "bg-pink-100 dark:bg-pink-900/20", text: "text-pink-700 dark:text-pink-300", ring: "ring-pink-500", corner: "border-t-pink-500" },
  indigo: { bg: "bg-indigo-100 dark:bg-indigo-900/20", text: "text-indigo-700 dark:text-indigo-300", ring: "ring-indigo-500", corner: "border-t-indigo-500" },
};

// Aggregate category-level tone for the calendar corner-flag when a single day
// has multiple absences of mixed types.
export const CATEGORY_TONE: Record<SecullumJustificativaCategory, "violet" | "red"> = {
  AUSENCIA: "violet",
  FALTA: "red",
};
