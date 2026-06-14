import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { IconFileText, IconUpload, IconLoader2, IconChevronDown, IconDownload } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import {
  TERMINATION_DOCUMENT_STATUS,
  TERMINATION_DOCUMENT_TYPE_LABELS,
  TERMINATION_DOCUMENT_STATUS_LABELS,
} from "../../../../constants";
import type { Termination, TerminationDocument } from "../../../../types/termination";
import type { File as AnkaaFile } from "../../../../types";
import { useTerminationDocumentUpload, useTerminationDocumentUpdate } from "../../../../hooks/personnel-department/use-terminations";
import { downloadFile, downloadFileInBrowser } from "../../../../api-client";
import { useContext } from "react";
import { FileViewerContext } from "@/components/common/file";

const DOCUMENT_STATUS_BADGE_VARIANTS: Record<TERMINATION_DOCUMENT_STATUS, BadgeProps["variant"]> = {
  [TERMINATION_DOCUMENT_STATUS.PENDING]: "pending",
  [TERMINATION_DOCUMENT_STATUS.GENERATED]: "blue",
  [TERMINATION_DOCUMENT_STATUS.SIGNED]: "purple",
  [TERMINATION_DOCUMENT_STATUS.DELIVERED]: "delivered",
};

interface DocumentsCardProps {
  termination: Termination;
  /** True when the termination is COMPLETED/CANCELLED — blocks every mutation. */
  disabled?: boolean;
  className?: string;
}

export function DocumentsCard({ termination, disabled = false, className }: DocumentsCardProps) {
  const upload = useTerminationDocumentUpload();
  const updateDocument = useTerminationDocumentUpdate();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingUploadDocument, setPendingUploadDocument] = useState<TerminationDocument | null>(null);
  const [updatingDocumentId, setUpdatingDocumentId] = useState<string | null>(null);

  // Unified file viewer (FileViewerProvider wraps the app in App.tsx);
  // useContext keeps this null-safe without violating the rules of hooks.
  const fileViewerContext = useContext(FileViewerContext);

  const documents = termination.documents || [];

  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);

  const handleFileClick = (file: AnkaaFile) => {
    fileViewerContext?.actions.viewFile(file);
  };

  const handleDownload = async (file: AnkaaFile) => {
    try {
      setDownloadingFileId(file.id);
      const blob = await downloadFile(file.id);
      downloadFileInBrowser(blob, file.filename);
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== "production") {
        console.error("Error downloading termination document:", error);
      }
    } finally {
      setDownloadingFileId(null);
    }
  };

  const handleUploadClick = (document: TerminationDocument) => {
    setPendingUploadDocument(document);
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Allow picking the same file again later
    event.target.value = "";
    if (!file || !pendingUploadDocument) return;

    try {
      await upload.mutateAsync({
        id: termination.id,
        data: { type: pendingUploadDocument.type },
        file,
      });
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== "production") {
        console.error("Error uploading termination document:", error);
      }
    } finally {
      setPendingUploadDocument(null);
    }
  };

  const handleStatusChange = async (document: TerminationDocument, status: TERMINATION_DOCUMENT_STATUS) => {
    if (status === document.status) return;
    try {
      setUpdatingDocumentId(document.id);
      await updateDocument.mutateAsync({ documentId: document.id, data: { status } });
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== "production") {
        console.error("Error updating termination document:", error);
      }
    } finally {
      setUpdatingDocumentId(null);
    }
  };

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <IconFileText className="h-5 w-5 text-muted-foreground" />
          Documentos
          {documents.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {documents.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        {/* Hidden file input shared by every row */}
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />

        {documents.length > 0 && (
          <p className="mb-3 text-xs text-muted-foreground">
            O TRCT, a carta de aviso, o termo 484-A e o termo de homologação são gerados automaticamente em PDF ao entrar na etapa de Homologação. Use o botão de
            download para baixar os arquivos gerados.
          </p>
        )}

        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
            <IconFileText className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <div className="text-base font-medium mb-1">Nenhum documento</div>
            <div className="text-sm">O checklist de documentos é criado automaticamente ao cadastrar a rescisão.</div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Documento</TableHead>
                <TableHead className="w-36">Status</TableHead>
                <TableHead className="min-w-[180px]">Arquivo</TableHead>
                <TableHead className="w-36 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((document) => {
                const isUploadingThis = upload.isPending && pendingUploadDocument?.id === document.id;
                const isUpdatingThis = updatingDocumentId === document.id;

                return (
                  <TableRow key={document.id}>
                    <TableCell>
                      <div className="text-sm font-medium">{TERMINATION_DOCUMENT_TYPE_LABELS[document.type] || document.type}</div>
                      {document.note && <div className="text-xs text-muted-foreground mt-0.5">{document.note}</div>}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild disabled={disabled || isUpdatingThis}>
                          <button
                            type="button"
                            className={cn("inline-flex items-center gap-1", (disabled || isUpdatingThis) && "cursor-not-allowed opacity-70")}
                            title={disabled ? "Rescisões concluídas ou canceladas não podem ser alteradas." : "Alterar status do documento"}
                          >
                            <Badge variant={DOCUMENT_STATUS_BADGE_VARIANTS[document.status] || "secondary"} className="text-xs whitespace-nowrap">
                              {TERMINATION_DOCUMENT_STATUS_LABELS[document.status] || document.status}
                            </Badge>
                            {isUpdatingThis ? (
                              <IconLoader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                            ) : (
                              !disabled && <IconChevronDown className="h-3 w-3 text-muted-foreground" />
                            )}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {Object.values(TERMINATION_DOCUMENT_STATUS).map((status) => (
                            <DropdownMenuItem key={status} onClick={() => handleStatusChange(document, status)}>
                              <Badge variant={DOCUMENT_STATUS_BADGE_VARIANTS[status] || "secondary"} className="text-xs">
                                {TERMINATION_DOCUMENT_STATUS_LABELS[status]}
                              </Badge>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    <TableCell>
                      {document.file ? (
                        <button
                          type="button"
                          className="text-sm text-primary hover:underline truncate max-w-[240px] text-left"
                          onClick={() => handleFileClick(document.file!)}
                          title={document.file.filename}
                        >
                          {document.file.filename}
                        </button>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {document.file && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleDownload(document.file!)}
                            disabled={downloadingFileId === document.file.id}
                            title="Baixar documento"
                          >
                            {downloadingFileId === document.file.id ? <IconLoader2 className="h-4 w-4 animate-spin" /> : <IconDownload className="h-4 w-4" />}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUploadClick(document)}
                          disabled={disabled || upload.isPending}
                          title={disabled ? "Rescisões concluídas ou canceladas não podem ser alteradas." : document.file ? "Substituir arquivo" : "Anexar arquivo"}
                        >
                          {isUploadingThis ? <IconLoader2 className="h-4 w-4 mr-2 animate-spin" /> : <IconUpload className="h-4 w-4 mr-2" />}
                          {document.file ? "Substituir" : "Anexar"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
