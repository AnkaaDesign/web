import { useCallback, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFileViewer } from "@/components/common/file/file-viewer";
import { IconPhoto, IconEye, IconCheck, IconUpload } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { getApiBaseUrl } from "@/config/api";
import type { FileWithPreview } from "@/components/common/file/file-uploader";

/**
 * A candidate task layout to offer as the quote's approved layout.
 * `id` is the underlying File id (a UUID once uploaded; a local temp id for a
 * not-yet-uploaded file). `layoutId` is the Layout record id when persisted.
 */
export interface LayoutOption {
  id: string;
  layoutId?: string;
  filename?: string;
  originalName?: string;
  thumbnailUrl?: string | null;
  // Object-URL for brand-new, not-yet-uploaded local files (no server id yet).
  preview?: string | null;
  status?: string;
  mimetype?: string;
  // Remote storage path (http URL) when available — lets the viewer serve the file.
  path?: string | null;
  size?: number;
}

// Map an image file extension to a real image MIME type. Used so the in-app file
// viewer's determineFileViewAction categorizes the file as an "image" → opens the
// MODAL. An empty/unknown mimetype would fall through to download/new-tab.
const IMAGE_EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
};

const mimeFromName = (name?: string | null): string | null => {
  const ext = (name || "").toLowerCase().split(".").pop() || "";
  return IMAGE_EXT_TO_MIME[ext] || null;
};

// A persisted File id is a UUID; a not-yet-uploaded file carries a local temp id
// (`<timestamp>-<random>`). Used to decide whether the server thumbnail endpoint is
// safe to hit (it 404s on temp ids) and whether to open the local blob preview.
const isUuid = (id?: string | null): boolean =>
  !!id &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// Comparable {id, name, size} for matching a task art against a quote layout File.
type ImageKey = { id?: string; name: string; size: number };
const imageKeyOfArt = (a: LayoutOption): ImageKey => ({
  id: a.id,
  name: (a.originalName || a.filename || "").trim(),
  size: a.size || 0,
});
const imageKeyOfFile = (f: FileWithPreview): ImageKey => ({
  id: (f as any).uploadedFileId || f.id,
  name: (f.name || "").trim(),
  size: f.size || 0,
});
// Same underlying image: identical File id, OR identical filename + byte size — the
// latter catches the duplicate-record case (a quote layout that is a separate upload
// of the same task art) so it reads as already-selected, never as a duplicate tile.
const sameImage = (a: ImageKey, b: ImageKey): boolean =>
  (!!a.id && a.id === b.id) ||
  (!!a.name && a.name === b.name && a.size === b.size);

interface ApprovedLayoutPickerProps {
  /** The task's layout files — the pool the approved layout is chosen from. */
  layouts?: LayoutOption[];
  /** Currently-selected approved layout files (≤ maxFiles). */
  layoutFiles: FileWithPreview[];
  /** Emits the next selected set. The parent syncs its `layoutFileIds` form field. */
  onChange: (files: FileWithPreview[]) => void;
  disabled?: boolean;
  maxFiles?: number;
  /**
   * When set, a leading dashed "upload" card is rendered inside the grid (like the
   * task "Adicionar Layouts" form). Selecting files calls this with the raw Files —
   * the caller decides what to do (e.g. the quote modal appends them to the
   * selection as new references + uploads them as APPROVED task layouts).
   */
  onUploadFiles?: (files: File[]) => void;
  /** Label for the upload card (defaults to "Selecione ou envie um layout"). */
  uploadLabel?: string;
  /**
   * Lay the cards out as a single horizontal-scroll strip (fixed-width cards) instead
   * of the wrapping grid — matches the "Adicionar Layouts" upload field so both
   * prep-board layout modals read the same. Defaults to the wrapping grid.
   */
  horizontal?: boolean;
}

