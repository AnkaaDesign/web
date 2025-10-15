import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileItem } from "@/components/file";
import { IconBrush, IconCalendar, IconUser, IconTruck, IconFileText, IconCurrency, IconPhoto } from "@tabler/icons-react";
import { type Airbrushing } from "../../../../types";
import { formatDate, formatRelativeTime } from "../../../../utils";
import { TASK_STATUS_LABELS, AIRBRUSHING_STATUS_LABELS } from "../../../../constants";
import { cn } from "@/lib/utils";

interface AirbrushingInfoCardProps {
  airbrushing: Airbrushing & {
    task?: {
      id: string;
      name: string;
      status: string;
      statusOrder: number;
      customer?: {
        id: string;
        fantasyName: string;
      };
      sector?: {
        id: string;
        name: string;
      };
      price?: number | null;
    };
    receipts?: {
      id: string;
      filename: string;
      originalName: string;
      fileUrl: string;
      thumbnailUrl?: string;
      size: number;
      mimetype: string;
    }[];
    invoices?: {
      id: string;
      filename: string;
      originalName: string;
      fileUrl: string;
      thumbnailUrl?: string;
      size: number;
      mimetype: string;
    }[];
    artworks?: {
      id: string;
      filename: string;
      originalName: string;
      fileUrl: string;
      thumbnailUrl?: string;
      size: number;
      mimetype: string;
    }[];
  };
  className?: string;
}

export function AirbrushingInfoCard({ airbrushing, className }: AirbrushingInfoCardProps) {
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

  const getAirbrushingStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "PENDING":
        return "secondary";
      case "IN_PRODUCTION":
        return "default";
      case "COMPLETED":
        return "success";
      case "CANCELLED":
        return "destructive";
      default:
        return "secondary";
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Basic Information Card */}
      <Card className="shadow-sm border border-border">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/20">
              <IconBrush className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            Detalhes da Aerografia
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="space-y-6">
            {/* Airbrushing Information */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-3">Informações da Aerografia</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground">Status</span>
                  <Badge variant={getAirbrushingStatusBadgeVariant(airbrushing.status)}>{AIRBRUSHING_STATUS_LABELS[airbrushing.status] || airbrushing.status}</Badge>
                </div>

                {airbrushing.startDate && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconCalendar className="h-4 w-4" />
                      Data de Início
                    </span>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-foreground">{formatDate(new Date(airbrushing.startDate))}</span>
                      <div className="text-xs text-muted-foreground">{formatRelativeTime(new Date(airbrushing.startDate))}</div>
                    </div>
                  </div>
                )}

                {airbrushing.finishDate && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconCalendar className="h-4 w-4" />
                      Data de Término
                    </span>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-foreground">{formatDate(new Date(airbrushing.finishDate))}</span>
                      <div className="text-xs text-muted-foreground">{formatRelativeTime(new Date(airbrushing.finishDate))}</div>
                    </div>
                  </div>
                )}

                {airbrushing.price && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconCurrency className="h-4 w-4" />
                      Preço
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(airbrushing.price)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Task Information */}
            {airbrushing.task && (
              <div className="pt-4 border-t border-border/50">
                <h4 className="text-sm font-semibold mb-3 text-foreground">Tarefa Relacionada</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconTruck className="h-4 w-4" />
                      Nome da Tarefa
                    </span>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-foreground">{airbrushing.task.name}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium text-muted-foreground">Status da Tarefa</span>
                    <Badge variant={getTaskStatusBadgeVariant(airbrushing.task.status)}>{TASK_STATUS_LABELS[airbrushing.task.status] || airbrushing.task.status}</Badge>
                  </div>

                  {airbrushing.task.customer && (
                    <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                      <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <IconUser className="h-4 w-4" />
                        Cliente
                      </span>
                      <span className="text-sm font-semibold text-foreground">{airbrushing.task.customer.fantasyName}</span>
                    </div>
                  )}

                  {airbrushing.task.sector && (
                    <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                      <span className="text-sm font-medium text-muted-foreground">Setor</span>
                      <span className="text-sm font-semibold text-foreground">{airbrushing.task.sector.name}</span>
                    </div>
                  )}

                  {airbrushing.task.price && (
                    <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                      <span className="text-sm font-medium text-muted-foreground">Preço da Tarefa</span>
                      <span className="text-sm font-semibold text-foreground">
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(airbrushing.task.price)}
                      </span>
                    </div>
                  )}
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
                    <span className="text-sm font-semibold text-foreground">{formatDate(new Date(airbrushing.createdAt))}</span>
                    <div className="text-xs text-muted-foreground">{formatRelativeTime(new Date(airbrushing.createdAt))}</div>
                  </div>
                </div>

                {airbrushing.updatedAt !== airbrushing.createdAt && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconCalendar className="h-4 w-4" />
                      Atualizada em
                    </span>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-foreground">{formatDate(new Date(airbrushing.updatedAt))}</span>
                      <div className="text-xs text-muted-foreground">{formatRelativeTime(new Date(airbrushing.updatedAt))}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Receipts Card */}
      {airbrushing.receipts && airbrushing.receipts.length > 0 && (
        <Card className="shadow-sm border border-border">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/20">
                <IconFileText className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              Recibos Anexados
              <Badge variant="secondary" className="ml-auto">
                {airbrushing.receipts.length} arquivo{airbrushing.receipts.length > 1 ? "s" : ""}
              </Badge>
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-0">
            <div className="grid grid-cols-1 gap-4">
              {airbrushing.receipts.map((file) => (
                <FileItem key={file.id} file={file} showActions={false} className="bg-muted/30" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* NFEs Card */}
      {airbrushing.invoices && airbrushing.invoices.length > 0 && (
        <Card className="shadow-sm border border-border">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                <IconFileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              Notas Fiscais Anexadas
              <Badge variant="secondary" className="ml-auto">
                {airbrushing.invoices.length} arquivo{airbrushing.invoices.length > 1 ? "s" : ""}
              </Badge>
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-0">
            <div className="grid grid-cols-1 gap-4">
              {airbrushing.invoices.map((file) => (
                <FileItem key={file.id} file={file} showActions={false} className="bg-muted/30" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Artworks Card */}
      {airbrushing.artworks && airbrushing.artworks.length > 0 && (
        <Card className="shadow-sm border border-border">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/20">
                <IconPhoto className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              Artes da Aerografia
              <Badge variant="secondary" className="ml-auto">
                {airbrushing.artworks.length} arquivo{airbrushing.artworks.length > 1 ? "s" : ""}
              </Badge>
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {airbrushing.artworks.map((file) => (
                <FileItem key={file.id} file={file} showActions={false} className="bg-muted/30" showThumbnail={true} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
