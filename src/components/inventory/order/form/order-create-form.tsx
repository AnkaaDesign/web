import { useState, useCallback, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { IconLoader2, IconArrowLeft, IconArrowRight, IconCheck, IconBuilding, IconShoppingCart, IconCalendar, IconFileInvoice, IconReceipt, IconCurrencyReal, IconFileText, IconTruck, IconNotes, IconClipboardList, IconCreditCard, IconPercentage } from "@tabler/icons-react";
import type { OrderCreateFormData } from "../../../../schemas";
import { orderCreateSchema } from "../../../../schemas";
import { useOrderMutations, useItems, useSuppliers, useCanViewPrices, useNextOrderNumber } from "../../../../hooks";
import { routes, FAVORITE_PAGES, ORDER_STATUS, MEASURE_UNIT, MEASURE_UNIT_LABELS, MEASURE_TYPE_ORDER, SECTOR_PRIVILEGES } from "../../../../constants";
import { toast } from "@/components/ui/sonner";
import { createOrderFormData } from "@/utils/form-data-helper";
import { FileUploadField, type FileWithPreview } from "@/components/common/file";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Form, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import { FormSteps } from "@/components/ui/form-steps";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Combobox } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import { ItemSelectorTable } from "@/components/inventory/common/item-selector";
import type { ItemGetManyFormData } from "../../../../schemas";
import { useOrderFormUrlState, composeTempItemDescription } from "@/hooks/inventory/use-order-form-url-state";
import { formatCurrency, formatDate, measureUtils, formatPixKey } from "../../../../utils";
import { exportOrderPdf } from "@/utils/order-pdf-generator";
import { buildOrderCode } from "@/utils/order-code";
import { OrderPdfExportButton } from "../common/order-pdf-export-button";
import { SupplierLogoDisplay } from "@/components/ui/avatar-display";

