import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { FileUploadField } from "@/components/common/file/file-upload-field";
import { useFileViewer } from "@/components/common/file/file-viewer";
import { CustomerLogoDisplay } from "@/components/ui/avatar-display";
import {
  IconUser,
  IconCalendar,
  IconPhoto,
  IconUpload,
  IconX,
  IconArrowLeft,
  IconInfoCircle,
} from "@tabler/icons-react";
import { formatCNPJ } from "../../../../../utils";
import { getCustomers } from "../../../../../api-client";
import { getApiBaseUrl } from "@/config/api";
import { cn } from "@/lib/utils";
import type { FileWithPreview } from "@/components/common/file/file-uploader";

interface ArtworkOption {
  id: string;
  artworkId?: string;
  filename?: string;
  originalName?: string;
  thumbnailUrl?: string | null;
  status?: string;
  mimetype?: string;
  size?: number;
}

interface QuoteStepInfoProps {
  task: any;
  disabled?: boolean;
  layoutFiles: FileWithPreview[];
  onLayoutFilesChange: (files: FileWithPreview[]) => void;
  artworks?: ArtworkOption[];
  customersCache: React.MutableRefObject<Map<string, any>>;
  selectedCustomers: Map<string, any>;
  setSelectedCustomers: (customers: Map<string, any>) => void;
}

const VALIDITY_PERIOD_OPTIONS = [
  { label: "15 dias", value: "15" },
  { label: "30 dias", value: "30" },
  { label: "60 dias", value: "60" },
  { label: "90 dias", value: "90" },
];

