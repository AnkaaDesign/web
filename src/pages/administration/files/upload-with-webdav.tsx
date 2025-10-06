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
  taskNfes: "Notas Fiscais de Tarefas",
  taskReceipts: "Comprovantes de Tarefas",
  orderBudgets: "Orçamentos de Pedidos",
  orderNfes: "Notas Fiscais de Pedidos",
  orderReceipts: "Comprovantes de Pedidos",
  customerLogo: "Logos de Clientes",
  supplierLogo: "Logos de Fornecedores",
  observations: "Observações",
  warning: "Advertências",
  airbrushingNfes: "Notas Fiscais de Aerografia",
  airbrushingReceipts: "Comprovantes de Aerografia",
  externalWithdrawalNfes: "Notas Fiscais de Retiradas",
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

    let successCount = 0;
    let errorCount = 0;

    try {
      for (const fileWithPreview of filesToUpload) {
        // Update progress to 0%
        setFiles((prevFiles) => prevFiles.map((f) => (f.id === fileWithPreview.id ? { ...f, uploadProgress: 0 } : f)));

        try {
          // Create a proper File object for upload
          const file = new File([fileWithPreview], fileWithPreview.name, {
            type: fileWithPreview.type,
            lastModified: fileWithPreview.lastModified,
          });

          // Prepare WebDAV context parameters
          const uploadOptions = {
            onProgress: (progress: any) => {
              setFiles((prevFiles) => prevFiles.map((f) => (f.id === fileWithPreview.id ? { ...f, uploadProgress: progress.percentage } : f)));
            },
            // WebDAV context parameters
            fileContext: selectedContext,
            entityId: entityId || undefined,
            entityType: entityType || undefined,
          };
          const result = await uploadSingleFile(file, uploadOptions);

          // Mark as uploaded with response data
          setFiles((prevFiles) =>
            prevFiles.map((f) =>
              f.id === fileWithPreview.id
                ? {
                    ...f,
                    uploadProgress: 100,
                    uploaded: true,
                    uploadedFileId: result.data?.id,
                    thumbnailUrl: result.data?.thumbnailUrl,
                  }
                : f,
            ),
          );

          successCount++;
        } catch (error: any) {
          console.error(`Upload failed for ${fileWithPreview.name}:`, error);
          errorCount++;

          // Mark file as failed
          setFiles((prevFiles) =>
            prevFiles.map((f) =>
              f.id === fileWithPreview.id
                ? {
                    ...f,
                    error: error.message || "Erro durante o upload",
                    uploadProgress: undefined,
                  }
                : f,
            ),
          );
        }
      }

      // Show summary messages
      if (successCount > 0) {
        toast.success(`${successCount} arquivo(s) enviado(s) com sucesso para ${WEBDAV_CONTEXT_LABELS[selectedContext]}!`);
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} arquivo(s) falharam no upload.`);
      }
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
          {/* WebDAV Context Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconFolder className="w-5 h-5" />
                Organização de Arquivos
              </CardTitle>
              <CardDescription>Selecione onde os arquivos devem ser armazenados na estrutura WebDAV</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="context-select">Pasta de Destino</Label>
                  <Combobox
                    value={selectedContext}
                    onValueChange={(value) => setSelectedContext(value || "general")}
                    options={Object.entries(WEBDAV_CONTEXT_LABELS).map(([key, label]) => ({
                      value: key,
                      label: label,
                    }))}
                    placeholder="Selecione uma pasta"
                    searchable={false}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="entity-id">ID da Entidade (Opcional)</Label>
                  <input
                    id="entity-id"
                    type="text"
                    value={entityId}
                    onChange={(e) => setEntityId(e.target.value)}
                    placeholder="ID para organizar por entidade"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* File Uploader */}
          <Card>
            <CardHeader>
              <CardTitle>Selecionar Arquivos</CardTitle>
              <CardDescription>Escolha os arquivos que deseja enviar. Suporta múltiplos arquivos até 500MB cada.</CardDescription>
            </CardHeader>
            <CardContent>
              <FileUploadField
                onFilesChange={handleFilesChange}
                maxFiles={20}
                maxSize={500 * 1024 * 1024} // 500MB
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

                {/* WebDAV Context Info */}
                {selectedContext && (
                  <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      <IconFolder className="w-4 h-4" />
                      <span className="font-medium">Destino:</span>
                      <span>{WEBDAV_CONTEXT_LABELS[selectedContext]}</span>
                      {entityId && (
                        <>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-xs">ID: {entityId}</span>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Enhanced Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>Instruções</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  • <strong>Organização WebDAV</strong>: Os arquivos serão organizados automaticamente na estrutura de pastas do servidor WebDAV
                </p>
                <p>
                  • <strong>Contexto de arquivo</strong>: Selecione o tipo de arquivo para roteamento automático para a pasta correta
                </p>
                <p>
                  • <strong>ID da Entidade</strong>: Use para organizar arquivos por entidade específica (tarefa, pedido, etc.)
                </p>
                <p>
                  • <strong>Arraste e solte</strong> arquivos na área de upload ou clique para selecionar
                </p>
                <p>
                  • <strong>Múltiplos arquivos</strong> podem ser selecionados simultaneamente
                </p>
                <p>
                  • <strong>Tamanho máximo</strong> por arquivo: 500MB
                </p>
                <p>
                  • <strong>Formatos aceitos</strong>: Imagens, PDFs, documentos, arquivos CAD (EPS, CDR, DXF)
                </p>
                <p>
                  • <strong>Pré-visualização</strong> automática para imagens e geração de thumbnail para PDFs/EPS
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