export const OrderCreateForm = () => {
  const navigate = useNavigate();
  const canViewPrices = useCanViewPrices();

  // File upload state
  const [budgetFiles, setBudgetFiles] = useState<FileWithPreview[]>([]);
  const [receiptFiles, setReceiptFiles] = useState<FileWithPreview[]>([]);
  const [invoiceFiles, setInvoiceFiles] = useState<FileWithPreview[]>([]);

  // URL state management for item selection and form navigation (includes step)
  const {
    step: currentStep,
    setStep: setCurrentStep,
    selectedItems,
    quantities,
    prices,
    icmses,
    ipis,
    temporaryItems,
    description,
    supplierId,
    forecast,
    notes,
    freight,
    discount,
    updateDescription,
    updateSupplierId,
    updateForecast,
    updateNotes,
    updateFreight,
    updateDiscount,
    addTemporaryItem,
    updateTemporaryItem,
    removeTemporaryItem,
    clearTemporaryItems,
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
    batchUpdateSelection,
    setItemQuantity,
    setItemPrice,
    setItemIcms,
    setItemIpi,
    selectionCount,
    clearAllSelections,
  } = useOrderFormUrlState({
    defaultQuantity: 1,
    defaultPrice: 0,
    defaultIcms: 0,
    defaultIpi: 0,
    preserveQuantitiesOnDeselect: false,
    defaultPageSize: 40,
  });

  // Steps — items step now mixes inventory selections + free-text temporary items in a single screen.
  const steps = [
    {
      id: 1,
      name: "Informações Básicas",
      description: "Fornecedor e detalhes do pedido",
    },
    {
      id: 2,
      name: "Itens",
      description: "Selecione itens do estoque ou adicione itens temporários",
    },
    {
      id: 3,
      name: "Revisão",
      description: "Confirme os dados do pedido",
    },
  ];

  // Form setup with default values from URL state
  const form = useForm<OrderCreateFormData>({
    resolver: zodResolver(orderCreateSchema),
    defaultValues: {
      description: description || "",
      supplierId: supplierId && supplierId.trim() !== "" ? supplierId : undefined,
      forecast: forecast || undefined,
      notes: notes || "",
      freight: freight ?? 0,
      discount: discount ?? 0,
      items: [],
      paymentMethod: null,
      paymentPix: null,
      paymentDueDays: null,
      installmentCount: 1,
    },
    mode: "onTouched", // Only validate after user touches a field
    reValidateMode: "onChange", // Re-validate on change after initial validation
    criteriaMode: "all", // Show all errors
    shouldFocusError: true, // Focus on first error field when validation fails
  });

  // Sync URL state changes back to form (validate if touched or has errors to clear stale errors)
  useEffect(() => {
    const currentFormValue = form.getValues("description") || "";
    const urlValue = description || "";

    // Only sync if URL state differs from form state
    // This prevents double-updates when user is typing which can cause validation race conditions
    if (currentFormValue !== urlValue) {
      const hasError = !!form.formState.errors.description;
      const isTouched = form.formState.touchedFields.description;
      form.setValue("description", urlValue, {
        shouldValidate: hasError || isTouched, // Validate if there's already an error or field was touched
        shouldDirty: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [description]);

  useEffect(() => {
    const isTouched = form.formState.touchedFields.supplierId;
    form.setValue("supplierId", supplierId || undefined, {
      shouldValidate: isTouched,
      shouldDirty: true
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId]);

  useEffect(() => {
    const isTouched = form.formState.touchedFields.forecast;
    form.setValue("forecast", forecast || undefined, {
      shouldValidate: isTouched,
      shouldDirty: true
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forecast]);

  useEffect(() => {
    const isTouched = form.formState.touchedFields.notes;
    form.setValue("notes", notes || "", {
      shouldValidate: isTouched,
      shouldDirty: true
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);


  // Sync inventory selections + temporary items into the form's unified items array.
  // Validates only when the items field has already been touched to avoid spurious red errors on first paint.
  useEffect(() => {
    const inventoryItems = Array.from(selectedItems).map((itemId) => ({
      itemId,
      orderedQuantity: quantities[itemId] || 1,
      price: prices[itemId] || 0,
      icms: icmses[itemId] || 0,
      ipi: ipis[itemId] || 0,
    }));
    const tempItemsForForm = (temporaryItems || [])
      .filter(t => t.temporaryItemDescription.trim() !== "" && t.orderedQuantity > 0)
      .map(t => ({
        temporaryItemDescription: composeTempItemDescription(t),
        orderedQuantity: t.orderedQuantity,
        price: t.price,
        icms: t.icms,
        ipi: t.ipi,
      }));
    const items = [...inventoryItems, ...tempItemsForForm];
    const isTouched = !!form.formState.touchedFields.items;
    form.setValue("items", items, {
      shouldValidate: isTouched,
      shouldDirty: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItems, quantities, prices, icmses, ipis, temporaryItems]);

  // Sync URL freight back to form
  useEffect(() => {
    const isTouched = form.formState.touchedFields.freight;
    form.setValue("freight", freight ?? 0, {
      shouldValidate: isTouched,
      shouldDirty: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freight]);

  // Sync URL discount back to form
  useEffect(() => {
    const isTouched = form.formState.touchedFields.discount;
    form.setValue("discount", discount ?? 0, {
      shouldValidate: isTouched,
      shouldDirty: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discount]);

  // Mutations
  const { createAsync, isLoading: isSubmitting } = useOrderMutations();

  // Fetch suppliers for selection
  const { data: suppliersResponse } = useSuppliers({
    orderBy: { fantasyName: "asc" },
    take: 100,
    include: { logo: true },
  });

  const suppliers = suppliersResponse?.data || [];

  // Predicted next order number, so the order-form PDF shows the real code (e.g. 0003)
  // before the order is saved instead of the 0000 placeholder.
  const { data: nextNumberResponse } = useNextOrderNumber();
  const nextOrderNumber = nextNumberResponse?.data?.nextOrderNumber ?? null;

  // Fetch selected items data for display.
  // CRITICAL: `enabled` must live in the SECOND arg (react-query options),
  // not in params — `useItems` passes the first arg straight to the API as
  // query string, where unknown keys like `enabled` are ignored. With `where`
  // also missing (size 0), the API returns *all* items → review step floods
  // with the full inventory.
  const { data: selectedItemsResponse } = useItems(
    {
      where: { id: { in: Array.from(selectedItems) } },
      include: {
        brands: true,
        category: true,
        measures: true,
        prices: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    },
    { enabled: selectedItems.size > 0 },
  );

  const selectedItemsData = selectedItemsResponse?.data || [];

  // Calculate total price
  const totalPrice = Array.from(selectedItems).reduce((total: number, itemId: string) => {
    const quantity = Number(quantities[itemId]) || 1;
    const price = Number(prices[itemId]) || 0;
    const icms = Number(icmses[itemId]) || 0;
    const ipi = Number(ipis[itemId]) || 0;
    const subtotal = quantity * price;
    const icmsAmount = subtotal * (icms / 100);
    const ipiAmount = subtotal * (ipi / 100);
    const taxAmount = icmsAmount + ipiAmount;
    return total + subtotal + taxAmount;
  }, 0);

  // Goods subtotal (before ICMS/IPI) for the selected inventory items — used as the discount base.
  const inventoryGoodsSubtotal = Array.from(selectedItems).reduce((total: number, itemId: string) => {
    const quantity = Number(quantities[itemId]) || 1;
    const price = Number(prices[itemId]) || 0;
    return total + quantity * price;
  }, 0);

  // Navigation helpers - use the hook's setStep which properly manages URL state
  const nextStep = useCallback(() => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  }, [currentStep, setCurrentStep, steps.length]);

  const prevStep = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep, setCurrentStep]);

  // Stage validation
  const validateCurrentStep = useCallback(async (): Promise<boolean> => {
    switch (currentStep) {
      case 1:
        // Trigger form validation for step 1 fields first to show errors in UI
        const step1Valid = await form.trigger(["description", "supplierId", "forecast", "notes"]);

        // Get the description value for additional checks
        const formDescription = form.getValues("description");

        // Check if validation failed or description is empty
        if (!step1Valid || !formDescription || formDescription.trim().length === 0) {
          // Get the first error message from form errors
          const errors = form.formState.errors;
          if (errors.description) {
            toast.error(errors.description.message || "Descrição é obrigatória");
          } else if (!formDescription || formDescription.trim().length === 0) {
            toast.error("Descrição é obrigatória");
          }
          return false;
        }

        if (formDescription.trim().length > 500) {
          toast.error("Descrição deve ter no máximo 500 caracteres");
          return false;
        }

        return true;

      case 2: {
        // Items step — must have at least one item (inventory or temporary).
        const validTemp = (temporaryItems || []).filter(
          t => t.temporaryItemDescription.trim() !== "" && t.orderedQuantity > 0,
        );
        const totalItems = selectedItems.size + validTemp.length;
        if (totalItems === 0) {
          toast.error("Pelo menos um item deve ser adicionado ao pedido");
          return false;
        }
        const inventoryWithoutPrice = Array.from(selectedItems).filter(
          (itemId) => prices[itemId] === undefined || Number(prices[itemId]) < 0,
        );
        if (inventoryWithoutPrice.length > 0) {
          toast.error("Todos os itens selecionados devem ter preço definido");
          return false;
        }
        const tempWithoutPrice = validTemp.filter(t => t.price < 0);
        if (tempWithoutPrice.length > 0) {
          toast.error("Itens temporários devem ter preço maior ou igual a zero");
          return false;
        }
        return true;
      }

      case 3: {
        // Review step — re-run the same item check before submission.
        const validTemp = (temporaryItems || []).filter(
          t => t.temporaryItemDescription.trim() !== "" && t.orderedQuantity > 0,
        );
        const totalItems = selectedItems.size + validTemp.length;
        if (totalItems === 0) {
          toast.error("Pelo menos um item deve ser adicionado ao pedido");
          return false;
        }
        const inventoryWithoutPrice = Array.from(selectedItems).filter(
          (itemId) => prices[itemId] === undefined || Number(prices[itemId]) < 0,
        );
        if (inventoryWithoutPrice.length > 0) {
          toast.error("Todos os itens selecionados devem ter preço definido");
          return false;
        }

        // Trigger full form validation
        const isValid = await form.trigger();

        if (!isValid) {
          const errors = form.formState.errors;
          if (errors.description) {
            toast.error(errors.description.message || "Erro na descrição");
          } else if (errors.items) {
            toast.error("Erro nos itens selecionados");
          } else if (errors.paymentPix) {
            toast.error(errors.paymentPix.message || "Erro na chave Pix");
          } else {
            toast.error("Por favor, corrija os erros no formulário");
          }
          return false;
        }

        return true;
      }

      default:
        return true;
    }
  }, [currentStep, form, selectedItems, prices, temporaryItems]);

  // Consolidate filters for ItemSelectorTable
  const filters = useMemo<Partial<ItemGetManyFormData>>(() => ({
    showInactive,
    categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
    brandIds: brandIds.length > 0 ? brandIds : undefined,
    supplierIds: supplierIds.length > 0 ? supplierIds : undefined,
  }), [showInactive, categoryIds, brandIds, supplierIds]);

  // Handle filter changes from ItemSelectorTable
  const handleFiltersChange = useCallback((newFilters: Partial<ItemGetManyFormData>) => {
    if (newFilters.showInactive !== undefined) setShowInactive(newFilters.showInactive);
    if (newFilters.categoryIds !== undefined) setCategoryIds(newFilters.categoryIds);
    if (newFilters.brandIds !== undefined) setBrandIds(newFilters.brandIds);
    if (newFilters.supplierIds !== undefined) setSupplierIds(newFilters.supplierIds);
  }, [setShowInactive, setCategoryIds, setBrandIds, setSupplierIds]);

  // Handle file changes
  // Note: We don't set budgetIds/receiptIds/invoiceIds here because:
  // 1. Files are tracked in separate state (budgetFiles, receiptFiles, invoiceFiles)
  // 2. Setting ["pending"] would fail UUID validation in the schema
  // 3. The actual file IDs are set by the backend after upload
  const handleBudgetFilesChange = useCallback((files: FileWithPreview[]) => {
    setBudgetFiles(files);
  }, []);

  const handleReceiptFilesChange = useCallback((files: FileWithPreview[]) => {
    setReceiptFiles(files);
  }, []);

  const handleInvoiceFilesChange = useCallback((files: FileWithPreview[]) => {
    setInvoiceFiles(files);
  }, []);

  // Handle item selection
  const handleSelectItem = useCallback(
    (itemId: string, quantity?: number, price?: number, icms?: number, ipi?: number) => {
      toggleItemSelection(itemId, quantity, price, icms, ipi);
    },
    [toggleItemSelection],
  );

  // Handle batch selection for shift-click range selection
  const handleBatchSelectItems = useCallback(
    (itemIds: string[], itemData: Record<string, { quantity?: number; price?: number; icms?: number; ipi?: number }>) => {
      // Build the new selection state
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

      // Batch update using the batch update function from URL state
      batchUpdateSelection(newSelected, newQuantities, newPrices, newIcmses, newIpis);
    },
    [selectedItems, quantities, prices, icmses, ipis, batchUpdateSelection],
  );

  const handleQuantityChange = useCallback(
    (itemId: string, quantity: number) => {
      const validQuantity = Math.max(0.01, quantity);
      setItemQuantity(itemId, validQuantity);
    },
    [setItemQuantity],
  );

  const handlePriceChange = useCallback(
    (itemId: string, price: number) => {
      const validPrice = Math.max(0, price);
      setItemPrice(itemId, validPrice);
    },
    [setItemPrice],
  );

  const handleIcmsChange = useCallback(
    (itemId: string, icms: number) => {
      const validIcms = Math.max(0, Math.min(100, icms));
      setItemIcms(itemId, validIcms);
    },
    [setItemIcms],
  );

  const handleIpiChange = useCallback(
    (itemId: string, ipi: number) => {
      const validIpi = Math.max(0, Math.min(100, ipi));
      setItemIpi(itemId, validIpi);
    },
    [setItemIpi],
  );

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    try {
      // Build the unified items array — inventory selections + valid temporary items.
      const inventoryItemsData = Array.from(selectedItems).map((itemId) => ({
        itemId: String(itemId),
        orderedQuantity: Number(quantities[itemId]) || 1,
        price: Number(prices[itemId]) || 0,
        icms: Number(icmses[itemId]) || 0,
        ipi: Number(ipis[itemId]) || 0,
      }));
      const tempItemsData = (temporaryItems || [])
        .filter(t => t.temporaryItemDescription.trim() !== "" && t.orderedQuantity > 0)
        .map(t => ({
          temporaryItemDescription: composeTempItemDescription(t),
          orderedQuantity: Number(t.orderedQuantity) || 1,
          price: Number(t.price) || 0,
          icms: Number(t.icms) || 0,
          ipi: Number(t.ipi) || 0,
        }));
      const itemsData = [...inventoryItemsData, ...tempItemsData];

      // Get form values to ensure we have the latest data
      const currentDescription = form.getValues("description");
      const currentSupplierId = form.getValues("supplierId");
      const currentForecast = form.getValues("forecast");
      const currentNotes = form.getValues("notes");
      const currentFreight = form.getValues("freight");
      const currentDiscount = form.getValues("discount");
      const currentPaymentMethod = form.getValues("paymentMethod");
      const currentPaymentPix = form.getValues("paymentPix");
      const currentPaymentDueDays = form.getValues("paymentDueDays");
      const currentInstallmentCount = form.getValues("installmentCount");
      const currentPaymentResponsibleId = form.getValues("paymentResponsibleId");

      // Prepare the complete form data
      const orderData: OrderCreateFormData = {
        description: currentDescription?.trim() || "",
        status: ORDER_STATUS.CREATED,
        supplierId: currentSupplierId || undefined,
        forecast: currentForecast || undefined,
        notes: currentNotes?.trim() || undefined,
        freight: Number(currentFreight) || 0,
        discount: Number(currentDiscount) || 0,
        items: itemsData,
        paymentMethod: currentPaymentMethod || undefined,
        paymentPix: currentPaymentMethod === "PIX" ? currentPaymentPix || undefined : undefined,
        paymentDueDays: currentPaymentMethod === "BANK_SLIP" ? currentPaymentDueDays || undefined : undefined,
        installmentCount: currentPaymentMethod === "BANK_SLIP" ? currentInstallmentCount || 1 : 1,
        paymentResponsibleId: currentPaymentResponsibleId || undefined,
      };

      // Set all form values at once
      Object.keys(orderData).forEach((key) => {
        form.setValue(key as keyof OrderCreateFormData, orderData[key as keyof OrderCreateFormData]);
      });

      // Trigger validation
      const isValid = await form.trigger();
      if (!isValid) {
        const errors = form.formState.errors;
        if (process.env.NODE_ENV !== "production") {
          console.error("Form validation errors:", errors);
        }
        if (errors.description) {
          toast.error(errors.description.message || "Erro na descrição");
        } else if (errors.items) {
          toast.error("Erro nos itens do pedido");
        } else if (errors.paymentPix) {
          toast.error(errors.paymentPix.message || "Erro na chave Pix");
        } else if (errors.budgetIds) {
          toast.error("Erro nos arquivos de orçamento");
        } else if (errors.receiptIds) {
          toast.error("Erro nos arquivos de recibo");
        } else if (errors.invoiceIds) {
          toast.error("Erro nos arquivos de nota fiscal");
        } else {
          // Log all error keys for debugging
          const errorKeys = Object.keys(errors);
          if (process.env.NODE_ENV !== "production") {
            console.error("Unknown form errors on fields:", errorKeys);
          }
          toast.error("Por favor, corrija os erros no formulário");
        }
        return;
      }

      // Validate final form
      const isStepValid = await validateCurrentStep();
      if (!isStepValid) {
        return;
      }

      // Check if there are files to upload (all files in FileWithPreview arrays are new for create)
      const newBudgetFiles = budgetFiles.filter(f => f instanceof File);
      const newReceiptFiles = receiptFiles.filter(f => f instanceof File);
      const newInvoiceFiles = invoiceFiles.filter(f => f instanceof File);

      const hasFiles = newBudgetFiles.length > 0 || newReceiptFiles.length > 0 || newInvoiceFiles.length > 0;

      let result;
      if (hasFiles) {
        // Use FormData when there are files to upload
        const supplier = currentSupplierId ? suppliers.find(s => s.id === currentSupplierId) : undefined;
        const formDataWithFiles = createOrderFormData(
          orderData,
          {
            budgets: newBudgetFiles.length > 0 ? newBudgetFiles as File[] : undefined,
            receipts: newReceiptFiles.length > 0 ? newReceiptFiles as File[] : undefined,
            invoices: newInvoiceFiles.length > 0 ? newInvoiceFiles as File[] : undefined,
          },
          supplier ? {
            id: supplier.id,
            name: supplier.fantasyName,
          } : undefined
        );

        result = await createAsync(formDataWithFiles as any);
      } else {
        // Use regular JSON payload when no files
        result = await createAsync(orderData);
      }

      if (result.success && result.data) {
        // Success toast is handled automatically by the API client
        // No need to show it manually here

        // Clear form and selections
        form.reset();
        clearAllSelections();
        clearTemporaryItems();

        // Navigate to the details page of the newly created order
        setTimeout(() => {
          if (result.data?.id) {
            navigate(routes.inventory.orders.details(result.data.id));
          } else {
            // Fallback to list if no ID is returned
            navigate(routes.inventory.orders.root);
          }
        }, 1500);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Submission error:", error);
      }
      // Error is handled by the mutation hook, but let's log it
    }
  }, [validateCurrentStep, description, supplierId, forecast, notes, freight, discount, selectedItems, quantities, prices, icmses, ipis, temporaryItems, budgetFiles, receiptFiles, invoiceFiles, suppliers, createAsync, form, clearAllSelections, clearTemporaryItems, navigate]);

  const handleCancel = useCallback(() => {
    navigate(routes.inventory.orders.root);
  }, [navigate]);

  const handleNext = useCallback(async () => {
    const isValid = await validateCurrentStep();
    if (isValid) {
      nextStep();
    }
  }, [validateCurrentStep, nextStep]);

  // Check if we're on the last step (review step is always step 3)
  const isLastStep = currentStep === 3 || (currentStep === steps[steps.length - 1]?.id);
  const isFirstStep = currentStep === 1;

  // Watch form state to trigger validation when it changes
  const watchedDescription = form.watch("description");

  // Compute if form is ready to submit. Either inventory selections or
  // temporary items count toward "has items"; both can also coexist.
  const computeFormReadiness = () => {
    const hasDescription = (watchedDescription?.trim().length || 0) > 0;

    const hasInventorySelection = selectedItems.size > 0;
    const inventoryPricesValid = Array.from(selectedItems).every(
      (itemId) => prices[itemId] !== undefined && Number(prices[itemId]) >= 0,
    );

    const validTemp = (temporaryItems || []).filter(
      t => t.temporaryItemDescription.trim() !== "" && t.orderedQuantity > 0,
    );
    const hasValidTemp = validTemp.length > 0;
    const tempPricesValid = validTemp.every(t => Number(t.price) >= 0);

    const hasAnyItem = hasInventorySelection || hasValidTemp;
    const allPricesValid = inventoryPricesValid && tempPricesValid;
    return hasDescription && hasAnyItem && allPricesValid;
  };

  const isFormReadyToSubmit = computeFormReadiness();

  // PDF Export function
  const exportToPDF = useCallback(
    (includePricing: boolean) => {
      const selectedSupplier = suppliers.find((s) => s.id === form.watch("supplierId"));

      // Helper function to format measures like MeasureDisplayCompact
      const formatMeasuresCompact = (measures: any[]) => {
        if (!measures || measures.length === 0) return "-";

        // Sort measures by type order
        const sortedMeasures = [...measures].sort((a, b) => {
          const orderA = (MEASURE_TYPE_ORDER as any)[a.measureType] ?? 999;
          const orderB = (MEASURE_TYPE_ORDER as any)[b.measureType] ?? 999;
          return orderA - orderB;
        });

        // Format all measures
        const measureStrings: string[] = [];
        sortedMeasures.forEach((measure) => {
          if (measure.value !== null && measure.unit !== null) {
            measureStrings.push(measureUtils.formatMeasure({ value: measure.value, unit: measure.unit }, true, 2, measure.measureType));
          } else if (measure.unit !== null) {
            measureStrings.push((MEASURE_UNIT_LABELS as any)[measure.unit] || measure.unit);
          } else if (measure.value !== null) {
            measureStrings.push(measure.value.toString());
          }
        });

        // Show first 2 measures, then "+N" for additional
        if (measureStrings.length > 2) {
          return measureStrings.slice(0, 2).join(" - ") + " +" + (measureStrings.length - 2);
        }
        return measureStrings.join(" - ");
      };

      const inventoryItems = selectedItemsData.map((item: any) => ({
        code: item.uniCode || "-",
        name: item.name,
        brand: item.brands?.map((b: any) => b.name).join(", ") || "-",
        measures: formatMeasuresCompact(item.measures || []),
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
        // Order not yet persisted → preview the predicted next number; manual create → ".2".
        title: buildOrderCode({
          orderNumber: nextOrderNumber,
          orderScheduleId: null,
          supplier: selectedSupplier,
          items: (selectedItemsData || []).map((it: any) => ({ item: it })),
        }),
        documentType: includePricing ? "Pedido de Compra" : "Solicitação de Orçamento",
        includePricing,
        description: form.watch("description") || undefined,
        supplierName: selectedSupplier?.fantasyName || undefined,
        orderDate: new Date(),
        forecastDate: (form.watch("forecast") as Date) || undefined,
        freight: Number(form.watch("freight")) || 0,
        discount: Number(form.watch("discount")) || 0,
        notes: form.watch("notes"),
        items: [...inventoryItems, ...tempItems],
      });
    },
    [form, suppliers, selectedItemsData, quantities, prices, icmses, ipis, temporaryItems, nextOrderNumber],
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
      iconPosition: "right" as const,
    });
  } else {
    navigationActions.push({
      key: "submit",
      label: "Cadastrar",
      icon: isSubmitting ? IconLoader2 : IconCheck,
      onClick: handleSubmit,
      variant: "default" as const,
      disabled: isSubmitting || !isFormReadyToSubmit,
      loading: isSubmitting,
    });
  }

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4 pb-4">
      <PageHeader
        className="flex-shrink-0"
        title="Cadastrar Pedido de Compra"
        icon={IconShoppingCart}
        favoritePage={FAVORITE_PAGES.ESTOQUE_PEDIDOS_CADASTRAR}
        breadcrumbs={[
          { label: "Início", href: "/" },
          { label: "Estoque", href: "/estoque" },
          { label: "Pedidos", href: routes.inventory.orders?.root || "/inventory/orders" },
          { label: "Cadastrar" },
        ]}
        actions={navigationActions}
      />

      <Card className="flex-1 min-h-0 flex flex-col shadow-sm border border-border">
        <CardContent className="flex-1 flex flex-col p-4 overflow-hidden min-h-0">
          <Form {...form}>
            <form
              className="flex flex-col h-full"
              onSubmit={(e) => e.preventDefault()}
            >
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
                          <IconBuilding className="h-5 w-5" />
                          Informações do Pedido
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-6">
                          {/* First Row: Description, Supplier, and Forecast */}
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                            {/* Description - 6/12 width */}
                            <div className="space-y-2 md:col-span-6">
                              <Label className="text-sm font-medium flex items-center gap-2">
                                <IconFileText className="h-4 w-4" />
                                Descrição <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                placeholder="Nome do pedido (ex: Pedido de materiais de escritório)"
                                value={form.watch("description") || ""}
                                onChange={(value) => {
                                  // Input component passes value directly, not an event
                                  const stringValue = (value as string) || "";
                                  // Update form state with validation to clear errors as user types
                                  form.setValue("description", stringValue, {
                                    shouldDirty: true,
                                    shouldTouch: true,
                                    shouldValidate: true,
                                  });
                                  // Update URL state immediately
                                  updateDescription(stringValue);
                                }}
                                onBlur={() => form.trigger("description")}
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
                              <Combobox
                                value={form.watch("supplierId") || ""}
                                onValueChange={(value) => {
                                  const stringValue = Array.isArray(value) ? value[0] : value;
                                  form.setValue("supplierId", stringValue || undefined);
                                  // Update URL state
                                  updateSupplierId(stringValue || undefined);
                                }}
                                options={
                                  suppliers.length === 0
                                    ? []
                                    : suppliers.map((supplier) => ({
                                        value: supplier.id,
                                        label: supplier.fantasyName,
                                        logo: supplier.logo,
                                      }))
                                }
                                placeholder="Selecione um fornecedor (opcional)"
                                emptyText="Nenhum fornecedor encontrado"
                                className="h-10 w-full"
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
                                value={form.watch("forecast") || undefined}
                                onChange={(date) => {
                                  if (date instanceof Date) {
                                    // Set to 13:00 São Paulo time
                                    const newDate = new Date(date);
                                    newDate.setHours(13, 0, 0, 0);
                                    form.setValue("forecast", newDate);
                                    // Update URL state
                                    updateForecast(newDate);
                                  } else {
                                    form.setValue("forecast", undefined);
                                    // Update URL state
                                    updateForecast(undefined);
                                  }
                                }}
                                placeholder="Data"
                                className="w-full"
                                mode="date"
                              />
                            </div>
                          </div>

                          {/* Second Row: Observations only — item-type toggle was removed
                              (inventory + temporary items are now mixed in a single list) */}
                          <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-2 flex flex-col">
                              <Label className="text-sm font-medium flex items-center gap-2">
                                <IconNotes className="h-4 w-4" />
                                Observações
                              </Label>
                              <Textarea
                                placeholder="Observações sobre o pedido (opcional)"
                                value={form.watch("notes") || ""}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  // Update form state
                                  form.setValue("notes", value, {
                                    shouldDirty: true,
                                    shouldTouch: true,
                                  });
                                  // Update URL state
                                  updateNotes(value);
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
                                  maxSize={10 * 1024 * 1024} // 10MB
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
                                  maxSize={10 * 1024 * 1024} // 10MB
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
                                  maxSize={10 * 1024 * 1024} // 10MB
                                  acceptedFileTypes={{
                                    "application/pdf": [".pdf"],
                                    "application/xml": [".xml"],
                                    "image/*": [".jpg", ".jpeg", ".png"],
                                  }}
                                  showPreview={true}
                                  variant="compact"
                                  placeholder="Adicionar NF-e"
                                />
                              </div>
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
                    onQuantityChange={handleQuantityChange}
                    onPriceChange={handlePriceChange}
                    onIcmsChange={handleIcmsChange}
                    onIpiChange={handleIpiChange}
                    editableColumns={{
                      showQuantityInput: true,
                      showPriceInput: true,
                      showIcmsInput: true,
                      showIpiInput: true,
                    }}
                    fixedColumnsConfig={{
                      fixedColumns: ['name'],
                      fixedReasons: {
                        name: 'Essencial para identificar o item sendo pedido',
                      },
                    }}
                    defaultColumns={['uniCode', 'name', 'quantity', 'price', 'monthlyConsumption', 'monthlyConsumptionTrendPercent', 'orderSubtotal']}
                    storageKey="order-item-selector"
                    // URL state management
                    page={page}
                    pageSize={pageSize}
                    showSelectedOnly={showSelectedOnly}
                    searchTerm={searchTerm}
                    filters={filters}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                    onShowSelectedOnlyChange={setShowSelectedOnly}
                    onSearchTermChange={setSearchTerm}
                    onFiltersChange={handleFiltersChange}
                    // Inline temporary item entry — sticky first row + pinned existing temps
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
                            <span className="text-sm font-semibold text-foreground truncate ml-4 text-right">{form.watch("description") || "-"}</span>
                          </div>

                          <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                            <span className="text-sm text-muted-foreground">Fornecedor</span>
                            <span className="text-sm font-semibold text-foreground truncate ml-4 text-right">
                              {form.watch("supplierId") ? suppliers.find((s) => s.id === form.watch("supplierId"))?.fantasyName || "-" : "-"}
                            </span>
                          </div>

                          <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                            <span className="text-sm text-muted-foreground">Previsão de Entrega</span>
                            <span className="text-sm font-semibold text-foreground">{form.watch("forecast") ? formatDate(form.watch("forecast") as Date) : "-"}</span>
                          </div>

                          {(() => {
                            const validTemp = (temporaryItems || []).filter(t => t.temporaryItemDescription.trim() !== "");
                            const totalItemCount = selectionCount + validTemp.length;
                            const totalUnits =
                              Array.from(selectedItems).reduce((total: number, itemId: string) => total + (Number(quantities[itemId]) || 1), 0) +
                              validTemp.reduce((total: number, t) => total + (Number(t.orderedQuantity) || 0), 0);
                            const tempTotal = validTemp.reduce((total: number, t) => {
                              const quantity = Number(t.orderedQuantity) || 0;
                              const price = Number(t.price) || 0;
                              const icms = Number(t.icms) || 0;
                              const ipi = Number(t.ipi) || 0;
                              const subtotal = quantity * price;
                              return total + subtotal + (subtotal * (icms / 100)) + (subtotal * (ipi / 100));
                            }, 0);
                            const tempGoodsSubtotal = validTemp.reduce((total: number, t) => {
                              return total + (Number(t.orderedQuantity) || 0) * (Number(t.price) || 0);
                            }, 0);
                            const watchedFreight = Number(form.watch("freight")) || 0;
                            const watchedDiscount = Number(form.watch("discount")) || 0;
                            const discountAmount = watchedDiscount > 0 ? (inventoryGoodsSubtotal + tempGoodsSubtotal) * (watchedDiscount / 100) : 0;
                            const grandTotal = totalPrice + tempTotal + watchedFreight - discountAmount;
                            return (
                              <>
                                <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                                  <span className="text-sm text-muted-foreground">Itens</span>
                                  <span className="text-sm font-semibold text-foreground">
                                    {totalItemCount} itens / {totalUnits} unidades
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
                                    <span className="text-sm font-semibold text-primary">
                                      {formatCurrency(grandTotal)}
                                    </span>
                                  </div>
                                )}
                              </>
                            );
                          })()}

                          {form.watch("notes") && (
                            <div className="bg-muted/50 rounded-lg px-4 py-3">
                              <span className="text-sm text-muted-foreground block mb-1">Observações</span>
                              <p className="text-sm text-foreground whitespace-pre-wrap">{form.watch("notes")}</p>
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
                                value={form.watch("paymentResponsibleId") || ""}
                                onValueChange={(value) => {
                                  const stringValue = Array.isArray(value) ? value[0] : value;
                                  form.setValue("paymentResponsibleId", stringValue || undefined);
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
                                  form.setValue("paymentMethod", stringValue || null);
                                  if (stringValue !== "PIX") {
                                    form.setValue("paymentPix", null);
                                  }
                                  if (stringValue !== "BANK_SLIP") {
                                    form.setValue("paymentDueDays", null);
                                    form.setValue("installmentCount", 1);
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
                                  placeholder={(() => {
                                    const supplierId = form.watch("supplierId");
                                    const supplier = suppliers.find(s => s.id === supplierId);
                                    return supplier?.pix ? `Padrão: ${supplier.pix}` : "CPF, CNPJ, E-mail, Telefone...";
                                  })()}
                                  value={form.watch("paymentPix") || (() => {
                                    const supplierId = form.watch("supplierId");
                                    const supplier = suppliers.find(s => s.id === supplierId);
                                    return supplier?.pix || "";
                                  })()}
                                  onChange={(value) => {
                                    form.setValue("paymentPix", (value as string) || null);
                                  }}
                                  onBlur={() => {
                                    const currentValue = form.getValues("paymentPix");
                                    if (currentValue) {
                                      const formatted = formatPixKey(currentValue);
                                      form.setValue("paymentPix", formatted);
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
                                    form.setValue("paymentDueDays", stringValue ? parseInt(stringValue) : null);
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

                          {/* Parcelas (boleto 2x/3x) — generates one installment per parcela,
                              each spaced by the "Prazo de Vencimento" above. */}
                          {form.watch("paymentMethod") === "BANK_SLIP" && (
                            <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-[6px]">
                              <span className="text-sm text-muted-foreground whitespace-nowrap mr-4">Parcelas</span>
                              <div className="flex-1 max-w-[55%] [&_button]:border-neutral-500">
                                <Combobox
                                  value={(form.watch("installmentCount") || 1).toString()}
                                  onValueChange={(value) => {
                                    const stringValue = Array.isArray(value) ? value[0] : value;
                                    form.setValue("installmentCount", stringValue ? parseInt(stringValue) : 1);
                                  }}
                                  options={Array.from({ length: 12 }, (_, i) => ({
                                    value: (i + 1).toString(),
                                    label: i === 0 ? "À vista (1x)" : `${i + 1}x`,
                                  }))}
                                  placeholder="Selecione as parcelas"
                                  emptyText="—"
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
                          <IconShoppingCart className="h-5 w-5" />
                          Itens do Pedido
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {(() => {
                          // Get measure display — prioritize volume if both weight and volume exist
                          const getMeasureDisplay = (item: any) => {
                            if (!item.measures || item.measures.length === 0) return "-";
                            const volumeUnits = [MEASURE_UNIT.MILLILITER, MEASURE_UNIT.LITER, MEASURE_UNIT.CUBIC_METER, MEASURE_UNIT.CUBIC_CENTIMETER];
                            const weightUnits = [MEASURE_UNIT.KILOGRAM, MEASURE_UNIT.GRAM];
                            const hasVolume = item.measures.some((m: any) => m.unit !== null && volumeUnits.includes(m.unit as MEASURE_UNIT));
                            const hasWeight = item.measures.some((m: any) => m.unit !== null && weightUnits.includes(m.unit as MEASURE_UNIT));
                            if (hasVolume && hasWeight) {
                              const volumeMeasure = item.measures.find((m: any) => m.unit !== null && volumeUnits.includes(m.unit as MEASURE_UNIT));
                              return volumeMeasure && volumeMeasure.unit ? `${volumeMeasure.value} ${MEASURE_UNIT_LABELS[volumeMeasure.unit as keyof typeof MEASURE_UNIT_LABELS] || volumeMeasure.unit}` : "-";
                            }
                            const firstMeasure = item.measures[0];
                            if (!firstMeasure) return "-";
                            return `${firstMeasure.value} ${MEASURE_UNIT_LABELS[firstMeasure.unit as keyof typeof MEASURE_UNIT_LABELS] || firstMeasure.unit}`;
                          };

                          // Build a unified row list for inventory + temporary items.
                          const inventoryRows = selectedItemsData.map((item) => {
                            const quantity = Number(quantities[item.id]) || 1;
                            const price = Number(prices[item.id]) || 0;
                            const icms = Number(icmses[item.id]) || 0;
                            const ipi = Number(ipis[item.id]) || 0;
                            const subtotal = quantity * price;
                            const taxAmount = subtotal * (icms / 100) + subtotal * (ipi / 100);
                            return {
                              key: `inv-${item.id}`,
                              kind: "inventory" as const,
                              code: item.uniCode || "-",
                              name: item.name,
                              brand: item.brands?.map((b: any) => b.name).join(", ") || "-",
                              measures: getMeasureDisplay(item),
                              quantity, price, icms, ipi, subtotal, taxAmount,
                              total: subtotal + taxAmount,
                            };
                          });
                          const tempRows = (temporaryItems || [])
                            .filter(t => t.temporaryItemDescription.trim() !== "")
                            .map((t) => {
                              const quantity = Number(t.orderedQuantity) || 0;
                              const price = Number(t.price) || 0;
                              const icms = Number(t.icms) || 0;
                              const ipi = Number(t.ipi) || 0;
                              const subtotal = quantity * price;
                              const taxAmount = subtotal * (icms / 100) + subtotal * (ipi / 100);
                              return {
                                key: `tmp-${t.key}`,
                                kind: "temporary" as const,
                                code: t.uniCode || "—",
                                // Show the raw description in the review (the metadata is split into other columns).
                                // The COMPOSED string is what we send to the API at submit.
                                name: t.temporaryItemDescription,
                                brand: t.brand || "—",
                                measures: t.measures || "—",
                                quantity, price, icms, ipi, subtotal, taxAmount,
                                total: subtotal + taxAmount,
                              };
                            });
                          const rows = [...inventoryRows, ...tempRows];
                          const itemsTotal = rows.reduce((sum, r) => sum + r.total, 0);
                          const goodsSubtotal = rows.reduce((sum, r) => sum + r.subtotal, 0);
                          const watchedFreight = Number(form.watch("freight")) || 0;
                          const watchedDiscount = Number(form.watch("discount")) || 0;
                          const discountAmount = watchedDiscount > 0 ? goodsSubtotal * (watchedDiscount / 100) : 0;
                          const grandTotal = itemsTotal + watchedFreight - discountAmount;

                          return (
                            <div className="rounded-md border border-border overflow-hidden w-full">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-muted/50">
                                    <TableHead className="font-semibold">Código</TableHead>
                                    <TableHead className="font-semibold">Nome</TableHead>
                                    <TableHead className="font-semibold">Marca</TableHead>
                                    <TableHead className="font-semibold">Medida</TableHead>
                                    <TableHead className="text-right font-semibold">Quantidade</TableHead>
                                    {canViewPrices && (
                                      <>
                                        <TableHead className="text-right font-semibold">Preço Unit.</TableHead>
                                        <TableHead className="text-right font-semibold">Impostos</TableHead>
                                        <TableHead className="text-right font-semibold">Total</TableHead>
                                      </>
                                    )}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {rows.map((row, index) => (
                                    <TableRow key={row.key} className={cn("transition-colors", index % 2 === 1 && "bg-muted/10")}>
                                      <TableCell className="font-mono">{row.code}</TableCell>
                                      <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                          <span>{row.name}</span>
                                          {row.kind === "temporary" && (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-primary/10 text-primary">
                                              Temp
                                            </span>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell>{row.brand}</TableCell>
                                      <TableCell>{row.measures}</TableCell>
                                      <TableCell className="text-right font-medium">{row.quantity.toLocaleString("pt-BR")}</TableCell>
                                      {canViewPrices && (
                                        <>
                                          <TableCell className="text-right">{formatCurrency(row.price, "pt-BR", "BRL", 3)}</TableCell>
                                          <TableCell className="text-right">{formatCurrency(row.taxAmount)}</TableCell>
                                          <TableCell className="text-right font-semibold">{formatCurrency(row.total)}</TableCell>
                                        </>
                                      )}
                                    </TableRow>
                                  ))}
                                  {canViewPrices && watchedFreight > 0 && (
                                    <TableRow className="bg-muted/20">
                                      <TableCell colSpan={7} className="text-right text-sm text-muted-foreground">
                                        Frete:
                                      </TableCell>
                                      <TableCell className="text-right font-medium">{formatCurrency(watchedFreight)}</TableCell>
                                    </TableRow>
                                  )}
                                  {canViewPrices && discountAmount > 0 && (
                                    <TableRow className="bg-muted/20">
                                      <TableCell colSpan={7} className="text-right text-sm text-muted-foreground">
                                        Desconto ({watchedDiscount}%):
                                      </TableCell>
                                      <TableCell className="text-right font-medium text-red-600 dark:text-red-400">- {formatCurrency(discountAmount)}</TableCell>
                                    </TableRow>
                                  )}
                                  {canViewPrices && (
                                    <TableRow className="bg-muted/30 font-semibold">
                                      <TableCell colSpan={7} className="text-right">
                                        Total Geral:
                                      </TableCell>
                                      <TableCell className="text-right">{formatCurrency(grandTotal)}</TableCell>
                                    </TableRow>
                                  )}
                                </TableBody>
                              </Table>
                            </div>
                          );
                        })()}
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
