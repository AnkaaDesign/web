import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { IconRepeat, IconAlertTriangle, IconCalendarEvent } from "@tabler/icons-react";
import {
  SCHEDULE_FREQUENCY,
  WEEK_DAY,
  MONTH_OCCURRENCE,
  SCHEDULE_FREQUENCY_LABELS,
  WEEK_DAY_LABELS,
  MONTH_OCCURRENCE_LABELS,
} from "../../../../constants";
import type { MessageRecurrenceFormData } from "./types";

/**
 * Configuração de recorrência do compositor de comunicados.
 *
 * Por que NÃO reusa `@/components/ui/schedule-form`: aquele componente é
 * react-hook-form (recebe `control`), e o compositor de mensagens é estado
 * controlado puro (`data`/`onChange`). Casar os dois exigiria um `useForm`
 * local mais um efeito de sincronia em duas vias — que dispara a cada
 * re-render do compositor e é uma fonte clássica de laço. Aqui a estrutura de
 * dados é a MESMA (frequency + weeklySchedule/monthlySchedule) e os rótulos
 * saem das MESMAS constantes, então o que o servidor recebe é idêntico.
 *
 * Cobre as três formas que interessam a um comunicado:
 *   - "toda segunda"                → SEMANAL + segunda marcada
 *   - "mensal, primeira segunda"    → MENSAL + ocorrência PRIMEIRA + segunda
 *   - "mensal, todo dia 5"          → MENSAL + dia do mês 5
 */

/** Frequências que fazem sentido para comunicado (ONCE é mensagem avulsa). */
const FREQUENCY_OPTIONS = [
  SCHEDULE_FREQUENCY.DAILY,
  SCHEDULE_FREQUENCY.WEEKLY,
  SCHEDULE_FREQUENCY.BIWEEKLY,
  SCHEDULE_FREQUENCY.MONTHLY,
  SCHEDULE_FREQUENCY.BIMONTHLY,
  SCHEDULE_FREQUENCY.QUARTERLY,
  SCHEDULE_FREQUENCY.SEMI_ANNUAL,
  SCHEDULE_FREQUENCY.ANNUAL,
];

const WEEK_DAYS: Array<{ key: keyof NonNullable<MessageRecurrenceFormData["weeklySchedule"]>; day: WEEK_DAY }> = [
  { key: "monday", day: WEEK_DAY.MONDAY },
  { key: "tuesday", day: WEEK_DAY.TUESDAY },
  { key: "wednesday", day: WEEK_DAY.WEDNESDAY },
  { key: "thursday", day: WEEK_DAY.THURSDAY },
  { key: "friday", day: WEEK_DAY.FRIDAY },
  { key: "saturday", day: WEEK_DAY.SATURDAY },
  { key: "sunday", day: WEEK_DAY.SUNDAY },
];

const MONTHLY_MODE_OPTIONS = [
  { value: "dayOfMonth", label: "Em um dia fixo do mês (ex.: todo dia 5)" },
  { value: "occurrence", label: "Em uma ocorrência (ex.: primeira segunda-feira)" },
];

const WEEKLY_FAMILY: string[] = [SCHEDULE_FREQUENCY.WEEKLY, SCHEDULE_FREQUENCY.BIWEEKLY];
const MONTHLY_FAMILY: string[] = [
  SCHEDULE_FREQUENCY.MONTHLY,
  SCHEDULE_FREQUENCY.BIMONTHLY,
  SCHEDULE_FREQUENCY.QUARTERLY,
  SCHEDULE_FREQUENCY.SEMI_ANNUAL,
];

interface Props {
  data: MessageRecurrenceFormData;
  onChange: (next: MessageRecurrenceFormData) => void;
  /** Próximas datas devolvidas pelo `preview-occurrences`, quando disponíveis. */
  preview?: Date[];
  previewError?: string | null;
}

