import React from "react";
import { useNavigate } from "react-router-dom";
import { IconBrush, IconCalendar, IconCalendarEvent, IconFiles, IconFile, IconFileText } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { useFileViewer } from "@/components/common/file";
import { getApiBaseUrl, rewriteCdnUrl } from "@/utils/file";
import { formatCurrency } from "@/utils/number";
import { formatDate } from "@/utils/date";
import { cn } from "@/lib/utils";
import { routes, ENTITY_BADGE_CONFIG, AIRBRUSHING_STATUS_LABELS } from "@/constants";
import type { Airbrushing } from "@/types";

/**
 * Bare body for the "Aerografias" detail section (host renders the Card + title).
 * Ported faithfully from the legacy schedule details page. The hub fetches the
 * airbrushings (via `useAirbrushingsByTask`, with artworks/receipts/invoices
 * included) and passes them in; this component never calls the hook itself.
 */
export function AirbrushingsSection({
  airbrushings,
  canViewFinancials,
  canAccessDetails,
}: {
  airbrushings: Airbrushing[];
  canViewFinancials: boolean;
  canAccessDetails: boolean;
}): React.ReactNode {
  const navigate = useNavigate();
  const fileViewer = useFileViewer();

  if (airbrushings.length === 0) return null;

  const apiUrl = getApiBaseUrl().replace(/\/+$/, ""); // Remove trailing slashes

  return (
    <div className="space-y-3">
      {airbrushings.map((airbrushing, index) => {
        const firstArtwork = airbrushing.artworks?.[0];

        // Generate proper thumbnail URL - same logic as FileItem component
        const getArtworkThumbnailUrl = () => {
          if (!firstArtwork) return null;

          // If thumbnailUrl exists and is already a full URL
          if (firstArtwork.thumbnailUrl?.startsWith("http")) {
            return rewriteCdnUrl(firstArtwork.thumbnailUrl);
          }

          // If thumbnailUrl exists (relative path), use thumbnail endpoint
          if (firstArtwork.thumbnailUrl) {
            return `${apiUrl}/files/thumbnail/${firstArtwork.id}?size=small`;
          }

          // For images without thumbnails, check mimetype and use serve endpoint
          const mimetype = (firstArtwork as any).mimetype || (firstArtwork as any).mimeType || "";
          if (typeof mimetype === "string" && mimetype.startsWith("image/")) {
            return `${apiUrl}/files/serve/${firstArtwork.id}`;
          }

          // Fallback: try to serve anyway (backend will handle it)
          return `${apiUrl}/files/serve/${firstArtwork.id}`;
        };
        const artworkThumbnailUrl = getArtworkThumbnailUrl();

        return (
          <div
            key={airbrushing.id}
            className={cn(
              "border border-border dark:border-border/30 rounded-lg p-4 transition-colors",
              canAccessDetails && "hover:bg-muted/50 cursor-pointer",
            )}
            onClick={canAccessDetails ? () => navigate(routes.production.airbrushings.details(airbrushing.id)) : undefined}
          >
            <div className="flex gap-4">
              {/* Artwork thumbnail - clickable to open file viewer */}
              {firstArtwork && artworkThumbnailUrl && (
                <div
                  className="flex-shrink-0 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (airbrushing.artworks) {
                      fileViewer.actions.viewFiles(airbrushing.artworks, 0);
                    }
                  }}
                >
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted ring-1 ring-border hover:ring-2 hover:ring-primary transition-all">
                    <img
                      src={artworkThumbnailUrl}
                      alt="Arte"
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        // Hide image and show icon on error
                        const target = e.target as HTMLImageElement;
                        target.style.display = "none";
                        const parent = target.parentElement;
                        if (parent) {
                          parent.innerHTML =
                            '<div class="w-full h-full flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg></div>';
                        }
                      }}
                    />
                  </div>
                  {(airbrushing.artworks?.length ?? 0) > 1 && (
                    <p className="text-xs text-muted-foreground text-center mt-1">+{(airbrushing.artworks?.length ?? 0) - 1} mais</p>
                  )}
                </div>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <IconBrush className="h-4 w-4 text-muted-foreground" />
                    <h4 className="font-semibold text-sm">
                      {canViewFinancials && airbrushing.price ? formatCurrency(airbrushing.price) : `Aerografia #${index + 1}`}
                    </h4>
                  </div>
                  <Badge variant={ENTITY_BADGE_CONFIG.AIRBRUSHING[airbrushing.status] || "default"} className="text-xs">
                    {AIRBRUSHING_STATUS_LABELS[airbrushing.status]}
                  </Badge>
                </div>

                {/* Dates in column layout */}
                {(airbrushing.startDate || airbrushing.finishDate || airbrushing.createdAt) && (
                  <div className="flex flex-col gap-1 text-xs text-muted-foreground mb-2">
                    {airbrushing.startDate && (
                      <div className="flex items-center gap-1">
                        <IconCalendar className="h-3 w-3" />
                        <span>Início: {formatDate(airbrushing.startDate)}</span>
                      </div>
                    )}
                    {airbrushing.finishDate && (
                      <div className="flex items-center gap-1">
                        <IconCalendarEvent className="h-3 w-3" />
                        <span>Finalização: {formatDate(airbrushing.finishDate)}</span>
                      </div>
                    )}
                    {!airbrushing.startDate && !airbrushing.finishDate && airbrushing.createdAt && (
                      <div className="flex items-center gap-1">
                        <IconCalendar className="h-3 w-3" />
                        <span>Criado: {formatDate(airbrushing.createdAt)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Files count */}
                {((canViewFinancials && ((airbrushing.receipts?.length ?? 0) > 0 || (airbrushing.invoices?.length ?? 0) > 0)) ||
                  (!firstArtwork && (airbrushing.artworks?.length ?? 0) > 0)) && (
                  <div className="flex items-center text-xs text-muted-foreground pt-2 border-t">
                    <div className="flex gap-3">
                      {!firstArtwork && (airbrushing.artworks?.length ?? 0) > 0 && (
                        <div className="flex items-center gap-1">
                          <IconFiles className="h-3 w-3" />
                          <span>{airbrushing.artworks?.length ?? 0} arte(s)</span>
                        </div>
                      )}
                      {canViewFinancials && (airbrushing.receipts?.length ?? 0) > 0 && (
                        <div className="flex items-center gap-1">
                          <IconFile className="h-3 w-3" />
                          <span>{airbrushing.receipts?.length ?? 0} recibo(s)</span>
                        </div>
                      )}
                      {canViewFinancials && (airbrushing.invoices?.length ?? 0) > 0 && (
                        <div className="flex items-center gap-1">
                          <IconFileText className="h-3 w-3" />
                          <span>{airbrushing.invoices?.length ?? 0} NFe(s)</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
