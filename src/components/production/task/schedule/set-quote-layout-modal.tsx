import React, { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileUploadField, type FileWithPreview } from "@/components/common/file";
import { getFileById, uploadSingleFile } from "@/api-client/file";
import { taskService } from "@/api-client/task";
import { taskQuoteService } from "@/api-client/task-quote";
import { taskKeys } from "../../../../hooks";
import { taskQuoteKeys } from "@/hooks/production/use-task-quote";
import { IconLoader2, IconPhoto } from "@tabler/icons-react";
import { toast } from "@/components/ui/sonner";
import type { Task } from "../../../../types";

interface SetQuoteLayoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
}

/**
 * Commercial counterpart of the admin "Adicionar Layouts" bulk form.
 * Instead of editing task artworks, it sets the quote's approved layout
 * (TaskQuote.layoutFileId) for every selected task that has a quote.
 * layoutFileId is a safe-after-billing field, so this also works on locked quotes.
 */
export function SetQuoteLayoutModal({ open, onOpenChange, tasks }: SetQuoteLayoutModalProps) {
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [prefilledFileId, setPrefilledFileId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Tasks refetched with their quote on open — the list rows passed in may not
  // include the quote relation (or may carry a stale layoutFileId)
  const [quoteTasks, setQuoteTasks] = useState<Array<{ id: string; quote: { id: string; layoutFileId: string | null } }>>([]);

  const tasksWithoutQuote = tasks.length - quoteTasks.length;

  // All selected quotes share the same existing layout?
  const commonLayoutFileId = useMemo(() => {
    if (quoteTasks.length === 0) return null;
    const first = quoteTasks[0].quote.layoutFileId ?? null;
    if (!first) return null;
    return quoteTasks.every((t) => (t.quote.layoutFileId ?? null) === first) ? first : null;
  }, [quoteTasks]);

  const hasMixedLayouts = !commonLayoutFileId && quoteTasks.some((t) => t.quote.layoutFileId);

  // Fetch fresh quote data for the selected tasks, then prefill the current
  // layout when every selected quote shares the same one
  useEffect(() => {
    if (!open) return;
    setFiles([]);
    setPrefilledFileId(null);
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
            taskService.getTasks({ where: { id: { in: chunk } }, include: { quote: true }, limit: chunk.length }),
          ),
        );
        if (cancelled) return;
        const fetched = responses
          .flatMap((r) => r.data || [])
          .filter((t: any) => t.quote?.id)
          .map((t: any) => ({ id: t.id, quote: { id: t.quote.id, layoutFileId: t.quote.layoutFileId ?? null } }));
        setQuoteTasks(fetched);

        const first = fetched[0]?.quote.layoutFileId ?? null;
        const shared = first && fetched.every((t) => (t.quote.layoutFileId ?? null) === first) ? first : null;
        if (!shared) return;

        const res = await getFileById(shared);
        if (cancelled || !res.data) return;
        const file = res.data;
        setPrefilledFileId(file.id);
        setFiles([
          {
            id: file.id,
            name: file.originalName || file.filename || "layout",
            size: file.size || 0,
            type: file.mimetype || "application/octet-stream",
            lastModified: file.createdAt ? new Date(file.createdAt).getTime() : Date.now(),
            uploaded: true,
            uploadProgress: 100,
            uploadedFileId: file.id,
            thumbnailUrl: file.thumbnailUrl,
          } as FileWithPreview,
        ]);
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

  const newFile = files.find((f) => f instanceof File) as File | undefined;
  const removedPrefill = !!prefilledFileId && files.length === 0;
  const canApply = !isLoading && !isSubmitting && quoteTasks.length > 0 && (!!newFile || removedPrefill);

  const handleClose = (next: boolean) => {
    if (isSubmitting) return;
    if (!next) {
      setFiles([]);
      setPrefilledFileId(null);
    }
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (!canApply) return;
    setIsSubmitting(true);
    try {
      let layoutFileId: string | null = null;
      if (newFile) {
        const response = await uploadSingleFile(newFile, { fileContext: "quote-layout" });
        if (!response.success || !response.data) {
          toast.error("Erro ao enviar o layout");
          return;
        }
        layoutFileId = response.data.id;
      }

      const results = await Promise.allSettled(
        quoteTasks.map((t) => taskQuoteService.updateLayoutFile(t.quote.id, layoutFileId)),
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      const succeeded = results.length - failed;

      if (succeeded > 0) {
        toast.success(
          layoutFileId
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
        setPrefilledFileId(null);
        onOpenChange(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconPhoto className="h-5 w-5" />
            Layout do Orçamento
          </DialogTitle>
          <DialogDescription>
            Aplicando para {isLoading ? tasks.length : quoteTasks.length} tarefa{(isLoading ? tasks.length : quoteTasks.length) !== 1 ? "s" : ""}
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
                Os orçamentos selecionados possuem layouts diferentes. O layout enviado substituirá todos.
              </AlertDescription>
            </Alert>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <IconLoader2 className="h-5 w-5 animate-spin mr-2" />
              Carregando layout atual...
            </div>
          ) : (
            <FileUploadField
              onFilesChange={setFiles}
              existingFiles={files}
              maxFiles={1}
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
