// pages/administration/questionnaire/catalogue.tsx
//
// Catalogue management for the questionnaire domain: QuestionnaireGroups (the
// "main group", ≈ Skill) → QuestionnaireQuestions (≈ Topic) → Options (≈ levels).
// Compact single-page admin: create/delete groups; per group, create/delete
// questions with an inline options editor.

import { useMemo, useState } from "react";
import {
  IconClipboardList,
  IconPlus,
  IconTrash,
  IconChevronDown,
} from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES } from "@/constants";
import {
  useQuestionnaireGroups,
  useCreateQuestionnaireGroup,
  useDeleteQuestionnaireGroup,
  useQuestionnaireQuestions,
  useCreateQuestionnaireQuestion,
  useDeleteQuestionnaireQuestion,
} from "@/hooks/questionnaire/use-questionnaire";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScoreBadge } from "@/components/production/skill-assessment/score-badge";
import type { QuestionnaireOptionFormData } from "@/types";

const DEFAULT_OPTIONS: QuestionnaireOptionFormData[] = [
  { order: 0, value: 1, label: "Muito insatisfeito" },
  { order: 1, value: 2, label: "Insatisfeito" },
  { order: 2, value: 3, label: "Neutro" },
  { order: 3, value: 4, label: "Satisfeito" },
  { order: 4, value: 5, label: "Muito satisfeito" },
];

