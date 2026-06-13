import { useState } from "react";
import { IconPaperclip, IconLoader2 } from "@tabler/icons-react";

import type { Leave } from "../../../../types/leave";
import type { File as AnkaaFile } from "../../../../types";
import { useUploadLeaveFiles } from "../../../../hooks/occupational-health/use-leaves";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FileItem, FileUploadField, useFileViewer, type FileWithPreview } from "@/components/common/file";

interface LeaveFilesCardProps {
  leave: Leave;
  className?: string;
}

export function LeaveFilesCard({ leave, className }: LeaveFilesCardProps) {
  const { actions } = useFileViewer();
  const uploadFiles = useUploadLeaveFiles();
  const [pendingFiles, setPendingFiles] = useState<FileWithPreview[]>([]);

  const files = leave.files || [];

  const handleFileClick = (file: AnkaaFile) => {
    const index = files.findIndex((f) => f.id === file.id);
    actions.viewFiles(files, index >= 0 ? index : 0);
  };

  const handleFilesChange = async (selected: FileWithPreview[]) => {
    setPendingFiles(selected);

    const newFiles = selected.filter((f) => !(f as any).uploaded && f instanceof File);
    if (newFiles.length === 0) return;

    try {
      await uploadFiles.mutateAsync({
        id: leave.id,
        files: newFiles,
        include: { user: true, files: true },
      });
      // Query invalidation refreshes leave.files; clear the picker
      setPendingFiles([]);
    } catch (error) {
      // Error toast is handled by the API client
      if (process.env.NODE_ENV !== "production") {
        console.error("Error uploading leave files:", error);
      }
    }
  };

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconPaperclip className="h-5 w-5 text-muted-foreground" />
            Arquivos
          </div>
          {files.length > 0 && (
            <Badge variant="secondary">
              {files.length} arquivo{files.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        {files.length > 0 ? (
          <div className="grid grid-cols-1 gap-2">
            {files.map((file) => (
              <FileItem key={file.id} file={file} viewMode="list" onPreview={handleFileClick} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum arquivo anexado (atestados, laudos etc.).</p>
        )}

        <div>
          <label className="text-sm font-medium mb-2 flex items-center gap-2">
            Adicionar Arquivos
            {uploadFiles.isPending && <IconLoader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </label>
          <FileUploadField
            onFilesChange={handleFilesChange}
            existingFiles={pendingFiles}
            maxFiles={10}
            disabled={uploadFiles.isPending}
            showPreview
            variant="compact"
            placeholder="Anexe atestados e documentos (até 10 arquivos)"
          />
        </div>
      </CardContent>
    </Card>
  );
}
