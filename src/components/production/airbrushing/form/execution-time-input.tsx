// "Tempo de execução" da aerografia: um inteiro + a unidade (Horas | Dias), e a prévia
// read-only do "Término previsto" calculada com a MESMA regra da API
// (utils/airbrushing.ts → computeExpectedFinishDate). Usado no formulário da aerografia,
// no orçamento de abertura da cotação e na contraproposta para todos.

import { IconCalendarCheck } from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { EXECUTION_TIME_UNIT, EXECUTION_TIME_UNIT_LABELS } from "@/constants";
import { formatExpectedFinishDate } from "@/utils/airbrushing";

export interface ExecutionTimeValue {
  executionTime: number | null;
  executionTimeUnit: EXECUTION_TIME_UNIT | null;
}

interface ExecutionTimeInputProps {
  value: number | null | undefined;
  unit: EXECUTION_TIME_UNIT | `${EXECUTION_TIME_UNIT}` | string | null | undefined;
  onChange: (next: ExecutionTimeValue) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  invalid?: boolean;
  className?: string;
}

const UNITS = [EXECUTION_TIME_UNIT.HOURS, EXECUTION_TIME_UNIT.DAYS] as const;

/** Unidade válida ou Dias — o padrão de quem fala de aerografia é "em quantos dias". */
export const resolveExecutionTimeUnit = (unit: string | null | undefined): EXECUTION_TIME_UNIT =>
  unit === EXECUTION_TIME_UNIT.HOURS ? EXECUTION_TIME_UNIT.HOURS : EXECUTION_TIME_UNIT.DAYS;

/**
 * Número + segmento Horas/Dias num controle só, da altura de um Input. Trocar a unidade
 * sem número grava só a unidade — a escolha fica pronta para quando o número vier.
 */
export function ExecutionTimeInput({ value, unit, onChange, disabled, placeholder = "Ex.: 2", id, invalid, className }: ExecutionTimeInputProps) {
  const currentUnit = resolveExecutionTimeUnit(unit);

  return (
    <div className={cn("flex items-stretch gap-2", className)}>
      <Input
        id={id}
        type="natural"
        min={1}
        max={999}
        value={value ?? ""}
        onChange={(next) => {
          const n = typeof next === "number" ? next : next === "" || next == null ? null : Number(next);
          const executionTime = n != null && Number.isFinite(n) && n > 0 ? Math.min(Math.trunc(n), 999) : null;
          onChange({ executionTime, executionTimeUnit: currentUnit });
        }}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={cn("min-w-0 flex-1 bg-transparent tabular-nums", invalid && "border-destructive")}
      />
      <div role="radiogroup" aria-label="Unidade do tempo de execução" className="flex h-10 shrink-0 rounded-md border border-border p-0.5">
        {UNITS.map((option) => {
          const active = option === currentUnit;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => !active && onChange({ executionTime: value ?? null, executionTimeUnit: option })}
              className={cn(
                "rounded px-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {EXECUTION_TIME_UNIT_LABELS[option]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface ExpectedFinishPreviewProps {
  startDate: Date | string | null | undefined;
  executionTime: number | null | undefined;
  unit: string | null | undefined;
  /** Término gravado de uma aerografia sem tempo (anterior ao tempo de execução). */
  fallbackFinishDate?: Date | string | null;
  className?: string;
}

/**
 * "Término previsto: 30/09/2026" — read-only, calculado do início + tempo. Sem início ou sem
 * tempo, diz o que falta; aerografia antiga sem tempo mostra o término que já tinha.
 */
export function ExpectedFinishPreview({ startDate, executionTime, unit, fallbackFinishDate, className }: ExpectedFinishPreviewProps) {
  const effectiveUnit = executionTime ? resolveExecutionTimeUnit(unit) : null;
  const computed = formatExpectedFinishDate(startDate, executionTime, effectiveUnit);
  const legacy = !executionTime && fallbackFinishDate ? formatExpectedFinishDate(fallbackFinishDate, 1, EXECUTION_TIME_UNIT.DAYS) : "";

  let body: React.ReactNode;
  if (computed) body = <span className="font-medium text-foreground">{computed}</span>;
  else if (legacy)
    body = (
      <>
        <span className="font-medium text-foreground">{legacy}</span> <span>(definido antes do tempo de execução)</span>
      </>
    );
  else if (executionTime && !startDate) body = "informe o início previsto";
  else if (startDate && !executionTime) body = "informe o tempo de execução";
  else body = "—";

  return (
    <p className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <IconCalendarCheck className="h-3.5 w-3.5 shrink-0" />
      <span>Término previsto: {body}</span>
    </p>
  );
}
