// pages/administration/questionnaire/temas/details/[id].tsx
//
// Read-only details page for a Tema (QuestionnaireGroup). Mirrors the Skill
// details page: PageHeader (variant="detail") + Informações + Descrição cards
// + a list of Perguntas. Clicking a row in the temas list lands here; an
// "Editar" action takes the admin to the edit page.

import { Navigate, useNavigate, useParams } from "react-router-dom";
import {
  IconCalendarPlus,
  IconCalendarTime,
  IconClipboardList,
  IconEdit,
  IconHash,
  IconInfoCircle,
  IconListNumbers,
  IconLoader2,
  IconToggleRight,
} from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES } from "../../../../../constants";
import { formatDateTime } from "../../../../../utils";
import { useQuestionnaireGroup } from "../../../../../hooks/questionnaire/use-questionnaire";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DetailRow } from "@/components/ui/detail-row";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const QuestionnaireTemaDetailsPage = () => {
  usePageTracker({ title: "Detalhes do Tema", icon: "clipboard-list" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuestionnaireGroup(
    id,
    {
      include: {
        _count: { select: { questions: true } },
        questions: true,
      },
    } as any,
  );

  if (!id) return <Navigate to={routes.administration.questionnaire.temas} replace />;
  if (error) return <Navigate to={routes.administration.questionnaire.temas} replace />;
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  const group = data?.data;
  if (!group) return <Navigate to={routes.administration.questionnaire.temas} replace />;

  const sortedQuestions = [...(group.questions ?? [])].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );
  const questionsCount = group._count?.questions ?? sortedQuestions.length;

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.HUMAN_RESOURCES]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="detail"
          entity={group as any}
          title={group.name}
          icon={IconClipboardList}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Administração", href: routes.administration.root },
            { label: "Questionários", href: routes.administration.questionnaire.root },
            { label: "Temas", href: routes.administration.questionnaire.temas },
            { label: group.name },
          ]}
          actions={[
            {
              key: "edit",
              label: "Editar",
              icon: IconEdit,
              onClick: () => navigate(routes.administration.questionnaire.temaEdit(id)),
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
                    icon={IconHash}
                    label="Ordem"
                    value={<span className="font-mono">{group.order}</span>}
                  />
                  <DetailRow
                    icon={IconToggleRight}
                    label="Status"
                    value={
                      group.isActive ? (
                        <Badge variant="green" className="font-normal">Ativa</Badge>
                      ) : (
                        <Badge variant="gray" className="font-normal">Inativa</Badge>
                      )
                    }
                  />
                  <DetailRow
                    icon={IconListNumbers}
                    label="Total de perguntas"
                    value={
                      <span>
                        {questionsCount} pergunta{questionsCount !== 1 ? "s" : ""}
                      </span>
                    }
                  />
                  <DetailRow
                    icon={IconCalendarPlus}
                    label="Criado em"
                    value={
                      <span className="text-sm">
                        {group.createdAt ? formatDateTime(group.createdAt) : "—"}
                      </span>
                    }
                  />
                  <DetailRow
                    icon={IconCalendarTime}
                    label="Atualizado em"
                    value={
                      <span className="text-sm">
                        {group.updatedAt ? formatDateTime(group.updatedAt) : "—"}
                      </span>
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* Descrição Card */}
            <Card>
              <CardHeader>
                <CardTitle>Descrição</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/50 rounded-lg px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
                  {group.description || (
                    <span className="text-muted-foreground italic">
                      Nenhuma descrição cadastrada.
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Perguntas table */}
          <Card>
            <CardHeader>
              <CardTitle>Perguntas ({questionsCount})</CardTitle>
            </CardHeader>
            <CardContent>
              {sortedQuestions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma pergunta cadastrada.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Ordem</TableHead>
                      <TableHead className="w-[28rem] min-w-[320px]">Título</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="w-24 text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedQuestions.map((q) => (
                      <TableRow
                        key={q.id}
                        className="cursor-pointer"
                        onClick={() =>
                          navigate(routes.administration.questionnaire.perguntaDetail(q.id))
                        }
                      >
                        <TableCell className="font-mono text-muted-foreground">{q.order}</TableCell>
                        <TableCell className="font-medium">{q.title}</TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {q.description || (
                            <span className="text-muted-foreground/60 italic">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {q.isActive ? (
                            <Badge variant="green" className="font-normal">Ativa</Badge>
                          ) : (
                            <Badge variant="gray" className="font-normal">Inativa</Badge>
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

export default QuestionnaireTemaDetailsPage;
