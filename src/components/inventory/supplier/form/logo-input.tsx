import { useState, useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FileUploadField, FileItem, FilePreview, type FileWithPreview } from "@/components/file";
import { fileService } from "../../../../api-client";
import { toast } from "sonner";
import type { File as AnkaaFile } from "../../../../types";
import { backendFileToFileWithPreview } from "@/lib/utils";

interface LogoInputProps {
  disabled?: boolean;
  existingLogoId?: string | null;
}

export function LogoInput({ disabled, existingLogoId }: LogoInputProps) {
  const form = useFormContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const [uploadedFile, setUploadedFile] = useState<AnkaaFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewFiles, setPreviewFiles] = useState<FileWithPreview[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isNewUpload, setIsNewUpload] = useState(false); // Track if this is a newly uploaded file

  // Track loaded logo ID to prevent duplicate API calls
  const [loadedLogoId, setLoadedLogoId] = useState<string | null>(null);
  // Track if user explicitly deleted the logo to prevent reload
  const [userDeletedLogo, setUserDeletedLogo] = useState(false);

  // Load existing logo if logoId is provided (from props or URL)
  useEffect(() => {
    const loadExistingLogo = async () => {
      // Check URL parameter first, then fallback to existingLogoId
      const logoIdFromUrl = searchParams.get("logoId");
      const logoIdToLoad = logoIdFromUrl || existingLogoId;

      // CRITICAL: Skip if we already loaded this logo ID to prevent infinite requests
      // Also skip if user explicitly deleted the logo
      if (!logoIdToLoad || logoIdToLoad === loadedLogoId || userDeletedLogo) {
        return;
      }

      try {
        const response = await fileService.getFileById(logoIdToLoad);
        if (response.success && response.data) {
          const file = response.data;
          setUploadedFile(file);
          setIsNewUpload(false); // This is an existing _file, not a new upload
          setLoadedLogoId(logoIdToLoad); // Mark this logo as loaded

          // Update form with logoId from URL if it came from URL (but don't trigger re-render or validation)
          if (logoIdFromUrl && logoIdFromUrl !== existingLogoId) {
            form.setValue("logoId", logoIdFromUrl, {
              shouldDirty: false, // Don't mark as dirty for existing logos
              shouldValidate: false, // Don't validate other fields
              shouldTouch: false, // Don't mark as touched
            });
          }

          // Create a preview file for the file uploader
          const previewFile = backendFileToFileWithPreview(file);
          // Override preview URL for direct serving
          previewFile.preview = file.thumbnailUrl || `${(window as any).__ANKAA_API_URL__ || import.meta.env.VITE_API_URL || "http://localhost:3030"}/api/files/serve/${file.id}`;
          setPreviewFiles([previewFile]);
        }
      } catch (error) {
        setLoadedLogoId(null); // Reset loaded ID on error
        // Remove invalid logoId from URL if it failed to load
        if (logoIdFromUrl) {
          const newParams = new URLSearchParams(searchParams);
          newParams.delete("logoId");
          setSearchParams(newParams);
        }
      }
    };

    loadExistingLogo();
  }, [existingLogoId, searchParams, setSearchParams, form, loadedLogoId]);

  const handleFilesChange = async (files: FileWithPreview[]) => {
    if (files.length === 0) {
      // Clear the logo if no files selected
      form.setValue("logoId", null);
      setUploadedFile(null);
      setPreviewFiles([]);
      setIsNewUpload(false);
      setLoadedLogoId(null); // Reset loaded logo ID

      // Remove logoId from URL
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("logoId");
      setSearchParams(newParams);
      return;
    }

    // Reset the deleted flag when user uploads a new file
    setUserDeletedLogo(false);

    const file = files[0]; // Only handle the first file for logo

    if (!file.uploaded) {
      // Upload the file
      setIsUploading(true);
      try {
        // Upload the file with supplier logo context
        const response = await fileService.uploadSingleFile(file as unknown as File, {
          fileContext: "supplierLogo",
          entityType: "supplier",
        });

        if (response && response.data) {
          // Set the uploaded file ID in the form with dirty flag but preserve other form state
          // CRITICAL: Only update logoId _field, don't trigger full form revalidation
          form.setValue("logoId", response.data.id, {
            shouldDirty: true, // Mark as dirty to indicate changes
            shouldValidate: false, // Don't validate other fields
            shouldTouch: false, // Don't mark as touched to avoid triggering resets
          });

          setUploadedFile(response.data);
          setIsNewUpload(true); // Mark this as a newly uploaded file
          setLoadedLogoId(response.data.id); // Mark as loaded to prevent re-fetch

          // Update URL parameter to persist logo ID
          const newParams = new URLSearchParams(searchParams);
          newParams.set("logoId", response.data.id);
          setSearchParams(newParams);

          // Update preview with uploaded status
          const updatedFile: FileWithPreview = {
            ...file,
            id: response.data.id,
            uploaded: true,
            preview:
              response.data.thumbnailUrl || `${(window as any).__ANKAA_API_URL__ || import.meta.env.VITE_API_URL || "http://localhost:3030"}/api/files/serve/${response.data.id}`,
          };
          setPreviewFiles([updatedFile]);
        }
      } catch (error) {
        toast.error("Erro ao enviar o logo. Tente novamente.");
        // Remove the file from preview on error
        setPreviewFiles([]);
      } finally {
        setIsUploading(false);
      }
    } else {
      // File is already uploaded (when editing)
      setPreviewFiles(files);
    }
  };

  const handleFileDelete = async (_file: AnkaaFile) => {
    const fileToDelete = uploadedFile;
    const shouldDeleteFromServer = isNewUpload; // Only delete from server if it's a new upload

    // Clear UI state immediately for better UX
    form.setValue("logoId", null);
    setUploadedFile(null);
    setPreviewFiles([]);
    setIsNewUpload(false);
    setLoadedLogoId(null); // Reset loaded logo ID
    setUserDeletedLogo(true); // Mark that user explicitly deleted the logo

    // Remove logoId from URL
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("logoId");
    setSearchParams(newParams);

    // Only delete from server if this was a newly uploaded file in this session
    if (shouldDeleteFromServer && fileToDelete?.id) {
      try {
        await fileService.deleteFile(fileToDelete.id);
        // Don't show any toast here - the API client will show "Excluído com sucesso"
        // which is already confusing enough for users
      } catch (error) {
        // Don't show error toast as the UI state was already cleared
        // The file will be orphaned but can be cleaned up later
      }
    } else {
      // For existing logos, just remove the reference
      // Use a more user-friendly message
      toast.info("Logo desmarcado do fornecedor");
    }
  };

  const handleFilePreview = (_file: AnkaaFile) => {
    setShowPreview(true);
  };

  return (
    <>
      <FormField
        control={form.control}
        name="logoId"
        render={() => (
          <FormItem>
            <FormLabel>Logo do Fornecedor</FormLabel>
            <FormControl>
              <div className="space-y-4">
                {previewFiles.length === 0 ? (
                  <FileUploadField
                    onFilesChange={handleFilesChange}
                    maxFiles={1}
                    maxSize={5 * 1024 * 1024} // 5MB
                    acceptedFileTypes={{
                      "image/*": [".jpeg", ".jpg", ".png", ".gif", ".svg", ".webp"],
                    }}
                    disabled={disabled || isUploading}
                    showPreview={true}
                    variant="compact"
                    placeholder="Clique ou arraste o logo do fornecedor"
                  />
                ) : (
                  <FileItem
                    file={{
                      id: uploadedFile?.id || previewFiles[0].id,
                      filename: uploadedFile?.filename || previewFiles[0].name,
                      originalName: uploadedFile?.originalName || previewFiles[0].name,
                      mimetype: uploadedFile?.mimetype || previewFiles[0].type,
                      size: uploadedFile?.size || previewFiles[0].size,
                      path: uploadedFile?.path || "",
                      thumbnailUrl: uploadedFile?.thumbnailUrl || null,
                      createdAt: uploadedFile?.createdAt || new Date(),
                      updatedAt: uploadedFile?.updatedAt || new Date(),
                    }}
                    viewMode="grid"
                    onPreview={handleFilePreview}
                    onDelete={!disabled && !isUploading ? handleFileDelete : undefined}
                    showActions={!disabled && !isUploading}
                  />
                )}
                {isUploading && <p className="text-sm text-muted-foreground">Enviando logo...</p>}
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* File Preview Modal */}
      {uploadedFile && <FilePreview files={[uploadedFile]} open={showPreview} onOpenChange={setShowPreview} initialFileIndex={0} />}
    </>
  );
}
