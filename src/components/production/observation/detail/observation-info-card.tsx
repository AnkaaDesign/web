import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileItem } from "@/components/common/file/file-item";
import { useFileViewer } from "@/components/common/file/file-viewer";
import { IconAlertCircle, IconCalendar, IconUser, IconTruck, IconFileText, IconBuildingFactory, IconCircleCheck } from "@tabler/icons-react";
import { type Observation } from "../../../../types";
import { formatDate, formatRelativeTime } from "../../../../utils";
import { TASK_STATUS_LABELS, COMMISSION_STATUS_LABELS } from "../../../../constants";
import { cn } from "@/lib/utils";

interface ObservationInfoCardProps {
  observation: Observation & {
    task?: {
      id: string;
      name: string;
      status: string;
      statusOrder: number;
      customer?: {
        id: string;
        fantasyName: string;
        corporateName: string | null;
      };
      sector?: {
        id: string;
        name: string;
      };
    };
    files?: {
      id: string;
      filename: string;
      originalName: string;
      fileUrl: string;
      thumbnailUrl?: string;
      size: number;
      mimeType: string;
    }[];
    commissions?: {
      id: string;
      status: string;
      reason?: string;
      user?: {
        id: string;
        name: string;
      };
    }[];
  };
  className?: string;
}

