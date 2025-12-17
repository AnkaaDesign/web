import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileItem } from "@/components/common/file";
import {
  IconBrush,
  IconCalendar,
  IconCalendarEvent,
  IconFileText,
  IconCurrencyReal,
  IconPhoto,
  IconReceipt,
  IconFileInvoice,
  IconClipboardList,
  IconBuildingFactory,
  IconBuilding,
  IconHash,
} from "@tabler/icons-react";
import { type Airbrushing } from "../../../../types";
import { formatDate, formatDateTime, formatCurrency } from "../../../../utils";
import { TASK_STATUS_LABELS, AIRBRUSHING_STATUS_LABELS, ENTITY_BADGE_CONFIG } from "../../../../constants";
import { cn } from "@/lib/utils";
import { CustomerLogoDisplay } from "@/components/ui/avatar-display";

interface AirbrushingInfoCardProps {
  airbrushing: Airbrushing & {
    task?: {
      id: string;
      name: string;
      serialNumber?: string;
      status: string;
      statusOrder: number;
      customer?: {
        id: string;
        fantasyName: string;
        logo?: {
          id: string;
          filename: string;
          originalName: string;
          fileUrl: string;
          thumbnailUrl?: string;
          size: number;
          mimetype: string;
        };
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
  const getAirbrushingStatusBadgeVariant = (status: string) => {
    return (ENTITY_BADGE_CONFIG.AIRBRUSHING[status] || "default") as any;
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Basic Info Card */}
        <Card className="border flex flex-col animate-in fade-in-50 duration-700" level={1}>
          <CardHeader className="pb-6">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <IconBrush className="h-5 w-5 text-muted-foreground" />
                Informações da Aerografia
              </CardTitle>
              <Badge variant={getAirbrushingStatusBadgeVariant(airbrushing.status)}>
                {AIRBRUSHING_STATUS_LABELS[airbrushing.status] || airbrushing.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0 flex-1">
            <div className="space-y-4">
              {/* Price */}
              {airbrushing.price && (
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconCurrencyReal className="h-4 w-4" />
                    Preço
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {formatCurrency(airbrushing.price)}
                  </span>
                </div>
              )}

              {/* Start Date */}
              {airbrushing.startDate && (
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconCalendar className="h-4 w-4" />
                    Data de Início
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {formatDate(airbrushing.startDate)}
                  </span>
                </div>
              )}

              {/* Finish Date */}
              {airbrushing.finishDate && (
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconCalendarEvent className="h-4 w-4" />
                    Data de Finalização
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {formatDate(airbrushing.finishDate)}
                  </span>
                </div>
              )}

              {/* Created At */}
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <IconCalendar className="h-4 w-4" />
                  Criado em
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {formatDateTime(airbrushing.createdAt)}
                </span>
              </div>

              {/* Updated At */}
              {airbrushing.updatedAt && airbrushing.updatedAt !== airbrushing.createdAt && (
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconCalendar className="h-4 w-4" />
                    Atualizado em
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {formatDateTime(airbrushing.updatedAt)}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Task Information Card */}
        <Card className="border flex flex-col animate-in fade-in-50 duration-800" level={1}>
          <CardHeader className="pb-6">
            <CardTitle className="flex items-center gap-2">
              <IconClipboardList className="h-5 w-5 text-muted-foreground" />
              Tarefa Relacionada
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 flex-1">
            {airbrushing.task ? (
              <div className="space-y-4">
                {/* Task Name */}
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <IconClipboardList className="h-4 w-4" />
                    Nome da Tarefa
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {airbrushing.task.name}
                  </span>
                </div>

                {/* Serial Number */}
                {airbrushing.task.serialNumber && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconHash className="h-4 w-4" />
                      Número de Série
                    </span>
                    <span className="text-sm font-semibold text-foreground font-mono">
                      {airbrushing.task.serialNumber}
                    </span>
                  </div>
                )}

                {/* Sector */}
                {airbrushing.task.sector && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconBuildingFactory className="h-4 w-4" />
                      Setor
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {airbrushing.task.sector.name}
                    </span>
                  </div>
                )}

                {/* Customer */}
                {airbrushing.task.customer && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-1.5">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <IconBuilding className="h-4 w-4" />
                      Cliente
                    </span>
                    <div className="flex items-center gap-2">
                      <CustomerLogoDisplay
                        logo={airbrushing.task.customer.logo}
                        customerName={airbrushing.task.customer.fantasyName}
                        size="sm"
                        shape="rounded"
                        className="flex-shrink-0"
                      />
                      <span className="text-sm font-semibold text-foreground text-right">
                        {airbrushing.task.customer.fantasyName}
                      </span>
                    </div>
                  </div>
                )}

                {/* Task Status */}
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                  <span className="text-sm font-medium text-muted-foreground">
                    Status da Tarefa
                  </span>
                  <Badge variant={ENTITY_BADGE_CONFIG.TASK[airbrushing.task.status] || "default"}>
                    {TASK_STATUS_LABELS[airbrushing.task.status] || airbrushing.task.status}
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <div className="text-center">
                  <IconClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma tarefa associada</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Documents and Artworks Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Documents Card - Receipts and Invoices */}
        {((airbrushing.receipts && airbrushing.receipts.length > 0) || (airbrushing.invoices && airbrushing.invoices.length > 0)) && (
          <Card className="border flex flex-col animate-in fade-in-50 duration-900" level={1}>
            <CardHeader className="pb-6">
              <CardTitle className="flex items-center gap-2">
                <IconFileText className="h-5 w-5 text-muted-foreground" />
                Documentos
                <Badge variant="secondary" className="ml-2">
                  {(airbrushing.receipts?.length || 0) + (airbrushing.invoices?.length || 0)}
                </Badge>
              </CardTitle>
            </CardHeader>

            <CardContent className="pt-0 flex-1">
              <div className="space-y-6">
                {airbrushing.receipts && airbrushing.receipts.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <IconReceipt className="h-4 w-4 text-muted-foreground" />
                      <h4 className="text-sm font-semibold">Recibos</h4>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {airbrushing.receipts.map((file) => (
                        <FileItem
                          key={file.id}
                          file={file}
                          viewMode="list"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {airbrushing.invoices && airbrushing.invoices.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <IconFileInvoice className="h-4 w-4 text-muted-foreground" />
                      <h4 className="text-sm font-semibold">Notas Fiscais</h4>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {airbrushing.invoices.map((file) => (
                        <FileItem
                          key={file.id}
                          file={file}
                          viewMode="list"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Artworks Card */}
        {airbrushing.artworks && airbrushing.artworks.length > 0 && (
          <Card className="border flex flex-col animate-in fade-in-50 duration-900" level={1}>
            <CardHeader className="pb-6">
              <CardTitle className="flex items-center gap-2">
                <IconPhoto className="h-5 w-5 text-muted-foreground" />
                Artes da Aerografia
                <Badge variant="secondary" className="ml-2">
                  {airbrushing.artworks.length}
                </Badge>
              </CardTitle>
            </CardHeader>

            <CardContent className="pt-0 flex-1">
              <div className="flex flex-wrap gap-3">
                {airbrushing.artworks.map((file) => (
                  <FileItem
                    key={file.id}
                    file={file}
                    viewMode="grid"
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
