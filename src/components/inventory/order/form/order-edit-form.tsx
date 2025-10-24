import { useState, useCallback, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useSearchParams } from "react-router-dom";
import { IconLoader2, IconArrowLeft, IconArrowRight, IconCheck, IconTruck, IconPackage, IconShoppingCart, IconDownload, IconCalendar, IconFileInvoice, IconReceipt, IconCurrencyReal, IconFileText, IconNotes, IconClipboardList } from "@tabler/icons-react";
import type { OrderUpdateFormData } from "../../../../schemas";
import type { Order, OrderItem } from "../../../../types";
import { orderUpdateSchema } from "../../../../schemas";
import { useOrderMutations, useItems } from "../../../../hooks";
import { routes } from "../../../../constants";
import { toast } from "sonner";
import { createOrderFormData } from "@/utils/form-data-helper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { FormSteps } from "@/components/ui/form-steps";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { OrderItemSelector } from "./order-item-selector";
import { TemporaryItemsInput } from "./temporary-items-input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useOrderFormUrlState } from "@/hooks/use-order-form-url-state";
import { formatCurrency, formatDate, formatDateTime } from "../../../../utils";
import { MEASURE_UNIT, MEASURE_UNIT_LABELS } from "../../../../constants";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { useSuppliers } from "../../../../hooks";
import { FileUploadField, type FileWithPreview } from "@/components/file";
import { Separator } from "@/components/ui/separator";
import { SupplierLogoDisplay } from "@/components/ui/avatar-display";

interface OrderEditFormProps {
  order: Order & {
    items: OrderItem[];
    supplier?: {
      id: string;
      fantasyName: string;
    } | null;
  };
}

