import type { ReactNode } from "react";
import type { DateRange } from "react-day-picker";
import { FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { IconInfoCircle, IconPhoto } from "@tabler/icons-react";
import { PainterSelector } from "./painter-selector";
import {
  AIRBRUSHING_STATUS,
  AIRBRUSHING_STATUS_LABELS,
  AIRBRUSHING_PAYMENT_STATUS,
  AIRBRUSHING_PAYMENT_STATUS_LABELS,
  AIRBRUSHING_DUE_DATE_RULE,
  AIRBRUSHING_DUE_DATE_RULE_LABELS,
  PAYMENT_METHOD,
  PAYMENT_METHOD_LABELS,
} from "../../../../constants";
import { AIRBRUSHING_DEFAULT_PAYMENT_TERM_DAYS, resolveAirbrushingDueDate } from "@/utils/airbrushing";
import { formatDate } from "@/utils/date";

export interface AirbrushingPainterRef {
  id: string;
  name: string;
  email?: string | null;
  status?: string | null;
}

/**
 * Os campos escalares de UMA aerografia. Esta interface é a ÚNICA lista de campos do
 * formulário: create (linhas do `MultiAirbrushingSelector`) e edit (react-hook-form)
 * renderizam o mesmo componente, e a revisão deriva desta mesma forma — então um campo
 * novo entra em um lugar só, e não em quatro listas escritas à mão.
 */
export interface AirbrushingFieldValues {
  status?: string | null;
  paymentStatus?: string | null;
  paymentMethod?: string | null;
  dueDateRule?: string | null;
  paymentTermDays?: number | null;
  dueDayOfMonth?: number | null;
  dueDate?: Date | string | null;
  price?: number | null;
  description?: string | null;
  startDate?: Date | string | null;
  finishDate?: Date | string | null;
  startedAt?: Date | string | null;
  finishedAt?: Date | string | null;
  painterId?: string | null;
  painter?: AirbrushingPainterRef | null;
}

export type AirbrushingFieldErrors = Partial<Record<keyof AirbrushingFieldValues, string | undefined>>;

export interface AirbrushingFieldsProps {
  value: AirbrushingFieldValues;
  /** Recebe um PATCH parcial — quem chama decide se escreve em estado local ou no react-hook-form. */
  onChange: (patch: Partial<AirbrushingFieldValues>) => void;
  disabled?: boolean;
  /**
   * Se o usuário pode ver dinheiro. Este bloco vive FORA de DataTable/DetailPage, então não
   * herda `usePricingVisible` — o valor e toda a configuração de pagamento são gateados aqui.
   */
  canViewFinancials?: boolean;
  /** Mostra Status / Status do Pagamento (o formulário de tarefa esconde no cadastro). */
  showStatus?: boolean;
  /** Mostra "Iniciado em" / "Finalizado em" (datas reais). */
  showActualDates?: boolean;
  initialPainter?: AirbrushingPainterRef | null;
  /** Prefixo dos `name` dos date pickers — só precisa ser único dentro da página. */
  idPrefix?: string;
  errors?: AirbrushingFieldErrors;
  /**
   * Seletor de layouts da aerografia. O RÓTULO e a POSIÇÃO moram aqui (último bloco), e só o
   * uploader em si vem de quem chama — no cadastro ele escreve na linha do
   * `MultiAirbrushingSelector`, na edição no react-hook-form. É o que impede os dois modos de
   * desenharem o mesmo seletor em lugares diferentes.
   *
   * Recibos e notas fiscais NÃO têm seletor: o recibo entra por Contas a Pagar e a nota fiscal
   * é anexada automaticamente na geração da NFS-e.
   */
  layoutsSlot?: ReactNode;
}

/** Wrapper de campo: rótulo + controle + mensagem de erro (mesma cara do `FormItem`). */
const Field = ({ label, hint, error, children }: { label: ReactNode; hint?: ReactNode; error?: string; children: ReactNode }) => (
  <div className="space-y-2">
    <FormLabel className="flex items-center gap-1.5">
      {label}
      {hint}
    </FormLabel>
    {children}
    {error && <p className="text-sm font-medium text-destructive">{error}</p>}
  </div>
);

const asDate = (value: Date | string | null | undefined): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? null : date;
};

