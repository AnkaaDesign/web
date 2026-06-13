import { useState, useCallback } from "react";
import { IconFileText, IconLoader2 } from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileItem, FileUploadField, useFileViewer, type FileWithPreview } from "@/components/common/file";
import { useUploadMedicalExamDocument } from "@/hooks/occupational-health/use-medical-exams";
import type { MedicalExam } from "@/types/medical-exam";
import type { File as AnkaaFile } from "../../../../types";

interface DocumentCardProps {
  exam: MedicalExam;
  className?: string;
}

export function DocumentCard({ exam, className }: DocumentCardProps) {
  const uploadMutation = useUploadMedicalExamDocument();
  const { actions } = useFileViewer();
  const [pendingFiles, setPendingFiles] = useState<FileWithPreview[]>([]);

  const handleFileClick = useCallback(
    (file: AnkaaFile) => {
      actions.viewFiles([file], 0);
    },
    [actions],
  );

  const handleFilesChange = useCallback(
    async (files: FileWithPreview[]) => {
      setPendingFiles(files);

      // Upload the newly added file (single document per exam)
      const newFile = files.find((file) => !file.uploaded && !file.uploadedFileId);
      if (!newFile || uploadMutation.isPending) return;

      try {
        await uploadMutation.mutateAsync({ id: exam.id, file: newFile });
        setPendingFiles([]);
      } catch (error) {
        // Error is handled by the API client with detailed message
        setPendingFiles([]);
        if (process.env.NODE_ENV !== "production") {
          console.error("Error uploading medical exam document:", error);
        }
      }
    },
    [exam.id, uploadMutation],
  );

  return (
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconFileText className="h-5 w-5 text-muted-foreground" />
          Documento (ASO)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {exam.file ? (
          <div className="grid grid-cols-1 gap-2">
            <FileItem file={exam.file} viewMode="list" onPreview={handleFileClick} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum documento anexado.</p>
        )}

        <div>
          <FileUploadField
            onFilesChange={handleFilesChange}
            maxFiles={1}
            existingFiles={pendingFiles}
            disabled={uploadMutation.isPending}
            variant="compact"
            showPreview={false}
            placeholder={exam.file ? "Substituir documento do exame" : "Anexar documento do exame"}
            label="Enviar documento"
          />
          {uploadMutation.isPending && (
            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
              <IconLoader2 className="h-4 w-4 animate-spin" />
              Enviando documento...
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
