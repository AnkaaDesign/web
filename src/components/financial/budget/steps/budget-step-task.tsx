import { useState, useMemo, useEffect, type ReactNode } from "react";
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
  IconCopy,
  IconRuler,
  IconAlertTriangle,
} from "@tabler/icons-react";
import {
  IMPLEMENT_CATEGORY,
  IMPLEMENT_TYPE,
  IMPLEMENT_CATEGORY_LABELS,
  IMPLEMENT_TYPE_LABELS,
  SECTOR_PRIVILEGES,
} from "@/constants";
import { useAuth } from "@/contexts/auth-context";
import { canViewAirbrushingFinancials } from "@/utils/permissions/entity-permissions";
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
import { FileCardUploadField, FileUploadField } from "@/components/common/file";
import { LayoutFileUploadField } from "@/components/production/task/form/layout-file-upload-field";
import { MultiAirbrushingSelector } from "@/components/production/task/form/multi-airbrushing-selector";
import { FileSuggestions, type FileWithPreview } from "@/components/common/file";
import type { ResponsibleRowData } from "@/types/responsible";

interface BudgetStepTaskProps {
  disabled?: boolean;
  isEditMode?: boolean;
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

  // ─── ORÇAMENTO DE N VEÍCULOS (só na edição) ─────────────────────────────────
  //
  // O passo tem duas metades. COMUM a todos: logomarca, cliente, categoria,
  // implemento, tamanho, responsáveis e arquivos base — mesmo orçamento, mesmo
  // preço, mesmo caminhão. DE CADA veículo: série, placa, pedido, chassi, plaqueta,
  // previsão, prazo, detalhes, pintura geral e aerografia. Decisão do dono,
  // 23/09/2026, a partir do caso Carlotti (nº 990).

  /**
   * Prefixo dos campos DO VEÍCULO no formulário (`vehicles.<i>.`). Sem ele os campos
   * têm os nomes de sempre — é o que a criação usa.
   */
  vehicleFieldPrefix?: string;
  /** Identidade do veículo mostrado: as seções dele remontam ao trocar de aba. */
  vehicleKey?: string;
  /** Quantos veículos o orçamento cobre. Com 2+, o passo mostra as abas e os rótulos. */
  vehicleCount?: number;
  /** "39088" — como o veículo mostrado é chamado nos títulos das seções. */
  activeVehicleLabel?: string;
  /** As abas de escolha do veículo (`BudgetVehicleTabs`). */
  vehicleTabs?: ReactNode;
  /** Copia o valor do veículo mostrado para os demais. */
  onApplyToOtherVehicles?: (field: "customerOrderNumber" | "forecastDate" | "paintId") => void;
  /** O tamanho do implemento, lançado pela Logística — aqui só se lê. */
  measuresSummary?: ReactNode;
  /**
   * Campos comuns que hoje DIVERGEM entre os veículos (dado anterior a esta tela, ou
   * editado tarefa a tarefa). `onEqualize` faz o próximo salvar gravar o valor
   * mostrado em todos.
   */
  commonDivergence?: { fields: string[]; equalized: boolean; onEqualize: () => void } | null;
}

