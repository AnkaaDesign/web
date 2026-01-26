import { useParams, useNavigate } from "react-router-dom";
import { routes, FAVORITE_PAGES } from "../../../../constants";
import { PageHeader } from "@/components/ui/page-header";
import { IconMessageCircle, IconEdit, IconTrash, IconArrowLeft, IconRefresh } from "@tabler/icons-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageBlockRenderer } from "@/components/messaging/MessageBlockRenderer";
import { transformBlocksForDisplay } from "@/utils/message-transformer";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMessage, useDeleteMessage, useMessageStats } from "@/hooks/useMessage";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { useState } from "react";

export const MessageDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Fetch message data and stats from API
  const { data: response, isLoading, error, refetch } = useMessage(id!);
  const { data: statsResponse, isLoading: isLoadingStats } = useMessageStats(id!);
  const deleteMessage = useDeleteMessage();

  const message = response?.data;
  const stats = statsResponse?.data;


  const handleEdit = () => {
    navigate(routes.administration.messages.edit(id!));
  };

  const handleDelete = async () => {
    try {
      await deleteMessage.mutateAsync(id!);
      navigate(routes.administration.messages.root);
    } catch (error) {
      console.error("Error deleting message:", error);
    }
    setShowDeleteDialog(false);
  };

  const handleBack = () => {
    navigate(routes.administration.messages.root);
  };

  const handleRefresh = () => {
    refetch();
  };

  const STATUS_LABELS: Record<string, string> = {
    DRAFT: "Rascunho",
    SCHEDULED: "Agendada",
    ACTIVE: "Ativa",
    EXPIRED: "Expirada",
    ARCHIVED: "Arquivada",
  };

  const STATUS_VARIANTS: Record<string, "secondary" | "default" | "outline" | "destructive"> = {
    DRAFT: "secondary",
    SCHEDULED: "outline",
    ACTIVE: "default",
    EXPIRED: "destructive",
    ARCHIVED: "outline",
  };

  const TARGET_TYPE_LABELS: Record<string, string> = {
    ALL_USERS: "Todos os usuários",
    SPECIFIC_USERS: "Usuários específicos",
    SPECIFIC_SECTORS: "Setores específicos",
    SPECIFIC_POSITIONS: "Cargos específicos",
    SECTOR_PRIVILEGE: "Nível de privilégio",
  };

  const actions = [
    {
      key: "refresh",
      label: "Atualizar",
      icon: IconRefresh,
      onClick: handleRefresh,
      variant: "outline" as const,
    },
    {
      key: "edit",
      label: "Editar",
      icon: IconEdit,
      onClick: handleEdit,
      variant: "default" as const,
    },
    {
      key: "delete",
      label: "Excluir",
      icon: IconTrash,
      onClick: () => setShowDeleteDialog(true),
      variant: "destructive" as const,
    },
  ];

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <div className="flex-shrink-0">
          <Skeleton className="h-16 w-full" />
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !message) {
    return (
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <div>
          <Alert variant="destructive">
            <AlertDescription>
              {error ? "Erro ao carregar mensagem." : "Mensagem não encontrada."}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <div className="flex-shrink-0">
          <PageHeader
            variant="detail"
            title={message.title}
            icon={IconMessageCircle}
            favoritePage={FAVORITE_PAGES.ADMINISTRACAO_MENSAGENS_LISTAR}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Administração", href: routes.administration.root },
              { label: "Mensagens", href: routes.administration.messages.root },
              { label: "Detalhes" },
            ]}
            actions={actions}
          />
        </div>

        <div className="flex-1 overflow-y-auto pb-6">
          <div className="space-y-6">
          {/* Info and Stats Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Status and Info */}
            <Card>
              <CardHeader>
                <CardTitle>Informações da Mensagem</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Status</div>
                    <Badge variant={STATUS_VARIANTS[message.status]}>
                      {STATUS_LABELS[message.status]}
                    </Badge>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Criado por</div>
                    <div className="text-sm">
                      {message.createdBy?.name || "Não informado"}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Público-Alvo</div>
                    <div className="text-sm">
                      {!message.targets || message.targets.length === 0
                        ? "Todos os usuários"
                        : `${message.targets.length} usuário(s) específico(s)`}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Criada em</div>
                    <div className="text-sm">
                      {format(new Date(message.createdAt), "dd/MM/yyyy 'às' HH:mm", {
                        locale: ptBR,
                      })}
                    </div>
                  </div>
                  {message.publishedAt && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Publicada em</div>
                      <div className="text-sm">
                        {format(new Date(message.publishedAt), "dd/MM/yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </div>
                    </div>
                  )}
                  {message.startDate && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">
                        Data de Início
                      </div>
                      <div className="text-sm">
                        {format(
                          new Date(message.startDate),
                          "dd/MM/yyyy 'às' HH:mm",
                          { locale: ptBR }
                        )}
                      </div>
                    </div>
                  )}
                  {message.endDate && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">
                        Data de Término
                      </div>
                      <div className="text-sm">
                        {format(
                          new Date(message.endDate),
                          "dd/MM/yyyy 'às' HH:mm",
                          { locale: ptBR }
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>Estatísticas</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingStats ? (
                  <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : stats ? (
                  <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                    <div className="flex flex-col">
                      <div className="text-2xl font-bold">{stats.totalViews}</div>
                      <div className="text-sm text-muted-foreground">Visualizações</div>
                    </div>
                    <div className="flex flex-col">
                      <div className="text-2xl font-bold">{stats.uniqueViewers}</div>
                      <div className="text-sm text-muted-foreground">
                        Visualizadores Únicos
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <div className="text-2xl font-bold">{stats.totalDismissals ?? 0}</div>
                      <div className="text-sm text-muted-foreground">
                        Dispensadas
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <div className="text-2xl font-bold">{stats.targetedUsers}</div>
                      <div className="text-sm text-muted-foreground">Usuários Alvo</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    Estatísticas não disponíveis
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Message Content Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Prévia do Conteúdo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-6 bg-card">
                {(() => {
                  // Handle content - API returns { blocks: [...], version: "1.0" }
                  let blocks = message.content?.blocks || message.content;

                  // If content is a string, try to parse it
                  if (typeof blocks === 'string') {
                    try {
                      blocks = JSON.parse(blocks);
                      // After parsing, check if it has blocks property
                      if (blocks?.blocks) {
                        blocks = blocks.blocks;
                      }
                    } catch (e) {
                      console.error('Failed to parse content:', e);
                      blocks = null;
                    }
                  }

                  // Check if we have valid blocks
                  if (blocks && Array.isArray(blocks) && blocks.length > 0) {
                    return <MessageBlockRenderer blocks={transformBlocksForDisplay(blocks)} />;
                  }

                  return (
                    <div className="text-sm text-muted-foreground text-center py-8">
                      Nenhum conteúdo disponível
                    </div>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Mensagem</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta mensagem? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
