import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useFieldArray, useWatch, useFormContext, useController } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconPlus, IconTrash, IconCalendar, IconCurrencyReal, IconPhoto, IconNote } from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Combobox } from "@/components/ui/combobox";
import { FileUploadField } from "@/components/common/file/file-upload-field";
import { useFileViewer } from "@/components/common/file/file-viewer";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency, formatCNPJ } from "../../../../utils";
import { cn } from "@/lib/utils";
import { DISCOUNT_TYPE, SERVICE_ORDER_TYPE, TASK_QUOTE_STATUS } from "@/constants/enums";
import { DISCOUNT_TYPE_LABELS, TASK_QUOTE_STATUS_LABELS } from "@/constants/enum-labels";
import { RESPONSIBLE_ROLE_LABELS } from "@/types/responsible";
import type { FileWithPreview } from "@/components/common/file/file-uploader";
import { ServiceAutocomplete } from "../form/service-autocomplete";
import { getCustomers } from "../../../../api-client";
import { getApiBaseUrl } from "@/config/api";
import { CustomerLogoDisplay } from "@/components/ui/avatar-display";
import { IconX, IconUpload, IconArrowLeft } from "@tabler/icons-react";

interface ArtworkOption {
  id: string; // File ID (flattened)
  artworkId?: string; // Artwork entity ID
  filename?: string;
  originalName?: string;
  thumbnailUrl?: string | null;
  status?: string;
  mimetype?: string;
  size?: number;
}

interface QuoteSelectorProps {
  control: any;
  disabled?: boolean;
  userRole?: string;
  readOnly?: boolean;
  onItemCountChange?: (count: number) => void;
  layoutFiles?: FileWithPreview[];
  onLayoutFilesChange?: (files: FileWithPreview[]) => void;
  onItemDeleted?: (description: string) => void;
  initialCustomerConfigs?: Array<{ id: string; fantasyName?: string; corporateName?: string; cnpj?: string }>;
  taskResponsibles?: Array<{ id: string; name: string; role: string }>;
  /** Task artworks available for selection as quote layout */
  artworks?: ArtworkOption[];
}

export interface QuoteSelectorRef {
  addItem: () => void;
  clearAll: () => void;
  replaceItems: (newItems: any[]) => void;
}

// Payment condition options (simplified - maps directly to PaymentCondition enum)
// Labels show cumulative payment dates: "Entrada + 20/40" = payment on day 0 (entrada), day 20, day 40
const PAYMENT_CONDITIONS = [
  { value: "CASH", label: "À vista" },
  { value: "INSTALLMENTS_2", label: "Entrada + 20" },
  { value: "INSTALLMENTS_3", label: "Entrada + 20/40" },
  { value: "INSTALLMENTS_4", label: "Entrada + 20/40/60" },
  { value: "INSTALLMENTS_5", label: "Entrada + 20/40/60/80" },
  { value: "INSTALLMENTS_6", label: "Entrada + 20/40/60/80/100" },
  { value: "INSTALLMENTS_7", label: "Entrada + 20/40/60/80/100/120" },
  { value: "CUSTOM", label: "Personalizado" },
] as const;

// Guarantee options
const GUARANTEE_OPTIONS = [
  { value: "5", label: "5 anos" },
  { value: "10", label: "10 anos" },
  { value: "15", label: "15 anos" },
  { value: "CUSTOM", label: "Personalizado" },
] as const;

