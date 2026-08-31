/**
 * Agendamentos de comunicado recorrente.
 *
 * Alinhado com `api/src/modules/system/message/dto/create-message-schedule.dto.ts`.
 *
 * A diferença que importa em relação a `MessageCreateFormData`: aqui o público
 * viaja como REGRA (`targetType` + ids), NÃO como lista de usuários já
 * resolvida. Um agendamento vive anos e a lista congelaria no dia da criação —
 * quem resolve setor→usuários é o disparo, no servidor.
 */

import type { SCHEDULE_FREQUENCY, WEEK_DAY, MONTH, MONTH_OCCURRENCE } from "../constants";

export type MessageTargetType = "ALL" | "SPECIFIC" | "SECTOR" | "POSITION";

export interface WeeklyScheduleConfigFormData {
  monday?: boolean;
  tuesday?: boolean;
  wednesday?: boolean;
  thursday?: boolean;
  friday?: boolean;
  saturday?: boolean;
  sunday?: boolean;
}

export interface MonthlyScheduleConfigFormData {
  /** "todo dia 5" */
  dayOfMonth?: number | null;
  /** "primeira segunda" — exige `dayOfWeek` junto */
  occurrence?: MONTH_OCCURRENCE | null;
  dayOfWeek?: WEEK_DAY | null;
}

export interface YearlyScheduleConfigFormData {
  month: MONTH;
  dayOfMonth?: number | null;
  occurrence?: MONTH_OCCURRENCE | null;
  dayOfWeek?: WEEK_DAY | null;
}

export interface MessageScheduleCreateFormData {
  /** Rótulo administrativo, diferente do título da mensagem publicada. */
  name: string;
  title: string;
  contentBlocks: any[];
  isDismissible?: boolean;
  requiresView?: boolean;

  targetType: MessageTargetType;
  targetUserIds?: string[];
  targetSectorIds?: string[];
  targetPositionIds?: string[];

  frequency: SCHEDULE_FREQUENCY;
  frequencyCount?: number;
  dayOfMonth?: number | null;
  customMonths?: MONTH[];
  weeklyConfig?: WeeklyScheduleConfigFormData;
  monthlyConfig?: MonthlyScheduleConfigFormData;
  yearlyConfig?: YearlyScheduleConfigFormData;

  /** Por quantos dias-calendário cada ocorrência fica visível. */
  displayDurationDays?: number;
  /** Hora de São Paulo em que a ocorrência entra no ar (0-23). */
  publishHour?: number;

  startsOn?: string | null;
  endsOn?: string | null;
  maxOccurrences?: number | null;
  isActive?: boolean;
}

export type MessageScheduleUpdateFormData = Partial<MessageScheduleCreateFormData>;

/**
 * A situação como a lista a mostra. Não é o `isActive` cru: ENCERRADO (fim da
 * vigência ou limite de publicações atingido) também tem `isActive = false`, e o
 * que separa os dois é `finishedAt`. Quem resolve isso é o servidor.
 */
export type MessageScheduleStatus = "active" | "paused" | "finished";

export interface MessageScheduleGetManyFormData {
  searchingFor?: string;
  isActive?: boolean;
  status?: MessageScheduleStatus[];
  frequency?: SCHEDULE_FREQUENCY[];
  targetType?: MessageTargetType[];
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// =====================
// Respostas
// =====================

export interface MessageScheduleOccurrenceSummary {
  id: string;
  title: string;
  status: string;
  occurrenceDate: string | null;
  publishedAt: string | null;
  startDate: string | null;
  endDate: string | null;
  _count?: { targets: number; views: number };
}

export interface MessageSchedule {
  id: string;
  name: string;
  title: string;
  content: any;
  isActive: boolean;
  isDismissible: boolean;
  requiresView: boolean;

  targetType: MessageTargetType;
  targetUserIds: string[];
  targetSectorIds: string[];
  targetPositionIds: string[];

  frequency: SCHEDULE_FREQUENCY;
  frequencyCount: number;
  dayOfMonth: number | null;
  customMonths: MONTH[];
  weeklyConfig?: (WeeklyScheduleConfigFormData & { id: string }) | null;
  monthlyConfig?: (MonthlyScheduleConfigFormData & { id: string }) | null;
  yearlyConfig?: (YearlyScheduleConfigFormData & { id: string }) | null;

  displayDurationDays: number;
  publishHour: number;

  startsOn: string | null;
  endsOn: string | null;
  maxOccurrences: number | null;
  occurrenceCount: number;

  nextRun: string | null;
  lastRun: string | null;
  lastRunStatus: string | null;
  lastRunError: string | null;
  finishedAt: string | null;

  createdById: string;
  createdBy?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;

  occurrences?: MessageScheduleOccurrenceSummary[];
  _count?: { occurrences: number };
}

export interface MessageScheduleGetManyResponse {
  success: boolean;
  data: MessageSchedule[];
  meta: { totalRecords: number; page: number; limit: number; totalPages: number };
}

export interface MessageScheduleGetUniqueResponse {
  success: boolean;
  data: MessageSchedule;
}

export interface MessageScheduleMutationResponse {
  success: boolean;
  data: MessageSchedule | null;
  message?: string;
}

export interface MessageSchedulePreviewResponse {
  success: boolean;
  /** ISO strings — as próximas datas de disparo, sem gravar nada. */
  data: string[];
}
