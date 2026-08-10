// pages/administration/questionnaire/create.tsx
//
// Create a questionnaire campaign. Mirrors the skill-assessment CampaignForm
// look: FormCard sections (icon + subtitle), required asterisks, DateTimeInput
// dates, Combobox for status + questions.
//
// Público-alvo em dois passos: o primeiro combobox escolhe COMO mirar (todos /
// setores / cargos / colaboradores) e, quando não é "todos", o segundo aparece
// já apontado para a entidade certa. Quem responde só é resolvido na ABERTURA,
// então um colaborador que entra no setor antes disso também recebe a ficha.

import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { IconCheck, IconClipboardList, IconUsers } from "@tabler/icons-react";

import {
  routes,
  SECTOR_PRIVILEGES,
  QUESTIONNAIRE_STATUS,
  QUESTIONNAIRE_STATUS_LABELS,
  QUESTIONNAIRE_AUDIENCE,
  QUESTIONNAIRE_AUDIENCE_LABELS,
  CONTRACT_STATUS,
} from "@/constants";
import {
  useCreateQuestionnaire,
  useOpenQuestionnaire,
  useQuestionnaireQuestions,
  useQuestionnaireGroups,
} from "@/hooks/questionnaire/use-questionnaire";
import { userService } from "@/api-client";
import { useSectors } from "@/hooks/administration/use-sector";
import { usePositions } from "@/hooks/personnel-department/use-position";
import type { User } from "@/types";
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

const schema = z
  .object({
    name: z.string().min(1, "Nome é obrigatório").max(200),
    description: z.string().max(2000).nullable().optional(),
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
    audience: z.nativeEnum(QUESTIONNAIRE_AUDIENCE).default(QUESTIONNAIRE_AUDIENCE.ALL_USERS),
    // Só a coleção do modo escolhido é enviada — as outras vão vazias.
    userIds: z.array(z.string()).default([]),
    sectorIds: z.array(z.string()).default([]),
    positionIds: z.array(z.string()).default([]),
    // FILTRO de tela apenas: encurta a lista de perguntas. NÃO é enviado — o
    // `groupIds` da API significa "inclua todas as perguntas destes temas", que
    // é o oposto de filtrar antes de escolher uma a uma.
    filterGroupIds: z.array(z.string()).default([]),
    questionIds: z.array(z.string()).min(1, "Selecione ao menos uma pergunta"),
    isAnonymous: z.boolean().default(false),
  })
  .refine((d) => d.periodEnd >= d.periodStart, { message: "Período final deve ser maior ou igual ao inicial", path: ["periodEnd"] })
  .superRefine((d, ctx) => {
    const rule = {
      [QUESTIONNAIRE_AUDIENCE.SECTORS]: { list: d.sectorIds, path: "sectorIds", message: "Selecione ao menos um setor" },
      [QUESTIONNAIRE_AUDIENCE.POSITIONS]: { list: d.positionIds, path: "positionIds", message: "Selecione ao menos um cargo" },
      [QUESTIONNAIRE_AUDIENCE.USERS]: { list: d.userIds, path: "userIds", message: "Selecione ao menos um colaborador" },
      [QUESTIONNAIRE_AUDIENCE.ALL_USERS]: null,
    }[d.audience];
    if (rule && rule.list.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: rule.message, path: [rule.path] });
    }
  });

type FormValues = z.infer<typeof schema>;

const STATUS_OPTIONS = [
  { value: QUESTIONNAIRE_STATUS.DRAFT, label: QUESTIONNAIRE_STATUS_LABELS[QUESTIONNAIRE_STATUS.DRAFT] },
  { value: QUESTIONNAIRE_STATUS.OPEN, label: QUESTIONNAIRE_STATUS_LABELS[QUESTIONNAIRE_STATUS.OPEN] },
];

