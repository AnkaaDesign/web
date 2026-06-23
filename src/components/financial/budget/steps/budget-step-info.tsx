import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FileUploadField } from "@/components/common/file/file-upload-field";
import { useFileViewer } from "@/components/common/file/file-viewer";
import { CustomerLogoDisplay } from "@/components/ui/avatar-display";
import {
  IconUsers,
  IconCalendar,
  IconPhoto,
  IconUpload,
  IconX,
  IconCheck,
  IconEye,
  IconCirclePlus,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { formatCNPJ } from "@/utils";
import { getCustomers } from "@/api-client";
import { getApiBaseUrl } from "@/config/api";
import type { FileWithPreview } from "@/components/common/file/file-uploader";

interface ArtworkOption {
  id: string;
  artworkId?: string;
  filename?: string;
  originalName?: string;
  thumbnailUrl?: string | null;
  // Object-URL for brand-new, not-yet-uploaded local files (no server id yet).
  preview?: string | null;
  status?: string;
  mimetype?: string;
  // Remote storage path (http URL) when available — lets the viewer serve the file.
  path?: string | null;
  size?: number;
}

// Map an image file extension to a real image MIME type. Used so the in-app file
// viewer's determineFileViewAction categorizes the file as an "image" → opens the
// MODAL. An empty/unknown mimetype would fall through to download/new-tab.
const IMAGE_EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
};

const mimeFromName = (name?: string | null): string | null => {
  const ext = (name || "").toLowerCase().split(".").pop() || "";
  return IMAGE_EXT_TO_MIME[ext] || null;
};

