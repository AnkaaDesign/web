import type * as React from "react";
import { IconCameraBolt, IconCameraCheck, IconDownload, IconNote } from "@tabler/icons-react";
import { useFileViewer } from "@/components/common/file";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { SERVICE_ORDER_TYPE } from "@/constants";
import { exportDossiePdf } from "@/utils/dossie-pdf-generator";
import { getApiBaseUrl } from "@/utils/file";
import type { Task } from "@/types";

type DossieServiceOrder = NonNullable<Task["serviceOrders"]>[number];
type DossieFile = NonNullable<DossieServiceOrder["checkinFiles"]>[number];

/** Mirrors the legacy detail-page `getTaskDisplayName` so the PDF header matches. */
function getTaskDisplayName(task: Task): string {
  if (task.name) return task.name;
  if (task.customer?.corporateName) return task.customer.corporateName;
  if (task.serialNumber) return `Série ${task.serialNumber}`;
  if (task.truck?.plate) return task.truck.plate;
  return "Sem nome";
}

/** Resolves a file's thumbnail URL exactly as the legacy card did. */
function thumbnailSrc(file: DossieFile, apiUrl: string): string {
  if (file.thumbnailUrl) {
    return file.thumbnailUrl.startsWith("/api") ? `${apiUrl}${file.thumbnailUrl}` : file.thumbnailUrl;
  }
  return `${apiUrl}/files/thumbnail/${file.id}`;
}

/** A single Check-in / Check-out photo group: label + count + 64×64 thumbnail buttons. */
function DossiePhotoGroup({
  label,
  icon,
  files,
  apiUrl,
  onFileClick,
}: {
  label: string;
  icon: React.ReactNode;
  files: DossieFile[];
  apiUrl: string;
  onFileClick: (file: DossieFile) => void;
}): React.ReactNode {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-xs font-medium">{label}</span>
        <span className="text-[11px] text-muted-foreground">{files.length}</span>
      </div>
      {files.length > 0 ? (
        <div className="flex gap-1.5 flex-wrap">
          {files.map((file) => (
            <button
              key={file.id}
              onClick={() => onFileClick(file)}
              className="relative flex-shrink-0 w-16 h-16 rounded overflow-hidden border border-border/30 bg-muted hover:opacity-80 transition-opacity cursor-pointer"
            >
              <img src={thumbnailSrc(file, apiUrl)} alt={file.originalName || file.filename} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground italic">Nenhuma foto</p>
      )}
    </div>
  );
}

/**
 * Dossiê — proof of services organized by PRODUCTION service order with check-in/check-out photos.
 * Bare section body (the DetailPage host renders the Card + "Dossiê" title). Returns null when empty.
 */
export function DossieSection({ task }: { task: Task }): React.ReactNode {
  const fileViewer = useFileViewer();

  const serviceOrdersWithFiles = (task.serviceOrders || [])
    .filter((so) => so.type === SERVICE_ORDER_TYPE.PRODUCTION && ((so.checkinFiles?.length ?? 0) > 0 || (so.checkoutFiles?.length ?? 0) > 0))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  if (serviceOrdersWithFiles.length === 0) return null;

  const totalDossieFiles = serviceOrdersWithFiles.reduce((sum, so) => sum + (so.checkinFiles?.length || 0) + (so.checkoutFiles?.length || 0), 0);

  // Opens the viewer over EVERY dossiê file, ordered SO1 check-in, SO1 check-out, SO2 check-in, ... (legacy handleDossieFileClick).
  const handleDossieFileClick = (file: DossieFile) => {
    const allFiles: DossieFile[] = [];
    for (const so of serviceOrdersWithFiles) {
      const checkin = so.checkinFiles || [];
      const checkout = so.checkoutFiles || [];
      const maxLen = Math.max(checkin.length, checkout.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < checkin.length) allFiles.push(checkin[i]);
        if (i < checkout.length) allFiles.push(checkout[i]);
      }
    }
    const index = allFiles.findIndex((f) => f.id === file.id);
    fileViewer.actions.viewFiles(allFiles, index >= 0 ? index : 0);
  };

  const apiUrl = getApiBaseUrl();

  return (
    <div className="space-y-3">
      {/* Toolbar: total photo count + PDF export */}
      <div className="flex items-center justify-between">
        {/* Number-only count badge, consistent with the Layouts / Arquivos sections. */}
        <Badge variant="secondary">{totalDossieFiles}</Badge>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1"
          onClick={() => {
            exportDossiePdf({
              taskDisplayName: getTaskDisplayName(task),
              customerName: task.customer?.corporateName || task.customer?.fantasyName || undefined,
              serialNumber: task.serialNumber,
              plate: task.truck?.plate,
              serviceOrders: serviceOrdersWithFiles.map((so) => ({
                id: so.id,
                description: so.description,
                observation: so.observation,
                position: so.position,
                checkinFiles: so.checkinFiles || [],
                checkoutFiles: so.checkoutFiles || [],
              })),
            }).catch((err) => {
              console.error("[Dossiê PDF] Error:", err);
            });
          }}
        >
          <IconDownload className="h-3.5 w-3.5" />
          PDF
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Registro fotográfico dos serviços por ordem de serviço</p>

      <div className="grid grid-cols-2 gap-4">
        {serviceOrdersWithFiles.map((serviceOrder) => {
          const isOutrosWithObservation = serviceOrder.description === "Outros" && !!serviceOrder.observation;
          const displayDescription = isOutrosWithObservation ? serviceOrder.observation : serviceOrder.description;
          const checkinFiles = serviceOrder.checkinFiles || [];
          const checkoutFiles = serviceOrder.checkoutFiles || [];

          return (
            <div key={serviceOrder.id} className="border border-border/30 rounded-lg overflow-hidden">
              {/* Service Order Header */}
              <div className="bg-muted/30 px-3 py-2 flex items-center gap-2 border-b border-border/30">
                <h4 className="text-xs font-semibold truncate">{displayDescription}</h4>
                {!isOutrosWithObservation && serviceOrder.observation && (
                  <HoverCard openDelay={100} closeDelay={100}>
                    <HoverCardTrigger asChild>
                      <button className="relative flex items-center justify-center h-4 w-4 rounded border border-border/40 bg-background hover:bg-accent transition-colors flex-shrink-0">
                        <IconNote className="h-2.5 w-2.5" />
                      </button>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-64 p-3" side="top">
                      <p className="text-sm text-muted-foreground">{serviceOrder.observation}</p>
                    </HoverCardContent>
                  </HoverCard>
                )}
              </div>

              {/* Check-in / Check-out photos */}
              <div className="px-3 py-3 space-y-5">
                <DossiePhotoGroup
                  label="Check-in"
                  icon={<IconCameraCheck className="h-4 w-4 text-blue-500" />}
                  files={checkinFiles}
                  apiUrl={apiUrl}
                  onFileClick={handleDossieFileClick}
                />
                <DossiePhotoGroup
                  label="Check-out"
                  icon={<IconCameraBolt className="h-4 w-4 text-green-500" />}
                  files={checkoutFiles}
                  apiUrl={apiUrl}
                  onFileClick={handleDossieFileClick}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
