import { useState, useMemo, useEffect } from "react";
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
  IconHash,
  IconId,
  IconSparkles,
  IconExternalLink,
} from "@tabler/icons-react";
import {
  TRUCK_CATEGORY,
  IMPLEMENT_TYPE,
  TRUCK_CATEGORY_LABELS,
  IMPLEMENT_TYPE_LABELS,
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
import { GeneralPaintingSelector } from "@/components/production/task/form/general-painting-selector";
import { ResponsibleManager } from "@/components/administration/customer/responsible";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatChassis, formatPlate } from "@/utils";
import { FileCardUploadField, FileUploadField } from "@/components/common/file";
import { LayoutFileUploadField } from "@/components/production/task/form/layout-file-upload-field";
import { MultiAirbrushingSelector } from "@/components/production/task/form/multi-airbrushing-selector";
import { FileSuggestions, type FileWithPreview } from "@/components/common/file";
import type { ResponsibleRowData } from "@/types/responsible";

/**
 * UM VEÍCULO DO ORÇAMENTO, como o acordeão precisa conhecê-lo.
 *
 * ⚠️ Vem do ORÇAMENTO (`Budget.tasks`), não da tarefa aberta: a tela é aberta
 * pelo id de UM caminhão e o orçamento cobre N.
 */
export interface StepTaskVehicle {
  id: string;
  serialNumber?: string | null;
  customerOrderNumber?: string | null;
  truck?: { plate?: string | null; chassisNumber?: string | null } | null;
}

interface BudgetStepTaskProps {
  disabled?: boolean;
  isEditMode?: boolean;
  /**
   * TODOS os veículos do orçamento, para o acordeão de identificação.
   *
   * ⛔ Só o `currentVehicleId` é EDITÁVEL aqui, e isso não é uma limitação de
   * tela: o formulário desta página carrega `serialNumber`/`plate`/`chassisNumber`/
   * `customerOrderNumber` SINGULARES, semeados da tarefa aberta, e o Salvar
   * escreve um `PUT /tasks/:id` nessa tarefa e um `truck` nela. Não há contrato
   * para gravar N veículos daqui. Os outros painéis são leitura, com o caminho
   * para abrir cada um na sua própria tela. Inventar campos editáveis para eles
   * produziria edições que o Salvar descartaria em silêncio.
   */
  vehicles?: StepTaskVehicle[];
  /** O veículo por onde a tela foi aberta — o único editável. */
  currentVehicleId?: string | null;
  /** Abre outro veículo do mesmo orçamento (navega para o detalhe dele). */
  onOpenVehicle?: (taskId: string) => void;
  responsibleRows: ResponsibleRowData[];
  onResponsibleRowsChange: (rows: ResponsibleRowData[]) => void;
  showResponsibleErrors: boolean;
  baseFiles: FileWithPreview[];
  onBaseFilesChange: (files: FileWithPreview[]) => void;
  layouts: FileWithPreview[];
  onLayoutsChange: (files: FileWithPreview[]) => void;
  onLayoutStatusChange: (fileId: string, status: string) => void;
  onPaintCreated?: (paint: any) => void;
  /** Foto da plaqueta (VIN) já anexada ao caminhão, se houver. Edit mode only. */
  vinPlateFiles?: FileWithPreview[];
  onVinPlateFilesChange?: (files: FileWithPreview[]) => void;
}