const VALIDITY_DAYS_OPTIONS = Array.from({ length: 30 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1} ${i + 1 === 1 ? "dia" : "dias"}`,
}));

const GUARANTEE_OPTIONS = [
  { value: "5", label: "5 anos" },
  { value: "10", label: "10 anos" },
  { value: "15", label: "15 anos" },
  { value: "CUSTOM", label: "Personalizado" },
] as const;

export function QuoteStepInfo({
  task,
  disabled,
  layoutFiles,
  onLayoutFilesChange,
  artworks,
  customersCache,
  selectedCustomers,
  setSelectedCustomers,
}: QuoteStepInfoProps) {
  const { setValue, getValues, control } = useFormContext();
  const fileViewer = useFileViewer();
  const [validityPeriod, setValidityPeriod] = useState<number | null>(null);
  const [showLayoutUploadMode, setShowLayoutUploadMode] = useState(false);
  const [showCustomGuarantee, setShowCustomGuarantee] = useState(false);

  // Watch form values
  const quoteExpiresAt = useWatch({ control, name: "expiresAt" });
  const currentLayoutFileId = useWatch({ control, name: "layoutFileId" });
  const guaranteeYears = useWatch({ control, name: "guaranteeYears" });
  const customGuaranteeText = useWatch({ control, name: "customGuaranteeText" });

  // Initialize validity period from expiresAt
  useEffect(() => {
    if (!quoteExpiresAt || validityPeriod !== null) return;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const expiryDate = new Date(quoteExpiresAt);
    expiryDate.setHours(0, 0, 0, 0);
    const diffInDays = Math.round(
      (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    for (const period of [15, 30, 60, 90]) {
      if (Math.abs(diffInDays - period) <= 1) {
        setValidityPeriod(period);
        return;
      }
    }
    setValidityPeriod(30);
  }, [quoteExpiresAt, validityPeriod]);

  // Initialize custom guarantee state
  useEffect(() => {
    if (customGuaranteeText) setShowCustomGuarantee(true);
  }, []);

  const currentGuaranteeOption = useMemo(() => {
    if (customGuaranteeText) return "CUSTOM";
    if (guaranteeYears) return guaranteeYears.toString();
    return "";
  }, [guaranteeYears, customGuaranteeText]);

  const handleGuaranteeOptionChange = useCallback(
    (value: string) => {
      if (value === "CUSTOM") {
        setShowCustomGuarantee(true);
        setValue("guaranteeYears", null);
      } else {
        setShowCustomGuarantee(false);
        setValue("customGuaranteeText", null);
        setValue("guaranteeYears", value ? Number(value) : null);
      }
    },
    [setValue],
  );

  const handleValidityPeriodChange = useCallback(
    (period: string) => {
      const days = Number(period);
      setValidityPeriod(days);
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + days);
      expiryDate.setHours(23, 59, 59, 999);
      setValue("expiresAt", expiryDate);
    },
    [setValue],
  );

  // Customer search
  const searchCustomers = useCallback(
    async (search: string, page: number = 1) => {
      const params: any = {
        orderBy: { fantasyName: "asc" },
        page,
        take: 50,
        include: { logo: true },
      };
      if (search?.trim()) params.searchingFor = search.trim();
      try {
        const response = await getCustomers(params);
        const customers = response.data || [];
        customers.forEach((c: any) => customersCache.current.set(c.id, c));
        return { data: customers, hasMore: response.meta?.hasNextPage || false };
      } catch {
        return { data: [], hasMore: false };
      }
    },
    [customersCache],
  );

  const getCustomerLabel = useCallback(
    (customer: any) =>
      customer.fantasyName || customer.corporateName || "Cliente sem nome",
    [],
  );
  const getCustomerValue = useCallback((customer: any) => customer.id, []);

  // Layout file handling
  const handleLayoutFileChange = useCallback(
    (files: FileWithPreview[]) => {
      onLayoutFilesChange(files);
      if (files.length > 0 && files[0].uploadedFileId) {
        setValue("layoutFileId", files[0].uploadedFileId);
      } else if (files.length === 0) {
        setValue("layoutFileId", null);
      }
    },
    [setValue, onLayoutFilesChange],
  );

  const handleArtworkSelect = useCallback(
    (value: string | string[] | null | undefined) => {
      const fileId = typeof value === "string" ? value : null;
      if (fileId === "__UPLOAD_NEW__") {
        setShowLayoutUploadMode(true);
        return;
      }
      if (fileId) {
        const artwork = artworks?.find((a) => a.id === fileId);
        if (artwork) {
          const filePreview = {
            id: artwork.id,
            name: artwork.originalName || artwork.filename || "artwork",
            size: artwork.size || 0,
            type: artwork.mimetype || "image/png",
            lastModified: Date.now(),
            uploaded: true,
            uploadProgress: 100,
            uploadedFileId: artwork.id,
            thumbnailUrl: artwork.thumbnailUrl,
          } as FileWithPreview;
          onLayoutFilesChange([filePreview]);
          setValue("layoutFileId", artwork.id);
          setShowLayoutUploadMode(false);
        }
      } else {
        onLayoutFilesChange([]);
        setValue("layoutFileId", null);
      }
    },
    [artworks, setValue, onLayoutFilesChange],
  );

  const UPLOAD_NEW_SENTINEL = "__UPLOAD_NEW__";
  const artworkOptions = useMemo(() => {
    if (!artworks || artworks.length === 0) return [];
    const imageArtworks = artworks.filter((a) =>
      (a.mimetype || "").startsWith("image/"),
    );
    if (imageArtworks.length === 0) return [];
    return [
      ...imageArtworks,
      { id: UPLOAD_NEW_SENTINEL, filename: "Enviar novo arquivo" } as ArtworkOption,
    ];
  }, [artworks]);

  const renderArtworkOption = useCallback((artwork: ArtworkOption) => {
    if (artwork.id === "__UPLOAD_NEW__") {
      return (
        <div className="flex items-center gap-3 w-full py-1 text-muted-foreground">
          <div className="w-12 h-12 rounded-md border border-dashed border-border overflow-hidden shrink-0 bg-muted/50 flex items-center justify-center">
            <IconUpload className="h-5 w-5" />
          </div>
          <p className="text-sm">Enviar novo arquivo</p>
        </div>
      );
    }
    const thumbnailSrc =
      artwork.thumbnailUrl || `${getApiBaseUrl()}/files/thumbnail/${artwork.id}`;
    return (
      <div className="flex items-center gap-3 w-full py-1">
        <div className="w-12 h-12 rounded-md border border-border overflow-hidden shrink-0 bg-muted">
          <img
            src={thumbnailSrc}
            alt={artwork.originalName || artwork.filename || "artwork"}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm truncate">
            {artwork.originalName || artwork.filename || "Arquivo"}
          </p>
          {artwork.status && (
            <p className="text-xs text-muted-foreground">
              {artwork.status === "APPROVED"
                ? "Aprovado"
                : artwork.status === "REPROVED"
                  ? "Reprovado"
                  : "Rascunho"}
            </p>
          )}
        </div>
      </div>
    );
  }, []);

  const taskIdentifier =
    task.serialNumber || task.truck?.plate || task.name || "Tarefa";

  return (
    <div className="space-y-6">
      {/* Task Info Card (read-only) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <IconInfoCircle className="h-4 w-4" />
            Dados da Tarefa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Tarefa</p>
              <p className="font-medium">{task.name || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cliente</p>
              <p className="font-medium">
                {task.customer?.fantasyName ||
                  task.customer?.corporateName ||
                  "-"}
              </p>
            </div>
            {task.serialNumber && (
              <div>
                <p className="text-xs text-muted-foreground">Nº Série</p>
                <p className="font-medium">{task.serialNumber}</p>
              </div>
            )}
            {task.truck?.plate && (
              <div>
                <p className="text-xs text-muted-foreground">Placa</p>
                <p className="font-medium">{task.truck.plate}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Customer Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <IconUser className="h-4 w-4" />
            Faturar Para (Clientes)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FormField
            control={control}
            name="customerConfigs"
            render={({ field }) => {
              const configIds = Array.isArray(field.value)
                ? field.value
                    .map((c: any) => (typeof c === "string" ? c : c.customerId))
                    .filter(Boolean)
                : [];

              const handleCustomerConfigChange = (
                newIds: string | string[] | null | undefined,
              ) => {
                const ids = Array.isArray(newIds) ? newIds : [];
                const currentConfigs: any[] = Array.isArray(field.value)
                  ? field.value
                  : [];
                const newConfigs = ids.map((id: string) => {
                  const existing = currentConfigs.find(
                    (c: any) => (typeof c === "string" ? c : c.customerId) === id,
                  );
                  if (existing && typeof existing === "object") return existing;
                  return {
                    customerId: id,
                    subtotal: 0,
                    total: 0,
                    paymentCondition: null,
                    downPaymentDate: null,
                    customPaymentText: null,
                    responsibleId: null,
                  };
                });
                field.onChange(newConfigs);

                // Update selected customers
                const newMap = new Map<string, any>();
                ids.forEach((id: string) => {
                  const cached = customersCache.current.get(id);
                  if (cached) newMap.set(id, cached);
                });
                setSelectedCustomers(newMap);
              };

              return (
                <FormItem>
                  <FormControl>
                    <div className="space-y-3">
                      <Combobox
                        value={configIds}
                        onValueChange={handleCustomerConfigChange}
                        mode="multiple"
                        placeholder="Selecione clientes para faturamento..."
                        emptyText="Nenhum cliente encontrado"
                        searchPlaceholder="Pesquisar por nome ou CNPJ..."
                        disabled={disabled}
                        async={true}
                        queryKey={["customers", "quote-invoice-selector"]}
                        queryFn={searchCustomers}
                        getOptionLabel={getCustomerLabel}
                        getOptionValue={getCustomerValue}
                        renderOption={(customer: any) => (
                          <div className="flex items-center gap-3">
                            <CustomerLogoDisplay
                              logo={customer.logo}
                              customerName={customer.fantasyName}
                              size="sm"
                              shape="rounded"
                              className="flex-shrink-0"
                            />
                            <div className="flex flex-col gap-1 min-w-0 flex-1">
                              <div className="font-medium truncate">
                                {customer.fantasyName}
                              </div>
                              <div className="flex items-center gap-2 text-sm truncate">
                                {customer.corporateName && (
                                  <span className="truncate">
                                    {customer.corporateName}
                                  </span>
                                )}
                                {customer.cnpj && (
                                  <>
                                    {customer.corporateName && (
                                      <span className="opacity-50">&bull;</span>
                                    )}
                                    <span>{formatCNPJ(customer.cnpj)}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        minSearchLength={0}
                        pageSize={20}
                        debounceMs={500}
                        hideDefaultBadges={true}
                        clearable={true}
                      />

                      {selectedCustomers.size > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {Array.from(selectedCustomers.values()).map((customer) => (
                            <Badge
                              key={customer.id}
                              variant="secondary"
                              className={cn(
                                "pl-2.5 pr-2.5 py-1.5 flex items-center gap-2 border transition-colors",
                                !disabled &&
                                  "cursor-pointer hover:bg-destructive hover:text-destructive-foreground",
                              )}
                              onClick={
                                disabled
                                  ? undefined
                                  : (e) => {
                                      e.preventDefault();
                                      const currentConfigs: any[] = Array.isArray(
                                        field.value,
                                      )
                                        ? field.value
                                        : [];
                                      field.onChange(
                                        currentConfigs.filter(
                                          (c: any) =>
                                            (typeof c === "string"
                                              ? c
                                              : c.customerId) !== customer.id,
                                        ),
                                      );
                                      const newMap = new Map(selectedCustomers);
                                      newMap.delete(customer.id);
                                      setSelectedCustomers(newMap);
                                    }
                              }
                            >
                              <CustomerLogoDisplay
                                logo={customer.logo}
                                customerName={customer.fantasyName}
                                size="xs"
                                shape="rounded"
                                className="flex-shrink-0"
                              />
                              <span className="text-xs font-medium">
                                {customer.fantasyName || customer.corporateName}
                              </span>
                              {customer.cnpj && (
                                <span className="text-xs opacity-70">
                                  ({formatCNPJ(customer.cnpj)})
                                </span>
                              )}
                              {!disabled && <IconX className="h-3 w-3 ml-1" />}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              );
            }}
          />
        </CardContent>
      </Card>

      {/* Validity, Guarantee, Forecast, Simultaneous Tasks */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <IconCalendar className="h-4 w-4" />
            Prazos e Configurações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <FormField
              control={control}
              name="expiresAt"
              render={() => (
                <FormItem>
                  <FormLabel>
                    Validade da Proposta
                    <span className="text-destructive ml-1">*</span>
                  </FormLabel>
                  <FormControl>
                    <Combobox
                      value={validityPeriod?.toString() || ""}
                      onValueChange={(value) => {
                        if (typeof value === "string")
                          handleValidityPeriodChange(value);
                      }}
                      options={VALIDITY_PERIOD_OPTIONS}
                      placeholder="Selecione o período"
                      emptyText="Nenhum período encontrado"
                      disabled={disabled}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormItem>
              <FormLabel>Período de Garantia</FormLabel>
              <FormControl>
                <Combobox
                  value={currentGuaranteeOption}
                  onValueChange={(value) => {
                    if (typeof value === "string")
                      handleGuaranteeOptionChange(value);
                  }}
                  disabled={disabled}
                  options={GUARANTEE_OPTIONS.map((opt) => ({
                    value: opt.value,
                    label: opt.label,
                  }))}
                  placeholder="Selecione"
                  emptyText="Nenhuma opção"
                />
              </FormControl>
            </FormItem>

            <FormField
              control={control}
              name="customForecastDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prazo Entrega</FormLabel>
                  <FormControl>
                    <Combobox
                      value={field.value ? String(field.value) : ""}
                      onValueChange={(value) =>
                        field.onChange(value ? Number(value) : null)
                      }
                      disabled={disabled}
                      options={VALIDITY_DAYS_OPTIONS}
                      placeholder="Auto"
                      emptyText="Nenhuma opção"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="simultaneousTasks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tarefas Simultâneas</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      {...field}
                      value={field.value ?? ""}
                      onChange={(val) => field.onChange(val ? Number(val) : null)}
                      disabled={disabled}
                      placeholder="1-100"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {showCustomGuarantee && (
            <FormField
              control={control}
              name="customGuaranteeText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Texto Personalizado de Garantia</FormLabel>
                  <FormControl>
                    <textarea
                      {...field}
                      value={field.value || ""}
                      placeholder="Descreva as condições de garantia personalizadas..."
                      disabled={disabled}
                      rows={3}
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          )}
        </CardContent>
      </Card>

      {/* Layout File */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <IconPhoto className="h-4 w-4" />
            Layout Aprovado
          </CardTitle>
        </CardHeader>
        <CardContent>
          {artworkOptions.length > 0 && !showLayoutUploadMode && (
            <div className="space-y-3">
              <Combobox<ArtworkOption>
                value={currentLayoutFileId || ""}
                onValueChange={handleArtworkSelect}
                options={artworkOptions}
                getOptionValue={(a) => a.id}
                getOptionLabel={(a) =>
                  a.originalName || a.filename || "Arquivo"
                }
                renderOption={renderArtworkOption}
                placeholder="Selecionar uma arte existente..."
                emptyText="Nenhuma arte de imagem encontrada"
                disabled={disabled}
                clearable
                searchable
              />

              {currentLayoutFileId &&
                artworkOptions.some((a) => a.id === currentLayoutFileId) && (
                  <div className="bg-muted/30 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-muted-foreground">
                        {artworkOptions.find((a) => a.id === currentLayoutFileId)
                          ?.originalName ||
                          artworkOptions.find(
                            (a) => a.id === currentLayoutFileId,
                          )?.filename ||
                          "Layout selecionado"}
                      </span>
                      {!disabled && (
                        <button
                          type="button"
                          onClick={() => handleArtworkSelect(null)}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded-md hover:bg-muted"
                        >
                          <IconX className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="flex justify-start">
                      <img
                        src={`${getApiBaseUrl()}/files/thumbnail/${currentLayoutFileId}`}
                        alt="Layout aprovado"
                        className="max-h-48 rounded-lg shadow-sm object-contain cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => {
                          const selectedArtwork = artworkOptions.find(
                            (a) => a.id === currentLayoutFileId,
                          );
                          if (selectedArtwork) {
                            fileViewer.actions.viewFile({
                              id: selectedArtwork.id,
                              filename: selectedArtwork.filename,
                              originalName: selectedArtwork.originalName,
                              mimetype: selectedArtwork.mimetype || "image/png",
                              size: selectedArtwork.size,
                            } as any);
                          }
                        }}
                      />
                    </div>
                  </div>
                )}
            </div>
          )}

          {(artworkOptions.length === 0 || showLayoutUploadMode) && (
            <div className="space-y-2">
              {artworkOptions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowLayoutUploadMode(false)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1"
                >
                  <IconArrowLeft className="h-3.5 w-3.5" />
                  Voltar para seleção de layouts
                </button>
              )}
              <FileUploadField
                onFilesChange={handleLayoutFileChange}
                existingFiles={layoutFiles}
                maxFiles={1}
                maxSize={10 * 1024 * 1024}
                acceptedFileTypes={{
                  "image/*": [".jpeg", ".jpg", ".png", ".gif", ".webp"],
                }}
                disabled={disabled}
                variant="compact"
                placeholder="Arraste ou clique para selecionar o layout"
                showPreview={true}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
