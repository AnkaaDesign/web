import { useState, useEffect, useMemo, useCallback } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { FileUploadField } from "@/components/common/file/file-upload-field";
import { useFileViewer } from "@/components/common/file/file-viewer";
import { CustomerLogoDisplay } from "@/components/ui/avatar-display";
import {
  IconUsers,
  IconCalendar,
  IconPhoto,
  IconUpload,
  IconX,
  IconArrowLeft,
  IconTruck,
  IconExternalLink,
} from "@tabler/icons-react";
import { formatCNPJ, formatDate, formatChassis } from "@/utils";
import { getCustomers } from "@/api-client";
import { getApiBaseUrl } from "@/config/api";
import { routes } from "@/constants";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
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

interface BudgetStepInfoProps {
  task?: any;
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

export function BudgetStepInfo({
  task,
  disabled,
  layoutFiles,
  onLayoutFilesChange,
  artworks,
  customersCache,
  selectedCustomers: _selectedCustomers,
  setSelectedCustomers,
}: BudgetStepInfoProps) {
  const { setValue, getValues, control } = useFormContext();
  const fileViewer = useFileViewer();
  const navigate = useNavigate();
  const [validityPeriod, setValidityPeriod] = useState<number | null>(null);
  const [showLayoutUploadMode, setShowLayoutUploadMode] = useState(false);
  const [showCustomGuarantee, setShowCustomGuarantee] = useState(false);

  // Watch form values
  const quoteExpiresAt = useWatch({ control, name: "expiresAt" });
  const currentLayoutFileId = useWatch({ control, name: "layoutFileId" });
  const guaranteeYears = useWatch({ control, name: "guaranteeYears" });
  const customGuaranteeText = useWatch({ control, name: "customGuaranteeText" });
  const customerConfigs = useWatch({ control, name: "customerConfigs" }) || [];

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

  // Customer search — pin Ankaa customer first
  const PINNED_CUSTOMER_ID = "93dfbeb1-aec0-4829-a297-6a2f09fcfe08";

  const searchCustomers = useCallback(
    async (search?: string, page: number = 1): Promise<{ data: any[]; hasMore: boolean }> => {
      const params: any = {
        orderBy: { fantasyName: "asc" },
        page,
        take: 50,
        include: { logo: true },
      };
      if (search && search.trim()) {
        params.searchingFor = search.trim();
      }
      try {
        const response = await getCustomers(params);
        const customers = response.data || [];
        customers.forEach((c: any) => customersCache.current.set(c.id, c));

        // Pin specific customer to the top on first page with no search
        if (page === 1 && !search?.trim()) {
          const pinnedIndex = customers.findIndex((c: any) => c.id === PINNED_CUSTOMER_ID);
          if (pinnedIndex > 0) {
            const [pinned] = customers.splice(pinnedIndex, 1);
            customers.unshift(pinned);
          } else if (pinnedIndex === -1) {
            // Fetch pinned customer if not in first page
            try {
              const pinnedResponse = await getCustomers({
                where: { id: PINNED_CUSTOMER_ID },
                take: 1,
                include: { logo: true },
              });
              const pinnedCustomer = pinnedResponse.data?.[0];
              if (pinnedCustomer) {
                customersCache.current.set(pinnedCustomer.id, pinnedCustomer);
                customers.unshift(pinnedCustomer);
              }
            } catch { /* ignore */ }
          }
        }

        return { data: customers, hasMore: response.meta?.hasNextPage || false };
      } catch {
        return { data: [], hasMore: false };
      }
    },
    [customersCache],
  );

  const handleCustomerChange = useCallback(
    (value: any) => {
      const selectedIds: string[] = Array.isArray(value) ? value : value ? [value] : [];
      const currentConfigs = getValues("customerConfigs") || [];

      const newConfigs = selectedIds.map((customerId) => {
        const existing = currentConfigs.find((c: any) => c.customerId === customerId);
        if (existing) return existing;

        const cached = customersCache.current.get(customerId);
        return {
          customerId,
          subtotal: 0,
          total: 0,
          paymentCondition: null,
          customPaymentText: null,
          generateInvoice: true,
          responsibleId: null,
          customerData: {
            corporateName: cached?.corporateName || "",
            fantasyName: cached?.fantasyName || "",
            cnpj: cached?.cnpj || "",
            cpf: cached?.cpf || "",
            address: cached?.address || "",
            addressNumber: cached?.addressNumber || "",
            addressComplement: cached?.addressComplement || "",
            neighborhood: cached?.neighborhood || "",
            city: cached?.city || "",
            state: cached?.state || "",
            zipCode: cached?.zipCode || "",
            stateRegistration: cached?.stateRegistration || "",
            streetType: cached?.streetType || null,
          },
        };
      });

      setValue("customerConfigs", newConfigs, { shouldDirty: true });

      // Update selected customers map
      const newMap = new Map<string, any>();
      selectedIds.forEach((id: string) => {
        const cached = customersCache.current.get(id);
        if (cached) newMap.set(id, cached);
      });
      setSelectedCustomers(newMap);
    },
    [getValues, setValue, customersCache, setSelectedCustomers],
  );

  const selectedCustomerIds = customerConfigs.map((c: any) => c.customerId);

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

  // Build task info items (matching billing pattern)
  const infoItems: { label: string; value: string }[] = task ? [
    { label: "Logomarca", value: task.name || "-" },
    ...(task.customer ? [{ label: "Cliente", value: task.customer.corporateName || task.customer.fantasyName }] : []),
    ...(task.serialNumber ? [{ label: "Nº de Série", value: task.serialNumber }] : []),
    ...(task.truck?.plate ? [{ label: "Placa", value: task.truck.plate }] : []),
    ...(task.truck?.chassisNumber ? [{ label: "Chassi", value: formatChassis(task.truck.chassisNumber) }] : []),
    ...(task.finishedAt ? [{ label: "Finalizado em", value: formatDate(task.finishedAt) }] : []),
  ] : [];

  return (
    <div className="space-y-4">
      {/* Top: Task Info (left) + Customer Selection (right) */}
      <div className={`grid grid-cols-1 ${infoItems.length > 0 ? "lg:grid-cols-2" : ""} gap-4`}>
        {/* Left: Task Overview - Read Only (only when task exists) */}
        {infoItems.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <IconTruck className="h-4 w-4 text-muted-foreground" />
                  Dados da Tarefa
                </CardTitle>
                {task?.id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(
                      task.status === "COMPLETED" || task.status === "CANCELLED"
                        ? routes.production.history.details(task.id)
                        : routes.production.preparation.details(task.id)
                    )}
                    className="gap-1.5 h-8"
                  >
                    <IconExternalLink className="h-3.5 w-3.5" />
                    Ver Tarefa
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {infoItems.map((item) => (
                  <div key={item.label} className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <span className="text-sm font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Right: Invoice-To Customers */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <IconUsers className="h-4 w-4 text-muted-foreground" />
              Faturar Para
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Combobox<any>
              mode="multiple"
              placeholder="Selecione os clientes para faturamento"
              emptyText="Nenhum cliente encontrado"
              value={selectedCustomerIds}
              onValueChange={handleCustomerChange}
              async={true}
              queryKey={["customers-budget-detail"]}
              queryFn={searchCustomers}
              minSearchLength={0}
              disabled={disabled}
              getOptionValue={(customer: any) => customer.id}
              getOptionLabel={(customer: any) => customer.corporateName || customer.fantasyName}
              renderOption={(customer: any) => (
                <div className="flex items-center gap-3 w-full">
                  <CustomerLogoDisplay
                    logo={customer.logo}
                    customerName={customer.fantasyName || customer.corporateName}
                    size="sm"
                    shape="rounded"
                    className="flex-shrink-0"
                  />
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <div className="font-medium truncate">{customer.corporateName || customer.fantasyName}</div>
                    {customer.cnpj && <div className="text-xs opacity-70">{formatCNPJ(customer.cnpj)}</div>}
                  </div>
                </div>
              )}
            />

            {customerConfigs.length > 0 && (
              <div className="space-y-2">
                {customerConfigs.map((config: any) => {
                  const cached = customersCache.current.get(config.customerId);
                  const name = cached?.corporateName || cached?.fantasyName || "Cliente";
                  const cnpj = cached?.cnpj;

                  return (
                    <div key={config.customerId} className="flex items-center gap-3 bg-muted/30 rounded-lg px-4 py-3">
                      <CustomerLogoDisplay
                        logo={cached?.logo}
                        customerName={name}
                        size="sm"
                        shape="rounded"
                        className="flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{name}</div>
                        {cnpj && (
                          <div className="text-xs text-muted-foreground">{formatCNPJ(cnpj)}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Validity, Guarantee, Forecast, Simultaneous Tasks */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <IconCalendar className="h-4 w-4 text-muted-foreground" />
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
                  <FormLabel>Validade da Proposta</FormLabel>
                  <FormControl>
                    <Combobox
                      value={validityPeriod?.toString() || ""}
                      onValueChange={(value) => {
                        if (typeof value === "string")
                          handleValidityPeriodChange(value);
                      }}
                      options={VALIDITY_PERIOD_OPTIONS}
                      placeholder="Selecione"
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
            <IconPhoto className="h-4 w-4 text-muted-foreground" />
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
