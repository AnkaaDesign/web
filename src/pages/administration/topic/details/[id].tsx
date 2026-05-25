import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import {
  IconAlertTriangle,
  IconCalendarPlus,
  IconCalendarTime,
  IconClipboardList,
  IconEdit,
  IconHash,
  IconInfoCircle,
  IconListNumbers,
  IconLoader2,
  IconRefresh,
  IconStack2,
  IconToggleRight,
  IconTrash,
} from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES } from "../../../../constants";
import { formatDateTime } from "../../../../utils";
import { useTopic, useTopicMutations } from "../../../../hooks";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DetailRow } from "@/components/ui/detail-row";
import { ScoreBadge } from "@/components/production/skill-assessment/score-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const TopicDetailsPage = () => {
  usePageTracker({ title: "Detalhes do Tópico", icon: "clipboard-list" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const { data, isLoading, error, refetch, isRefetching } = useTopic(id ?? "", {
    include: {
      skill: true,
      levels: { orderBy: { score: "asc" } } as any,
      _count: { select: { levels: true, responses: true } },
    } as any,
    enabled: !!id,
  } as any);

  const { deleteAsync, deleteMutation } = useTopicMutations();

  if (!id) return <Navigate to={routes.administration.topic.root} replace />;
  if (error) return <Navigate to={routes.administration.topic.root} replace />;
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  const topic = data?.data;
  if (!topic) return <Navigate to={routes.administration.topic.root} replace />;

  const sortedLevels = [...(topic.levels ?? [])].sort((a, b) => a.score - b.score);

  const handleDelete = async () => {
    try {
      await deleteAsync(id);
      // Success/error toasts handled by the axios interceptor.
      navigate(routes.administration.topic.root);
    } catch {
      // Error toast handled by the axios interceptor.
    } finally {
      setIsDeleteOpen(false);
    }
  };

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.PRODUCTION_MANAGER]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="detail"
          entity={topic as any}
          title={topic.title}
          icon={IconClipboardList}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Administração" },
            { label: "Tópicos", href: routes.administration.topic.root },
            { label: topic.title },
          ]}
          actions={[
            { key: "refresh", label: "Atualizar", icon: IconRefresh, onClick: () => refetch(), loading: isRefetching },
            { key: "edit", label: "Editar", icon: IconEdit, onClick: () => navigate(routes.administration.topic.edit(id)) },
            { key: "delete", label: "Excluir", icon: IconTrash, onClick: () => setIsDeleteOpen(true), disabled: deleteMutation.isPending },
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 overflow-y-auto pb-6 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Informações Card — includes system dates */}
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
                    label="Competência"
                    value={
                      topic.skill ? (
                        <Badge variant="default" className="font-normal">
                          {topic.skill.name}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )
                    }
                  />
                  <DetailRow
                    icon={IconHash}
                    label="Ordem"
                    value={<span className="font-mono">{topic.order}</span>}
                  />
                  <DetailRow
                    icon={IconToggleRight}
                    label="Status"
                    value={
                      topic.isActive ? (
                        <Badge variant="green" className="font-normal">Ativo</Badge>
                      ) : (
                        <Badge variant="gray" className="font-normal">Inativo</Badge>
                      )
                    }
                  />
                  <DetailRow
                    icon={IconListNumbers}
                    label="Níveis"
                    value={
                      <Badge
                        variant={sortedLevels.length === 6 ? "green" : "gray"}
                        className="font-normal"
                      >
                        {sortedLevels.length} / 6
                      </Badge>
                    }
                  />
                  <DetailRow
                    icon={IconCalendarPlus}
                    label="Criado em"
                    value={
                      <span className="text-sm">
                        {topic.createdAt ? formatDateTime(topic.createdAt) : "—"}
                      </span>
                    }
                  />
                  <DetailRow
                    icon={IconCalendarTime}
                    label="Atualizado em"
                    value={
                      <span className="text-sm">
                        {topic.updatedAt ? formatDateTime(topic.updatedAt) : "—"}
                      </span>
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* Conteúdo Card — description + counter-behaviors */}
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
                    {topic.description || (
                      <span className="text-muted-foreground italic">
                        Nenhuma descrição cadastrada.
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Comportamentos Contrários
                  </h4>
                  <div className="bg-muted/50 rounded-lg px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
                    {topic.counterBehaviors || (
                      <span className="text-muted-foreground italic">
                        Nenhum comportamento contrário cadastrado.
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Níveis ({sortedLevels.length} / 6)</CardTitle>
            </CardHeader>
            <CardContent>
              {sortedLevels.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum nível cadastrado. Edite o tópico para definir os 6 níveis.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16 text-center">Nota</TableHead>
                      <TableHead className="w-60">Nome</TableHead>
                      <TableHead>Descrição</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedLevels.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="text-center">
                          <ScoreBadge score={l.score} size="md" />
                        </TableCell>
                        <TableCell className="font-medium">{l.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {l.description}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <IconAlertTriangle className="h-5 w-5 text-destructive" />
                Confirmar Exclusão
              </AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o tópico "{topic.title}"?
                Esta ação não poderá ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PrivilegeRoute>
  );
};

export default TopicDetailsPage;
