import type { ReactNode } from "react";
import type { DateRange } from "react-day-picker";
import { FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { IconCircleCheck, IconInfoCircle, IconPhoto, IconReceipt2, IconUsersGroup } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { PainterSelector } from "./painter-selector";
import { ExecutionTimeInput, ExpectedFinishPreview, type ExecutionTimeValue } from "./execution-time-input";
import {
  AIRBRUSHING_STATUS,
  AIRBRUSHING_STATUS_LABELS,
  AIRBRUSHING_PAYMENT_STATUS,
  AIRBRUSHING_PAYMENT_STATUS_LABELS,
  AIRBRUSHING_DUE_DATE_RULE,
  AIRBRUSHING_DUE_DATE_RULE_LABELS,
  PAYMENT_METHOD,
  PAYMENT_METHOD_LABELS,
  EXECUTION_TIME_UNIT,
} from "../../../../constants";
import { AIRBRUSHING_CREATION_MODE, AIRBRUSHING_CREATION_MODE_LABELS, type AirbrushingCreationMode } from "@/schemas/airbrushing";
import { AIRBRUSHING_DEFAULT_PAYMENT_TERM_DAYS, computeExpectedFinishDate, resolveAirbrushingDueDate } from "@/utils/airbrushing";
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
  /** Término previsto — DERIVADO de início + tempo; só é digitado em aerografia antiga, sem tempo. */
  finishDate?: Date | string | null;
  /** Tempo de execução (inteiro 1–999) + unidade. Substitui o término digitável. */
  executionTime?: number | null;
  executionTimeUnit?: string | null;
  /** Orçamento de abertura da cotação: valor (sem ele não há orçamento) + tempo opcional. */
  quotationOfferAmount?: number | null;
  quotationOfferExecutionTime?: number | null;
  quotationOfferExecutionTimeUnit?: string | null;
  startedAt?: Date | string | null;
  finishedAt?: Date | string | null;
  painterId?: string | null;
  painter?: AirbrushingPainterRef | null;
  /**
   * Só numa aerografia NOVA: vai para cotação ou já foi aprovada fora do sistema. Campo de
   * formulário — `buildAirbrushingPayload` não o envia (ver `AIRBRUSHING_CREATION_MODE`).
   */
  creationMode?: AirbrushingCreationMode | null;
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
  /**
   * Aerografia AINDA NÃO GRAVADA. Ganha a escolha "Enviar para cotação" (padrão — a API a grava
   * em QUOTING por chegar sem aerografista; pintor, valor, status e datas reais nascem da
   * proposta selecionada) ou "Já aprovada" (pintor obrigatório, valor e status escolhidos aqui).
   */
  isNew?: boolean;
  /**
   * A aerografia está GRAVADA em cotação (status persistido QUOTING). Pintor e valor
   * ficam travados — só a seleção de uma proposta os define — e o status só pode
   * continuar em cotação ou ser cancelado (a API recusa o resto com 400).
   */
  quoting?: boolean;
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

// Fora de cotação, Em Cotação não é destino de edição: voltar para lá é o "Reabrir cotação"
// do detalhe. Em cotação, a única saída pelo formulário é cancelar.
const statusOptions: ComboboxOption[] = Object.values(AIRBRUSHING_STATUS)
  .filter((value) => value !== AIRBRUSHING_STATUS.QUOTING)
  .map((value) => ({ value, label: AIRBRUSHING_STATUS_LABELS[value] }));
const quotingStatusOptions: ComboboxOption[] = [AIRBRUSHING_STATUS.QUOTING, AIRBRUSHING_STATUS.CANCELLED].map((value) => ({
  value,
  label: AIRBRUSHING_STATUS_LABELS[value],
}));
const paymentStatusOptions: ComboboxOption[] = Object.values(AIRBRUSHING_PAYMENT_STATUS).map((value) => ({
  value,
  label: AIRBRUSHING_PAYMENT_STATUS_LABELS[value],
}));
const paymentMethodOptions: ComboboxOption[] = Object.values(PAYMENT_METHOD).map((value) => ({ value, label: PAYMENT_METHOD_LABELS[value] }));
const dueDateRuleOptions: ComboboxOption[] = Object.values(AIRBRUSHING_DUE_DATE_RULE).map((value) => ({
  value,
  label: AIRBRUSHING_DUE_DATE_RULE_LABELS[value],
}));

const creationModeOptions = [AIRBRUSHING_CREATION_MODE.QUOTATION, AIRBRUSHING_CREATION_MODE.APPROVED] as const;

/**
 * Escolha do nascimento de uma aerografia nova — dois botões de rádio lado a lado, compactos.
 * Trocar o modo reescreve os campos que dependem dele (ver `handleCreationModeChange`).
 */
function AirbrushingCreationModeControl({
  value,
  onChange,
  disabled,
  idPrefix,
}: {
  value: AirbrushingCreationMode;
  onChange: (next: AirbrushingCreationMode) => void;
  disabled?: boolean;
  idPrefix: string;
}) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(next) => onChange(next as AirbrushingCreationMode)}
      disabled={disabled}
      aria-label="Como esta aerografia entra no sistema"
      className="grid grid-cols-1 gap-2 sm:grid-cols-2"
    >
      {creationModeOptions.map((option) => {
        const id = `${idPrefix}-creation-mode-${option}`;
        const active = value === option;
        const Icon = option === AIRBRUSHING_CREATION_MODE.QUOTATION ? IconUsersGroup : IconCircleCheck;
        return (
          <label
            key={option}
            htmlFor={id}
            className={cn(
              "flex h-10 items-center gap-2.5 rounded-md border px-3 text-sm transition-colors",
              disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-muted/40",
              active ? "border-primary bg-primary/5 font-medium text-foreground" : "border-border text-muted-foreground",
            )}
          >
            <RadioGroupItem value={option} id={id} />
            <Icon className={cn("h-4 w-4 flex-shrink-0", active ? "text-primary" : "text-muted-foreground")} />
            <span className="truncate">{AIRBRUSHING_CREATION_MODE_LABELS[option]}</span>
          </label>
        );
      })}
    </RadioGroup>
  );
}

