import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { IconFileText, IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  onFilesSelected: (files: File[]) => void;
  selectedFiles?: File[];
  disabled?: boolean;
}

export function XmlUploadDropzone({ onFilesSelected, selectedFiles = [], disabled }: Props) {
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (accepted: File[]) => {
      setError(null);
      const valid: File[] = [];
      for (const f of accepted) {
        if (f.size > 100 * 1024 * 1024) {
          setError(`"${f.name}" excede 100 MB`);
          continue;
        }
        const n = f.name.toLowerCase();
        if (!n.endsWith(".xml") && !n.endsWith(".zip")) {
          setError(`"${f.name}" não é .xml ou .zip`);
          continue;
        }
        valid.push(f);
      }
      if (valid.length > 0) {
        onFilesSelected([...selectedFiles, ...valid]);
      }
    },
    [onFilesSelected, selectedFiles],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 30,
    multiple: true,
    disabled,
    maxSize: 100 * 1024 * 1024,
    accept: {
      "application/xml": [".xml"],
      "text/xml": [".xml"],
      "application/zip": [".zip"],
      "application/x-zip-compressed": [".zip"],
    },
  });

  const removeFile = (idx: number) =>
    onFilesSelected(selectedFiles.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={cn(
          "rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors",
          isDragActive
            ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10"
            : "border-border hover:border-blue-300",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        <input {...getInputProps()} />
        <IconFileText className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
        <p className="font-medium mb-1">
          {isDragActive
            ? "Solte os arquivos aqui"
            : "Arraste XMLs ou ZIP, ou clique para selecionar"}
        </p>
        <p className="text-sm text-muted-foreground">
          NF-e, NFS-e, CT-e ou NFC-e (.xml ou .zip, até 100 MB cada)
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {selectedFiles.length > 0 && (
        <ul className="space-y-1 text-sm">
          {selectedFiles.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between">
              <span className="truncate max-w-md">{f.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Remover ${f.name}`}
                onClick={() => removeFile(i)}
                disabled={disabled}
              >
                <IconX className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