interface BudgetStepInfoProps {
  disabled?: boolean;
  layoutFiles: FileWithPreview[];
  onLayoutFilesChange: (files: FileWithPreview[]) => void;
  artworks?: ArtworkOption[];
  // Called when a task-artwork is added/removed as the quote "Layout Aprovado".
  // Adding marks the artwork APPROVED; removing reverts it to DRAFT. Keyed by File id.
  onArtworkLayoutApprovalChange?: (fileId: string, approved: boolean) => void;
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
  disabled,
  layoutFiles,
  onLayoutFilesChange,
  artworks,
  onArtworkLayoutApprovalChange,
  customersCache,
  selectedCustomers: _selectedCustomers,
  setSelectedCustomers,
}: BudgetStepInfoProps) {
  const { setValue, getValues, control } = useFormContext();
  const fileViewer = useFileViewer();
  const [validityPeriod, setValidityPeriod] = useState<number | null>(null);
  const [showCustomGuarantee, setShowCustomGuarantee] = useState(false);
  // Which layout-candidate tile has its action popover open (mirrors FileSuggestions).
  const [openLayoutPopoverId, setOpenLayoutPopoverId] = useState<string | null>(
    null,
  );

  // Stores the last single customer config before it was removed, so discount can be
  // carried over when the user does a remove-then-add instead of atomic replacement.
  const lastRemovedSingleConfigRef = useRef<any>(null);

  // Watch form values
  const quoteExpiresAt = useWatch({ control, name: "expiresAt" });
  // Ordered layout File ids (max 2), derived from the layoutFiles array (source of
  // truth). Drives the multi-select picker AND the layoutFileIds form field.
  const currentLayoutFileIds = useMemo(
    () =>
      layoutFiles
        .map((f) => (f as any).uploadedFileId || f.id)
        .filter(Boolean)
        .slice(0, 2) as string[],
    [layoutFiles],
  );
  const guaranteeYears = useWatch({ control, name: "guaranteeYears" });
  const customGuaranteeText = useWatch({ control, name: "customGuaranteeText" });
  const customerConfigs = useWatch({ control, name: "customerConfigs" }) || [];

  // Sync validity period whenever expiresAt changes (including after form.reset() populates saved data)
  useEffect(() => {
    if (!quoteExpiresAt) return;
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
  }, [quoteExpiresAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show custom guarantee textarea whenever the saved text is populated
  useEffect(() => {
    if (customGuaranteeText) setShowCustomGuarantee(true);
  }, [customGuaranteeText]);

  const currentGuaranteeOption = useMemo(() => {
    if (customGuaranteeText) return "CUSTOM";
    if (guaranteeYears) return guaranteeYears.toString();
    return "";
  }, [guaranteeYears, customGuaranteeText]);

  // Image artworks available to pick as layouts (max 2 chosen). No upload sentinel —
  // uploading is a separate, always-available FileUploadField below.
  const artworkOptions = useMemo(() => {
    if (!artworks || artworks.length === 0) return [];
    return artworks.filter((a) => (a.mimetype || "").startsWith("image/"));
  }, [artworks]);

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

      // Save the config before the last customer is removed so its discount can be
      // restored when the user adds a new customer (remove-then-add flow).
      if (currentConfigs.length === 1 && selectedIds.length === 0) {
        lastRemovedSingleConfigRef.current = currentConfigs[0];
      }
      // In multi-customer mode the discount is per-customer, so don't carry over.
      if (selectedIds.length >= 2) {
        lastRemovedSingleConfigRef.current = null;
      }

      // Source for discount carry-over:
      // 1. Atomic 1→1 replacement: the config being replaced is the source.
      // 2. Remove-then-add (0→1): the last removed single config is the source.
      const discountSource =
        (currentConfigs.length === 1 && selectedIds.length === 1 ? currentConfigs[0] : null) ??
        (currentConfigs.length === 0 && selectedIds.length === 1
          ? lastRemovedSingleConfigRef.current
          : null);

      const newConfigs = selectedIds.map((customerId) => {
        const existing = currentConfigs.find((c: any) => c.customerId === customerId);
        if (existing) return existing;

        const cached = customersCache.current.get(customerId);
        return {
          customerId,
          subtotal: 0,
          total: 0,
          discountType: discountSource?.discountType ?? "NONE",
          discountValue: discountSource?.discountValue ?? null,
          discountReference: discountSource?.discountReference ?? null,
          paymentCondition: null,
          customPaymentText: null,
          generateInvoice: true,
          generateBankSlip: true,
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

  // Layout file handling — drives the layoutFileIds array (ordered File ids, max 2).
  const syncLayoutIds = useCallback(
    (files: FileWithPreview[]) => {
      const ids = files
        .map((f) => (f as any).uploadedFileId || f.id)
        .filter(Boolean)
        .slice(0, 2);
      setValue("layoutFileIds", ids, { shouldDirty: true });
    },
    [setValue],
  );

  // The upload field manages ONLY the uploaded (non-artwork) layout files. Merge its
  // output with the currently-selected artwork layouts so both sources combine into
  // one ordered array, capped at 2 total. Artwork selections come first.
  const handleLayoutFileChange = useCallback(
    (uploadedFiles: FileWithPreview[]) => {
      const optionIds = new Set(artworkOptions.map((a) => a.id));
      const artworkLayoutFiles = layoutFiles.filter((f) => {
        const id = (f as any).uploadedFileId || f.id;
        return optionIds.has(id);
      });
      // Drop any uploaded file that is actually an artwork option (avoid dupes).
      const pureUploads = uploadedFiles.filter((f) => {
        const id = (f as any).uploadedFileId || f.id;
        return !optionIds.has(id);
      });
      const next = [...artworkLayoutFiles, ...pureUploads].slice(0, 2);
      onLayoutFilesChange(next);
      syncLayoutIds(next);
    },
    [artworkOptions, layoutFiles, onLayoutFilesChange, syncLayoutIds],
  );

  // Only the uploaded (non-artwork) files are shown in the FileUploadField.
  const uploadedLayoutFiles = useMemo(() => {
    const optionIds = new Set(artworkOptions.map((a) => a.id));
    return layoutFiles.filter((f) => {
      const id = (f as any).uploadedFileId || f.id;
      return !optionIds.has(id);
    });
  }, [artworkOptions, layoutFiles]);

  // The artwork ids currently selected as layouts.
  const selectedArtworkLayoutIds = useMemo(() => {
    const optionIds = new Set(artworkOptions.map((a) => a.id));
    return currentLayoutFileIds.filter((id) => optionIds.has(id));
  }, [artworkOptions, currentLayoutFileIds]);

  // Multi-select: the chosen artworks + any uploaded files combine into ONE ordered
  // layoutFiles array, clamped to 2 total (drives layoutFiles/layoutFileIds).
  const handleArtworkSelect = useCallback(
    (value: string | string[] | null | undefined) => {
      const selectedIds: string[] = Array.isArray(value)
        ? value
        : value
          ? [value]
          : [];

      // Files that are NOT artwork options (i.e. plain uploads) are preserved.
      const optionIds = new Set(artworkOptions.map((a) => a.id));
      const uploadedNonArtworkFiles = layoutFiles.filter((f) => {
        const id = (f as any).uploadedFileId || f.id;
        return !optionIds.has(id);
      });

      // Build a layoutFile for each selected artwork (reuse an existing preview when
      // already present to preserve identity/thumbnail).
      const artworkLayoutFiles = selectedIds
        .map((id) => {
          const existing = layoutFiles.find(
            (f) => ((f as any).uploadedFileId || f.id) === id,
          );
          if (existing) return existing;
          const artwork = artworks?.find((a) => a.id === id);
          if (!artwork) return null;
          return {
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
        })
        .filter(Boolean) as FileWithPreview[];

      // Keep uploads (they were placed first by the user) and fill remaining slots
      // with the chosen artworks — never exceeding 2 total. Uploads are appended
      // last so an artwork selection can't silently evict a just-uploaded file.
      const slotsForArtworks = Math.max(0, 2 - uploadedNonArtworkFiles.length);
      const next = [
        ...artworkLayoutFiles.slice(0, slotsForArtworks),
        ...uploadedNonArtworkFiles,
      ].slice(0, 2);
      onLayoutFilesChange(next);
      syncLayoutIds(next);

      // Approve task-artworks added to the layout selection; revert removed ones to
      // DRAFT. Only the artwork-sourced ids that actually LAND in a slot count as
      // selected (an id squeezed out by the 2-slot cap is treated as not selected).
      // `value` here is always an artwork-option id array, so every id is a task
      // artwork — no need to filter out pure Step-2 uploads. Last action wins because
      // we diff against the previous selection on every change.
      if (onArtworkLayoutApprovalChange) {
        const nextArtworkIds = new Set(
          next
            .map((f) => (f as any).uploadedFileId || f.id)
            .filter((id) => optionIds.has(id)),
        );
        const prevArtworkIds = new Set(selectedArtworkLayoutIds);
        nextArtworkIds.forEach((id) => {
          if (!prevArtworkIds.has(id)) onArtworkLayoutApprovalChange(id, true);
        });
        prevArtworkIds.forEach((id) => {
          if (!nextArtworkIds.has(id)) onArtworkLayoutApprovalChange(id, false);
        });
      }
    },
    [
      artworks,
      artworkOptions,
      layoutFiles,
      onLayoutFilesChange,
      syncLayoutIds,
      onArtworkLayoutApprovalChange,
      selectedArtworkLayoutIds,
    ],
  );

  // Card-grid toggle: add the artwork if not selected, remove it if selected. Routes
  // through handleArtworkSelect so the approval diff, layoutFiles/layoutFileIds sync
  // and the 2-slot cap all still apply.
  const toggleArtworkLayout = useCallback(
    (fileId: string) => {
      const isSelected = selectedArtworkLayoutIds.includes(fileId);
      const nextIds = isSelected
        ? selectedArtworkLayoutIds.filter((id) => id !== fileId)
        : [...selectedArtworkLayoutIds, fileId];
      handleArtworkSelect(nextIds);
    },
    [selectedArtworkLayoutIds, handleArtworkSelect],
  );

  // Resolve a renderable image src for an artwork option:
  //  1. server thumbnailUrl when present,
  //  2. object-URL preview for brand-new not-yet-uploaded local files,
  //  3. otherwise the server thumbnail endpoint keyed by the real File id.
  // Brand-new local files have a generated local `id` (not a real File id), so the
  // thumbnail endpoint would 404 for them — hence the preview fallback.
  const getArtworkThumbnailSrc = useCallback((artwork: ArtworkOption): string => {
    if (artwork.thumbnailUrl) return artwork.thumbnailUrl;
    if (artwork.preview) return artwork.preview;
    return `${getApiBaseUrl()}/files/thumbnail/${artwork.id}`;
  }, []);

  // Open an artwork in the in-app file-viewer MODAL (FileViewerProvider is mounted at
  // the App root). determineFileViewAction categorizes by mimetype, then falls back to
  // the filename extension; a missing/blank mimetype AND extension-less filename slips
  // to download/new-tab. So we pass a COMPLETE object (like FileSuggestions does):
  // a guaranteed image mimetype (derived from the filename ext when the option's is
  // empty), a filename WITH extension, id, size, thumbnailUrl and path.
  const openArtworkInViewer = useCallback(
    (artwork: ArtworkOption) => {
      const filename =
        artwork.filename || artwork.originalName || "layout.png";
      const mimetype =
        (artwork.mimetype && artwork.mimetype.startsWith("image/")
          ? artwork.mimetype
          : null) ||
        mimeFromName(filename) ||
        mimeFromName(artwork.originalName) ||
        "image/png";
      fileViewer.actions.viewFile({
        id: artwork.id,
        filename,
        originalName: artwork.originalName || filename,
        mimetype,
        size: artwork.size || 0,
        thumbnailUrl: artwork.thumbnailUrl || null,
        path: artwork.path || null,
      } as any);
    },
    [fileViewer],
  );

  // Total layout slots consumed = selected artworks + uploaded files (max 2).
  const totalLayoutsSelected =
    selectedArtworkLayoutIds.length + uploadedLayoutFiles.length;
  const layoutLimitReached = totalLayoutsSelected >= 2;
  // Free upload slots remaining out of the 2-total cap.
  const remainingLayoutSlots =
    2 - selectedArtworkLayoutIds.length - uploadedLayoutFiles.length;

  return (
    <div className="space-y-4">
      {/* Invoice-To Customers */}
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
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Selecione até 2 layouts: escolha artes existentes e/ou envie novos
              arquivos (no máximo 2 no total).
            </p>

            {/* Candidate grid mirroring FileSuggestions' "see or select" flow. Each
                tile opens a small Popover with Ver (modal) / Selecionar / Remover.
                Selected tiles keep their ring + check badge. Selecionar is disabled
                when the 2-slot total (artworks + uploads) is reached and the tile
                isn't already selected. Selecting routes through toggleArtworkLayout
                → handleArtworkSelect (approval + layoutFileIds + cap all apply). */}
            {artworkOptions.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Artes existentes
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {totalLayoutsSelected}/2 selecionados
                  </span>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-3">
                  {artworkOptions.map((artwork) => {
                    const isSelected = selectedArtworkLayoutIds.includes(
                      artwork.id,
                    );
                    const selectDisabled =
                      !isSelected && (disabled || layoutLimitReached);
                    return (
                      <Popover
                        key={artwork.id}
                        open={openLayoutPopoverId === artwork.id}
                        onOpenChange={(open) =>
                          setOpenLayoutPopoverId(open ? artwork.id : null)
                        }
                      >
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className={cn(
                              "group relative block w-full max-w-[140px] overflow-hidden rounded-lg border-2 bg-card text-left transition-all",
                              isSelected
                                ? "border-primary ring-2 ring-primary/30"
                                : "border-border hover:border-primary/50",
                              openLayoutPopoverId === artwork.id &&
                                "ring-2 ring-primary/40",
                            )}
                          >
                            <div className="relative h-28 w-full bg-muted">
                              <img
                                src={getArtworkThumbnailSrc(artwork)}
                                alt={
                                  artwork.originalName ||
                                  artwork.filename ||
                                  "layout"
                                }
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  (
                                    e.target as HTMLImageElement
                                  ).style.visibility = "hidden";
                                }}
                              />
                              {isSelected && (
                                <div className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                                  <IconCheck className="h-3.5 w-3.5" />
                                </div>
                              )}
                            </div>
                            <div className="px-2 py-1.5">
                              <p className="truncate text-[11px] font-medium">
                                {artwork.originalName ||
                                  artwork.filename ||
                                  "Arquivo"}
                              </p>
                              {artwork.status && (
                                <p className="text-[10px] text-muted-foreground">
                                  {artwork.status === "APPROVED"
                                    ? "Aprovado"
                                    : artwork.status === "REPROVED"
                                      ? "Reprovado"
                                      : "Rascunho"}
                                </p>
                              )}
                            </div>
                          </button>
                        </PopoverTrigger>

                        <PopoverContent
                          className="flex w-auto gap-1 p-1"
                          side="top"
                          sideOffset={4}
                          align="center"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setOpenLayoutPopoverId(null);
                              openArtworkInViewer(artwork);
                            }}
                            className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
                          >
                            <IconEye size={14} />
                            Ver
                          </button>
                          {isSelected ? (
                            <button
                              type="button"
                              disabled={disabled}
                              onClick={() => {
                                setOpenLayoutPopoverId(null);
                                toggleArtworkLayout(artwork.id);
                              }}
                              className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                            >
                              <IconX size={14} />
                              Remover
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={selectDisabled}
                              onClick={() => {
                                setOpenLayoutPopoverId(null);
                                toggleArtworkLayout(artwork.id);
                              }}
                              className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <IconCirclePlus size={14} />
                              Selecionar
                            </button>
                          )}
                        </PopoverContent>
                      </Popover>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Upload new layout files (combines with artwork selections, max 2).
                Capacity-aware: show the compact dropzone only while slots remain;
                when full, show just the uploaded-file thumbnails (mini, removable)
                so the user can drop one; render nothing when full with no uploads. */}
            {remainingLayoutSlots > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <IconUpload className="h-3.5 w-3.5" />
                  Ou envie um novo arquivo de layout
                </div>
                <FileUploadField
                  onFilesChange={handleLayoutFileChange}
                  existingFiles={uploadedLayoutFiles}
                  // Cap at the actual remaining capacity so the field never renders
                  // its own "limite atingido" box — we hide it instead.
                  maxFiles={uploadedLayoutFiles.length + remainingLayoutSlots}
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
            ) : uploadedLayoutFiles.length > 0 ? (
              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Arquivo enviado
                </span>
                {/* Mini variant hides the add tile when at limit → only the
                    removable thumbnails show, no ugly empty dropzone. */}
                <FileUploadField
                  onFilesChange={handleLayoutFileChange}
                  existingFiles={uploadedLayoutFiles}
                  maxFiles={uploadedLayoutFiles.length}
                  maxSize={10 * 1024 * 1024}
                  acceptedFileTypes={{
                    "image/*": [".jpeg", ".jpg", ".png", ".gif", ".webp"],
                  }}
                  disabled={disabled}
                  variant="mini"
                  showPreview={true}
                />
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
