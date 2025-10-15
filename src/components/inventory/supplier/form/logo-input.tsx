import { useState, useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FileUploadField, type FileWithPreview } from "@/components/file";
import { fileService } from "../../../../api-client";
import type { File as AnkaaFile } from "../../../../types";
import { backendFileToFileWithPreview } from "@/lib/utils";
import { normalizeThumbnailUrl, getFileUrl } from "@/utils/file";

interface LogoInputProps {
  disabled?: boolean;
  existingLogoId?: string | null;
  onFileChange?: (file: FileWithPreview | null) => void;
}

export function LogoInput({ disabled, existingLogoId, onFileChange }: LogoInputProps) {
  const form = useFormContext();
  const [previewFiles, setPreviewFiles] = useState<FileWithPreview[]>([]);
  const [existingLogo, setExistingLogo] = useState<AnkaaFile | null>(null);

  // Load existing logo if logoId is provided
  useEffect(() => {
    const loadExistingLogo = async () => {
      if (!existingLogoId) {
        setExistingLogo(null);
        setPreviewFiles([]);
        return;
      }

      try {
        const response = await fileService.getFileById(existingLogoId);
        if (response.success && response.data) {
          const file = response.data;
          setExistingLogo(file);

          // Create a preview file for the file uploader
          const previewFile = backendFileToFileWithPreview(file);
          previewFile.preview = normalizeThumbnailUrl(file.thumbnailUrl) || getFileUrl(file);
          previewFile.uploaded = true; // Mark as already uploaded (existing file)
          setPreviewFiles([previewFile]);
        }
      } catch (error) {
        console.error("Error loading existing logo:", error);
        setExistingLogo(null);
        setPreviewFiles([]);
      }
    };

    loadExistingLogo();
  }, [existingLogoId]);

  const handleFilesChange = (files: FileWithPreview[]) => {
    if (files.length === 0) {
      // Clear the logo if no files selected
      form.setValue("logoId", null, { shouldDirty: true, shouldTouch: true });
      form.setValue("logoFile", null, { shouldDirty: true, shouldTouch: true });
      setPreviewFiles([]);
      if (onFileChange) {
        onFileChange(null);
      }
      return;
    }

    const file = files[0]; // Only handle the first file for logo

    // Set the file in the form for submission with the form data
    // We store both the file and clear the logoId (since we're replacing with a new file)
    // IMPORTANT: Mark form as dirty when file changes to enable submit button
    form.setValue("logoFile", file, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
    form.setValue("logoId", null, { shouldDirty: true, shouldTouch: true }); // Clear existing logo ID when new file is selected

    // Update preview
    setPreviewFiles([file]);

    if (onFileChange) {
      onFileChange(file);
    }
  };

  return (
    <FormField
      control={form.control}
      name="logoFile"
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
  );
}