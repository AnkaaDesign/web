import { useState, useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FileUploadField, type FileWithPreview } from "@/components/common/file";
import { fileService } from "../../../../api-client";
import type { File as AnkaaFile } from "../../../../types";
import { backendFileToFileWithPreview } from "@/lib/utils";
import { normalizeThumbnailUrl, getFileUrl } from "@/utils/file";

interface AvatarInputProps {
  disabled?: boolean;
  existingAvatarId?: string | null;
  onFileChange?: (file: FileWithPreview | null) => void;
}

export function AvatarInput({ disabled, existingAvatarId, onFileChange }: AvatarInputProps) {
  const form = useFormContext();
  const [previewFiles, setPreviewFiles] = useState<FileWithPreview[]>([]);
  const [_existingAvatar, setExistingAvatar] = useState<AnkaaFile | null>(null);

  // Load existing avatar if avatarId is provided
  useEffect(() => {
    const loadExistingAvatar = async () => {
      if (!existingAvatarId) {
        setExistingAvatar(null);
        setPreviewFiles([]);
        return;
      }

      try {
        const response = await fileService.getFileById(existingAvatarId);
        if (response.success && response.data) {
          const file = response.data;
          setExistingAvatar(file);

          // Create a preview file for the file uploader
          const previewFile = backendFileToFileWithPreview(file);
          previewFile.preview = normalizeThumbnailUrl(file.thumbnailUrl) || getFileUrl(file);
          previewFile.uploaded = true; // Mark as already uploaded (existing file)
          setPreviewFiles([previewFile]);
        }
      } catch (error) {
        console.error("Error loading existing avatar:", error);
        setExistingAvatar(null);
        setPreviewFiles([]);
      }
    };

    loadExistingAvatar();
  }, [existingAvatarId]);

  const handleFilesChange = (files: FileWithPreview[]) => {
    if (files.length === 0) {
      // Clear the avatar if no files selected
      form.setValue("avatarId", null, { shouldDirty: true, shouldTouch: true });
      form.setValue("avatarFile", null, { shouldDirty: true, shouldTouch: true });
      setPreviewFiles([]);
      if (onFileChange) {
        onFileChange(null);
      }
      return;
    }

    const file = files[0]; // Only handle the first file for avatar

    // Set the file in the form for submission with the form data
    // We store both the file and clear the avatarId (since we're replacing with a new file)
    // IMPORTANT: Mark form as dirty when file changes to enable submit button
    form.setValue("avatarFile", file, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
    form.setValue("avatarId", null, { shouldDirty: true, shouldTouch: true }); // Clear existing avatar ID when new file is selected

    // Update preview
    setPreviewFiles([file]);

    if (onFileChange) {
      onFileChange(file);
    }
  };

  return (
    <FormField
      control={form.control}
      name="avatarFile"
      render={() => (
        <FormItem>
          <FormLabel>Foto do Colaborador</FormLabel>
          <FormControl>
            <FileUploadField
              onFilesChange={handleFilesChange}
              maxFiles={1}
              maxSize={5 * 1024 * 1024} // 5MB
              acceptedFileTypes={{
                "image/*": [".jpeg", ".jpg", ".png", ".gif", ".webp"],
              }}
              disabled={disabled}
              showPreview={true}
              variant="compact"
              placeholder="Clique ou arraste a foto do colaborador"
              existingFiles={previewFiles}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
