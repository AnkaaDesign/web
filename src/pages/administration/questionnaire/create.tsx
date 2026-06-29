// pages/administration/questionnaire/create.tsx
//
// Create a questionnaire campaign. Mirrors the skill-assessment CampaignForm
// look: FormCard sections (icon + subtitle), required asterisks, DateTimeInput
// dates, Combobox for status + questions, a "Todos os colaboradores"
// switch. react-hook-form + zod + hidden submit driven by the PageHeader action.

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { IconCheck, IconClipboardList } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES, QUESTIONNAIRE_STATUS, QUESTIONNAIRE_STATUS_LABELS, CONTRACT_STATUS } from "@/constants";
import {
  useCreateQuestionnaire,
  useOpenQuestionnaire,
  useQuestionnaireQuestions,
} from "@/hooks/questionnaire/use-questionnaire";
import { useUsers } from "@/hooks/personnel-department/use-user";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Switch } from "@/components/ui/switch";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

// "__all__" sentinel = "Todos os colaboradores" inside the collaborators combobox.
const ALL = "__all__";

const schema = z
  .object({
    name: z.string().min(1, "Nome é obrigatório").max(200),
    description: z.string().max(2000).nullable().optional(),
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
    // audience holds the combobox selection: [ALL] for everyone, or specific user ids.
    audience: z.array(z.string()).min(1, "Selecione colaboradores ou “Todos”"),
    questionIds: z.array(z.string()).min(1, "Selecione ao menos uma pergunta"),
    isAnonymous: z.boolean().default(false),
  })
  .refine((d) => d.periodEnd >= d.periodStart, { message: "Período final deve ser maior ou igual ao inicial", path: ["periodEnd"] });

type FormValues = z.infer<typeof schema>;

const STATUS_OPTIONS = [
  { value: QUESTIONNAIRE_STATUS.DRAFT, label: QUESTIONNAIRE_STATUS_LABELS[QUESTIONNAIRE_STATUS.DRAFT] },
  { value: QUESTIONNAIRE_STATUS.OPEN, label: QUESTIONNAIRE_STATUS_LABELS[QUESTIONNAIRE_STATUS.OPEN] },
];

