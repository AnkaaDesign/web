import type { SecullumJustificativaCategory } from "../constants/secullum-justifications";

export interface SecullumAbsence {
  Id: number;
  FuncionarioId: number;
  Inicio: string;
  Fim: string;
  JustificativaId: number;
  JustificativaDescricao?: string;
  Motivo?: string;
}

export interface SecullumAggregatedAbsence extends SecullumAbsence {
  userId: string;
  userName: string;
  sectorId: string | null;
  sectorName: string | null;
}

// Per-day row returned by GET /integrations/secullum/absence-days.
// Unlike SecullumAggregatedAbsence (date-range records from /FuncionariosAfastamentos),
// each row represents a single calendar day — partial-day absences included.
export interface SecullumAbsenceDayRow {
  date: string; // YYYY-MM-DD
  userId: string;
  userName: string;
  sectorId: string | null;
  sectorName: string | null;
  FuncionarioId: number;
  JustificativaId: number;
  JustificativaDescricao: string;
  Motivo: string;
  faltas: string | null; // "HH:MM" from Faltas column, null when day comes from afastamento only
  normais: string | null;
  carga: string | null;
  isPartialDay: boolean;
  absenceRecordId?: number;
}

export interface SecullumAbsenceFormData {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  justificativaId: number;
  motivo: string;
  funcionarioId: number;
}

export interface SecullumCollectiveAbsenceFormData {
  startDate: string;
  endDate: string;
  justificativaId: number;
  motivo: string;
  userIds: string[]; // app-level user IDs (mapped to FuncionarioId at submit time)
}

// === [GRP:<uuid>] Motivo encoding ===
// Secullum has no concept of a collective vacation — every record is individual.
// To preserve the in-app grouping without a local DB model, we prefix the Motivo
// field with `[GRP:<uuid>]` when creating collective records. On read we parse
// the prefix to reconstitute groups for the list view + bulk operations.

const GRP_RE = /^\[GRP:([0-9a-fA-F-]{8,})\]\s?/;

export const encodeGroupMotivo = (groupId: string, motivo: string): string =>
  `[GRP:${groupId}] ${motivo ?? ""}`.trim();

export const parseGroupMotivo = (motivo: string | undefined | null): {
  groupId: string | null;
  motivo: string;
} => {
  if (!motivo) return { groupId: null, motivo: "" };
  const m = motivo.match(GRP_RE);
  if (!m) return { groupId: null, motivo };
  return { groupId: m[1], motivo: motivo.replace(GRP_RE, "") };
};

export const stripGroupPrefix = (motivo: string | undefined | null): string =>
  parseGroupMotivo(motivo).motivo;

// Group rows by [GRP:uuid]; ungrouped records become singleton groups keyed by
// their absence Id. Used by the list pages to render either individual rows or
// expandable collective rows.
export interface AbsenceGroup {
  groupId: string; // either the parsed uuid or `single:<absenceId>`
  isCollective: boolean;
  records: SecullumAggregatedAbsence[];
  startDate: string;
  endDate: string;
  justificativaId: number;
  motivo: string;
}

export const groupAbsences = (absences: SecullumAggregatedAbsence[]): AbsenceGroup[] => {
  const buckets = new Map<string, SecullumAggregatedAbsence[]>();
  for (const a of absences) {
    const { groupId } = parseGroupMotivo(a.Motivo);
    const key = groupId ? `grp:${groupId}` : `single:${a.Id}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(a);
  }
  return Array.from(buckets.entries()).map(([key, records]) => {
    const isCollective = key.startsWith("grp:") && records.length > 1;
    const first = records[0];
    return {
      groupId: key,
      isCollective,
      records,
      startDate: first.Inicio.substring(0, 10),
      endDate: first.Fim.substring(0, 10),
      justificativaId: first.JustificativaId,
      motivo: stripGroupPrefix(first.Motivo),
    };
  });
};

// Filter absences by category (Ausência vs Falta). Matches our two pages.
export const filterAbsencesByCategory = (
  absences: SecullumAggregatedAbsence[],
  category: SecullumJustificativaCategory,
  categoryMap: (id: number) => SecullumJustificativaCategory | null,
): SecullumAggregatedAbsence[] =>
  absences.filter((a) => categoryMap(a.JustificativaId) === category);
