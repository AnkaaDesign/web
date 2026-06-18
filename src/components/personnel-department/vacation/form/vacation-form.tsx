import { useCallback, useMemo, useState } from "react";
import { useForm, FormProvider, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { IconBeach, IconUser, IconCalendar, IconFileDescription, IconCash, IconCalendarStats, IconUsersGroup, IconChevronDown, IconAdjustments } from "@tabler/icons-react";

import { vacationUpdateSchema, type VacationUpdateFormData } from "../../../../schemas/vacation";
import type { Vacation } from "../../../../types/vacation";

// Create form schema — multi-select colaboradores. The page bulk-creates one
// (single-period) vacation per selected user via POST /vacations/batch; the
// server derives each one's acquisitive period from the colaborador's admission
// and auto-calculates the recibo. startDate is required (create-and-schedule).
const vacationCreateFormSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1, { message: "Selecione ao menos um colaborador" }),
  startDate: z.coerce.date({ required_error: "A data de início é obrigatória", invalid_type_error: "data de início inválida" }),
  days: z.coerce.number().int().min(1).max(30),
  unjustifiedAbsencesInPeriod: z.coerce.number().int().min(0).optional(),
  abonoPecuniarioDays: z.coerce.number().int().min(0).max(10).optional(),
  soldThird: z.boolean().optional(),
  notes: z.string().nullish(),
});

export interface VacationCreateSubmit {
  userIds: string[];
  startDate: Date;
  days: number;
  unjustifiedAbsencesInPeriod?: number;
  abonoPecuniarioDays?: number;
  soldThird?: boolean;
  notes?: string | null;
}
import { EMPLOYEE_TYPE } from "../../../../constants";
import type { User } from "../../../../types";
import { getUsers } from "../../../../api-client";
import { useUser } from "../../../../hooks/human-resources/use-user";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { cn } from "@/lib/utils";
import { formatDate } from "../../../../utils";

import { entitledDaysFromAbsences, deriveVacationPeriods } from "./vacation-art130";

interface CreateModeProps {
  mode: "create";
  onSubmit: (data: VacationCreateSubmit) => Promise<void>;
}

interface UpdateModeProps {
  mode: "update";
  vacation: Vacation;
  onSubmit: (data: VacationUpdateFormData) => Promise<void>;
}

type VacationFormProps = (CreateModeProps | UpdateModeProps) & {
  isSubmitting?: boolean;
  disabled?: boolean;
};

// Eligibility query: active (não-desligado) colaboradores CLT (folha de
// pagamento) — espelha o gate CLT do servidor (isPayrollEmployeeType).
const ELIGIBLE_VACATION_WHERE = { isActive: true, where: { currentEmployeeType: EMPLOYEE_TYPE.CLT } } as const;

