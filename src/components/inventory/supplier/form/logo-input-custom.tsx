import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Label } from "@/components/ui/label";
import { FileUploadField, FileItem, FilePreview, type FileWithPreview } from "@/components/file";
import { Card } from "@/components/ui/card";
import { fileService } from "../../../../api-client";
import { toast } from "sonner";
import type { File as AnkaaFile } from "../../../../types";
import { useSupplierForm } from "./supplier-form-context";
import { backendFileToFileWithPreview } from "@/lib/utils";

interface LogoInputProps {
  disabled?: boolean;
  existingLogoId?: string | null;
}

export function LogoInput({ disabled, existingLogoId }: LogoInputProps) {
  const { values, setValue, setError, clearError } = useSupplierForm();
  const [searchParams, setSearchParams] = useSearchParams();
  const [uploadedFile, setUploadedFile] = useState<AnkaaFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [_isNewUpload, setIsNewUpload] = useState(false);
  const [loadedLogoId, setLoadedLogoId] = useState<string | null>(null);

  // Load existing logo if logoId is provided
  useEffect(() => {
    const loadExistingLogo = async () => {
      const logoIdFromUrl = searchParams.get("logoId");
      const logoIdToLoad = logoIdFromUrl || existingLogoId;

      // Only reload if the logoId to load is different from what we currently have loaded
      if (!logoIdToLoad || logoIdToLoad === loadedLogoId) {
        return;
      }

      try {
        const response = await fileService.getFileById(logoIdToLoad);
        if (response.success && response.data) {
          const file = response.data;
          setUploadedFile(file);
          setIsNewUpload(false);
          setLoadedLogoId(logoIdToLoad);
          setValue("logoId", logoIdToLoad);

          // Convert backend file to FileWithPreview
          const fileWithPreview = backendFileToFileWithPreview(file);
          // Add download URL as preview for images
          fileWithPreview.preview = `${import.meta.env.VITE_API_URL || "http://localhost:3030"}/files/${file.id}/download`;
          // Preview is handled by the uploadedFile state
        }
      } catch (error) {
        console.error("Failed to load existing logo:", error);
      }
    };

    loadExistingLogo();
  }, [existingLogoId, searchParams, loadedLogoId, setValue]);

  const handleFilesChange = async (files: FileWithPreview[]) => {
    if (files.length === 0) {
      return;
    }

    const file = files[0];
    if (!file || !(file instanceof File)) {
      return;
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
    if (!validTypes.includes(file.type)) {
      setError("logoId", "Tipo de arquivo inválido. Apenas imagens são permitidas.");
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError("logoId", "Arquivo muito grande. Tamanho máximo: 10MB");
      return;
    }

    clearError("logoId");
    setIsUploading(true);

    try {
      // Store current phones value BEFORE upload
      const currentPhones = values.phones; // Upload the file
      const response = await fileService.uploadSingleFile(file as unknown as File);
      if (response && response.data) {
        // Set the uploaded file ID
        setValue("logoId", response.data.id); // CRITICAL: Ensure phones array is preserved
        // React can sometimes cause state issues during async operations
        if (currentPhones && Array.isArray(currentPhones)) {
          setValue("phones", currentPhones);
        } else {
        }

        setUploadedFile(response.data);
        setIsNewUpload(true);
        setLoadedLogoId(response.data.id);

        // Update URL parameter
        const newParams = new URLSearchParams(searchParams);
        newParams.set("logoId", response.data.id);
        setSearchParams(newParams);

        // Preview is handled by the uploadedFile state
        toast.success("Logo enviado com sucesso!");
      }
    } catch (error) {
      console.error("Failed to upload file:", error);
      setError("logoId", "Falha ao enviar arquivo. Tente novamente.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = (_file: AnkaaFile) => {
    setValue("logoId", null);
    setUploadedFile(null);
    // DON'T reset loadedLogoId - keep it to prevent reloading the same logo
    setIsNewUpload(false);

    // Remove from URL parameters
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("logoId");
    setSearchParams(newParams);
  };

  const canRemove = uploadedFile && !disabled;

  return (
    <div className="space-y-2">
      <Label>Logo</Label>

      {!uploadedFile ? (
        <FileUploadField
          onFilesChange={handleFilesChange}
          disabled={disabled || isUploading}
          acceptedFileTypes={{
            "image/*": [".jpeg", ".jpg", ".png", ".gif", ".svg", ".webp"],
          }}
          maxFiles={1}
          variant="compact"
          placeholder="Clique ou arraste o logo do fornecedor"
          showPreview={true}
        />
      ) : (
        <Card className="p-4">
          <FileItem
            file={uploadedFile}
            onDelete={canRemove ? handleRemoveFile : undefined}
            onPreview={(_file: AnkaaFile) => setShowPreview(true)}
            showActions={true}
            viewMode="grid"
          />
        </Card>
      )}

      {showPreview && uploadedFile && <FilePreview files={[uploadedFile]} open={showPreview} onOpenChange={setShowPreview} initialFileIndex={0} />}

      {isUploading && <p className="text-sm text-muted-foreground">Enviando logo...</p>}
    </div>
  );
}