const steps = [
  {
    id: 1,
    name: "Informações Básicas",
    description: "Descrição e detalhes do pedido",
  },
  {
    id: 2,
    name: "Seleção de Itens",
    description: "Escolha os itens e quantidades",
  },
  {
    id: 3,
    name: "Revisão",
    description: "Confirme os dados do pedido",
  },
];

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
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize state from URL parameters
  const [currentStep, setCurrentStep] = useState(getStepFromUrl(searchParams));

  // Detect order mode based on existing items
  // If order has any temporary items (itemId is null), it's in temporary mode
  const hasTemporaryItems = useMemo(() =>
    order.items.some(item => !item.itemId && item.temporaryItemDescription),
    [order.items]
  );

  // Separate inventory items from temporary items
  const inventoryItems = useMemo(() =>
    order.items.filter(item => item.itemId),
    [order.items]
  );

  const temporaryItems = useMemo(() =>
    order.items.filter(item => !item.itemId && item.temporaryItemDescription).map(item => ({
      temporaryItemDescription: item.temporaryItemDescription!,
      orderedQuantity: item.orderedQuantity,
      price: item.price,
      tax: item.tax,
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

  const initialTaxes = useMemo(
    () =>
      inventoryItems.reduce(
        (acc, item) => {
          acc[item.itemId!] = item.tax;
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
    console.log('[OrderEditForm] Initialized budget files:', files.length, files);
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
    console.log('[OrderEditForm] Initialized receipt files:', files.length, files);
    return files;
  }, [order.receipts]);

  const initialNfeFiles = useMemo(() => {
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
    console.log('[OrderEditForm] Initialized invoice files:', files.length, files);
    return files;
  }, [order.invoices]);

  // File upload state
  const [budgetFiles, setBudgetFiles] = useState<FileWithPreview[]>(initialBudgetFiles);
  const [receiptFiles, setReceiptFiles] = useState<FileWithPreview[]>(initialReceiptFiles);
  const [nfeFiles, setNfeFiles] = useState<FileWithPreview[]>(initialNfeFiles);
  const [hasFileChanges, setHasFileChanges] = useState(false);

  // Sync file state when order files change
  useEffect(() => {
    setBudgetFiles(initialBudgetFiles);
    setReceiptFiles(initialReceiptFiles);
    setNfeFiles(initialNfeFiles);
  }, [initialBudgetFiles, initialReceiptFiles, initialNfeFiles]);

  // URL state management for item selection (Stage 2) - initialized with existing data
  const {
    selectedItems,
    quantities,
    prices,
    taxes,
    description,
    supplierId,
    forecast,
    notes,
    orderItemMode,
    temporaryItems: temporaryItemsState,
    setOrderItemMode,
    setTemporaryItems,
    updateDescription,
    updateSupplierId,
    updateForecast,
    updateNotes,
    showSelectedOnly,
    searchTerm,
    showInactive,
    categoryIds,
    brandIds,
    supplierIds,
    page,
    pageSize,
    totalRecords,
    setPage,
    setPageSize,
    setTotalRecords,
    setShowSelectedOnly,
    setSearchTerm,
    setShowInactive,
    setCategoryIds,
    setBrandIds,
    setSupplierIds,
    toggleItemSelection,
    setItemQuantity,
    setItemPrice,
    setItemTax,
    selectionCount,
  } = useOrderFormUrlState({
    defaultQuantity: 1,
    defaultPrice: 0,
    defaultTax: 0,
    preserveQuantitiesOnDeselect: false,
    defaultPageSize: 40,
    // Always provide initial data - URL params will override if present
    // This ensures fields retain their values when other fields are updated
    initialData: {
      description: order.description,
      supplierId: order.supplierId || undefined,
      forecast: order.forecast,
      notes: order.notes || "",
      orderItemMode: hasTemporaryItems ? "temporary" : "inventory",
      selectedItems: initialSelectedItems,
      quantities: initialQuantities,
      prices: initialPrices,
      taxes: initialTaxes,
      temporaryItems: temporaryItems,
    },
  });

  // Form setup with default values from URL state
  const defaultValues: Partial<OrderUpdateFormData> = {
    description: description || order.description,
    supplierId: supplierId || order.supplierId || undefined,
    forecast: forecast || order.forecast || undefined,
    notes: notes || order.notes || "",
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
    console.log('[useEffect DESCRIPTION SYNC] URL state changed to:', description);
    console.log('[useEffect DESCRIPTION SYNC] Setting form value to:', description || "");
    form.setValue("description", description || "", {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [description]);

  useEffect(() => {
    form.setValue("supplierId", supplierId || undefined, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId]);

  useEffect(() => {
    form.setValue("forecast", forecast || undefined, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forecast]);

  useEffect(() => {
    form.setValue("notes", notes || "", {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

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
  const { data: selectedItemsResponse, isLoading: isLoadingSelectedItems } = useItems({
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

  // Calculate total price based on mode
  const totalPrice = useMemo(() => {
    if (orderItemMode === "inventory") {
      return Array.from(selectedItems).reduce((total, itemId) => {
        const quantity = quantities[itemId] || 1;
        const price = prices[itemId] || 0;
        const tax = taxes[itemId] || 0;
        const itemTotal = quantity * price;
        const taxAmount = itemTotal * (tax / 100);
        return total + itemTotal + taxAmount;
      }, 0);
    } else {
      // Temporary mode
      const tempItems = form.getValues("temporaryItems") || temporaryItemsState || [];
      return tempItems.reduce((total: number, item: any) => {
        const quantity = Number(item.orderedQuantity) || 1;
        const price = Number(item.price) || 0;
        const tax = Number(item.tax) || 0;
        const itemTotal = quantity * price;
        const taxAmount = itemTotal * (tax / 100);
        return total + itemTotal + taxAmount;
      }, 0);
    }
  }, [orderItemMode, selectedItems, quantities, prices, taxes, form, temporaryItemsState]);

  // Calculate item count based on mode
  const itemCount = useMemo(() => {
    if (orderItemMode === "inventory") {
      return selectionCount;
    } else {
      const tempItems = form.getValues("temporaryItems") || temporaryItemsState || [];
      return tempItems.length;
    }
  }, [orderItemMode, selectionCount, form, temporaryItemsState]);

  // Navigation helpers
  const nextStep = useCallback(() => {
    if (currentStep < steps.length) {
      // Skip Step 2 (Item Selection) if in temporary mode
      const newStep = currentStep === 1 && orderItemMode === "temporary" ? 3 : currentStep + 1;
      setCurrentStep(newStep);
      // Use functional form to ensure we have the latest params
      setSearchParams((prevParams) => setStepInUrl(prevParams, newStep), { replace: true });
    }
  }, [currentStep, orderItemMode, setSearchParams]);

  const prevStep = useCallback(() => {
    if (currentStep > 1) {
      // Skip Step 2 (Item Selection) if in temporary mode and coming from Step 3
      const newStep = currentStep === 3 && orderItemMode === "temporary" ? 1 : currentStep - 1;
      setCurrentStep(newStep);
      // Use functional form to ensure we have the latest params
      setSearchParams((prevParams) => setStepInUrl(prevParams, newStep), { replace: true });
    }
  }, [currentStep, orderItemMode, setSearchParams]);

  // File change handlers
  const handleBudgetFilesChange = useCallback((files: FileWithPreview[]) => {
    setBudgetFiles(files);
    setHasFileChanges(true);
  }, []);

  const handleReceiptFilesChange = useCallback((files: FileWithPreview[]) => {
    setReceiptFiles(files);
    setHasFileChanges(true);
  }, []);

  const handleNfeFilesChange = useCallback((files: FileWithPreview[]) => {
    setNfeFiles(files);
    setHasFileChanges(true);
  }, []);

  // Detect if form has actual changes from original order
  const hasFormChanges = useMemo(() => {
    const descriptionChanged = description?.trim() !== order.description?.trim();
    const supplierChanged = (supplierId || null) !== (order.supplierId || null);
    const forecastChanged = (forecast ? new Date(forecast).getTime() : null) !== (order.forecast ? new Date(order.forecast).getTime() : null);
    const notesChanged = (notes?.trim() || "") !== (order.notes?.trim() || "");

    // Check if selected items have changed
    const originalItemIds = new Set(order.items.map(item => item.itemId));
    const itemsChanged = selectedItems.size !== originalItemIds.size ||
      Array.from(selectedItems).some(id => !originalItemIds.has(id));

    // Check if quantities have changed for existing items
    const quantitiesChanged = order.items.some(item => {
      const currentQty = quantities[item.itemId];
      return currentQty !== undefined && currentQty !== item.orderedQuantity;
    });

    // Check if prices have changed for existing items
    const pricesChanged = order.items.some(item => {
      const currentPrice = prices[item.itemId];
      return currentPrice !== undefined && currentPrice !== item.price;
    });

    const hasChanges = descriptionChanged || supplierChanged || forecastChanged || notesChanged || itemsChanged || quantitiesChanged || pricesChanged || hasFileChanges;
    console.log('[hasFormChanges]', {
      descriptionChanged,
      supplierChanged,
      forecastChanged,
      notesChanged,
      itemsChanged,
      quantitiesChanged,
      pricesChanged,
      hasFileChanges,
      hasChanges
    });
    return hasChanges;
  }, [description, supplierId, forecast, notes, selectedItems, quantities, prices, order, hasFileChanges]);

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

        // If in temporary mode, validate temporary items
        if (orderItemMode === "temporary") {
          const tempItems = form.getValues("temporaryItems") || temporaryItemsState || [];
          if (tempItems.length === 0) {
            toast.error("Pelo menos um item temporário deve ser adicionado");
            return false;
          }

          // Validate each temporary item
          const hasInvalidItems = tempItems.some((item: any) =>
            !item.temporaryItemDescription || item.temporaryItemDescription.trim() === "" ||
            !item.orderedQuantity || item.orderedQuantity <= 0 ||
            item.price === undefined || item.price === null || item.price < 0
          );

          if (hasInvalidItems) {
            toast.error("Preencha todos os campos dos itens temporários (descrição, quantidade e preço)");
            return false;
          }
        }

        return true;

      case 2:
        // Validate item selection (only for inventory mode)
        if (orderItemMode === "inventory") {
          if (selectionCount === 0) {
            toast.error("Selecione pelo menos um item");
            return false;
          }

          // Validate quantities and prices
          const invalidItems = Array.from(selectedItems).filter((itemId) => {
            const quantity = quantities[itemId];
            const price = prices[itemId];
            return !quantity || quantity <= 0 || price === undefined || price < 0;
          });

          if (invalidItems.length > 0) {
            toast.error(`Defina quantidade e preço válidos para todos os itens`);
            return false;
          }
        }

        return true;

      case 3:
        // Final validation before submission
        return true;

      default:
        return false;
    }
  }, [currentStep, description, orderItemMode, selectionCount, selectedItems, quantities, prices, form, temporaryItemsState]);

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
      // Build items array based on mode
      let items: any[] = [];
      if (orderItemMode === "inventory") {
        items = Array.from(selectedItems).map((itemId) => ({
          itemId,
          orderedQuantity: quantities[itemId] || 0,
          price: prices[itemId] || 0,
          tax: taxes[itemId] || 0,
        }));
      } else {
        // Temporary mode - get items from form state
        const tempItems = form.getValues("temporaryItems") || temporaryItemsState || [];
        items = tempItems.map((item: any) => ({
          temporaryItemDescription: item.temporaryItemDescription,
          orderedQuantity: Number(item.orderedQuantity) || 1,
          price: Number(item.price) || 0,
          tax: Number(item.tax) || 0,
        }));
      }

      const data = {
        description: description!.trim(),
        supplierId: supplierId || undefined,
        forecast: forecast || undefined,
        notes: notes?.trim() || undefined,
        items,
      };

      // Check if there are new files to upload (files without uploadedFileId)
      const newBudgetFiles = budgetFiles.filter(f => f instanceof File && !(f as any).uploadedFileId);
      const newReceiptFiles = receiptFiles.filter(f => f instanceof File && !(f as any).uploadedFileId);
      const newNfeFiles = nfeFiles.filter(f => f instanceof File && !(f as any).uploadedFileId);

      const hasNewFiles = newBudgetFiles.length > 0 || newReceiptFiles.length > 0 || newNfeFiles.length > 0;

      console.log('[SUBMIT] Order ID:', order.id);
      console.log('[SUBMIT] Description:', description);
      console.log('[SUBMIT] Items count:', items.length);
      console.log('[SUBMIT] Has new files:', hasNewFiles);
      console.log('[SUBMIT] New budget files:', newBudgetFiles.length);
      console.log('[SUBMIT] New receipt files:', newReceiptFiles.length);
      console.log('[SUBMIT] New NFE files:', newNfeFiles.length);

      if (hasNewFiles) {
        // Use FormData when there are files to upload
        const supplierInfo = order.supplier ? {
          id: order.supplier.id,
          name: order.supplier.fantasyName,
        } : undefined;

        // Send the IDs of files to KEEP (backend uses 'set' to replace all files)
        const currentBudgetIds = budgetFiles.filter(f => f.uploaded).map(f => f.uploadedFileId || f.id).filter(Boolean) as string[];
        const currentReceiptIds = receiptFiles.filter(f => f.uploaded).map(f => f.uploadedFileId || f.id).filter(Boolean) as string[];
        const currentInvoiceIds = nfeFiles.filter(f => f.uploaded).map(f => f.uploadedFileId || f.id).filter(Boolean) as string[];

        // Always send file IDs arrays when any file operation occurs
        (data as any).budgetIds = currentBudgetIds;
        (data as any).receiptIds = currentReceiptIds;
        (data as any).invoiceIds = currentInvoiceIds;

        console.log('[SUBMIT] Setting file IDs to keep:', {
          budgets: currentBudgetIds.length,
          receipts: currentReceiptIds.length,
          invoices: currentInvoiceIds.length,
        });

        console.log('[SUBMIT] Creating FormData with:');
        console.log('[SUBMIT] - Data:', data);
        console.log('[SUBMIT] - Budget files:', newBudgetFiles.length, newBudgetFiles);
        console.log('[SUBMIT] - Receipt files:', newReceiptFiles.length, newReceiptFiles);
        console.log('[SUBMIT] - NFE files:', newNfeFiles.length, newNfeFiles);
        console.log('[SUBMIT] - Supplier info:', supplierInfo);

        const formData = createOrderFormData(
          data,
          {
            budgets: newBudgetFiles.length > 0 ? newBudgetFiles as File[] : undefined,
            receipts: newReceiptFiles.length > 0 ? newReceiptFiles as File[] : undefined,
            invoices: newNfeFiles.length > 0 ? newNfeFiles as File[] : undefined,
          },
          supplierInfo
        );

        console.log('[SUBMIT] FormData created, type:', formData.constructor.name);
        console.log('[SUBMIT] FormData entries:');
        for (const [key, value] of formData.entries()) {
          console.log(`  - ${key}:`, value instanceof File ? `File(${value.name})` : value);
        }

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
        const currentInvoiceIds = nfeFiles.filter(f => f.uploaded).map(f => f.uploadedFileId || f.id).filter(Boolean) as string[];

        // Always send file IDs arrays when any file operation occurs
        (data as any).budgetIds = currentBudgetIds;
        (data as any).receiptIds = currentReceiptIds;
        (data as any).invoiceIds = currentInvoiceIds;

        console.log('[SUBMIT] Setting file IDs to keep (JSON):', {
          budgets: currentBudgetIds.length,
          receipts: currentReceiptIds.length,
          invoices: currentInvoiceIds.length,
        });

        console.log('[SUBMIT] Using JSON payload (no files)');

        await updateAsync({
          id: order.id,
          data,
        });
      }

      // Success toast is handled automatically by API client
      navigate(routes.inventory.orders?.list || "/inventory/orders");
    } catch (error: any) {
      console.error("Error updating order:", error);
      console.error("Error details:", {
        message: error?.message,
        response: error?.response,
        data: error?.response?.data,
        status: error?.response?.status
      });
      // Error is handled by the mutation hook
    }
  }, [validateCurrentStep, orderItemMode, selectedItems, quantities, prices, taxes, description, supplierId, forecast, notes, budgetFiles, receiptFiles, nfeFiles, updateAsync, order, navigate, form, temporaryItemsState]);

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
    (e?: React.MouseEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      const pdfContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Pedido - ${formatDate(new Date())}</title>
        <style>
          @page {
            size: A4;
            margin: 12mm;
          }
          
          * { 
            box-sizing: border-box; 
            margin: 0;
            padding: 0;
          }
          
          html, body { 
            height: 100vh;
            width: 100vw;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background: white;
            font-size: 12px;
            line-height: 1.3;
          }
          
          body {
            display: grid;
            grid-template-rows: auto 1fr auto;
            min-height: 100vh;
            padding: 0;
          }
          
          .header {
            display: flex;
            align-items: flex-start;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #e5e7eb;
            flex-shrink: 0;
          }
          
          .logo {
            width: 100px;
            height: 40px;
            background: #0066cc;
            border-radius: 4px;
            margin-right: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
          }
          
          .header-content {
            flex: 1;
          }
          
          .header-content h1 {
            font-size: 18px;
            margin-bottom: 4px;
            color: #111827;
          }
          
          .header-content p {
            font-size: 12px;
            color: #6b7280;
          }
          
          .info-section {
            background: #f9fafb;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 20px;
            flex-shrink: 0;
          }
          
          .info-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
          }
          
          .info-item {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          
          .info-item.full-width {
            grid-column: 1 / -1;
          }
          
          .info-label {
            font-size: 11px;
            color: #6b7280;
            font-weight: 500;
          }
          
          .info-value {
            font-size: 12px;
            color: #111827;
            font-weight: 600;
          }
          
          .table-container {
            margin-bottom: 20px;
            overflow: visible;
            flex: 1;
            display: flex;
            flex-direction: column;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
          }
          
          thead {
            background: #f3f4f6;
            position: sticky;
            top: 0;
            z-index: 10;
          }
          
          th {
            text-align: left;
            padding: 10px 12px;
            font-weight: 600;
            color: #374151;
            border-bottom: 1px solid #e5e7eb;
            font-size: 11px;
            white-space: nowrap;
          }
          
          td {
            padding: 10px 12px;
            border-bottom: 1px solid #f3f4f6;
            color: #374151;
          }
          
          tr:hover {
            background: #f9fafb;
          }
          
          .text-right {
            text-align: right;
          }
          
          .text-mono {
            font-family: "SF Mono", Monaco, "Cascadia Code", monospace;
            font-size: 10px;
          }
          
          .font-medium {
            font-weight: 500;
          }
          
          .total-row {
            background: #f3f4f6;
            font-weight: 600;
          }
          
          .total-row td {
            padding: 12px;
            border-top: 2px solid #e5e7eb;
            border-bottom: none;
          }
          
          
          .footer {
            margin-top: auto;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            font-size: 10px;
            color: #6b7280;
            flex-shrink: 0;
          }
          
          @media print {
            body {
              height: auto;
              min-height: 100vh;
            }
            
            .table-container {
              overflow: visible;
            }
            
            table {
              page-break-inside: auto;
            }
            
            tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
            
            thead {
              display: table-header-group;
            }
            
            tfoot {
              display: table-footer-group;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">LOGO</div>
          <div class="header-content">
            <h1>Pedido #${order.id.slice(-8)}</h1>
            <p>Gerado em ${formatDateTime(new Date())}</p>
          </div>
        </div>
        
        <div class="info-section">
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Descrição</span>
              <span class="info-value">${description}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Fornecedor</span>
              <span class="info-value">${supplierId ? suppliers.find((s) => s.id === supplierId)?.fantasyName || "-" : "-"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Previsão</span>
              <span class="info-value">${forecast ? formatDate(forecast) : "-"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Quantidade de Itens</span>
              <span class="info-value">${selectionCount} ${selectionCount === 1 ? "item" : "itens"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Valor Total</span>
              <span class="info-value">${formatCurrency(totalPrice)}</span>
            </div>
            ${
              notes
                ? `
              <div class="info-item full-width">
                <span class="info-label">Observações</span>
                <span class="info-value">${notes}</span>
              </div>
            `
                : ""
            }
          </div>
        </div>
        
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Item</th>
                <th>Categoria</th>
                <th>Marca</th>
                <th class="text-right">Quantidade</th>
                <th class="text-right">Preço Unit.</th>
                <th class="text-right">Taxa %</th>
                <th class="text-right">Subtotal</th>
                <th class="text-right">Taxa</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${selectedItemsData
                .map((item) => {
                  const quantity = quantities[item.id] || 1;
                  const price = prices[item.id] || 0;
                  const tax = taxes[item.id] || 0;
                  const subtotal = quantity * price;
                  const taxAmount = subtotal * (tax / 100);
                  const itemTotal = subtotal + taxAmount;
                  const measureUnit = getMeasureUnitDisplay(item.measures);
                  return `
                  <tr>
                    <td class="text-mono">${item.uniCode}</td>
                    <td>${item.name}</td>
                    <td>${item.category?.name || "-"}</td>
                    <td>${item.brand?.name || "-"}</td>
                    <td class="text-right">${quantity} ${measureUnit}</td>
                    <td class="text-right">${formatCurrency(price)}</td>
                    <td class="text-right">${tax}%</td>
                    <td class="text-right">${formatCurrency(subtotal)}</td>
                    <td class="text-right">${formatCurrency(taxAmount)}</td>
                    <td class="text-right font-medium">${formatCurrency(itemTotal)}</td>
                  </tr>
                `;
                })
                .join("")}
            </tbody>
            <tfoot>
              <tr class="total-row">
                <td colspan="9" class="text-right">Total Geral</td>
                <td class="text-right">${formatCurrency(totalPrice)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        
        <div class="footer">
          <p>Documento gerado eletronicamente - ${formatDate(new Date())}</p>
        </div>
      </body>
      </html>
    `;

      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(pdfContent);
        printWindow.document.close();
        printWindow.focus();

        printWindow.onload = () => {
          printWindow.print();
          printWindow.onafterprint = () => {
            printWindow.close();
          };
        };
      }
    },
    [description, supplierId, forecast, notes, selectionCount, selectedItemsData, quantities, prices, taxes, totalPrice, order.id, suppliers],
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
    const submitDisabled = isSubmitting || !hasFormChanges || !form.formState.isValid || !description?.trim();
    console.log('[Submit Button State]', {
      isSubmitting,
      hasFormChanges,
      isValid: form.formState.isValid,
      hasDescription: !!description?.trim(),
      submitDisabled,
    });
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
    <div className="flex flex-col h-full w-full">
      <div className="flex-shrink-0 pb-4">
        <PageHeader
          title="Editar Pedido"
          icon={IconShoppingCart}
          variant="form"
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Estoque", href: "/estoque" },
            { label: "Pedidos", href: routes.inventory.orders?.list || "/inventory/orders" },
            { label: "Editar" },
          ]}
          actions={navigationActions}
        />
      </div>

      <Card className="flex-1 min-h-0 flex flex-col w-full shadow-sm border border-border">
        <CardContent className="flex-1 flex flex-col p-6 overflow-hidden min-h-0">
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
                        {/* Description - Full width */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium flex items-center gap-2">
                            <IconFileText className="h-4 w-4" />
                            Descrição <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            placeholder="Digite a descrição do pedido"
                            value={description}
                            onChange={(value) => {
                              // Custom Input component passes value directly, not event object
                              const newValue = value?.toString() || "";
                              console.log('[DESCRIPTION CHANGE] User typed:', newValue);
                              console.log('[DESCRIPTION CHANGE] Current URL description:', description);
                              updateDescription(newValue);
                              form.setValue("description", newValue, {
                                shouldValidate: true,
                                shouldDirty: true,
                                shouldTouch: true
                              });
                              console.log('[DESCRIPTION CHANGE] After update, form value:', form.getValues('description'));
                            }}
                            className={`h-10 w-full ${form.formState.errors.description ? "border-red-500" : ""}`}
                          />
                          <FormMessage className="text-sm text-red-500">{form.formState.errors.description?.message}</FormMessage>
                        </div>

                        {/* Mode Switch - Read-only */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium flex items-center gap-2">
                            <IconClipboardList className="h-4 w-4" />
                            Tipo de Itens
                          </Label>
                          <RadioGroup
                            value={orderItemMode}
                            disabled={true}
                            className="grid grid-cols-1 md:grid-cols-2 gap-3 opacity-60 pointer-events-none"
                          >
                            <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4 group">
                              <RadioGroupItem value="inventory" id="edit-mode-inventory" className="mt-0.5" />
                              <div className="flex-1 space-y-1">
                                <Label htmlFor="edit-mode-inventory" className="flex items-center gap-2 font-medium group-hover:text-white">
                                  <IconShoppingCart className="h-4 w-4" />
                                  Itens do Estoque
                                </Label>
                                <p className="text-sm text-muted-foreground group-hover:text-white/90">
                                  Itens do inventário
                                </p>
                              </div>
                            </div>
                            <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4 group">
                              <RadioGroupItem value="temporary" id="edit-mode-temporary" className="mt-0.5" />
                              <div className="flex-1 space-y-1">
                                <Label htmlFor="edit-mode-temporary" className="flex items-center gap-2 font-medium group-hover:text-white">
                                  <IconFileInvoice className="h-4 w-4" />
                                  Itens Temporários
                                </Label>
                                <p className="text-sm text-muted-foreground group-hover:text-white/90">
                                  Compras únicas
                                </p>
                              </div>
                            </div>
                          </RadioGroup>
                          <p className="text-xs text-muted-foreground text-center">
                            Não é possível alterar o tipo de itens durante a edição
                          </p>
                        </div>

                        {/* Supplier, Date and Observations in the same row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Left Column: Supplier and Date */}
                          <div className="space-y-6">
                            {/* Supplier */}
                            <div className="space-y-2">
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
                                  form.setValue("supplierId", newValue, {
                                    shouldValidate: true,
                                    shouldDirty: true,
                                    shouldTouch: true
                                  });
                                }}
                                className="h-10 w-full"
                                mode="single"
                                searchable={true}
                                clearable={true}
                                renderOption={(option, isSelected) => (
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

                            {/* Forecast Date */}
                            <div className="space-y-2">
                              <Label className="text-sm font-medium flex items-center gap-2">
                                <IconCalendar className="h-4 w-4" />
                                Previsão de Entrega
                              </Label>
                              <DateTimeInput
                                value={forecast instanceof Date ? forecast : undefined}
                                onChange={(date) => {
                                  if (date) {
                                    // Set to 13:00 São Paulo time
                                    const newDate = new Date(date);
                                    newDate.setHours(13, 0, 0, 0);
                                    updateForecast(newDate);
                                    form.setValue("forecast", newDate, {
                                      shouldValidate: true,
                                      shouldDirty: true,
                                      shouldTouch: true
                                    });
                                  } else {
                                    updateForecast(null);
                                    form.setValue("forecast", undefined, {
                                      shouldValidate: true,
                                      shouldDirty: true,
                                      shouldTouch: true
                                    });
                                  }
                                }}
                                context="delivery"
                                placeholder="Selecione a data prevista (opcional)"
                                showClearButton={true}
                                className="w-full"
                              />
                            </div>
                          </div>

                          {/* Right Column: Observations */}
                          <div className="space-y-2 flex flex-col">
                            <Label className="text-sm font-medium flex items-center gap-2">
                              <IconNotes className="h-4 w-4" />
                              Observações
                            </Label>
                            <Textarea
                              placeholder="Observações sobre o pedido (opcional)"
                              value={notes}
                              onChange={(e) => {
                                updateNotes(e.target.value);
                                form.setValue("notes", e.target.value, {
                                  shouldValidate: true,
                                  shouldDirty: true,
                                  shouldTouch: true
                                });
                              }}
                              className="resize-none w-full flex-1"
                              rows={3}
                            />
                          </div>
                        </div>

                        {/* Temporary Items Input (only shown in temporary mode) */}
                        {orderItemMode === "temporary" && (
                          <div className="space-y-4">
                            <Separator />
                            <div className="space-y-3">
                              <Label className="text-sm font-medium flex items-center gap-2">
                                <IconFileInvoice className="h-4 w-4" />
                                Itens Temporários
                              </Label>
                              <TemporaryItemsInput control={form.control} />
                            </div>
                          </div>
                        )}

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
                                maxFiles={1}
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
                                maxFiles={1}
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
                                onFilesChange={handleNfeFilesChange}
                                existingFiles={nfeFiles}
                                maxFiles={1}
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

                {currentStep === 2 && orderItemMode === "inventory" && (
                  <OrderItemSelector
                    selectedItems={selectedItems}
                    onSelectItem={toggleItemSelection}
                    onSelectAll={() => {}}
                    onQuantityChange={setItemQuantity}
                    onPriceChange={setItemPrice}
                    onTaxChange={setItemTax}
                    quantities={quantities}
                    prices={prices}
                    taxes={taxes}
                    isSelected={(itemId) => selectedItems.has(itemId)}
                    showSelectedOnly={showSelectedOnly}
                    searchTerm={searchTerm}
                    showInactive={showInactive}
                    categoryIds={categoryIds}
                    brandIds={brandIds}
                    supplierIds={supplierIds}
                    page={page}
                    pageSize={pageSize}
                    totalRecords={totalRecords}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                    onTotalRecordsChange={setTotalRecords}
                    onShowSelectedOnlyChange={setShowSelectedOnly}
                    onSearchTermChange={setSearchTerm}
                    onShowInactiveChange={setShowInactive}
                    onCategoryIdsChange={setCategoryIds}
                    onBrandIdsChange={setBrandIds}
                    onSupplierIdsChange={setSupplierIds}
                    onBatchFiltersChange={(filters) => {
                      if (filters.showInactive !== undefined) setShowInactive(filters.showInactive);
                      if (filters.categoryIds !== undefined) setCategoryIds(filters.categoryIds);
                      if (filters.brandIds !== undefined) setBrandIds(filters.brandIds);
                      if (filters.supplierIds !== undefined) setSupplierIds(filters.supplierIds);
                      if (filters.resetPage) setPage(1);
                    }}
                    className="flex-1 min-h-0"
                  />
                )}

                {currentStep === 3 && (
                  <div className="space-y-6">
                    {/* Summary Card */}
                    <Card className="w-full">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <IconShoppingCart className="h-5 w-5" />
                            Resumo do Pedido
                          </span>
                          <Button type="button" variant="outline" size="sm" onClick={exportToPDF} className="gap-2">
                            <IconDownload className="h-4 w-4" />
                            Baixar PDF
                          </Button>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
                          <div>
                            <span className="text-sm font-medium text-muted-foreground">Descrição:</span>
                            <p className="mt-1 font-medium">{description}</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-muted-foreground">Fornecedor:</span>
                            <p className="mt-1 font-medium">{supplierId ? suppliers.find((s) => s.id === supplierId)?.fantasyName || "-" : "-"}</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-muted-foreground">Previsão:</span>
                            <p className="mt-1 font-medium">{forecast ? formatDate(forecast) : "-"}</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-muted-foreground">Quantidade de Itens:</span>
                            <p className="mt-1 font-medium">
                              {itemCount} {itemCount === 1 ? "item" : "itens"}
                            </p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-muted-foreground">Valor Total:</span>
                            <p className="mt-1 font-medium">{formatCurrency(totalPrice)}</p>
                          </div>
                          {notes && (
                            <div className="md:col-span-3">
                              <span className="text-sm font-medium text-muted-foreground">Observações:</span>
                              <p className="mt-1">{notes}</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Items Table */}
                    <Card className="w-full">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <IconPackage className="h-5 w-5" />
                          Itens Selecionados
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="rounded-md border overflow-hidden w-full">
                          {orderItemMode === "inventory" ? (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Código</TableHead>
                                  <TableHead>Item</TableHead>
                                  <TableHead>Categoria</TableHead>
                                  <TableHead>Marca</TableHead>
                                  <TableHead className="text-right">Quantidade</TableHead>
                                  <TableHead className="text-right">Preço Unit.</TableHead>
                                  <TableHead className="text-right">Taxa %</TableHead>
                                  <TableHead className="text-right">Subtotal</TableHead>
                                  <TableHead className="text-right">Taxa</TableHead>
                                  <TableHead className="text-right">Total</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {selectedItemsData.map((item) => {
                                  const quantity = quantities[item.id] || 1;
                                  const price = prices[item.id] || 0;
                                  const tax = taxes[item.id] || 0;
                                  const subtotal = quantity * price;
                                  const taxAmount = subtotal * (tax / 100);
                                  const itemTotal = subtotal + taxAmount;

                                  return (
                                    <TableRow key={item.id}>
                                      <TableCell className="font-mono">{item.uniCode}</TableCell>
                                      <TableCell>{item.name}</TableCell>
                                      <TableCell>{item.category?.name || "-"}</TableCell>
                                      <TableCell>{item.brand?.name || "-"}</TableCell>
                                      <TableCell className="text-right">
                                        {quantity} {getMeasureUnitDisplay(item.measures)}
                                      </TableCell>
                                      <TableCell className="text-right">{formatCurrency(price)}</TableCell>
                                      <TableCell className="text-right">{tax}%</TableCell>
                                      <TableCell className="text-right">{formatCurrency(subtotal)}</TableCell>
                                      <TableCell className="text-right">{formatCurrency(taxAmount)}</TableCell>
                                      <TableCell className="text-right font-medium">{formatCurrency(itemTotal)}</TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                              <TableFooter>
                                <TableRow>
                                  <TableCell colSpan={9} className="text-right font-medium">
                                    Total Geral
                                  </TableCell>
                                  <TableCell className="text-right font-bold text-base">{formatCurrency(totalPrice)}</TableCell>
                                </TableRow>
                              </TableFooter>
                            </Table>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Descrição do Item</TableHead>
                                  <TableHead className="text-right">Quantidade</TableHead>
                                  <TableHead className="text-right">Preço Unit.</TableHead>
                                  <TableHead className="text-right">Taxa %</TableHead>
                                  <TableHead className="text-right">Subtotal</TableHead>
                                  <TableHead className="text-right">Taxa</TableHead>
                                  <TableHead className="text-right">Total</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {(form.getValues("temporaryItems") || temporaryItemsState || []).map((item: any, index: number) => {
                                  const quantity = Number(item.orderedQuantity) || 1;
                                  const price = Number(item.price) || 0;
                                  const tax = Number(item.tax) || 0;
                                  const subtotal = quantity * price;
                                  const taxAmount = subtotal * (tax / 100);
                                  const itemTotal = subtotal + taxAmount;

                                  return (
                                    <TableRow key={index}>
                                      <TableCell>{item.temporaryItemDescription}</TableCell>
                                      <TableCell className="text-right">{quantity}</TableCell>
                                      <TableCell className="text-right">{formatCurrency(price)}</TableCell>
                                      <TableCell className="text-right">{tax}%</TableCell>
                                      <TableCell className="text-right">{formatCurrency(subtotal)}</TableCell>
                                      <TableCell className="text-right">{formatCurrency(taxAmount)}</TableCell>
                                      <TableCell className="text-right font-medium">{formatCurrency(itemTotal)}</TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                              <TableFooter>
                                <TableRow>
                                  <TableCell colSpan={6} className="text-right font-medium">
                                    Total Geral
                                  </TableCell>
                                  <TableCell className="text-right font-bold text-base">{formatCurrency(totalPrice)}</TableCell>
                                </TableRow>
                              </TableFooter>
                            </Table>
                          )}
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
