import { useMemo } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconClipboardList, IconLoader2 } from "@tabler/icons-react";

import { topicCreateSchema, topicUpdateSchema } from "../../../schemas";
import type {
  Topic,
  TopicCreateFormData,
  TopicUpdateFormData,
} from "../../../types";
import { useSkills } from "../../../hooks";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
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
  defaultValues?: Partial<TopicCreateFormData>;
  onSubmit: (data: TopicCreateFormData) => Promise<void>;
}

interface UpdateModeProps {
  mode: "update";
  topic: Topic;
  onSubmit: (data: TopicUpdateFormData) => Promise<void>;
}

type TopicFormProps = (CreateModeProps | UpdateModeProps) & {
  isSubmitting?: boolean;
  formId?: string;
  hideSubmit?: boolean;
};

export function TopicForm(props: TopicFormProps) {
  const formId = props.formId ?? "topic-form";

  const { data: skillsData } = useSkills({
    limit: 200,
    isActive: true,
    orderBy: { order: "asc" },
  });

  const skillOptions = useMemo(
    () =>
      (skillsData?.data ?? []).map((s) => ({
        value: s.id,
        label: s.name,
      })),
    [skillsData],
  );

  const form = useForm<TopicCreateFormData | TopicUpdateFormData>({
    resolver: zodResolver(props.mode === "create" ? topicCreateSchema : topicUpdateSchema) as any,
    defaultValues:
      props.mode === "create"
        ? {
            skillId: props.defaultValues?.skillId ?? "",
            order: props.defaultValues?.order ?? 0,
            title: props.defaultValues?.title ?? "",
            description: props.defaultValues?.description ?? "",
            counterBehaviors: props.defaultValues?.counterBehaviors ?? "",
            isActive: props.defaultValues?.isActive ?? true,
          }
        : {
            skillId: props.topic.skillId,
            order: props.topic.order,
            title: props.topic.title,
            description: props.topic.description,
            counterBehaviors: props.topic.counterBehaviors,
            isActive: props.topic.isActive,
          },
  });

  const isSubmitting = props.isSubmitting || form.formState.isSubmitting;

  const handleSubmit = async (data: any) => {
    if (props.mode === "create") {
      await props.onSubmit(data as TopicCreateFormData);
    } else {
      await props.onSubmit(data as TopicUpdateFormData);
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
              Informações do Tópico
            </CardTitle>
            <CardDescription>
              Cada tópico é uma linha avaliável dentro de uma competência. Defina título,
              descrição e a lista de contra-comportamentos esperados.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_140px] gap-4">
              <FormField
                control={form.control}
                name="skillId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Competência <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Combobox
                        value={field.value as string}
                        onValueChange={(v) => field.onChange(v)}
                        options={skillOptions}
                        placeholder="Selecione a competência"
                        disabled={isSubmitting}
                        searchable
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
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="Ex.: Disciplina e cumprimento de regras"
                      disabled={isSubmitting}
                      transparent
                      maxLength={200}
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
                  <FormLabel>Descrição <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      placeholder="O que caracteriza um colaborador atuando bem neste tópico?"
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
              name="counterBehaviors"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contra-comportamentos <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      placeholder="O que caracteriza um desempenho insuficiente neste tópico?"
                      disabled={isSubmitting}
                      rows={4}
                      maxLength={2000}
                    />
                  </FormControl>
                  <FormDescription>
                    Lista de comportamentos negativos a serem evitados.
                  </FormDescription>
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
                    <FormDescription>
                      Tópicos inativos não aparecem em novas avaliações.
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
              {props.mode === "create" ? "Criar tópico" : "Salvar alterações"}
            </Button>
          </div>
        )}
      </form>
    </FormProvider>
  );
}
