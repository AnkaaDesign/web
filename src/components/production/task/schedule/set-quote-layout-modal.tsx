import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileUploadField, type FileWithPreview } from "@/components/common/file";
import { uploadSingleFile } from "@/api-client/file";
import { taskService } from "@/api-client/task";
import { taskQuoteService } from "@/api-client/task-quote";
import { taskKeys } from "../../../../hooks";
import { taskQuoteKeys } from "@/hooks/production/use-task-quote";
import { ApprovedLayoutPicker, type LayoutOption } from "@/components/financial/common/approved-layout-picker";
import { IconLoader2, IconPhoto } from "@tabler/icons-react";
import { toast } from "@/components/ui/sonner";
import type { Task } from "../../../../types";

interface SetQuoteLayoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
}

type QuoteLayoutFile = {
  id: string;
  originalName?: string | null;
  filename?: string | null;
  size?: number | null;
  mimetype?: string | null;
  thumbnailUrl?: string | null;
};
type QuoteTask = {
  id: string;
  quoteId: string;
  quoteLayoutFiles: QuoteLayoutFile[];
  layouts: LayoutOption[];
};

// Image identity — same picture regardless of File id (a quote layout is a private
// clone of a task layout: kept originalName + size, new filename).
const imageKey = (f: { originalName?: string | null; filename?: string | null; size?: number | null }) =>
  `${(f.originalName || f.filename || "").trim().toLowerCase()}::${f.size ?? 0}`;

const toLayoutOption = (layout: any): LayoutOption => {
  const file = layout.file || layout;
  return {
    id: file.id,
    layoutId: layout.id,
    filename: file.filename,
    originalName: file.originalName,
    thumbnailUrl: file.thumbnailUrl ?? null,
    status: layout.status,
    mimetype: file.mimetype,
    path: file.path ?? null,
    size: file.size,
  };
};

const layoutToFile = (o: {
  id: string;
  originalName?: string | null;
  filename?: string | null;
  size?: number | null;
  mimetype?: string | null;
  thumbnailUrl?: string | null;
}): FileWithPreview =>
  ({
    id: o.id,
    name: o.originalName || o.filename || "layout",
    size: o.size || 0,
    type: o.mimetype || "image/png",
    lastModified: Date.now(),
    uploaded: true,
    uploadProgress: 100,
    uploadedFileId: o.id,
    thumbnailUrl: o.thumbnailUrl ?? null,
  } as FileWithPreview);

// Image layouts present in EVERY selected task — the shared pool to pick from.
const computeCommonLayouts = (quoteTasks: QuoteTask[]): LayoutOption[] => {
  if (quoteTasks.length === 0) return [];
  const counts = new Map<string, { opt: LayoutOption; count: number }>();
  for (const t of quoteTasks) {
    const seen = new Set<string>();
    for (const o of t.layouts) {
      if (!(o.mimetype || "").startsWith("image/")) continue;
      const k = imageKey(o);
      if (seen.has(k)) continue; // dedupe within a task
      seen.add(k);
      const e = counts.get(k);
      if (e) e.count++;
      else counts.set(k, { opt: o, count: 1 });
    }
  }
  return Array.from(counts.values())
    .filter((e) => e.count === quoteTasks.length)
    .map((e) => e.opt);
};

/**
 * Bulk-set the quote's approved layout files (TaskQuote.layoutFiles, up to 2) for
 * every selected task that has a quote.
 *
 * When every selected task shares the same task layouts (the common plate/serial
 * sibling case), those shared layouts are shown as a toggle PICKER — identical to
 * the budget step (ApprovedLayoutPicker). Otherwise (disjoint or missing layout
 * pools) it falls back to uploading one shared layout applied to all quotes.
 *
 * Either way the API gives each quote its OWN private copy of the chosen file
 * (resolveLayoutFileIdsForQuote) so sibling quotes can't steal it, and reconciles
 * it into an APPROVED task layout (syncTaskLayoutsFromQuote). layoutFileIds is a
 * safe-after-billing field, so this also works on locked quotes.
 */
