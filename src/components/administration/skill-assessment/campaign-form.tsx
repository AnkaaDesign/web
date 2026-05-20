import { useCallback } from "react";
import { useForm, FormProvider, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconClipboardList, IconLoader2 } from "@tabler/icons-react";

import { assessmentCreateSchema, assessmentUpdateSchema } from "../../../schemas";
import { ASSESSMENT_STATUS, ASSESSMENT_STATUS_LABELS } from "../../../constants";
import type {
  Assessment,
  AssessmentCreateFormData,
  AssessmentSectorConfig,
  AssessmentUpdateFormData,
} from "../../../types";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Combobox } from "@/components/ui/combobox";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { SectorMultiSelect } from "./sector-multiselect";
import { TopicMultiSelect } from "./topic-multiselect";
import { SectorAssessmentConfigCard } from "./sector-assessment-config-card";

export interface CampaignSubmitOptions {
  openAfter: boolean;
}

interface CreateModeProps {
  mode: "create";
  defaultValues?: Partial<AssessmentCreateFormData>;
  onSubmit: (data: AssessmentCreateFormData, opts: CampaignSubmitOptions) => Promise<void>;
}

interface UpdateModeProps {
  mode: "update";
  assessment: Assessment;
  onSubmit: (data: AssessmentUpdateFormData, opts: CampaignSubmitOptions) => Promise<void>;
}

// Status options shown in the form. Terminal transitions (CLOSED / CANCELLED)
// stay on the detail page's lifecycle dialogs to preserve their confirmations.
const STATUS_OPTIONS = [
  { value: ASSESSMENT_STATUS.DRAFT, label: ASSESSMENT_STATUS_LABELS[ASSESSMENT_STATUS.DRAFT] },
  { value: ASSESSMENT_STATUS.OPEN, label: ASSESSMENT_STATUS_LABELS[ASSESSMENT_STATUS.OPEN] },
];

type CampaignFormProps = (CreateModeProps | UpdateModeProps) & {
  isSubmitting?: boolean;
  formId?: string;
  hideSubmit?: boolean;
};

