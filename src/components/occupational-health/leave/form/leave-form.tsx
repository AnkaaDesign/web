import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconCalendarOff, IconUser, IconNotes } from "@tabler/icons-react";

import type { Leave } from "../../../../types/leave";
import type { User } from "../../../../types";
import { leaveCreateSchema, leaveUpdateSchema, type LeaveCreateFormData, type LeaveUpdateFormData } from "../../../../schemas/leave";
import { routes, LEAVE_TYPE, LEAVE_STATUS, LEAVE_TYPE_LABELS, INSS_BENEFIT_SPECIES_LABELS } from "../../../../constants";
import { useLeaveMutations } from "../../../../hooks/occupational-health/use-leaves";
import { userService } from "../../../../api-client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { FormCombobox } from "@/components/ui/form-combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const INSS_TYPES: string[] = [LEAVE_TYPE.ILLNESS_INSS, LEAVE_TYPE.WORK_ACCIDENT];

interface CreateModeProps {
  mode: "create";
  onSubmit?: (data: LeaveCreateFormData) => Promise<void>;
  defaultValues?: Partial<LeaveCreateFormData>;
}

interface UpdateModeProps {
  mode: "update";
  leave: Leave;
  onSubmit?: (data: LeaveUpdateFormData) => Promise<void>;
  defaultValues?: Partial<LeaveUpdateFormData>;
}

type LeaveFormProps = (CreateModeProps | UpdateModeProps) & {
  isSubmitting?: boolean;
};

