import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useSearchParams } from "react-router-dom";
import { IconLoader2, IconArrowLeft, IconArrowRight, IconCheck, IconTruck, IconPackage, IconShoppingCart, IconCalendar, IconFileInvoice, IconReceipt, IconCurrencyReal, IconFileText, IconNotes, IconClipboardList, IconCreditCard, IconPercentage } from "@tabler/icons-react";
import { ItemSelectorTable } from "@/components/inventory/common/item-selector";
import type { ItemGetManyFormData } from "../../../../schemas";
import type { OrderTemporaryItem } from "@/hooks/inventory/use-order-form-url-state";
import type { OrderUpdateFormData } from "../../../../schemas";
import type { Order, OrderItem } from "../../../../types";
import { orderUpdateSchema } from "../../../../schemas";
import { useOrderMutations, useItems, useCanViewPrices } from "../../../../hooks";
import { routes } from "../../../../constants";
import { toast } from "@/components/ui/sonner";
import { createOrderFormData } from "@/utils/form-data-helper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { PageHeader } from "@/components/ui/page-header";
import { FormSteps } from "@/components/ui/form-steps";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useOrderFormUrlState, composeTempItemDescription } from "@/hooks/inventory/use-order-form-url-state";
import { formatCurrency, formatDate, formatPixKey } from "../../../../utils";
import { exportOrderPdf } from "@/utils/order-pdf-generator";
import { OrderPdfExportButton } from "../common/order-pdf-export-button";
import { MEASURE_UNIT, MEASURE_UNIT_LABELS } from "../../../../constants";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { useSuppliers } from "../../../../hooks";
import { FileUploadField, type FileWithPreview } from "@/components/common/file";
import { Separator } from "@/components/ui/separator";
import { SupplierLogoDisplay } from "@/components/ui/avatar-display";
import { SECTOR_PRIVILEGES } from "../../../../constants";

interface OrderEditFormProps {
  order: Order & {
    items: OrderItem[];
    supplier?: {
      id: string;
      fantasyName: string;
    } | null;
  };
}

// Items step now mixes inventory selections + free-text temporary items in a single screen.
const STEPS = [
  {
    id: 1,
    name: "Informações Básicas",
    description: "Descrição e detalhes do pedido",
  },
  {
    id: 2,
    name: "Itens",
    description: "Escolha itens do estoque ou adicione itens temporários",
  },
  {
    id: 3,
    name: "Revisão",
    description: "Confirme os dados do pedido",
  },
];

// Generate a stable client-side key for a temporary item already persisted in the order.
const buildTempKey = (orderItemId: string) => `existing-${orderItemId}`;

// Simple URL step management
const getStepFromUrl = (searchParams: URLSearchParams): number => {
  const step = parseInt(searchParams.get("step") || "1", 10);
  return Math.max(1, Math.min(3, step));
};

const setStepInUrl = (searchParams: URLSearchParams, step: number): URLSearchParams => {
  const params = new URLSearchParams(searchParams);
  params.set("step", step.toString());
  return params;
};

