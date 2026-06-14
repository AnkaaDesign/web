import { useMemo, useCallback } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconClipboardPlus, IconUser, IconId, IconCalendarEvent, IconNotes, IconCalendarOff } from "@tabler/icons-react";

import { WORK_ACCIDENT_REPORT_TYPE_LABELS, LEAVE_TYPE, LEAVE_TYPE_LABELS } from "../../../../constants";
import { getUsers } from "../../../../api-client";
import { getLeaves } from "../../../../api-client/leave";
import type { User } from "../../../../types";
import type { Leave } from "../../../../types/leave";
import {
  workAccidentReportCreateSchema,
  workAccidentReportUpdateSchema,
  type WorkAccidentReportCreateFormData,
  type WorkAccidentReportUpdateFormData,
} from "@/schemas/work-accident";
import type { WorkAccidentReport } from "@/types/work-accident";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { DateTimeInput } from "@/components/ui/date-time-input";

interface CreateModeProps {
  mode: "create";
  onSubmit: (data: WorkAccidentReportCreateFormData) => Promise<void>;
  defaultValues?: Partial<WorkAccidentReportCreateFormData>;
}

interface UpdateModeProps {
  mode: "update";
  report: WorkAccidentReport;
  onSubmit: (data: WorkAccidentReportUpdateFormData) => Promise<void>;
  defaultValues?: Partial<WorkAccidentReportUpdateFormData>;
}

type WorkAccidentFormProps = (CreateModeProps | UpdateModeProps) & {
  isSubmitting?: boolean;
};

const typeOptions = Object.entries(WORK_ACCIDENT_REPORT_TYPE_LABELS).map(([value, label]) => ({ value, label }));

