// Secullum justification (Justificativa) catalog and category mapping.
//
// Secullum stores all off-work records (vacation, sick leave, falta, dispensa,
// training, etc.) in a single FuncionariosAfastamentos table, distinguished
// only by JustificativaId.
//
// TWO INDEPENDENT AXES live here — do not conflate them:
//
//   `category`  AUSENCIA = scheduled leave the employee was never expected to
//               work (férias, folga, dispensa, treinamento…)
//               FALTA    = a scheduled workday the employee missed (atestado,
//               esquecimento de marcação, falta).
//               This is the axis the HR calendars colour/count by.
//
//   `justified` whether the missed time is backed by a justification. Only
//               "Falta sem Justificativa" (id 3) is unjustified — every other
//               id only ever reaches us attached to a real afastamento record.
//
// An Atestado Médico is category FALTA (a missed workday) but justified=true.
// Filtering "absences with a justification" MUST use `justified`, never
// `category` — using `category` silently hides every atestado/óbito, which is
// exactly the bug the Ausências page had.
//
// JustificativaIds/names verified live against GET /Justificativas?filtro=1.
// The static table below is the OFFLINE FALLBACK for presentation (tone/icon)
// plus a label; at runtime `mergeJustificativaCatalog()` overlays the live
// Secullum names so codes added in Secullum never go missing here.

export type SecullumJustificativaCategory = "AUSENCIA" | "FALTA";

// JustificativaId for "Férias" (vacation). The vacations page hardcodes this
// when creating records; the calendar uses it to detect collective bars.
export const VACATION_JUSTIFICATIVA_ID = 2;

// JustificativaId Secullum uses for a plain unjustified absence. `getAbsenceDays`
// on the API also stamps this id on days it derives from /Calculos that have no
// matching afastamento, so it doubles as "no justification on record".
export const UNJUSTIFIED_JUSTIFICATIVA_ID = 3;