const AUDIENCE_OPTIONS = Object.values(QUESTIONNAIRE_AUDIENCE).map((value) => ({
  value,
  label: QUESTIONNAIRE_AUDIENCE_LABELS[value],
}));

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
  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      name: "",
      description: "",
      periodStart: new Date(),
      periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      audience: QUESTIONNAIRE_AUDIENCE.ALL_USERS,
      userIds: [],
      sectorIds: [],
      positionIds: [],
      filterGroupIds: [],
      questionIds: [],
      isAnonymous: false,
    },
  });

  const audience = form.watch("audience");
  const filterGroupIds = form.watch("filterGroupIds");

  // Setores e cargos são catálogos curtos — cabem numa carga só (o teto de
  // ambos os getMany é 100, folgado para a realidade da empresa).
  const { data: sectorsResp } = useSectors({ orderBy: { name: "asc" }, limit: 100 } as any);
  const { data: positionsResp } = usePositions({ orderBy: { name: "asc" }, limit: 100 } as any);

  const sectorOptions = useMemo(
    () => ((sectorsResp?.data ?? []) as any[]).map((s) => ({ value: s.id, label: s.name })),
    [sectorsResp],
  );
  const positionOptions = useMemo(
    () => ((positionsResp?.data ?? []) as any[]).map((p) => ({ value: p.id, label: p.name })),
    [positionsResp],
  );

  // Colaboradores, ao contrário, são muitos: busca paginada no servidor. A
  // versão anterior pedia `limit: 500` de uma vez — acima do teto de 100 do
  // userGetManySchema —, a chamada voltava 400 e o combobox ficava vazio.
  const queryUsers = useCallback(async (search: string, page = 1) => {
    const response = await userService.getUsers({
      page,
      take: 50,
      orderBy: { name: "asc" },
      contractStatuses: [CONTRACT_STATUS.ACTIVE],
      ...(search.trim() ? { searchingFor: search.trim() } : {}),
    } as any);
    return { data: response.data ?? [], hasMore: response.meta?.hasNextPage ?? false };
  }, []);

  const getUserOptionLabel = useCallback((user: User) => user.name, []);
  const getUserOptionValue = useCallback((user: User) => user.id, []);

  const { data: temasResp } = useQuestionnaireGroups({
    orderBy: { order: "asc" },
    isActive: true,
    limit: 500,
  });

  const temaOptions = useMemo(
    () => ((temasResp?.data ?? []) as any[]).map((g) => ({ value: g.id, label: g.name })),
    [temasResp],
  );

  // Nenhum tema marcado = catálogo inteiro (o filtro é um atalho, não uma etapa
  // obrigatória).
  const questionOptions = useMemo(() => {
    const all = (questionsResp?.data ?? []) as any[];
    const visible = filterGroupIds.length
      ? all.filter((q) => filterGroupIds.includes(q.groupId))
      : all;
    return visible.map((q) => ({
      value: q.id,
      label: q.group?.name ? `${q.group.name} · ${q.title}` : q.title,
    }));
  }, [questionsResp, filterGroupIds]);

  const onSubmit = async (values: FormValues) => {
    try {
      const result = await createMut.mutateAsync({
        name: values.name.trim(),
        description: values.description?.trim() || null,
        periodStart: values.periodStart,
        periodEnd: values.periodEnd,
        audience: values.audience,
        isAnonymous: values.isAnonymous,
        // Manda só a coleção do modo escolhido — a API zera as demais, mas
        // enviar sobras faria o payload mentir sobre a intenção.
        userIds: values.audience === QUESTIONNAIRE_AUDIENCE.USERS ? values.userIds : [],
        sectorIds: values.audience === QUESTIONNAIRE_AUDIENCE.SECTORS ? values.sectorIds : [],
        positionIds: values.audience === QUESTIONNAIRE_AUDIENCE.POSITIONS ? values.positionIds : [],
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
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.PRODUCTION_MANAGER]}>
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

              {/* Público-alvo — modo primeiro, critério depois. */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconUsers className="h-5 w-5 text-muted-foreground" />
                    Público-alvo
                  </CardTitle>
                  <CardDescription>
                    Escolha quem deve responder. As fichas são geradas na abertura do questionário —
                    quem entrar no setor ou cargo até lá também recebe a sua.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="audience"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quem responde <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Combobox
                            value={field.value}
                            onValueChange={(v) => {
                              field.onChange(v);
                              // Trocar de modo zera os critérios dos outros —
                              // senão uma seleção esquecida viajaria no payload.
                              form.setValue("userIds", []);
                              form.setValue("sectorIds", []);
                              form.setValue("positionIds", []);
                            }}
                            options={AUDIENCE_OPTIONS}
                            searchable={false}
                            clearable={false}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {audience === QUESTIONNAIRE_AUDIENCE.SECTORS && (
                    <FormField
                      control={form.control}
                      name="sectorIds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Setores <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Combobox
                              mode="multiple"
                              value={field.value}
                              onValueChange={(v) => field.onChange((v as string[] | null) ?? [])}
                              options={sectorOptions}
                              placeholder="Selecione os setores"
                              emptyText="Nenhum setor cadastrado."
                              searchable
                            />
                          </FormControl>
                          <FormDescription>
                            Responde todo colaborador com vínculo ativo lotado nesses setores.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {audience === QUESTIONNAIRE_AUDIENCE.POSITIONS && (
                    <FormField
                      control={form.control}
                      name="positionIds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cargos <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Combobox
                              mode="multiple"
                              value={field.value}
                              onValueChange={(v) => field.onChange((v as string[] | null) ?? [])}
                              options={positionOptions}
                              placeholder="Selecione os cargos"
                              emptyText="Nenhum cargo cadastrado."
                              searchable
                            />
                          </FormControl>
                          <FormDescription>
                            Responde todo colaborador com vínculo ativo nesses cargos.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {audience === QUESTIONNAIRE_AUDIENCE.USERS && (
                    <FormField
                      control={form.control}
                      name="userIds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Colaboradores <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Combobox
                              async
                              mode="multiple"
                              queryKey={["users", "questionnaire-create"]}
                              queryFn={queryUsers}
                              initialOptions={[]}
                              getOptionLabel={getUserOptionLabel}
                              getOptionValue={getUserOptionValue}
                              value={field.value}
                              onValueChange={(v) => field.onChange((v as string[] | null) ?? [])}
                              placeholder="Selecione os colaboradores"
                              emptyText="Nenhum colaborador encontrado"
                              searchPlaceholder="Buscar colaborador..."
                              searchable
                              minSearchLength={0}
                              pageSize={50}
                              debounceMs={300}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </CardContent>
              </Card>

              {/* Perguntas — tema primeiro (encurta a lista), pergunta depois. */}
              <Card>
                <CardHeader>
                  <CardTitle>Perguntas</CardTitle>
                  <CardDescription>
                    Escolha os temas para encurtar o catálogo e depois marque as perguntas. Sem tema
                    selecionado, todas as perguntas ativas ficam disponíveis.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="filterGroupIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Temas</FormLabel>
                        <FormControl>
                          <Combobox
                            mode="multiple"
                            value={field.value}
                            onValueChange={(v) => {
                              const next = (v as string[] | null) ?? [];
                              field.onChange(next);
                              // Perguntas que saíram de vista saem também da
                              // seleção — senão o questionário levaria perguntas
                              // de um tema que o admin acabou de descartar, sem
                              // nenhuma pista na tela.
                              //
                              // SEM `shouldValidate`: validar aqui acusava
                              // "selecione ao menos uma pergunta" antes de o
                              // admin ter chance de escolher — e, como o
                              // formulário só revalida depois de um envio, a
                              // mensagem ficava presa mesmo com perguntas já
                              // marcadas.
                              if (next.length) {
                                const visible = new Set(
                                  ((questionsResp?.data ?? []) as any[])
                                    .filter((q) => next.includes(q.groupId))
                                    .map((q) => q.id),
                                );
                                form.setValue(
                                  "questionIds",
                                  form.getValues("questionIds").filter((id) => visible.has(id)),
                                );
                              }
                            }}
                            options={temaOptions}
                            placeholder="Todos os temas"
                            emptyText="Nenhum tema cadastrado."
                            searchable
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="questionIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Perguntas <span className="text-destructive">*</span>
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            {field.value.length} de {questionOptions.length} selecionada(s)
                          </span>
                        </FormLabel>
                        <FormControl>
                          <Combobox
                            mode="multiple"
                            value={field.value}
                            // `shouldValidate` aqui é o que APAGA o erro assim
                            // que a primeira pergunta é marcada: o modo padrão
                            // do react-hook-form só revalida após um envio.
                            onValueChange={(v) =>
                              form.setValue("questionIds", (v as string[] | null) ?? [], {
                                shouldValidate: true,
                                shouldDirty: true,
                              })
                            }
                            options={questionOptions}
                            placeholder="Selecione as perguntas"
                            emptyText={
                              filterGroupIds.length
                                ? "Nenhuma pergunta ativa nos temas selecionados."
                                : "Nenhuma pergunta no catálogo. Cadastre perguntas primeiro."
                            }
                            searchable
                          />
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
