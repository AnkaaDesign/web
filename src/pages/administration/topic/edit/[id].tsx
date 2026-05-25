import { useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconCheck, IconClipboardList, IconLoader2 } from "@tabler/icons-react";
import { z } from "zod";

import { routes, SECTOR_PRIVILEGES } from "../../../../constants";
import { topicLevelFormSchema, topicUpdateSchema } from "../../../../schemas";
import type {
  Topic,
  TopicUpdateFormData,
  TopicLevelFormData,
  TopicLevelsUpsertFormData,
} from "../../../../types";
import { useTopic, useTopicMutations, useSkills, useUpsertTopicLevels } from "../../../../hooks";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Combobox } from "@/components/ui/combobox";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { TopicLevelFields } from "@/components/administration/topic/topic-level-fields";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

// Combined schema for the edit page: topic fields + levels (always 6 rows)
const editSchema = topicUpdateSchema.extend({
  levels: z.array(topicLevelFormSchema).length(6, "São necessários 6 níveis (score 0..5)"),
});

type EditFormValues = TopicUpdateFormData & { levels: TopicLevelFormData[] };

function seedLevels(topic: Topic): TopicLevelFormData[] {
  const byScore = new Map<number, TopicLevelFormData>();
  (topic.levels ?? []).forEach((l) =>
    byScore.set(l.score, { score: l.score, name: l.name, description: l.description }),
  );
  return Array.from({ length: 6 }, (_, score) =>
    byScore.get(score) ?? { score, name: "", description: "" },
  );
}

export const TopicEditPage = () => {
  usePageTracker({ title: "Editar Tópico", icon: "clipboard-list" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isSubmittingAll, setIsSubmittingAll] = useState(false);

  const { data, isLoading, error } = useTopic(id ?? "", {
    enabled: !!id,
    include: { skill: true, levels: true },
  });

  const { updateAsync } = useTopicMutations();
  const upsertLevels = useUpsertTopicLevels(id ?? "");
  const { data: skillsData } = useSkills({ limit: 200, isActive: true, orderBy: { order: "asc" } });

  const skillOptions = useMemo(
    () =>
      (skillsData?.data ?? []).map((s) => ({
        value: s.id,
        label: s.name,
      })),
    [skillsData],
  );

  const topic = data?.data;

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema as any) as any,
    defaultValues: topic
      ? {
          skillId: topic.skillId,
          order: topic.order,
          title: topic.title,
          description: topic.description,
          counterBehaviors: topic.counterBehaviors,
          isActive: topic.isActive,
          levels: seedLevels(topic),
        }
      : ({ levels: Array.from({ length: 6 }, (_, score) => ({ score, name: "", description: "" })) } as any),
    values: topic
      ? {
          skillId: topic.skillId,
          order: topic.order,
          title: topic.title,
          description: topic.description,
          counterBehaviors: topic.counterBehaviors,
          isActive: topic.isActive,
          levels: seedLevels(topic),
        }
      : undefined,
  });

  if (!id) return <Navigate to={routes.administration.topic.root} replace />;
  if (error) return <Navigate to={routes.administration.topic.root} replace />;
  if (isLoading || !topic) {
    return (
      <div className="flex items-center justify-center h-full">
        <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleSubmit = async (values: EditFormValues) => {
    setIsSubmittingAll(true);
    try {
      const { levels, ...topicFields } = values;

      // Only send changed topic fields (compared to original topic)
      const topicPatch: TopicUpdateFormData = {};
      if (topicFields.skillId !== topic.skillId) topicPatch.skillId = topicFields.skillId;
      if (topicFields.order !== topic.order) topicPatch.order = topicFields.order;
      if (topicFields.title !== topic.title) topicPatch.title = topicFields.title;
      if (topicFields.description !== topic.description) topicPatch.description = topicFields.description;
      if (topicFields.counterBehaviors !== topic.counterBehaviors) topicPatch.counterBehaviors = topicFields.counterBehaviors;
      if (topicFields.isActive !== topic.isActive) topicPatch.isActive = topicFields.isActive;

      if (Object.keys(topicPatch).length > 0) {
        await updateAsync({ id, data: topicPatch });
      }

      const levelsPayload: TopicLevelsUpsertFormData = {
        levels: levels.map((l, idx) => ({
          score: idx,
          name: l.name,
          description: l.description,
        })),
      };
      await upsertLevels.mutateAsync(levelsPayload);

      // Success/error toasts handled by the axios interceptor.
      navigate(routes.administration.topic.details(id));
    } catch (err) {
      // Error toast handled by the axios interceptor.
      if (process.env.NODE_ENV !== "production") console.error(err);
    } finally {
      setIsSubmittingAll(false);
    }
  };

  const isSubmitting = isSubmittingAll || form.formState.isSubmitting || upsertLevels.isPending;

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.PRODUCTION_MANAGER]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <div className="container mx-auto max-w-4xl flex-shrink-0">
          <PageHeader
            variant="form"
            title="Editar Tópico"
            icon={IconClipboardList}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Administração" },
              { label: "Tópicos", href: routes.administration.topic.root },
              { label: topic.title, href: routes.administration.topic.details(id) },
              { label: "Editar" },
            ]}
            actions={[
              {
                key: "cancel",
                label: "Cancelar",
                onClick: () => navigate(routes.administration.topic.details(id)),
                variant: "outline" as const,
              },
              {
                key: "submit",
                label: "Salvar",
                icon: IconCheck,
                onClick: () => document.getElementById("topic-edit-submit")?.click(),
                variant: "default" as const,
                loading: isSubmitting,
              },
            ]}
          />
        </div>

        <div className="flex-1 overflow-y-auto pb-6">
          <FormProvider {...form}>
            <form
              id="topic-edit-form"
              onSubmit={form.handleSubmit(handleSubmit)}
              className="container mx-auto max-w-4xl space-y-4"
            >
              <button id="topic-edit-submit" type="submit" className="hidden" disabled={isSubmitting} />

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconClipboardList className="h-5 w-5 text-muted-foreground" />
                    Informações do Tópico
                  </CardTitle>
                  <CardDescription>
                    Atualize os dados principais. Os 6 níveis abaixo são salvos junto com este formulário.
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
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
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

              <TopicLevelFields disabled={isSubmitting} />
            </form>
          </FormProvider>
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default TopicEditPage;
