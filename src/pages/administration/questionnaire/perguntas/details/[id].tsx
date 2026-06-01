// pages/administration/questionnaire/perguntas/details/[id].tsx
//
// Read-only details page for a Pergunta (QuestionnaireQuestion). Mirrors the
// Topic details page layout/structure: PageHeader (variant="detail") +
// Informações card + Opções de resposta section. Clicking a row in the
// perguntas list lands here; an "Editar" action takes the admin to the
// edit page.

import { Navigate, useNavigate, useParams } from "react-router-dom";
import {
  IconCalendarPlus,
  IconCalendarTime,
  IconClipboardList,
  IconEdit,
  IconHash,
  IconHelpCircle,
  IconInfoCircle,
  IconLoader2,
  IconStack2,
  IconToggleRight,
} from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES } from "../../../../../constants";
import { formatDateTime } from "../../../../../utils";
import { useQuestionnaireQuestion } from "../../../../../hooks/questionnaire/use-questionnaire";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DetailRow } from "@/components/ui/detail-row";
import { ScoreBadge } from "@/components/production/skill-assessment/score-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const QuestionnairePerguntaDetailsPage = () => {
  usePageTracker({ title: "Detalhes da Pergunta", icon: "clipboard-list" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuestionnaireQuestion(
    id,
    { include: { group: true, options: true } } as any,
  );

  if (!id) return <Navigate to={routes.administration.questionnaire.perguntas} replace />;
  if (error) return <Navigate to={routes.administration.questionnaire.perguntas} replace />;
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  const question = data?.data;
  if (!question) return <Navigate to={routes.administration.questionnaire.perguntas} replace />;

  const sortedOptions = [...(question.options ?? [])].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.HUMAN_RESOURCES]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="detail"
          entity={question as any}
          title={question.title}
          icon={IconClipboardList}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Administração", href: routes.administration.root },
            { label: "Questionários", href: routes.administration.questionnaire.root },
            { label: "Perguntas", href: routes.administration.questionnaire.perguntas },
            { label: question.title },
          ]}
          actions={[
            {
              key: "edit",
              label: "Editar",
              icon: IconEdit,
              onClick: () => navigate(routes.administration.questionnaire.perguntaEdit(id)),
            },
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 overflow-y-auto pb-6 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Informações Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconInfoCircle className="h-5 w-5 text-muted-foreground" />
                  Informações
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <DetailRow
                    icon={IconStack2}
                    label="Tema"
                    value={
                      question.group ? (
                        <Badge variant="default" className="font-normal">
                          {question.group.name}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )
                    }
                  />
                  <DetailRow
                    icon={IconHash}
                    label="Ordem"
                    value={<span className="font-mono">{question.order}</span>}
                  />
                  <DetailRow
                    icon={IconToggleRight}
                    label="Status"
                    value={
                      question.isActive ? (
                        <Badge variant="green" className="font-normal">Ativa</Badge>
                      ) : (
                        <Badge variant="gray" className="font-normal">Inativa</Badge>
                      )
                    }
                  />
                  <DetailRow
                    icon={IconCalendarPlus}
                    label="Criada em"
                    value={
                      <span className="text-sm">
                        {question.createdAt ? formatDateTime(question.createdAt) : "—"}
                      </span>
                    }
                  />
                  <DetailRow
                    icon={IconCalendarTime}
                    label="Atualizada em"
                    value={
                      <span className="text-sm">
                        {question.updatedAt ? formatDateTime(question.updatedAt) : "—"}
                      </span>
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* Conteúdo Card — description + helpText */}
            <Card>
              <CardHeader>
                <CardTitle>Conteúdo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Descrição
                  </h4>
                  <div className="bg-muted/50 rounded-lg px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
                    {question.description || (
                      <span className="text-muted-foreground italic">
                        Nenhuma descrição cadastrada.
                      </span>
                    )}
                  </div>
                </div>
                {question.helpText ? (
                  <div>
                    <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <IconHelpCircle className="h-3.5 w-3.5" />
                      Texto de ajuda
                    </h4>
                    <div className="bg-muted/50 rounded-lg px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
                      {question.helpText}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          {/* Opções de resposta */}
          <Card>
            <CardHeader>
              <CardTitle>Opções de resposta ({sortedOptions.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {sortedOptions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma opção cadastrada. Edite a pergunta para definir as opções de resposta.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20 text-center">Valor</TableHead>
                      <TableHead className="w-60">Rótulo</TableHead>
                      <TableHead>Descrição</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedOptions.map((opt) => (
                      <TableRow key={opt.id}>
                        <TableCell className="text-center">
                          <ScoreBadge score={opt.value} label={String(opt.value)} size="md" />
                        </TableCell>
                        <TableCell className="font-medium">{opt.label}</TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {opt.description || (
                            <span className="text-muted-foreground/60 italic">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default QuestionnairePerguntaDetailsPage;
