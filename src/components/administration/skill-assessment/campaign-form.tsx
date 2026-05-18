import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconClipboardList, IconLoader2 } from "@tabler/icons-react";

import { assessmentCreateSchema, assessmentUpdateSchema } from "../../../schemas";
import type {
  Assessment,
  AssessmentCreateFormData,
  AssessmentUpdateFormData,
} from "../../../types";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { DateTimeInput } from "@/components/ui/date-time-input";
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

interface CreateModeProps {
  mode: "create";
  defaultValues?: Partial<AssessmentCreateFormData>;
  onSubmit: (data: AssessmentCreateFormData) => Promise<void>;
}

interface UpdateModeProps {
  mode: "update";
  assessment: Assessment;
  onSubmit: (data: AssessmentUpdateFormData) => Promise<void>;
}

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
          sectorIds: props.defaultValues?.sectorIds ?? [],
          topicIds: props.defaultValues?.topicIds ?? [],
        }
      : {
          name: props.assessment.name,
          description: props.assessment.description ?? "",
          periodStart: props.assessment.periodStart,
          periodEnd: props.assessment.periodEnd,
          sectorIds: (props.assessment.sectors ?? []).map((s) => s.sectorId),
          topicIds: (props.assessment.topics ?? []).map((t) => t.topicId),
        };

  const form = useForm<AssessmentCreateFormData | AssessmentUpdateFormData>({
    resolver: zodResolver(
      props.mode === "create" ? assessmentCreateSchema : assessmentUpdateSchema,
    ) as any,
    defaultValues: baseValues as any,
  });

  const isSubmitting = props.isSubmitting || form.formState.isSubmitting;

  const handleSubmit = async (data: any) => {
    const normalized = {
      ...data,
      periodStart: data.periodStart instanceof Date ? data.periodStart : new Date(data.periodStart),
      periodEnd: data.periodEnd instanceof Date ? data.periodEnd : new Date(data.periodEnd),
    };
    if (props.mode === "create") {
      await props.onSubmit(normalized as AssessmentCreateFormData);
    } else {
      await props.onSubmit(normalized as AssessmentUpdateFormData);
    }
  };

  return (
    <FormProvider {...form}>
      <form
        id={formId}
        onSubmit={form.handleSubmit(handleSubmit)}
        className="container mx-auto max-w-5xl space-y-4"
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
            <FormField
              control={form.control}
              name="sectorIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Setores <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <SectorMultiSelect
                      value={field.value ?? []}
                      onChange={field.onChange}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    Cada colaborador dos setores selecionados receberá uma entrada de avaliação.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

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