/** `mode="date"`/`"datetime"` nunca entregam um DateRange — a assinatura larga vem do componente. */
const onlyDate = (value: Date | DateRange | null): Date | null => (value instanceof Date ? value : null);

const statusOptions: ComboboxOption[] = Object.values(AIRBRUSHING_STATUS).map((value) => ({ value, label: AIRBRUSHING_STATUS_LABELS[value] }));
const paymentStatusOptions: ComboboxOption[] = Object.values(AIRBRUSHING_PAYMENT_STATUS).map((value) => ({
  value,
  label: AIRBRUSHING_PAYMENT_STATUS_LABELS[value],
}));
const paymentMethodOptions: ComboboxOption[] = Object.values(PAYMENT_METHOD).map((value) => ({ value, label: PAYMENT_METHOD_LABELS[value] }));
const dueDateRuleOptions: ComboboxOption[] = Object.values(AIRBRUSHING_DUE_DATE_RULE).map((value) => ({
  value,
  label: AIRBRUSHING_DUE_DATE_RULE_LABELS[value],
}));

/**
 * Bloco de campos de uma aerografia, compartilhado por criação e edição.
 *
 * Ordem (idêntica nos dois modos, e a mesma da revisão):
 *   1. Pintor | Descrição
 *   2. Status | Status do Pagamento
 *   3. Início Previsto | Término Previsto
 *   4. Iniciado em | Finalizado em
 *   5. Pagamento: Valor | Forma | Regra | campo da regra + prévia do vencimento
 *   6. Layouts (`layoutsSlot`)
 *
 * O valor fica DENTRO do bloco de pagamento — ele é o que a aerografia custa a pagar, e
 * quem preenche a forma/vencimento é quem preenche o valor.
 */