export function LeaveForm(props: LeaveFormProps) {
  const navigate = useNavigate();
  const leaveMutations = useLeaveMutations();

  const createDefaults: Partial<LeaveCreateFormData> = {
    userId: "",
    type: "" as any,
    status: LEAVE_STATUS.SCHEDULED,
    startDate: new Date(),
    expectedEndDate: null,
    cid: "",
    inssBenefitNumber: "",
    inssBenefitSpecies: null,
    notes: "",
    ...(props.defaultValues || {}),
  };

  const updateDefaults: Partial<LeaveUpdateFormData> =
    props.mode === "update"
      ? {
          userId: props.leave.userId,
          type: props.leave.type,
          startDate: new Date(props.leave.startDate),
          expectedEndDate: props.leave.expectedEndDate ? new Date(props.leave.expectedEndDate) : null,
          cid: props.leave.cid ?? "",
          inssBenefitNumber: props.leave.inssBenefitNumber ?? "",
          inssBenefitSpecies: props.leave.inssBenefitSpecies ?? null,
          notes: props.leave.notes ?? "",
          ...(props.defaultValues || {}),
        }
      : {};

  const form = useForm<LeaveCreateFormData | LeaveUpdateFormData>({
    resolver: zodResolver((props.mode === "create" ? leaveCreateSchema : leaveUpdateSchema) as any),
    defaultValues: props.mode === "create" ? createDefaults : updateDefaults,
    mode: "onTouched",
    reValidateMode: "onChange",
    shouldFocusError: true,
  });

  const isSubmitting = props.isSubmitting || form.formState.isSubmitting;

  const selectedType = form.watch("type");
  const showInssBenefitNumber = INSS_TYPES.includes(selectedType as string);

  // Static options for the leave type select
  const typeOptions = useMemo(() => Object.entries(LEAVE_TYPE_LABELS).map(([value, label]) => ({ value, label })), []);

  // Static options for the INSS benefit species select
  const inssSpeciesOptions = useMemo(() => Object.entries(INSS_BENEFIT_SPECIES_LABELS).map(([value, label]) => ({ value, label })), []);

  // Async user combobox helpers
  const initialUserOptions = useMemo(() => (props.mode === "update" && props.leave.user ? [props.leave.user] : []), [props.mode === "update" ? props.leave.user?.id : undefined]);

  const getUserOptionLabel = useCallback((user: User) => user.name, []);
  const getUserOptionValue = useCallback((user: User) => user.id, []);

  const queryUsers = useCallback(async (search: string, page: number = 1) => {
    const queryParams: any = {
      page,
      take: 50,
      orderBy: { name: "asc" },
      include: { position: true },
    };

    if (search && search.trim()) {
      queryParams.searchingFor = search.trim();
    }

    const response = await userService.getUsers(queryParams);

    return {
      data: response.data || [],
      hasMore: response.meta?.hasNextPage || false,
    };
  }, []);

  const renderUserOption = useCallback(
    (user: User) => (
      <div>
        <p className="font-medium">{user.name}</p>
        {user.position && <p className="text-xs text-muted-foreground">{user.position.name}</p>}
      </div>
    ),
    [],
  );

  const handleSubmit = async (data: LeaveCreateFormData | LeaveUpdateFormData) => {
    try {
      // Normalize optional text fields (empty string → null)
      const cleaned = {
        ...data,
        cid: data.cid?.trim() ? data.cid.trim() : null,
        inssBenefitNumber: showInssBenefitNumber && data.inssBenefitNumber?.trim() ? data.inssBenefitNumber.trim() : null,
        inssBenefitSpecies: showInssBenefitNumber && data.inssBenefitSpecies ? data.inssBenefitSpecies : null,
        notes: data.notes?.trim() ? data.notes.trim() : null,
      };

      if (props.onSubmit) {
        await props.onSubmit(cleaned as any);
        return;
      }

      if (props.mode === "create") {
        const result = await leaveMutations.createAsync(cleaned as LeaveCreateFormData);
        if (result.data?.id) {
          navigate(routes.occupationalHealth.leaves.details(result.data.id));
        } else {
          navigate(routes.occupationalHealth.leaves.root);
        }
      } else {
        await leaveMutations.updateAsync({
          id: props.leave.id,
          data: cleaned as LeaveUpdateFormData,
        });
        navigate(routes.occupationalHealth.leaves.details(props.leave.id));
      }
    } catch (error) {
      // Error toast is handled by the API client
      if (process.env.NODE_ENV !== "production") {
        console.error("Error submitting leave form:", error);
      }
    }
  };

  return (
    <FormProvider {...form}>
      <form id="leave-form" onSubmit={form.handleSubmit(handleSubmit)} className="container mx-auto max-w-4xl">
        {/* Hidden submit button for external form submission */}
        <button id="leave-form-submit" type="submit" className="hidden" disabled={isSubmitting} />

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconCalendarOff className="h-5 w-5 text-muted-foreground" />
                Informações do Afastamento
              </CardTitle>
              <CardDescription>Preencha as informações do afastamento do colaborador</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Collaborator */}
              <FormField
                control={form.control}
                name="userId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>
                      <div className="flex items-center gap-2">
                        <IconUser className="h-4 w-4" />
                        Colaborador {props.mode === "create" && <span className="text-destructive">*</span>}
                      </div>
                    </FormLabel>
                    <FormControl>
                      <Combobox<User>
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={isSubmitting}
                        placeholder="Selecione o colaborador"
                        emptyText="Nenhum colaborador encontrado"
                        searchPlaceholder="Buscar colaborador..."
                        async={true}
                        queryKey={["users", "leave-form"]}
                        queryFn={queryUsers}
                        initialOptions={initialUserOptions}
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

              {/* Type */}
              <FormCombobox
                name="type"
                label="Tipo de Afastamento"
                placeholder="Selecione o tipo"
                options={typeOptions}
                disabled={isSubmitting}
                required={props.mode === "create"}
              />

              {/* Dates */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => <DateTimeInput field={field as any} label="Data de Início" mode="date" context="start" disabled={isSubmitting} required={props.mode === "create"} />}
                />

                <FormField
                  control={form.control}
                  name="expectedEndDate"
                  render={({ field }) => <DateTimeInput field={field as any} label="Término Previsto" mode="date" context="end" disabled={isSubmitting} />}
                />
              </div>

              {/* CID + INSS benefit number */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="cid"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CID</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} placeholder="Ex: M54.5" disabled={isSubmitting} transparent={true} maxLength={20} />
                      </FormControl>
                      <FormDescription>Acesso restrito — visível apenas para Contabilidade/RH/Administração</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {showInssBenefitNumber && (
                  <FormField
                    control={form.control}
                    name="inssBenefitNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nº do Benefício INSS</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} placeholder="Número do benefício" disabled={isSubmitting} transparent={true} maxLength={50} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {showInssBenefitNumber && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <FormCombobox
                    name="inssBenefitSpecies"
                    label="Espécie do Benefício INSS"
                    placeholder="Selecione a espécie"
                    options={inssSpeciesOptions}
                    disabled={isSubmitting}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconNotes className="h-5 w-5 text-muted-foreground" />
                Observações
              </CardTitle>
              <CardDescription>Informações adicionais sobre o afastamento</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea {...field} value={field.value ?? ""} placeholder="Observações sobre o afastamento (opcional)" disabled={isSubmitting} rows={4} maxLength={1000} />
                    </FormControl>
                    <FormMessage />
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