export interface SecullumJustificativaMeta {
  id: number;
  abreviado: string;
  label: string;
  category: SecullumJustificativaCategory;
  // False only for "Falta sem Justificativa" — see the two-axis note above.
  justified: boolean;
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

// `abreviado` mirrors Secullum's NomeAbreviado exactly — the time-card cell
// dropdown writes that string into Entrada1..Saida5, so it must not drift.
export const SECULLUM_JUSTIFICATIVAS: Record<number, SecullumJustificativaMeta> = {
  1: { id: 1, abreviado: "ATEST", label: "Atestado Médico", category: "FALTA", justified: true, tone: "amber", icon: "stethoscope" },
  2: { id: 2, abreviado: "FÉRIAS", label: "Férias", category: "AUSENCIA", justified: true, tone: "violet", icon: "beach" },
  3: { id: 3, abreviado: "FALTA I", label: "Falta sem Justificativa", category: "FALTA", justified: false, tone: "red", icon: "userX" },
  4: { id: 4, abreviado: "ESQ", label: "Esquecimento de Marcação", category: "FALTA", justified: true, tone: "orange", icon: "clockX" },
  5: { id: 5, abreviado: "DECL", label: "Declaração", category: "AUSENCIA", justified: true, tone: "slate", icon: "fileDescription" },
  6: { id: 6, abreviado: "TREIN", label: "Treinamento", category: "AUSENCIA", justified: true, tone: "cyan", icon: "school" },
  7: { id: 7, abreviado: "Cadastr", label: "Cadastro", category: "AUSENCIA", justified: true, tone: "indigo", icon: "userPlus" },
  8: { id: 8, abreviado: "FOLGA", label: "Folga", category: "AUSENCIA", justified: true, tone: "emerald", icon: "calendarOff" },
  9: { id: 9, abreviado: "LIC PAT", label: "Licença Maternidade/Paternidade", category: "AUSENCIA", justified: true, tone: "pink", icon: "babyCarriage" },
  10: { id: 10, abreviado: "DISP", label: "Dispensa", category: "AUSENCIA", justified: true, tone: "blue", icon: "doorExit" },
  11: { id: 11, abreviado: "AT OBTO", label: "Atestado de Óbito", category: "FALTA", justified: true, tone: "slate", icon: "heart" },
  12: { id: 12, abreviado: "COMPENS", label: "Compensado", category: "AUSENCIA", justified: true, tone: "emerald", icon: "arrowsRightLeft" },
  13: { id: 13, abreviado: "FALTA 2", label: "Falta com Justificativa", category: "FALTA", justified: true, tone: "red", icon: "userX" },
};

export const AUSENCIA_JUSTIFICATIVA_IDS = Object.values(SECULLUM_JUSTIFICATIVAS)
  .filter((j) => j.category === "AUSENCIA")
  .map((j) => j.id);

export const FALTA_JUSTIFICATIVA_IDS = Object.values(SECULLUM_JUSTIFICATIVAS)
  .filter((j) => j.category === "FALTA")
  .map((j) => j.id);

export const getJustificativaMeta = (id: number): SecullumJustificativaMeta | undefined =>
  SECULLUM_JUSTIFICATIVAS[id];

// Unknown ids default to AUSENCIA: a code we don't know can only reach us
// attached to a real afastamento (Secullum never invents one), so treating it
// as scheduled leave keeps it VISIBLE in the calendars. Returning null here
// used to drop it out of every category filter at once.
export const getJustificativaCategory = (id: number): SecullumJustificativaCategory | null =>
  SECULLUM_JUSTIFICATIVAS[id]?.category ?? (Number.isFinite(id) ? "AUSENCIA" : null);

export const getJustificativaLabel = (id: number, fallbackDescricao?: string): string =>
  SECULLUM_JUSTIFICATIVAS[id]?.label ?? fallbackDescricao ?? `#${id}`;

// The justified/unjustified axis. Unknown ids count as justified for the same
// reason as above — they always arrive with an afastamento behind them.
export const isJustificativaJustified = (id: number): boolean =>
  SECULLUM_JUSTIFICATIVAS[id]?.justified ?? id !== UNJUSTIFIED_JUSTIFICATIVA_ID;

// Shape of an entry from GET /integrations/secullum/justifications.
export interface SecullumLiveJustificativa {
  Id: number;
  NomeAbreviado?: string | null;
  NomeCompleto?: string | null;
  Desativar?: boolean | null;
  EhFerias?: boolean | null;
}

// Overlay the live Secullum catalog on the static presentation table.
//
// Live names win (Secullum is the system of record and HR renames codes there),
// while tone/icon/category/justified come from the static entry. Codes present
// only in Secullum still produce a usable entry, so a justificativa added by HR
// shows up in the UI on the next fetch instead of vanishing.
export const mergeJustificativaCatalog = (
  live: SecullumLiveJustificativa[] | undefined | null,
  extraIds: Iterable<number> = [],
): SecullumJustificativaMeta[] => {
  const byId = new Map<number, SecullumJustificativaMeta>();

  for (const meta of Object.values(SECULLUM_JUSTIFICATIVAS)) byId.set(meta.id, { ...meta });

  for (const entry of live ?? []) {
    const id = Number(entry?.Id);
    if (!Number.isFinite(id)) continue;
    if (entry?.Desativar) continue;
    const base = byId.get(id);
    const liveLabel = entry.NomeCompleto?.trim() || entry.NomeAbreviado?.trim() || "";
    byId.set(id, {
      id,
      abreviado: entry.NomeAbreviado?.trim() || base?.abreviado || `#${id}`,
      label: liveLabel || base?.label || `#${id}`,
      category: base?.category ?? "AUSENCIA",
      justified: base?.justified ?? id !== UNJUSTIFIED_JUSTIFICATIVA_ID,
      tone: base?.tone ?? "slate",
      icon: base?.icon ?? "calendarOff",
    });
  }

  // Ids observed in actual records but absent from both tables — never hide data.
  for (const rawId of extraIds) {
    const id = Number(rawId);
    if (!Number.isFinite(id) || byId.has(id)) continue;
    byId.set(id, {
      id,
      abreviado: `#${id}`,
      label: `Justificativa #${id}`,
      category: "AUSENCIA",
      justified: id !== UNJUSTIFIED_JUSTIFICATIVA_ID,
      tone: "slate",
      icon: "calendarOff",
    });
  }

  return Array.from(byId.values()).sort((a, b) =>
    a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" }),
  );
};

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