export const OrderEditForm = ({ order }: OrderEditFormProps) => {
  const navigate = useNavigate();
  const canViewPrices = useCanViewPrices();
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize state from URL parameters
  const [currentStep, setCurrentStep] = useState(getStepFromUrl(searchParams));

  // Separate inventory items from temporary items so the URL state can hydrate both.
  const inventoryItems = useMemo(() =>
    order.items.filter(item => item.itemId),
    [order.items]
  );

  // Map existing temporary order items into the unified URL-state shape (with stable keys).
  const initialTemporaryItems = useMemo<OrderTemporaryItem[]>(() =>
    order.items.filter(item => !item.itemId).map(item => ({
      key: buildTempKey(item.id),
      temporaryItemDescription: item.temporaryItemDescription || "Item temporário",
      orderedQuantity: item.orderedQuantity,
      price: item.price,
      icms: item.icms || 0,
      ipi: item.ipi || 0,
    })),
    [order.items]
  );

  // Convert existing order data to initial state (only inventory items)
  const initialSelectedItems = useMemo(() => new Set(inventoryItems.map((item) => item.itemId!)), [inventoryItems]);

  const initialQuantities = useMemo(
    () =>
      inventoryItems.reduce(
        (acc, item) => {
          acc[item.itemId!] = item.orderedQuantity;
          return acc;
        },
        {} as Record<string, number>,
      ),
    [inventoryItems],
  );

  const initialPrices = useMemo(
    () =>
      inventoryItems.reduce(
        (acc, item) => {
          // Round to 2 decimal places to ensure compliance with moneySchema validation
          acc[item.itemId!] = Math.round(item.price * 100) / 100;
          return acc;
        },
        {} as Record<string, number>,
      ),
    [inventoryItems],
  );

  const initialIcmses = useMemo(
    () =>
      inventoryItems.reduce(
        (acc, item) => {
          acc[item.itemId!] = item.icms;
          return acc;
        },
        {} as Record<string, number>,
      ),
    [inventoryItems],
  );

  const initialIpis = useMemo(
    () =>
      inventoryItems.reduce(
        (acc, item) => {
          acc[item.itemId!] = item.ipi;
          return acc;
        },
        {} as Record<string, number>,
      ),
    [inventoryItems],
  );

  // Initialize file state with existing files from order
  const initialBudgetFiles = useMemo(() => {
    const files = (order.budgets || []).map(file => ({
      id: file.id,
      name: file.filename || file.originalName,
      size: file.size || 0,
      type: file.mimetype || 'application/octet-stream',
      lastModified: file.createdAt ? new Date(file.createdAt).getTime() : Date.now(),
      uploaded: true,
      uploadProgress: 100,
      uploadedFileId: file.id,
      thumbnailUrl: file.thumbnailUrl,
    } as FileWithPreview));
    return files;
  }, [order.budgets]);

  const initialReceiptFiles = useMemo(() => {
    const files = (order.receipts || []).map(file => ({
      id: file.id,
      name: file.filename || file.originalName,
      size: file.size || 0,
      type: file.mimetype || 'application/octet-stream',
      lastModified: file.createdAt ? new Date(file.createdAt).getTime() : Date.now(),
      uploaded: true,
      uploadProgress: 100,
      uploadedFileId: file.id,
      thumbnailUrl: file.thumbnailUrl,
    } as FileWithPreview));
    return files;
  }, [order.receipts]);

  const initialInvoiceFiles = useMemo(() => {
    const files = (order.invoices || []).map(file => ({
      id: file.id,
      name: file.filename || file.originalName,
      size: file.size || 0,
      type: file.mimetype || 'application/octet-stream',
      lastModified: file.createdAt ? new Date(file.createdAt).getTime() : Date.now(),
      uploaded: true,
      uploadProgress: 100,
      uploadedFileId: file.id,
      thumbnailUrl: file.thumbnailUrl,
    } as FileWithPreview));
    return files;
  }, [order.invoices]);

  // File upload state
  const [budgetFiles, setBudgetFiles] = useState<FileWithPreview[]>(initialBudgetFiles);
  const [receiptFiles, setReceiptFiles] = useState<FileWithPreview[]>(initialReceiptFiles);
  const [invoiceFiles, setInvoiceFiles] = useState<FileWithPreview[]>(initialInvoiceFiles);
  const [hasFileChanges, setHasFileChanges] = useState(false);

  // Sync file state when order files change
  useEffect(() => {
    setBudgetFiles(initialBudgetFiles);
    setReceiptFiles(initialReceiptFiles);
    setInvoiceFiles(initialInvoiceFiles);
  }, [initialBudgetFiles, initialReceiptFiles, initialInvoiceFiles]);

  // Local state for notes input to avoid slow typing from URL state updates
  const [localNotes, setLocalNotes] = useState(order.notes || "");
  const notesDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Memoize initialData to prevent infinite loop from recreating the object on every render.
  const initialDataForUrlState = useMemo(() => {
    return {
      description: order.description,
      supplierId: order.supplierId || undefined,
      forecast: order.forecast,
      notes: order.notes || "",
      freight: (order as any).freight ?? 0,
      discount: (order as any).discount ?? 0,
      selectedItems: initialSelectedItems,
      quantities: initialQuantities,
      prices: initialPrices,
      icmses: initialIcmses,
      ipis: initialIpis,
      temporaryItems: initialTemporaryItems,
    };
  }, [
    order.description,
    order.supplierId,
    order.forecast,
    order.notes,
    (order as any).freight,
    (order as any).discount,
    initialSelectedItems,
    initialQuantities,
    initialPrices,
    initialIcmses,
    initialIpis,
    initialTemporaryItems,
  ]);

  // URL state management — initialized with existing data, includes unified temp items + freight.
  const {
    selectedItems,
    quantities,
    prices,
    icmses,
    ipis,
    description,
    supplierId,
    forecast,
    notes,
    freight,
    discount,
    temporaryItems,
    addTemporaryItem,
    updateTemporaryItem,
    removeTemporaryItem,
    updateDescription,
    updateSupplierId,
    updateForecast,
    updateNotes,
    updateFreight,
    updateDiscount,
    showSelectedOnly,
    searchTerm,
    showInactive,
    categoryIds,
    brandIds,
    supplierIds,
    page,
    pageSize,
    setPage,
    setPageSize,
    setShowSelectedOnly,
    setSearchTerm,
    setShowInactive,
    setCategoryIds,
    setBrandIds,
    setSupplierIds,
    toggleItemSelection,
    setItemQuantity,
    setItemPrice,
    setItemIcms,
    setItemIpi,
    batchUpdateSelection,
    selectionCount,
  } = useOrderFormUrlState({
    defaultQuantity: 1,
    defaultPrice: 0,
    defaultIcms: 0,
    defaultIpi: 0,
    preserveQuantitiesOnDeselect: false,
    defaultPageSize: 40,
    // Always provide initial data - URL params will override if present
    // This ensures fields retain their values when other fields are updated
    // IMPORTANT: Use memoized initialData to prevent infinite render loop
    initialData: initialDataForUrlState,
  });

  // Form setup with default values from URL state.
  const defaultValues: Partial<OrderUpdateFormData> = {
    description: description || order.description,
    supplierId: supplierId || order.supplierId || undefined,
    forecast: forecast || order.forecast || undefined,
    notes: notes || order.notes || "",
    freight: freight ?? (order as any).freight ?? 0,
    discount: discount ?? (order as any).discount ?? 0,
    // Items list is computed from URL state at submit time.
    items: [],
    // Payment fields
    paymentMethod: order.paymentMethod || null,
    paymentPix: order.paymentPix || null,
    paymentDueDays: order.paymentDueDays || null,
    paymentResponsibleId: order.paymentResponsibleId || undefined,
  };

  const form = useForm<OrderUpdateFormData>({
    resolver: zodResolver(orderUpdateSchema),
    defaultValues,
    mode: "onChange",  // Real-time validation as user types
    reValidateMode: "onChange",
  });

  // Sync URL state to form state (prevents value restoration bug)
  // Note: form is intentionally excluded from dependencies to prevent cascading re-syncs
  // that could cause race conditions and clear field values when other fields are updated
  useEffect(() => {
    const currentValue = form.getValues("description");
    const newValue = description || "";
    // Only update if value has actually changed to prevent infinite loops
    if (currentValue !== newValue) {
      form.setValue("description", newValue, {
        shouldValidate: false, // Don't validate on sync to prevent loops
        shouldDirty: false,    // Don't mark as dirty on sync
        shouldTouch: false     // Don't mark as touched on sync
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [description]);

  useEffect(() => {
    const currentValue = form.getValues("supplierId");
    const newValue = supplierId || undefined;
    // Only update if value has actually changed
    if (currentValue !== newValue) {
      form.setValue("supplierId", newValue, {
        shouldValidate: false,
        shouldDirty: false,
        shouldTouch: false
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId]);

  useEffect(() => {
    const currentValue = form.getValues("forecast");
    const newValue = forecast || undefined;
    // Only update if value has actually changed
    // Compare timestamps for Date objects
    const currentTime = currentValue instanceof Date ? currentValue.getTime() : null;
    const newTime = newValue instanceof Date ? newValue.getTime() : null;
    if (currentTime !== newTime) {
      form.setValue("forecast", newValue, {
        shouldValidate: false,
        shouldDirty: false,
        shouldTouch: false
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forecast]);

  useEffect(() => {
    const currentValue = form.getValues("notes");
    const newValue = notes || "";
    // Only update if value has actually changed
    if (currentValue !== newValue) {
      form.setValue("notes", newValue, {
        shouldValidate: false,
        shouldDirty: false,
        shouldTouch: false
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  // Sync localNotes from URL state when it changes externally (e.g., on initial load)
  useEffect(() => {
    // Only sync if the URL state value differs and localNotes hasn't been modified yet
    // or if this is an external update (not from our debounced update)
    if (notes !== localNotes && !notesDebounceRef.current) {
      setLocalNotes(notes || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  // Sync URL freight to form state.
  useEffect(() => {
    const currentValue = form.getValues("freight");
    const newValue = freight ?? 0;
    if (currentValue !== newValue) {
      form.setValue("freight", newValue, { shouldValidate: false, shouldDirty: false, shouldTouch: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freight]);

  // Sync URL discount to form state.
  useEffect(() => {
    const currentValue = form.getValues("discount");
    const newValue = discount ?? 0;
    if (currentValue !== newValue) {
      form.setValue("discount", newValue, { shouldValidate: false, shouldDirty: false, shouldTouch: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discount]);

  // Mutations - use update instead of create
  const { updateAsync, isLoading: isSubmitting } = useOrderMutations();

  // Fetch suppliers for combobox
  const { data: suppliersResponse } = useSuppliers({
    orderBy: { fantasyName: "asc" },
    take: 100,
    include: { logo: true },
  });

  const suppliers = suppliersResponse?.data || [];

  // Memoize selected items array to prevent unnecessary query key changes
  const selectedItemsArray = useMemo(() => Array.from(selectedItems), [selectedItems]);

  // Fetch selected items data for display
  // Always enable query, use empty array when no items selected to get empty result
  const { data: selectedItemsResponse, isLoading: _isLoadingSelectedItems } = useItems({
    where: selectedItemsArray.length > 0 ? { id: { in: selectedItemsArray } } : { id: { in: [] } },
    include: {
      brand: true,
      category: true,
      prices: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      measures: true,
    },
  });

  const selectedItemsData = selectedItemsResponse?.data || [];

  // Keep step in sync with URL
  useEffect(() => {
    const stepFromUrl = getStepFromUrl(searchParams);
    if (stepFromUrl !== currentStep) {
      setCurrentStep(stepFromUrl);
    }
  }, [searchParams]); // Removed currentStep to prevent circular dependency

  const steps = STEPS;

  // Bag the discrete URL filter state into the shape ItemSelectorTable expects.
  const itemSelectorFilters = useMemo<Partial<ItemGetManyFormData>>(() => ({
    showInactive,
    categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
    brandIds: brandIds.length > 0 ? brandIds : undefined,
    supplierIds: supplierIds.length > 0 ? supplierIds : undefined,
  }), [showInactive, categoryIds, brandIds, supplierIds]);

  const handleItemSelectorFiltersChange = useCallback((newFilters: Partial<ItemGetManyFormData>) => {
    if (newFilters.showInactive !== undefined) setShowInactive(newFilters.showInactive);
    if (newFilters.categoryIds !== undefined) setCategoryIds(newFilters.categoryIds);
    if (newFilters.brandIds !== undefined) setBrandIds(newFilters.brandIds);
    if (newFilters.supplierIds !== undefined) setSupplierIds(newFilters.supplierIds);
  }, [setShowInactive, setCategoryIds, setBrandIds, setSupplierIds]);

  // Wrap the URL toggle for ItemSelectorTable's onSelectItem signature.
  const handleSelectItem = useCallback(
    (itemId: string, quantity?: number, price?: number, icms?: number, ipi?: number) => {
      toggleItemSelection(itemId, quantity, price, icms, ipi);
    },
    [toggleItemSelection],
  );

  const handleBatchSelectItems = useCallback(
    (itemIds: string[], itemData: Record<string, { quantity?: number; price?: number; icms?: number; ipi?: number }>) => {
      const newSelected = new Set(selectedItems);
      const newQuantities = { ...quantities };
      const newPrices = { ...prices };
      const newIcmses = { ...icmses };
      const newIpis = { ...ipis };
      itemIds.forEach((itemId) => {
        if (!newSelected.has(itemId)) {
          newSelected.add(itemId);
          newQuantities[itemId] = itemData[itemId]?.quantity || 1;
          newPrices[itemId] = itemData[itemId]?.price || 0;
          newIcmses[itemId] = itemData[itemId]?.icms || 0;
          newIpis[itemId] = itemData[itemId]?.ipi || 0;
        }
      });
      batchUpdateSelection(newSelected, newQuantities, newPrices, newIcmses, newIpis);
    },
    [selectedItems, quantities, prices, icmses, ipis, batchUpdateSelection],
  );

  // Total of inventory items (subtotal + ICMS + IPI per row).
  const inventoryTotal = useMemo(() => {
    return Array.from(selectedItems).reduce((total, itemId) => {
      const quantity = quantities[itemId] || 1;
      const price = prices[itemId] || 0;
      const icms = icmses[itemId] || 0;
      const ipi = ipis[itemId] || 0;
      const subtotal = quantity * price;
      return total + subtotal + (subtotal * (icms / 100)) + (subtotal * (ipi / 100));
    }, 0);
  }, [selectedItems, quantities, prices, icmses, ipis]);

  // Total of valid temporary items (subtotal + ICMS + IPI per row).
  const temporaryTotal = useMemo(() => {
    return (temporaryItems || [])
      .filter(t => t.temporaryItemDescription.trim() !== "")
      .reduce((total, t) => {
        const quantity = Number(t.orderedQuantity) || 0;
        const price = Number(t.price) || 0;
        const icms = Number(t.icms) || 0;
        const ipi = Number(t.ipi) || 0;
        const subtotal = quantity * price;
        return total + subtotal + (subtotal * (icms / 100)) + (subtotal * (ipi / 100));
      }, 0);
  }, [temporaryItems]);

  // Goods subtotal (before ICMS/IPI) across inventory + temporary items — the discount base.
  const goodsSubtotal = useMemo(() => {
    const inventoryGoods = Array.from(selectedItems).reduce((total, itemId) => {
      return total + (quantities[itemId] || 1) * (prices[itemId] || 0);
    }, 0);
    const temporaryGoods = (temporaryItems || [])
      .filter(t => t.temporaryItemDescription.trim() !== "")
      .reduce((total, t) => total + (Number(t.orderedQuantity) || 0) * (Number(t.price) || 0), 0);
    return inventoryGoods + temporaryGoods;
  }, [selectedItems, quantities, prices, temporaryItems]);

  // Combined items total (without freight).
  const totalPrice = inventoryTotal + temporaryTotal;
  const itemCount = selectionCount + (temporaryItems || []).filter(t => t.temporaryItemDescription.trim() !== "").length;
  const watchedFreight = Number(form.watch("freight")) || 0;
  const watchedDiscount = Number(form.watch("discount")) || 0;
  const discountAmount = watchedDiscount > 0 ? goodsSubtotal * (watchedDiscount / 100) : 0;
  const grandTotal = totalPrice + watchedFreight - discountAmount;

  // Navigation helpers
  const nextStep = useCallback(() => {
    if (currentStep < steps.length) {
      const newStep = currentStep + 1;
      setCurrentStep(newStep);
      // Use functional form to ensure we have the latest params
      setSearchParams((prevParams) => setStepInUrl(prevParams, newStep), { replace: true });
    }
  }, [currentStep, setSearchParams, steps.length]);

  const prevStep = useCallback(() => {
    if (currentStep > 1) {
      const newStep = currentStep - 1;
      setCurrentStep(newStep);
      // Use functional form to ensure we have the latest params
      setSearchParams((prevParams) => setStepInUrl(prevParams, newStep), { replace: true });
    }
  }, [currentStep, setSearchParams]);

  // File change handlers
  const handleBudgetFilesChange = useCallback((files: FileWithPreview[]) => {
    setBudgetFiles(files);
    setHasFileChanges(true);
  }, []);

  const handleReceiptFilesChange = useCallback((files: FileWithPreview[]) => {
    setReceiptFiles(files);
    setHasFileChanges(true);
  }, []);

  const handleInvoiceFilesChange = useCallback((files: FileWithPreview[]) => {
    setInvoiceFiles(files);
    setHasFileChanges(true);
  }, []);

  // Watch payment fields to detect changes (form.watch triggers re-renders)
  const watchedPaymentMethod = form.watch("paymentMethod");
  const watchedPaymentPix = form.watch("paymentPix");
  const watchedPaymentDueDays = form.watch("paymentDueDays");
  const watchedPaymentResponsibleId = form.watch("paymentResponsibleId");

  // Detect if form has actual changes from original order.
  const hasFormChanges = useMemo(() => {
    const descriptionChanged = description?.trim() !== order.description?.trim();
    const supplierChanged = (supplierId || null) !== (order.supplierId || null);
    const forecastChanged = (forecast ? new Date(forecast).getTime() : null) !== (order.forecast ? new Date(order.forecast).getTime() : null);
    const notesChanged = (localNotes?.trim() || "") !== (order.notes?.trim() || "");
    const freightChanged = Number(watchedFreight || 0) !== Number((order as any).freight || 0);
    const discountChanged = Number(watchedDiscount || 0) !== Number((order as any).discount || 0);

    // Payment fields
    const paymentMethodChanged = (watchedPaymentMethod || null) !== (order.paymentMethod || null);
    const paymentPixChanged = (watchedPaymentPix || null) !== (order.paymentPix || null);
    const paymentDueDaysChanged = (watchedPaymentDueDays || null) !== (order.paymentDueDays || null);
    const paymentResponsibleChanged = (watchedPaymentResponsibleId || null) !== (order.paymentResponsibleId || null);

    // Inventory item set
    const originalInventoryIds = new Set(order.items.filter(i => i.itemId).map(item => item.itemId!));
    const inventoryItemsChanged = selectedItems.size !== originalInventoryIds.size ||
      Array.from(selectedItems).some(id => !originalInventoryIds.has(id));

    // Per-item quantity / price / tax tweaks
    const inventoryDetailsChanged = order.items.some(item => {
      if (!item.itemId) return false;
      const qty = quantities[item.itemId];
      const price = prices[item.itemId];
      const icms = icmses[item.itemId];
      const ipi = ipis[item.itemId];
      return (
        (qty !== undefined && qty !== item.orderedQuantity) ||
        (price !== undefined && price !== item.price) ||
        (icms !== undefined && icms !== (item.icms ?? 0)) ||
        (ipi !== undefined && ipi !== (item.ipi ?? 0))
      );
    });

    // Temporary items: count diff or any field changed for an existing temp.
    // Compare composed description (what gets sent to API) so adding metadata
    // counts as a change even if the raw description text is unchanged.
    const originalTemps = order.items.filter(i => !i.itemId);
    const tempCountChanged = (temporaryItems || []).length !== originalTemps.length;
    const tempContentChanged = !tempCountChanged && (temporaryItems || []).some(t => {
      const orig = originalTemps.find(o => buildTempKey(o.id) === t.key);
      if (!orig) return true; // newly added
      return (
        composeTempItemDescription(t) !== (orig.temporaryItemDescription || "Item temporário") ||
        t.orderedQuantity !== orig.orderedQuantity ||
        t.price !== orig.price ||
        t.icms !== (orig.icms ?? 0) ||
        t.ipi !== (orig.ipi ?? 0)
      );
    });

    return (
      descriptionChanged || supplierChanged || forecastChanged || notesChanged || freightChanged || discountChanged ||
      inventoryItemsChanged || inventoryDetailsChanged || tempCountChanged || tempContentChanged ||
      hasFileChanges || paymentMethodChanged || paymentPixChanged || paymentDueDaysChanged || paymentResponsibleChanged
    );
  }, [description, supplierId, forecast, localNotes, watchedFreight, watchedDiscount, selectedItems, quantities, prices, icmses, ipis, temporaryItems, order, hasFileChanges, watchedPaymentMethod, watchedPaymentPix, watchedPaymentDueDays, watchedPaymentResponsibleId]);

  // Stage validation
  const validateCurrentStep = useCallback((): boolean => {
    switch (currentStep) {
      case 1:
        // Validate basic information using URL state
        if (!description?.trim()) {
          toast.error("Descrição é obrigatória");
          return false;
        }
        if (description.trim().length < 1) {
          toast.error("Descrição deve ter pelo menos 1 caractere");
          return false;
        }
        if (description.trim().length > 500) {
          toast.error("Descrição deve ter no máximo 500 caracteres");
          return false;
        }

        return true;

      case 2: {
        // Items step — must have at least one item (inventory or temporary).
        const validTemp = (temporaryItems || []).filter(
          t => t.temporaryItemDescription.trim() !== "" && t.orderedQuantity > 0,
        );
        const totalItems = selectionCount + validTemp.length;
        if (totalItems === 0) {
          toast.error("Pelo menos um item deve ser adicionado ao pedido");
          return false;
        }
        const invalidInventory = Array.from(selectedItems).filter((itemId) => {
          const quantity = quantities[itemId];
          const price = prices[itemId];
          return !quantity || quantity <= 0 || price === undefined || price < 0;
        });
        if (invalidInventory.length > 0) {
          toast.error("Defina quantidade e preço válidos para todos os itens");
          return false;
        }
        const invalidTemp = validTemp.filter(t => t.price < 0);
        if (invalidTemp.length > 0) {
          toast.error("Itens temporários devem ter preço maior ou igual a zero");
          return false;
        }
        return true;
      }

      case 3:
        return true;

      default:
        return false;
    }
  }, [currentStep, description, selectionCount, selectedItems, quantities, prices, temporaryItems]);

  // Handle navigation with validation
  const handleNext = useCallback(() => {
    if (validateCurrentStep()) {
      nextStep();
    }
  }, [validateCurrentStep, nextStep]);

  const handleCancel = useCallback(() => {
    navigate(routes.inventory.orders?.list || "/inventory/orders");
  }, [navigate]);

  // Submit handler
  const handleSubmit = useCallback(async () => {
    if (!validateCurrentStep()) return;

    try {
      // Build the unified items array (inventory selections + temporary items).
      const inventoryPayload = Array.from(selectedItems).map((itemId) => ({
        itemId,
        orderedQuantity: quantities[itemId] || 0,
        price: prices[itemId] || 0,
        icms: icmses[itemId] || 0,
        ipi: ipis[itemId] || 0,
      }));
      const tempPayload = (temporaryItems || [])
        .filter(t => t.temporaryItemDescription.trim() !== "" && t.orderedQuantity > 0)
        .map(t => ({
          temporaryItemDescription: composeTempItemDescription(t),
          orderedQuantity: Number(t.orderedQuantity) || 1,
          price: Number(t.price) || 0,
          icms: Number(t.icms) || 0,
          ipi: Number(t.ipi) || 0,
        }));
      const items = [...inventoryPayload, ...tempPayload];

      // Get payment fields from form
      const currentPaymentMethod = form.getValues("paymentMethod");
      const currentPaymentPix = form.getValues("paymentPix");
      const currentPaymentDueDays = form.getValues("paymentDueDays");
      const currentPaymentResponsibleId = form.getValues("paymentResponsibleId");
      const currentFreight = Number(form.getValues("freight")) || 0;
      const currentDiscount = Number(form.getValues("discount")) || 0;

      const data = {
        description: description!.trim(),
        supplierId: supplierId || undefined,
        forecast: forecast, // Keep null to allow clearing the forecast date
        notes: notes?.trim() || undefined,
        freight: currentFreight,
        discount: currentDiscount,
        items,
        paymentMethod: currentPaymentMethod || undefined,
        paymentPix: currentPaymentMethod === "PIX" ? currentPaymentPix || undefined : undefined,
        paymentDueDays: currentPaymentMethod === "BANK_SLIP" ? currentPaymentDueDays || undefined : undefined,
        paymentResponsibleId: currentPaymentResponsibleId || null,
      };

      // Check if there are new files to upload (files without uploadedFileId)
      const newBudgetFiles = budgetFiles.filter(f => f instanceof File && !(f as any).uploadedFileId);
      const newReceiptFiles = receiptFiles.filter(f => f instanceof File && !(f as any).uploadedFileId);
      const newInvoiceFiles = invoiceFiles.filter(f => f instanceof File && !(f as any).uploadedFileId);

      const hasNewFiles = newBudgetFiles.length > 0 || newReceiptFiles.length > 0 || newInvoiceFiles.length > 0;


      if (hasNewFiles) {
        // Use FormData when there are files to upload
        const supplierInfo = order.supplier ? {
          id: order.supplier.id,
          name: order.supplier.fantasyName,
        } : undefined;

        // Send the IDs of files to KEEP (backend uses 'set' to replace all files)
        const currentBudgetIds = budgetFiles.filter(f => f.uploaded).map(f => f.uploadedFileId || f.id).filter(Boolean) as string[];
        const currentReceiptIds = receiptFiles.filter(f => f.uploaded).map(f => f.uploadedFileId || f.id).filter(Boolean) as string[];
        const currentInvoiceIds = invoiceFiles.filter(f => f.uploaded).map(f => f.uploadedFileId || f.id).filter(Boolean) as string[];

        // Always send file IDs arrays when any file operation occurs
        (data as any).budgetIds = currentBudgetIds;
        (data as any).receiptIds = currentReceiptIds;
        (data as any).invoiceIds = currentInvoiceIds;

        const formData = createOrderFormData(
          data,
          {
            budgets: newBudgetFiles.length > 0 ? newBudgetFiles as File[] : undefined,
            receipts: newReceiptFiles.length > 0 ? newReceiptFiles as File[] : undefined,
            invoices: newInvoiceFiles.length > 0 ? newInvoiceFiles as File[] : undefined,
          },
          supplierInfo
        );


        await updateAsync({
          id: order.id,
          data: formData as any, // FormData is compatible with the API
        });
      } else {
        // Use regular JSON payload when no files
        // But still check for deleted files
        // Send the IDs of files to KEEP (backend uses 'set' to replace all files)
        const currentBudgetIds = budgetFiles.filter(f => f.uploaded).map(f => f.uploadedFileId || f.id).filter(Boolean) as string[];
        const currentReceiptIds = receiptFiles.filter(f => f.uploaded).map(f => f.uploadedFileId || f.id).filter(Boolean) as string[];
        const currentInvoiceIds = invoiceFiles.filter(f => f.uploaded).map(f => f.uploadedFileId || f.id).filter(Boolean) as string[];

        // Always send file IDs arrays when any file operation occurs
        (data as any).budgetIds = currentBudgetIds;
        (data as any).receiptIds = currentReceiptIds;
        (data as any).invoiceIds = currentInvoiceIds;

        await updateAsync({
          id: order.id,
          data,
        });
      }

      // Success toast is handled automatically by API client
      navigate(routes.inventory.orders?.list || "/inventory/orders");
    } catch (error: any) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error updating order:", error);
        console.error("Error details:", {
          message: error?.message,
          response: error?.response,
          data: error?.response?.data,
          status: error?.response?.status
        });
      }
      // Error is handled by the mutation hook
    }
  }, [validateCurrentStep, selectedItems, quantities, prices, icmses, ipis, temporaryItems, description, supplierId, forecast, notes, budgetFiles, receiptFiles, invoiceFiles, updateAsync, order, navigate, form]);

  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === steps.length;

  // Helper function to get measure unit display
  const getMeasureUnitDisplay = (measures: Array<{ unit: MEASURE_UNIT | null; value: number | null }> | undefined) => {
    if (!measures || measures.length === 0) return "";
    const firstMeasure = measures[0];
    if (firstMeasure?.unit) {
      return MEASURE_UNIT_LABELS[firstMeasure.unit];
    }
    return "";
  };

  // PDF Export function
  const exportToPDF = useCallback(
    (includePricing: boolean) => {
      const selectedSupplier = suppliers.find((s) => s.id === supplierId);

      const inventoryItems = selectedItemsData.map((item: any) => ({
        code: item.uniCode || "-",
        name: item.name,
        brand: item.brand?.name || "-",
        measures: getMeasureUnitDisplay(item.measures),
        quantity: Number(quantities[item.id]) || 1,
        unitPrice: Number(prices[item.id]) || 0,
        icms: Number(icmses[item.id]) || 0,
        ipi: Number(ipis[item.id]) || 0,
      }));
      const tempItems = (temporaryItems || [])
        .filter((t) => t.temporaryItemDescription.trim() !== "")
        .map((t) => ({
          code: t.uniCode || "-",
          name: composeTempItemDescription(t),
          brand: t.brand || "-",
          measures: t.measures || "-",
          quantity: Number(t.orderedQuantity) || 0,
          unitPrice: Number(t.price) || 0,
          icms: Number(t.icms) || 0,
          ipi: Number(t.ipi) || 0,
        }));

      exportOrderPdf({
        title: includePricing ? "Pedido de Compra" : "Solicitação de Orçamento",
        includePricing,
        description: description || order.description || undefined,
        supplierName: selectedSupplier?.fantasyName || order.supplier?.fantasyName || undefined,
        orderDate: order.createdAt,
        forecastDate: forecast || order.forecast,
        freight: watchedFreight,
        discount: watchedDiscount,
        notes: notes || order.notes,
        items: [...inventoryItems, ...tempItems],
      });
    },
    [description, supplierId, forecast, notes, selectedItemsData, quantities, prices, icmses, ipis, temporaryItems, watchedFreight, watchedDiscount, order, suppliers],
  );

  // Generate navigation actions based on current step
  const navigationActions = [];

  // Cancel button is always first
  navigationActions.push({
    key: "cancel",
    label: "Cancelar",
    onClick: handleCancel,
    variant: "outline" as const,
    disabled: isSubmitting,
  });

  // Previous button (if not first step)
  if (!isFirstStep) {
    navigationActions.push({
      key: "previous",
      label: "Anterior",
      icon: IconArrowLeft,
      onClick: prevStep,
      variant: "outline" as const,
      disabled: isSubmitting,
    });
  }

  // Next or Submit button
  if (!isLastStep) {
    navigationActions.push({
      key: "next",
      label: "Próximo",
      icon: IconArrowRight,
      onClick: handleNext,
      variant: "default" as const,
      disabled: isSubmitting,
    });
  } else {
    // For updates, we only need to check if there are changes and if required fields are valid
    // We don't check form.formState.isValid because quantities/prices/items are managed in URL state,
    // not form state, so the form might never be touched/validated
    const hasRequiredFields = !!description?.trim();
    const submitDisabled = isSubmitting || !hasFormChanges || !hasRequiredFields;
    navigationActions.push({
      key: "submit",
      label: "Salvar Alterações",
      icon: isSubmitting ? IconLoader2 : IconCheck,
      onClick: handleSubmit,
      variant: "default" as const,
      disabled: submitDisabled,
      loading: isSubmitting,
    });
  }

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4 pb-4">
      <PageHeader
        className="flex-shrink-0"
        title={`Editar Pedido: ${order.description}`}
        icon={IconShoppingCart}
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Estoque", href: routes.inventory.root },
          { label: "Pedidos", href: routes.inventory.orders.list },
          { label: order.description, href: routes.inventory.orders.details(order.id) },
          { label: "Editar" },
        ]}
        actions={navigationActions}
      />

      <Card className="flex-1 min-h-0 flex flex-col shadow-sm border border-border">
        <CardContent className="flex-1 flex flex-col p-4 overflow-hidden min-h-0">
          <Form {...form}>
            <form className="flex flex-col h-full">
              {/* Step Indicator */}
              <div className="flex-shrink-0 mb-6">
                <FormSteps steps={steps} currentStep={currentStep} />
              </div>

              {/* Step Content */}
              <div className={cn("flex-1 min-h-0", currentStep === 2 ? "flex flex-col overflow-hidden" : "overflow-y-auto")}>
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <Card className="w-full">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <IconTruck className="h-5 w-5" />
                          Informações do Pedido
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {/* First Row: Description, Supplier, and Forecast */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                          {/* Description - 6/12 width */}
                          <div className="space-y-2 md:col-span-6">
                            <Label className="text-sm font-medium flex items-center gap-2">
                              <IconFileText className="h-4 w-4" />
                              Descrição <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              placeholder="Digite a descrição do pedido"
                              value={description}
                              onChange={(value) => {
                                const newValue = (value as string) || "";
                                updateDescription(newValue);
                                // Form will be synced by useEffect, no need to set it here
                                // Trigger validation after state update
                                setTimeout(() => form.trigger(), 0);
                              }}
                              transparent
                              className={`h-10 w-full ${form.formState.errors.description ? "border-red-500" : ""}`}
                            />
                            <FormMessage className="text-sm text-red-500">{form.formState.errors.description?.message}</FormMessage>
                          </div>

                          {/* Supplier - 4/12 width */}
                          <div className="space-y-2 md:col-span-4">
                            <Label className="text-sm font-medium flex items-center gap-2">
                              <IconTruck className="h-4 w-4" />
                              Fornecedor
                            </Label>
                            <Combobox<ComboboxOption>
                              placeholder="Selecione um fornecedor (opcional)"
                              options={suppliers.map((supplier) => ({
                                value: supplier.id,
                                label: supplier.fantasyName,
                                logo: supplier.logo,
                              }))}
                              value={supplierId}
                              onValueChange={(value) => {
                                const newValue = typeof value === "string" ? value : undefined;
                                updateSupplierId(newValue);
                                // Form will be synced by useEffect
                                // Trigger validation after state update
                                setTimeout(() => form.trigger(), 0);
                              }}
                              className="h-10 w-full"
                              mode="single"
                              searchable={true}
                              clearable={true}
                              renderOption={(option, _isSelected) => (
                                <div className="flex items-center gap-3 w-full">
                                  <SupplierLogoDisplay
                                    logo={(option as any).logo}
                                    supplierName={option.label}
                                    size="sm"
                                    shape="rounded"
                                    className="flex-shrink-0"
                                  />
                                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                                    <div className="font-medium truncate">{option.label}</div>
                                  </div>
                                </div>
                              )}
                            />
                          </div>

                          {/* Forecast Date - 2/12 width */}
                          <div className="space-y-2 md:col-span-2">
                            <Label className="text-sm font-medium flex items-center gap-2">
                              <IconCalendar className="h-4 w-4" />
                              Previsão
                            </Label>
                            <DateTimeInput
                              value={forecast ? (forecast instanceof Date ? forecast : new Date(forecast)) : undefined}
                              onChange={(date) => {
                                if (date && date instanceof Date) {
                                  // Set to 13:00 São Paulo time
                                  const newDate = new Date(date);
                                  newDate.setHours(13, 0, 0, 0);
                                  updateForecast(newDate);
                                  // Form will be synced by useEffect
                                  // Trigger validation after state update
                                  setTimeout(() => form.trigger(), 0);
                                } else {
                                  updateForecast(null);
                                  // Form will be synced by useEffect
                                  // Trigger validation after state update
                                  setTimeout(() => form.trigger(), 0);
                                }
                              }}
                              context="due"
                              placeholder="Data"
                              showClearButton={true}
                              className="w-full"
                            />
                          </div>
                        </div>

                        {/* Observations row only — item-type toggle was removed
                            (inventory + temporary items are now mixed in a single list). */}
                        <div className="grid grid-cols-1 gap-4">
                          <div className="space-y-2 flex flex-col">
                            <Label className="text-sm font-medium flex items-center gap-2">
                              <IconNotes className="h-4 w-4" />
                              Observações
                            </Label>
                            <Textarea
                              placeholder="Observações sobre o pedido (opcional)"
                              value={localNotes}
                              onChange={(e) => {
                                const newValue = e.target.value;
                                setLocalNotes(newValue);
                                if (notesDebounceRef.current) {
                                  clearTimeout(notesDebounceRef.current);
                                }
                                notesDebounceRef.current = setTimeout(() => {
                                  updateNotes(newValue);
                                  setTimeout(() => form.trigger(), 0);
                                }, 300);
                              }}
                              className="resize-none w-full flex-1 min-h-[134px]"
                            />
                          </div>
                        </div>

                        {/* File uploads */}
                        <div className="space-y-4">
                          <Separator />
                          <Label className="text-sm font-medium">Documentos (Opcional)</Label>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Budget File */}
                            <div className="space-y-2">
                              <Label className="text-sm font-medium flex items-center gap-2">
                                <IconCurrencyReal className="h-4 w-4" />
                                Orçamento
                              </Label>
                              <FileUploadField
                                onFilesChange={handleBudgetFilesChange}
                                existingFiles={budgetFiles}
                                maxFiles={10}
                                maxSize={10 * 1024 * 1024}
                                acceptedFileTypes={{
                                  "application/pdf": [".pdf"],
                                  "image/*": [".jpg", ".jpeg", ".png"],
                                  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
                                  "application/vnd.ms-excel": [".xls"],
                                }}
                                showPreview={true}
                                variant="compact"
                                placeholder="Adicionar orçamento"
                              />
                            </div>

                            {/* Receipt File */}
                            <div className="space-y-2">
                              <Label className="text-sm font-medium flex items-center gap-2">
                                <IconReceipt className="h-4 w-4" />
                                Recibo
                              </Label>
                              <FileUploadField
                                onFilesChange={handleReceiptFilesChange}
                                existingFiles={receiptFiles}
                                maxFiles={10}
                                maxSize={10 * 1024 * 1024}
                                acceptedFileTypes={{
                                  "application/pdf": [".pdf"],
                                  "image/*": [".jpg", ".jpeg", ".png"],
                                }}
                                showPreview={true}
                                variant="compact"
                                placeholder="Adicionar recibo"
                              />
                            </div>

                            {/* NFE File */}
                            <div className="space-y-2">
                              <Label className="text-sm font-medium flex items-center gap-2">
                                <IconFileInvoice className="h-4 w-4" />
                                Nota Fiscal
                              </Label>
                              <FileUploadField
                                onFilesChange={handleInvoiceFilesChange}
                                existingFiles={invoiceFiles}
                                maxFiles={10}
                                maxSize={10 * 1024 * 1024}
                                acceptedFileTypes={{
                                  "application/pdf": [".pdf"],
                                  "image/*": [".jpg", ".jpeg", ".png"],
                                }}
                                showPreview={true}
                                variant="compact"
                                placeholder="Adicionar nota fiscal"
                              />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {currentStep === 2 && (
                  <ItemSelectorTable
                    selectedItems={selectedItems}
                    onSelectItem={handleSelectItem}
                    onSelectAll={() => {}}
                    onBatchSelectItems={handleBatchSelectItems}
                    quantities={quantities}
                    prices={prices}
                    icmses={icmses}
                    ipis={ipis}
                    onQuantityChange={setItemQuantity}
                    onPriceChange={setItemPrice}
                    onIcmsChange={setItemIcms}
                    onIpiChange={setItemIpi}
                    editableColumns={{
                      showQuantityInput: true,
                      showPriceInput: true,
                      showIcmsInput: true,
                      showIpiInput: true,
                    }}
                    fixedColumnsConfig={{
                      fixedColumns: ['name'],
                      fixedReasons: { name: 'Essencial para identificar o item sendo pedido' },
                    }}
                    defaultColumns={['uniCode', 'name', 'quantity', 'price', 'monthlyConsumption', 'monthlyConsumptionTrendPercent', 'orderSubtotal']}
                    storageKey="order-item-selector"
                    page={page}
                    pageSize={pageSize}
                    showSelectedOnly={showSelectedOnly}
                    searchTerm={searchTerm}
                    filters={itemSelectorFilters}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                    onShowSelectedOnlyChange={setShowSelectedOnly}
                    onSearchTermChange={setSearchTerm}
                    onFiltersChange={handleItemSelectorFiltersChange}
                    enableTemporaryItems
                    temporaryItems={temporaryItems}
                    onTemporaryItemAdd={addTemporaryItem}
                    onTemporaryItemUpdate={updateTemporaryItem}
                    onTemporaryItemRemove={removeTemporaryItem}
                    className="flex-1 min-h-0"
                  />
                )}

                {currentStep === 3 && (
                  <div className="space-y-6">
                    {/* Order Summary Header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-semibold text-foreground">Revisão do Pedido</h2>
                        <p className="text-sm text-muted-foreground mt-1">Confirme os detalhes antes de finalizar</p>
                      </div>
                      <OrderPdfExportButton onExport={exportToPDF} fixedVersion={false} />
                    </div>

                    {/* Info + Payment side by side */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Order Info Card */}
                      <Card className="h-full">
                        <CardHeader className="pb-4">
                          <CardTitle className="flex items-center gap-2">
                            <IconClipboardList className="h-5 w-5" />
                            Informações do Pedido
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 space-y-3">
                          <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                            <span className="text-sm text-muted-foreground">Descrição</span>
                            <span className="text-sm font-semibold text-foreground truncate ml-4 text-right">{description || "-"}</span>
                          </div>

                          <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                            <span className="text-sm text-muted-foreground">Fornecedor</span>
                            <span className="text-sm font-semibold text-foreground truncate ml-4 text-right">
                              {supplierId ? suppliers.find((s) => s.id === supplierId)?.fantasyName || "-" : "-"}
                            </span>
                          </div>

                          <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                            <span className="text-sm text-muted-foreground">Previsão de Entrega</span>
                            <span className="text-sm font-semibold text-foreground">{forecast ? formatDate(forecast) : "-"}</span>
                          </div>

                          <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                            <span className="text-sm text-muted-foreground">Itens</span>
                            <span className="text-sm font-semibold text-foreground">
                              {itemCount} {itemCount === 1 ? "item" : "itens"}
                            </span>
                          </div>

                          {canViewPrices && discountAmount > 0 && (
                            <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                              <span className="text-sm text-muted-foreground">Desconto ({watchedDiscount}%)</span>
                              <span className="text-sm font-semibold text-red-600 dark:text-red-400">- {formatCurrency(discountAmount)}</span>
                            </div>
                          )}

                          {canViewPrices && (
                            <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                              <span className="text-sm text-muted-foreground">Valor Total</span>
                              <span className="text-sm font-semibold text-primary">{formatCurrency(grandTotal)}</span>
                            </div>
                          )}

                          {notes && (
                            <div className="bg-muted/50 rounded-lg px-4 py-3">
                              <span className="text-sm text-muted-foreground block mb-1">Observações</span>
                              <p className="text-sm text-foreground whitespace-pre-wrap">{notes}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Payment Method Card */}
                      <Card className="h-full">
                        <CardHeader className="pb-4">
                          <CardTitle className="flex items-center gap-2">
                            <IconCreditCard className="h-5 w-5" />
                            Método de Pagamento
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 space-y-3">
                          {/* Payment Responsible */}
                          <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-[6px]">
                            <span className="text-sm text-muted-foreground whitespace-nowrap mr-4">Responsável</span>
                            <div className="flex-1 max-w-[55%] [&_button]:border-neutral-500">
                              <Combobox
                                async={true}
                                queryKey={["users", "active", "paymentResponsible", SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN]}
                                queryFn={async (searchTerm: string, page = 1) => {
                                  const { getUsers } = await import("../../../../api-client");
                                  const response = await getUsers({
                                    where: { isActive: true },
                                    statuses: ["EXPERIENCE_PERIOD_1", "EXPERIENCE_PERIOD_2", "EFFECTED"],
                                    orderBy: { name: "asc" },
                                    page,
                                    take: 50,
                                    select: { id: true, name: true },
                                    ...(searchTerm?.trim() ? { searchingFor: searchTerm.trim() } : {}),
                                    includeSectorPrivileges: [SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN],
                                  } as any);
                                  return {
                                    data: (response.data || []).map((u: any) => ({ value: u.id, label: u.name })),
                                    hasMore: response.meta?.hasNextPage || false,
                                  };
                                }}
                                initialOptions={order?.paymentResponsible ? [{ value: order.paymentResponsible.id, label: order.paymentResponsible.name }] : []}
                                value={form.watch("paymentResponsibleId") || ""}
                                onValueChange={(value) => {
                                  const stringValue = Array.isArray(value) ? value[0] : value;
                                  form.setValue("paymentResponsibleId", stringValue || undefined, { shouldDirty: true });
                                }}
                                placeholder="Selecione o responsável"
                                emptyText="Nenhum usuário encontrado"
                                clearable
                                searchable
                                minSearchLength={0}
                                pageSize={50}
                                debounceMs={300}
                                className="h-8 w-full"
                              />
                            </div>
                          </div>

                          {/* Payment Method Selector */}
                          <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-[6px]">
                            <span className="text-sm text-muted-foreground whitespace-nowrap mr-4">Forma de Pagamento</span>
                            <div className="flex-1 max-w-[55%] [&_button]:border-neutral-500">
                              <Combobox
                                value={form.watch("paymentMethod") || ""}
                                onValueChange={(value) => {
                                  const stringValue = Array.isArray(value) ? value[0] : value;
                                  form.setValue("paymentMethod", stringValue || null, { shouldDirty: true });
                                  if (stringValue !== "PIX") {
                                    form.setValue("paymentPix", null, { shouldDirty: true });
                                  }
                                  if (stringValue !== "BANK_SLIP") {
                                    form.setValue("paymentDueDays", null, { shouldDirty: true });
                                  }
                                }}
                                options={[
                                  { value: "PIX", label: "Pix" },
                                  { value: "BANK_SLIP", label: "Boleto" },
                                  { value: "CREDIT_CARD", label: "Cartão de Crédito" },
                                ]}
                                placeholder="Selecione (opcional)"
                                emptyText="Nenhuma opção"
                                className="h-8 w-full"
                              />
                            </div>
                          </div>

                          {/* PIX Key - Show only when PIX is selected */}
                          {form.watch("paymentMethod") === "PIX" && (
                            <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-[6px]">
                              <span className="text-sm text-muted-foreground whitespace-nowrap mr-4">Chave Pix</span>
                              <div className="flex-1 max-w-[55%]">
                                <Input
                                  placeholder={
                                    suppliers.find(s => s.id === supplierId)?.pix
                                      ? `Padrão: ${suppliers.find(s => s.id === supplierId)?.pix}`
                                      : "CPF, CNPJ, E-mail, Telefone..."
                                  }
                                  value={form.watch("paymentPix") || suppliers.find(s => s.id === supplierId)?.pix || ""}
                                  onChange={(value) => {
                                    form.setValue("paymentPix", (value as string) || null, { shouldDirty: true });
                                  }}
                                  onBlur={() => {
                                    const currentValue = form.getValues("paymentPix");
                                    if (currentValue) {
                                      const formatted = formatPixKey(currentValue);
                                      form.setValue("paymentPix", formatted, { shouldDirty: true });
                                    }
                                  }}
                                  className="h-8 w-full border-neutral-500"
                                />
                              </div>
                            </div>
                          )}

                          {/* Due Days - Show only when BANK_SLIP is selected */}
                          {form.watch("paymentMethod") === "BANK_SLIP" && (
                            <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-[6px]">
                              <span className="text-sm text-muted-foreground whitespace-nowrap mr-4">Prazo de Vencimento</span>
                              <div className="flex-1 max-w-[55%] [&_button]:border-neutral-500">
                                <Combobox
                                  value={form.watch("paymentDueDays")?.toString() || ""}
                                  onValueChange={(value) => {
                                    const stringValue = Array.isArray(value) ? value[0] : value;
                                    form.setValue("paymentDueDays", stringValue ? parseInt(stringValue) : null, { shouldDirty: true });
                                  }}
                                  options={[
                                    { value: "30", label: "30 dias" },
                                    { value: "60", label: "60 dias" },
                                    { value: "90", label: "90 dias" },
                                    { value: "120", label: "120 dias" },
                                  ]}
                                  placeholder="Selecione o prazo"
                                  emptyText="Nenhum prazo"
                                  className="h-8 w-full"
                                />
                              </div>
                            </div>
                          )}

                          {/* Freight (frete) — supplier shipping cost added to the order total. */}
                          {canViewPrices && (
                            <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-[6px]">
                              <span className="text-sm text-muted-foreground whitespace-nowrap mr-4 flex items-center gap-2">
                                <IconTruck className="h-4 w-4" />
                                Frete
                              </span>
                              <div className="flex-1 max-w-[55%]">
                                <Input
                                  type="currency"
                                  value={form.watch("freight") ?? 0}
                                  onChange={(value) => {
                                    const n = typeof value === "number" ? value : parseFloat((value as string) ?? "0");
                                    const sanitized = Number.isFinite(n) && n >= 0 ? n : 0;
                                    form.setValue("freight", sanitized, { shouldDirty: true, shouldTouch: true });
                                    updateFreight(sanitized);
                                  }}
                                  placeholder="R$ 0,00"
                                  className="h-8 w-full border-neutral-500"
                                />
                              </div>
                            </div>
                          )}

                          {/* Discount (desconto) — percentage applied to the goods subtotal (before ICMS/IPI). */}
                          {canViewPrices && (
                            <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-[6px]">
                              <span className="text-sm text-muted-foreground whitespace-nowrap mr-4 flex items-center gap-2">
                                <IconPercentage className="h-4 w-4" />
                                Desconto
                              </span>
                              <div className="flex-1 max-w-[55%]">
                                <Input
                                  type="percentage"
                                  value={form.watch("discount") ?? 0}
                                  onChange={(value) => {
                                    const n = typeof value === "number" ? value : parseFloat((value as string) ?? "0");
                                    const sanitized = Number.isFinite(n) && n >= 0 ? Math.min(n, 100) : 0;
                                    form.setValue("discount", sanitized, { shouldDirty: true, shouldTouch: true });
                                    updateDiscount(sanitized);
                                  }}
                                  placeholder="0%"
                                  className="h-8 w-full border-neutral-500"
                                />
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Items Table */}
                    <Card className="w-full">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <IconPackage className="h-5 w-5" />
                          Itens Selecionados
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="rounded-md border border-border overflow-hidden w-full">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Código</TableHead>
                                <TableHead>Item</TableHead>
                                <TableHead>Categoria</TableHead>
                                <TableHead>Marca</TableHead>
                                <TableHead className="text-right">Quantidade</TableHead>
                                {canViewPrices && (
                                  <>
                                    <TableHead className="text-right">Preço Unit.</TableHead>
                                    <TableHead className="text-right">ICMS %</TableHead>
                                    <TableHead className="text-right">IPI %</TableHead>
                                    <TableHead className="text-right">Subtotal</TableHead>
                                    <TableHead className="text-right">Impostos</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                  </>
                                )}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedItemsData.map((item) => {
                                const quantity = quantities[item.id] || 1;
                                const price = prices[item.id] || 0;
                                const icms = icmses[item.id] || 0;
                                const ipi = ipis[item.id] || 0;
                                const subtotal = quantity * price;
                                const taxAmount = subtotal * (icms / 100) + subtotal * (ipi / 100);
                                const itemTotal = subtotal + taxAmount;
                                return (
                                  <TableRow key={item.id}>
                                    <TableCell className="font-mono">{item.uniCode}</TableCell>
                                    <TableCell>{item.name}</TableCell>
                                    <TableCell>{item.category?.name || "-"}</TableCell>
                                    <TableCell>{item.brand?.name || "-"}</TableCell>
                                    <TableCell className="text-right">{quantity} {getMeasureUnitDisplay(item.measures)}</TableCell>
                                    {canViewPrices && (
                                      <>
                                        <TableCell className="text-right">{formatCurrency(price, "pt-BR", "BRL", 3)}</TableCell>
                                        <TableCell className="text-right">{icms}%</TableCell>
                                        <TableCell className="text-right">{ipi}%</TableCell>
                                        <TableCell className="text-right">{formatCurrency(subtotal)}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(taxAmount)}</TableCell>
                                        <TableCell className="text-right font-medium">{formatCurrency(itemTotal)}</TableCell>
                                      </>
                                    )}
                                  </TableRow>
                                );
                              })}
                              {(temporaryItems || []).filter(t => t.temporaryItemDescription.trim() !== "").map((t) => {
                                const quantity = Number(t.orderedQuantity) || 0;
                                const price = Number(t.price) || 0;
                                const icms = Number(t.icms) || 0;
                                const ipi = Number(t.ipi) || 0;
                                const subtotal = quantity * price;
                                const taxAmount = subtotal * (icms / 100) + subtotal * (ipi / 100);
                                const itemTotal = subtotal + taxAmount;
                                return (
                                  <TableRow key={`tmp-${t.key}`}>
                                    <TableCell className="font-mono">{t.uniCode || "—"}</TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        <span>{t.temporaryItemDescription}</span>
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-primary/10 text-primary">Temp</span>
                                      </div>
                                    </TableCell>
                                    <TableCell>{t.brand || "—"}</TableCell>
                                    <TableCell>{t.measures || "—"}</TableCell>
                                    <TableCell className="text-right">{quantity}</TableCell>
                                    {canViewPrices && (
                                      <>
                                        <TableCell className="text-right">{formatCurrency(price, "pt-BR", "BRL", 3)}</TableCell>
                                        <TableCell className="text-right">{icms}%</TableCell>
                                        <TableCell className="text-right">{ipi}%</TableCell>
                                        <TableCell className="text-right">{formatCurrency(subtotal)}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(taxAmount)}</TableCell>
                                        <TableCell className="text-right font-medium">{formatCurrency(itemTotal)}</TableCell>
                                      </>
                                    )}
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                            {canViewPrices && (
                              <TableFooter>
                                {watchedFreight > 0 && (
                                  <TableRow>
                                    <TableCell colSpan={10} className="text-right text-sm text-muted-foreground">Frete</TableCell>
                                    <TableCell className="text-right font-medium">{formatCurrency(watchedFreight)}</TableCell>
                                  </TableRow>
                                )}
                                {discountAmount > 0 && (
                                  <TableRow>
                                    <TableCell colSpan={10} className="text-right text-sm text-muted-foreground">Desconto ({watchedDiscount}%)</TableCell>
                                    <TableCell className="text-right font-medium text-red-600 dark:text-red-400">- {formatCurrency(discountAmount)}</TableCell>
                                  </TableRow>
                                )}
                                <TableRow>
                                  <TableCell colSpan={10} className="text-right font-medium">Total Geral</TableCell>
                                  <TableCell className="text-right font-bold text-base">{formatCurrency(grandTotal)}</TableCell>
                                </TableRow>
                              </TableFooter>
                            )}
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};
