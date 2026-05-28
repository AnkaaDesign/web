// components/questionnaire/admin/tema-form.tsx
//
// Create/update form for a questionnaire Tema (the parent of Perguntas — the
// questionnaire equivalent of a Competência). Mirrors the skill-form look.

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

const schema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(120),
  description: z.string().max(2000).nullable().optional(),
  order: z.coerce.number().int().min(0).max(9999),
  isActive: z.boolean().default(true).optional(),
});
export type TemaFormValues = z.infer<typeof schema>;

interface TemaFormProps {
  formId?: string;
  defaultValues?: Partial<TemaFormValues>;
  isSubmitting?: boolean;
  onSubmit: (values: TemaFormValues) => void;
}

export function TemaForm({ formId = "tema-form", defaultValues, isSubmitting, onSubmit }: TemaFormProps) {
  const form = useForm<TemaFormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: { name: "", description: "", order: 0, isActive: true, ...defaultValues },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="container mx-auto max-w-5xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Informações do Tema</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_140px]">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} placeholder="Ex.: Satisfação no trabalho" maxLength={120} transparent disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="order"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ordem</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={9999} value={field.value ?? 0} onChange={(v) => field.onChange(Number(v) || 0)} transparent disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ""} rows={4} maxLength={2000} placeholder="Descreva o que este tema agrupa" disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-md border border-border/40 p-4">
                  <div className="space-y-0.5">
                    <FormLabel>Ativo</FormLabel>
                    <FormDescription>Temas inativos não aparecem em novos questionários.</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value ?? true} onCheckedChange={field.onChange} disabled={isSubmitting} />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>
        <button id={`${formId}-submit`} type="submit" className="hidden" disabled={isSubmitting} />
      </form>
    </Form>
  );
}
