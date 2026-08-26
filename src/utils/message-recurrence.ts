/**
 * Ponte entre o compositor de comunicados e a API de agendamentos.
 *
 * Uma diferença de fundo em relação à mensagem avulsa: aqui o público NÃO é
 * resolvido no navegador. `resolveTargetingToUserIds` (em `message-targeting.ts`)
 * transforma "setor 1" numa lista de userIds e é o que a mensagem avulsa manda —
 * o que está certo para um evento único. Num agendamento seria errado: a lista
 * congelaria no dia da criação e, meses depois, o comunicado continuaria indo
 * para quem saiu do setor e nunca chegaria a quem entrou. Por isso a REGRA viaja
 * inteira e quem a resolve é o disparo, no servidor.
 */

import { SCHEDULE_FREQUENCY } from "@/constants";
import type { MessageFormData, MessageRecurrenceFormData } from "@/components/administration/message/editor/types";
import type { MessageScheduleCreateFormData, MessageTargetType } from "@/schemas/message-schedule";
import { startsAtISO, endsAtISO } from "./message-scheduling";

const WEEKLY_FAMILY: string[] = [SCHEDULE_FREQUENCY.WEEKLY, SCHEDULE_FREQUENCY.BIWEEKLY];
const MONTHLY_FAMILY: string[] = [
  SCHEDULE_FREQUENCY.MONTHLY,
  SCHEDULE_FREQUENCY.BIMONTHLY,
  SCHEDULE_FREQUENCY.QUARTERLY,
  SCHEDULE_FREQUENCY.TRIANNUAL,
  SCHEDULE_FREQUENCY.QUADRIMESTRAL,
  SCHEDULE_FREQUENCY.SEMI_ANNUAL,
];

/** O seletor do compositor, no vocabulário da API. */
const TARGET_TYPE_MAP: Record<MessageFormData["targeting"]["type"], MessageTargetType> = {
  all: "ALL",
  specific: "SPECIFIC",
  sector: "SECTOR",
  position: "POSITION",
};

/**
 * A recorrência já descreve uma data futura?
 *
 * Serve de porteiro da prévia: enquanto o autor está no meio da configuração
 * (semanal sem nenhum dia marcado, mensal sem dia nem ocorrência) a API
 * responderia 400, e um 400 por tecla digitada é só ruído na tela.
 */
export function isRecurrenceComplete(recurrence?: MessageRecurrenceFormData | null): boolean {
  if (!recurrence?.enabled || !recurrence.frequency) return false;

  if (WEEKLY_FAMILY.includes(recurrence.frequency)) {
    const w = recurrence.weeklySchedule;
    return !!w && Object.values(w).some(Boolean);
  }

  if (MONTHLY_FAMILY.includes(recurrence.frequency)) {
    const m = recurrence.monthlySchedule;
    if (!m) return false;
    const hasDay = m.dayOfMonth !== null && m.dayOfMonth !== undefined;
    const hasOccurrence = !!m.occurrence && !!m.dayOfWeek;
    return hasDay || hasOccurrence;
  }

  if (recurrence.frequency === SCHEDULE_FREQUENCY.ANNUAL) {
    const y = recurrence.yearlySchedule;
    if (!y?.month) return false;
    const hasDay = y.dayOfMonth !== null && y.dayOfMonth !== undefined;
    const hasOccurrence = !!y.occurrence && !!y.dayOfWeek;
    return hasDay || hasOccurrence;
  }

  // DIÁRIA não precisa de configuração extra.
  return recurrence.frequency === SCHEDULE_FREQUENCY.DAILY;
}

/**
 * Monta o corpo de `POST /message-schedules` a partir do estado do compositor.
 *
 * Só emite o bloco de configuração da família de frequência escolhida: mandar um
 * `monthlyConfig` órfão junto de uma recorrência semanal confunde a validação do
 * servidor e deixa lixo gravado.
 */
export function buildSchedulePayload(data: MessageFormData): MessageScheduleCreateFormData {
  const r = data.recurrence!;
  const frequency = r.frequency;

  return {
    // O agendamento tem rótulo próprio na administração; sem um nome melhor, o
    // título da mensagem serve.
    name: data.title,
    title: data.title,
    contentBlocks: data.blocks,

    targetType: TARGET_TYPE_MAP[data.targeting.type],
    targetUserIds: data.targeting.userIds ?? [],
    targetSectorIds: data.targeting.sectorIds ?? [],
    targetPositionIds: data.targeting.positionIds ?? [],

    frequency,
    frequencyCount: r.frequencyCount ?? 1,

    ...(WEEKLY_FAMILY.includes(frequency)
      ? {
          weeklyConfig: {
            monday: !!r.weeklySchedule?.monday,
            tuesday: !!r.weeklySchedule?.tuesday,
            wednesday: !!r.weeklySchedule?.wednesday,
            thursday: !!r.weeklySchedule?.thursday,
            friday: !!r.weeklySchedule?.friday,
            saturday: !!r.weeklySchedule?.saturday,
            sunday: !!r.weeklySchedule?.sunday,
          },
        }
      : {}),

    ...(MONTHLY_FAMILY.includes(frequency)
      ? {
          monthlyConfig: {
            dayOfMonth: r.monthlySchedule?.dayOfMonth ?? null,
            occurrence: r.monthlySchedule?.occurrence ?? null,
            dayOfWeek: r.monthlySchedule?.dayOfWeek ?? null,
          },
        }
      : {}),

    ...(frequency === SCHEDULE_FREQUENCY.ANNUAL && r.yearlySchedule
      ? {
          yearlyConfig: {
            month: r.yearlySchedule.month,
            dayOfMonth: r.yearlySchedule.dayOfMonth ?? null,
            occurrence: r.yearlySchedule.occurrence ?? null,
            dayOfWeek: r.yearlySchedule.dayOfWeek ?? null,
          },
        }
      : {}),

    displayDurationDays: r.displayDurationDays ?? 7,
    publishHour: r.publishHour ?? 8,

    // Com recorrência ligada o DateRangePicker muda de sentido: deixa de ser a
    // janela de exibição e passa a ser a VIGÊNCIA do agendamento.
    startsOn: startsAtISO(data.scheduling?.startDate),
    endsOn: endsAtISO(data.scheduling?.endDate),
    maxOccurrences: r.maxOccurrences ?? null,

    // Rascunho vira agendamento PAUSADO: a regra fica gravada e não publica nada
    // até alguém retomar.
    isActive: !data.isDraft,
  };
}
