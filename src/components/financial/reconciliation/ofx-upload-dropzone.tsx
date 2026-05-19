import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { IconFileSpreadsheet, IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  onFilesSelected: (files: File[]) => void;
  selectedFiles?: File[];
  disabled?: boolean;
}

export function OfxUploadDropzone({ onFilesSelected, selectedFiles = [], disabled }: Props) {
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (accepted: File[]) => {
      setError(null);
      const valid: File[] = [];
      for (const f of accepted) {
        const lower = f.name.toLowerCase();
        const isZip = lower.endsWith(".zip");
        const isOfx = lower.endsWith(".ofx") || lower.endsWith(".qfx");
        const sizeLimit = isZip ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
        if (f.size > sizeLimit) {
          setError(`"${f.name}" excede ${isZip ? "100" : "10"} MB`);
          continue;
        }
        if (!isZip && !isOfx) {
          setError(`"${f.name}" não é .ofx, .qfx ou .zip`);
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
      "application/x-ofx": [".ofx", ".qfx"],
      "text/plain": [".ofx", ".qfx"],
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
        <IconFileSpreadsheet className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
        <p className="font-medium mb-1">
          {isDragActive
            ? "Solte os arquivos aqui"
            : "Arraste OFX/QFX ou ZIP, ou clique para selecionar"}
        </p>
        <p className="text-sm text-muted-foreground">
          Extratos exportados do Sicredi (.ofx/.qfx até 10 MB cada, ou .zip até 100 MB)
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
