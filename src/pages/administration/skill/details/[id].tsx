import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import {
  IconAlertTriangle,
  IconCalendarPlus,
  IconCalendarTime,
  IconClipboardList,
  IconEdit,
  IconEye,
  IconHash,
  IconInfoCircle,
  IconListNumbers,
  IconLoader2,
  IconRefresh,
  IconToggleRight,
  IconTrash,
} from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES } from "../../../../constants";
import { formatDateTime } from "../../../../utils";
import { useSkill, useSkillMutations, useTopicMutations } from "../../../../hooks";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailRow } from "@/components/ui/detail-row";
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
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const SkillDetailsPage = () => {
  usePageTracker({ title: "Detalhes da Competência", icon: "clipboard-list" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const { data, isLoading, error, refetch, isRefetching } = useSkill(id ?? "", {
    include: {
      topics: {
        include: { _count: { select: { levels: true } } } as any,
        orderBy: { order: "asc" },
      } as any,
      _count: { select: { topics: true } },
    } as any,
    enabled: !!id,
  } as any);

  const { deleteAsync, deleteMutation } = useSkillMutations();
  const { deleteAsync: deleteTopicAsync, deleteMutation: deleteTopicMutation } =
    useTopicMutations();

  // Right-click context menu state for embedded Tópicos table
  const [topicContextMenu, setTopicContextMenu] = useState<{
    x: number;
    y: number;
    topicId: string;
    topicTitle: string;
  } | null>(null);
  const [topicToDelete, setTopicToDelete] = useState<
    { id: string; title: string } | null
  >(null);

  // Close context menu on any click outside
  useEffect(() => {
    const handleClick = () => setTopicContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  if (!id) return <Navigate to={routes.administration.skill.root} replace />;
  if (error) return <Navigate to={routes.administration.skill.root} replace />;
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  const skill = data?.data;
  if (!skill) return <Navigate to={routes.administration.skill.root} replace />;

  const sortedTopics = [...(skill.topics ?? [])].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );

  const handleDelete = async () => {
    try {
      await deleteAsync(id);
      // Success/error toasts handled by the axios interceptor.
      navigate(routes.administration.skill.root);
    } catch {
      // Error toast handled by the axios interceptor.
    } finally {
      setIsDeleteOpen(false);
    }
  };

  const handleConfirmDeleteTopic = async () => {
    if (!topicToDelete) return;
    try {
      await deleteTopicAsync(topicToDelete.id);
      // Success/error toasts handled by the axios interceptor.
    } catch {
      // Error toast handled by the axios interceptor.
    } finally {
      setTopicToDelete(null);
    }
  };

  const topicsCount = skill._count?.topics ?? 0;

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.PRODUCTION_MANAGER]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="detail"
          entity={skill as any}
          title={skill.name}
          icon={IconClipboardList}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Administração", href: routes.administration.root },
            { label: "Competências", href: routes.administration.skill.root },
            { label: skill.name },
          ]}
          actions={[
            { key: "refresh", label: "Atualizar", icon: IconRefresh, onClick: () => refetch(), loading: isRefetching },
            { key: "edit", label: "Editar", icon: IconEdit, onClick: () => navigate(routes.administration.skill.edit(id)) },
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
                    icon={IconHash}
                    label="Ordem"
                    value={<span className="font-mono">{skill.order}</span>}
                  />
                  <DetailRow
                    icon={IconToggleRight}
                    label="Status"
                    value={
                      skill.isActive ? (
                        <Badge variant="green" className="font-normal">
                          Ativa
                        </Badge>
                      ) : (
                        <Badge variant="gray" className="font-normal">
                          Inativa
                        </Badge>
                      )
                    }
                  />
                  <DetailRow
                    icon={IconListNumbers}
                    label="Total de tópicos"
                    value={
                      <span>
                        {topicsCount} tópico{topicsCount !== 1 ? "s" : ""}
                      </span>
                    }
                  />
                  <DetailRow
                    icon={IconCalendarPlus}
                    label="Criada em"
                    value={
                      <span className="text-sm">
                        {skill.createdAt ? formatDateTime(skill.createdAt) : "—"}
                      </span>
                    }
                  />
                  <DetailRow
                    icon={IconCalendarTime}
                    label="Atualizada em"
                    value={
                      <span className="text-sm">
                        {skill.updatedAt ? formatDateTime(skill.updatedAt) : "—"}
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
                  {skill.description || (
                    <span className="text-muted-foreground italic">Nenhuma descrição cadastrada.</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Topics table — full width */}
          <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>
                  Tópicos ({topicsCount || sortedTopics.length})
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(routes.administration.topic.create + `?skillId=${skill.id}`)}
                >
                  Adicionar tópico
                </Button>
              </CardHeader>
              <CardContent>
                {sortedTopics.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum tópico cadastrado.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Ordem</TableHead>
                        <TableHead>Título</TableHead>
                        <TableHead className="w-24 text-center">Níveis</TableHead>
                        <TableHead className="w-24 text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedTopics.map((t) => (
                        <TableRow
                          key={t.id}
                          className="cursor-pointer"
                          onClick={() => navigate(routes.administration.topic.details(t.id))}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setTopicContextMenu({
                              x: e.clientX,
                              y: e.clientY,
                              topicId: t.id,
                              topicTitle: t.title,
                            });
                          }}
                        >
                          <TableCell className="font-mono text-muted-foreground">{t.order}</TableCell>
                          <TableCell className="font-medium">{t.title}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={t._count?.levels === 6 ? "green" : "gray"} className="font-normal">
                              {t._count?.levels ?? 0} / 6
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {t.isActive ? (
                              <Badge variant="green" className="font-normal">Ativo</Badge>
                            ) : (
                              <Badge variant="gray" className="font-normal">Inativo</Badge>
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

        {/* Right-click context menu for embedded Tópicos table */}
        <DropdownMenu
          open={!!topicContextMenu}
          onOpenChange={(open) => !open && setTopicContextMenu(null)}
        >
          <PositionedDropdownMenuContent
            position={topicContextMenu}
            isOpen={!!topicContextMenu}
            className="w-56 ![position:fixed]"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <DropdownMenuItem
              onClick={() => {
                if (topicContextMenu) {
                  navigate(routes.administration.topic.details(topicContextMenu.topicId));
                  setTopicContextMenu(null);
                }
              }}
            >
              <IconEye className="mr-2 h-4 w-4" />
              Ver detalhes
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                if (topicContextMenu) {
                  navigate(routes.administration.topic.edit(topicContextMenu.topicId));
                  setTopicContextMenu(null);
                }
              }}
            >
              <IconEdit className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => {
                if (topicContextMenu) {
                  setTopicToDelete({
                    id: topicContextMenu.topicId,
                    title: topicContextMenu.topicTitle,
                  });
                  setTopicContextMenu(null);
                }
              }}
            >
              <IconTrash className="mr-2 h-4 w-4" />
              Excluir
            </DropdownMenuItem>
          </PositionedDropdownMenuContent>
        </DropdownMenu>

        {/* Topic delete confirmation */}
        <AlertDialog
          open={!!topicToDelete}
          onOpenChange={(open) => !open && setTopicToDelete(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <IconAlertTriangle className="h-5 w-5 text-destructive" />
                Confirmar Exclusão
              </AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o tópico "{topicToDelete?.title}"?
                Esta ação não poderá ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDeleteTopic}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteTopicMutation.isPending}
              >
                {deleteTopicMutation.isPending ? "Excluindo..." : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <IconAlertTriangle className="h-5 w-5 text-destructive" />
                Confirmar Exclusão
              </AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir a competência "{skill.name}"?
                {skill._count?.topics ? (
                  <span className="block mt-2 font-medium text-destructive">
                    Esta competência possui {skill._count.topics} tópico
                    {skill._count.topics !== 1 ? "s" : ""}.
                  </span>
                ) : null}
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

export default SkillDetailsPage;
