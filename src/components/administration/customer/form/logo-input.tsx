import { useState, useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FileUploadField, FileItem, FilePreview, type FileWithPreview } from "@/components/file";
import { fileService } from "../../../../api-client";
import { toast } from "sonner";
import type { File as AnkaaFile } from "../../../../types";
import { backendFileToFileWithPreview } from "@/lib/utils";
import { normalizeThumbnailUrl, getFileUrl } from "@/utils/file";

interface LogoInputProps {
  disabled?: boolean;
  existingLogoId?: string | null;
}

export function LogoInput({ disabled, existingLogoId }: LogoInputProps) {
  const form = useFormContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const [uploadedFile, setUploadedFile] = useState<AnkaaFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [previewFiles, setPreviewFiles] = useState<FileWithPreview[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isNewUpload, setIsNewUpload] = useState(false); // Track if this is a newly uploaded file

  // Track loaded logo ID to prevent duplicate API calls
  const [loadedLogoId, setLoadedLogoId] = useState<string | null>(null);

  // Load existing logo if logoId is provided (from props or URL)
  useEffect(() => {
    const loadExistingLogo = async () => {
      // Check URL parameter first, then fallback to existingLogoId
      const logoIdFromUrl = searchParams.get("logoId");
      const logoIdToLoad = logoIdFromUrl || existingLogoId;

      // CRITICAL: Skip if we already loaded this logo ID to prevent infinite requests
      // Only reload if the logoId to load is different from what we currently have loaded
      if (!logoIdToLoad || logoIdToLoad === loadedLogoId) {
        return;
      }

      try {
        const response = await fileService.getFileById(logoIdToLoad);
        if (response.success && response.data) {
          const file = response.data;
          setUploadedFile(file);
          setIsNewUpload(false); // This is an existing file, not a new upload
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
          previewFile.preview = normalizeThumbnailUrl(file.thumbnailUrl) || getFileUrl(file);
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
      // DON'T reset loadedLogoId - keep it to prevent reloading

      // Remove logoId from URL
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("logoId");
      setSearchParams(newParams);
      return;
    }

    const file = files[0]; // Only handle the first file for logo

    if (!file.uploaded) {
      // Upload the file
      setIsUploading(true);
      setUploadProgress(0);

      // Set initial file state with progress
      setPreviewFiles([Object.assign(file, { uploadProgress: 0, uploaded: false })]);

      try {
        // Upload the file with customer logo context and progress tracking
        const response = await fileService.uploadSingleFile(file as File, {
          fileContext: "customerLogo",
          entityType: "customer",
          onProgress: (progress) => {
            setUploadProgress(progress.percentage);
            // Update file with progress using Object.assign to preserve File properties
            setPreviewFiles((prev) => prev.map(f =>
              f.id === file.id ? Object.assign(f, { uploadProgress: progress.percentage }) : f
            ));
          },
        });

        if (response && response.data) {
          // Set the uploaded file ID in the form with dirty flag but preserve other form state
          // CRITICAL: Only update logoId field, don't trigger full form revalidation
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

          // Update preview with uploaded status using Object.assign
          setPreviewFiles((prev) => prev.map(f =>
            f.id === file.id ? Object.assign(f, {
              id: response.data.id,
              uploaded: true,
              uploadProgress: 100,
              preview: normalizeThumbnailUrl(response.data.thumbnailUrl) || getFileUrl(response.data),
            }) : f
          ));
        }
      } catch (error) {
        toast.error("Erro ao enviar o logo. Tente novamente.");
        // Remove the file from preview on error
        setPreviewFiles([]);
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
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
    // DON'T reset loadedLogoId - keep it to prevent reloading the same logo

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
      toast.info("Logo desmarcado do cliente");
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
            <FormLabel>Logo do Cliente</FormLabel>
            <FormControl>
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
                placeholder="Clique ou arraste o logo do cliente"
                existingFiles={previewFiles}
              />
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