export function VacationForm(props: VacationFormProps) {
  const vacation = props.mode === "update" ? props.vacation : undefined;

  const form = useForm<any>({
    resolver: zodResolver(props.mode === "create" ? vacationCreateFormSchema : vacationUpdateSchema),
    defaultValues:
      props.mode === "create"
        ? {
            userIds: [],
            startDate: null,
            days: 30,
            unjustifiedAbsencesInPeriod: 0,
            abonoPecuniarioDays: 0,
            soldThird: false,
            notes: null,
          }
        : {
            startDate: vacation?.startDate ? new Date(vacation.startDate) : null,
            days: vacation?.days ?? undefined,
            unjustifiedAbsencesInPeriod: vacation?.unjustifiedAbsencesInPeriod ?? 0,
            abonoPecuniarioDays: vacation?.abonoPecuniarioDays ?? 0,
            soldThird: vacation?.soldThird ?? false,
            acquisitiveStart: vacation?.acquisitiveStart ? new Date(vacation.acquisitiveStart) : undefined,
            acquisitiveEnd: vacation?.acquisitiveEnd ? new Date(vacation.acquisitiveEnd) : undefined,
            paymentDate: vacation?.paymentDate ? new Date(vacation.paymentDate) : null,
            notes: vacation?.notes ?? null,
          },
  });

  const isSubmitting = props.isSubmitting || form.formState.isSubmitting;
  const fieldsDisabled = props.disabled || isSubmitting;
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);

  // Selected collaborators (create, multi-select). The período aquisitivo preview
  // only makes sense for a single selection; with many, each is derived server-side.
  const watchedUserIds = (useWatch({ control: form.control, name: "userIds" as any }) as string[] | undefined) ?? [];
  const singleUserId = props.mode === "create" && watchedUserIds.length === 1 ? watchedUserIds[0] : "";
  const { data: selectedUserResponse } = useUser(singleUserId, {
    include: { position: true, sector: true, currentContract: true },
    enabled: props.mode === "create" && !!singleUserId,
  });
  const selectedUser: User | null = (selectedUserResponse?.data as User | undefined) ?? null;

  const watchedAbsences = useWatch({ control: form.control, name: "unjustifiedAbsencesInPeriod" as any });
  const watchedAbono = useWatch({ control: form.control, name: "abonoPecuniarioDays" as any });

  // Entitled days are derived (read-only) from the art. 130 scale by absences.
  // On update, the persisted entitled days are shown.
  const entitledDays =
    props.mode === "update" ? vacation?.entitledDays ?? 30 : entitledDaysFromAbsences(Number(watchedAbsences) || 0);

  // Gozo de direito available for this period (entitled − abono).
  const gozoEntitled = Math.max(0, entitledDays - (Number(watchedAbono) || 0));

  // Derived período aquisitivo/concessivo for display (create).
  const derived = useMemo(() => {
    const admission = selectedUser?.currentContract?.admissionDate;
    if (!admission) return null;
    return deriveVacationPeriods(new Date(admission));
  }, [selectedUser]);

  const queryUsers = useCallback(async (search: string, page: number = 1) => {
    const queryParams: any = {
      page,
      take: 50,
      orderBy: { name: "asc" },
      ...ELIGIBLE_VACATION_WHERE,
      include: { position: true, sector: true, currentContract: true },
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

  // "Coletiva / Todos" — fetch every eligible active CLT colaborador (paginated)
  // and select them all at once.
  const handleSelectAll = useCallback(async () => {
    setSelectingAll(true);
    try {
      const ids: string[] = [];
      let page = 1;
      // Cap pages defensively so a runaway dataset can't loop forever.
      for (let i = 0; i < 50; i++) {
        const response = await getUsers({ page, take: 100, orderBy: { name: "asc" }, ...ELIGIBLE_VACATION_WHERE } as any);
        for (const u of response.data || []) ids.push(u.id);
        if (!response.meta?.hasNextPage) break;
        page += 1;
      }
      form.setValue("userIds", Array.from(new Set(ids)), { shouldValidate: true, shouldDirty: true });
    } finally {
      setSelectingAll(false);
    }
  }, [form]);

  const handleSubmit = async (data: any) => {
    try {
      if (props.mode === "create") {
        await props.onSubmit({
          userIds: data.userIds,
          startDate: data.startDate,
          days: Number(data.days),
          unjustifiedAbsencesInPeriod: Number(data.unjustifiedAbsencesInPeriod) || 0,
          abonoPecuniarioDays: Number(data.abonoPecuniarioDays) || 0,
          soldThird: !!data.soldThird,
          notes: data.notes ?? null,
        });
      } else {
        await props.onSubmit(data as VacationUpdateFormData);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error submitting vacation form:", error);
      }
    }
  };

  return (
    <FormProvider {...form}>
      <form id="vacation-form" onSubmit={form.handleSubmit(handleSubmit)} className="container mx-auto max-w-4xl">
        <button id="vacation-form-submit" type="submit" className="hidden" disabled={fieldsDisabled} />

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconBeach className="h-5 w-5 text-muted-foreground" />
                Informações das Férias
              </CardTitle>
              <CardDescription>
                {props.mode === "create"
                  ? "Selecione um ou mais colaboradores (ou Coletiva / Todos) — uma férias é criada para cada um, com o período aquisitivo derivado da sua admissão e o recibo calculado automaticamente"
                  : "O colaborador e o vínculo não podem ser alterados"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Colaborador */}
              {props.mode === "create" ? (
                <FormField
                  control={form.control}
                  name={"userIds" as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <div className="flex items-center gap-2">
                          <IconUser className="h-4 w-4" />
                          Colaboradores <span className="text-destructive">*</span>
                        </div>
                      </FormLabel>
                      <FormControl>
                        <Combobox<User>
                          mode="multiple"
                          value={(field.value as string[]) ?? []}
                          onValueChange={field.onChange}
                          disabled={fieldsDisabled}
                          placeholder="Selecione um ou mais colaboradores"
                          emptyText="Nenhum colaborador CLT ativo encontrado"
                          searchPlaceholder="Buscar colaborador..."
                          async={true}
                          queryKey={["users", "vacation-collaborator"]}
                          queryFn={queryUsers}
                          initialOptions={[]}
                          getOptionLabel={(user) => user.name}
                          getOptionValue={(user) => user.id}
                          renderOption={(user) => (
                            <div>
                              <p className="font-medium">{user.name}</p>
                              {user.position && <p className="text-xs text-muted-foreground">{user.position.name}</p>}
                            </div>
                          )}
                          minSearchLength={0}
                          pageSize={50}
                          debounceMs={300}
                          searchable={true}
                          clearable={true}
                          fixedTopContent={
                            <button
                              type="button"
                              onClick={handleSelectAll}
                              disabled={selectingAll || fieldsDisabled}
                              className={cn(
                                "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium",
                                "hover:bg-accent focus:bg-accent focus:outline-none disabled:opacity-50",
                              )}
                            >
                              <IconUsersGroup className="h-4 w-4 text-primary" />
                              <span>Coletiva / Todos</span>
                              <span className="ml-auto text-xs text-muted-foreground">
                                {selectingAll ? "Selecionando..." : "Selecionar todos os CLT ativos"}
                              </span>
                            </button>
                          }
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
                  <Input value={vacation?.user?.name || "-"} disabled readOnly />
                </FormItem>
              )}

              {/* Derived cargo/setor preview once a colaborador is picked (create) */}
              {props.mode === "create" && selectedUser && (selectedUser.position?.name || selectedUser.sector?.name) && (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                  {selectedUser.position?.name && (
                    <span>
                      <span className="text-muted-foreground">Cargo: </span>
                      <span className="font-medium">{selectedUser.position.name}</span>
                    </span>
                  )}
                  {selectedUser.sector?.name && (
                    <span>
                      <span className="text-muted-foreground">Setor: </span>
                      <span className="font-medium">{selectedUser.sector.name}</span>
                    </span>
                  )}
                </div>
              )}

              {/* Computed/derived período aquisitivo + concessivo (create) */}
              {props.mode === "create" && selectedUser && (
                derived ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <IconCalendar className="h-3.5 w-3.5" />
                        Período aquisitivo
                      </div>
                      <p className="mt-1 text-sm font-semibold">
                        {formatDate(derived.acquisitiveStart)} — {formatDate(derived.acquisitiveEnd)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <IconCalendarStats className="h-3.5 w-3.5" />
                        Limite concessivo (art. 134)
                      </div>
                      <p className="mt-1 text-sm font-semibold">{formatDate(derived.concessiveEnd)}</p>
                    </div>
                  </div>
                ) : (
                  <Alert variant="warning">
                    <AlertDescription>
                      O colaborador selecionado não possui data de admissão no vínculo atual. O período aquisitivo será derivado pelo servidor.
                    </AlertDescription>
                  </Alert>
                )
              )}

              {/* Multi-selection: período aquisitivo é individual por colaborador */}
              {props.mode === "create" && watchedUserIds.length > 1 && (
                <Alert>
                  <AlertDescription>
                    {watchedUserIds.length} colaboradores selecionados — uma férias será criada para cada um, com o período aquisitivo e o limite concessivo derivados
                    individualmente da admissão de cada colaborador.
                  </AlertDescription>
                </Alert>
              )}

              {props.mode === "update" && vacation && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <div className="text-xs text-muted-foreground">Período aquisitivo</div>
                    <p className="mt-1 text-sm font-semibold">
                      {vacation.acquisitiveStart ? formatDate(new Date(vacation.acquisitiveStart)) : "-"} — {vacation.acquisitiveEnd ? formatDate(new Date(vacation.acquisitiveEnd)) : "-"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <div className="text-xs text-muted-foreground">Limite concessivo</div>
                    <p className="mt-1 text-sm font-semibold">{vacation.concessiveEnd ? formatDate(new Date(vacation.concessiveEnd)) : "-"}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Período de gozo desta tomada (create + update) — startDate first-class */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconCalendar className="h-5 w-5 text-muted-foreground" />
                Período de Gozo
              </CardTitle>
              <CardDescription>
                Informe o início (obrigatório) e a quantidade de dias deste gozo. Para fracionar, cadastre outra tomada no mesmo período aquisitivo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name={"startDate" as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <DateTimeInput
                          mode="date"
                          value={field.value as Date | null | undefined}
                          onChange={(date) => field.onChange(date instanceof Date ? date : null)}
                          label="Início do gozo *"
                          disabled={fieldsDisabled}
                          placeholder="Selecione a data de início"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={"days" as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Dias de gozo <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={30}
                          value={field.value ?? ""}
                          onChange={(value) => field.onChange(value === "" || value === null ? undefined : Number(value))}
                          disabled={fieldsDisabled}
                          placeholder="30"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Dias de direito (read-only) + abono */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconCalendarStats className="h-5 w-5 text-muted-foreground" />
                Dias de Direito e Abono
              </CardTitle>
              <CardDescription>
                Os dias de direito seguem a escala do art. 130 conforme as faltas injustificadas no período (somente leitura).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Dias de Direito — read-only (derivado da escala art. 130) */}
                <FormItem>
                  <FormLabel>Dias de Direito (art. 130)</FormLabel>
                  <FormControl>
                    <Input type="number" value={entitledDays} disabled readOnly />
                  </FormControl>
                  <p className="text-xs text-muted-foreground mt-1">
                    Derivado das faltas injustificadas em "Ajustes avançados".
                  </p>
                </FormItem>

                <FormField
                  control={form.control}
                  name={"abonoPecuniarioDays" as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Abono Pecuniário (0–10)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={10}
                          value={field.value ?? 0}
                          onChange={(value) => field.onChange(value === "" || value === null ? 0 : Number(value))}
                          disabled={fieldsDisabled}
                          placeholder="0"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name={"soldThird" as any}
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-md border border-border p-3">
                    <div>
                      <FormLabel className="cursor-pointer">Vender 1/3 das férias (abono)</FormLabel>
                      <p className="text-xs text-muted-foreground">Converte parte das férias em abono pecuniário (art. 143 CLT).</p>
                    </div>
                    <FormControl>
                      <Switch checked={!!field.value} onCheckedChange={field.onChange} disabled={fieldsDisabled} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Prominent dias de gozo de direito summary */}
              <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Gozo de direito</p>
                  <p className="text-xs text-muted-foreground">Direito ({entitledDays}) − abono ({Number(watchedAbono) || 0})</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold tabular-nums text-primary">{gozoEntitled}</span>
                  <span className="ml-1 text-sm text-muted-foreground">dias</span>
                </div>
              </div>

              {/* Ajustes avançados — faltas injustificadas (afeta a escala art. 130) */}
              <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="ghost" className="w-full justify-between px-2">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <IconAdjustments className="h-4 w-4" />
                      Ajustes avançados
                    </span>
                    <IconChevronDown className={cn("h-4 w-4 transition-transform", advancedOpen && "rotate-180")} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-3">
                  <FormField
                    control={form.control}
                    name={"unjustifiedAbsencesInPeriod" as any}
                    render={({ field }) => (
                      <FormItem className="max-w-xs">
                        <FormLabel>Faltas Injustificadas</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            value={field.value ?? 0}
                            onChange={(value) => field.onChange(value === "" || value === null ? 0 : Number(value))}
                            disabled={fieldsDisabled}
                            placeholder="0"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <p className="text-xs text-muted-foreground">
                    Escala do art. 130: até 5 faltas → 30 dias · 6–14 → 24 · 15–23 → 18 · 24–32 → 12 · acima de 32 → 0.
                  </p>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>

          {/* Pagamento (update) */}
          {props.mode === "update" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconCash className="h-5 w-5 text-muted-foreground" />
                  Pagamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                </div>
              </CardContent>
            </Card>
          )}

          {/* Observações */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconFileDescription className="h-5 w-5 text-muted-foreground" />
                Observações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name={"notes" as any}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.value)}
                        disabled={fieldsDisabled}
                        placeholder="Observações sobre as férias (opcional)"
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {props.mode === "create" && (
                <Alert>
                  <AlertDescription>
                    A base de cálculo (remuneração + média de variáveis), 1/3 constitucional, INSS e IRRF são calculados automaticamente no recibo de férias ao cadastrar, disponível nos detalhes.
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
