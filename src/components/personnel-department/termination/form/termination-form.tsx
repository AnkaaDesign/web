import { useCallback, useMemo } from "react";
import { useForm, FormProvider, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconUserOff, IconUser, IconTag, IconBellRinging, IconCalendar, IconGavel, IconFileDescription, IconCash, IconShieldLock } from "@tabler/icons-react";

import {
  terminationCreateSchema,
  terminationUpdateSchema,
  type TerminationCreateFormData,
  type TerminationUpdateFormData,
} from "../../../../schemas/termination";
import type { Termination } from "../../../../types/termination";
import type { User } from "../../../../types";
import type { EmploymentContract } from "../../../../types/employment-contract";
import {
  TERMINATION_TYPE,
  TERMINATION_TYPE_LABELS,
  NOTICE_TYPE,
  NOTICE_TYPE_LABELS,
  NOTICE_REDUCTION_LABELS,
  CONTRACT_STATUS,
  STABILITY_TYPE_LABELS,
} from "../../../../constants";
import { getUsers } from "../../../../api-client";
import { formatDate } from "../../../../utils";
import { useUser } from "../../../../hooks/human-resources/use-user";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { FormMoneyInput } from "@/components/ui/form-money-input";

// Types for which the notice (aviso prévio) fields apply
const NOTICE_APPLICABLE_TYPES: string[] = [
  TERMINATION_TYPE.WITHOUT_CAUSE,
  TERMINATION_TYPE.INDIRECT,
  TERMINATION_TYPE.RESIGNATION,
  TERMINATION_TYPE.MUTUAL_AGREEMENT,
];

// Termination modalities that, when the contract has NO art. 481 clause, do NOT
// carry an aviso prévio regime (fixed-term / experiência / intermitente endings).
const FIXED_TERM_MODALITIES: string[] = [
  TERMINATION_TYPE.EXPERIENCE_END,
  TERMINATION_TYPE.EXPERIENCE_EARLY_EMPLOYER,
  TERMINATION_TYPE.EXPERIENCE_EARLY_EMPLOYEE,
  TERMINATION_TYPE.FIXED_TERM_EARLY_EMPLOYEE,
];

// SEM justa causa — the estabilidade guard blocks these (the api enforces it;
// WITH_CAUSE and DEATH are the legal exceptions).
const STABILITY_EXEMPT_TYPES: string[] = [TERMINATION_TYPE.WITH_CAUSE, TERMINATION_TYPE.DEATH];

/**
 * Mirror of the api `isUnderStability` (api/src/utils/contract-stability.ts):
 * the contract carries an active estabilidade window covering `date`.
 * Open start/end are treated as already-begun / indefinite; window is inclusive.
 */
function isContractUnderStability(contract: EmploymentContract | null | undefined, date: Date): boolean {
  if (!contract || !contract.stabilityType) return false;
  const ref = date.getTime();
  if (contract.stabilityStart && ref < new Date(contract.stabilityStart).getTime()) return false;
  if (contract.stabilityEnd && ref > new Date(contract.stabilityEnd).getTime()) return false;
  return true;
}

interface CreateModeProps {
  mode: "create";
  onSubmit: (data: TerminationCreateFormData) => Promise<void>;
}

interface UpdateModeProps {
  mode: "update";
  termination: Termination;
  onSubmit: (data: TerminationUpdateFormData) => Promise<void>;
}

type TerminationFormProps = (CreateModeProps | UpdateModeProps) & {
  isSubmitting?: boolean;
  /** Fully disables every field (e.g. completed/cancelled terminations). */
  disabled?: boolean;
};