export function WorkAccidentForm(props: WorkAccidentFormProps) {
  const form = useForm<WorkAccidentReportCreateFormData | WorkAccidentReportUpdateFormData>({
    resolver: zodResolver(props.mode === "create" ? workAccidentReportCreateSchema : workAccidentReportUpdateSchema),
    defaultValues:
      props.mode === "create"
        ? {
            userId: "",
            leaveId: null,
            type: "" as any,
            catNumber: "",
            accidentDate: null,
            emissionDate: null,
            description: "",
            confirmStability: false,
            ...(props.defaultValues || {}),
          }
        : {
            leaveId: props.report.leaveId ?? null,
            type: props.report.type,
            catNumber: props.report.catNumber ?? "",
            accidentDate: props.report.accidentDate ? new Date(props.report.accidentDate) : null,
            emissionDate: props.report.emissionDate ? new Date(props.report.emissionDate) : null,
            description: props.report.description ?? "",
            confirmStability: false,
            ...(props.defaultValues || {}),
          },
    mode: "onTouched",
    reValidateMode: "onChange",
  });

  const isSubmitting = props.isSubmitting || form.formState.isSubmitting;

  const selectedUserId = form.watch("userId" as any) as string | undefined;
  const effectiveUserId = props.mode === "update" ? props.report.userId : selectedUserId;

  // Async user combobox
  const initialUserOptions = useMemo(
    () => (props.mode === "update" && props.report.user ? [props.report.user] : []),
    [props.mode === "update" ? props.report.user?.id : null],
  );
  const getUserLabel = useCallback((u: User) => u.name, []);
  const getUserValue = useCallback((u: User) => u.id, []);

  const queryUsers = useCallback(async (search: string, page: number = 1) => {
    const queryParams: any = { page, take: 50, orderBy: { name: "asc" }, include: { position: true } };
    if (search && search.trim()) queryParams.searchingFor = search.trim();
    const response = await getUsers(queryParams);
    return { data: response.data || [], hasMore: response.meta?.hasNextPage || false };
  }, []);

  const renderUserOption = useCallback(
    (u: User) => (
      <div>
        <p className="font-medium">{u.name}</p>
        {u.position && <p className="text-xs text-muted-foreground">{u.position.name}</p>}
      </div>
    ),
    [],
  );

  // Async leave combobox (WORK_ACCIDENT leaves of the selected user)
  const initialLeaveOptions = useMemo(
    () => (props.mode === "update" && props.report.leave ? [props.report.leave] : []),
    [props.mode === "update" ? props.report.leave?.id : null],
  );
  const getLeaveLabel = useCallback((l: Leave) => `${LEAVE_TYPE_LABELS[l.type as keyof typeof LEAVE_TYPE_LABELS] || l.type} — ${new Date(l.startDate).toLocaleDateString("pt-BR")}`, []);
  const getLeaveValue = useCallback((l: Leave) => l.id, []);

  const queryLeaves = useCallback(
    async (search: string, page: number = 1) => {
      if (!effectiveUserId) return { data: [], hasMore: false };
      const queryParams: any = {
        page,
        take: 50,
        orderBy: { startDate: "desc" },
        where: { userId: effectiveUserId, type: LEAVE_TYPE.WORK_ACCIDENT },
      };
      if (search && search.trim()) queryParams.searchingFor = search.trim();
      const response = await getLeaves(queryParams);
      return { data: response.data || [], hasMore: response.meta?.hasNextPage || false };
    },
    [effectiveUserId],
  );

  const handleSubmit = async (data: WorkAccidentReportCreateFormData | WorkAccidentReportUpdateFormData) => {
    try {
      const payload = {
        ...data,
        catNumber: data.catNumber?.trim() ? data.catNumber.trim() : null,
        description: data.description?.trim() ? data.description.trim() : null,
        leaveId: data.leaveId || null,
      };
      if (props.mode === "create") {
        await props.onSubmit(payload as WorkAccidentReportCreateFormData);
      } else {
        await props.onSubmit(payload as WorkAccidentReportUpdateFormData);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error submitting work-accident form:", error);
      }
    }
  };

  return (
    <FormProvider {...form}>
      <form id="work-accident-form" onSubmit={form.handleSubmit(handleSubmit)} className="container mx-auto max-w-4xl">
        <button id="work-accident-form-submit" type="submit" className="hidden" disabled={isSubmitting} />

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconClipboardPlus className="h-5 w-5 text-muted-foreground" />
                Comunicação de Acidente de Trabalho (CAT)
              </CardTitle>
              <CardDescription>Registre a CAT do colaborador. A estabilidade acidentária (12 meses) é aplicada a partir do retorno do afastamento vinculado.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Colaborador */}
                {props.mode === "create" && (
                  <FormField
                    control={form.control}
                    name="userId"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>
                          <div className="flex items-center gap-2">
                            <IconUser className="h-4 w-4" />
                            Colaborador <span className="text-destructive">*</span>
                          </div>
                        </FormLabel>
                        <FormControl>
                          <Combobox<User>
                            value={field.value}
                            onValueChange={(value) => {
                              field.onChange(value);
                              // Reset leave selection when changing collaborator
                              form.setValue("leaveId", null);
                            }}
                            disabled={isSubmitting}
                            placeholder="Selecione o colaborador"
                            emptyText="Nenhum colaborador encontrado"
                            searchPlaceholder="Buscar colaborador..."
                            async={true}
                            queryKey={["users", "work-accident-form"]}
                            queryFn={queryUsers}
                            initialOptions={initialUserOptions}
                            getOptionLabel={getUserLabel}
                            getOptionValue={getUserValue}
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
                )}

                {/* Tipo */}
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <div className="flex items-center gap-2">
                          <IconId className="h-4 w-4" />
                          Tipo de CAT {props.mode === "create" && <span className="text-destructive">*</span>}
                        </div>
                      </FormLabel>
                      <FormControl>
                        <Combobox
                          mode="single"
                          value={field.value}
                          onValueChange={field.onChange}
                          options={typeOptions}
                          disabled={isSubmitting}
                          placeholder="Selecione o tipo"
                          emptyText="Nenhum tipo encontrado"
                          searchable={false}
                          clearable={false}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Nº da CAT + datas */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="catNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nº da CAT</FormLabel>
                      <FormControl>
                        <Input value={field.value ?? ""} onChange={(value) => field.onChange(value === null ? "" : String(value))} placeholder="Número da CAT" disabled={isSubmitting} maxLength={50} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="accidentDate"
                  render={({ field }) => <DateTimeInput field={field as any} label="Data do acidente" mode="date" context="start" disabled={isSubmitting} />}
                />

                <FormField
                  control={form.control}
                  name="emissionDate"
                  render={({ field }) => <DateTimeInput field={field as any} label="Data de emissão" mode="date" disabled={isSubmitting} />}
                />
              </div>

              {/* Afastamento vinculado */}
              <FormField
                control={form.control}
                name="leaveId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>
                      <div className="flex items-center gap-2">
                        <IconCalendarOff className="h-4 w-4" />
                        Afastamento vinculado (acidente de trabalho)
                      </div>
                    </FormLabel>
                    <FormControl>
                      <Combobox<Leave>
                        value={field.value ?? undefined}
                        onValueChange={(value) => field.onChange(value || null)}
                        disabled={isSubmitting || !effectiveUserId}
                        placeholder={effectiveUserId ? "Selecione o afastamento (opcional)" : "Selecione um colaborador primeiro"}
                        emptyText="Nenhum afastamento de acidente encontrado"
                        searchPlaceholder="Buscar afastamento..."
                        async={true}
                        queryKey={["leaves", "work-accident-form", effectiveUserId ?? ""]}
                        queryFn={queryLeaves}
                        initialOptions={initialLeaveOptions}
                        getOptionLabel={getLeaveLabel}
                        getOptionValue={getLeaveValue}
                        minSearchLength={0}
                        pageSize={50}
                        debounceMs={300}
                        searchable={true}
                        clearable={true}
                      />
                    </FormControl>
                    <FormDescription>Vincule o afastamento por acidente para que a estabilidade acidentária (12 meses) seja calculada a partir do retorno.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Descrição */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <div className="flex items-center gap-2">
                        <IconNotes className="h-4 w-4" />
                        Descrição do acidente
                      </div>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                        placeholder="Descreva como ocorreu o acidente..."
                        disabled={isSubmitting}
                        rows={4}
                        className="resize-none"
                        maxLength={2000}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Confirmar estabilidade acidentária */}
              <FormField
                control={form.control}
                name="confirmStability"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start gap-3 rounded-lg border border-border p-4">
                    <FormControl>
                      <Checkbox checked={!!field.value} onCheckedChange={field.onChange} disabled={isSubmitting} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="flex items-center gap-2">
                        <IconCalendarEvent className="h-4 w-4" />
                        Aplicar estabilidade acidentária (12 meses)
                      </FormLabel>
                      <FormDescription>
                        Quando marcado e houver afastamento vinculado, registra a estabilidade de 12 meses a partir do retorno — bloqueando o desligamento durante a janela.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </div>
      </form>
    </FormProvider>
  );
}