/**
 * The budget/quote "Layout Referência" picker: choose up to `maxFiles` of the
 * task's existing layout images as the quote's REFERENCE layout (the image shown
 * on the budget/invoice PDF + public page). Approval itself lives on the task
 * layout; this is a display reference. There is NO upload here — new images are
 * added on the task. Shared by the budget-create, budget-detail and billing steps
 * so all quote-layout selectors stay identical.
 *
 * A quote layout that is a separate File from its task art is matched by image
 * (filename + byte-size) so it reads as already-selected ("Selecionado"), and a
 * quote layout with no matching task art is shown as a selected-but-removable
 * "orphan" tile so the reference layout is never silently hidden.
 */
export function ApprovedLayoutPicker({
  layouts,
  layoutFiles,
  onChange,
  disabled,
  maxFiles = 2,
  onUploadFiles,
  uploadLabel = "Selecione ou envie um layout",
  horizontal = false,
}: ApprovedLayoutPickerProps) {
  // Fixed-width card + horizontal-scroll strip (matches LayoutFileUploadField's card
  // variant) vs. the default wrapping grid.
  const cardWidthClass = horizontal ? "w-[280px] shrink-0" : "w-full";
  const gridClass = horizontal
    ? "flex gap-3 overflow-x-auto pb-2"
    : "grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3";
  const fileViewer = useFileViewer();
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const canUpload =
    !!onUploadFiles && !disabled && layoutFiles.length < maxFiles;
  const handleUploadPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const picked = Array.from(e.target.files || []);
      if (picked.length && onUploadFiles) onUploadFiles(picked);
      // Reset so re-selecting the same file re-fires onChange.
      e.target.value = "";
    },
    [onUploadFiles],
  );

  // The task's image layouts — the candidates for the approved layout. Callers are
  // responsible for narrowing the pool (e.g. the budget step passes only APPROVED
  // layouts); the modal reuses this picker to pick layouts it approves on select.
  const layoutOptions = useMemo(() => {
    if (!layouts || layouts.length === 0) return [];
    return layouts.filter((a) => (a.mimetype || "").startsWith("image/"));
  }, [layouts]);

  const selectedCount = Math.min(layoutFiles.length, maxFiles);

  // Is this task art part of the approved layout? Matched by id OR same image.
  const isArtSelected = useCallback(
    (art: LayoutOption) =>
      layoutFiles.some((lf) => sameImage(imageKeyOfFile(lf), imageKeyOfArt(art))),
    [layoutFiles],
  );

  // Toggle a task art in/out of the approved layout (selection ONLY — status is
  // managed on the task). Same-image files are removed even when their File id
  // differs from the art's, so the duplicate-record case toggles cleanly.
  const toggleArt = useCallback(
    (art: LayoutOption) => {
      const ak = imageKeyOfArt(art);
      const selected = layoutFiles.some((lf) =>
        sameImage(imageKeyOfFile(lf), ak),
      );
      let next: FileWithPreview[];
      if (selected) {
        next = layoutFiles.filter((lf) => !sameImage(imageKeyOfFile(lf), ak));
      } else {
        if (layoutFiles.length >= maxFiles) return; // slot cap
        const lf = {
          id: art.id,
          name: art.originalName || art.filename || "layout",
          size: art.size || 0,
          type: art.mimetype || "image/png",
          lastModified: Date.now(),
          uploaded: true,
          uploadProgress: 100,
          uploadedFileId: art.id,
          thumbnailUrl: art.thumbnailUrl,
          // Carry the local object-URL preview so a not-yet-uploaded art still renders.
          preview: art.preview ?? null,
        } as FileWithPreview;
        next = [...layoutFiles, lf].slice(0, maxFiles);
      }
      onChange(next);
    },
    [layoutFiles, onChange, maxFiles],
  );

  // Quote layout files that match NO current task art (the art was removed, or a
  // legacy quote-only file). Shown as selected-but-removable tiles so the
  // approved layout is never silently hidden.
  const orphanLayoutFiles = useMemo(
    () =>
      layoutFiles.filter(
        (lf) =>
          !layoutOptions.some((a) =>
            sameImage(imageKeyOfFile(lf), imageKeyOfArt(a)),
          ),
      ),
    [layoutFiles, layoutOptions],
  );
  const removeOrphan = useCallback(
    (f: FileWithPreview) => {
      const fk = imageKeyOfFile(f);
      const next = layoutFiles.filter(
        (lf) => !sameImage(imageKeyOfFile(lf), fk),
      );
      onChange(next);
    },
    [layoutFiles, onChange],
  );

  // Resolve a renderable image src for an artwork option:
  //  1. server thumbnailUrl when present,
  //  2. object-URL preview for brand-new not-yet-uploaded local files,
  //  3. otherwise the server thumbnail endpoint keyed by the real File id.
  const getLayoutThumbnailSrc = useCallback((artwork: LayoutOption): string => {
    if (artwork.thumbnailUrl) return artwork.thumbnailUrl;
    if (artwork.preview) return artwork.preview;
    return `${getApiBaseUrl()}/files/thumbnail/${artwork.id}`;
  }, []);

  // Open an artwork in the in-app file-viewer MODAL. Pass a COMPLETE object with a
  // guaranteed image mimetype (derived from the filename ext when empty) so
  // determineFileViewAction categorizes it as an image.
  const openLayoutInViewer = useCallback(
    (artwork: LayoutOption) => {
      const filename = artwork.filename || artwork.originalName || "layout.png";
      const mimetype =
        (artwork.mimetype && artwork.mimetype.startsWith("image/")
          ? artwork.mimetype
          : null) ||
        mimeFromName(filename) ||
        mimeFromName(artwork.originalName) ||
        "image/png";
      fileViewer.actions.viewFile({
        id: artwork.id,
        filename,
        originalName: artwork.originalName || filename,
        mimetype,
        size: artwork.size || 0,
        thumbnailUrl: artwork.thumbnailUrl || null,
        path: artwork.path || null,
      } as any);
    },
    [fileViewer],
  );

  // Thumbnail for an orphan layout file: local preview → server thumbnailUrl →
  // thumbnail endpoint keyed by a real File id (a temp/local id would 404).
  const layoutThumbSrc = useCallback((f: FileWithPreview): string | null => {
    if (f.preview) return f.preview;
    if (f.thumbnailUrl) return f.thumbnailUrl;
    const realId =
      (isUuid((f as any).uploadedFileId) && (f as any).uploadedFileId) ||
      (isUuid(f.id) && f.id) ||
      null;
    return realId ? `${getApiBaseUrl()}/files/thumbnail/${realId}` : null;
  }, []);

  // Open an orphan layout file in the viewer (local blob if not yet uploaded, else by id).
  const viewLayout = useCallback(
    (f: FileWithPreview) => {
      const id = (f as any).uploadedFileId || f.id;
      if (f.preview && !isUuid(id)) {
        window.open(f.preview, "_blank");
        return;
      }
      const filename = f.name || "layout.png";
      const mimetype =
        (f.type && f.type.startsWith("image/") ? f.type : null) ||
        mimeFromName(filename) ||
        "image/png";
      fileViewer.actions.viewFile({
        id,
        filename,
        originalName: filename,
        mimetype,
        size: f.size || 0,
        thumbnailUrl: (f as any).thumbnailUrl || null,
        path: null,
      } as any);
    },
    [fileViewer],
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <IconPhoto className="h-4 w-4 text-muted-foreground" />
          Layout Referência
          <Badge
            variant={selectedCount > 0 ? "secondary" : "outline"}
            className="ml-auto text-[11px] font-normal tabular-nums"
          >
            {selectedCount}/{maxFiles}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {layoutOptions.length > 0 || orphanLayoutFiles.length > 0 || onUploadFiles ? (
          <div className="space-y-3">
            <div className={gridClass}>
              {/* Leading dashed "upload" card (only when the caller supports upload),
                  matching the task "Adicionar Layouts" form. Adds a NEW reference. */}
              {onUploadFiles && (
                <>
                  <input
                    ref={uploadInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleUploadPick}
                  />
                  <button
                    type="button"
                    disabled={!canUpload}
                    onClick={() => uploadInputRef.current?.click()}
                    className={cn(
                      "flex h-[calc(13rem+4.25rem)] w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-muted/20 p-4 text-center transition-colors",
                      cardWidthClass,
                      canUpload
                        ? "cursor-pointer border-border/70 hover:border-primary/60 hover:bg-muted/40"
                        : "cursor-not-allowed border-border/50 opacity-50",
                    )}
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <IconUpload className="h-5 w-5 text-muted-foreground" />
                    </span>
                    <span className="text-sm font-medium text-muted-foreground">
                      {uploadLabel}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      .jpeg, .jpg, .png, .gif, .webp
                    </span>
                  </button>
                </>
              )}
              {/* Task layouts — selectable. Click the image OR "Selecionar" to toggle;
                  "Ver" opens the viewer. Status is managed on the task. */}
              {layoutOptions.map((art) => {
                const selected = isArtSelected(art);
                const blockSelect =
                  !selected && (disabled || selectedCount >= maxFiles);
                const name = art.originalName || art.filename || "Arquivo";
                return (
                  <div
                    key={art.id}
                    className={cn(
                      "overflow-hidden rounded-lg border-2 bg-card transition-all",
                      cardWidthClass,
                      selected ? "border-primary ring-2 ring-primary/30" : "border-border",
                    )}
                  >
                    {/* Image preview — clicking it toggles selection */}
                    <button
                      type="button"
                      disabled={blockSelect}
                      onClick={() => toggleArt(art)}
                      title={selected ? "Remover do layout" : "Usar no layout"}
                      className={cn(
                        "relative block h-52 w-full bg-muted",
                        blockSelect
                          ? "cursor-not-allowed opacity-50"
                          : "cursor-pointer",
                      )}
                    >
                      <img
                        src={getLayoutThumbnailSrc(art)}
                        alt={name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.visibility = "hidden";
                        }}
                      />
                      {selected && (
                        <div className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                          <IconCheck className="h-4 w-4" />
                        </div>
                      )}
                    </button>

                    <div className="space-y-2 p-2">
                      <p className="truncate text-xs font-medium" title={name}>
                        {name}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 flex-1 px-2"
                          onClick={() => openLayoutInViewer(art)}
                        >
                          <IconEye className="mr-1 h-3.5 w-3.5" />
                          Ver
                        </Button>
                        <Button
                          type="button"
                          variant={selected ? "default" : "outline"}
                          size="sm"
                          className="h-8 flex-1 px-2"
                          disabled={blockSelect}
                          onClick={() => toggleArt(art)}
                        >
                          {selected ? (
                            <>
                              <IconCheck className="mr-1 h-3.5 w-3.5" />
                              Selecionado
                            </>
                          ) : (
                            "Selecionar"
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Quote layouts with no matching task art — selected, removable, no status */}
              {orphanLayoutFiles.map((f) => {
                const id = (f as any).uploadedFileId || f.id;
                const src = layoutThumbSrc(f);
                return (
                  <div
                    key={id}
                    className={cn(
                      "overflow-hidden rounded-lg border-2 border-primary bg-card ring-2 ring-primary/30",
                      cardWidthClass,
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => viewLayout(f)}
                      title="Ver layout"
                      className="relative block h-52 w-full cursor-pointer bg-muted"
                    >
                      {src ? (
                        <img
                          src={src}
                          alt={f.name || "layout"}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.visibility = "hidden";
                          }}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <IconPhoto className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                      )}
                      <div className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                        <IconCheck className="h-4 w-4" />
                      </div>
                    </button>
                    <div className="space-y-2 p-2">
                      <p className="truncate text-xs font-medium" title={f.name}>
                        {f.name || "Arquivo"}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 flex-1 px-2"
                          onClick={() => viewLayout(f)}
                        >
                          <IconEye className="mr-1 h-3.5 w-3.5" />
                          Ver
                        </Button>
                        {!disabled && (
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            className="h-8 flex-1 px-2"
                            onClick={() => removeOrphan(f)}
                          >
                            <IconCheck className="mr-1 h-3.5 w-3.5" />
                            Selecionado
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center">
            <IconPhoto className="mx-auto h-6 w-6 text-muted-foreground/50" />
            <p className="mt-2 text-sm font-medium text-muted-foreground">
              Nenhum layout na tarefa
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Adicione layouts na etapa "Tarefa" para usá-los como layout de referência.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
