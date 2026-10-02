/**
 * O PROJETO DO IMPLEMENTO — os PDFs do fabricante (planta, cotas da carroceria).
 *
 * Não confundir com o PROJETO DA TAREFA (o PDF cotado da arte, em
 * `Task.projectFiles`): aquele é do trabalho de pintura; este é do veículo e
 * acompanha o implemento em todas as tarefas dele.
 *
 * Cada mudança grava na hora (`PUT /implements/:id/project-files`, com a lista que
 * fica e os arquivos novos), fora do Salvar do formulário em volta.
 */
import { useRef } from "react";
import { IconFileUpload } from "@tabler/icons-react";

import { FileItem, useFileViewer } from "@/components/common/file";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { useSetImplementProjectFiles } from "@/hooks/production/use-implement-art";
import { cn } from "@/lib/utils";
import type { File as AnkaaFile } from "@/types";
import { canEditImplementProject } from "@/utils/permissions/implement-art-permissions";

interface ImplementProjectFilesPanelProps {
  implementId: string | null | undefined;
  files: AnkaaFile[] | null | undefined;
  readOnly?: boolean;
  className?: string;
}

export function ImplementProjectFilesPanel({ implementId, files, readOnly, className }: ImplementProjectFilesPanelProps) {
  const { user } = useAuth();
  const canEdit = !readOnly && !!implementId && canEditImplementProject(user as any);
  const setFiles = useSetImplementProjectFiles();
  const fileViewer = useFileViewer();
  const input = useRef<HTMLInputElement>(null);
  const current = files ?? [];

  if (!implementId) return null;
  if (current.length === 0 && !canEdit) return null;

  const keepIds = current.map((file) => file.id);

  const add = (list: FileList | null) => {
    const added = Array.from(list ?? []);
    if (added.length === 0) return;
    void setFiles.mutateAsync({ implementId, fileIds: keepIds, files: added }).catch(() => undefined);
  };

  const remove = (file: AnkaaFile) => {
    void setFiles
      .mutateAsync({ implementId, fileIds: keepIds.filter((id) => id !== file.id) })
      .catch(() => undefined);
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Projeto do implemento</p>
          <p className="text-sm text-muted-foreground">Os PDFs do fabricante — acompanham o veículo em todas as tarefas.</p>
        </div>
        {canEdit && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={setFiles.isPending}
            onClick={() => input.current?.click()}
          >
            <IconFileUpload className="h-4 w-4" />
            Adicionar
          </Button>
        )}
      </div>

      {current.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          Sem projeto do fabricante neste implemento.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {current.map((file, index) => (
            <FileItem
              key={file.id}
              file={file}
              showActions
              onPreview={() => fileViewer.actions.viewFiles(current, index)}
              onDelete={canEdit ? remove : undefined}
            />
          ))}
        </div>
      )}

      <input
        ref={input}
        type="file"
        accept="application/pdf,image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          add(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}
