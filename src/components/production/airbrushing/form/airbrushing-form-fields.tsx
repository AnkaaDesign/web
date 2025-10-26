import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { FileUploadField, type FileWithPreview } from "@/components/file";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import type { AirbrushingCreateFormData, AirbrushingUpdateFormData } from "../../../../schemas";
import type { FieldErrors } from "react-hook-form";
import { IconPaperclip, IconFileInvoice, IconPhoto } from "@tabler/icons-react";
import { AIRBRUSHING_STATUS, AIRBRUSHING_STATUS_LABELS } from "../../../../constants";

interface AirbrushingFormFieldsProps {
  control: any;
  mode: "create" | "edit";
  receiptFiles: FileWithPreview[];
  nfeFiles: FileWithPreview[];
  artworkFiles: FileWithPreview[];
  onReceiptFilesChange: (files: FileWithPreview[]) => void;
  onNfeFilesChange: (files: FileWithPreview[]) => void;
  onArtworkFilesChange: (files: FileWithPreview[]) => void;
  errors?: FieldErrors<AirbrushingCreateFormData | AirbrushingUpdateFormData>;
}

export function AirbrushingFormFields({
  control,
  mode: _mode,
  receiptFiles,
  nfeFiles,
  artworkFiles,
  onReceiptFilesChange,
  onNfeFilesChange,
  onArtworkFilesChange,
}: AirbrushingFormFieldsProps) {
  const statusOptions: ComboboxOption[] = [
    { value: AIRBRUSHING_STATUS.PENDING, label: AIRBRUSHING_STATUS_LABELS.PENDING },
    { value: AIRBRUSHING_STATUS.IN_PRODUCTION, label: AIRBRUSHING_STATUS_LABELS.IN_PRODUCTION },
    { value: AIRBRUSHING_STATUS.COMPLETED, label: AIRBRUSHING_STATUS_LABELS.COMPLETED },
  ];

  return (
    <div className="space-y-6">
      {/* Price, Status, and Dates Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Price Field */}
        <FormField
          control={control}
          name="price"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Preço do Serviço</FormLabel>
              <FormControl>
                <Input type="currency" value={field.value || undefined} onChange={field.onChange} placeholder="R$ 0,00" className="bg-transparent" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Status Field */}
        <FormField
          control={control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <FormControl>
                <Combobox
                  value={field.value}
                  onValueChange={field.onChange}
                  options={statusOptions}
                  placeholder="Selecione o status"
                  searchable={false}
                  clearable={false}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Start Date Field */}
        <FormField
          control={control}
          name="startDate"
          render={({ field }) => (
            <DateTimeInput
              field={field}
              label="Data de Início"
              mode="date"
              context="start"
              constraints={{
                onlyPast: true,
              }}
            />
          )}
        />

        {/* Finish Date Field */}
        <FormField
          control={control}
          name="finishDate"
          render={({ field }) => (
            <DateTimeInput
              field={field}
              label="Data de Finalização"
              mode="date"
              context="end"
              constraints={{
                onlyPast: true,
              }}
            />
          )}
        />
      </div>

      {/* File Upload Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Receipt Files */}
        <FormItem className="flex flex-col">
          <FormLabel className="flex items-center gap-2">
            <IconPaperclip className="h-4 w-4" />
            Recibos
          </FormLabel>
          <FormControl>
            <FileUploadField
              onFilesChange={onReceiptFilesChange}
              existingFiles={receiptFiles}
              maxFiles={10}
              showPreview={true}
              variant="compact"
              placeholder="Adicione recibos do serviço"
              label="Recibos anexados"
            />
          </FormControl>
        </FormItem>

        {/* NFe Files */}
        <FormItem className="flex flex-col">
          <FormLabel className="flex items-center gap-2">
            <IconFileInvoice className="h-4 w-4" />
            Notas Fiscais
          </FormLabel>
          <FormControl>
            <FileUploadField
              onFilesChange={onNfeFilesChange}
              existingFiles={nfeFiles}
              maxFiles={10}
              showPreview={true}
              variant="compact"
              placeholder="Adicione notas fiscais"
              label="NFes anexadas"
            />
          </FormControl>
        </FormItem>

        {/* Artwork Files */}
        <FormItem className="flex flex-col">
          <FormLabel className="flex items-center gap-2">
            <IconPhoto className="h-4 w-4" />
            Artes da Aerografia
          </FormLabel>
          <FormControl>
            <FileUploadField
              onFilesChange={onArtworkFilesChange}
              existingFiles={artworkFiles}
              maxFiles={20}
              showPreview={true}
              variant="compact"
              placeholder="Adicione as artes da aerografia"
              label="Artes anexadas"
              accept="image/*"
            />
          </FormControl>
        </FormItem>
      </div>
    </div>
  );
}