export function ObservationInfoCard({ observation, className }: ObservationInfoCardProps) {
  const fileViewer = useFileViewer();

  const getTaskStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "PENDING":
        return "secondary";
      case "IN_PRODUCTION":
        return "default";
      case "ON_HOLD":
        return "warning";
      case "COMPLETED":
        return "success";
      case "CANCELLED":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getCommissionStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "PENDING":
        return "secondary";
      case "APPROVED":
        return "success";
      case "PAID":
        return "success";
      case "SUSPENDED_COMMISSION":
        return "destructive";
      case "NO_COMMISSION":
        return "secondary";
      default:
        return "secondary";
    }
  };

  const hasFiles = observation.files && observation.files.length > 0;

  // If no files, render single column layout
  if (!hasFiles) {
    return (
      <div className={cn("space-y-6", className)}>
        {/* Basic Information Card - Full Width */}
        <Card className="shadow-sm border border-border">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/20">
                <IconAlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              Detalhes da Observação
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-0">
            <div className="space-y-6">
              {/* Description */}
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-3">Descrição</h3>
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm text-foreground whitespace-pre-wrap">{observation.description}</p>
                </div>
              </div>

              {/* Task Information */}
              {observation.task && (
                <div className="pt-4 border-t border-border/50">
                  <h4 className="text-sm font-semibold mb-3 text-foreground">Tarefa Relacionada</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                      <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <IconTruck className="h-4 w-4" />
                        Nome da Tarefa
                      </span>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-foreground">{observation.task.name}</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                      <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <IconCircleCheck className="h-4 w-4" />
                        Status
                      </span>
                      <Badge variant={getTaskStatusBadgeVariant(observation.task.status)}>{TASK_STATUS_LABELS[observation.task.status] || observation.task.status}</Badge>
                    </div>

                    {observation.task.customer && (
                      <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                        <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <IconUser className="h-4 w-4" />
                          Cliente
                        </span>
                        <span className="text-sm font-semibold text-foreground">{observation.task.customer.fantasyName || observation.task.customer.corporateName}</span>
                      </div>
                    )}

                    {observation.task.sector && (
                      <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                        <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <IconBuildingFactory className="h-4 w-4" />
                          Setor
                        </span>
                        <span className="text-sm font-semibold text-foreground">{observation.task.sector.name}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Commission Status */}
              {observation.commissions && observation.commissions.length > 0 && (
                <div className="pt-4 border-t border-border/50">
                  <h4 className="text-sm font-semibold mb-3 text-foreground">Comissões Afetadas</h4>
                  <div className="space-y-3">
                    {observation.commissions.map((commission) => (
                      <div key={commission.id} className="bg-muted/50 rounded-lg px-4 py-3">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-muted-foreground">{commission.user?.name || "Usuário"}</span>
                          <Badge variant={getCommissionStatusBadgeVariant(commission.status)}>
                            {COMMISSION_STATUS_LABELS[commission.status as keyof typeof COMMISSION_STATUS_LABELS] || commission.status}
                          </Badge>
                        </div>
                        {commission.reason && <p className="text-xs text-muted-foreground mt-2">{commission.reason}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Date Information */}
              <div className="pt-4 border-t border-border/50">
                <h4 className="text-sm font-semibold mb-3 text-foreground">Datas do Sistema</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconCalendar className="h-4 w-4" />
                      Criada em
                    </span>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-foreground">{formatDate(new Date(observation.createdAt))}</span>
                      <div className="text-xs text-muted-foreground">{formatRelativeTime(new Date(observation.createdAt))}</div>
                    </div>
                  </div>

                  {observation.updatedAt !== observation.createdAt && (
                    <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                      <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <IconCalendar className="h-4 w-4" />
                        Atualizada em
                      </span>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-foreground">{formatDate(new Date(observation.updatedAt))}</span>
                        <div className="text-xs text-muted-foreground">{formatRelativeTime(new Date(observation.updatedAt))}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Two column layout when files exist (1/3 - 2/3 split)
  return (
    <div className={cn("grid grid-cols-1 lg:grid-cols-3 gap-6", className)}>
      {/* Basic Information Card - Takes 1/3 width */}
      <Card className="shadow-sm border border-border lg:col-span-1">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/20">
              <IconAlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            Detalhes da Observação
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="space-y-6">
            {/* Description */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-3">Descrição</h3>
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm text-foreground whitespace-pre-wrap">{observation.description}</p>
              </div>
            </div>

            {/* Task Information */}
            {observation.task && (
              <div className="pt-4 border-t border-border/50">
                <h4 className="text-sm font-semibold mb-3 text-foreground">Tarefa Relacionada</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconTruck className="h-4 w-4" />
                      Nome da Tarefa
                    </span>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-foreground">{observation.task.name}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconCircleCheck className="h-4 w-4" />
                      Status
                    </span>
                    <Badge variant={getTaskStatusBadgeVariant(observation.task.status)}>{TASK_STATUS_LABELS[observation.task.status] || observation.task.status}</Badge>
                  </div>

                  {observation.task.customer && (
                    <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                      <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <IconUser className="h-4 w-4" />
                        Cliente
                      </span>
                      <span className="text-sm font-semibold text-foreground">{observation.task.customer.fantasyName || observation.task.customer.corporateName}</span>
                    </div>
                  )}

                  {observation.task.sector && (
                    <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                      <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <IconBuildingFactory className="h-4 w-4" />
                        Setor
                      </span>
                      <span className="text-sm font-semibold text-foreground">{observation.task.sector.name}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Commission Status */}
            {observation.commissions && observation.commissions.length > 0 && (
              <div className="pt-4 border-t border-border/50">
                <h4 className="text-sm font-semibold mb-3 text-foreground">Comissões Afetadas</h4>
                <div className="space-y-3">
                  {observation.commissions.map((commission) => (
                    <div key={commission.id} className="bg-muted/50 rounded-lg px-4 py-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-muted-foreground">{commission.user?.name || "Usuário"}</span>
                        <Badge variant={getCommissionStatusBadgeVariant(commission.status)}>
                          {COMMISSION_STATUS_LABELS[commission.status as keyof typeof COMMISSION_STATUS_LABELS] || commission.status}
                        </Badge>
                      </div>
                      {commission.reason && <p className="text-xs text-muted-foreground mt-2">{commission.reason}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Date Information */}
            <div className="pt-4 border-t border-border/50">
              <h4 className="text-sm font-semibold mb-3 text-foreground">Datas do Sistema</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconCalendar className="h-4 w-4" />
                    Criada em
                  </span>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-foreground">{formatDate(new Date(observation.createdAt))}</span>
                    <div className="text-xs text-muted-foreground">{formatRelativeTime(new Date(observation.createdAt))}</div>
                  </div>
                </div>

                {observation.updatedAt !== observation.createdAt && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconCalendar className="h-4 w-4" />
                      Atualizada em
                    </span>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-foreground">{formatDate(new Date(observation.updatedAt))}</span>
                      <div className="text-xs text-muted-foreground">{formatRelativeTime(new Date(observation.updatedAt))}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Files Card - Takes 2/3 width */}
      <Card className="shadow-sm border border-border lg:col-span-2">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
              <IconFileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            Arquivos Anexados
            <Badge variant="secondary" className="ml-auto">
              {observation.files?.length ?? 0} arquivo{(observation.files?.length ?? 0) > 1 ? "s" : ""}
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-3">
            {observation.files?.map((file, index) => (
              <FileItem
                key={file.id}
                file={file}
                viewMode="grid"
                onPreview={() => {
                  // Open image modal with all files for gallery navigation
                  fileViewer.actions.openImageModal(observation.files || [], index);
                }}
                onDelete={() => {
                  // File deletion would require a separate action
                  // This is usually handled at the parent component level
                }}
                showActions={false}
                showFilename={false}
                showFileSize={false}
                showRelativeTime={false}
                className="bg-muted/30"
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