export const MessageRecurrenceForm = ({ data, onChange, preview, previewError }: Props) => {
  const set = (patch: Partial<MessageRecurrenceFormData>) => onChange({ ...data, ...patch });

  const frequencyOptions = useMemo(
    () =>
      FREQUENCY_OPTIONS.map(f => ({
        value: f,
        label: SCHEDULE_FREQUENCY_LABELS[f] ?? f,
      })),
    [],
  );

  const occurrenceOptions = useMemo(
    () =>
      Object.entries(MONTH_OCCURRENCE_LABELS).map(([key, label]) => ({
        value: key as MONTH_OCCURRENCE,
        label,
      })),
    [],
  );

  const weekDayOptions = useMemo(
    () =>
      Object.entries(WEEK_DAY_LABELS).map(([key, label]) => ({
        value: key as WEEK_DAY,
        label,
      })),
    [],
  );

  const isWeekly = WEEKLY_FAMILY.includes(data.frequency);
  const isMonthly = MONTHLY_FAMILY.includes(data.frequency);

  const weekly = data.weeklySchedule ?? {};
  const monthly = data.monthlySchedule ?? {};
  const monthlyMode = monthly.occurrence ? "occurrence" : "dayOfMonth";

  const noWeekDaySelected = isWeekly && !WEEK_DAYS.some(d => weekly[d.key]);

  // A janela de exibição não pode passar do intervalo até o próximo disparo,
  // senão duas ocorrências ficam no ar ao mesmo tempo e o usuário vê o aviso da
  // semana passada empilhado com o desta. O aviso sai da PRÉVIA real, não de uma
  // conta aproximada de dias.
  const overlapWarning = useMemo(() => {
    if (!preview || preview.length < 2) return null;
    const gapDays = Math.round(
      (preview[1].getTime() - preview[0].getTime()) / (24 * 60 * 60 * 1000),
    );
    const duration = data.displayDurationDays ?? 7;
    if (duration > gapDays) {
      return `Cada comunicado fica ${duration} dias no ar, mas o próximo sai em ${gapDays} dias — dois avisos ficariam visíveis ao mesmo tempo.`;
    }
    return null;
  }, [preview, data.displayDurationDays]);

  return (
    <div className="space-y-4">
      {/* Frequência */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <IconRepeat className="h-5 w-5" />
            Repetição
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Frequência</Label>
              <Combobox
                value={data.frequency}
                onValueChange={value => {
                  const next = value as SCHEDULE_FREQUENCY;
                  // Trocar de família limpa a configuração da anterior: deixar
                  // um `monthlySchedule` órfão numa recorrência semanal manda
                  // lixo para a API e confunde a validação do servidor.
                  set({
                    frequency: next,
                    weeklySchedule: WEEKLY_FAMILY.includes(next)
                      ? (data.weeklySchedule ?? {})
                      : undefined,
                    monthlySchedule: MONTHLY_FAMILY.includes(next)
                      ? (data.monthlySchedule ?? { dayOfMonth: 1 })
                      : undefined,
                    yearlySchedule:
                      next === SCHEDULE_FREQUENCY.ANNUAL ? data.yearlySchedule : undefined,
                  });
                }}
                options={frequencyOptions}
                placeholder="Selecione a frequência..."
                searchable={false}
                clearable={false}
              />
            </div>

            <div className="space-y-2">
              <Label>Intervalo</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={data.frequencyCount ?? 1}
                onChange={value => {
                  const n = typeof value === "number" ? value : parseInt(String(value ?? "1"), 10);
                  set({ frequencyCount: Number.isFinite(n) && n > 0 ? n : 1 });
                }}
              />
              <p className="text-xs text-muted-foreground">
                {isWeekly ? "A cada N semanas" : isMonthly ? "A cada N meses" : "A cada N períodos"}
              </p>
            </div>
          </div>

          {/* Semanal: quais dias */}
          {isWeekly && (
            <div className="space-y-2">
              <Label>
                Dias da semana <span className="text-destructive">*</span>
              </Label>
              <div className="flex flex-wrap gap-4">
                {WEEK_DAYS.map(({ key, day }) => (
                  <label key={key} className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={!!weekly[key]}
                      onCheckedChange={checked =>
                        set({ weeklySchedule: { ...weekly, [key]: !!checked } })
                      }
                    />
                    <span className="text-sm">{WEEK_DAY_LABELS[day]}</span>
                  </label>
                ))}
              </div>
              {noWeekDaySelected && (
                <p className="text-xs text-destructive">
                  Selecione pelo menos um dia — sem isso o comunicado nunca seria publicado.
                </p>
              )}
            </div>
          )}

          {/* Mensal: dia fixo OU ocorrência */}
          {isMonthly && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Quando no mês</Label>
                <Combobox
                  value={monthlyMode}
                  onValueChange={value =>
                    set(
                      value === "occurrence"
                        ? {
                            monthlySchedule: {
                              dayOfMonth: null,
                              occurrence: MONTH_OCCURRENCE.FIRST,
                              dayOfWeek: WEEK_DAY.MONDAY,
                            },
                          }
                        : {
                            monthlySchedule: {
                              dayOfMonth: 1,
                              occurrence: null,
                              dayOfWeek: null,
                            },
                          },
                    )
                  }
                  options={MONTHLY_MODE_OPTIONS}
                  searchable={false}
                  clearable={false}
                />
              </div>

              {monthlyMode === "dayOfMonth" ? (
                <div className="space-y-2">
                  <Label>Dia do mês</Label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={monthly.dayOfMonth ?? 1}
                    onChange={value => {
                      const n =
                        typeof value === "number" ? value : parseInt(String(value ?? "1"), 10);
                      set({
                        monthlySchedule: {
                          ...monthly,
                          dayOfMonth: Number.isFinite(n) ? Math.min(Math.max(n, 1), 31) : 1,
                          occurrence: null,
                          dayOfWeek: null,
                        },
                      });
                    }}
                  />
                  {(monthly.dayOfMonth ?? 1) > 28 && (
                    <p className="text-xs text-muted-foreground">
                      Em meses mais curtos o comunicado sai no último dia disponível (ex.: dia 31 vira 28 em fevereiro).
                    </p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Ocorrência</Label>
                    <Combobox
                      value={monthly.occurrence ?? MONTH_OCCURRENCE.FIRST}
                      onValueChange={value =>
                        set({
                          monthlySchedule: {
                            ...monthly,
                            dayOfMonth: null,
                            occurrence: value as MONTH_OCCURRENCE,
                          },
                        })
                      }
                      options={occurrenceOptions}
                      searchable={false}
                      clearable={false}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Dia da semana</Label>
                    <Combobox
                      value={monthly.dayOfWeek ?? WEEK_DAY.MONDAY}
                      onValueChange={value =>
                        set({
                          monthlySchedule: {
                            ...monthly,
                            dayOfMonth: null,
                            dayOfWeek: value as WEEK_DAY,
                          },
                        })
                      }
                      options={weekDayOptions}
                      searchable={false}
                      clearable={false}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Como cada ocorrência aparece */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cada publicação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Dias visível</Label>
              <Input
                type="number"
                min={1}
                max={365}
                value={data.displayDurationDays ?? 7}
                onChange={value => {
                  const n = typeof value === "number" ? value : parseInt(String(value ?? "7"), 10);
                  set({ displayDurationDays: Number.isFinite(n) && n > 0 ? n : 7 });
                }}
              />
              <p className="text-xs text-muted-foreground">
                Por quantos dias cada comunicado fica no feed antes de expirar
              </p>
            </div>

            <div className="space-y-2">
              <Label>Hora da publicação</Label>
              <Input
                type="number"
                min={0}
                max={23}
                value={data.publishHour ?? 8}
                onChange={value => {
                  const n = typeof value === "number" ? value : parseInt(String(value ?? "8"), 10);
                  set({ publishHour: Number.isFinite(n) ? Math.min(Math.max(n, 0), 23) : 8 });
                }}
              />
              <p className="text-xs text-muted-foreground">
                Horário de Brasília em que a notificação é enviada
              </p>
            </div>
          </div>

          {overlapWarning && (
            <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950">
              <IconAlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                {overlapWarning}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>Encerrar após (opcional)</Label>
            <Input
              type="number"
              min={1}
              value={data.maxOccurrences ?? ""}
              onChange={value => {
                const raw = String(value ?? "").trim();
                if (!raw) return set({ maxOccurrences: null });
                const n = parseInt(raw, 10);
                set({ maxOccurrences: Number.isFinite(n) && n > 0 ? n : null });
              }}
              placeholder="Sem limite"
            />
            <p className="text-xs text-muted-foreground">
              Número de publicações antes de o agendamento se encerrar sozinho
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Prévia — a rede de segurança do autor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <IconCalendarEvent className="h-5 w-5" />
            Próximas publicações
          </CardTitle>
        </CardHeader>
        <CardContent>
          {previewError ? (
            <p className="text-sm text-destructive">{previewError}</p>
          ) : preview && preview.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {preview.map((d, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="text-muted-foreground">{i + 1}.</span>
                  <span className="font-medium">
                    {d.toLocaleDateString("pt-BR", {
                      weekday: "long",
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </span>
                  <span className="text-muted-foreground">
                    às {String(data.publishHour ?? 8).padStart(2, "0")}:00
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Complete a configuração acima para ver as próximas datas.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
