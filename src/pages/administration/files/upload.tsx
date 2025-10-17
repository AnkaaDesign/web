import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { FileUploadField } from "@/components/file";
import type { FileWithPreview } from "@/components/file";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Combobox } from "@/components/ui/combobox";
import type { ComboboxOption } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { IconFileText, IconUpload, IconCheck, IconX, IconFolder } from "@tabler/icons-react";
import { toast } from "sonner";
import { uploadSingleFile } from "../../../api-client/file";

// WebDAV Context mapping for display
const WEBDAV_CONTEXT_LABELS: Record<string, string> = {
  tasksArtworks: "Arte de Tarefas",
  taskBudgets: "Orçamentos de Tarefas",
  taskInvoices: "Notas Fiscais de Tarefas",
  taskReceipts: "Comprovantes de Tarefas",
  orderBudgets: "Orçamentos de Pedidos",
  orderInvoices: "Notas Fiscais de Pedidos",
  orderReceipts: "Comprovantes de Pedidos",
  customerLogo: "Logos de Clientes",
  supplierLogo: "Logos de Fornecedores",
  observations: "Observações",
  warning: "Advertências",
  airbrushingInvoices: "Notas Fiscais de Aerografia",
  airbrushingReceipts: "Comprovantes de Aerografia",
  externalWithdrawalInvoices: "Notas Fiscais de Retiradas",
  externalWithdrawalReceipts: "Comprovantes de Retiradas",
  general: "Arquivos Gerais",
  images: "Imagens",
  documents: "Documentos",
  archives: "Arquivos Compactados",
};

export const FileUploadPage = () => {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedContext, setSelectedContext] = useState<string>("general");
  const [entityId, setEntityId] = useState<string>("");
  const [entityType, setEntityType] = useState<string>("");

  const handleFilesChange = (newFiles: FileWithPreview[]) => {
    setFiles(newFiles);
  };

  const handleUpload = async () => {
    const filesToUpload = files.filter((f) => !f.error && !f.uploaded);

    if (filesToUpload.length === 0) {
      toast.error("Nenhum arquivo válido para enviar");
      return;
    }

    setIsUploading(true);

    try {
      // Simulate upload process
      // In a real implementation, you would send files to your API
      for (const file of filesToUpload) {
        // Update progress
        setFiles((prevFiles) => prevFiles.map((f) => (f.id === file.id ? { ...f, uploadProgress: 0 } : f)));

        // Simulate progress updates
        const progressInterval = setInterval(() => {
          setFiles((prevFiles) => {
            const updatedFiles = prevFiles.map((f) => {
              if (f.id === file.id && f.uploadProgress !== undefined && f.uploadProgress < 100) {
                const newProgress = Math.min(f.uploadProgress + Math.random() * 30, 100);
                return { ...f, uploadProgress: newProgress };
              }
              return f;
            });
            return updatedFiles;
          });
        }, 200);

        // Complete upload after 3 seconds
        await new Promise((resolve) => setTimeout(resolve, 3000));
        clearInterval(progressInterval);

        // Mark as uploaded
        setFiles((prevFiles) => prevFiles.map((f) => (f.id === file.id ? { ...f, uploadProgress: 100, uploaded: true } : f)));
      }

      toast.success(`${filesToUpload.length} arquivo(s) enviado(s) com sucesso!`);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Erro durante o upload dos arquivos");
    } finally {
      setIsUploading(false);
    }
  };

  const handleClearAll = () => {
    setFiles([]);
    toast.info("Todos os arquivos foram removidos");
  };

  const uploadedCount = files.filter((f) => f.uploaded).length;
  const errorCount = files.filter((f) => f.error).length;
  const pendingCount = files.filter((f) => !f.uploaded && !f.error).length;

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <div className="max-w-4xl mx-auto">
          <PageHeader
            variant="form"
            title="Upload de Arquivos"
            icon={IconFileText}
            breadcrumbs={[
              { label: "Início", href: "/" },
              { label: "Administração", href: "/administracao" },
              { label: "Arquivos", href: "/administracao/arquivos" },
              { label: "Upload" },
            ]}
          />
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto mt-6">
        <div className="max-w-4xl mx-auto space-y-6 pb-6">
          {/* File Uploader */}
          <Card>
            <CardHeader>
              <CardTitle>Selecionar Arquivos</CardTitle>
              <CardDescription>Escolha os arquivos que deseja enviar. Suporta múltiplos arquivos até 50MB cada.</CardDescription>
            </CardHeader>
            <CardContent>
              <FileUploadField
                onFilesChange={handleFilesChange}
                maxFiles={20}
                maxSize={50 * 1024 * 1024} // 50MB
                disabled={isUploading}
                variant="full"
                placeholder="Arraste arquivos ou clique para selecionar múltiplos arquivos"
                showPreview={true}
              />
            </CardContent>
          </Card>

          {/* Upload Summary */}
          {files.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Resumo do Upload</CardTitle>
                <CardDescription>Status dos arquivos selecionados</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Badge variant="secondary" className="gap-2">
                    <IconFileText className="w-3 h-3" />
                    {files.length} Total
                  </Badge>

                  {pendingCount > 0 && (
                    <Badge variant="outline" className="gap-2">
                      <IconUpload className="w-3 h-3" />
                      {pendingCount} Pendente{pendingCount !== 1 ? "s" : ""}
                    </Badge>
                  )}

                  {uploadedCount > 0 && (
                    <Badge variant="default" className="gap-2 bg-green-500">
                      <IconCheck className="w-3 h-3" />
                      {uploadedCount} Enviado{uploadedCount !== 1 ? "s" : ""}
                    </Badge>
                  )}

                  {errorCount > 0 && (
                    <Badge variant="destructive" className="gap-2">
                      <IconX className="w-3 h-3" />
                      {errorCount} Com Erro
                    </Badge>
                  )}
                </div>

                <Separator />

                <div className="flex justify-between">
                  <Button variant="outline" onClick={handleClearAll} disabled={isUploading}>
                    Limpar Todos
                  </Button>

                  <Button onClick={handleUpload} disabled={pendingCount === 0 || isUploading} className="gap-2">
                    <IconUpload className="w-4 h-4" />
                    {isUploading ? "Enviando..." : `Enviar ${pendingCount} Arquivo${pendingCount !== 1 ? "s" : ""}`}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>Instruções</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  • <strong>Arraste e solte</strong> arquivos na área de upload ou clique para selecionar
                </p>
                <p>
                  • <strong>Múltiplos arquivos</strong> podem ser selecionados simultaneamente
                </p>
                <p>
                  • <strong>Tamanho máximo</strong> por arquivo: 50MB
                </p>
                <p>
                  • <strong>Formatos aceitos</strong>: Imagens, PDFs, documentos do Office, arquivos de texto
                </p>
                <p>
                  • <strong>Pré-visualização</strong> automática para imagens
                </p>
                <p>
                  • <strong>Progresso em tempo real</strong> durante o upload
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
