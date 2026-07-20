import React, { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { IconBrush, IconCalendar, IconCalendarEvent, IconUser } from "@tabler/icons-react";

import { FileItem, useFileViewer, type FileViewMode } from "@/components/common/file";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDate } from "@/utils/date";
import { getApiBaseUrl } from "@/utils/file";
import { routes, ENTITY_BADGE_CONFIG, AIRBRUSHING_STATUS_LABELS } from "@/constants";
import type { Airbrushing, File } from "@/types";

/**
 * An airbrushing's artwork records may be bare File rows or Layout wrappers carrying a
 * nested `file` relation (mirrors the Layouts section) — normalise to the backing File.
 */
type LayoutLike = File & { file?: File | null };

/**
 * The backing File objects for an airbrushing's layouts. A layout row is a Layout WRAPPER
 * whose own `id` is NOT a File id — the real File is the nested `file` relation, or, when
 * that relation isn't included, the `fileId` scalar (always present). We must never fall back
 * to the Layout's own id: `/files/<layoutId>/download` 404s ("Arquivo não encontrado").
 */
export function getAirbrushingLayouts(airbrushing: Airbrushing): File[] {
  return ((airbrushing.layouts ?? []) as LayoutLike[])
    .map((art) => {
      const a = art as any;
      if (a?.file) return a.file as File;
      // No nested file included → synthesize a minimal File carrying the real File id so
      // downloads/thumbnails hit /files/<fileId>, never the Layout wrapper id.
      if (a?.fileId) return { ...a, id: a.fileId } as File;
      return art as File;
    })
    .filter((f): f is File => Boolean(f && typeof f === "object" && "id" in f));
}

/**
 * Every downloadable File across a task's airbrushings: layouts always, plus the financial
 * receipts/invoices only for a money-privileged viewer. Shared by the section body and the
 * page-composed header actions so the "Baixar Todos" affordance and its count stay in sync.
 */
export function getAirbrushingFiles(airbrushings: Airbrushing[], canViewFinancials: boolean): File[] {
  const files: File[] = [];
  for (const a of airbrushings) {
    files.push(...getAirbrushingLayouts(a));
    if (canViewFinancials) {
      files.push(...((a.receipts ?? []) as File[]).filter((f) => f && "id" in f));
      files.push(...((a.invoices ?? []) as File[]).filter((f) => f && "id" in f));
    }
  }
  return files;
}

/**
 * Fetch every airbrushing file and bundle the blobs into `${taskName}-aerografias.zip` via JSZip.
 * Exposed so the DetailPage host can wire it into the section's headerActions ("Baixar Todos"),
 * matching the Recortes / Dossiê sections. Financial files are only included for gated viewers.
 */