export function BudgetStepTask({
  disabled,
  isEditMode = false,
  vehicles,
  currentVehicleId,
  onOpenVehicle,
  responsibleRows,
  onResponsibleRowsChange,
  showResponsibleErrors,
  baseFiles,
  onBaseFilesChange,
  layouts,
  onLayoutsChange,
  onLayoutStatusChange,
  onPaintCreated,
  vinPlateFiles,
  onVinPlateFilesChange,
}: BudgetStepTaskProps) {
  const { user } = useAuth();
  const { control } = useFormContext();

  // Sector-based visibility
  const isCommercialUser = user?.sector?.privileges === SECTOR_PRIVILEGES.COMMERCIAL;
  const isAdminUser = user?.sector?.privileges === SECTOR_PRIVILEGES.ADMIN;
  const isProductionManagerUser = user?.sector?.privileges === SECTOR_PRIVILEGES.PRODUCTION_MANAGER;
  // Prazo de Entrega — PRODUCTION_MANAGER/ADMIN only (API `term` field domain). O orçamento é
  // trabalho do comercial, então na prática a tarefa nasce daqui SEM prazo e a produção o define
  // depois. Deixar o campo aberto derrubaria o `POST /tasks/batch-with-quote` inteiro.
  const canEditTerm = isAdminUser || isProductionManagerUser;

  const showResponsibles = isAdminUser || isCommercialUser;
  const showPaint = isAdminUser || isCommercialUser;
  const showLayouts = isAdminUser || isCommercialUser;
  // Raw task-layout upload + status management (Step 1) is ADMIN-only: commercial
  // does NOT upload task layouts or change their status here — they only pick (or
  // upload a new, auto-approved) approved layout in Step 2 (Layout Aprovados).
  const canManageTaskLayouts = isAdminUser;

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

  // Calculate how many tasks will be created (create mode only)
  const taskCount = useMemo(() => {
    if (isEditMode) return 1;
    const platesCount = plates.length;
    const serialNumbersCount = serialNumbers.length;
    if (platesCount > 0 && serialNumbersCount > 0) return platesCount * serialNumbersCount;
    if (platesCount > 0) return platesCount;
    if (serialNumbersCount > 0) return serialNumbersCount;
    return 1;
  }, [isEditMode, plates, serialNumbers]);

  return (
    <div className={openAccordion === 'base-files' || openAccordion === 'layouts' ? 'pb-64' : ''}>
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

                {/* ── OS VEÍCULOS ──────────────────────────────────────────
                    Série, placa, nº do pedido, chassi e plaqueta são a
                    IDENTIFICAÇÃO de UM caminhão, e num orçamento de quatro eles
                    diferem entre si — ao contrário da logomarca e do cliente,
                    que são do orçamento inteiro. Por isso saíram da grade plana
                    e viraram um acordeão de um painel por veículo, o mesmo
                    padrão do assistente do cliente
                    (`components/cliente/solicitacao/step-veiculos.tsx`).
                    Ver `VeiculosDoOrcamento` no fim deste arquivo. */}
                {isEditMode ? (
                  <VeiculosDoOrcamento
                    vehicles={vehicles}
                    currentVehicleId={currentVehicleId}
                    onOpenVehicle={onOpenVehicle}
                  >
                  {/* ⚠️ UMA LINHA SÓ, e é pedido do dono: "coloque tudo em
                      linha, chassi, placa, serial etc.". Série, placa, nº do
                      pedido, chassi e plaqueta são a identificação do MESMO
                      caminhão — lidos juntos, numa varredura horizontal. Em
                      duas linhas, chassi e plaqueta caíam para baixo e a
                      identidade de um veículo virava dois blocos.
                      Abaixo de `xl` a grade volta a quebrar: cinco campos em
                      1280px ficariam estreitos demais para um chassi de 17
                      caracteres. */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                    <FormField
                      control={control}
                      name="serialNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <IconHash className="h-4 w-4" />
                            Número de Série
                          </FormLabel>
                          <FormControl>
                            <Input
                              value={field.value || ""}
                              onChange={(value) => field.onChange(value ?? "")}
                              placeholder="Ex: ABC-123"
                              disabled={disabled}
                              className="bg-transparent"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={control}
                      name="plate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <IconTruck className="h-4 w-4" />
                            Placa
                          </FormLabel>
                          <FormControl>
                            {/* Mesma regra do formulário de Tarefa: guarda a placa LIMPA em
                                maiúsculas (ABC1234) e exibe com hífen. O campo aceitava o texto
                                cru, então uma placa digitada em minúsculas ia para a API assim e
                                voltava 400 de validação. */}
                            <Input
                              type="plate"
                              value={field.value || ""}
                              onChange={(value) => field.onChange(value ? String(value) : "")}
                              disabled={disabled}
                              className="uppercase bg-transparent"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {/* N° DO PEDIDO — o pedido de compra do cliente, DESTE veículo.
                        Aqui, no passo da identificação, e não no de faturamento:
                        o pedido identifica a ENTREGA, como a série e a placa, e é
                        por isso que ele mora em `Task.customerOrderNumber` e não
                        na configuração de faturamento (onde os N caminhões de um
                        orçamento eram obrigados a citar o mesmo número).

                        Em EDIÇÃO o campo é só deste caminhão: é assim que se
                        corrige um dos quatro sem tocar nos outros três. Na
                        criação (abaixo) ele vale para todos os que nascerem. */}
                    <FormField
                      control={control}
                      name="customerOrderNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <IconHash className="h-4 w-4" />
                            N° do Pedido
                          </FormLabel>
                          <FormControl>
                            <Input
                              value={field.value || ""}
                              onChange={(value) =>
                                field.onChange(value === null || value === "" ? null : String(value))
                              }
                              placeholder="Ex: 12345"
                              maxLength={100}
                              disabled={disabled}
                              className="bg-transparent"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={control}
                      name="chassisNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <IconId className="h-4 w-4" />
                            Chassi
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="chassis"
                              value={field.value || ""}
                              onChange={(value) => field.onChange(value ? String(value) : "")}
                              disabled={disabled}
                              className="bg-transparent font-mono uppercase"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {/* Plaqueta — FOTO da plaqueta de identificação (VIN), imagem única. Mesmo
                        campo do formulário de Tarefa e do Faturamento: quem monta o orçamento é
                        quem está com o caminhão à vista, e mandar abrir outra tela para anexar a
                        foto é como ela deixa de ser anexada. Só no modo edição: no create ainda
                        não existe caminhão gravado (e uma única foto não serve para N tarefas). */}
                    {onVinPlateFilesChange && (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <IconId className="h-4 w-4" />
                          Plaqueta
                        </FormLabel>
                        <FormControl>
                          <FileUploadField
                            onFilesChange={onVinPlateFilesChange}
                            maxFiles={1}
                            maxSize={20 * 1024 * 1024}
                            disabled={disabled}
                            showPreview={true}
                            existingFiles={vinPlateFiles}
                            variant="inline"
                            placeholder="Fotografe ou anexe a plaqueta"
                            label="Foto da plaqueta"
                            acceptedFileTypes={{
                              "image/*": [".jpeg", ".jpg", ".png", ".webp", ".heic"],
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  </div>
                  </VeiculosDoOrcamento>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <SerialNumberRangeInput
                      control={control}
                      disabled={disabled || plates.length > 1}
                    />
                    <PlateTagsInput
                      control={control}
                      disabled={disabled || serialNumbers.length > 1}
                    />
                    {/* N° DO PEDIDO — UM campo para os N veículos que vão nascer.
                        O caso comum é o cliente comprar os quatro caminhões num
                        pedido só, e pedir quatro vezes o mesmo número seria o
                        tipo de trabalho que faz o operador deixar tudo em branco.
                        Quando os pedidos diferem, cada tarefa se corrige depois,
                        na tela dela (ou reabrindo o orçamento por ela). */}
                    <FormField
                      control={control}
                      name="customerOrderNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <IconHash className="h-4 w-4" />
                            N° do Pedido
                            {taskCount > 1 && (
                              <span className="text-xs font-normal text-muted-foreground">
                                (aplicado aos {taskCount} veículos)
                              </span>
                            )}
                          </FormLabel>
                          <FormControl>
                            <Input
                              value={field.value || ""}
                              onChange={(value) =>
                                field.onChange(value === null || value === "" ? null : String(value))
                              }
                              placeholder="Ex: 12345"
                              maxLength={100}
                              disabled={disabled}
                              className="bg-transparent"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {/* Task Count Preview - create mode only */}
                {!isEditMode && plates.length > 0 && serialNumbers.length > 0 && taskCount > 1 && (
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

                {/* Forecast Date + Term (o Prazo só aparece para quem pode gravá-lo) */}
                <div className={`grid grid-cols-1 gap-4 ${canEditTerm ? "md:grid-cols-2" : ""}`}>
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
                  {canEditTerm && (
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
                  )}
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
                          onChange={(value) => field.onChange(value ?? "")}
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

        {/* Service Orders moved to Step 3 ("Serviços e preços"). The
            quote-service → PRODUCTION-SO sync in task.service.ts derives the
            production orders from the billable services entered there, so a
            second Step-1 picker would only create duplicate noise. */}

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
                    allowQuickCreate={!disabled}
                    onPaintCreated={onPaintCreated}
                    quickCreateDescription='Informe os dados básicos da nova tinta. Ao salvar o orçamento, uma ordem de serviço "Formular Cor" será criada para a equipe de artes.'
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
                  {baseFiles.length > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {baseFiles.length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent className="pt-0">
                <FileCardUploadField
                  onFilesChange={onBaseFilesChange}
                  maxFiles={30}
                  maxSize={500 * 1024 * 1024}
                  disabled={disabled}
                  showPreview={true}
                  existingFiles={baseFiles}
                  variant="card"
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

        {/* 6. Layout Referência (task layouts) - ADMIN only. Commercial manages
             the approved layout in Step 2, not the raw task layouts here. */}
        {canManageTaskLayouts && (
          <AccordionItem
            value="layouts"
            id="accordion-item-layouts"
            className="border border-border rounded-lg"
          >
            <Card className="border-0">
              <AccordionTrigger className="px-0 hover:no-underline">
                <CardHeader className="flex-1 py-4">
                  <CardTitle className="flex items-center gap-2">
                    <IconPhoto className="h-5 w-5" />
                    Layout Referência
                    {layouts.length > 0 && (
                      <Badge variant="secondary" className="ml-1">
                        {layouts.length}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="pt-0">
                  <LayoutFileUploadField
                    onFilesChange={onLayoutsChange}
                    onStatusChange={onLayoutStatusChange}
                    maxFiles={5}
                    disabled={disabled}
                    showPreview={true}
                    existingFiles={layouts}
                    placeholder="Adicione o layout referência relacionado à tarefa"
                    label="Layout Referência anexado"
                    variant="card"
                  >
                    {/* Reuse a layout already used for this customer (no re-upload). */}
                    <FileSuggestions
                      customerId={customerIdValue ?? undefined}
                      fileContext="tasksLayouts"
                      excludeFileIds={layouts
                        .map((f) => (f as any).uploadedFileId || f.id)
                        .filter(Boolean)}
                      onSelect={(newFile) => {
                        const fileWithPreview = {
                          id: newFile.id,
                          name: newFile.filename || newFile.originalName || "artwork",
                          size: newFile.size || 0,
                          type: newFile.mimetype || "application/octet-stream",
                          lastModified: Date.now(),
                          uploaded: true,
                          uploadProgress: 100,
                          uploadedFileId: newFile.id,
                          thumbnailUrl: newFile.thumbnailUrl || undefined,
                          status: "DRAFT",
                        } as FileWithPreview;
                        onLayoutsChange([...layouts, fileWithPreview]);
                      }}
                      disabled={disabled}
                    />
                  </LayoutFileUploadField>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>
        )}

        {/* Aerografias - COMMERCIAL/ADMIN (same audience as Layouts) */}
        {showLayouts && (
          <AccordionItem value="airbrushing" id="accordion-item-airbrushing" className="border border-border rounded-lg">
            <Card className="border-0">
              <AccordionTrigger className="px-0 hover:no-underline">
                <CardHeader className="flex-1 py-4">
                  <CardTitle className="flex items-center gap-2">
                    <IconSparkles className="h-5 w-5" />
                    Aerografias
                  </CardTitle>
                </CardHeader>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="pt-0">
                  <MultiAirbrushingSelector control={control} disabled={disabled} customerId={customerIdValue || undefined} />
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  );
}

/**
 * O ACORDEÃO DOS VEÍCULOS — um painel por caminhão do orçamento.
 *
 * ⚠️ POR QUE ACORDEÃO, E NÃO A GRADE PLANA DE ANTES. Logomarca e cliente são do
 * ORÇAMENTO: um só, e plano está certo. Série, placa, nº do pedido, chassi e
 * plaqueta são do VEÍCULO, e num orçamento de quatro caminhões eles são quatro
 * conjuntos diferentes — a grade plana mostrava um deles sem dizer de qual era,
 * e os outros três não existiam em tela nenhuma deste passo. É o mesmo padrão
 * (e o mesmo cabeçalho "Série NNNN · PLACA", que se atualiza enquanto se digita)
 * do assistente do cliente, em `components/cliente/solicitacao/step-veiculos.tsx`.
 *
 * ⛔ UM SÓ É EDITÁVEL, E ISSO ESTÁ ESCRITO NA TELA. O formulário desta página é
 * de UMA tarefa — campos singulares, semeados da tarefa da URL, e um
 * `PUT /tasks/:id` no Salvar. Os demais painéis mostram o que está gravado e
 * oferecem "Abrir este veículo", que é a rota de detalhe dele. Campos editáveis
 * ali seriam edições silenciosamente descartadas no Salvar.
 *
 * ⚠️ `children` E NÃO UMA CÓPIA DOS CAMPOS. Os cinco `FormField` continuam sendo
 * os mesmos do passo, escritos uma vez só; este componente apenas decide em que
 * painel eles são desenhados. Duplicá-los garantiria que um dos dois jogos
 * envelhecesse.
 */
function VeiculosDoOrcamento({
  vehicles,
  currentVehicleId,
  onOpenVehicle,
  children,
}: {
  vehicles?: StepTaskVehicle[];
  currentVehicleId?: string | null;
  onOpenVehicle?: (taskId: string) => void;
  children: React.ReactNode;
}) {
  const { control } = useFormContext();
  // O QUE ESTÁ SENDO DIGITADO, para o cabeçalho do painel aberto acompanhar.
  // Ler do formulário (e não de `vehicles`) é o que faz o título mudar junto com
  // a placa — em `vehicles` está o que o servidor tem, que é o de antes do
  // Salvar.
  const serialNumber = useWatch({ control, name: "serialNumber" });
  const plate = useWatch({ control, name: "plate" });
  const chassisNumber = useWatch({ control, name: "chassisNumber" });

  // A lista DEGRADA para um veículo só: é o caso de um orçamento de um caminhão,
  // e também o da abertura, antes de o orçamento ter chegado. Sem isto os campos
  // não teriam painel nenhum em que ser desenhados.
  const rows: StepTaskVehicle[] =
    vehicles && vehicles.length > 0
      ? vehicles
      : [{ id: currentVehicleId || "atual" }];
  const currentId = currentVehicleId || rows[0]?.id;

  const [open, setOpen] = useState<string | undefined>(currentId ?? undefined);
  // Trocar de registro pelo pager remonta a página inteira (a rota é `key`ada
  // pelo `:taskId`), mas a lista pode chegar depois do primeiro render: sem isto
  // o acordeão abriria fechado num orçamento de N.
  useEffect(() => {
    if (currentId) setOpen(currentId);
  }, [currentId]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <IconTruck className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Veículos</span>
          <Badge variant="secondary">{rows.length}</Badge>
        </div>
        {rows.length > 1 && (
          <span className="text-sm text-muted-foreground">
            Este orçamento cobre {rows.length} caminhões. Aqui você edita o que está aberto — os
            outros se editam na tela deles.
          </span>
        )}
      </div>

      <Accordion type="single" collapsible value={open} onValueChange={setOpen} className="space-y-2">
        {rows.map((vehicle, index) => {
          const isCurrent = vehicle.id === currentId;
          const rowSerial = isCurrent ? serialNumber : vehicle.serialNumber;
          const rowPlate = isCurrent ? plate : vehicle.truck?.plate;
          const rowChassis = isCurrent ? chassisNumber : vehicle.truck?.chassisNumber;
          return (
            <AccordionItem
              key={vehicle.id || index}
              value={vehicle.id || `veiculo-${index}`}
              className="rounded-lg border border-border px-3"
            >
              <AccordionTrigger className="hover:no-underline">
                <div className="flex min-w-0 flex-1 items-center gap-2 pr-2 text-left">
                  <IconTruck className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-medium">
                    {tituloDoVeiculo(rowSerial, rowPlate, rowChassis, index)}
                  </span>
                  {isCurrent && rows.length > 1 && (
                    <Badge variant="secondary" className="shrink-0">
                      Aberto
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                {isCurrent ? (
                  children
                ) : (
                  /* LEITURA — e o caminho para editar. Ver o ⛔ do cabeçalho. */
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      <LeituraDoVeiculo label="Número de Série" value={vehicle.serialNumber} />
                      <LeituraDoVeiculo
                        label="Placa"
                        value={vehicle.truck?.plate ? formatPlate(vehicle.truck.plate) : null}
                      />
                      <LeituraDoVeiculo label="N° do Pedido" value={vehicle.customerOrderNumber} />
                      <LeituraDoVeiculo
                        label="Chassi"
                        value={
                          vehicle.truck?.chassisNumber
                            ? formatChassis(vehicle.truck.chassisNumber)
                            : null
                        }
                      />
                    </div>
                    {onOpenVehicle && vehicle.id && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => onOpenVehicle(vehicle.id)}
                      >
                        <IconExternalLink className="h-4 w-4" />
                        Abrir este veículo
                      </Button>
                    )}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

/** O que identifica o painel quando ele está fechado — o mesmo do portal. */
function tituloDoVeiculo(
  serial: string | null | undefined,
  plate: string | null | undefined,
  chassis: string | null | undefined,
  index: number,
): string {
  const s = (serial ?? "").trim();
  const p = (plate ?? "").trim();
  const c = (chassis ?? "").trim();
  if (s && p) return `Série ${s} · ${formatPlate(p)}`;
  if (s) return `Série ${s}`;
  if (p) return formatPlate(p);
  if (c) return `Chassi ${formatChassis(c)}`;
  return `Veículo ${index + 1}`;
}

function LeituraDoVeiculo({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value?.trim() || "—"}</p>
    </div>
  );
}