export function AirbrushingFields({
  value,
  onChange,
  disabled,
  canViewFinancials = true,
  showStatus = true,
  showActualDates = true,
  initialPainter,
  idPrefix = "airbrushing",
  errors,
  layoutsSlot,
}: AirbrushingFieldsProps) {
  const status = value.status ?? AIRBRUSHING_STATUS.PREPARATION;
  const isCompleted = status === AIRBRUSHING_STATUS.COMPLETED;
  const dueDateRule = value.dueDateRule ?? AIRBRUSHING_DUE_DATE_RULE.DAYS_AFTER_FINISH;

  // A prévia usa a MESMA referência do servidor: término real quando existe, término
  // previsto enquanto o serviço não acabou.
  const previewDueDate = resolveAirbrushingDueDate(
    { dueDateRule, paymentTermDays: value.paymentTermDays, dueDayOfMonth: value.dueDayOfMonth, dueDate: value.dueDate },
    value.finishedAt ?? value.finishDate,
  );

  const handleStatusChange = (next: string) => {
    onChange({
      status: next,
      // O status de pagamento só faz sentido para aerografia concluída: volta a PENDENTE
      // sempre que o status sai de CONCLUÍDA.
      ...(next !== AIRBRUSHING_STATUS.COMPLETED ? { paymentStatus: AIRBRUSHING_PAYMENT_STATUS.PENDING } : {}),
    });
  };

  const handleRuleChange = (next: string) => {
    // Cada regra consome um campo diferente; limpar os outros evita que um valor órfão de
    // uma regra anterior volte a valer se o usuário trocar de ideia duas vezes.
    onChange({
      dueDateRule: next,
      paymentTermDays: next === AIRBRUSHING_DUE_DATE_RULE.DAYS_AFTER_FINISH ? (value.paymentTermDays ?? null) : null,
      dueDayOfMonth: next === AIRBRUSHING_DUE_DATE_RULE.DAY_OF_MONTH ? (value.dueDayOfMonth ?? null) : null,
      dueDate: next === AIRBRUSHING_DUE_DATE_RULE.FIXED_DATE ? (value.dueDate ?? null) : null,
    });
  };

  return (
    <div className="space-y-4">
      {/* Linha 1: Pintor | Descrição (Input de uma linha, ao lado do pintor) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Pintor" error={errors?.painterId}>
          <PainterSelector
            value={value.painterId ?? undefined}
            onChange={(userId) => onChange({ painterId: userId ?? null })}
            initialUser={initialPainter ?? value.painter ?? undefined}
            disabled={disabled}
          />
        </Field>

        <Field label="Descrição" error={errors?.description}>
          <Input
            type="text"
            value={value.description ?? ""}
            // Guarda o texto CRU (só "" vira null): aparar aqui engoliria o espaço que o
            // usuário acabou de digitar. O trim final é do `buildAirbrushingPayload`.
            onChange={(next) => onChange({ description: next === "" || next === null || next === undefined ? null : String(next) })}
            placeholder="Detalhes da aerografia..."
            maxLength={500}
            disabled={disabled}
            className="bg-transparent"
          />
        </Field>
      </div>

      {/* Linha 2: Status | Status do Pagamento */}
      {showStatus && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Status" error={errors?.status}>
            <Combobox
              value={status}
              onValueChange={(next) => handleStatusChange((next as string) || AIRBRUSHING_STATUS.PREPARATION)}
              options={statusOptions}
              placeholder="Selecione o status"
              searchable={false}
              clearable={false}
              disabled={disabled}
            />
          </Field>

          {canViewFinancials && (
            <Field
              label="Status do Pagamento"
              hint={
                !isCompleted && <IconInfoCircle className="h-3.5 w-3.5 text-muted-foreground" title="Disponível somente após a conclusão da aerografia" />
              }
              error={errors?.paymentStatus}
            >
              <Combobox
                value={value.paymentStatus ?? AIRBRUSHING_PAYMENT_STATUS.PENDING}
                onValueChange={(next) => onChange({ paymentStatus: (next as string) || AIRBRUSHING_PAYMENT_STATUS.PENDING })}
                options={paymentStatusOptions}
                placeholder="Selecione o status do pagamento"
                searchable={false}
                clearable={false}
                disabled={disabled || !isCompleted}
              />
            </Field>
          )}
        </div>
      )}

      {/* Linha 3: datas previstas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DateTimeInput
          field={{
            value: asDate(value.startDate),
            onChange: (next) => onChange({ startDate: onlyDate(next) }),
            onBlur: () => {},
            name: `${idPrefix}.startDate`,
          }}
          label="Início Previsto"
          mode="date"
          context="start"
          disabled={disabled}
          error={errors?.startDate}
        />
        <DateTimeInput
          field={{
            value: asDate(value.finishDate),
            onChange: (next) => onChange({ finishDate: onlyDate(next) }),
            onBlur: () => {},
            name: `${idPrefix}.finishDate`,
          }}
          label="Término Previsto"
          mode="date"
          context="end"
          disabled={disabled}
          error={errors?.finishDate}
        />
      </div>

      {/* Linha 4: datas reais */}
      {showActualDates && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DateTimeInput
            field={{
              value: asDate(value.startedAt),
              onChange: (next) => onChange({ startedAt: onlyDate(next) }),
              onBlur: () => {},
              name: `${idPrefix}.startedAt`,
            }}
            label="Iniciado em"
            mode="datetime"
            context="start"
            disabled={disabled}
            error={errors?.startedAt}
          />
          <DateTimeInput
            field={{
              value: asDate(value.finishedAt),
              onChange: (next) => onChange({ finishedAt: onlyDate(next) }),
              onBlur: () => {},
              name: `${idPrefix}.finishedAt`,
            }}
            label="Finalizado em"
            mode="datetime"
            context="end"
            disabled={disabled}
            error={errors?.finishedAt}
          />
        </div>
      )}

      {/* Pagamento — valor, forma e vencimento juntos. É exatamente o que Contas a Pagar
          exibe nas colunas "Valor", "Forma" e "Vencimento". */}
      {canViewFinancials && (
        <div className="rounded-lg border border-border/60 p-4 space-y-4">
          <p className="text-sm font-semibold text-foreground">Pagamento</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Valor do Serviço" error={errors?.price}>
              <Input
                type="currency"
                value={value.price ?? undefined}
                onChange={(next) => onChange({ price: typeof next === "number" ? next : null })}
                placeholder="R$ 0,00"
                disabled={disabled}
                className="bg-transparent"
              />
            </Field>

            <Field label="Forma de Pagamento" error={errors?.paymentMethod}>
              <Combobox
                value={value.paymentMethod ?? undefined}
                onValueChange={(next) => onChange({ paymentMethod: (next as string) ?? null })}
                options={paymentMethodOptions}
                placeholder="Selecione a forma de pagamento"
                searchable={false}
                clearable
                disabled={disabled}
              />
            </Field>

            <Field label="Regra de Vencimento" error={errors?.dueDateRule}>
              <Combobox
                value={dueDateRule}
                onValueChange={(next) => handleRuleChange((next as string) || AIRBRUSHING_DUE_DATE_RULE.DAYS_AFTER_FINISH)}
                options={dueDateRuleOptions}
                placeholder="Selecione a regra"
                searchable={false}
                clearable={false}
                disabled={disabled}
              />
              {/* Prévia do que o servidor vai gravar, na MESMA posição e tipografia da descrição do
                  campo ao lado — antes era uma linha solta de largura total abaixo do grid.
                  Some quando não há término de referência: nesse caso a aerografia entra em Contas
                  a Pagar sem vencimento. */}
              {dueDateRule !== AIRBRUSHING_DUE_DATE_RULE.FIXED_DATE &&
                (previewDueDate ? (
                  <p className="text-xs text-muted-foreground">
                    Vencimento previsto: <span className="font-medium text-foreground">{formatDate(previewDueDate)}</span>
                    {!value.finishedAt && " (a partir do término previsto; a data se firma quando a aerografia for concluída)"}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Sem data de término, a aerografia aparece em Contas a Pagar sem vencimento.</p>
                ))}
            </Field>

            {dueDateRule === AIRBRUSHING_DUE_DATE_RULE.DAYS_AFTER_FINISH && (
              <Field label="Prazo após o Término" error={errors?.paymentTermDays}>
                <Input
                  type="number"
                  min={0}
                  max={365}
                  value={value.paymentTermDays ?? ""}
                  onChange={(next) => onChange({ paymentTermDays: next === "" || next === null || next === undefined ? null : Number(next) })}
                  placeholder={String(AIRBRUSHING_DEFAULT_PAYMENT_TERM_DAYS)}
                  disabled={disabled}
                  className="bg-transparent"
                />
                <p className="text-xs text-muted-foreground">Dias corridos após o término do serviço. Em branco usa {AIRBRUSHING_DEFAULT_PAYMENT_TERM_DAYS} dias.</p>
              </Field>
            )}

            {dueDateRule === AIRBRUSHING_DUE_DATE_RULE.DAY_OF_MONTH && (
              <Field label="Dia do Vencimento" error={errors?.dueDayOfMonth}>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={value.dueDayOfMonth ?? ""}
                  onChange={(next) => onChange({ dueDayOfMonth: next === "" || next === null || next === undefined ? null : Number(next) })}
                  placeholder="1-31"
                  disabled={disabled}
                  className="bg-transparent"
                />
                {/* RECORRENTE: a data é recalculada a partir do término — é isto que separa esta
                    regra de "Data fixa". */}
                <p className="text-xs text-muted-foreground">
                  Vence sempre neste dia; a partir do término, escolhe a próxima ocorrência (dia {value.dueDayOfMonth || "X"}). Meses curtos usam o último dia.
                </p>
              </Field>
            )}

            {dueDateRule === AIRBRUSHING_DUE_DATE_RULE.FIXED_DATE && (
              <div className="space-y-2">
                <DateTimeInput
                  field={{
                    value: asDate(value.dueDate),
                    onChange: (next) => onChange({ dueDate: onlyDate(next) }),
                    onBlur: () => {},
                    name: `${idPrefix}.dueDate`,
                  }}
                  label="Data de Vencimento"
                  mode="date"
                  context="end"
                  disabled={disabled}
                  error={errors?.dueDate}
                />
                {/* CRAVADA: ao contrário de "Dia fixo do mês", esta data nunca é recalculada. */}
                <p className="text-xs text-muted-foreground">Data fixa — não muda se o término mudar.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Layouts — último bloco, com o mesmo rótulo nos dois modos. O `stopPropagation` protege
          o clique dentro do uploader quando o bloco vive numa linha clicável. */}
      {layoutsSlot && (
        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
          <FormLabel className="flex items-center gap-2">
            <IconPhoto className="h-4 w-4" />
            Layouts
          </FormLabel>
          {layoutsSlot}
        </div>
      )}
    </div>
  );
}

AirbrushingFields.displayName = "AirbrushingFields";