// Validity days options (1-30 days)
const VALIDITY_DAYS_OPTIONS = Array.from({ length: 30 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1} ${i + 1 === 1 ? 'dia' : 'dias'}`,
}));

export const QuoteSelector = forwardRef<
  QuoteSelectorRef,
  QuoteSelectorProps
>(({ control, disabled, userRole, readOnly, onItemCountChange, layoutFiles: externalLayoutFiles, onLayoutFilesChange, onItemDeleted, initialCustomerConfigs, taskResponsibles, artworks }, ref) => {
  const [initialized, setInitialized] = useState(false);
  const [validityPeriod, setValidityPeriod] = useState<number | null>(null);
  const [showCustomPayment, setShowCustomPayment] = useState<Record<string, boolean>>({});
  const [showCustomGuarantee, setShowCustomGuarantee] = useState(false);
  const [showLayoutUploadMode, setShowLayoutUploadMode] = useState(false);
  const fileViewer = useFileViewer();
  // Use external layout files if provided, otherwise use local state
  const [localLayoutFiles, setLocalLayoutFiles] = useState<FileWithPreview[]>([]);
  const layoutFiles = externalLayoutFiles ?? localLayoutFiles;
  const setLayoutFiles = onLayoutFilesChange ?? setLocalLayoutFiles;
  const lastRowRef = useRef<HTMLDivElement>(null);
  const { setValue, clearErrors, getValues } = useFormContext();

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "quote.services",
  });

  // Watch quote values
  const quoteItems = useWatch({ control, name: "quote.services" });
  const quoteExpiresAt = useWatch({ control, name: "quote.expiresAt" });
  const guaranteeYears = useWatch({ control, name: "quote.guaranteeYears" });
  const customGuaranteeText = useWatch({ control, name: "quote.customGuaranteeText" });

  // Derive current guarantee option from stored values
  const currentGuaranteeOption = useMemo(() => {
    if (customGuaranteeText) return "CUSTOM";
    if (guaranteeYears) return guaranteeYears.toString();
    return "";
  }, [guaranteeYears, customGuaranteeText]);

  // Initialize custom states from existing data
  useEffect(() => {
    // Per-customer custom payment text
    const configs = getValues("quote.customerConfigs") || [];
    if (Array.isArray(configs)) {
      configs.forEach((config: any) => {
        if (config?.customPaymentText && config?.customerId && !showCustomPayment[config.customerId]) {
          setShowCustomPayment(prev => ({ ...prev, [config.customerId]: true }));
        }
      });
    }
    if (customGuaranteeText && !showCustomGuarantee) {
      setShowCustomGuarantee(true);
    }
  }, [customGuaranteeText, showCustomPayment, showCustomGuarantee, getValues]);

  // Note: Layout files initialization is now handled by the parent component (task-edit-form)
  // which passes the actual file data from the API including correct size information.
  // The layoutFileId is only used for tracking changes, not for creating placeholder files.

  // Handle layout file change (from file upload)
  const handleLayoutFileChange = useCallback((files: FileWithPreview[]) => {
    setLayoutFiles(files);
    if (files.length > 0 && files[0].uploadedFileId) {
      setValue("quote.layoutFileId", files[0].uploadedFileId);
    } else if (files.length === 0) {
      setValue("quote.layoutFileId", null);
    }
  }, [setValue, setLayoutFiles]);

  // Handle artwork selection as layout file
  const handleArtworkSelect = useCallback((value: string | string[] | null | undefined) => {
    const fileId = typeof value === "string" ? value : null;
    if (fileId === "__UPLOAD_NEW__") {
      setShowLayoutUploadMode(true);
      return;
    }
    if (fileId) {
      const artwork = artworks?.find(a => a.id === fileId);
      if (artwork) {
        const filePreview: FileWithPreview = {
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
        setLayoutFiles([filePreview]);
        setValue("quote.layoutFileId", artwork.id);
        setShowLayoutUploadMode(false);
      }
    } else {
      setLayoutFiles([]);
      setValue("quote.layoutFileId", null);
    }
  }, [artworks, setValue, setLayoutFiles]);

  // Artwork options for the combobox (image artworks + "upload new" action)
  const UPLOAD_NEW_SENTINEL = "__UPLOAD_NEW__";
  const artworkOptions = useMemo(() => {
    if (!artworks || artworks.length === 0) return [];
    const imageArtworks = artworks.filter(a => {
      const mime = a.mimetype || "";
      return mime.startsWith("image/");
    });
    if (imageArtworks.length === 0) return [];
    // Add "Enviar novo arquivo" as the last option
    return [
      ...imageArtworks,
      { id: UPLOAD_NEW_SENTINEL, filename: "Enviar novo arquivo" } as ArtworkOption,
    ];
  }, [artworks]);

  // Render artwork option with thumbnail (or upload action for sentinel)
  const renderArtworkOption = useCallback((artwork: ArtworkOption) => {
    if (artwork.id === UPLOAD_NEW_SENTINEL) {
      return (
        <div className="flex items-center gap-3 w-full py-1 text-muted-foreground">
          <div className="w-12 h-12 rounded-md border border-dashed border-border overflow-hidden shrink-0 bg-muted/50 flex items-center justify-center">
            <IconUpload className="h-5 w-5" />
          </div>
          <p className="text-sm">Enviar novo arquivo</p>
        </div>
      );
    }
    const thumbnailSrc = artwork.thumbnailUrl
      ? artwork.thumbnailUrl
      : `${getApiBaseUrl()}/files/thumbnail/${artwork.id}`;
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
          <p className="text-sm truncate">{artwork.originalName || artwork.filename || "Arquivo"}</p>
          {artwork.status && (
            <p className="text-xs text-muted-foreground">
              {artwork.status === "APPROVED" ? "Aprovado" : artwork.status === "REPROVED" ? "Reprovado" : "Rascunho"}
            </p>
          )}
        </div>
      </div>
    );
  }, []);

  // Current layoutFileId to track selected artwork
  const currentLayoutFileId = useWatch({ control, name: "quote.layoutFileId" });

  // Customers cache for invoice-to multi-select
  const customersCache = useRef<Map<string, any>>(new Map());
  const [selectedCustomers, setSelectedCustomers] = useState<Map<string, any>>(new Map());

  // Initialize cache with initial customers passed from form (no async fetch needed)
  useEffect(() => {
    if (initialCustomerConfigs && initialCustomerConfigs.length > 0) {
      // Use customer objects passed directly from the API response
      initialCustomerConfigs.forEach(customer => {
        customersCache.current.set(customer.id, customer);
      });
      setSelectedCustomers(new Map(initialCustomerConfigs.map(c => [c.id, c])));
    } else {
      // Fallback: try to fetch from form values if no initial customers provided
      const customerConfigs = getValues("quote.customerConfigs");
      const customerConfigIds = Array.isArray(customerConfigs)
        ? customerConfigs.map((c: any) => typeof c === 'string' ? c : c.customerId).filter(Boolean)
        : [];
      if (customerConfigIds.length > 0) {
        const uncachedIds = customerConfigIds.filter((id: string) => !customersCache.current.has(id));
        if (uncachedIds.length > 0) {
          getCustomers({
            where: { id: { in: uncachedIds } },
            include: { logo: true }
          }).then(response => {
            if (response.data) {
              response.data.forEach(customer => {
                customersCache.current.set(customer.id, customer);
              });
              setSelectedCustomers(new Map(response.data.map(c => [c.id, c])));
            }
          }).catch((err) => {
            console.error('[QuoteSelector] Failed to fetch initial invoiceTo customers:', err);
          });
        }
      }
    }
  }, []); // Run only on mount

  // Watch customerConfigs and clear orphaned service assignments
  const watchedCustomerConfigs = useWatch({ control, name: "quote.customerConfigs" });
  useEffect(() => {
    const configs = watchedCustomerConfigs || [];
    const currentIds = Array.isArray(configs)
      ? configs.map((c: any) => typeof c === 'string' ? c : c.customerId).filter(Boolean)
      : [];
    const items = getValues("quote.services") || [];
    items.forEach((item: any, index: number) => {
      if (item.invoiceToCustomerId && !currentIds.includes(item.invoiceToCustomerId)) {
        setValue(`quote.services.${index}.invoiceToCustomerId`, null);
      }
    });
  }, [watchedCustomerConfigs, getValues, setValue]);

  // (root-to-config sync removed — all billing fields now live on customerConfigs)

  // Search function for customers Combobox
  const searchCustomers = useCallback(async (
    search: string,
    page: number = 1,
  ): Promise<{
    data: any[];
    hasMore: boolean;
  }> => {
    const params: any = {
      orderBy: { fantasyName: "asc" },
      page: page,
      take: 50,
      include: { logo: true },
    };

    if (search && search.trim()) {
      params.searchingFor = search.trim();
    }

    try {
      const response = await getCustomers(params);
      const customers = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      // Cache all customers we fetch
      customers.forEach(customer => {
        customersCache.current.set(customer.id, customer);
      });

      return {
        data: customers,
        hasMore: hasMore,
      };
    } catch (error) {
      return { data: [], hasMore: false };
    }
  }, []);

  // Memoize callbacks
  const getCustomerLabel = useCallback((customer: any) => customer.fantasyName || customer.corporateName || 'Cliente sem nome', []);
  const getCustomerValue = useCallback((customer: any) => customer.id, []);

  // Aggregate subtotal from all quote items (services sum)
  const subtotal = useMemo(() => {
    if (!quoteItems || quoteItems.length === 0) return 0;
    return quoteItems.reduce((sum: number, item: any) => {
      const amount = typeof item.amount === 'number' ? item.amount : Number(item.amount) || 0;
      return sum + amount;
    }, 0);
  }, [quoteItems]);

  // Aggregate total from customerConfigs (sum of per-config totals)
  const aggregateTotal = useMemo(() => {
    if (!Array.isArray(watchedCustomerConfigs) || watchedCustomerConfigs.length === 0) return subtotal;
    return watchedCustomerConfigs.reduce((sum: number, config: any) => {
      if (!config || typeof config !== 'object') return sum;
      return sum + (typeof config.total === 'number' ? config.total : Number(config.total) || 0);
    }, 0);
  }, [watchedCustomerConfigs, subtotal]);

  // Check if any quote item is incomplete
  // An item is incomplete only if it has amount > 0 but no description
  // Empty items (no description AND no amount) are allowed and filtered on submit
  const hasIncompleteQuote = useMemo(() => {
    if (!quoteItems || quoteItems.length === 0) return false;
    return quoteItems.some((item: any) => {
      const hasDescription = item.description && item.description.trim() !== "";
      const hasAmount = item.amount !== null && item.amount !== undefined && item.amount > 0;
      // Only incomplete if has amount but no description
      return hasAmount && !hasDescription;
    });
  }, [quoteItems]);

  // Initialize local state from form data
  useEffect(() => {
    if (!initialized) {
      const expiresAt = getValues("quote.expiresAt");
      const items = getValues("quote.services");
      const hasItems = items && items.length > 0;

      if (expiresAt) {
        const today = new Date();
        const diffTime = new Date(expiresAt).getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 0 && diffDays <= 90) {
          setValidityPeriod(diffDays);
        } else {
          setValidityPeriod(30);
        }
      } else {
        // Default to 30 days
        setValidityPeriod(30);
        // If there are items but no expiresAt, set a default expiry date
        // This fixes validation errors when editing tasks with quote items but no expiry
        if (hasItems) {
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + 30);
          expiryDate.setHours(23, 59, 59, 999);
          setValue("quote.expiresAt", expiryDate, { shouldDirty: false });
        }
      }
      setInitialized(true);
    }
  }, [initialized, getValues, setValue]);

  // Notify parent about count changes
  useEffect(() => {
    if (onItemCountChange) {
      const count = quoteItems && quoteItems.length > 0 ? 1 : 0;
      onItemCountChange(count);
    }
  }, [quoteItems, onItemCountChange]);

  // Update aggregate subtotal and total in form
  useEffect(() => {
    if (quoteItems && quoteItems.length > 0) {
      const currentSubtotal = getValues("quote.subtotal");
      const currentTotal = getValues("quote.total");
      // Aggregate subtotal from configs (or use services sum if single-config mode)
      const configSubtotalSum = Array.isArray(watchedCustomerConfigs) && watchedCustomerConfigs.length > 0
        ? watchedCustomerConfigs.reduce((sum: number, c: any) => sum + (typeof c?.subtotal === 'number' ? c.subtotal : Number(c?.subtotal) || 0), 0)
        : subtotal;
      if (currentSubtotal !== configSubtotalSum) {
        setValue("quote.subtotal", configSubtotalSum, { shouldDirty: false });
      }
      if (currentTotal !== aggregateTotal) {
        setValue("quote.total", aggregateTotal, { shouldDirty: false });
      }
    }
  }, [subtotal, aggregateTotal, quoteItems, watchedCustomerConfigs, setValue, getValues]);

  // Auto-calculate per-customer subtotals/totals based on service invoiceToCustomerId assignments
  useEffect(() => {
    const configs = watchedCustomerConfigs;
    if (!Array.isArray(configs) || configs.length < 1 || !quoteItems) return;

    const services = quoteItems || [];
    let updated = false;

    const newConfigs = configs.map((config: any) => {
      if (!config || typeof config !== 'object') return config;
      const customerId = config.customerId;
      if (!customerId) return config;

      // Sum amounts of services assigned to this customer
      // When there's only one config, unassigned services (no invoiceToCustomerId) belong to it
      const isSingleConfig = configs.length === 1;
      const customerSubtotal = services.reduce((sum: number, svc: any) => {
        if (svc.invoiceToCustomerId === customerId || (isSingleConfig && !svc.invoiceToCustomerId)) {
          const amount = typeof svc.amount === 'number' ? svc.amount : Number(svc.amount) || 0;
          return sum + amount;
        }
        return sum;
      }, 0);

      const roundedSubtotal = Math.round(customerSubtotal * 100) / 100;

      // Calculate per-customer total from service-level discounts
      const customerTotal = services.reduce((sum: number, svc: any) => {
        if (svc.invoiceToCustomerId === customerId || (isSingleConfig && !svc.invoiceToCustomerId)) {
          const amount = typeof svc.amount === 'number' ? svc.amount : Number(svc.amount) || 0;
          let discount = 0;
          if (svc.discountType === 'PERCENTAGE' && svc.discountValue) {
            discount = Math.round((amount * svc.discountValue / 100) * 100) / 100;
          } else if (svc.discountType === 'FIXED_VALUE' && svc.discountValue) {
            discount = Math.min(svc.discountValue, amount);
          }
          return sum + Math.max(0, amount - discount);
        }
        return sum;
      }, 0);
      const roundedTotal = Math.max(0, Math.round(customerTotal * 100) / 100);

      if (config.subtotal !== roundedSubtotal || config.total !== roundedTotal) {
        updated = true;
        return { ...config, subtotal: roundedSubtotal, total: roundedTotal };
      }
      return config;
    });

    if (updated) {
      setValue("quote.customerConfigs", newConfigs, { shouldDirty: false });
    }
  }, [quoteItems, watchedCustomerConfigs, setValue]);

  const handleAddItem = useCallback(() => {
    clearErrors("quote");
    if (fields.length === 0) {
      const defaultPeriod = 30;
      setValidityPeriod(defaultPeriod);
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + defaultPeriod);
      expiryDate.setHours(23, 59, 59, 999);
      setValue("quote.expiresAt", expiryDate);
      setValue("quote.status", "PENDING");
      setValue("quote.subtotal", 0);
      setValue("quote.total", 0);
    }
    // Append adds to the end, so new item appears right above the button
    append({ description: "", observation: null, amount: undefined });
    // Focus the new item (last one in the list)
    setTimeout(() => {
      if (lastRowRef.current) {
        const combobox = lastRowRef.current.querySelector('[role="combobox"]') as HTMLElement;
        combobox?.focus();
      }
    }, 100);
  }, [append, clearErrors, fields.length, setValue]);

  const clearAll = useCallback(() => {
    for (let i = fields.length - 1; i >= 0; i--) {
      remove(i);
    }
    setValue("quote", undefined);
    clearErrors("quote");
    setValidityPeriod(null);
    setShowCustomPayment({});
    setShowCustomGuarantee(false);
    setLayoutFiles([]);
  }, [fields.length, remove, setValue, clearErrors]);

  useImperativeHandle(ref, () => ({ addItem: handleAddItem, clearAll, replaceItems: replace }), [handleAddItem, clearAll, replace]);

  const canEditStatus = userRole === 'ADMIN' || userRole === 'FINANCIAL' || userRole === 'COMMERCIAL';

  const statusOptions = Object.values(TASK_QUOTE_STATUS).map((value) => ({
    value,
    label: TASK_QUOTE_STATUS_LABELS[value],
  }));

  const validityPeriodOptions = [
    { label: '15 dias', value: '15' },
    { label: '30 dias', value: '30' },
    { label: '60 dias', value: '60' },
    { label: '90 dias', value: '90' },
  ];

  const handleValidityPeriodChange = useCallback((period: string) => {
    const days = Number(period);
    setValidityPeriod(days);
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);
    expiryDate.setHours(23, 59, 59, 999);
    setValue("quote.expiresAt", expiryDate);
  }, [setValue]);

  useEffect(() => {
    if (!quoteExpiresAt || validityPeriod !== null) return;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const expiryDate = new Date(quoteExpiresAt);
    expiryDate.setHours(0, 0, 0, 0);
    const diffInMs = expiryDate.getTime() - now.getTime();
    const diffInDays = Math.round(diffInMs / (1000 * 60 * 60 * 24));
    const periods = [15, 30, 60, 90];
    for (const period of periods) {
      if (Math.abs(diffInDays - period) <= 1) {
        setValidityPeriod(period);
        break;
      }
    }
  }, [quoteExpiresAt, validityPeriod]);

  // Per-customer payment condition change
  const handleCustomerPaymentConditionChange = useCallback((value: string, configIndex: number, customerId: string) => {
    if (value === "CUSTOM") {
      setShowCustomPayment(prev => ({ ...prev, [customerId]: true }));
      setValue(`quote.customerConfigs.${configIndex}.paymentCondition`, "CUSTOM");
    } else {
      setShowCustomPayment(prev => ({ ...prev, [customerId]: false }));
      setValue(`quote.customerConfigs.${configIndex}.customPaymentText`, null);
      setValue(`quote.customerConfigs.${configIndex}.paymentCondition`, value || null);
    }
  }, [setValue]);

  const handleGuaranteeOptionChange = useCallback((value: string) => {
    if (value === "CUSTOM") {
      setShowCustomGuarantee(true);
      setValue("quote.guaranteeYears", null);
    } else {
      setShowCustomGuarantee(false);
      setValue("quote.customGuaranteeText", null);
      setValue("quote.guaranteeYears", value ? Number(value) : null);
    }
  }, [setValue]);

  const hasQuoteItems = quoteItems && quoteItems.length > 0;

  // Handler to remove an item and track deletion
  const handleRemoveItem = useCallback((index: number) => {
    const item = quoteItems?.[index];
    if (item?.description && onItemDeleted) {
      onItemDeleted(item.description);
    }
    remove(index);
  }, [quoteItems, onItemDeleted, remove]);

  return (
    <div className="space-y-4">
      {/* Customer Configs (Invoice To) - First section */}
      {hasQuoteItems && (
        <FormField
          control={control}
          name="quote.customerConfigs"
          render={({ field }) => {
            // Derive IDs from config objects for the Combobox
            const configIds = Array.isArray(field.value)
              ? field.value.map((c: any) => typeof c === 'string' ? c : c.customerId).filter(Boolean)
              : [];

            // Update selected customers when field value changes
            useEffect(() => {
              if (configIds.length > 0) {
                const newSelectedCustomers = new Map<string, any>();
                configIds.forEach((customerId: string) => {
                  const cachedCustomer = customersCache.current.get(customerId);
                  if (cachedCustomer) {
                    newSelectedCustomers.set(customerId, cachedCustomer);
                  }
                });
                setSelectedCustomers(newSelectedCustomers);
              } else {
                setSelectedCustomers(new Map());
              }
            }, [JSON.stringify(configIds)]);

            // Handle Combobox value change: convert ID additions/removals to config objects
            const handleCustomerConfigChange = (newIds: string | string[] | null | undefined) => {
              const ids = Array.isArray(newIds) ? newIds : [];
              const currentConfigs: any[] = Array.isArray(field.value) ? field.value : [];

              // Build new configs: keep existing ones, add new ones with defaults
              const newConfigs = ids.map((id: string) => {
                const existing = currentConfigs.find((c: any) =>
                  (typeof c === 'string' ? c : c.customerId) === id
                );
                if (existing && typeof existing === 'object') return existing;
                return {
                  customerId: id,
                  subtotal: 0,
                  discountType: 'NONE' as const,
                  discountValue: null,
                  total: 0,
                  paymentCondition: null,
                  downPaymentDate: null,
                  customPaymentText: null,
                  responsibleId: null,
                  discountReference: null,
                };
              });
              field.onChange(newConfigs);
            };

            return (
              <FormItem>
                <FormLabel>Faturar Para (Clientes)</FormLabel>
                <FormControl>
                  <div className="space-y-3">
                    <Combobox
                      value={configIds}
                      onValueChange={handleCustomerConfigChange}
                      mode="multiple"
                      placeholder="Selecione clientes para faturamento..."
                      emptyText="Nenhum cliente encontrado"
                      searchPlaceholder="Pesquisar por nome ou CNPJ..."
                      disabled={disabled || readOnly}
                      async={true}
                      queryKey={["customers", "invoice-selector"]}
                      queryFn={searchCustomers}
                      getOptionLabel={getCustomerLabel}
                      getOptionValue={getCustomerValue}
                      renderOption={(customer: any, _isSelected: boolean) => (
                        <div className="flex items-center gap-3">
                          <CustomerLogoDisplay
                            logo={customer.logo}
                            customerName={customer.fantasyName}
                            size="sm"
                            shape="rounded"
                            className="flex-shrink-0"
                          />
                          <div className="flex flex-col gap-1 min-w-0 flex-1">
                            <div className="font-medium truncate">{customer.fantasyName}</div>
                            <div className="flex items-center gap-2 text-sm truncate group-hover:text-white transition-colors">
                              {customer.corporateName && <span className="truncate">{customer.corporateName}</span>}
                              {customer.cnpj && (
                                <>
                                  {customer.corporateName && <span className="opacity-50">•</span>}
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

                    {/* Selected customers display */}
                    {selectedCustomers.size > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {Array.from(selectedCustomers.values()).map((customer) => (
                          <Badge
                            key={customer.id}
                            variant="secondary"
                            className={cn(
                              "pl-2.5 pr-2.5 py-1.5 flex items-center gap-2 border transition-colors",
                              !disabled && !readOnly && "cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                            )}
                            onClick={disabled || readOnly ? undefined : (e) => {
                              e.preventDefault();
                              const currentConfigs: any[] = Array.isArray(field.value) ? field.value : [];
                              field.onChange(currentConfigs.filter((c: any) =>
                                (typeof c === 'string' ? c : c.customerId) !== customer.id
                              ));
                            }}
                          >
                            <CustomerLogoDisplay
                              logo={customer.logo}
                              customerName={customer.fantasyName}
                              size="xs"
                              shape="rounded"
                              className="flex-shrink-0"
                            />
                            <span className="text-xs font-medium">{customer.fantasyName || customer.corporateName}</span>
                            {customer.cnpj && <span className="text-xs opacity-70">({formatCNPJ(customer.cnpj)})</span>}
                            {!disabled && !readOnly && <IconX className="h-3 w-3 ml-1" />}
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
      )}

      {/* Quote Items - displayed in order, newest at bottom */}
      {fields.length > 0 && (
        <div className="space-y-3">
          {fields.map((field, index) => (
            <QuoteItemRow
              key={field.id}
              control={control}
              index={index}
              disabled={disabled}
              readOnly={readOnly}
              onRemove={() => handleRemoveItem(index)}
              isFirstRow={index === 0}
              isLastRow={index === fields.length - 1}
              ref={index === fields.length - 1 ? lastRowRef : null}
              customerConfigCustomers={Array.from(selectedCustomers.values())}
            />
          ))}
        </div>
      )}

      {/* Add Service Button - Always at bottom, new items appear above */}
      {!readOnly && !disabled && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddItem}
          disabled={disabled}
          className="w-full"
        >
          <IconPlus className="h-4 w-4 mr-2" />
          Adicionar Serviço
        </Button>
      )}

      {/* Totals (aggregated from customer configs) */}
      {hasQuoteItems && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              <IconCurrencyReal className="h-4 w-4" />
              Subtotal
            </FormLabel>
            <FormControl>
              <Input
                value={formatCurrency(subtotal)}
                readOnly
                className="bg-muted cursor-not-allowed font-medium"
              />
            </FormControl>
          </FormItem>

          <FormItem>
            <FormLabel className="flex items-center gap-2">
              <IconCurrencyReal className="h-4 w-4" />
              Valor Total
            </FormLabel>
            <FormControl>
              <Input
                value={formatCurrency(aggregateTotal)}
                readOnly
                className="bg-transparent font-bold text-lg text-primary cursor-not-allowed border-primary"
              />
            </FormControl>
          </FormItem>
        </div>
      )}

      {/* Status & Validity */}
      {hasQuoteItems && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={control}
            name="quote.status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status do Orçamento</FormLabel>
                <FormControl>
                  <Combobox
                    options={statusOptions}
                    value={field.value || 'PENDING'}
                    onValueChange={field.onChange}
                    placeholder="Selecione o status"
                    emptyText="Nenhum status encontrado"
                    disabled={disabled || !canEditStatus || readOnly}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="quote.expiresAt"
            render={({ field: _field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <IconCalendar className="h-4 w-4" />
                  Validade da Proposta
                  <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Combobox
                    value={validityPeriod?.toString() || ""}
                    onValueChange={(value) => {
                      if (typeof value === 'string') {
                        handleValidityPeriodChange(value);
                      }
                    }}
                    options={validityPeriodOptions}
                    placeholder="Selecione o período"
                    emptyText="Nenhum período encontrado"
                    disabled={disabled || readOnly}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}

      {/* Payment Sections - Per-Customer */}
      {hasQuoteItems && Array.isArray(watchedCustomerConfigs) && watchedCustomerConfigs.length >= 1 && (
        <div className="space-y-4">
          {watchedCustomerConfigs.length >= 2 && (
            <FormLabel>Configurações por Cliente</FormLabel>
          )}
          {watchedCustomerConfigs.map((config: any, i: number) => {
            const customerId = typeof config === 'string' ? config : config?.customerId;
            if (!customerId) return null;
            const customer = selectedCustomers.get(customerId);
            const configPaymentCondition = config?.paymentCondition || "";
            const configCustomPaymentText = config?.customPaymentText;
            const currentCondition = configCustomPaymentText ? "CUSTOM" : configPaymentCondition;
            const configSubtotal = config?.subtotal || 0;
            const configDiscountType = config?.discountType || 'NONE';
            const configTotal = config?.total || 0;
            const isMultiCustomer = watchedCustomerConfigs.length >= 2;

            return (
              <div key={customerId} className={isMultiCustomer ? "border border-dashed border-border rounded-lg p-4 space-y-4" : "space-y-4"}>
                {isMultiCustomer && (
                <h4 className="font-medium text-sm flex items-center gap-2">
                  {customer && (
                    <CustomerLogoDisplay
                      logo={customer.logo}
                      customerName={customer.fantasyName}
                      size="xs"
                      shape="rounded"
                      className="flex-shrink-0"
                    />
                  )}
                  {customer?.fantasyName || customer?.corporateName || "Cliente"}
                </h4>
                )}

                {/* Budget Responsible per customer */}
                {taskResponsibles && taskResponsibles.length > 0 && (
                  <FormField
                    control={control}
                    name={`quote.customerConfigs.${i}.responsibleId`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Responsável do Orçamento</FormLabel>
                        <FormControl>
                          <Combobox
                            value={field.value || ''}
                            onValueChange={(value) => {
                              field.onChange(value || null);
                            }}
                            options={taskResponsibles
                              .filter(r => !r.id.startsWith('temp-'))
                              .map(r => ({
                                value: r.id,
                                label: `${r.name} (${RESPONSIBLE_ROLE_LABELS[r.role as keyof typeof RESPONSIBLE_ROLE_LABELS] || r.role})`,
                              }))}
                            placeholder="Selecione o responsável do orçamento"
                            emptyText="Nenhum responsável disponível"
                            disabled={disabled || readOnly}
                            searchable={false}
                            clearable={true}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Payment & Method */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Payment Condition */}
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Condição de Pagamento</FormLabel>
                    <FormControl>
                      <Combobox
                        value={currentCondition}
                        onValueChange={(value) => {
                          if (typeof value === 'string') {
                            handleCustomerPaymentConditionChange(value, i, customerId);
                          }
                        }}
                        disabled={disabled || readOnly}
                        options={PAYMENT_CONDITIONS.map((opt) => ({
                          value: opt.value,
                          label: opt.label,
                        }))}
                        placeholder="Selecione"
                        emptyText="Nenhuma opção"
                      />
                    </FormControl>
                  </FormItem>

                  {/* Down Payment Date */}
                  <FormField
                    control={control}
                    name={`quote.customerConfigs.${i}.downPaymentDate`}
                    render={({ field }) => (
                      <DateTimeInput
                        field={field}
                        mode="date"
                        label="Data da Entrada"
                        disabled={disabled || readOnly}
                      />
                    )}
                  />

                  {/* Payment Method */}
                  </div>

                {/* Custom Payment Text */}
                {showCustomPayment[customerId] && (
                  <FormField
                    control={control}
                    name={`quote.customerConfigs.${i}.customPaymentText`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Texto Personalizado de Pagamento</FormLabel>
                        <FormControl>
                          <textarea
                            {...field}
                            value={field.value || ""}
                            placeholder="Descreva as condições de pagamento personalizadas..."
                            disabled={disabled || readOnly}
                            rows={3}
                            className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Per-Customer Discount */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Discount Type */}
                  <FormField
                    control={control}
                    name={`quote.customerConfigs.${i}.discountType`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Desconto</FormLabel>
                        <FormControl>
                          <Combobox
                            value={field.value || 'NONE'}
                            onValueChange={(value) => {
                              const safeType = value || 'NONE';
                              field.onChange(safeType);
                              if (safeType === 'NONE') {
                                setValue(`quote.customerConfigs.${i}.discountValue`, null);
                                setValue(`quote.customerConfigs.${i}.discountReference`, null);
                              }
                            }}
                            disabled={disabled || readOnly}
                            options={Object.values(DISCOUNT_TYPE).map((type) => ({
                              value: type,
                              label: DISCOUNT_TYPE_LABELS[type],
                            }))}
                            placeholder="Selecione"
                            emptyText="Nenhuma opção"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Discount Value */}
                  <FormField
                    control={control}
                    name={`quote.customerConfigs.${i}.discountValue`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Valor Desconto
                          {configDiscountType === 'PERCENTAGE' && <span className="text-muted-foreground ml-1">(%)</span>}
                          {configDiscountType === 'FIXED_VALUE' && <span className="text-muted-foreground ml-1">(R$)</span>}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type={configDiscountType === 'FIXED_VALUE' ? 'currency' : 'number'}
                            value={field.value ?? ""}
                            onChange={(value) => {
                              if (configDiscountType === 'FIXED_VALUE') {
                                field.onChange(value);
                              } else {
                                const num = Number(value);
                                field.onChange(isNaN(num) ? null : num);
                              }
                            }}
                            disabled={disabled || readOnly || configDiscountType === 'NONE'}
                            placeholder={configDiscountType === 'NONE' ? "-" : configDiscountType === 'FIXED_VALUE' ? "R$ 0,00" : "0"}
                            min={configDiscountType === 'PERCENTAGE' ? 0 : undefined}
                            max={configDiscountType === 'PERCENTAGE' ? 100 : undefined}
                            step={configDiscountType === 'PERCENTAGE' ? 0.01 : undefined}
                            className="bg-transparent"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Discount Reference */}
                  <FormField
                    control={control}
                    name={`quote.customerConfigs.${i}.discountReference`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Referência Desconto</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value || ""}
                            placeholder={configDiscountType === 'NONE' ? "-" : "Justificativa..."}
                            disabled={disabled || readOnly || configDiscountType === 'NONE'}
                            maxLength={500}
                            className="bg-transparent"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Per-Customer Subtotal & Total (only show when multiple customers) */}
                {isMultiCustomer && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Subtotal (auto-calculated from assigned services) */}
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      <IconCurrencyReal className="h-3.5 w-3.5" />
                      Subtotal
                    </FormLabel>
                    <FormControl>
                      <Input
                        value={formatCurrency(configSubtotal)}
                        readOnly
                        className="bg-muted cursor-not-allowed text-sm"
                      />
                    </FormControl>
                  </FormItem>

                  {/* Total (auto-calculated) */}
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      <IconCurrencyReal className="h-3.5 w-3.5 text-primary" />
                      Valor Total
                    </FormLabel>
                    <FormControl>
                      <Input
                        value={formatCurrency(configTotal)}
                        readOnly
                        className="bg-transparent font-bold text-lg text-primary cursor-not-allowed border-primary"
                      />
                    </FormControl>
                  </FormItem>
                </div>}
              </div>
            );
          })}
        </div>
      )}

      {/* Custom Guarantee Text */}
      {hasQuoteItems && showCustomGuarantee && (
        <FormField
          control={control}
          name="quote.customGuaranteeText"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Texto Personalizado de Garantia</FormLabel>
              <FormControl>
                <textarea
                  {...field}
                  value={field.value || ""}
                  placeholder="Descreva as condições de garantia personalizadas..."
                  disabled={disabled || readOnly}
                  rows={3}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Guarantee, Simultaneous Tasks & Forecast Days - 2/4, 1/4, 1/4 */}
      {hasQuoteItems && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {/* Guarantee - 2/4 width */}
          <FormItem className="sm:col-span-2">
            <FormLabel>Período de Garantia</FormLabel>
            <FormControl>
              <Combobox
                value={currentGuaranteeOption}
                onValueChange={(value) => {
                  if (typeof value === 'string') {
                    handleGuaranteeOptionChange(value);
                  }
                }}
                disabled={disabled || readOnly}
                options={GUARANTEE_OPTIONS.map((opt) => ({
                  value: opt.value,
                  label: opt.label,
                }))}
                placeholder="Selecione"
                emptyText="Nenhuma opção"
              />
            </FormControl>
          </FormItem>

          {/* Simultaneous Tasks - 1/4 width */}
          <FormField
            control={control}
            name="quote.simultaneousTasks"
            render={({ field }) => (
              <FormItem className="sm:col-span-1">
                <FormLabel>Tarefas Simultâneas</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    {...field}
                    value={field.value ?? ""}
                    onChange={(val) => {
                      const numVal = val ? Number(val) : null;
                      field.onChange(numVal);
                    }}
                    disabled={disabled || readOnly}
                    placeholder="1-100"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Forecast Days - 1/4 width */}
          <FormField
            control={control}
            name="quote.customForecastDays"
            render={({ field }) => (
              <FormItem className="sm:col-span-1">
                <FormLabel>Prazo Entrega</FormLabel>
                <FormControl>
                  <Combobox
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(value) => field.onChange(value ? Number(value) : null)}
                    disabled={disabled || readOnly}
                    options={VALIDITY_DAYS_OPTIONS}
                    placeholder="Auto"
                    emptyText="Nenhuma opção"
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
      )}

      {/* Layout File - Artwork Selector or Upload */}
      {hasQuoteItems && (
        <div className="space-y-3">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <IconPhoto className="h-4 w-4" />
            Layout Aprovado
          </h4>

          {/* Artwork selector mode (default when artworks exist) */}
          {artworkOptions.length > 0 && !showLayoutUploadMode && (
            <>
              <Combobox<ArtworkOption>
                value={currentLayoutFileId || ""}
                onValueChange={handleArtworkSelect}
                options={artworkOptions}
                getOptionValue={(a) => a.id}
                getOptionLabel={(a) => a.originalName || a.filename || "Arquivo"}
                renderOption={renderArtworkOption}
                placeholder="Selecionar uma arte existente..."
                emptyText="Nenhuma arte de imagem encontrada"
                disabled={disabled || readOnly}
                clearable
                searchable
              />

              {/* Selected artwork full image preview */}
              {currentLayoutFileId && artworkOptions.some(a => a.id === currentLayoutFileId) && (
                <div className="bg-muted/30 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-muted-foreground">
                      {artworkOptions.find(a => a.id === currentLayoutFileId)?.originalName
                        || artworkOptions.find(a => a.id === currentLayoutFileId)?.filename
                        || "Layout selecionado"}
                    </span>
                    {!(disabled || readOnly) && (
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
                        const selectedArtwork = artworkOptions.find(a => a.id === currentLayoutFileId);
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
            </>
          )}

          {/* File upload mode (default when no artworks, or toggled via "Enviar novo") */}
          {(artworkOptions.length === 0 || showLayoutUploadMode) && (
            <>
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
                disabled={disabled || readOnly}
                variant="compact"
                placeholder="Arraste ou clique para selecionar o layout"
                showPreview={true}
              />
            </>
          )}
        </div>
      )}

      {/* Validation Alert */}
      {hasIncompleteQuote && (
        <Alert variant="destructive">
          <AlertDescription>
            Alguns serviços do orçamento estão incompletos. Selecione o serviço e preencha o valor antes de enviar o formulário.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
});

QuoteSelector.displayName = "QuoteSelector";

// Quote Item Row Component with Observation Support
interface QuoteItemRowProps {
  control: any;
  index: number;
  disabled?: boolean;
  readOnly?: boolean;
  onRemove: () => void;
  isFirstRow: boolean;
  isLastRow: boolean;
  customerConfigCustomers?: Array<{ id: string; fantasyName?: string; corporateName?: string; cnpj?: string }>;
}

const QuoteItemRow = forwardRef<HTMLDivElement, QuoteItemRowProps>(
  ({ control, index, disabled, readOnly, onRemove, isFirstRow, isLastRow: _isLastRow, customerConfigCustomers }, ref) => {
    // Observation modal state
    const [isObservationModalOpen, setIsObservationModalOpen] = useState(false);
    const [tempObservation, setTempObservation] = useState("");

    // Watch observation field
    const currentObservation = useWatch({
      control,
      name: `quote.services.${index}.observation`,
      defaultValue: "",
    });

    // Get observation field controller for updating
    const { field: observationField } = useController({
      control,
      name: `quote.services.${index}.observation`,
      defaultValue: "",
    });

    // Handle opening observation modal
    const handleOpenObservationModal = () => {
      setTempObservation(currentObservation || "");
      setIsObservationModalOpen(true);
    };

    // Handle saving observation
    const handleSaveObservation = () => {
      observationField.onChange(tempObservation || null);
      setIsObservationModalOpen(false);
    };

    // Handle canceling observation modal
    const handleCancelObservation = () => {
      setTempObservation("");
      setIsObservationModalOpen(false);
    };

    // Check if observation has content
    const hasObservation = Boolean(currentObservation && currentObservation.trim());

    const hasMultipleCustomerConfigs = customerConfigCustomers && customerConfigCustomers.length >= 2;

    return (
      <>
        <div
          ref={ref}
          className={cn(
            "grid grid-cols-1 gap-4 items-end",
            hasMultipleCustomerConfigs
              ? "sm:grid-cols-[1fr_200px_260px]"
              : "sm:grid-cols-[1fr_260px]"
          )}
        >
          {/* Service Description - flexible width */}
          <div>
            <ServiceAutocomplete
              control={control}
              name={`quote.services.${index}.description`}
              disabled={disabled || readOnly}
              label="Serviço"
              placeholder="Selecione ou digite um serviço"
              showLabel={isFirstRow}
              type={SERVICE_ORDER_TYPE.PRODUCTION}
            />
          </div>

          {/* Customer Config Assignment - fixed 200px, only when 2+ customer configs */}
          {hasMultipleCustomerConfigs && (
            <div>
              <FormField
                control={control}
                name={`quote.services.${index}.invoiceToCustomerId`}
                render={({ field }) => (
                  <FormItem>
                    {isFirstRow && (
                      <FormLabel>Faturar para</FormLabel>
                    )}
                    <FormControl>
                      <Combobox
                        value={field.value || ""}
                        onValueChange={(value) => field.onChange(value || null)}
                        disabled={disabled || readOnly}
                        options={customerConfigCustomers.map((customer) => ({
                          value: customer.id,
                          label: customer.fantasyName || customer.corporateName || "Cliente sem nome",
                        }))}
                        placeholder="Selecione o cliente"
                        searchable={false}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          )}

          {/* Value + Buttons - fixed 180px */}
          <div className="flex items-end gap-2">
            <FormField
              control={control}
              name={`quote.services.${index}.amount`}
              render={({ field }) => (
                <FormItem className="flex-1">
                  {isFirstRow && (
                    <FormLabel className="flex items-center gap-2">
                      <IconCurrencyReal className="h-4 w-4" />
                      Valor
                    </FormLabel>
                  )}
                  <FormControl>
                    <Input
                      type="currency"
                      {...field}
                      placeholder="R$ 0,00"
                      disabled={disabled || readOnly}
                      className="bg-transparent"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Action Buttons */}
            <div className="flex items-center gap-1">
              {/* Observation Button */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleOpenObservationModal}
                disabled={disabled || readOnly}
                className="relative h-9 w-9"
                title={hasObservation ? "Ver/Editar observação" : "Adicionar observação"}
              >
                <IconNote className="h-4 w-4" />
                {hasObservation && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                    !
                  </span>
                )}
              </Button>

              {/* Remove Button */}
              {!readOnly && !disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onRemove}
                  disabled={disabled}
                  className="text-destructive h-9 w-9"
                  title="Remover serviço"
                >
                  <IconTrash className="h-4 w-4" />
                </Button>
              )}

            </div>
          </div>
        </div>

        {/* Observation Modal */}
        <Dialog open={isObservationModalOpen} onOpenChange={setIsObservationModalOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Observação do Serviço</DialogTitle>
              <DialogDescription>
                Adicione notas ou detalhes adicionais para este serviço do orçamento.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Textarea
                value={tempObservation}
                onChange={(e) => setTempObservation(e.target.value)}
                placeholder="Digite a observação..."
                rows={4}
                className="resize-none"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCancelObservation}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleSaveObservation}>
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }
);

QuoteItemRow.displayName = "QuoteItemRow";
