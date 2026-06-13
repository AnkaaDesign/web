import { useCallback, useMemo } from "react";
import { useForm, FormProvider, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconUserOff, IconUser, IconTag, IconBellRinging, IconCalendar, IconGavel, IconFileDescription, IconCash } from "@tabler/icons-react";

import {
  terminationCreateSchema,
  terminationUpdateSchema,
  type TerminationCreateFormData,
  type TerminationUpdateFormData,
} from "../../../../schemas/termination";
import type { Termination } from "../../../../types/termination";
import type { User } from "../../../../types";
import {
  TERMINATION_TYPE,
  TERMINATION_TYPE_LABELS,
  NOTICE_TYPE,
  NOTICE_TYPE_LABELS,
  NOTICE_REDUCTION_LABELS,
  CONTRACT_STATUS,
} from "../../../../constants";
import { getUsers } from "../../../../api-client";

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

  const showNoticeFields = !!currentType && NOTICE_APPLICABLE_TYPES.includes(currentType);
  const showJustCauseArticle = currentType === TERMINATION_TYPE.WITH_CAUSE;

  // Type options
  const typeOptions = useMemo(() => Object.entries(TERMINATION_TYPE_LABELS).map(([value, label]) => ({ value, label })), []);
  const noticeTypeOptions = useMemo(() => Object.entries(NOTICE_TYPE_LABELS).map(([value, label]) => ({ value, label })), []);
  const noticeReductionOptions = useMemo(() => Object.entries(NOTICE_REDUCTION_LABELS).map(([value, label]) => ({ value, label })), []);

  // Async users query (active collaborators only — dismissed users can't be terminated again)
  const queryUsers = useCallback(async (search: string, page: number = 1) => {
    const queryParams: any = {
      page,
      take: 50,
      where: { currentContractStatus: { not: CONTRACT_STATUS.DISMISSED } },
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
