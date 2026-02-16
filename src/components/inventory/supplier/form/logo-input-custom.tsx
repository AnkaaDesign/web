import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { FileUploadField, FileItem, FilePreview, type FileWithPreview } from "@/components/common/file";
import { Card } from "@/components/ui/card";
import { fileService } from "../../../../api-client";
import type { File as AnkaaFile } from "../../../../types";
import { useSupplierForm } from "./supplier-form-context";
import { backendFileToFileWithPreview } from "@/lib/utils";
import { getApiBaseUrl } from "@/config/api";

interface LogoInputProps {
  disabled?: boolean;
  existingLogoId?: string | null;
}

export function LogoInput({ disabled, existingLogoId }: LogoInputProps) {
  const { setValue, setError, clearError } = useSupplierForm();
  const [uploadedFile, setUploadedFile] = useState<AnkaaFile | null>(null);
  const [logoFile, setLogoFile] = useState<FileWithPreview | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [loadedLogoId, setLoadedLogoId] = useState<string | null>(null);

  // Load existing logo if logoId is provided
  useEffect(() => {
    const loadExistingLogo = async () => {
      // Only reload if the logoId to load is different from what we currently have loaded
      if (!existingLogoId || existingLogoId === loadedLogoId) {
        return;
      }

      try {
        const response = await fileService.getFileById(existingLogoId);
        if (response.success && response.data) {
          const file = response.data;
          setUploadedFile(file);
          setLoadedLogoId(existingLogoId);
          setValue("logoId", existingLogoId);

          // Convert backend file to FileWithPreview
          const fileWithPreview = backendFileToFileWithPreview(file);
          // Add download URL as preview for images
          fileWithPreview.preview = `${getApiBaseUrl()}/files/${file.id}/download`;
          // Preview is handled by the uploadedFile state
        }
      } catch (error) {
        console.error("Failed to load existing logo:", error);
      }
    };

    loadExistingLogo();
  }, [existingLogoId, loadedLogoId, setValue]);

  const handleFilesChange = (files: FileWithPreview[]) => {
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

    // Store the file in state instead of uploading immediately
    setLogoFile(file);
    // Note: logoFile is not part of the form schema, it's handled separately via FormData
    setValue("logoId", null); // Clear logoId since we have a new file
    setUploadedFile(null); // Clear any previously loaded file
  };

  const handleRemoveFile = () => {
    setValue("logoId", null);
    // Note: logoFile is not part of the form schema
    setUploadedFile(null);
    setLogoFile(null);
  };

  const canRemove = (uploadedFile || logoFile) && !disabled;

  // Determine what to show for the file
  const displayFile = uploadedFile || logoFile;

  return (
    <div className="space-y-2">
      <Label>Logo</Label>

      {!displayFile ? (
        <FileUploadField
          onFilesChange={handleFilesChange}
          disabled={disabled}
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
          {uploadedFile ? (
            <FileItem
              file={uploadedFile}
              onDelete={canRemove ? handleRemoveFile : undefined}
              onPreview={() => setShowPreview(true)}
              showActions={true}
              viewMode="grid"
            />
          ) : logoFile ? (
            <FileUploadField
              onFilesChange={handleFilesChange}
              disabled={disabled}
              existingFiles={[logoFile]}
              acceptedFileTypes={{
                "image/*": [".jpeg", ".jpg", ".png", ".gif", ".svg", ".webp"],
              }}
              maxFiles={1}
              variant="compact"
              showPreview={true}
            />
          ) : null}
        </Card>
      )}

      {showPreview && uploadedFile && <FilePreview files={[uploadedFile]} open={showPreview} onOpenChange={setShowPreview} initialFileIndex={0} />}
    </div>
  );
}
