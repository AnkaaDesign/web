import React, { useCallback, useMemo } from "react";

import { FileItem, useFileViewer, type FileViewMode } from "@/components/common/file";
import { useImplementMeasuresByTruck } from "@/hooks/administration/use-implement-measure";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Panel } from "@/lib/layout-dimensions";
import type { File, Task } from "@/types";
import { getApiBaseUrl } from "@/utils/file";

/**
 * Layout records are File rows that may also carry a nested `file` relation and an approval
 * `status` (neither lives on the base File type, so we widen locally to read them safely).
 */
type LayoutLike = File & { file?: File | null; status?: string | null };

/**
 * The layouts visible to the current user: those carrying file data AND either visible to a
 * privileged (`canViewBadges`) viewer or APPROVED for everyone else. Shared by the section body and
 * the page-composed header actions (count badge + "Baixar Todos") so both stay in sync.
 */
export function getVisibleLayouts(task: Task, canViewBadges: boolean): LayoutLike[] {
  if (!task.layouts) return [];
  return (task.layouts as LayoutLike[]).filter((artwork) => {
    const hasFileData = artwork.file || artwork.filename || artwork.path;
    return Boolean(hasFileData) && (canViewBadges || artwork.status === "APPROVED");
  });
}

/** Open each artwork's download endpoint in turn, staggered to avoid popup-blocking. */
export async function downloadAllLayouts(layouts: LayoutLike[]): Promise<void> {
  const apiUrl = getApiBaseUrl();
  for (let i = 0; i < layouts.length; i++) {
    const fileId = layouts[i].file?.id || layouts[i].id;
    if (fileId) window.open(`${apiUrl}/files/${fileId}/download`, "_blank");
    if (i < layouts.length - 1) await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

/**
 * Bare render body for the "Layouts" (layouts) detail section. The DetailPage host supplies the
 * outer Card + title; this component renders only the toolbar + file grid/list.
 *
 * Visible to every user, but contents are gated: privileged users (`canViewBadges`) see all
 * layouts each with an approval-status badge, while everyone else sees only APPROVED layouts.
 * Returns null when there is nothing to show.
 */
export function LayoutsSection({ task, canViewBadges, view }: { task: Task; canViewBadges: boolean; view: FileViewMode }): React.ReactNode {
  const fileViewer = useFileViewer();

  // Only layouts that carry file data AND are visible to this user (privileged, or APPROVED).
  const filteredLayouts = useMemo<LayoutLike[]>(() => getVisibleLayouts(task, canViewBadges), [task, canViewBadges]);

  // As medidas do implemento não viajam no `task` (lá vem só o `truck` raso);
  // esta é a mesma consulta que a página de detalhe faz, e o react-query
  // devolve do cache.
  const { data: implementMeasures } = useImplementMeasuresByTruck(task.truck?.id || "", {
    enabled: Boolean(task.truck?.id),
  });

  /**
   * As medidas do implemento que o visualizador usa para cotar o layout.
   *
   * A ordem é a das faces na página, de cima para baixo: motorista, sapo,
   * traseira. As duas laterais têm o mesmo tamanho em 92% dos arquivos, então
   * é a ordem — não a geometria — que diz qual é qual.
   *
   * `ImplementMeasure` guarda METRO; o cotador trabalha em centímetro. A
   * conversão é aqui, uma vez só.
   */
  const layoutPanels = useMemo<Panel[]>(() => {
    type SideMeasure = {
      height: number;
      sections?: { width: number; isDoor?: boolean; doorHeight?: number | null }[];
    };
    const sides = implementMeasures as
      | { leftSideMeasure?: SideMeasure; rightSideMeasure?: SideMeasure; backSideMeasure?: SideMeasure }
      | undefined;
    if (!sides) return [];
    const toPanel = (side: Panel["side"], measure: SideMeasure | undefined): Panel | null => {
      if (!measure?.sections?.length || !measure.height) return null;
      return {
        side,
        heightCm: measure.height * 100,
        sections: measure.sections.map((s) => ({
          widthCm: s.width * 100,
          isDoor: Boolean(s.isDoor),
          doorHeightCm: s.doorHeight ? s.doorHeight * 100 : null,
        })),
      };
    };
    return [
      toPanel("MOTORISTA", sides.leftSideMeasure),
      toPanel("SAPO", sides.rightSideMeasure),
      toPanel("TRASEIRA", sides.backSideMeasure),
    ].filter((p): p is Panel => p !== null);
  }, [implementMeasures]);

  /**
   * Preview abre a coleção de artes no visualizador da aplicação, no índice clicado.
   *
   * A galeria usa a MESMA lista visível dos cards (`filteredLayouts`): abrir a partir de
   * `task.layouts` cru levava quem não pode aprovar a navegar, com as setas, até layouts
   * reprovados/rascunho que a seção justamente esconde dele.
   *
   * Vai junto o mapa `fileId → status`, senão a arte reprovada abre em tela cheia sem
   * nenhuma marca — o status é do wrapper `Layout`, não viaja no `File`.
   */
  const handlePreview = useCallback(
    (file: File) => {
      const layouts: File[] = [];
      const layoutStatusByFileId: Record<string, string | null | undefined> = {};
      for (const artwork of filteredLayouts) {
        const backing = (artwork.file ?? artwork) as File;
        if (!backing || typeof backing !== "object" || !("id" in backing)) continue;
        layouts.push(backing);
        layoutStatusByFileId[backing.id] = artwork.status;
      }
      const index = layouts.findIndex((f) => f.id === file.id);
      fileViewer.actions.viewFiles(layouts, index >= 0 ? index : 0, {
        layoutStatusByFileId,
        layoutPanels,
      });
    },
    [filteredLayouts, fileViewer, layoutPanels],
  );

  const handleDownload = useCallback(
    (file: File) => {
      fileViewer.actions.downloadFile(file);
    },
    [fileViewer],
  );

  if (filteredLayouts.length === 0) return null;

  return (
    <div className={cn(view === "grid" ? "flex flex-wrap gap-3" : "grid grid-cols-1 gap-2")}>
      {filteredLayouts.map((artwork) => {
          const fileData = (artwork.file ?? artwork) as File;
          return (
            // The badge wrapper must carry the card's grid width itself: as a shrink-to-fit flex item
            // it would collapse the `w-full max-w-[200px]` FileItem down to the thumbnail's intrinsic
            // aspect, making these cards a different shape from the (unwrapped) Arquivos ones.
            <div key={artwork.id} className={cn("relative", view === "grid" && "w-full max-w-[200px]")}>
              <FileItem file={fileData} viewMode={view} onPreview={handlePreview} onDownload={handleDownload} showActions />
              {canViewBadges && artwork.status && (
                <div className="pointer-events-none absolute left-1 top-1 max-w-[calc(100%-0.5rem)]">
                  <Badge
                    variant={artwork.status === "APPROVED" ? "approved" : artwork.status === "REPROVED" ? "rejected" : "secondary"}
                    className="h-4 truncate px-1 text-[9px] font-medium leading-none shadow-sm"
                  >
                    {artwork.status === "APPROVED" ? "Aprovado" : artwork.status === "REPROVED" ? "Reprovado" : "Rascunho"}
                  </Badge>
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}