export const QuestionnaireCataloguePage = () => {
  usePageTracker({ title: "Grupos e Perguntas", icon: "clipboard-list" });

  const { data: groupsResp } = useQuestionnaireGroups({ orderBy: { order: "asc" }, limit: 500 });
  const { data: questionsResp } = useQuestionnaireQuestions({
    include: { options: true, group: true },
    orderBy: [{ groupId: "asc" }, { order: "asc" }],
    limit: 1000,
  });

  const createGroup = useCreateQuestionnaireGroup();
  const deleteGroup = useDeleteQuestionnaireGroup();
  const createQuestion = useCreateQuestionnaireQuestion();
  const deleteQuestion = useDeleteQuestionnaireQuestion();

  const groups = useMemo(() => (groupsResp?.data ?? []) as any[], [groupsResp]);
  const questionsByGroup = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const q of (questionsResp?.data ?? []) as any[]) {
      const arr = map.get(q.groupId) ?? [];
      arr.push(q);
      map.set(q.groupId, arr);
    }
    return map;
  }, [questionsResp]);

  // --- new group inline form ---
  const [newGroupName, setNewGroupName] = useState("");
  const handleAddGroup = async () => {
    if (!newGroupName.trim()) return;
    await createGroup.mutateAsync({ name: newGroupName.trim(), order: groups.length });
    setNewGroupName("");
  };

  // --- question dialog ---
  const [questionDialog, setQuestionDialog] = useState<{ groupId: string } | null>(null);

  return (
    <PrivilegeRoute
      requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.HUMAN_RESOURCES]}
    >
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="default"
          title="Grupos e Perguntas"
          icon={IconClipboardList}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Administração" },
            { label: "Questionários", href: routes.administration.questionnaire.root },
            { label: "Grupos e Perguntas" },
          ]}
          className="flex-shrink-0"
        />

        <div className="flex-1 overflow-y-auto pb-6">
          <div className="container mx-auto max-w-4xl space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Novo grupo</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={newGroupName}
                  onChange={(v) => setNewGroupName(String(v ?? ""))}
                  placeholder="Nome do grupo (ex.: Satisfação no trabalho)"
                  onKeyDown={(e) => e.key === "Enter" && handleAddGroup()}
                />
                <Button onClick={handleAddGroup} disabled={createGroup.isPending || !newGroupName.trim()}>
                  <IconPlus className="h-4 w-4" />
                  Adicionar grupo
                </Button>
              </CardContent>
            </Card>

            {groups.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum grupo cadastrado. Crie um grupo para começar.
                </CardContent>
              </Card>
            ) : (
              <Accordion type="multiple" className="w-full">
                {groups.map((group) => {
                  const questions = questionsByGroup.get(group.id) ?? [];
                  return (
                    <AccordionItem key={group.id} value={group.id}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex flex-1 items-center justify-between gap-3 pr-3">
                          <span className="font-medium">{group.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {questions.length} pergunta(s)
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="flex flex-col gap-2">
                          {questions.map((q) => (
                            <div
                              key={q.id}
                              className="flex items-start justify-between gap-3 rounded-md border border-border/40 bg-muted/30 px-3 py-2"
                            >
                              <div className="flex flex-col gap-1 min-w-0">
                                <span className="text-sm font-medium">{q.title}</span>
                                <span className="text-xs text-muted-foreground line-clamp-2">
                                  {q.description}
                                </span>
                                <div className="flex flex-wrap gap-1 pt-1">
                                  {(q.options ?? [])
                                    .slice()
                                    .sort((a: any, b: any) => a.order - b.order)
                                    .map((o: any) => (
                                      <span key={o.id} className="inline-flex items-center gap-1">
                                        <ScoreBadge score={o.value} size="sm" label={o.label} />
                                      </span>
                                    ))}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteQuestion.mutate(q.id)}
                                disabled={deleteQuestion.isPending}
                              >
                                <IconTrash className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          ))}

                          <div className="flex items-center justify-between pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setQuestionDialog({ groupId: group.id })}
                            >
                              <IconPlus className="h-4 w-4" />
                              Nova pergunta
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteGroup.mutate(group.id)}
                              disabled={deleteGroup.isPending}
                            >
                              <IconTrash className="h-4 w-4 text-destructive" />
                              Excluir grupo
                            </Button>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </div>
        </div>

        {questionDialog && (
          <NewQuestionDialog
            groupId={questionDialog.groupId}
            existingCount={(questionsByGroup.get(questionDialog.groupId) ?? []).length}
            onClose={() => setQuestionDialog(null)}
            onCreate={async (data) => {
              await createQuestion.mutateAsync(data);
              setQuestionDialog(null);
            }}
            isSubmitting={createQuestion.isPending}
          />
        )}
      </div>
    </PrivilegeRoute>
  );
};

// ---- New question dialog with inline options editor ----
function NewQuestionDialog({
  groupId,
  existingCount,
  onClose,
  onCreate,
  isSubmitting,
}: {
  groupId: string;
  existingCount: number;
  onClose: () => void;
  onCreate: (data: {
    groupId: string;
    order: number;
    title: string;
    description: string;
    helpText?: string | null;
    options: QuestionnaireOptionFormData[];
  }) => Promise<void>;
  isSubmitting?: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [helpText, setHelpText] = useState("");
  const [options, setOptions] = useState<QuestionnaireOptionFormData[]>(DEFAULT_OPTIONS);

  const valid =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    options.length >= 2 &&
    options.every((o) => o.label.trim().length > 0);

  const updateOption = (idx: number, patch: Partial<QuestionnaireOptionFormData>) =>
    setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, ...patch } : o)));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova pergunta</DialogTitle>
        </DialogHeader>
        <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Título</label>
            <Input value={title} onChange={(v) => setTitle(String(v ?? ""))} placeholder="Pergunta" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Descrição</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o que a pergunta avalia"
              className="min-h-16"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Texto de ajuda (opcional)</label>
            <Textarea
              value={helpText}
              onChange={(e) => setHelpText(e.target.value)}
              placeholder="Instruções adicionais"
              className="min-h-12"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Opções de resposta</label>
              <Button
                variant="ghost"
                size="sm"
                disabled={options.length >= 6}
                onClick={() =>
                  setOptions((prev) => [
                    ...prev,
                    { order: prev.length, value: Math.min(5, prev.length), label: "" },
                  ])
                }
              >
                <IconPlus className="h-4 w-4" />
                Opção
              </Button>
            </div>
            {options.map((o, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={5}
                  value={o.value}
                  onChange={(v) => updateOption(idx, { value: Number(v) || 0 })}
                  className="w-16"
                  title="Valor (0..5)"
                />
                <Input
                  value={o.label}
                  onChange={(v) => updateOption(idx, { label: String(v ?? "") })}
                  placeholder="Rótulo (ex.: Satisfeito)"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setOptions((prev) => prev.filter((_, i) => i !== idx).map((x, i) => ({ ...x, order: i })))}
                  disabled={options.length <= 2}
                >
                  <IconTrash className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!valid || isSubmitting}
            onClick={() =>
              onCreate({
                groupId,
                order: existingCount,
                title: title.trim(),
                description: description.trim(),
                helpText: helpText.trim() || null,
                options: options.map((o, i) => ({ ...o, order: i, label: o.label.trim() })),
              })
            }
          >
            <IconChevronDown className="h-4 w-4 rotate-[-90deg]" />
            Criar pergunta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QuestionnaireCataloguePage;
