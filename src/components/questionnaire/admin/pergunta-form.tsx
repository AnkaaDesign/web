// components/questionnaire/admin/pergunta-form.tsx
//
// Create/update form for a questionnaire Pergunta.
//
// A nota da opção (0..5) é ESCOLHIDA, não deduzida da posição. A versão anterior
// derivava `value = índice + 1` e, para alcançar o 0, precisava de um
// interruptor "escala começa em 0" — um controle global para uma decisão que é
// de cada linha. Agora cada opção tem o seu seletor: o quadrado colorido à
// esquerda do rótulo É o seletor, e a cor acompanha a nota escolhida (0 roxo …
// 5 verde, a mesma paleta da régua de notas).
//
// Duas invariantes sustentam isso, ambas cobradas também pela API:
//   • notas únicas — duas opções com a mesma nota tornariam a média e a
//     distribuição ambíguas;
//   • `order` é derivado da nota no envio (opções ordenadas por nota crescente),
//     de modo que a ordem de exibição no preenchimento — que é por nota — nunca
//     diverge da ordem mostrada aqui.
//
// Perguntas de TEXTO LIVRE (checkbox "Resposta fechada" desmarcado) não têm
// opções: o card inteiro sai de cena.

import { useMemo } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { IconPlus, IconTrash } from "@tabler/icons-react";

import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getScoreBadgeClasses } from "@/components/production/skill-assessment/score-badge";
import { useQuestionnaireGroups } from "@/hooks/questionnaire/use-questionnaire";
import { QUESTIONNAIRE_QUESTION_TYPE } from "@/constants";
import { cn } from "@/lib/utils";

/** Notas possíveis. Seis valores → no máximo seis opções por pergunta. */
export const OPTION_VALUES = [0, 1, 2, 3, 4, 5] as const;
const MAX_OPTIONS = OPTION_VALUES.length;

const optionSchema = z.object({
  value: z.coerce.number().int().min(0).max(5),
  label: z.string().min(1, "Rótulo obrigatório").max(120),
  description: z.string().max(2000).nullable().optional(),
});

const schema = z
  .object({
    groupId: z.string().uuid("Selecione um tema"),
    // `order` NÃO está aqui de propósito: a posição da pergunta no tema é
    // decidida pelo servidor (última + 1). O admin não deveria precisar
    // adivinhar um número livre — e um reordenador virá depois.
    title: z.string().min(1, "Título obrigatório").max(200),
    description: z.string().min(1, "Descrição obrigatória").max(2000),
    helpText: z.string().max(2000).nullable().optional(),
    /** Marcado = opções definidas; desmarcado = texto livre. */
    isClosed: z.boolean().default(true),
    isRequired: z.boolean().default(true),
    isActive: z.boolean().default(true),
    options: z.array(optionSchema).default([]),
  })
  .superRefine((d, ctx) => {
    if (!d.isClosed) return; // texto livre não tem opções
    if (d.options.length < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Pelo menos 2 opções", path: ["options"] });
    }
    if (d.options.length > MAX_OPTIONS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `No máximo ${MAX_OPTIONS} opções (notas 0 a 5)`,
        path: ["options"],
      });
    }
    const values = d.options.map((o) => o.value);
    if (new Set(values).size !== values.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duas opções não podem ter a mesma nota",
        path: ["options"],
      });
    }
  });

export type PerguntaFormValues = z.infer<typeof schema>;

/**
 * Ponto de partida de uma pergunta nova: a escala completa 0..5, com os rótulos
 * EM BRANCO. Rótulo pré-preenchido convida a aceitar um texto que não é o da
 * pergunta em questão — em branco, o campo cobra a escrita.
 */
export const DEFAULT_OPTIONS: PerguntaFormValues["options"] = OPTION_VALUES.map((value) => ({
  value,
  label: "",
  description: null,
}));

/**
 * Form → payload da API. `order` NÃO existe no formulário: sai da nota, com as
 * opções ordenadas de forma crescente. Isso satisfaz de graça a invariante que a
 * API cobra ("os valores crescem junto com a ordem") e garante que a régua de
 * notas do preenchimento mostre exatamente a sequência vista aqui.
 * Pergunta de texto livre não manda opção nenhuma.
 */
export const toApiOptions = (values: PerguntaFormValues) =>
  values.isClosed
    ? [...values.options]
        .sort((a, b) => a.value - b.value)
        .map((o, i) => ({
          order: i,
          value: o.value,
          label: o.label,
          description: o.description?.trim() ? o.description : null,
        }))
    : [];

/** `isClosed` do formulário → `type` da API. */
export const toApiQuestionType = (values: PerguntaFormValues) =>
  values.isClosed ? QUESTIONNAIRE_QUESTION_TYPE.OPTIONS : QUESTIONNAIRE_QUESTION_TYPE.TEXT;

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
      title: "",
      description: "",
      helpText: "",
      isClosed: true,
      isRequired: true,
      isActive: true,
      options: DEFAULT_OPTIONS,
      ...defaultValues,
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "options" });

  const isClosed = form.watch("isClosed");
  const optionValues = form.watch("options")?.map((o) => o.value) ?? [];

  /** Menor nota ainda livre — o palpite ao adicionar uma opção. */
  const nextFreeValue = OPTION_VALUES.find((v) => !optionValues.includes(v));

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="container mx-auto max-w-5xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Informações da Pergunta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField control={form.control} name="groupId" render={({ field }) => (
              <FormItem>
                <FormLabel>Tema <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <Combobox value={field.value as string} onValueChange={(v) => field.onChange(v)} options={temaOptions} placeholder="Selecione o tema" searchable disabled={isSubmitting} />
                </FormControl>
                <FormDescription>
                  A pergunta entra no fim do tema escolhido; a ordem é definida automaticamente.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )} />
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

            {/* Os três interruptores da pergunta, lado a lado. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FormField control={form.control} name="isClosed" render={({ field }) => (
                <CheckboxField
                  checked={field.value ?? true}
                  onChange={field.onChange}
                  disabled={isSubmitting}
                  label="Resposta fechada"
                  description="Marcado, o colaborador escolhe uma das opções. Desmarcado, escreve um texto livre."
                />
              )} />
              <FormField control={form.control} name="isRequired" render={({ field }) => (
                <CheckboxField
                  checked={field.value ?? true}
                  onChange={field.onChange}
                  disabled={isSubmitting}
                  label="Obrigatória"
                  description="Precisa ser respondida para o colaborador enviar o questionário."
                />
              )} />
              <FormField control={form.control} name="isActive" render={({ field }) => (
                <CheckboxField
                  checked={field.value ?? true}
                  onChange={field.onChange}
                  disabled={isSubmitting}
                  label="Ativa"
                  description="Perguntas inativas não aparecem em novos questionários."
                />
              )} />
            </div>
          </CardContent>
        </Card>

        {isClosed ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Opções de resposta</CardTitle>
                <FormDescription>
                  De 2 a {MAX_OPTIONS} opções. A nota (0 a 5) define a cor e a ordem em que a opção
                  aparece para o colaborador.
                </FormDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSubmitting || nextFreeValue === undefined}
                onClick={() =>
                  nextFreeValue !== undefined &&
                  append({ value: nextFreeValue, label: "", description: null })
                }
              >
                <IconPlus className="h-4 w-4" /> Opção
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {fields.map((f, idx) => (
                <div key={f.id} className="flex items-start gap-3 rounded-md border border-border/40 p-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    {/* Nota + rótulo compartilham a linha de base dos labels. */}
                    <div className="flex items-start gap-3">
                      {/* A nota vai sem FormControl: ele injeta id/aria via Slot
                          no filho, e a raiz do DropdownMenu não renderiza DOM —
                          os atributos se perderiam. O botão gatilho já carrega o
                          próprio aria-label. */}
                      <FormField control={form.control} name={`options.${idx}.value`} render={({ field }) => (
                        <FormItem className="shrink-0">
                          <FormLabel className="text-xs">Nota</FormLabel>
                          <ValuePicker
                            value={field.value}
                            onChange={field.onChange}
                            takenValues={optionValues.filter((_, i) => i !== idx)}
                            disabled={isSubmitting}
                          />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name={`options.${idx}.label`} render={({ field }) => (
                        <FormItem className="min-w-0 flex-1">
                          <FormLabel className="text-xs">Rótulo</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value ?? ""} placeholder="Ex.: Satisfeito" maxLength={120} transparent disabled={isSubmitting} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
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
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Opções de resposta</CardTitle>
              <FormDescription>
                Resposta fechada está desmarcada: o colaborador escreve a resposta em um campo de
                texto livre, sem opções e sem nota.
              </FormDescription>
            </CardHeader>
          </Card>
        )}

        <button id={`${formId}-submit`} type="submit" className="hidden" disabled={isSubmitting} />
      </form>
    </Form>
  );
}

/** Checkbox com rótulo e explicação, num cartão clicável inteiro. */
function CheckboxField({
  checked,
  onChange,
  disabled,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
  description: string;
}) {
  return (
    <FormItem className="flex flex-row items-start gap-3 rounded-md border border-border/40 p-4">
      <FormControl>
        <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} disabled={disabled} className="mt-0.5" />
      </FormControl>
      <div className="space-y-0.5 leading-tight">
        <FormLabel className="cursor-pointer">{label}</FormLabel>
        <FormDescription className="text-xs">{description}</FormDescription>
      </div>
    </FormItem>
  );
}

/**
 * Seletor da nota: um quadrado da altura exata do Input (h-10 w-10) pintado com
 * a cor da nota. Notas já usadas por outra opção aparecem desabilitadas — é o
 * que impede a duplicata antes de ela virar erro de validação.
 */
function ValuePicker({
  value,
  onChange,
  takenValues,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  takenValues: number[];
  disabled?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          aria-label={`Nota da opção: ${value}`}
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-sm font-semibold tabular-nums transition-opacity",
            getScoreBadgeClasses(value),
            disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:opacity-90",
          )}
        >
          {value}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[8rem]">
        {OPTION_VALUES.map((v) => (
          <DropdownMenuItem
            key={v}
            disabled={v !== value && takenValues.includes(v)}
            onClick={() => onChange(v)}
            className="gap-2"
          >
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded text-xs font-semibold tabular-nums",
                getScoreBadgeClasses(v),
              )}
            >
              {v}
            </span>
            <span className="text-sm">Nota {v}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
