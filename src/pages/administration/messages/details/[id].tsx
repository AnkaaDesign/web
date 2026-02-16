import { useParams, useNavigate } from "react-router-dom";
import { routes, FAVORITE_PAGES } from "../../../../constants";
import { PageHeader } from "@/components/ui/page-header";
import { IconMessageCircle, IconEdit, IconTrash, IconRefresh } from "@tabler/icons-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageBlockRenderer } from "@/components/messaging/MessageBlockRenderer";
import { transformBlocksForDisplay } from "@/utils/message-transformer";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMessage, useDeleteMessage, useMessageStats } from "@/hooks/administration/use-message";
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
import { MessageViewersTable } from "@/components/administration/message/detail";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

  const STATUS_VARIANTS: Record<string, "secondary" | "active" | "pending" | "expired" | "muted"> = {
    DRAFT: "secondary",
    SCHEDULED: "pending",
    ACTIVE: "active",
    EXPIRED: "expired",
    ARCHIVED: "muted",
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
          <div className="space-y-4">
            {/* Main Grid: Info (1/3) + Content Preview (2/3) */}
            <div className="grid gap-4 lg:grid-cols-3">
              {/* Message Info + Stats (1/3) */}
              <Card className="lg:col-span-1">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle>Informações</CardTitle>
                    <Badge variant={STATUS_VARIANTS[message.status]}>
                      {STATUS_LABELS[message.status]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {/* Target */}
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                    <span className="text-sm font-medium text-muted-foreground">Público-Alvo</span>
                    {!message.targets || message.targets.length === 0 ? (
                      <span className="text-sm font-semibold text-foreground">Todos os usuários</span>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-sm font-semibold text-foreground cursor-help underline decoration-dotted underline-offset-2">
                            {message.targets.length} usuário(s)
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-xs">
                          <div className="space-y-1">
                            {message.targets.map((target: any) => (
                              <div key={target.id} className="text-sm">
                                {target.user?.name || target.userId}
                              </div>
                            ))}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>

                  {/* Created by */}
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                    <span className="text-sm font-medium text-muted-foreground">Criado por</span>
                    <span className="text-sm font-semibold text-foreground">
                      {message.createdBy?.name || "—"}
                    </span>
                  </div>

                  {/* Created at */}
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                    <span className="text-sm font-medium text-muted-foreground">Criada em</span>
                    <span className="text-sm font-semibold text-foreground">
                      {format(new Date(message.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>

                  {/* Published at */}
                  {message.publishedAt && (
                    <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                      <span className="text-sm font-medium text-muted-foreground">Publicada em</span>
                      <span className="text-sm font-semibold text-foreground">
                        {format(new Date(message.publishedAt), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  )}

                  {/* Date range */}
                  {message.startDate && (
                    <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                      <span className="text-sm font-medium text-muted-foreground">Início</span>
                      <span className="text-sm font-semibold text-foreground">
                        {format(new Date(message.startDate), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  )}
                  {message.endDate && (
                    <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                      <span className="text-sm font-medium text-muted-foreground">Término</span>
                      <span className="text-sm font-semibold text-foreground">
                        {format(new Date(message.endDate), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  )}

                  {/* Stats Section */}
                  <div className="pt-3 mt-3 border-t border-border">
                    <div className="text-sm font-medium mb-2">Estatísticas</div>
                    {isLoadingStats ? (
                      <div className="space-y-2">
                        <Skeleton className="h-10 w-full rounded-lg" />
                        <Skeleton className="h-10 w-full rounded-lg" />
                      </div>
                    ) : stats ? (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                          <span className="text-sm font-medium text-muted-foreground">Visualizações</span>
                          <span className="text-sm font-semibold text-foreground">{stats.totalViews}</span>
                        </div>
                        <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                          <span className="text-sm font-medium text-muted-foreground">Únicos</span>
                          <span className="text-sm font-semibold text-foreground">{stats.uniqueViewers}</span>
                        </div>
                        <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                          <span className="text-sm font-medium text-muted-foreground">Dispensadas</span>
                          <span className="text-sm font-semibold text-foreground">{stats.totalDismissals ?? 0}</span>
                        </div>
                        <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                          <span className="text-sm font-medium text-muted-foreground">Usuários Alvo</span>
                          <span className="text-sm font-semibold text-foreground">{stats.targetedUsers}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        Não disponível
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Content Preview (2/3) */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Prévia do Conteúdo</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border border-border rounded-lg px-4 py-3 bg-card">
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

            {/* Message Viewers Table - Full Width */}
            <MessageViewersTable message={message} />
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