/** Aviso da cotação — o que acontece com pintor e valor enquanto a aerografia está em cotação. */
export function AirbrushingQuotationNotice({ isNew }: { isNew?: boolean }) {
  return (
    <div className="flex gap-3 rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-3 text-sm">
      <IconUsersGroup className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600 dark:text-indigo-400" />
      <div className="space-y-0.5">
        <p className="font-medium text-foreground">{isNew ? "Esta aerografia vai para cotação" : "Aerografia em cotação"}</p>
        <p className="text-muted-foreground">
          {isNew
            ? "Ao salvar, todos os aerografistas são avisados para enviar valor e tempo de execução. Aerografista, valor e pagamento são definidos depois que você selecionar uma proposta, no detalhe da aerografia."
            : "Aerografista, valor e pagamento são definidos ao selecionar uma proposta, no detalhe da aerografia. Por aqui, dá para ajustar o início e o orçamento de abertura, ou cancelar a cotação."}
        </p>
      </div>
    </div>
  );
}

/**
 * Bloco de campos de uma aerografia, compartilhado por criação e edição.
 *
 * Ordem (idêntica nos dois modos, e a mesma da revisão):
 *   1. Pintor | Descrição            (em cotação: Descrição | Início Previsto)
 *   2. Status | Status do Pagamento
 *   3. Início Previsto | Tempo de Execução + prévia do Término Previsto (calculado)
 *      (em cotação: Orçamento da empresa — valor + tempo, ambos opcionais)
 *   4. Iniciado em | Finalizado em
 *   5. Pagamento: Valor | Forma | Regra | campo da regra + prévia do vencimento (fora de cotação)
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
  isNew = false,
  quoting = false,
}: AirbrushingFieldsProps) {
  // Aerografia nova: o modo escolhido decide. Sem escolha registrada, vai para cotação.
  const creationMode: AirbrushingCreationMode = value.creationMode ?? AIRBRUSHING_CREATION_MODE.QUOTATION;
  const approvedAtCreation = isNew && creationMode === AIRBRUSHING_CREATION_MODE.APPROVED;
  // Nova indo para cotação, ou gravada em cotação: pintor e valor só nascem da proposta selecionada.
  const inQuotation = (isNew && !approvedAtCreation) || quoting;
  const status = value.status ?? (inQuotation ? AIRBRUSHING_STATUS.QUOTING : AIRBRUSHING_STATUS.PREPARATION);
  const isCompleted = status === AIRBRUSHING_STATUS.COMPLETED;
  const dueDateRule = value.dueDateRule ?? AIRBRUSHING_DUE_DATE_RULE.DAYS_AFTER_FINISH;
  // Em horas o horário do início importa (8 horas a partir das 9h terminam às 17h) — o
  // seletor de início ganha a hora; em dias, só a data.
  const timeUnitInPlay = inQuotation ? (value.quotationOfferExecutionTime ? value.quotationOfferExecutionTimeUnit : null) : value.executionTimeUnit;
  const startNeedsTime = timeUnitInPlay === EXECUTION_TIME_UNIT.HOURS;
  const hasOffer = value.quotationOfferAmount != null && value.quotationOfferAmount > 0;

  // A prévia usa a MESMA referência do servidor: término real quando existe, término
  // previsto enquanto o serviço não acabou.
  const previewDueDate = resolveAirbrushingDueDate(
    { dueDateRule, paymentTermDays: value.paymentTermDays, dueDayOfMonth: value.dueDayOfMonth, dueDate: value.dueDate },
    value.finishedAt ?? computeExpectedFinishDate(value.startDate, value.executionTime, value.executionTime ? (value.executionTimeUnit ?? EXECUTION_TIME_UNIT.DAYS) : null) ?? value.finishDate,
  );

  const handleStatusChange = (next: string) => {
    onChange({
      status: next,
      // O status de pagamento só faz sentido para aerografia concluída: volta a PENDENTE
      // sempre que o status sai de CONCLUÍDA.
      ...(next !== AIRBRUSHING_STATUS.COMPLETED ? { paymentStatus: AIRBRUSHING_PAYMENT_STATUS.PENDING } : {}),
    });
  };

  // Trocar o modo reescreve TUDO que depende dele, para a linha nunca misturar os dois:
  // cotação = sem pintor, sem valor, sem datas reais e Em Cotação; aprovada = Em Preparação.
  const handleCreationModeChange = (next: AirbrushingCreationMode) => {
    if (next === creationMode) return;
    if (next === AIRBRUSHING_CREATION_MODE.APPROVED) {
      // O orçamento de abertura só existe em cotação — a API o descartaria de qualquer jeito.
      onChange({
        creationMode: next,
        status: AIRBRUSHING_STATUS.PREPARATION,
        paymentStatus: AIRBRUSHING_PAYMENT_STATUS.PENDING,
        quotationOfferAmount: null,
        quotationOfferExecutionTime: null,
      });
      return;
    }
    // Em cotação o pagamento é definido depois (com o aerografista escolhido) e o tempo de
    // execução vem da proposta selecionada.
    onChange({
      creationMode: next,
      status: AIRBRUSHING_STATUS.QUOTING,
      paymentStatus: AIRBRUSHING_PAYMENT_STATUS.PENDING,
      painterId: null,
      painter: null,
      price: null,
      startedAt: null,
      finishedAt: null,
      finishDate: null,
      executionTime: null,
      paymentMethod: null,
      dueDateRule: AIRBRUSHING_DUE_DATE_RULE.DAYS_AFTER_FINISH,
      paymentTermDays: null,
      dueDayOfMonth: null,
      dueDate: null,
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

  const handleExecutionTimeChange = (next: ExecutionTimeValue) => {
    onChange({ executionTime: next.executionTime, executionTimeUnit: next.executionTimeUnit });
  };

  const startDateInput = (
    <DateTimeInput
      field={{
        value: asDate(value.startDate),
        onChange: (next) => onChange({ startDate: onlyDate(next) }),
        onBlur: () => {},
        name: `${idPrefix}.startDate`,
      }}
      label="Início Previsto"
      mode={startNeedsTime ? "datetime" : "date"}
      context="start"
      disabled={disabled}
      error={errors?.startDate}
    />
  );

  return (
    <div className="space-y-4">
      {isNew && (
        <AirbrushingCreationModeControl value={creationMode} onChange={handleCreationModeChange} disabled={disabled} idPrefix={idPrefix} />
      )}

      {inQuotation && <AirbrushingQuotationNotice isNew={isNew} />}

      {/* Linha 1: Pintor | Descrição. Em cotação o pintor some (ele é o da proposta
          selecionada) e o Início Previsto sobe para o lado da descrição. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {!inQuotation && (
          <Field
            label={
              <>
                Pintor
                {approvedAtCreation && <span className="text-destructive">*</span>}
              </>
            }
            error={errors?.painterId}
          >
            <PainterSelector
              value={value.painterId ?? undefined}
              onChange={(userId) => onChange({ painterId: userId ?? null })}
              initialUser={initialPainter ?? value.painter ?? undefined}
              disabled={disabled}
            />
          </Field>
        )}

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

        {inQuotation && startDateInput}
      </div>

      {/* Linha 2: Status | Status do Pagamento. Uma aerografia nova indo para cotação não tem
          status a escolher; a já aprovada escolhe (sem Em Cotação), mesmo onde o status fica
          escondido no cadastro. */}
      {((showStatus && !isNew) || approvedAtCreation) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Status" error={errors?.status}>
            <Combobox
              value={status}
              onValueChange={(next) => handleStatusChange((next as string) || AIRBRUSHING_STATUS.PREPARATION)}
              options={quoting ? quotingStatusOptions : statusOptions}
              placeholder="Selecione o status"
              searchable={false}
              clearable={false}
              disabled={disabled}
            />
          </Field>

          {canViewFinancials && !quoting && (
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

      {/* Linha 3: Início Previsto | Tempo de Execução — o término não se digita: sai dos dois. */}
      {!inQuotation && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {startDateInput}
          <Field label="Tempo de Execução" error={errors?.executionTime ?? errors?.executionTimeUnit}>
            <ExecutionTimeInput
              id={`${idPrefix}-execution-time`}
              value={value.executionTime}
              unit={value.executionTimeUnit}
              onChange={handleExecutionTimeChange}
              disabled={disabled}
              invalid={!!errors?.executionTime}
            />
            <ExpectedFinishPreview
              startDate={value.startDate}
              executionTime={value.executionTime}
              unit={value.executionTimeUnit}
              fallbackFinishDate={value.finishDate}
            />
          </Field>
        </div>
      )}

      {/* Orçamento da empresa — opcional, só em cotação. É dinheiro: some para quem não vê valores. */}
      {inQuotation && canViewFinancials && (
        <div className="space-y-3 rounded-lg border border-border/60 p-4">
          <div className="space-y-0.5">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <IconReceipt2 className="h-4 w-4 text-muted-foreground" />
              Orçamento da empresa
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Se você já tem um valor, os aerografistas podem aceitar, contrapropor ou recusar. Em branco, cada um envia o seu.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Valor" error={errors?.quotationOfferAmount}>
              <Input
                type="currency"
                value={value.quotationOfferAmount ?? undefined}
                onChange={(next) => onChange({ quotationOfferAmount: typeof next === "number" && next > 0 ? next : null })}
                placeholder="R$ 0,00"
                disabled={disabled}
                className="bg-transparent"
              />
            </Field>
            <Field
              label={
                <>
                  Tempo de Execução <span className="font-normal text-muted-foreground">(opcional)</span>
                </>
              }
              error={errors?.quotationOfferExecutionTime}
            >
              <ExecutionTimeInput
                id={`${idPrefix}-offer-execution-time`}
                value={value.quotationOfferExecutionTime}
                unit={value.quotationOfferExecutionTimeUnit}
                onChange={(next) =>
                  onChange({ quotationOfferExecutionTime: next.executionTime, quotationOfferExecutionTimeUnit: next.executionTimeUnit })
                }
                disabled={disabled || !hasOffer}
                placeholder={hasOffer ? "Ex.: 2" : "Informe o valor"}
              />
              {hasOffer && value.quotationOfferExecutionTime ? (
                <ExpectedFinishPreview
                  startDate={value.startDate}
                  executionTime={value.quotationOfferExecutionTime}
                  unit={value.quotationOfferExecutionTimeUnit}
                />
              ) : (
                <p className="text-xs text-muted-foreground">Sem tempo, cada aerografista informa o seu ao aceitar.</p>
              )}
            </Field>
          </div>
        </div>
      )}

      {/* Linha 4: datas reais — não existem antes de haver um aerografista. */}
      {showActualDates && !inQuotation && (
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
      {/* Em cotação não há pagamento a configurar: ele é definido depois de selecionado o
          aerografista (valor e prazo vêm da proposta). */}
      {canViewFinancials && !inQuotation && (
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
