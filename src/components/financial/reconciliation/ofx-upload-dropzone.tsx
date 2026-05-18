import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { IconFileSpreadsheet, IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  onFileSelected: (file: File | null) => void;
  selectedFile?: File | null;
  disabled?: boolean;
}

export function OfxUploadDropzone({ onFileSelected, selectedFile, disabled }: Props) {
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (accepted: File[]) => {
      setError(null);
      if (accepted.length === 0) return;
      const file = accepted[0];
      if (file.size > 10 * 1024 * 1024) {
        setError("Arquivo excede o limite de 10 MB");
        return;
      }
      const name = file.name.toLowerCase();
      if (!name.endsWith(".ofx") && !name.endsWith(".qfx")) {
        setError("Apenas arquivos .ofx ou .qfx são aceitos");
        return;
      }
      onFileSelected(file);
    },
    [onFileSelected],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    multiple: false,
    disabled,
    accept: {
      "application/x-ofx": [".ofx", ".qfx"],
      "text/plain": [".ofx", ".qfx"],
    },
  });

  if (selectedFile) {
    return (
      <div className="rounded-lg border border-dashed p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <IconFileSpreadsheet className="h-8 w-8 text-blue-700" />
            <div>
              <p className="font-medium">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Remover arquivo"
            onClick={() => onFileSelected(null)}
            disabled={disabled}
          >
            <IconX className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        {...getRootProps()}
        className={cn(
          "rounded-lg border-2 border-dashed p-12 text-center cursor-pointer transition-colors",
          isDragActive
            ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10"
            : "border-border hover:border-blue-300",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        <input {...getInputProps()} />
        <IconFileSpreadsheet className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
        <p className="font-medium mb-1">
          {isDragActive ? "Solte o arquivo aqui" : "Arraste o arquivo OFX ou clique para selecionar"}
        </p>
        <p className="text-sm text-muted-foreground">
          Exportado do app Sicredi (.ofx ou .qfx, até 10 MB)
        </p>
      </div>
      {error && <p className="text-sm text-destructive mt-2">{error}</p>}
    </div>
  );
}
