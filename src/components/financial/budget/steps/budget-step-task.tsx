import { useState, useCallback, useMemo, useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import {
  IconClipboardList,
  IconTruck,
  IconBox,
  IconPalette,
  IconFileText,
  IconPhoto,
  IconUser,
  IconNotes,
  IconInfoCircle,
} from "@tabler/icons-react";
import {
  TRUCK_CATEGORY,
  IMPLEMENT_TYPE,
  TRUCK_CATEGORY_LABELS,
  IMPLEMENT_TYPE_LABELS,
  SERVICE_ORDER_STATUS,
  SERVICE_ORDER_TYPE,
  SECTOR_PRIVILEGES,
} from "@/constants";
import { useAuth } from "@/contexts/auth-context";
import { useAccordionScroll } from "@/lib/scroll-utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { CustomerSelector } from "@/components/production/task/form/customer-selector";
import { PlateTagsInput } from "@/components/production/task/form/plate-tags-input";
import { SerialNumberRangeInput } from "@/components/production/task/form/serial-number-range-input";
import { TaskNameAutocomplete } from "@/components/production/task/form/task-name-autocomplete";
import { ServiceSelectorAutoGrouped } from "@/components/production/task/form/service-selector-auto-grouped";
import { GeneralPaintingSelector } from "@/components/production/task/form/general-painting-selector";
import { ResponsibleManager, validateResponsibleRows } from "@/components/administration/customer/responsible";
import { FileUploadField } from "@/components/common/file";
import { ArtworkFileUploadField } from "@/components/production/task/form/artwork-file-upload-field";
import type { FileWithPreview } from "@/components/common/file";
import type { ResponsibleRowData } from "@/types/responsible";

interface BudgetStepTaskProps {
  disabled?: boolean;
  responsibleRows: ResponsibleRowData[];
  onResponsibleRowsChange: (rows: ResponsibleRowData[]) => void;
  showResponsibleErrors: boolean;
  baseFiles: FileWithPreview[];
  onBaseFilesChange: (files: FileWithPreview[]) => void;
  artworkFiles: FileWithPreview[];
  onArtworkFilesChange: (files: FileWithPreview[]) => void;
  onArtworkStatusChange: (fileId: string, status: string) => void;
}

export function BudgetStepTask({
  disabled,
  responsibleRows,
  onResponsibleRowsChange,
  showResponsibleErrors,
  baseFiles,
  onBaseFilesChange,
  artworkFiles,
  onArtworkFilesChange,
  onArtworkStatusChange,
}: BudgetStepTaskProps) {
  const { user } = useAuth();
  const { control } = useFormContext();

  // Sector-based visibility
  const isCommercialUser = user?.sector?.privileges === SECTOR_PRIVILEGES.COMMERCIAL;
  const isAdminUser = user?.sector?.privileges === SECTOR_PRIVILEGES.ADMIN;

  const showResponsibles = isAdminUser || isCommercialUser;
  const showPaint = isAdminUser || isCommercialUser;
  const showArtworks = isAdminUser || isCommercialUser;

  // Watch form values
  const plates = useWatch({ control, name: "plates" }) || [];
  const serialNumbers = useWatch({ control, name: "serialNumbers" }) || [];
  const customerIdValue = useWatch({ control, name: "customerId" });

  // Accordion state
  const [openAccordion, setOpenAccordion] = useState<string | undefined>("basic-information");
  const { scrollToAccordion } = useAccordionScroll();

  useEffect(() => {
    if (openAccordion) {
      scrollToAccordion(openAccordion);
    }
  }, [openAccordion, scrollToAccordion]);

  // Calculate how many tasks will be created
  const taskCount = useMemo(() => {
    const platesCount = plates.length;
    const serialNumbersCount = serialNumbers.length;
    if (platesCount > 0 && serialNumbersCount > 0) return platesCount * serialNumbersCount;
    if (platesCount > 0) return platesCount;
    if (serialNumbersCount > 0) return serialNumbersCount;
    return 1;
  }, [plates, serialNumbers]);

  return (
    <div className={openAccordion === 'base-files' || openAccordion === 'artworks' ? 'pb-64' : ''}>
      <Accordion
        type="single"
        collapsible
        value={openAccordion}
        onValueChange={setOpenAccordion}
        className="space-y-4"
      >
        {/* 1. Basic Information */}
        <AccordionItem
          value="basic-information"
          id="accordion-item-basic-information"
          className="border border-border rounded-lg"
        >
          <Card className="border-0">
            <AccordionTrigger className="px-0 hover:no-underline">
              <CardHeader className="flex-1 py-4">
                <CardTitle className="flex items-center gap-2">
                  <IconClipboardList className="h-5 w-5" />
                  Informações Básicas
                </CardTitle>
              </CardHeader>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent className="space-y-6 pt-0">
                {/* Name */}
                <TaskNameAutocomplete control={control} disabled={disabled} />

                {/* Customer */}
                <CustomerSelector control={control} disabled={disabled} />

                {/* Truck Category and Implement Type */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={control}
                    name="category"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="flex items-center gap-2">
                          <IconTruck className="h-4 w-4" />
                          Categoria do Caminhão
                        </FormLabel>
                        <Combobox
                          value={field.value || ""}
                          onValueChange={field.onChange}
                          options={[
                            { value: "", label: "Nenhuma" },
                            ...Object.values(TRUCK_CATEGORY).map((cat) => ({
                              value: cat,
                              label: TRUCK_CATEGORY_LABELS[cat],
                            })),
                          ]}
                          placeholder="Selecione a categoria"
                          searchPlaceholder="Buscar categoria..."
                          emptyText="Nenhuma categoria encontrada"
                          disabled={disabled}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={control}
                    name="implementType"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="flex items-center gap-2">
                          <IconBox className="h-4 w-4" />
                          Tipo de Implemento
                        </FormLabel>
                        <Combobox
                          value={field.value || ""}
                          onValueChange={field.onChange}
                          options={[
                            { value: "", label: "Nenhum" },
                            ...Object.values(IMPLEMENT_TYPE).map((type) => ({
                              value: type,
                              label: IMPLEMENT_TYPE_LABELS[type],
                            })),
                          ]}
                          placeholder="Selecione o tipo de implemento"
                          searchPlaceholder="Buscar tipo de implemento..."
                          emptyText="Nenhum tipo de implemento encontrado"
                          disabled={disabled}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Plates + Serial Numbers */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SerialNumberRangeInput
                    control={control}
                    disabled={disabled || plates.length > 1}
                  />
                  <PlateTagsInput
                    control={control}
                    disabled={disabled || serialNumbers.length > 1}
                  />
                </div>

                {/* Task Count Preview */}
                {plates.length > 0 && serialNumbers.length > 0 && taskCount > 1 && (
                  <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-start gap-3">
                      <IconInfoCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                          {taskCount} tarefas serão criadas
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                          {plates.length} {plates.length === 1 ? 'placa' : 'placas'} × {serialNumbers.length} {serialNumbers.length === 1 ? 'número de série' : 'números de série'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Forecast Date + Term */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={control}
                    name="forecastDate"
                    render={({ field }) => (
                      <DateTimeInput
                        {...{ onChange: field.onChange, onBlur: field.onBlur, value: field.value ?? null }}
                        mode="datetime"
                        label="Data de Previsão de Liberação"
                        disabled={disabled}
                      />
                    )}
                  />
                  <FormField
                    control={control}
                    name="term"
                    render={({ field }) => (
                      <DateTimeInput
                        {...{ onChange: field.onChange, onBlur: field.onBlur, value: field.value ?? null }}
                        mode="datetime"
                        label="Prazo de Entrega"
                        disabled={disabled}
                      />
                    )}
                  />
                </div>

                {/* Details */}
                <FormField
                  control={control}
                  name="details"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <IconNotes className="h-4 w-4" />
                        Detalhes
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value)}
                          placeholder="Detalhes adicionais sobre a tarefa..."
                          rows={3}
                          disabled={disabled}
                          className="bg-transparent"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>

        {/* 2. Responsibles - COMMERCIAL/ADMIN only */}
        {showResponsibles && (
          <AccordionItem
            value="responsibles"
            id="accordion-item-responsibles"
            className="border border-border rounded-lg"
          >
            <Card className="border-0">
              <AccordionTrigger className="px-0 hover:no-underline">
                <CardHeader className="flex-1 py-4">
                  <CardTitle className="flex items-center gap-2">
                    <IconUser className="h-5 w-5" />
                    Responsáveis
                  </CardTitle>
                </CardHeader>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="pt-0">
                  <ResponsibleManager
                    companyId={customerIdValue}
                    value={responsibleRows}
                    onChange={onResponsibleRowsChange}
                    disabled={disabled}
                    minRows={0}
                    maxRows={10}
                    control={control}
                    showErrors={showResponsibleErrors}
                  />
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>
        )}

        {/* 3. Service Orders */}
        <AccordionItem
          value="serviceOrders"
          id="accordion-item-serviceOrders"
          className="border border-border rounded-lg"
        >
          <Card className="border-0">
            <AccordionTrigger className="px-0 hover:no-underline">
              <CardHeader className="flex-1 py-4">
                <CardTitle className="flex items-center gap-2">
                  <IconClipboardList className="h-5 w-5" />
                  Serviços
                </CardTitle>
              </CardHeader>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent className="pt-0">
                <FormField
                  control={control}
                  name="serviceOrders"
                  render={() => (
                    <FormItem>
                      <ServiceSelectorAutoGrouped
                        control={control}
                        disabled={disabled}
                        currentUserId={user?.id}
                        userPrivilege={user?.sector?.privileges}
                        isAccordionOpen={openAccordion === "serviceOrders"}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>

        {/* 4. Paint - COMMERCIAL/ADMIN */}
        {showPaint && (
          <AccordionItem
            value="paint"
            id="accordion-item-paint"
            className="border border-border rounded-lg"
          >
            <Card className="border-0">
              <AccordionTrigger className="px-0 hover:no-underline">
                <CardHeader className="flex-1 py-4">
                  <CardTitle className="flex items-center gap-2">
                    <IconPalette className="h-5 w-5" />
                    Tintas
                  </CardTitle>
                </CardHeader>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="space-y-6 pt-0">
                  <GeneralPaintingSelector
                    control={control}
                    disabled={disabled}
                    userPrivilege={user?.sector?.privileges}
                  />
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>
        )}

        {/* 5. Base Files */}
        <AccordionItem
          value="base-files"
          id="accordion-item-base-files"
          className="border border-border rounded-lg"
        >
          <Card className="border-0">
            <AccordionTrigger className="px-0 hover:no-underline">
              <CardHeader className="flex-1 py-4">
                <CardTitle className="flex items-center gap-2">
                  <IconFileText className="h-5 w-5" />
                  Arquivos Base
                </CardTitle>
              </CardHeader>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent className="pt-0">
                <FileUploadField
                  onFilesChange={onBaseFilesChange}
                  maxFiles={30}
                  maxSize={500 * 1024 * 1024}
                  disabled={disabled}
                  showPreview={true}
                  existingFiles={baseFiles}
                  variant="compact"
                  placeholder="Adicione arquivos base para a tarefa (vídeos, imagens, PDFs)"
                  label="Arquivos base anexados"
                  acceptedFileTypes={{
                    "image/*": [".jpeg", ".jpg", ".png", ".gif", ".webp", ".svg"],
                    "application/pdf": [".pdf"],
                    "video/mp4": [".mp4"],
                    "video/quicktime": [".mov"],
                    "video/webm": [".webm"],
                    "video/x-msvideo": [".avi"],
                    "video/x-matroska": [".mkv"],
                    "application/postscript": [".eps", ".ai"],
                  }}
                />
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>

        {/* 6. Artworks - COMMERCIAL/ADMIN */}
        {showArtworks && (
          <AccordionItem
            value="artworks"
            id="accordion-item-artworks"
            className="border border-border rounded-lg"
          >
            <Card className="border-0">
              <AccordionTrigger className="px-0 hover:no-underline">
                <CardHeader className="flex-1 py-4">
                  <CardTitle className="flex items-center gap-2">
                    <IconPhoto className="h-5 w-5" />
                    Layouts
                  </CardTitle>
                </CardHeader>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="pt-0">
                  <ArtworkFileUploadField
                    onFilesChange={onArtworkFilesChange}
                    onStatusChange={onArtworkStatusChange}
                    maxFiles={5}
                    disabled={disabled}
                    showPreview={true}
                    existingFiles={artworkFiles}
                    placeholder="Adicione layouts relacionados à tarefa"
                    label="Layouts anexados"
                  />
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  );
}
