import { useMemo, useCallback } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconStethoscope, IconUser, IconNotes } from "@tabler/icons-react";

import { MEDICAL_EXAM_TYPE_LABELS } from "../../../../constants";
import { getUsers } from "../../../../api-client";
import type { User } from "../../../../types";
import {
  medicalExamCreateSchema,
  medicalExamUpdateSchema,
  type MedicalExamCreateFormData,
  type MedicalExamUpdateFormData,
} from "@/schemas/medical-exam";
import type { MedicalExam } from "@/types/medical-exam";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DateTimeInput } from "@/components/ui/date-time-input";

interface CreateModeProps {
  mode: "create";
  onSubmit: (data: MedicalExamCreateFormData) => Promise<void>;
  defaultValues?: Partial<MedicalExamCreateFormData>;
  /** Lock (disable) the Colaborador + Tipo fields — used when pre-filling from an admission/termination process. */
  lockIdentityFields?: boolean;
  /** Pre-loaded collaborator so the locked Colaborador field shows the name (avoids an extra fetch). */
  initialUser?: User | null;
}

interface UpdateModeProps {
  mode: "update";
  exam: MedicalExam;
  onSubmit: (data: MedicalExamUpdateFormData) => Promise<void>;
  defaultValues?: Partial<MedicalExamUpdateFormData>;
}

type MedicalExamFormProps = (CreateModeProps | UpdateModeProps) & {
  isSubmitting?: boolean;
};

const typeOptions = Object.entries(MEDICAL_EXAM_TYPE_LABELS).map(([value, label]) => ({ value, label }));

export function MedicalExamForm(props: MedicalExamFormProps) {
  const form = useForm<MedicalExamCreateFormData | MedicalExamUpdateFormData>({
    resolver: zodResolver(props.mode === "create" ? medicalExamCreateSchema : medicalExamUpdateSchema),
    defaultValues:
      props.mode === "create"
        ? {
            userId: "",
            type: "" as any,
            scheduledAt: null,
            clinic: "",
            physicianName: "",
            crm: "",
            notes: "",
            ...(props.defaultValues || {}),
          }
        : {
            userId: props.exam.userId,
            type: props.exam.type,
            scheduledAt: props.exam.scheduledAt ? new Date(props.exam.scheduledAt) : null,
            clinic: props.exam.clinic ?? "",
            physicianName: props.exam.physicianName ?? "",
            crm: props.exam.crm ?? "",
            notes: props.exam.notes ?? "",
            ...(props.defaultValues || {}),
          },
    mode: "onTouched",
    reValidateMode: "onChange",
  });

  const isSubmitting = props.isSubmitting || form.formState.isSubmitting;
  // When pre-filled from an admission/termination, lock the identity fields so
  // the exam can only be created for the intended collaborator/type.
  const lockIdentityFields = props.mode === "create" && !!props.lockIdentityFields;

  // Async user combobox helpers
  const initialUserOptions = useMemo(
    () => (props.mode === "update" && props.exam.user ? [props.exam.user] : props.mode === "create" && props.initialUser ? [props.initialUser] : []),
    [props.mode === "update" ? props.exam.user?.id : null, props.mode === "create" ? props.initialUser?.id : null],
  );
  const getOptionLabel = useCallback((user: User) => user.name, []);
  const getOptionValue = useCallback((user: User) => user.id, []);

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

    const response = await getUsers(queryParams);

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

  const handleSubmit = async (data: MedicalExamCreateFormData | MedicalExamUpdateFormData) => {
    try {
      const payload = {
        ...data,
        clinic: data.clinic || null,
        physicianName: data.physicianName || null,
        crm: data.crm || null,
        notes: data.notes || null,
      };

      if (props.mode === "create") {
        await props.onSubmit(payload as MedicalExamCreateFormData);
      } else {
        await props.onSubmit(payload as MedicalExamUpdateFormData);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error submitting medical exam form:", error);
      }
    }
  };

  return (
    <FormProvider {...form}>
      <form id="medical-exam-form" onSubmit={form.handleSubmit(handleSubmit)} className="container mx-auto max-w-4xl">
        {/* Hidden submit button for external form submission */}
        <button id="medical-exam-form-submit" type="submit" className="hidden" disabled={isSubmitting} />

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconStethoscope className="h-5 w-5 text-muted-foreground" />
                Informações do Exame
              </CardTitle>
              <CardDescription>Preencha as informações do exame ocupacional (ASO)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Colaborador */}
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
                          disabled={isSubmitting || lockIdentityFields}
                          placeholder="Selecione o colaborador"
                          emptyText="Nenhum colaborador encontrado"
                          searchPlaceholder="Buscar colaborador..."
                          async={true}
                          queryKey={["users", "medical-exam-form"]}
                          queryFn={queryUsers}
                          initialOptions={initialUserOptions}
                          getOptionLabel={getOptionLabel}
                          getOptionValue={getOptionValue}
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

                {/* Tipo */}
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <div className="flex items-center gap-2">
                          <IconStethoscope className="h-4 w-4" />
                          Tipo de Exame {props.mode === "create" && <span className="text-destructive">*</span>}
                        </div>
                      </FormLabel>
                      <FormControl>
                        <Combobox
                          mode="single"
                          value={field.value}
                          onValueChange={field.onChange}
                          options={typeOptions}
                          disabled={isSubmitting || lockIdentityFields}
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

              {/* Agendamento */}
              <FormField
                control={form.control}
                name="scheduledAt"
                render={({ field }) => (
                  <DateTimeInput field={field as any} label="Agendado para" mode="date" context="scheduled" disabled={isSubmitting} />
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Clínica */}
                <FormField
                  control={form.control}
                  name="clinic"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Clínica</FormLabel>
                      <FormControl>
                        <Input
                          value={field.value ?? ""}
                          onChange={(value) => field.onChange(value === null ? "" : String(value))}
                          placeholder="Nome da clínica"
                          disabled={isSubmitting}
                          maxLength={200}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Médico */}
                <FormField
                  control={form.control}
                  name="physicianName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Médico</FormLabel>
                      <FormControl>
                        <Input
                          value={field.value ?? ""}
                          onChange={(value) => field.onChange(value === null ? "" : String(value))}
                          placeholder="Nome do médico"
                          disabled={isSubmitting}
                          maxLength={200}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* CRM */}
                <FormField
                  control={form.control}
                  name="crm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CRM</FormLabel>
                      <FormControl>
                        <Input
                          value={field.value ?? ""}
                          onChange={(value) => field.onChange(value === null ? "" : String(value))}
                          placeholder="CRM do médico"
                          disabled={isSubmitting}
                          maxLength={50}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Observações */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <div className="flex items-center gap-2">
                        <IconNotes className="h-4 w-4" />
                        Observações
                      </div>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                        placeholder="Observações sobre o exame..."
                        disabled={isSubmitting}
                        rows={3}
                        className="resize-none"
                        maxLength={1000}
                      />
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
