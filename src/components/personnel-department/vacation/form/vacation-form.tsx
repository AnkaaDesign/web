import { useCallback, useMemo, useState, useEffect } from "react";
import { useForm, FormProvider, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { IconBeach, IconUser, IconCalendar, IconFileDescription, IconCash, IconCalendarStats } from "@tabler/icons-react";

import { vacationUpdateSchema, type VacationUpdateFormData } from "../../../../schemas/vacation";
import type { Vacation } from "../../../../types/vacation";

// Create form schema — multi-select colaboradores. The page bulk-creates one
// (single-period) vacation per selected user; the server derives each one's
// acquisitive period from the colaborador's admission.
const vacationCreateFormSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1, { message: "Selecione ao menos um colaborador" }),
  startDate: z.coerce.date().nullish(),
  days: z.coerce.number().int().min(1).max(30),
  unjustifiedAbsencesInPeriod: z.coerce.number().int().min(0).optional(),
  abonoPecuniarioDays: z.coerce.number().int().min(0).max(10).optional(),
  soldThird: z.boolean().optional(),
  notes: z.string().nullish(),
});

export interface VacationCreateSubmit {
  userIds: string[];
  startDate?: Date | null;
  days: number;
  unjustifiedAbsencesInPeriod?: number;
  abonoPecuniarioDays?: number;
  soldThird?: boolean;
  notes?: string | null;
}
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

  const handleSubmit = async (data: any) => {
    try {
      if (props.mode === "create") {
        await props.onSubmit({
          userIds: data.userIds,
          startDate: data.startDate ?? null,
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
                  ? "Selecione um ou mais colaboradores — uma férias é criada para cada um, com o período aquisitivo derivado da sua admissão"
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
            </CardContent>
          </Card>

          {/* Período de gozo desta tomada (create + update) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconCalendar className="h-5 w-5 text-muted-foreground" />
                Período de Gozo
              </CardTitle>
              <CardDescription>
                Informe o início e a quantidade de dias deste gozo. Para fracionar, cadastre outra tomada no mesmo período aquisitivo.
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
                          label="Início do gozo"
                          disabled={fieldsDisabled}
                          placeholder="Selecione a data (opcional)"
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
