// admission-form.tsx
// Admissões — formulário de criação/edição.
//
// Create mode ("Cadastro de colaborador"): a SINGLE collaborator form
// (AdmissionNewUserForm) that registers the person + first vínculo + admission
// in one transaction, with CPF auto-detect (rehire = new vínculo for an existing
// person) and inline document uploads.
// Update mode: only hireDate/notes are editable.

import { useMemo } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconUserPlus, IconUser, IconCalendar, IconFileText } from "@tabler/icons-react";

import type { AdmissionCreateFormData, AdmissionUpdateFormData } from "../../../../schemas/admission";
import { admissionUpdateSchema } from "../../../../schemas/admission";
import type { Admission } from "../../../../types/admission";
import { CONTRACT_TYPE_LABELS } from "../../../../constants";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Textarea } from "@/components/ui/textarea";
import { Badge, getBadgeVariantFromStatus } from "@/components/ui/badge";

import { AdmissionNewUserForm } from "./admission-new-user-form";

interface CreateModeProps {
  mode: "create";
  onSubmit: (data: AdmissionCreateFormData) => Promise<void>;
}

interface UpdateModeProps {
  mode: "update";
  admission: Admission;
  onSubmit: (data: AdmissionUpdateFormData) => Promise<void>;
}

type AdmissionFormProps = (CreateModeProps | UpdateModeProps) & {
  isSubmitting?: boolean;
};

// =====================
// Update-mode form (hireDate + notes only)
// =====================

function AdmissionUpdateForm({ admission, onSubmit, isSubmitting: isSubmittingProp }: { admission: Admission; onSubmit: (data: AdmissionUpdateFormData) => Promise<void>; isSubmitting?: boolean }) {
  const form = useForm<AdmissionUpdateFormData>({
    resolver: zodResolver(admissionUpdateSchema),
    defaultValues: {
      hireDate: admission?.hireDate ? new Date(admission.hireDate) : null,
      notes: admission?.notes ?? null,
    },
  });

  const isSubmitting = isSubmittingProp || form.formState.isSubmitting;

  const updateUser = admission?.user;
  const updateUserMeta = useMemo(() => {
    if (!updateUser) return null;
    return [updateUser.position?.name, updateUser.sector?.name].filter(Boolean).join(" · ");
  }, [updateUser]);

  const handleSubmit = async (data: AdmissionUpdateFormData) => {
    try {
      await onSubmit({ hireDate: data.hireDate ?? null, notes: data.notes ?? null });
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error submitting admission form:", error);
      }
    }
  };

  return (
    <FormProvider {...form}>
      <form id="admission-form" onSubmit={form.handleSubmit(handleSubmit)} className="container mx-auto max-w-4xl">
        <button id="admission-form-submit" type="submit" className="hidden" disabled={isSubmitting} />

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconUserPlus className="h-5 w-5 text-muted-foreground" />
                Editar Admissão
              </CardTitle>
              <CardDescription>Apenas a data de admissão e as observações podem ser alteradas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Colaborador (read-only) */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <IconUser className="h-4 w-4" />
                  Colaborador
                </div>
                <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-muted/30 px-3 py-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{updateUser?.name || "-"}</p>
                    {updateUserMeta && <p className="text-xs text-muted-foreground truncate">{updateUserMeta}</p>}
                  </div>
                  {updateUser?.currentContractType && (
                    <Badge variant={getBadgeVariantFromStatus(updateUser.currentContractType, "USER")} className="text-xs whitespace-nowrap">
                      {CONTRACT_TYPE_LABELS[updateUser.currentContractType] || updateUser.currentContractType}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">O colaborador de uma admissão não pode ser alterado.</p>
              </div>

              {/* Data de Admissão */}
              <FormField
                control={form.control}
                name="hireDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>
                      <div className="flex items-center gap-2">
                        <IconCalendar className="h-4 w-4" />
                        Data de Admissão
                      </div>
                    </FormLabel>
                    <FormControl>
                      <DateTimeInput
                        mode="date"
                        value={(field.value as Date | null) ?? undefined}
                        onChange={(date) => field.onChange(date instanceof Date ? date : null)}
                        disabled={isSubmitting}
                        hideLabel
                        placeholder="Selecionar data..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Observações */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>
                      <div className="flex items-center gap-2">
                        <IconFileText className="h-4 w-4" />
                        Observações
                      </div>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        value={(field.value as string | null) ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.value)}
                        disabled={isSubmitting}
                        placeholder="Observações sobre o processo de admissão (opcional)"
                        rows={4}
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

// =====================
// Public form
// =====================

export function AdmissionForm(props: AdmissionFormProps) {
  if (props.mode === "update") {
    return <AdmissionUpdateForm admission={props.admission} onSubmit={props.onSubmit} isSubmitting={props.isSubmitting} />;
  }

  return (
    <div className="container mx-auto max-w-4xl">
      <AdmissionNewUserForm onSubmit={props.onSubmit} isSubmitting={props.isSubmitting} />
    </div>
  );
}
