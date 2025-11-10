import { useState, useCallback } from "react";
import { IconScissors, IconFile, IconUpload } from "@tabler/icons-react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { useController } from "react-hook-form";
import type { TaskCreateFormData, TaskUpdateFormData } from "../../../../schemas";
import { CUT_TYPE_LABELS, CUT_TYPE, CUT_ORIGIN } from "../../../../constants";
import { FileUploadField } from "@/components/common/file";
import type { FileWithPreview } from "@/components/common/file";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CutSelectorProps {
  control: any;
  disabled?: boolean;
}

export function CutSelector({ control, disabled }: CutSelectorProps) {
  const [cutFile, setCutFile] = useState<FileWithPreview[]>([]);

  // Use controller to properly update the form field
  const { field: fileIdField } = useController({
    name: "cut.fileId" as any,
    control,
    defaultValue: "",
  });

  const handleFileUpload = useCallback(
    (files: FileWithPreview[]) => {
      setCutFile(files);

      if (files.length > 0) {
        const file = files[0];
        // Store the file for form submission instead of uploading immediately
        fileIdField.onChange(null); // Clear file ID since we have a new file
        // Store the actual file in a field the form can access
        const form = control._formValues || control._defaultValues;
        if (form) {
          form.cutFile = file; // Store the file for submission
        }
      } else {
        // Clear the file ID when no files
        fileIdField.onChange("");
        const form = control._formValues || control._defaultValues;
        if (form) {
          form.cutFile = null;
        }
      }
    },
    [fileIdField, control],
  );

  return (
    <div className="space-y-4">
      <Alert>
        <IconFile className="h-4 w-4" />
        <AlertDescription>Adicione um arquivo de corte se desejar criar um plano de recorte para esta tarefa. O corte será adicionado à fila de produção.</AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={control}
          name="cut.type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de Corte</FormLabel>
              <FormControl>
                <Combobox
                  value={field.value || CUT_TYPE.VINYL}
                  onValueChange={field.onChange}
                  options={Object.entries(CUT_TYPE_LABELS).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                  placeholder="Selecione o tipo"
                  disabled={disabled}
                  searchable={false}
                  clearable={false}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="cut.quantity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Quantidade</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={field.value || 1}
                  onChange={(value) => {
                    const num = typeof value === "number" ? value : parseInt(String(value), 10);
                    field.onChange(isNaN(num) || num < 1 ? 1 : num);
                  }}
                  disabled={disabled}
                  placeholder="1"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={control}
        name="cut.fileId"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              <IconUpload className="h-4 w-4" />
              Arquivo de Corte
            </FormLabel>
            <FormControl>
              <FileUploadField
                existingFiles={cutFile}
                onFilesChange={handleFileUpload}
                disabled={disabled}
                maxFiles={1}
                showPreview={true}
                variant="compact"
                placeholder="Clique ou arraste um arquivo de corte"
                label="Arquivo selecionado"
                acceptedFileTypes={{
                  "image/*": [".jpg", ".jpeg", ".png", ".svg"],
                  "application/pdf": [".pdf"],
                  "application/vnd.coreldraw": [".cdr"],
                  "application/postscript": [".ai", ".eps"],
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
