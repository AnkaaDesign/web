import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FileItem } from "@/components/file";
import {
  IconBrush,
  IconCalendar,
  IconUser,
  IconFileText,
  IconCurrency,
  IconPhoto,
  IconReceipt,
  IconFileInvoice,
  IconClipboardList,
  IconBuildingFactory,
  IconClock,
} from "@tabler/icons-react";
import { type Airbrushing } from "../../../../types";
import { formatDate, formatDateTime } from "../../../../utils";
import { TASK_STATUS_LABELS, AIRBRUSHING_STATUS_LABELS, ENTITY_BADGE_CONFIG } from "../../../../constants";
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
  const getAirbrushingStatusBadgeVariant = (status: string) => {
    return (ENTITY_BADGE_CONFIG.AIRBRUSHING[status] || "default") as any;
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Main Information Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Info Card */}
        <Card className="border-2 shadow-lg animate-in fade-in-50 duration-700">
          <CardHeader className="pb-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-2xl font-bold flex items-center gap-2">
                  <IconBrush className="h-6 w-6 text-primary" />
                  Informações Básicas
                </CardTitle>
                <CardDescription>Detalhes da aerografia</CardDescription>
              </div>
              <Badge variant={getAirbrushingStatusBadgeVariant(airbrushing.status)} className="text-sm px-3 py-1">
                {AIRBRUSHING_STATUS_LABELS[airbrushing.status] || airbrushing.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Price */}
              {airbrushing.price && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <IconCurrency className="h-4 w-4" />
                    <span>Preço</span>
                  </div>
                  <p className="font-semibold text-lg">
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(airbrushing.price)}
                  </p>
                </div>
              )}

              {/* Start Date */}
              {airbrushing.startDate && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <IconClock className="h-4 w-4" />
                    <span>Data de Início</span>
                  </div>
                  <p className="font-semibold">{formatDateTime(airbrushing.startDate)}</p>
                </div>
              )}

              {/* Finish Date */}
              {airbrushing.finishDate && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <IconCalendar className="h-4 w-4" />
                    <span>Data de Término</span>
                  </div>
                  <p className="font-semibold">{formatDateTime(airbrushing.finishDate)}</p>
                </div>
              )}

              <Separator />

              {/* Created At */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <IconCalendar className="h-4 w-4" />
                  <span>Criada em</span>
                </div>
                <p className="font-semibold">{formatDateTime(airbrushing.createdAt)}</p>
              </div>

              {/* Updated At */}
              {airbrushing.updatedAt !== airbrushing.createdAt && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <IconCalendar className="h-4 w-4" />
                    <span>Atualizada em</span>
                  </div>
                  <p className="font-semibold">{formatDateTime(airbrushing.updatedAt)}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Task Information Card */}
        <Card className="border-2 shadow-lg animate-in fade-in-50 duration-800">
          <CardHeader className="pb-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-bold flex items-center gap-2">
                  <IconClipboardList className="h-6 w-6 text-primary" />
                  Informações da Tarefa
                </CardTitle>
                <CardDescription>Detalhes da tarefa relacionada</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {airbrushing.task ? (
              <>
                {/* Task Details */}
                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Nome da Tarefa</p>
                    <p className="font-semibold text-lg">{airbrushing.task.name}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Status da Tarefa</p>
                    <Badge variant="secondary">
                      {TASK_STATUS_LABELS[airbrushing.task.status] || airbrushing.task.status}
                    </Badge>
                  </div>

                  {airbrushing.task.customer && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <IconUser className="h-3 w-3" />
                        Cliente
                      </p>
                      <p className="font-semibold">{airbrushing.task.customer.fantasyName}</p>
                    </div>
                  )}

                  {airbrushing.task.sector && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <IconBuildingFactory className="h-3 w-3" />
                        Setor
                      </p>
                      <p className="font-semibold">{airbrushing.task.sector.name}</p>
                    </div>
                  )}

                  {airbrushing.task.price && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Preço da Tarefa</p>
                      <p className="font-semibold">
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(airbrushing.task.price)}
                      </p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <IconClipboardList className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhuma tarefa associada</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Documents and Artworks Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Documents Card - Receipts and Invoices */}
        {((airbrushing.receipts && airbrushing.receipts.length > 0) || (airbrushing.invoices && airbrushing.invoices.length > 0)) && (
          <Card className="border shadow-md animate-in fade-in-50 duration-900">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <IconFileText className="h-5 w-5 text-primary" />
                Documentos
                <Badge variant="secondary" className="ml-2">
                  {(airbrushing.receipts?.length || 0) + (airbrushing.invoices?.length || 0)}
                </Badge>
              </CardTitle>
              <CardDescription>Recibos e notas fiscais</CardDescription>
            </CardHeader>

            <CardContent>
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
          <Card className="border shadow-md animate-in fade-in-50 duration-900">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <IconPhoto className="h-5 w-5 text-primary" />
                Artes da Aerografia
                <Badge variant="secondary" className="ml-2">
                  {airbrushing.artworks.length}
                </Badge>
              </CardTitle>
              <CardDescription>Arquivos de arte</CardDescription>
            </CardHeader>

            <CardContent>
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