export function SetQuoteLayoutModal({ open, onOpenChange, tasks }: SetQuoteLayoutModalProps) {
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [prefilledFileIds, setPrefilledFileIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quoteTasks, setQuoteTasks] = useState<QuoteTask[]>([]);

  const tasksWithoutQuote = tasks.length - quoteTasks.length;

  const idsEqual = (a: string[], b: string[]) =>
    a.length === b.length && a.every((id, i) => id === b[i]);

  // Shared pool: image layouts present in all selected tasks → picker mode.
  const commonLayouts = useMemo(() => computeCommonLayouts(quoteTasks), [quoteTasks]);
  const pickerMode = commonLayouts.length > 0;

  // Selected quotes currently carry differing approved layouts?
  const hasMixedLayouts = useMemo(() => {
    const nonEmpty = quoteTasks.filter((t) => t.quoteLayoutFiles.length > 0);
    if (nonEmpty.length <= 1) return false;
    const key = (t: QuoteTask) => t.quoteLayoutFiles.map(imageKey).sort().join("|");
    const first = key(nonEmpty[0]);
    return !nonEmpty.every((t) => key(t) === first);
  }, [quoteTasks]);

  // Fetch fresh quote + task-layout data for the selected tasks, then seed the
  // current selection when every selected quote already shares the same layout.
  useEffect(() => {
    if (!open) return;
    setFiles([]);
    setPrefilledFileIds([]);
    setQuoteTasks([]);
    if (tasks.length === 0) return;

    let cancelled = false;
    setIsLoading(true);
    (async () => {
      try {
        // Chunk requests to avoid URL length limits when many tasks are selected
        const CHUNK_SIZE = 20;
        const ids = tasks.map((t) => t.id);
        const chunks: string[][] = [];
        for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
          chunks.push(ids.slice(i, i + CHUNK_SIZE));
        }
        const responses = await Promise.all(
          chunks.map((chunk) =>
            taskService.getTasks({
              where: { id: { in: chunk } },
              include: { quote: { include: { layoutFiles: true } }, layouts: { include: { file: true } } },
              limit: chunk.length,
            }),
          ),
        );
        if (cancelled) return;
        const fetched: QuoteTask[] = responses
          .flatMap((r) => r.data || [])
          .filter((t: any) => t.quote?.id)
          .map((t: any) => ({
            id: t.id,
            quoteId: t.quote.id,
            quoteLayoutFiles: (t.quote.layoutFiles || []).map((f: any) => ({
              id: f.id,
              originalName: f.originalName,
              filename: f.filename,
              size: f.size,
              mimetype: f.mimetype,
              thumbnailUrl: f.thumbnailUrl,
            })),
            layouts: (t.layouts || []).map(toLayoutOption),
          }));
        setQuoteTasks(fetched);

        // Seed the current selection.
        const common = computeCommonLayouts(fetched);
        if (common.length > 0) {
          // Picker mode: pre-select images that are the approved layout in EVERY quote.
          const selected = common
            .filter((o) => {
              const k = imageKey(o);
              return fetched.every((t) => t.quoteLayoutFiles.some((f) => imageKey(f) === k));
            })
            .slice(0, 2)
            .map(layoutToFile);
          setFiles(selected);
          setPrefilledFileIds(selected.map((f) => (f as any).uploadedFileId));
        } else {
          // Upload mode: prefill when every quote already shares the same layout set.
          const first = fetched[0]?.quoteLayoutFiles || [];
          const setKey = (arr: QuoteLayoutFile[]) => arr.map(imageKey).sort().join("|");
          const shared =
            first.length > 0 && fetched.every((t) => setKey(t.quoteLayoutFiles) === setKey(first));
          if (shared) {
            const seeded = first.map(layoutToFile);
            setFiles(seeded);
            setPrefilledFileIds(seeded.map((f) => (f as any).uploadedFileId));
          }
        }
      } catch {
        // Error toast comes from the axios interceptor
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, tasks]);

  // Current ordered FILE ids in the selection (existing files only — new uploads
  // resolve at submit). Used to detect any change vs the prefilled set.
  const currentExistingIds = files
    .filter((f) => !(f instanceof File))
    .map((f) => (f as any).uploadedFileId || (f as any).id)
    .filter(Boolean) as string[];
  const hasNewFile = files.some((f) => f instanceof File);
  const layoutChanged = hasNewFile || !idsEqual(currentExistingIds, prefilledFileIds);
  const canApply = !isLoading && !isSubmitting && quoteTasks.length > 0 && layoutChanged;

  const handleClose = (next: boolean) => {
    if (isSubmitting) return;
    if (!next) {
      setFiles([]);
      setPrefilledFileIds([]);
    }
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (!canApply) return;
    setIsSubmitting(true);
    try {
      // Resolve ordered FILE ids (up to 2), uploading any new files.
      const resolvedIds: string[] = [];
      for (const f of files) {
        if (f instanceof File) {
          const response = await uploadSingleFile(f, { fileContext: "quote-layout" });
          if (!response.success || !response.data) {
            toast.error("Erro ao enviar o layout");
            return;
          }
          resolvedIds.push(response.data.id);
        } else {
          const existingId = (f as any).uploadedFileId || (f as any).id;
          if (existingId) resolvedIds.push(existingId);
        }
      }
      // Apply SEQUENTIALLY, not in parallel: the API gives each quote its own
      // private copy of a shared layout file (so sibling quotes can't steal it),
      // which relies on seeing the previous quote's ownership. Parallel writes
      // would race on the file's single-owner FK before any clone happens.
      const results: PromiseSettledResult<unknown>[] = [];
      for (const t of quoteTasks) {
        try {
          results.push({ status: "fulfilled", value: await taskQuoteService.updateLayoutFile(t.quoteId, resolvedIds) });
        } catch (e) {
          results.push({ status: "rejected", reason: e });
        }
      }
      const failed = results.filter((r) => r.status === "rejected").length;
      const succeeded = results.length - failed;

      if (succeeded > 0) {
        toast.success(
          resolvedIds.length > 0
            ? `Layout do orçamento atualizado em ${succeeded} tarefa${succeeded > 1 ? "s" : ""}`
            : `Layout do orçamento removido de ${succeeded} tarefa${succeeded > 1 ? "s" : ""}`,
        );
        queryClient.invalidateQueries({ queryKey: taskKeys.all });
        queryClient.invalidateQueries({ queryKey: taskQuoteKeys.all });
      }
      if (failed > 0) {
        toast.error(`Falha ao atualizar ${failed} orçamento${failed > 1 ? "s" : ""}`);
      }
      if (failed === 0) {
        setFiles([]);
        setPrefilledFileIds([]);
        onOpenChange(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const appliedCount = isLoading ? tasks.length : quoteTasks.length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={pickerMode ? "sm:max-w-[640px]" : "sm:max-w-[520px]"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconPhoto className="h-5 w-5" />
            Layout do Orçamento
          </DialogTitle>
          <DialogDescription>
            Aplicando para {appliedCount} tarefa{appliedCount !== 1 ? "s" : ""}.{" "}
            {pickerMode
              ? "Selecione o layout aprovado entre os layouts compartilhados pelas tarefas."
              : "O layout enviado também é adicionado como layout aprovado de cada tarefa."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {!isLoading && quoteTasks.length === 0 && (
            <Alert variant="warning">
              <AlertDescription>
                Nenhuma das tarefas selecionadas possui orçamento.
              </AlertDescription>
            </Alert>
          )}

          {!isLoading && quoteTasks.length > 0 && tasksWithoutQuote > 0 && (
            <Alert variant="warning">
              <AlertDescription>
                {tasksWithoutQuote} tarefa{tasksWithoutQuote > 1 ? "s" : ""} sem orçamento ser{tasksWithoutQuote > 1 ? "ão ignoradas" : "á ignorada"}.
              </AlertDescription>
            </Alert>
          )}

          {hasMixedLayouts && (
            <Alert variant="warning">
              <AlertDescription>
                Os orçamentos selecionados possuem layouts diferentes. O layout escolhido substituirá todos.
              </AlertDescription>
            </Alert>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <IconLoader2 className="h-5 w-5 animate-spin mr-2" />
              Carregando layouts...
            </div>
          ) : pickerMode ? (
            <ApprovedLayoutPicker
              layouts={commonLayouts}
              layoutFiles={files}
              onChange={setFiles}
              disabled={isSubmitting}
            />
          ) : (
            <FileUploadField
              onFilesChange={setFiles}
              existingFiles={files}
              maxFiles={2}
              maxSize={10 * 1024 * 1024}
              acceptedFileTypes={{ "image/*": [".jpeg", ".jpg", ".png", ".gif", ".webp"] }}
              disabled={isSubmitting}
              variant="compact"
              placeholder="Arraste ou clique para selecionar o layout aprovado"
              showPreview
            />
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canApply}>
            {isSubmitting ? (
              <>
                <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                Aplicando...
              </>
            ) : (
              "Aplicar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
