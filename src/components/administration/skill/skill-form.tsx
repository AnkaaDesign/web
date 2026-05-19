import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconClipboardList, IconLoader2 } from "@tabler/icons-react";

import { skillCreateSchema, skillUpdateSchema } from "../../../schemas";
import type {
  Skill,
  SkillCreateFormData,
  SkillUpdateFormData,
} from "../../../types";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

interface CreateModeProps {
  mode: "create";
  defaultValues?: Partial<SkillCreateFormData>;
  onSubmit: (data: SkillCreateFormData) => Promise<void>;
}

interface UpdateModeProps {
  mode: "update";
  skill: Skill;
  onSubmit: (data: SkillUpdateFormData) => Promise<void>;
}

type SkillFormProps = (CreateModeProps | UpdateModeProps) & {
  isSubmitting?: boolean;
  formId?: string;
  hideSubmit?: boolean;
};

export function SkillForm(props: SkillFormProps) {
  const formId = props.formId ?? "skill-form";

  const form = useForm<SkillCreateFormData | SkillUpdateFormData>({
    resolver: zodResolver(props.mode === "create" ? skillCreateSchema : skillUpdateSchema) as any,
    defaultValues:
      props.mode === "create"
        ? {
            name: props.defaultValues?.name ?? "",
            description: props.defaultValues?.description ?? "",
            order: props.defaultValues?.order ?? 0,
            isActive: props.defaultValues?.isActive ?? true,
          }
        : {
            name: props.skill.name,
            description: props.skill.description ?? "",
            order: props.skill.order,
            isActive: props.skill.isActive,
          },
  });

  const isSubmitting = props.isSubmitting || form.formState.isSubmitting;

  const handleSubmit = async (data: any) => {
    if (props.mode === "create") {
      await props.onSubmit(data as SkillCreateFormData);
    } else {
      await props.onSubmit(data as SkillUpdateFormData);
    }
  };

  return (
    <FormProvider {...form}>
      <form
        id={formId}
        onSubmit={form.handleSubmit(handleSubmit)}
        className="container mx-auto max-w-4xl space-y-4"
      >
        <button id={`${formId}-submit`} type="submit" className="hidden" disabled={isSubmitting} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconClipboardList className="h-5 w-5 text-muted-foreground" />
              Informações da Competência
            </CardTitle>
            <CardDescription>
              A competência agrupa tópicos relacionados (ex.: Produtividade,
              Comportamental, Segurança do Trabalho).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_140px] gap-4">
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
                        placeholder="Ex.: Conhecimentos Técnicos de Plotagem"
                        disabled={isSubmitting}
                        transparent
                        maxLength={120}
                      />
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
                      <Input
                        type="number"
                        min={0}
                        max={9999}
                        {...field}
                        value={field.value ?? 0}
                        onChange={(value) => field.onChange(Number(value) || 0)}
                        disabled={isSubmitting}
                        transparent
                      />
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
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      placeholder="Descreva resumidamente o escopo desta competência"
                      disabled={isSubmitting}
                      rows={4}
                      maxLength={2000}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg bg-muted/30 p-4">
                  <div className="space-y-0.5">
                    <FormLabel>Ativo</FormLabel>
                    <FormDescription>
                      Competências inativas não aparecem em novas avaliações.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value ?? true}
                      onCheckedChange={field.onChange}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {!props.hideSubmit && (
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
              {props.mode === "create" ? "Criar competência" : "Salvar alterações"}
            </Button>
          </div>
        )}
      </form>
    </FormProvider>
  );
}