export function TerminationForm(props: TerminationFormProps) {
  const termination = props.mode === "update" ? props.termination : undefined;

  const form = useForm<TerminationCreateFormData | TerminationUpdateFormData>({
    resolver: zodResolver(props.mode === "create" ? terminationCreateSchema : terminationUpdateSchema),
    defaultValues:
      props.mode === "create"
        ? {
            userId: "",
            type: undefined,
            noticeType: null,
            noticeReduction: undefined,
            noticeStartDate: null,
            terminationDate: null,
            baseRemuneration: null,
            fgtsBalance: null,
            accruedVacationPeriods: 0,
            reason: null,
            justCauseArticle: null,
          }
        : {
            noticeType: termination?.noticeType ?? null,
            noticeReduction: termination?.noticeReduction ?? undefined,
            noticeDays: termination?.noticeDays ?? null,
            noticeStartDate: termination?.noticeStartDate ? new Date(termination.noticeStartDate) : null,
            lastWorkingDate: termination?.lastWorkingDate ? new Date(termination.lastWorkingDate) : null,
            terminationDate: termination?.terminationDate ? new Date(termination.terminationDate) : null,
            paymentDate: termination?.paymentDate ? new Date(termination.paymentDate) : null,
            paidAmount: termination?.paidAmount ?? null,
            baseRemuneration: termination?.baseRemuneration ?? null,
            fgtsBalance: termination?.fgtsBalance ?? null,
            accruedVacationPeriods: termination?.accruedVacationPeriods ?? 0,
            reason: termination?.reason ?? null,
            justCauseArticle: termination?.justCauseArticle ?? null,
          },
  });

  const isSubmitting = props.isSubmitting || form.formState.isSubmitting;
  const fieldsDisabled = props.disabled || isSubmitting;

  // Watched type drives the conditional sections (in update mode the type is fixed)
  const watchedType = useWatch({ control: form.control, name: "type" as any });
  const currentType: string | undefined = props.mode === "update" ? termination?.type : watchedType;
  const watchedNoticeType = useWatch({ control: form.control, name: "noticeType" as any });
  const watchedTerminationDate = useWatch({ control: form.control, name: "terminationDate" as any });
  const watchedUserId = useWatch({ control: form.control, name: "userId" as any });

  // Fetch the selected collaborator's current vínculo (create mode) so the form
  // can surface the art. 481 clause and the estabilidade guard. In update mode
  // the termination already carries the user via the detail query include.
  const userIdForContract = props.mode === "create" ? (watchedUserId as string | undefined) : termination?.userId;
  const { data: userResponse } = useUser(userIdForContract || "", {
    include: { currentContract: true },
    enabled: !!userIdForContract,
  });

  // Current vínculo of the collaborator (drives art. 481 + estabilidade guard).
  const currentContract: EmploymentContract | null | undefined =
    userResponse?.data?.currentContract ?? (props.mode === "update" ? props.termination.user?.currentContract : undefined);
  const hasArt481Clause = !!currentContract?.hasArt481Clause;

  // art. 481 converts a fixed-term/experiência bond to the rescisão-antecipada
  // regime (aviso prévio applies like an indeterminate contract).
  const isFixedTermModality = !!currentType && FIXED_TERM_MODALITIES.includes(currentType);
  const showNoticeFields = !!currentType && (NOTICE_APPLICABLE_TYPES.includes(currentType) || (isFixedTermModality && hasArt481Clause));
  const showJustCauseArticle = currentType === TERMINATION_TYPE.WITH_CAUSE;

  // Estabilidade guard (mirrors the server; the api enforces it on submit).
  const stabilityRefDate = watchedTerminationDate instanceof Date ? watchedTerminationDate : new Date();
  const isUnderStability = isContractUnderStability(currentContract, stabilityRefDate);
  const stabilityExempt = !!currentType && STABILITY_EXEMPT_TYPES.includes(currentType);
  const stabilityBlocks = props.mode === "create" && isUnderStability && !!currentType && !stabilityExempt;

  // Type options
  const typeOptions = useMemo(() => Object.entries(TERMINATION_TYPE_LABELS).map(([value, label]) => ({ value, label })), []);
  const noticeTypeOptions = useMemo(() => Object.entries(NOTICE_TYPE_LABELS).map(([value, label]) => ({ value, label })), []);
  const noticeReductionOptions = useMemo(() => Object.entries(NOTICE_REDUCTION_LABELS).map(([value, label]) => ({ value, label })), []);

  // Async users query (active collaborators only — dismissed users can't be terminated again)
  const queryUsers = useCallback(async (search: string, page: number = 1) => {
    const queryParams: any = {
      page,
      take: 50,
      where: { currentContractStatus: { not: CONTRACT_STATUS.TERMINATED } },
      orderBy: { name: "asc" },
      include: { position: true },
    };

    if (search && search.trim()) {
      queryParams.searchingFor = search.trim();
    }

    const response = await getUsers(queryParams);

    return {
      data: response.data || [],
      hasMore: response.meta?.hasNextPage || false,
    };
  }, []);

  const getUserOptionLabel = useCallback((user: User) => user.name, []);
  const getUserOptionValue = useCallback((user: User) => user.id, []);
  const renderUserOption = useCallback(
    (user: User) => (
      <div>
        <p className="font-medium">{user.name}</p>
        {user.position && <p className="text-xs text-muted-foreground">{user.position.name}</p>}
      </div>
    ),
    [],
  );

  const handleTypeChange = (value: string | string[] | null | undefined, fieldOnChange: (value: any) => void) => {
    const type = Array.isArray(value) ? value[0] : value;
    fieldOnChange(type);

    // Clear fields that no longer apply to the chosen type
    if (!type || !NOTICE_APPLICABLE_TYPES.includes(type)) {
      form.setValue("noticeType" as any, null, { shouldDirty: true });
      form.setValue("noticeReduction" as any, undefined, { shouldDirty: true });
      form.setValue("noticeStartDate" as any, null, { shouldDirty: true });
    }
    if (type !== TERMINATION_TYPE.WITH_CAUSE) {
      form.setValue("justCauseArticle" as any, null, { shouldDirty: true });
    }
  };

  const handleSubmit = async (data: TerminationCreateFormData | TerminationUpdateFormData) => {
    try {
      if (props.mode === "create") {
        await props.onSubmit(data as TerminationCreateFormData);
      } else {
        await props.onSubmit(data as TerminationUpdateFormData);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error submitting termination form:", error);
      }
    }
  };

  return (
    <FormProvider {...form}>
      <form id="termination-form" onSubmit={form.handleSubmit(handleSubmit)} className="container mx-auto max-w-4xl">
        {/* Hidden submit button for external form submission */}
        <button id="termination-form-submit" type="submit" className="hidden" disabled={fieldsDisabled} />

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconUserOff className="h-5 w-5 text-muted-foreground" />
                Informações da Rescisão
              </CardTitle>
              <CardDescription>
                {props.mode === "create" ? "Identifique o colaborador e o tipo de desligamento" : "O colaborador e o tipo de rescisão não podem ser alterados"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Colaborador */}
                {props.mode === "create" ? (
                  <FormField
                    control={form.control}
                    name={"userId" as any}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          <div className="flex items-center gap-2">
                            <IconUser className="h-4 w-4" />
                            Colaborador <span className="text-destructive">*</span>
                          </div>
                        </FormLabel>
                        <FormControl>
                          <Combobox<User>
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={fieldsDisabled}
                            placeholder="Selecione o colaborador"
                            emptyText="Nenhum colaborador encontrado"
                            searchPlaceholder="Buscar colaborador..."
                            async={true}
                            queryKey={["users", "termination-collaborator"]}
                            queryFn={queryUsers}
                            initialOptions={[]}
                            getOptionLabel={getUserOptionLabel}
                            getOptionValue={getUserOptionValue}
                            renderOption={renderUserOption}
                            minSearchLength={0}
                            pageSize={50}
                            debounceMs={300}
                            searchable={true}
                            clearable={true}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <FormItem>
                    <FormLabel>
                      <div className="flex items-center gap-2">
                        <IconUser className="h-4 w-4" />
                        Colaborador
                      </div>
                    </FormLabel>
                    <Input value={termination?.user?.name || "-"} disabled readOnly />
                  </FormItem>
                )}

                {/* Tipo */}
                {props.mode === "create" ? (
                  <FormField
                    control={form.control}
                    name={"type" as any}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          <div className="flex items-center gap-2">
                            <IconTag className="h-4 w-4" />
                            Tipo de Rescisão <span className="text-destructive">*</span>
                          </div>
                        </FormLabel>
                        <FormControl>
                          <Combobox
                            mode="single"
                            value={field.value}
                            onValueChange={(value) => handleTypeChange(value, field.onChange)}
                            options={typeOptions}
                            disabled={fieldsDisabled}
                            placeholder="Selecione o tipo de rescisão"
                            emptyText="Nenhum tipo encontrado"
                            searchPlaceholder="Buscar tipo..."
                            clearable={false}
                            searchable={true}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <FormItem>
                    <FormLabel>
                      <div className="flex items-center gap-2">
                        <IconTag className="h-4 w-4" />
                        Tipo de Rescisão
                      </div>
                    </FormLabel>
                    <Input value={termination ? TERMINATION_TYPE_LABELS[termination.type] || termination.type : "-"} disabled readOnly />
                  </FormItem>
                )}

                {/* Data da Rescisão */}
                <FormField
                  control={form.control}
                  name={"terminationDate" as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <DateTimeInput
                          mode="date"
                          value={field.value}
                          onChange={(date) => field.onChange(date instanceof Date ? date : null)}
                          label={
                            <div className="flex items-center gap-2">
                              <IconCalendar className="h-4 w-4" />
                              Data da Rescisão
                            </div>
                          }
                          disabled={fieldsDisabled}
                          placeholder="Selecione a data da rescisão"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Último Dia Trabalhado (update only) */}
                {props.mode === "update" && (
                  <FormField
                    control={form.control}
                    name={"lastWorkingDate" as any}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <DateTimeInput
                            mode="date"
                            value={field.value}
                            onChange={(date) => field.onChange(date instanceof Date ? date : null)}
                            label={
                              <div className="flex items-center gap-2">
                                <IconCalendar className="h-4 w-4" />
                                Último Dia Trabalhado
                              </div>
                            }
                            disabled={fieldsDisabled}
                            placeholder="Selecione o último dia trabalhado"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Artigo (justa causa) */}
                {showJustCauseArticle && (
                  <FormField
                    control={form.control}
                    name={"justCauseArticle" as any}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          <div className="flex items-center gap-2">
                            <IconGavel className="h-4 w-4" />
                            Artigo
                          </div>
                        </FormLabel>
                        <FormControl>
                          <Input
                            value={field.value ?? ""}
                            onChange={(value) => field.onChange(value === "" || value === null ? null : String(value))}
                            disabled={fieldsDisabled}
                            placeholder="CLT art. 482, alínea ..."
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* Estabilidade guard — block dispensa SEM justa causa inside a
                  stability window. The api enforces this; surface it here. */}
              {stabilityBlocks && (
                <Alert variant="destructive">
                  <AlertDescription>
                    <span className="flex items-center gap-2 font-medium">
                      <IconShieldLock className="h-4 w-4 flex-shrink-0" />
                      Colaborador em período de estabilidade
                    </span>
                    <span className="mt-1 block">
                      {currentContract?.stabilityType ? `${STABILITY_TYPE_LABELS[currentContract.stabilityType]} — ` : ""}
                      vigente
                      {currentContract?.stabilityStart ? ` de ${formatDate(new Date(currentContract.stabilityStart))}` : ""}
                      {currentContract?.stabilityEnd ? ` até ${formatDate(new Date(currentContract.stabilityEnd))}` : ""}.
                      Não é possível registrar este desligamento: durante a estabilidade só são permitidas demissão por justa causa ou rescisão por falecimento. O
                      cadastro será recusado pelo servidor.
                    </span>
                  </AlertDescription>
                </Alert>
              )}

              {/* Estabilidade informativa quando o tipo é isento (justa causa / falecimento) */}
              {isUnderStability && stabilityExempt && (
                <Alert variant="warning">
                  <AlertDescription>
                    O colaborador está em período de estabilidade
                    {currentContract?.stabilityType ? ` (${STABILITY_TYPE_LABELS[currentContract.stabilityType]})` : ""}. Este tipo de rescisão é uma exceção legal e
                    pode prosseguir — confirme a fundamentação antes de avançar.
                  </AlertDescription>
                </Alert>
              )}

              {/* art. 481 — cláusula assecuratória do direito recíproco de rescisão */}
              {isFixedTermModality && hasArt481Clause && (
                <Alert>
                  <AlertDescription>
                    <span className="flex items-center gap-2 font-medium">
                      <IconGavel className="h-4 w-4 flex-shrink-0" />
                      Cláusula assecuratória (CLT art. 481)
                    </span>
                    <span className="mt-1 block">
                      O contrato a prazo deste colaborador contém a cláusula assecuratória do direito recíproco de rescisão antecipada. A rescisão antecipada segue,
                      portanto, as regras do contrato por prazo <strong>indeterminado</strong> (aviso prévio aplicável e multa de 40% do FGTS), e não a indenização dos
                      arts. 479/480.
                    </span>
                  </AlertDescription>
                </Alert>
              )}

              {/* art. 480 — rescisão antecipada de contrato a prazo PELO EMPREGADO */}
              {currentType === TERMINATION_TYPE.FIXED_TERM_EARLY_EMPLOYEE && !hasArt481Clause && (
                <Alert variant="warning">
                  <AlertDescription>
                    Rescisão antecipada do contrato a prazo por iniciativa do <strong>empregado</strong> (CLT art. 480): será lançada a indenização devida{" "}
                    <strong>pelo colaborador</strong> à empresa, limitada à metade da remuneração a que teria direito até o término do contrato. Não há aviso prévio nem
                    multa de 40% do FGTS.
                  </AlertDescription>
                </Alert>
              )}

              {/* art. 479 — rescisão antecipada pelo EMPREGADOR (experiência) */}
              {currentType === TERMINATION_TYPE.EXPERIENCE_EARLY_EMPLOYER && !hasArt481Clause && (
                <Alert>
                  <AlertDescription>
                    Rescisão antecipada da experiência por iniciativa do <strong>empregador</strong> (CLT art. 479): a empresa indeniza o colaborador em metade da
                    remuneração devida até o término do período de experiência.
                  </AlertDescription>
                </Alert>
              )}

              {/* Encerramento de contrato intermitente */}
              {currentType === TERMINATION_TYPE.INTERMITTENT_END && (
                <Alert>
                  <AlertDescription>
                    Encerramento de contrato de trabalho intermitente (CLT art. 452-A): as verbas são apuradas sobre os períodos efetivamente trabalhados. Não há aviso
                    prévio nas regras gerais do vínculo intermitente; confira as parcelas calculadas.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Aviso Prévio — only for the types where it applies */}
          {showNoticeFields && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconBellRinging className="h-5 w-5 text-muted-foreground" />
                  Aviso Prévio
                </CardTitle>
                <CardDescription>Informações do aviso prévio (quando aplicável ao tipo de rescisão)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name={"noticeType" as any}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Aviso</FormLabel>
                        <FormControl>
                          <Combobox
                            mode="single"
                            value={field.value ?? undefined}
                            onValueChange={(value) => field.onChange(value || null)}
                            options={noticeTypeOptions}
                            disabled={fieldsDisabled}
                            placeholder="Selecione o tipo de aviso"
                            emptyText="Nenhum tipo encontrado"
                            clearable={true}
                            searchable={false}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Redução só é relevante para aviso trabalhado */}
                  {watchedNoticeType === NOTICE_TYPE.WORKED && (
                    <FormField
                      control={form.control}
                      name={"noticeReduction" as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Redução do Aviso</FormLabel>
                          <FormControl>
                            <Combobox
                              mode="single"
                              value={field.value ?? undefined}
                              onValueChange={(value) => field.onChange(value || undefined)}
                              options={noticeReductionOptions}
                              disabled={fieldsDisabled}
                              placeholder="Selecione a redução"
                              emptyText="Nenhuma opção encontrada"
                              clearable={true}
                              searchable={false}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name={"noticeStartDate" as any}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <DateTimeInput
                            mode="date"
                            value={field.value}
                            onChange={(date) => field.onChange(date instanceof Date ? date : null)}
                            label="Início do Aviso"
                            disabled={fieldsDisabled}
                            placeholder="Selecione o início do aviso"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Dias de Aviso (override, update only — o servidor calcula no cadastro) */}
                  {props.mode === "update" && (
                    <FormField
                      control={form.control}
                      name={"noticeDays" as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dias de Aviso</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              value={field.value ?? ""}
                              onChange={(value) => field.onChange(value === "" || value === null ? null : Number(value))}
                              disabled={fieldsDisabled}
                              placeholder="Calculado automaticamente"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                {/* CLT 487 §2º: resignation with unworked notice generates a discount */}
                {currentType === TERMINATION_TYPE.RESIGNATION && watchedNoticeType === NOTICE_TYPE.INDEMNIFIED && (
                  <Alert variant="warning">
                    <AlertDescription>
                      Pedido de demissão com aviso indenizado pelo colaborador: o cálculo lançará automaticamente o desconto do aviso prévio não
                      cumprido (CLT 487 §2º). Se a empresa dispensou o cumprimento do aviso, selecione "Dispensado".
                    </AlertDescription>
                  </Alert>
                )}

                {/* CLT 484-A: mutual agreement halves the indemnified notice */}
                {currentType === TERMINATION_TYPE.MUTUAL_AGREEMENT && watchedNoticeType === NOTICE_TYPE.INDEMNIFIED && (
                  <Alert>
                    <AlertDescription>
                      Acordo mútuo (CLT 484-A): o aviso prévio indenizado é pago pela metade e a multa do FGTS é de 20%. As demais verbas são integrais.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {/* Valores */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconCash className="h-5 w-5 text-muted-foreground" />
                Valores
              </CardTitle>
              <CardDescription>Base de cálculo das verbas rescisórias</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormMoneyInput name={"baseRemuneration" as any} label="Remuneração Base" disabled={fieldsDisabled} />
                <FormMoneyInput name={"fgtsBalance" as any} label="Saldo FGTS" disabled={fieldsDisabled} />

                <FormField
                  control={form.control}
                  name={"accruedVacationPeriods" as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Períodos de Férias Vencidas</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          value={field.value ?? ""}
                          onChange={(value) => field.onChange(value === "" || value === null ? 0 : Number(value))}
                          disabled={fieldsDisabled}
                          placeholder="0"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {props.mode === "update" && (
                  <>
                    <FormField
                      control={form.control}
                      name={"paymentDate" as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <DateTimeInput
                              mode="date"
                              value={field.value}
                              onChange={(date) => field.onChange(date instanceof Date ? date : null)}
                              label="Data de Pagamento"
                              disabled={fieldsDisabled}
                              placeholder="Selecione a data de pagamento"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormMoneyInput name={"paidAmount" as any} label="Valor Pago" disabled={fieldsDisabled} />
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Motivo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconFileDescription className="h-5 w-5 text-muted-foreground" />
                Motivo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name={"reason" as any}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.value)}
                        disabled={fieldsDisabled}
                        placeholder="Descreva o motivo da rescisão (opcional)"
                        rows={4}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {props.mode === "create" && (
                <Alert>
                  <AlertDescription>
                    Os dias de aviso prévio, a projeção do contrato e o prazo de pagamento (10 dias corridos — CLT 477 §6º) são calculados automaticamente e exibidos nos
                    detalhes após o cadastro.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </form>
    </FormProvider>
  );
}
