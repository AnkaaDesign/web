// components/questionnaire/admin/pergunta-form.tsx
//
// Create/update form for a questionnaire Pergunta — fields (Tema, ordem, título,
// descrição, texto de ajuda, ativo) + a VARIABLE-LENGTH options editor (the
// questionnaire equivalent of the topic levels, but add/remove since a question
// can have 2–6 named options, each with a 0..5 value used by the NOTAS rail).

import { useMemo } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { IconPlus, IconTrash } from "@tabler/icons-react";

import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { ScoreBadge } from "@/components/production/skill-assessment/score-badge";
import { useQuestionnaireGroups } from "@/hooks/questionnaire/use-questionnaire";

const optionSchema = z.object({
  order: z.coerce.number().int(),
  value: z.coerce.number().int().min(0).max(5),
  label: z.string().min(1, "Rótulo obrigatório").max(120),
  description: z.string().max(2000).nullable().optional(),
});
const schema = z.object({
  groupId: z.string().uuid("Selecione um tema"),
  order: z.coerce.number().int().min(0).max(9999),
  title: z.string().min(1, "Título obrigatório").max(200),
  description: z.string().min(1, "Descrição obrigatória").max(2000),
  helpText: z.string().max(2000).nullable().optional(),
  isActive: z.boolean().default(true).optional(),
  options: z
    .array(optionSchema)
    .min(2, "Pelo menos 2 opções")
    .max(5, "No máximo 5 opções"),
});
export type PerguntaFormValues = z.infer<typeof schema>;

export const DEFAULT_OPTIONS: PerguntaFormValues["options"] = [
  { order: 0, value: 1, label: "Muito insatisfeito", description: null },
  { order: 1, value: 2, label: "Insatisfeito", description: null },
  { order: 2, value: 3, label: "Neutro", description: null },
  { order: 3, value: 4, label: "Satisfeito", description: null },
  { order: 4, value: 5, label: "Muito satisfeito", description: null },
];

interface PerguntaFormProps {
  formId?: string;
  defaultValues?: Partial<PerguntaFormValues>;
  isSubmitting?: boolean;
  onSubmit: (values: PerguntaFormValues) => void;
}

export function PerguntaForm({ formId = "pergunta-form", defaultValues, isSubmitting, onSubmit }: PerguntaFormProps) {
  const { data: groupsResp } = useQuestionnaireGroups({ orderBy: { order: "asc" }, isActive: true, limit: 500 });
  const temaOptions = useMemo(() => ((groupsResp?.data ?? []) as any[]).map((g) => ({ value: g.id, label: g.name })), [groupsResp]);

  const form = useForm<PerguntaFormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      groupId: "",
      order: 0,
      title: "",
      description: "",
      helpText: "",
      isActive: true,
      options: DEFAULT_OPTIONS,
      ...defaultValues,
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "options" });

  // Value (and color) is derived purely from the row's position so the editor
  // shows only the colored badge — never an editable Valor input.
  const submit = (values: PerguntaFormValues) =>
    onSubmit({ ...values, options: values.options.map((o, i) => ({ ...o, order: i, value: i + 1 })) });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="container mx-auto max-w-5xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Informações da Pergunta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_140px]">
              <FormField control={form.control} name="groupId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tema <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Combobox value={field.value as string} onValueChange={(v) => field.onChange(v)} options={temaOptions} placeholder="Selecione o tema" searchable disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="order" render={({ field }) => (
                <FormItem>
                  <FormLabel>Ordem</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} max={9999} value={field.value ?? 0} onChange={(v) => field.onChange(Number(v) || 0)} transparent disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel>Título <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} placeholder="Ex.: Como você avalia o ambiente de trabalho?" maxLength={200} transparent disabled={isSubmitting} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Descrição <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <Textarea {...field} value={field.value ?? ""} rows={3} maxLength={2000} placeholder="Explique o que a pergunta avalia" disabled={isSubmitting} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="helpText" render={({ field }) => (
              <FormItem>
                <FormLabel>Texto de ajuda</FormLabel>
                <FormControl>
                  <Textarea {...field} value={field.value ?? ""} rows={2} maxLength={2000} placeholder="Instruções adicionais (opcional)" disabled={isSubmitting} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="isActive" render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-md border border-border/40 p-4">
                <div className="space-y-0.5">
                  <FormLabel>Ativa</FormLabel>
                  <FormDescription>Perguntas inativas não aparecem em novos questionários.</FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value ?? true} onCheckedChange={field.onChange} disabled={isSubmitting} />
                </FormControl>
              </FormItem>
            )} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Opções de resposta</CardTitle>
              <FormDescription>De 2 a 5 opções. A cor é definida pela posição da opção.</FormDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSubmitting || fields.length >= 5}
              onClick={() => append({ order: fields.length, value: fields.length + 1, label: "", description: null })}
            >
              <IconPlus className="h-4 w-4" /> Opção
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {fields.map((f, idx) => (
              <div key={f.id} className="flex items-start gap-3 rounded-md border border-border/40 p-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <FormField control={form.control} name={`options.${idx}.label`} render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Rótulo</FormLabel>
                      <div className="flex items-center gap-3">
                        <ScoreBadge
                          score={idx + 1}
                          label={String(idx + 1)}
                          className="h-10 w-10 shrink-0 justify-center rounded-md px-0 text-sm"
                        />
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} placeholder="Ex.: Satisfeito" maxLength={120} transparent disabled={isSubmitting} />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name={`options.${idx}.description`} render={({ field }) => (
                    <FormItem className="pl-[52px]">
                      <FormLabel className="text-xs">Descrição (opcional)</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} placeholder="Descrição do nível" maxLength={2000} transparent disabled={isSubmitting} />
                      </FormControl>
                    </FormItem>
                  )} />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-6 shrink-0"
                  disabled={isSubmitting || fields.length <= 2}
                  onClick={() => remove(idx)}
                >
                  <IconTrash className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            {form.formState.errors.options && !Array.isArray(form.formState.errors.options) && (
              <p className="text-sm font-medium text-destructive">{(form.formState.errors.options as any)?.message}</p>
            )}
          </CardContent>
        </Card>

        <button id={`${formId}-submit`} type="submit" className="hidden" disabled={isSubmitting} />
      </form>
    </Form>
  );
}