export function CampaignForm(props: CampaignFormProps) {
  const formId = props.formId ?? "campaign-form";

  const baseValues =
    props.mode === "create"
      ? {
          name: props.defaultValues?.name ?? "",
          description: props.defaultValues?.description ?? "",
          periodStart: props.defaultValues?.periodStart ?? new Date(),
          periodEnd:
            props.defaultValues?.periodEnd ??
            new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
          sectors: (props.defaultValues?.sectors ?? []) as AssessmentSectorConfig[],
          topicIds: props.defaultValues?.topicIds ?? [],
          status: ASSESSMENT_STATUS.DRAFT,
        }
      : {
          name: props.assessment.name,
          description: props.assessment.description ?? "",
          periodStart: props.assessment.periodStart,
          periodEnd: props.assessment.periodEnd,
          sectors: (props.assessment.sectors ?? []).map((s) => ({
            sectorId: s.sectorId,
            appraiserId: s.appraiserId ?? null,
            evaluateeIds: (s.evaluatees ?? []).map((e) => e.userId),
          })) as AssessmentSectorConfig[],
          topicIds: (props.assessment.topics ?? []).map((t) => t.topicId),
          // editing is only allowed in DRAFT, so the picker starts there
          status: ASSESSMENT_STATUS.DRAFT,
        };

  const form = useForm<any>({
    resolver: zodResolver(
      props.mode === "create" ? assessmentCreateSchema : assessmentUpdateSchema,
    ) as any,
    defaultValues: baseValues as any,
  });

  const isSubmitting = props.isSubmitting || form.formState.isSubmitting;

  const sectorFieldArray = useFieldArray({
    control: form.control,
    name: "sectors",
    keyName: "_key",
  });
  const sectorsValue = (useWatch({ control: form.control, name: "sectors" }) ?? []) as
    | AssessmentSectorConfig[]
    | undefined;
  const selectedSectorIds = (sectorsValue ?? []).map((s) => s.sectorId);

  /**
   * The SectorMultiSelect feeds us a flat string[] of sector IDs. Translate
   * back to the structured field-array, preserving per-sector config (appraiser
   * + evaluatees) for sectors that stay selected. New sectors start with empty
   * config and let the card seed itself on mount.
   */
  const handleSectorPickerChange = useCallback(
    (next: string[]) => {
      const current = (form.getValues("sectors") ?? []) as AssessmentSectorConfig[];
      const byId = new Map(current.map((s) => [s.sectorId, s]));
      const nextConfigs: AssessmentSectorConfig[] = next.map(
        (id) => byId.get(id) ?? { sectorId: id, appraiserId: null, evaluateeIds: [] },
      );
      form.setValue("sectors", nextConfigs, {
        shouldDirty: true,
        shouldValidate: true,
      });
    },
    [form],
  );

  const handleSubmit = async (data: any) => {
    // `data` is post-Zod validation, which strips keys absent from the schema.
    // `status` is a client-only intent flag (not part of the server payload),
    // so we read it from the live form state instead of the validated payload.
    const status = form.getValues("status");
    const normalized = {
      ...data,
      periodStart:
        data.periodStart instanceof Date ? data.periodStart : new Date(data.periodStart),
      periodEnd: data.periodEnd instanceof Date ? data.periodEnd : new Date(data.periodEnd),
    };
    const opts: CampaignSubmitOptions = { openAfter: status === ASSESSMENT_STATUS.OPEN };
    if (props.mode === "create") {
      await props.onSubmit(normalized as AssessmentCreateFormData, opts);
    } else {
      await props.onSubmit(normalized as AssessmentUpdateFormData, opts);
    }
  };

  return (
    <FormProvider {...form}>
      <form
        id={formId}
        onSubmit={form.handleSubmit(handleSubmit)}
        className="container mx-auto max-w-5xl space-y-4"
        autoComplete="off"
      >
        <button id={`${formId}-submit`} type="submit" className="hidden" disabled={isSubmitting} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconClipboardList className="h-5 w-5 text-muted-foreground" />
              Informações da Campanha
            </CardTitle>
            <CardDescription>
              Nomeie a campanha e defina o período de execução.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="Ex.: Avaliação 1º semestre 2026"
                      maxLength={200}
                      disabled={isSubmitting}
                      transparent
                      autoComplete="off"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      placeholder="Contexto, objetivos e observações da campanha"
                      rows={3}
                      maxLength={2000}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="periodStart"
                render={({ field }) => (
                  <DateTimeInput
                    field={field as any}
                    mode="date"
                    context="start"
                    label={
                      <>
                        Início do período <span className="text-destructive">*</span>
                      </>
                    }
                    disabled={isSubmitting}
                    required
                  />
                )}
              />
              <FormField
                control={form.control}
                name="periodEnd"
                render={({ field }) => (
                  <DateTimeInput
                    field={field as any}
                    mode="date"
                    context="end"
                    label={
                      <>
                        Fim do período <span className="text-destructive">*</span>
                      </>
                    }
                    disabled={isSubmitting}
                    required
                  />
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <FormControl>
                    <Combobox
                      value={field.value ?? ASSESSMENT_STATUS.DRAFT}
                      onValueChange={(v) => field.onChange(v as string)}
                      options={STATUS_OPTIONS}
                      searchable={false}
                      clearable={false}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    "Aberta" libera a coleta para os líderes assim que a campanha for salva.
                    Para fechar ou cancelar, use as ações na página de detalhes.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Escopo</CardTitle>
            <CardDescription>
              Selecione os setores que serão avaliados e os tópicos da matriz.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormItem>
              <FormLabel>
                Setores <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <SectorMultiSelect
                  value={selectedSectorIds}
                  onChange={handleSectorPickerChange}
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormDescription>
                Para cada setor selecionado abaixo, confirme o avaliador e os colaboradores
                que serão avaliados.
              </FormDescription>
              {form.formState.errors.sectors && !Array.isArray(form.formState.errors.sectors) && (
                <p className="text-sm font-medium text-destructive">
                  {(form.formState.errors.sectors as any)?.message}
                </p>
              )}
            </FormItem>

            {sectorFieldArray.fields.length > 0 && (
              <div className="space-y-3">
                {sectorFieldArray.fields.map((field, idx) => {
                  const cfg = (sectorsValue ?? [])[idx];
                  if (!cfg?.sectorId) return null;
                  return (
                    <SectorAssessmentConfigCard
                      key={field._key as string}
                      index={idx}
                      sectorId={cfg.sectorId}
                      disabled={isSubmitting}
                      onRemove={() => {
                        sectorFieldArray.remove(idx);
                      }}
                    />
                  );
                })}
              </div>
            )}

            <FormField
              control={form.control}
              name="topicIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tópicos <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <TopicMultiSelect
                      value={field.value ?? []}
                      onChange={field.onChange}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    Use "Selecionar tudo" no cabeçalho de uma competência para incluir todos os
                    tópicos dela de uma vez.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {!props.hideSubmit && (
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
              {props.mode === "create" ? "Criar campanha" : "Salvar alterações"}
            </Button>
          </div>
        )}
      </form>
    </FormProvider>
  );
}
