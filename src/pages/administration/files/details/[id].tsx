import { PageHeader } from "@/components/ui/page-header";
import { IconFileText, IconDownload, IconEye, IconTrash } from "@tabler/icons-react";
import { useParams } from "react-router-dom";
import { useFile } from "../../../../hooks";
import { CHANGE_LOG_ENTITY_TYPE } from "../../../../constants";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "../../../../utils";
import { formatFileSize, getFileCategory } from "../../../../utils/file";
import { FileTypeIcon } from "@/components/ui/file-type-icon";
import { Badge } from "@/components/ui/badge";

export const FileDetailsPage = () => {
  const { id } = useParams<{ id: string }>();

  const { data: file, isLoading, error } = useFile(
    id!,
    {
      include: {
        tasksArtworks: true,
        customerLogo: true,
        supplierLogo: true,
        orderBudgets: true,
        orderInvoices: true,
        orderReceipts: true,
        taskBudgets: true,
        taskInvoices: true,
        taskReceipts: true,
        warning: true,
        observations: true,
        airbrushingInvoices: true,
        airbrushingReceipts: true,
        externalWithdrawalInvoices: true,
        externalWithdrawalReceipts: true,
      },
    },
    { enabled: !!id }
  );

  if (isLoading) {
    return (
      <div className="flex flex-col h-full space-y-6">
        <PageHeader
          variant="detail"
          title="Carregando..."
          icon={IconFileText}
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Administração", href: "/administracao" },
            { label: "Arquivos", href: "/administracao/arquivos" },
            { label: "Detalhes" },
          ]}
        />
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <Skeleton className="h-7 w-40" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div>
                <Skeleton className="h-96 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || (!isLoading && !file)) {
    return (
      <div className="flex flex-col h-full space-y-6">
        <PageHeader
          variant="detail"
          title="Arquivo não encontrado"
          icon={IconFileText}
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Administração", href: "/administracao" },
            { label: "Arquivos", href: "/administracao/arquivos" },
            { label: "Detalhes" },
          ]}
        />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-muted-foreground">
              {error ? "Erro ao carregar arquivo" : "Arquivo não encontrado"}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const actions = [
    {
      key: "view",
      label: "Visualizar",
      icon: IconEye,
      variant: "outline" as const,
      onClick: () =>,
    },
    {
      key: "download",
      label: "Baixar",
      icon: IconDownload,
      variant: "outline" as const,
      onClick: () =>,
    },
    {
      key: "delete",
      label: "Excluir",
      icon: IconTrash,
      variant: "outline" as const,
      onClick: () =>,
    },
  ];

  return (
    <div className="flex flex-col h-full space-y-6">
      <PageHeader
        variant="detail"
        title={file.filename}
        icon={IconFileText}
        breadcrumbs={[
          { label: "Início", href: "/" },
          { label: "Administração", href: "/administracao" },
          { label: "Arquivos", href: "/administracao/arquivos" },
          { label: file.filename },
        ]}
        actions={actions}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* File Information */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Informações do Arquivo</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 mb-4">
                    <FileTypeIcon filename={file.filename} mimeType={file.mimetype} size="lg" />
                    <div>
                      <h3 className="font-medium">{file.filename}</h3>
                      <p className="text-sm text-muted-foreground capitalize">
                        {getFileCategory(file)} • {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Nome Original</dt>
                      <dd className="mt-1 text-sm">{file.originalName || file.filename}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Tipo de Arquivo</dt>
                      <dd className="mt-1 text-sm">{file.mimetype}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Tamanho</dt>
                      <dd className="mt-1 text-sm">{formatFileSize(file.size)}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Enviado em</dt>
                      <dd className="mt-1 text-sm">{formatDateTime(file.createdAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Última Modificação</dt>
                      <dd className="mt-1 text-sm">{formatDateTime(file.updatedAt)}</dd>
                    </div>
                    {file.thumbnailUrl && (
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Miniatura</dt>
                        <dd className="mt-1 text-sm">Disponível</dd>
                      </div>
                    )}
                  </dl>
                </CardContent>
              </Card>

              {/* File Associations */}
              <Card>
                <CardHeader>
                  <CardTitle>Associações do Arquivo</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {file.tasksArtworks && file.tasksArtworks.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Tarefas (Artes)</h4>
                        <div className="flex flex-wrap gap-2">
                          {file.tasksArtworks.map((task: any) => (
                            <Badge key={task.id} variant="secondary">
                              📋 {task.name || `Tarefa ${task.id.slice(0, 8)}`}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {file.customerLogo && file.customerLogo.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Clientes (Logotipos)</h4>
                        <div className="flex flex-wrap gap-2">
                          {file.customerLogo.map((customer: any) => (
                            <Badge key={customer.id} variant="secondary">
                              🏢 {customer.fantasyName || customer.name || `Cliente ${customer.id.slice(0, 8)}`}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {file.supplierLogo && file.supplierLogo.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Fornecedores (Logotipos)</h4>
                        <div className="flex flex-wrap gap-2">
                          {file.supplierLogo.map((supplier: any) => (
                            <Badge key={supplier.id} variant="secondary">
                              🏭 {supplier.fantasyName || supplier.name || `Fornecedor ${supplier.id.slice(0, 8)}`}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {file.orderBudgets && file.orderBudgets.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Pedidos (Orçamentos)</h4>
                        <div className="flex flex-wrap gap-2">
                          {file.orderBudgets.map((order: any) => (
                            <Badge key={order.id} variant="secondary">
                              📄 Pedido {order.id.slice(0, 8)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {file.warning && file.warning.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Avisos</h4>
                        <div className="flex flex-wrap gap-2">
                          {file.warning.map((warning: any) => (
                            <Badge key={warning.id} variant="destructive">
                              ⚠️ {warning.reason || `Aviso ${warning.id.slice(0, 8)}`}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {file.observations && file.observations.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Observações</h4>
                        <div className="flex flex-wrap gap-2">
                          {file.observations.map((obs: any) => (
                            <Badge key={obs.id} variant="outline">
                              📝 {obs.description?.slice(0, 30) || `Observação ${obs.id.slice(0, 8)}`}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Check if file has no associations */}
                    {!file.tasksArtworks?.length &&
                     !file.customerLogo?.length &&
                     !file.supplierLogo?.length &&
                     !file.orderBudgets?.length &&
                     !file.warning?.length &&
                     !file.observations?.length && (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">Este arquivo não está associado a nenhuma entidade.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Changelog History */}
              <ChangelogHistory
                entityType={CHANGE_LOG_ENTITY_TYPE.FILE}
                entityId={file.id}
                entityName={file.filename}
                entityCreatedAt={file.createdAt}
              />
            </div>

            {/* File Preview */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Visualização</CardTitle>
                </CardHeader>
                <CardContent>
                  {file.mimetype.startsWith("image/") ? (
                    <img
                      src={file.url}
                      alt={file.filename}
                      className="w-full h-auto rounded-lg"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-64 bg-muted rounded-lg">
                      <div className="text-center">
                        <IconFileText className="w-16 h-16 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">
                          Visualização não disponível para este tipo de arquivo
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