export async function downloadAllAirbrushingFiles(airbrushings: Airbrushing[], taskName: string | undefined, canViewFinancials: boolean): Promise<void> {
  const apiUrl = getApiBaseUrl();
  const zipFileName = `${taskName ?? "tarefa"}-aerografias.zip`;
  const files = getAirbrushingFiles(airbrushings, canViewFinancials);

  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  await Promise.all(
    files.map(async (file) => {
      try {
        const response = await fetch(`${apiUrl}/files/${file.id}/download`);
        const blob = await response.blob();
        zip.file(file.filename, blob);
      } catch (error) {
        console.error(`Error downloading file ${file.filename}:`, error);
      }
    }),
  );

  const content = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(content);
  const link = document.createElement("a");
  link.href = url;
  link.download = zipFileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Bare body for the "Aerografias" detail section (the DetailPage host supplies the outer Card +
 * title + header actions: count badge, "Baixar Todos", grid/list toggle). Each airbrushing renders
 * as a card carrying its painter, planned/actual dates and status, plus its layouts as shared
 * `FileItem`s (grid or list per `view`). Monetary state — price, payment status, receipt/invoice
 * files — is shown only to money-privileged viewers (`canViewFinancials`). Returns null when empty.
 */
export function AirbrushingsSection({
  airbrushings,
  canAccessDetails,
  view,
}: {
  airbrushings: Airbrushing[];
  // Kept for call-site compatibility; the task-detail card no longer shows any financial
  // info (price / payment status / receipts / invoices) — that lives on the airbrushing page.
  canViewFinancials?: boolean;
  canAccessDetails: boolean;
  view: FileViewMode;
}): React.ReactNode {
  const navigate = useNavigate();
  const fileViewer = useFileViewer();

  // Preview opens the whole artwork collection of THIS airbrushing at the clicked index.
  const handlePreview = useCallback(
    (files: File[]) => (file: File) => {
      const index = files.findIndex((f) => f.id === file.id);
      fileViewer.actions.viewFiles(files, index >= 0 ? index : 0);
    },
    [fileViewer],
  );

  const handleDownload = useCallback((file: File) => fileViewer.actions.downloadFile(file), [fileViewer]);

  if (airbrushings.length === 0) return null;

  return (
    <div className="space-y-3">
      {airbrushings.map((airbrushing, index) => {
        const layouts = getAirbrushingLayouts(airbrushing);
        const previewFrom = handlePreview(layouts);

        return (
          <div key={airbrushing.id} className="border border-border dark:border-border/30 rounded-lg p-4 space-y-3">
            {/* Header: title (→ detail when permitted) + status badge */}
            <div className="flex items-start justify-between gap-2">
              <button
                type="button"
                disabled={!canAccessDetails}
                onClick={canAccessDetails ? () => navigate(routes.production.airbrushings.details(airbrushing.id)) : undefined}
                className={cn(
                  "flex items-center gap-2 text-left",
                  canAccessDetails && "hover:text-primary transition-colors cursor-pointer",
                )}
              >
                <IconBrush className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-semibold text-sm">{`Aerografia #${index + 1}`}</h4>
              </button>
              <Badge variant={ENTITY_BADGE_CONFIG.AIRBRUSHING[airbrushing.status] || "default"} className="text-xs">
                {AIRBRUSHING_STATUS_LABELS[airbrushing.status]}
              </Badge>
            </div>

            {/* Info rows (bg-muted idiom, matching the standalone airbrushing detail card) */}
            <div className="flex flex-col gap-2">
              {airbrushing.painter?.name && (
                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-3 py-2">
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                    <IconUser className="h-3.5 w-3.5" />
                    Pintor
                  </span>
                  <span className="text-xs font-semibold text-foreground">{airbrushing.painter.name}</span>
                </div>
              )}

              {/* Dates — same label + grayish-card idiom as Pintor */}
              {(() => {
                const rows: { key: string; icon: typeof IconCalendar; label: string; value: Date }[] = [];
                if (airbrushing.startDate) rows.push({ key: "startDate", icon: IconCalendar, label: "Início", value: airbrushing.startDate as unknown as Date });
                if (airbrushing.finishDate) rows.push({ key: "finishDate", icon: IconCalendarEvent, label: "Finalização", value: airbrushing.finishDate as unknown as Date });
                if (airbrushing.startedAt) rows.push({ key: "startedAt", icon: IconCalendar, label: "Iniciado em", value: airbrushing.startedAt as unknown as Date });
                if (airbrushing.finishedAt) rows.push({ key: "finishedAt", icon: IconCalendarEvent, label: "Finalizado em", value: airbrushing.finishedAt as unknown as Date });
                // Fall back to the creation date only when no planned/actual dates exist.
                if (rows.length === 0 && airbrushing.createdAt) rows.push({ key: "createdAt", icon: IconCalendar, label: "Criado", value: airbrushing.createdAt as unknown as Date });
                return rows.map(({ key, icon: Icon, label, value }) => (
                  <div key={key} className="flex justify-between items-center bg-muted/50 rounded-lg px-3 py-2">
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </span>
                    <span className="text-xs font-semibold text-foreground">{formatDate(value)}</span>
                  </div>
                ));
              })()}
            </div>

            {/* Layouts — shared FileItem grid/list (no more bespoke thumbnail plumbing) */}
            {layouts.length > 0 && (
              <div className={cn(view === "grid" ? "flex flex-wrap gap-3" : "grid grid-cols-1 gap-2")}>
                {layouts.map((file) => (
                  <FileItem key={file.id} file={file} viewMode={view} onPreview={previewFrom} onDownload={handleDownload} showActions />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
