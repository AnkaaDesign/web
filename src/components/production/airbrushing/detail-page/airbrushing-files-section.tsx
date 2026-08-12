import { useState, type ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { IconLayoutGrid, IconList } from "@tabler/icons-react";
import type { File as AnkaaFile } from "../../../../types";
import { cn } from "@/lib/utils";
import { FileItem, type FileViewMode, useFileViewer } from "@/components/common/file";
import { LayoutStatusBadge, LayoutStatusSelector } from "@/components/production/task/layout";
import { LAYOUT_STATUS } from "@/constants/enums";

interface AirbrushingFilesSectionProps {
  files: AnkaaFile[];
  /** Icon shown in the empty state. */
  emptyIcon: ComponentType<{ className?: string }>;
  emptyTitle: string;
  emptyDescription: string;
  /** Initial layout — "grid" for layouts (images), "list" for documents. */
  defaultViewMode?: FileViewMode;
  /** Controlled view mode. When provided, the section reflects it instead of its own state. */
  viewMode?: FileViewMode;
  onViewModeChange?: (mode: FileViewMode) => void;
  /** Hide the internal grid/list toolbar (e.g. when the toggle is lifted into the section header). */
  hideToolbar?: boolean;
  /**
   * fileId → LayoutStatus. Presente só na seção de LAYOUTS: recibos e notas fiscais são
   * Files puros e não têm fluxo de aprovação. Quando informado, cada arquivo ganha a pílula
   * de status; quem pode aprovar troca o status ali mesmo, sem abrir o formulário.
   */
  layoutStatusByFileId?: Record<string, string>;
  /** Só COMERCIAL/ADMIN — espelha canApproveLayouts no servidor, que ignora em silêncio quem não pode. */
  canApproveLayouts?: boolean;
  onLayoutStatusChange?: (fileId: string, status: string) => void;
}

/**
 * Bare file gallery — the BODY of an airbrushing files card without any Card/header chrome
 * (the DetailPage section provides the title). Grid/list toggle + click-to-preview via the
 * app-level file viewer. Mirrors order-documents-section.tsx; reused for layouts, invoices,
 * and receipts.
 */
export function AirbrushingFilesSection({
  files,
  emptyIcon: EmptyIcon,
  emptyTitle,
  emptyDescription,
  defaultViewMode = "list",
  viewMode: controlledViewMode,
  onViewModeChange,
  hideToolbar = false,
  layoutStatusByFileId,
  canApproveLayouts = false,
  onLayoutStatusChange,
}: AirbrushingFilesSectionProps) {
  const [internalViewMode, setInternalViewMode] = useState<FileViewMode>(defaultViewMode);
  const viewMode = controlledViewMode ?? internalViewMode;
  const setViewMode = onViewModeChange ?? setInternalViewMode;
  const { actions } = useFileViewer();

  const handleFileClick = (file: AnkaaFile) => {
    const index = files.findIndex((f) => f.id === file.id);
    actions.viewFiles(files, index >= 0 ? index : 0);
  };

  return (
    <div className="space-y-3">
      {!hideToolbar && (
        <div className="flex items-center justify-end gap-1">
          <Button variant={viewMode === "list" ? "default" : "outline"} size="sm" onClick={() => setViewMode("list")} className="h-8 w-8 p-0">
            <IconList className="h-4 w-4" />
          </Button>
          <Button variant={viewMode === "grid" ? "default" : "outline"} size="sm" onClick={() => setViewMode("grid")} className="h-8 w-8 p-0">
            <IconLayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      )}
      {files.length > 0 ? (
        <div className="max-h-[420px] overflow-y-auto">
          <div className={cn(viewMode === "grid" ? "flex flex-wrap gap-3" : "grid grid-cols-1 gap-2")}>
            {files.map((file) => {
              const status = layoutStatusByFileId?.[file.id];
              if (!layoutStatusByFileId) {
                return <FileItem key={file.id} file={file} viewMode={viewMode} onPreview={handleFileClick} />;
              }

              const canSetStatus = canApproveLayouts && Boolean(onLayoutStatusChange);

              // GRID: pílula sobreposta à miniatura (mesma posição do layout de tarefa),
              // e o seletor logo abaixo do tile para quem aprova. O seletor precisa
              // existir NOS DOIS modos — grid é o padrão desta seção, e deixá-lo só na
              // lista esconderia a aprovação atrás de um toggle de visualização.
              if (viewMode === "grid") {
                return (
                  <div key={file.id} className="flex flex-col gap-1">
                    <div className="relative">
                      <FileItem file={file} viewMode={viewMode} onPreview={handleFileClick} />
                      <div className="pointer-events-none absolute left-1 top-1">
                        <LayoutStatusBadge status={status} showDraft className="h-4 px-1 text-[9px] leading-none shadow-sm" />
                      </div>
                    </div>
                    {canSetStatus && (
                      <LayoutStatusSelector
                        value={status ?? LAYOUT_STATUS.DRAFT}
                        onChange={(next) => onLayoutStatusChange!(file.id, next)}
                        className="w-full"
                        triggerClassName="h-7 w-full justify-between text-xs"
                      />
                    )}
                  </div>
                );
              }

              // LISTA: o controle vai à direita, onde há espaço horizontal.
              return (
                <div key={file.id} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <FileItem file={file} viewMode={viewMode} onPreview={handleFileClick} />
                  </div>
                  <div className="shrink-0">
                    {canSetStatus ? (
                      <LayoutStatusSelector value={status ?? LAYOUT_STATUS.DRAFT} onChange={(next) => onLayoutStatusChange!(file.id, next)} triggerClassName="h-8" />
                    ) : (
                      <LayoutStatusBadge status={status} showDraft />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="p-4 bg-muted/30 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <EmptyIcon className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2 text-foreground">{emptyTitle}</h3>
          <p className="text-sm text-muted-foreground">{emptyDescription}</p>
        </div>
      )}
    </div>
  );
}
