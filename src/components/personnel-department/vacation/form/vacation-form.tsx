import { useCallback, useMemo, useState, useEffect } from "react";
import { useForm, FormProvider, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconBeach, IconUser, IconCalendar, IconFileDescription, IconCash, IconCalendarStats } from "@tabler/icons-react";

import {
  vacationCreateSchema,
  vacationUpdateSchema,
  type VacationCreateFormData,
  type VacationUpdateFormData,
} from "../../../../schemas/vacation";
import type { Vacation } from "../../../../types/vacation";
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
import { DateTimeInput } from "@/components/ui/date-time-input";
import { formatDate } from "../../../../utils";

import { entitledDaysFromAbsences, deriveVacationPeriods, type FracionamentoPeriod } from "./vacation-art130";
import { FracionamentoEditor } from "./fracionamento-editor";

interface CreateModeProps {
  mode: "create";
  onSubmit: (data: VacationCreateFormData) => Promise<void>;
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

export function VacationForm(props: VacationFormProps) {
  const vacation = props.mode === "update" ? props.vacation : undefined;

  const form = useForm<VacationCreateFormData | VacationUpdateFormData>({
    resolver: zodResolver(props.mode === "create" ? vacationCreateSchema : vacationUpdateSchema),
    defaultValues:
      props.mode === "create"
        ? {
            userId: "",
            contractId: null,
            acquisitiveStart: undefined,
            acquisitiveEnd: undefined,
            unjustifiedAbsencesInPeriod: 0,
            abonoPecuniarioDays: 0,
            soldThird: false,
            notes: null,
            periods: [],
          }
        : {
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

  // Selected collaborator (create) → derives the contract & período aquisitivo.
  const watchedUserId = useWatch({ control: form.control, name: "userId" as any });
  const { data: selectedUserResponse } = useUser(props.mode === "create" ? (watchedUserId as string) || "" : "", {
    include: { position: true, sector: true, currentContract: true },
    enabled: props.mode === "create" && !!watchedUserId,
  });
  const selectedUser: User | null = (selectedUserResponse?.data as User | undefined) ?? null;

  const watchedAbsences = useWatch({ control: form.control, name: "unjustifiedAbsencesInPeriod" as any });
  const watchedAbono = useWatch({ control: form.control, name: "abonoPecuniarioDays" as any });

  // Entitled days are editable but seeded from art. 130 scale by absences.
  const [entitledDays, setEntitledDays] = useState<number>(props.mode === "update" ? vacation?.entitledDays ?? 30 : 30);
  const [entitledManuallySet, setEntitledManuallySet] = useState(false);

  // When absences change and the user hasn't manually overridden entitledDays,
  // recompute from the art. 130 scale.
  useEffect(() => {
    if (!entitledManuallySet) {
      setEntitledDays(entitledDaysFromAbsences(Number(watchedAbsences) || 0));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedAbsences]);

  // Fracionamento periods (create only; edit uses the dedicated /periods endpoint on the detail page).
  const [periods, setPeriods] = useState<FracionamentoPeriod[]>([]);

  const vacationDaysToSplit = Math.max(0, entitledDays - (Number(watchedAbono) || 0));

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
      // Vacations can only be created for employed (non-terminated) collaborators.
      where: { isActive: true },
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

  // Keep contractId synced with the resolved current contract of the selected user.
  useEffect(() => {
    if (props.mode !== "create") return;
    form.setValue("contractId" as any, selectedUser?.currentContract?.id ?? null, { shouldDirty: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser?.currentContract?.id]);

  const handleUserChange = (value: string | string[] | null | undefined, fieldOnChange: (value: any) => void) => {
    const userId = Array.isArray(value) ? value[0] : value;
    fieldOnChange(userId ?? "");
  };

  const handleSubmit = async (data: VacationCreateFormData | VacationUpdateFormData) => {
    try {
      if (props.mode === "create") {
        const createData = data as VacationCreateFormData;
        const filledPeriods = periods.filter((p) => p.startDate && p.days).map((p) => ({ startDate: p.startDate as Date, days: Number(p.days) }));
        await props.onSubmit({
          ...createData,
          // entitledDays is derived/overridden client-side; the service also stores it.
          ...(derived ? { acquisitiveStart: derived.acquisitiveStart, acquisitiveEnd: derived.acquisitiveEnd } : {}),
          periods: filledPeriods.length > 0 ? filledPeriods : undefined,
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
                  ? "Selecione o colaborador — o período aquisitivo é derivado da admissão do vínculo atual"
                  : "O colaborador e o vínculo não podem ser alterados"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
                          onValueChange={(value) => handleUserChange(value, field.onChange)}
                          disabled={fieldsDisabled}
                          placeholder="Selecione o colaborador"
                          emptyText="Nenhum colaborador encontrado"
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

          {/* Dias e abono */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconCalendarStats className="h-5 w-5 text-muted-foreground" />
                Dias de Direito e Abono
              </CardTitle>
              <CardDescription>
                Os dias de direito seguem a escala do art. 130 conforme as faltas injustificadas no período (editável).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name={"unjustifiedAbsencesInPeriod" as any}
                  render={({ field }) => (
                    <FormItem>
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

                <FormItem>
                  <FormLabel>Dias de Direito (art. 130)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={30}
                      value={entitledDays}
                      onChange={(value) => {
                        setEntitledManuallySet(true);
                        setEntitledDays(value === "" || value === null ? 0 : Number(value));
                      }}
                      disabled={fieldsDisabled}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sugerido pela escala: {entitledDaysFromAbsences(Number(watchedAbsences) || 0)} dias
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

              <p className="text-xs text-muted-foreground">
                Escala do art. 130: até 5 faltas → 30 dias · 6–14 → 24 · 15–23 → 18 · 24–32 → 12 · acima de 32 → 0.
              </p>

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

              {/* Prominent dias de gozo summary */}
              <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Dias de gozo</p>
                  <p className="text-xs text-muted-foreground">Direito ({entitledDays}) − abono ({Number(watchedAbono) || 0})</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold tabular-nums text-primary">{vacationDaysToSplit}</span>
                  <span className="ml-1 text-sm text-muted-foreground">dias</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Fracionamento (create only) */}
          {props.mode === "create" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconCalendar className="h-5 w-5 text-muted-foreground" />
                  Fracionamento (opcional)
                </CardTitle>
                <CardDescription>Divida o gozo em até 3 períodos. Deixe vazio para um único período.</CardDescription>
              </CardHeader>
              <CardContent>
                <FracionamentoEditor periods={periods} onChange={setPeriods} vacationDaysToSplit={vacationDaysToSplit} disabled={fieldsDisabled} />
              </CardContent>
            </Card>
          )}

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
                    A base de cálculo (remuneração + média de variáveis), 1/3 constitucional, INSS e IRRF são calculados no recibo de férias, disponível nos detalhes após o cadastro.
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