export function BudgetStepTask({
  disabled,
  isEditMode = false,
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
  vehicleFieldPrefix = "",
  vehicleKey,
  vehicleCount = 1,
  activeVehicleLabel,
  vehicleTabs,
  onApplyToOtherVehicles,
  measuresSummary,
  commonDivergence,
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

  // Campos DO VEÍCULO. `v("plate")` é `plate` na criação e `vehicles.<i>.plate` na
  // edição de um orçamento de N veículos.
  const v = (field: string) => `${vehicleFieldPrefix}${field}`;
  // Chave de remontagem das seções do veículo, UMA POR PARTE: as seções são irmãs
  // umas das outras, e a mesma chave em dois irmãos faz o React duplicar ou sumir
  // com eles.
  const vk = (part: string) => (vehicleKey ? `${vehicleKey}:${part}` : undefined);
  const multiVehicle = isEditMode && vehicleCount > 1;
  const vehicleSuffix = multiVehicle && activeVehicleLabel ? ` — ${activeVehicleLabel}` : "";
  const commonSuffix = multiVehicle ? " — comum a todos os veículos" : "";
  const applyButton = (field: "customerOrderNumber" | "forecastDate" | "paintId", label: string) =>
    multiVehicle && onApplyToOtherVehicles && !disabled ? (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        // Mais baixo que o rótulo, para o campo não descer em relação aos vizinhos.
        className="-my-1 h-5 gap-1 px-1.5 text-xs font-normal text-muted-foreground"
        onClick={() => onApplyToOtherVehicles(field)}
      >
        <IconCopy className="h-3 w-3" />
        {label}
      </Button>
    ) : null;

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
      {multiVehicle && vehicleTabs && (
        <div className="sticky top-0 z-10 -mx-1 mb-4 bg-background/95 px-1 pb-2 pt-1 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          {vehicleTabs}
        </div>
      )}
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
                          Categoria do Implemento
                        </FormLabel>
                        <Combobox
                          value={field.value || ""}
                          onValueChange={field.onChange}
                          options={[
                            { value: "", label: "Nenhuma" },
                            ...Object.values(IMPLEMENT_CATEGORY).map((cat) => ({
                              value: cat,
                              label: IMPLEMENT_CATEGORY_LABELS[cat],
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

                {/* Tamanho — comum: mesmo orçamento, mesmo implemento. Lançado pela
                    Logística na tarefa e replicado aos irmãos pela API; aqui só se lê. */}
                {isEditMode && measuresSummary && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <IconRuler className="h-4 w-4" />
                    <span>Tamanho do implemento:</span>
                    <span className="font-medium text-foreground">{measuresSummary}</span>
                  </div>
                )}

                {multiVehicle && commonDivergence && commonDivergence.fields.length > 0 && (
                  <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
                    <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div className="flex-1 space-y-2">
                      <p className="text-amber-900 dark:text-amber-100">
                        Os veículos estão com valores diferentes em{" "}
                        <span className="font-medium">{commonDivergence.fields.join(", ")}</span>. Esses campos
                        são comuns ao orçamento: o que aparece aqui é o do veículo aberto.
                      </p>
                      {commonDivergence.equalized ? (
                        <p className="text-xs text-amber-800 dark:text-amber-200">
                          Ao salvar, todos os veículos ficam com os valores mostrados aqui.
                        </p>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={commonDivergence.onEqualize}
                          disabled={disabled}
                        >
                          Igualar todos os veículos a estes valores
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {multiVehicle && (
                  <div className="flex items-center gap-2 border-t border-border pt-4 text-sm font-medium">
                    <IconTruck className="h-4 w-4 text-muted-foreground" />
                    Deste veículo{vehicleSuffix}
                  </div>
                )}

                {/* Plates + Serial Numbers */}
                {isEditMode ? (
                  /* CINCO colunas: série, placa, nº do pedido, chassi e plaqueta
                     são a IDENTIFICAÇÃO do mesmo veículo e pertencem à mesma
                     fileira. Com quatro colunas a plaqueta caía sozinha numa
                     linha inteira, parecendo uma seção própria. */
                  <div key={vk("identificacao")} className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
                    <FormField
                      control={control}
                      name={v("serialNumber")}
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
                      name={v("plate")}
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
                      name={v("customerOrderNumber")}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <IconHash className="h-4 w-4" />
                            N° do Pedido
                            {applyButton("customerOrderNumber", "Repetir nos demais")}
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
                      name={v("chassisNumber")}
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
                  <div className="space-y-1">
                    <FormField
                      key={vk("previsao")}
                      control={control}
                      name={v("forecastDate")}
                      render={({ field }) => (
                        <DateTimeInput
                          {...{ onChange: field.onChange, onBlur: field.onBlur, value: field.value ?? null }}
                          mode="datetime"
                          label="Data de Previsão de Liberação"
                          disabled={disabled}
                        />
                      )}
                    />
                    {applyButton("forecastDate", "Aplicar esta previsão aos demais veículos")}
                  </div>
                  {canEditTerm && (
                    <FormField
                      key={vk("prazo")}
                      control={control}
                      name={v("term")}
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
                  key={vk("detalhes")}
                  control={control}
                  name={v("details")}
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
                    Responsáveis{commonSuffix}
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
                    Tintas{vehicleSuffix}
                  </CardTitle>
                </CardHeader>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="space-y-2 pt-0">
                  <GeneralPaintingSelector
                    key={vk("tinta")}
                    name={v("paintId")}
                    control={control}
                    disabled={disabled}
                    userPrivilege={user?.sector?.privileges}
                    allowQuickCreate={!disabled}
                    onPaintCreated={onPaintCreated}
                    quickCreateDescription='Informe os dados básicos da nova tinta. Ao salvar o orçamento, uma ordem de serviço "Formular Cor" será criada para a equipe de artes.'
                  />
                  {applyButton("paintId", "Aplicar esta pintura aos demais veículos")}
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
                  Arquivos Base{commonSuffix}
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
                    Layout Referência{vehicleSuffix}
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
                    key={vk("layouts")}
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
                    Aerografias{vehicleSuffix}
                  </CardTitle>
                </CardHeader>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="pt-0">
                  <MultiAirbrushingSelector
                    key={vk("aerografia")}
                    name={v("airbrushings")}
                    control={control}
                    disabled={disabled}
                    customerId={customerIdValue || undefined}
                    canViewFinancials={canViewAirbrushingFinancials(user as any)}
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
