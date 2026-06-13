import { useState } from "react";
import { IconFileText, IconUpload, IconLoader2, IconExternalLink } from "@tabler/icons-react";

import type { UserBenefit } from "../../../../types/benefit";
import { useUploadUserBenefitDeclaration } from "../../../../hooks/personnel-department/use-user-benefits";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileUploadField, FileViewerButton, type FileWithPreview } from "@/components/common/file";
import { cn } from "@/lib/utils";

interface UserBenefitDeclarationCardProps {
  userBenefit: UserBenefit;
  className?: string;
}

export function UserBenefitDeclarationCard({ userBenefit, className }: UserBenefitDeclarationCardProps) {
  const uploadMutation = useUploadUserBenefitDeclaration();
  const [pendingFiles, setPendingFiles] = useState<FileWithPreview[]>([]);

  const declarationFile = userBenefit.declarationFile;

  const handleUpload = async () => {
    const file = pendingFiles[0];
    if (!file) return;

    try {
      await uploadMutation.mutateAsync({ id: userBenefit.id, file });
      setPendingFiles([]);
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== "production") {
        console.error("Error uploading declaration:", error);
      }
    }
  };

  return (
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconFileText className="h-5 w-5 text-muted-foreground" />
          Declaração de opção/renúncia (VT) ou autorização de desconto (convênios)
        </CardTitle>
        <CardDescription>Anexe o documento assinado pelo colaborador. O envio de um novo arquivo substitui o anterior.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {declarationFile && (
          <FileViewerButton
            file={declarationFile}
            className="flex items-center gap-3 w-full rounded-lg border border-border p-3 text-left hover:bg-muted/30 transition-colors"
          >
            <IconFileText className="h-8 w-8 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{declarationFile.filename}</p>
              <p className="text-xs text-muted-foreground">Clique para visualizar</p>
            </div>
            <IconExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
          </FileViewerButton>
        )}

        <FileUploadField
          onFilesChange={setPendingFiles}
          existingFiles={pendingFiles}
          maxFiles={1}
          disabled={uploadMutation.isPending}
          placeholder={declarationFile ? "Selecione um arquivo para substituir a declaração atual" : "Selecione o arquivo da declaração"}
          variant="compact"
        />

        {pendingFiles.length > 0 && (
          <div className="flex justify-end">
            <Button onClick={handleUpload} disabled={uploadMutation.isPending}>
              {uploadMutation.isPending ? <IconLoader2 className="h-4 w-4 mr-2 animate-spin" /> : <IconUpload className="h-4 w-4 mr-2" />}
              Enviar Declaração
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
