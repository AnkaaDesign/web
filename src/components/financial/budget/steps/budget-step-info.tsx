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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFileViewer } from "@/components/common/file/file-viewer";
import { CustomerLogoDisplay } from "@/components/ui/avatar-display";
import {
  IconUsers,
  IconCalendar,
  IconPhoto,
  IconEye,
  IconCheck,
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

// A persisted File id is a UUID; a not-yet-uploaded file carries a local temp id
// (`<timestamp>-<random>`). Used to decide whether the server thumbnail endpoint is
// safe to hit (it 404s on temp ids) and whether to open the local blob preview.
const isUuid = (id?: string | null): boolean =>
  !!id &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// Comparable {id, name, size} for matching a task art against a quote layout File.
type ImageKey = { id?: string; name: string; size: number };
const imageKeyOfArt = (a: ArtworkOption): ImageKey => ({
  id: a.id,
  name: (a.originalName || a.filename || "").trim(),
  size: a.size || 0,
});
const imageKeyOfFile = (f: FileWithPreview): ImageKey => ({
  id: (f as any).uploadedFileId || f.id,
  name: (f.name || "").trim(),
  size: f.size || 0,
});
// Same underlying image: identical File id, OR identical filename + byte size — the
// latter catches the duplicate-record case (a quote layout that is a separate upload
// of the same task art) so it reads as already-selected, never as a duplicate tile.
const sameImage = (a: ImageKey, b: ImageKey): boolean =>
  (!!a.id && a.id === b.id) ||
  (!!a.name && a.name === b.name && a.size === b.size);

interface BudgetStepInfoProps {
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
  const [validityPeriod, setValidityPeriod] = useState<number | null>(null);
  const [showCustomGuarantee, setShowCustomGuarantee] = useState(false);

  // Stores the last single customer config before it was removed, so discount can be
  // carried over when the user does a remove-then-add instead of atomic replacement.
  const lastRemovedSingleConfigRef = useRef<any>(null);

  // Watch form values
  const quoteExpiresAt = useWatch({ control, name: "expiresAt" });
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

  // The task's image layouts — the candidates for the budget's approved layout
  // (up to 2 chosen). Sourced live from Step 1; there is no upload in this step.
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

  // --- Layout Aprovado picker --------------------------------------------------
  // The budget's approved layout is chosen FROM the task's layouts (artworks). There
  // is NO upload here — new images are added to the task in Step 1. Up to 2 may be
  // marked as the approved layout.
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

  // How many layout slots are filled (max 2).
  const selectedCount = Math.min(layoutFiles.length, 2);

  // Is this task art part of the approved layout? Matched by id OR same image
  // (filename+size) so a separate-but-identical quote layout File still reads selected.
  const isArtSelected = useCallback(
    (art: ArtworkOption) =>
      layoutFiles.some((lf) => sameImage(imageKeyOfFile(lf), imageKeyOfArt(art))),
    [layoutFiles],
  );

  // Toggle a task art in/out of the approved layout (selection ONLY — status is set
  // separately via the card's status selector). Same-image files are removed even when
  // their File id differs from the art's, so the duplicate-record case toggles cleanly.
  const toggleArt = useCallback(
    (art: ArtworkOption) => {
      const ak = imageKeyOfArt(art);
      const selected = layoutFiles.some((lf) =>
        sameImage(imageKeyOfFile(lf), ak),
      );
      let next: FileWithPreview[];
      if (selected) {
        next = layoutFiles.filter((lf) => !sameImage(imageKeyOfFile(lf), ak));
      } else {
        if (layoutFiles.length >= 2) return; // 2-slot cap
        const lf = {
          id: art.id,
          name: art.originalName || art.filename || "layout",
          size: art.size || 0,
          type: art.mimetype || "image/png",
          lastModified: Date.now(),
          uploaded: true,
          uploadProgress: 100,
          uploadedFileId: art.id,
          thumbnailUrl: art.thumbnailUrl,
          // Carry the local object-URL preview so a not-yet-uploaded art still renders.
          preview: art.preview ?? null,
        } as FileWithPreview;
        next = [...layoutFiles, lf].slice(0, 2);
      }
      onLayoutFilesChange(next);
      syncLayoutIds(next);
    },
    [layoutFiles, onLayoutFilesChange, syncLayoutIds],
  );

  // Quote layout files that match NO current task art (the art was removed, or a legacy
  // quote-only file). Shown as selected-but-removable tiles so the budget's layout is
  // never silently hidden.
  const orphanLayoutFiles = useMemo(
    () =>
      layoutFiles.filter(
        (lf) =>
          !artworkOptions.some((a) =>
            sameImage(imageKeyOfFile(lf), imageKeyOfArt(a)),
          ),
      ),
    [layoutFiles, artworkOptions],
  );
  const removeOrphan = useCallback(
    (f: FileWithPreview) => {
      const fk = imageKeyOfFile(f);
      const next = layoutFiles.filter(
        (lf) => !sameImage(imageKeyOfFile(lf), fk),
      );
      onLayoutFilesChange(next);
      syncLayoutIds(next);
    },
    [layoutFiles, onLayoutFilesChange, syncLayoutIds],
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

  // Thumbnail for an orphan layout file: local preview → server thumbnailUrl →
  // thumbnail endpoint keyed by a real File id (a temp/local id would 404).
  const layoutThumbSrc = useCallback((f: FileWithPreview): string | null => {
    if (f.preview) return f.preview;
    if (f.thumbnailUrl) return f.thumbnailUrl;
    const realId =
      (isUuid((f as any).uploadedFileId) && (f as any).uploadedFileId) ||
      (isUuid(f.id) && f.id) ||
      null;
    return realId ? `${getApiBaseUrl()}/files/thumbnail/${realId}` : null;
  }, []);

  // Open an orphan layout file in the viewer (local blob if not yet uploaded, else by id).
  const viewLayout = useCallback(
    (f: FileWithPreview) => {
      const id = (f as any).uploadedFileId || f.id;
      if (f.preview && !isUuid(id)) {
        window.open(f.preview, "_blank");
        return;
      }
      const filename = f.name || "layout.png";
      const mimetype =
        (f.type && f.type.startsWith("image/") ? f.type : null) ||
        mimeFromName(filename) ||
        "image/png";
      fileViewer.actions.viewFile({
        id,
        filename,
        originalName: filename,
        mimetype,
        size: f.size || 0,
        thumbnailUrl: (f as any).thumbnailUrl || null,
        path: null,
      } as any);
    },
    [fileViewer],
  );

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

      {/* Layout Aprovado — pick the budget's approved layout FROM the task's layouts
          (managed in Step 1). Tap a tile to toggle (up to 2). NO upload here. A quote
          layout that is a separate File from its task art is matched by image so it
          reads as already-selected ("Usado"), never as a duplicate. */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <IconPhoto className="h-4 w-4 text-muted-foreground" />
            Layout Aprovado
            <Badge
              variant={selectedCount > 0 ? "secondary" : "outline"}
              className="ml-auto text-[11px] font-normal tabular-nums"
            >
              {selectedCount}/2
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {artworkOptions.length > 0 || orphanLayoutFiles.length > 0 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
                {/* Task layouts — selectable. Click the image OR "Selecionar" to toggle;
                    "Ver" opens the viewer. Status is managed on the task (Step 1). */}
                {artworkOptions.map((art) => {
                  const selected = isArtSelected(art);
                  const blockSelect =
                    !selected && (disabled || selectedCount >= 2);
                  const name = art.originalName || art.filename || "Arquivo";
                  return (
                    <div
                      key={art.id}
                      className={cn(
                        "overflow-hidden rounded-lg border-2 bg-card transition-all",
                        selected ? "border-primary ring-2 ring-primary/30" : "border-border",
                      )}
                    >
                      {/* Image preview — clicking it toggles selection */}
                      <button
                        type="button"
                        disabled={blockSelect}
                        onClick={() => toggleArt(art)}
                        title={selected ? "Remover do layout" : "Usar no layout"}
                        className={cn(
                          "relative block h-52 w-full bg-muted",
                          blockSelect
                            ? "cursor-not-allowed opacity-50"
                            : "cursor-pointer",
                        )}
                      >
                        <img
                          src={getArtworkThumbnailSrc(art)}
                          alt={name}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.visibility =
                              "hidden";
                          }}
                        />
                        {selected && (
                          <div className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                            <IconCheck className="h-4 w-4" />
                          </div>
                        )}
                      </button>

                      <div className="space-y-2 p-2">
                        <p className="truncate text-xs font-medium" title={name}>
                          {name}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 flex-1 px-2"
                            onClick={() => openArtworkInViewer(art)}
                          >
                            <IconEye className="mr-1 h-3.5 w-3.5" />
                            Ver
                          </Button>
                          <Button
                            type="button"
                            variant={selected ? "default" : "outline"}
                            size="sm"
                            className="h-8 flex-1 px-2"
                            disabled={blockSelect}
                            onClick={() => toggleArt(art)}
                          >
                            {selected ? (
                              <>
                                <IconCheck className="mr-1 h-3.5 w-3.5" />
                                Selecionado
                              </>
                            ) : (
                              "Selecionar"
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Quote layouts with no matching task art — selected, removable, no status */}
                {orphanLayoutFiles.map((f) => {
                  const id = (f as any).uploadedFileId || f.id;
                  const src = layoutThumbSrc(f);
                  return (
                    <div
                      key={id}
                      className="overflow-hidden rounded-lg border-2 border-primary bg-card ring-2 ring-primary/30"
                    >
                      <button
                        type="button"
                        onClick={() => viewLayout(f)}
                        title="Ver layout"
                        className="relative block h-52 w-full cursor-pointer bg-muted"
                      >
                        {src ? (
                          <img
                            src={src}
                            alt={f.name || "layout"}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.visibility =
                                "hidden";
                            }}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <IconPhoto className="h-8 w-8 text-muted-foreground/50" />
                          </div>
                        )}
                        <div className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                          <IconCheck className="h-4 w-4" />
                        </div>
                      </button>
                      <div className="space-y-2 p-2">
                        <p className="truncate text-xs font-medium" title={f.name}>
                          {f.name || "Arquivo"}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 flex-1 px-2"
                            onClick={() => viewLayout(f)}
                          >
                            <IconEye className="mr-1 h-3.5 w-3.5" />
                            Ver
                          </Button>
                          {!disabled && (
                            // Same "Selecionado" toggle as a chosen task art — this
                            // file IS the approved layout; clicking it deselects (removes).
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              className="h-8 flex-1 px-2"
                              onClick={() => removeOrphan(f)}
                            >
                              <IconCheck className="mr-1 h-3.5 w-3.5" />
                              Selecionado
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center">
              <IconPhoto className="mx-auto h-6 w-6 text-muted-foreground/50" />
              <p className="mt-2 text-sm font-medium text-muted-foreground">
                Nenhum layout na tarefa
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Adicione layouts na etapa "Tarefa" para usá-los como layout
                aprovado.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
