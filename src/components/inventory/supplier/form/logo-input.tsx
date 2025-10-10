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
  const [previewFiles, setPreviewFiles] = useState<FileWithPreview[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null); // Store the actual File object

  // Track loaded logo ID to prevent duplicate API calls
  const [loadedLogoId, setLoadedLogoId] = useState<string | null>(null);

  // Load existing logo if logoId is provided (from props or URL) - only for edit mode
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
      form.setValue("logoFile", null);
      setUploadedFile(null);
      setPreviewFiles([]);
      setSelectedFile(null);

      // Remove logoId from URL
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("logoId");
      setSearchParams(newParams);
      return;
    }

    const file = files[0]; // Only handle the first file for logo

    // Store the actual File object (not FileWithPreview) for form submission
    setSelectedFile(file as File);

    // Update form with the file - store it in a hidden field
    form.setValue("logoFile", file, {
      shouldDirty: true,
      shouldValidate: false,
      shouldTouch: false,
    });

    // Clear logoId since we're uploading a new file
    form.setValue("logoId", null);

    // Set preview
    setPreviewFiles([file]);
  };

  const handleFileDelete = async (_file: AnkaaFile) => {
    // Clear UI state immediately for better UX
    form.setValue("logoId", null);
    form.setValue("logoFile", null);
    setUploadedFile(null);
    setPreviewFiles([]);
    setSelectedFile(null);

    // Remove logoId from URL
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("logoId");
    setSearchParams(newParams);

    toast.info("Logo removido");
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
              <FileUploadField
                onFilesChange={handleFilesChange}
                maxFiles={1}
                maxSize={5 * 1024 * 1024} // 5MB
                acceptedFileTypes={{
                  "image/*": [".jpeg", ".jpg", ".png", ".gif", ".svg", ".webp"],
                }}
                disabled={disabled}
                showPreview={true}
                variant="compact"
                placeholder="Clique ou arraste o logo do fornecedor"
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