export const QuestionnaireCreatePage = () => {
  usePageTracker({ title: "Novo Questionário", icon: "clipboard-list" });
  const navigate = useNavigate();

  const createMut = useCreateQuestionnaire();
  const openMut = useOpenQuestionnaire();
  const [status, setStatus] = useState<string>(QUESTIONNAIRE_STATUS.DRAFT);

  const { data: questionsResp } = useQuestionnaireQuestions({
    include: { group: true },
    orderBy: [{ groupId: "asc" }, { order: "asc" }],
    isActive: true,
    limit: 1000,
  });
  const { data: usersResp } = useUsers({ orderBy: { name: "asc" }, where: { currentContractStatus: CONTRACT_STATUS.ACTIVE }, limit: 500 } as any);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      name: "",
      description: "",
      periodStart: new Date(),
      periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      audience: [ALL],
      questionIds: [],
      isAnonymous: false,
    },
  });

  const userOptions = useMemo(
    () => [
      { value: ALL, label: "Todos os colaboradores" },
      ...((usersResp?.data ?? []) as any[]).map((u) => ({ value: u.id, label: u.name })),
    ],
    [usersResp],
  );
  const questionOptions = useMemo(
    () =>
      ((questionsResp?.data ?? []) as any[]).map((q) => ({
        value: q.id,
        label: q.group?.name ? `${q.group.name} · ${q.title}` : q.title,
      })),
    [questionsResp],
  );

  const onSubmit = async (values: FormValues) => {
    const targetAllUsers = values.audience.includes(ALL);
    try {
      const result = await createMut.mutateAsync({
        name: values.name.trim(),
        description: values.description?.trim() || null,
        periodStart: values.periodStart,
        periodEnd: values.periodEnd,
        targetAllUsers,
        isAnonymous: values.isAnonymous,
        userIds: targetAllUsers ? [] : values.audience,
        questionIds: values.questionIds,
      });
      const newId = result.data?.id;
      if (status === QUESTIONNAIRE_STATUS.OPEN && newId) {
        try {
          await openMut.mutateAsync(newId);
        } catch {
          /* toast via interceptor */
        }
      }
      navigate(newId ? routes.administration.questionnaire.details(newId) : routes.administration.questionnaire.root);
    } catch {
      /* toast via interceptor */
    }
  };

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.HUMAN_RESOURCES]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <div className="container mx-auto max-w-5xl flex-shrink-0">
          <PageHeader
            title="Novo Questionário"
            icon={IconClipboardList}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Administração", href: routes.administration.root },
              { label: "Questionários", href: routes.administration.questionnaire.root },
              { label: "Novo" },
            ]}
            actions={[
              { key: "cancel", label: "Cancelar", onClick: () => navigate(routes.administration.questionnaire.root), variant: "outline" as const },
              {
                key: "submit",
                label: "Criar questionário",
                icon: IconCheck,
                onClick: () => document.getElementById("questionnaire-form-submit")?.click(),
                variant: "default" as const,
                loading: createMut.isPending,
              },
            ]}
          />
        </div>

        <div className="flex-1 overflow-y-auto pb-6">
          <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="container mx-auto max-w-5xl space-y-4">
              {/* Informações */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconClipboardList className="h-5 w-5 text-muted-foreground" />
                    Informações do Questionário
                  </CardTitle>
                  <CardDescription>Nomeie o questionário e defina o período de execução.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} placeholder="Ex.: Pesquisa de satisfação 2026" maxLength={200} transparent autoComplete="off" />
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
                          <Textarea {...field} value={field.value ?? ""} placeholder="Contexto, objetivos e observações do questionário" rows={3} maxLength={2000} />
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
                        <DateTimeInput field={field as any} mode="date" context="start" label={<>Início do período <span className="text-destructive">*</span></>} required />
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="periodEnd"
                      render={({ field }) => (
                        <DateTimeInput field={field as any} mode="date" context="end" label={<>Fim do período <span className="text-destructive">*</span></>} required />
                      )}
                    />
                  </div>
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <FormControl>
                      <Combobox value={status} onValueChange={(v) => setStatus(v as string)} options={STATUS_OPTIONS} searchable={false} clearable={false} />
                    </FormControl>
                    <FormDescription>"Aberto" gera as fichas e libera o preenchimento assim que o questionário for criado.</FormDescription>
                  </FormItem>

                  <FormField
                    control={form.control}
                    name="isAnonymous"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between gap-4 rounded-lg border border-border/60 p-4">
                        <div className="space-y-0.5">
                          <FormLabel>Anônimo</FormLabel>
                          <FormDescription>
                            As respostas não serão associadas a ninguém — nem os administradores poderão ver quem respondeu o quê.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Público-alvo — collaborators combobox (with a "Todos" option). */}
              <Card>
                <CardHeader>
                  <CardTitle>Público-alvo</CardTitle>
                  <CardDescription>Selecione os colaboradores que devem responder, ou "Todos os colaboradores".</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="audience"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Colaboradores <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Combobox
                            mode="multiple"
                            value={field.value}
                            onValueChange={(v) => {
                              const next = (v as string[] | null) ?? [];
                              // Picking "Todos" clears specific users; picking a user clears "Todos".
                              if (next.includes(ALL) && !field.value.includes(ALL)) field.onChange([ALL]);
                              else field.onChange(next.filter((x) => x !== ALL).length ? next.filter((x) => x !== ALL) : next);
                            }}
                            options={userOptions}
                            placeholder="Selecione os colaboradores"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Perguntas */}
              <Card>
                <CardHeader>
                  <CardTitle>Perguntas</CardTitle>
                  <CardDescription>Selecione as perguntas (agrupadas por categoria) que farão parte do questionário.</CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="questionIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Perguntas <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Combobox mode="multiple" value={field.value} onValueChange={(v) => field.onChange(v ?? [])} options={questionOptions} placeholder="Selecione as perguntas" emptyText="Nenhuma pergunta no catálogo. Cadastre perguntas primeiro." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <button id="questionnaire-form-submit" type="submit" className="hidden" disabled={createMut.isPending} />
            </form>
          </FormProvider>
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default QuestionnaireCreatePage;
