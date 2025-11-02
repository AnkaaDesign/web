import { useState, useCallback, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { IconLoader2, IconArrowLeft, IconArrowRight, IconCheck, IconBuilding, IconShoppingCart, IconCalendar, IconDownload, IconX, IconAlertTriangle, IconFileInvoice, IconReceipt, IconCurrencyReal, IconFileText, IconTruck, IconNotes, IconClipboardList } from "@tabler/icons-react";
import type { OrderCreateFormData } from "../../../../schemas";
import { orderCreateSchema } from "../../../../schemas";
import { useOrderMutations, useItems, useSuppliers } from "../../../../hooks";
import { routes, FAVORITE_PAGES, ORDER_STATUS, MEASURE_UNIT, MEASURE_UNIT_LABELS, MEASURE_TYPE_ORDER } from "../../../../constants";
import { toast } from "sonner";
import { createOrderFormData } from "@/utils/form-data-helper";
import { FileUploadField, type FileWithPreview } from "@/components/file";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Form, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { FormSteps } from "@/components/ui/form-steps";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Combobox } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import { OrderItemSelector } from "./order-item-selector";
import { TemporaryItemsInput } from "./temporary-items-input";
import { useOrderFormUrlState } from "@/hooks/use-order-form-url-state";
import { formatCurrency, formatDate, formatDateTime, measureUtils } from "../../../../utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SupplierLogoDisplay } from "@/components/ui/avatar-display";

export const OrderCreateForm = () => {
  const navigate = useNavigate();

  // File upload state
  const [budgetFiles, setBudgetFiles] = useState<FileWithPreview[]>([]);
  const [receiptFiles, setReceiptFiles] = useState<FileWithPreview[]>([]);
  const [nfeFiles, setNfeFiles] = useState<FileWithPreview[]>([]);

  // URL state management for item selection and form navigation (includes step)
  const {
    step: currentStep,
    setStep: setCurrentStep,
    selectedItems,
    quantities,
    prices,
    icmses,
    ipis,
    orderItemMode,
    temporaryItems,
    description,
    supplierId,
    forecast,
    notes,
    updateDescription,
    updateSupplierId,
    updateForecast,
    updateNotes,
    setOrderItemMode,
    addTemporaryItem,
    updateTemporaryItem,
    removeTemporaryItem,
    clearTemporaryItems,
    setTemporaryItems,
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
    setBatchFilters,
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

  // Dynamic steps based on mode
  const steps = useMemo(() => {
    if (orderItemMode === "temporary") {
      return [
        {
          id: 1,
          name: "Informações Básicas",
          description: "Fornecedor e detalhes do pedido",
        },
        {
          id: 3,
          name: "Revisão",
          description: "Confirme os dados do pedido",
        },
      ];
    }
    return [
      {
        id: 1,
        name: "Informações Básicas",
        description: "Fornecedor e detalhes do pedido",
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
  }, [orderItemMode]);

  // Form setup with default values from URL state
  const form = useForm<OrderCreateFormData>({
    resolver: zodResolver(orderCreateSchema),
    defaultValues: {
      description: description || "",
      supplierId: supplierId && supplierId.trim() !== "" ? supplierId : undefined,
      forecast: forecast || undefined,
      notes: notes || "",
      items: [],
      temporaryItems: [],
    },
    mode: "onTouched", // Only validate after user touches a field
    reValidateMode: "onChange", // Re-validate on change after initial validation
    criteriaMode: "all", // Show all errors
    shouldFocusError: true, // Focus on first error field when validation fails
  });

  // Sync URL state changes back to form (validate only if field was already touched)
  useEffect(() => {
    const isTouched = form.formState.touchedFields.description;
    form.setValue("description", description || "", {
      shouldValidate: isTouched,
      shouldDirty: true
    });
  }, [description, form]);

  useEffect(() => {
    const isTouched = form.formState.touchedFields.supplierId;
    form.setValue("supplierId", supplierId || undefined, {
      shouldValidate: isTouched,
      shouldDirty: true
    });
  }, [supplierId, form]);

  useEffect(() => {
    const isTouched = form.formState.touchedFields.forecast;
    form.setValue("forecast", forecast || undefined, {
      shouldValidate: isTouched,
      shouldDirty: true
    });
  }, [forecast, form]);

  useEffect(() => {
    const isTouched = form.formState.touchedFields.notes;
    form.setValue("notes", notes || "", {
      shouldValidate: isTouched,
      shouldDirty: true
    });
  }, [notes, form]);


  // Sync selected items to form (validate only if items field was already touched)
  useEffect(() => {
    const items = Array.from(selectedItems).map((itemId) => ({
      itemId,
      orderedQuantity: quantities[itemId] || 1,
      price: prices[itemId] || 0,
      icms: icmses[itemId] || 0,
      ipi: ipis[itemId] || 0,
    }));
    const isTouched = form.formState.touchedFields.items;
    form.setValue("items", items, {
      shouldValidate: isTouched,
      shouldDirty: true
    });
  }, [selectedItems, quantities, prices, icmses, ipis, form]);

  // Mutations
  const { createAsync, isLoading: isSubmitting } = useOrderMutations();

  // Fetch suppliers for selection
  const { data: suppliersResponse } = useSuppliers({
    orderBy: { fantasyName: "asc" },
    take: 100,
    include: { logo: true },
  });

  const suppliers = suppliersResponse?.data || []; // Fetch selected items data for display
  const { data: selectedItemsResponse } = useItems({
    where: selectedItems.size > 0 ? { id: { in: Array.from(selectedItems) } } : undefined,
    include: {
      brand: true,
      category: true,
      measures: true,
      prices: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    enabled: selectedItems.size > 0,
  });

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

  // Navigation helpers - use the hook's setStep which properly manages URL state
  const nextStep = useCallback(() => {
    if (currentStep < steps.length) {
      // Skip step 2 (item selection) when in temporary mode
      if (currentStep === 1 && orderItemMode === "temporary") {
        setCurrentStep(3); // Jump directly to review
      } else {
        setCurrentStep(currentStep + 1);
      }
    }
  }, [currentStep, setCurrentStep, orderItemMode]);

  const prevStep = useCallback(() => {
    if (currentStep > 1) {
      // Skip step 2 (item selection) when in temporary mode
      if (currentStep === 3 && orderItemMode === "temporary") {
        setCurrentStep(1); // Jump back to step 1
      } else {
        setCurrentStep(currentStep - 1);
      }
    }
  }, [currentStep, setCurrentStep, orderItemMode]);

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

        // In temporary mode, validate temporary items
        if (orderItemMode === "temporary") {
          const tempItems = form.getValues("temporaryItems") || [];
          if (tempItems.length === 0) {
            toast.error("Pelo menos um item temporário deve ser adicionado");
            return false;
          }

          // Validate each temporary item
          const hasIncomplete = tempItems.some((item: any) =>
            !item.temporaryItemDescription || item.temporaryItemDescription.trim() === "" ||
            !item.orderedQuantity || item.orderedQuantity <= 0 ||
            item.price === undefined || item.price === null || item.price < 0
          );

          if (hasIncomplete) {
            toast.error("Todos os itens temporários devem ter descrição, quantidade e preço");
            return false;
          }
        }

        return true;

      case 2:
        // Validate item selection
        if (selectedItems.size === 0) {
          toast.error("Pelo menos um item deve ser selecionado");
          return false;
        }

        // Validate that all selected items have prices set
        const itemsWithoutPrice = Array.from(selectedItems).filter((itemId) => !prices[itemId] || Number(prices[itemId]) <= 0);
        if (itemsWithoutPrice.length > 0) {
          toast.error("Todos os itens selecionados devem ter preço definido");
          return false;
        }
        return true;

      case 3:
        // Additional checks based on mode
        if (orderItemMode === "inventory") {
          if (selectedItems.size === 0) {
            toast.error("Pelo menos um item deve ser selecionado");
            return false;
          }

          // Validate prices
          const itemsWithoutPriceFinal = Array.from(selectedItems).filter((itemId) => !prices[itemId] || Number(prices[itemId]) <= 0);
          if (itemsWithoutPriceFinal.length > 0) {
            toast.error("Todos os itens selecionados devem ter preço definido");
            return false;
          }
        } else {
          // Temporary mode - validate temporary items
          const tempItems = form.getValues("temporaryItems") || [];
          if (tempItems.length === 0) {
            toast.error("Pelo menos um item temporário deve ser adicionado");
            return false;
          }

          // Validate each temporary item
          const hasIncomplete = tempItems.some((item: any) =>
            !item.temporaryItemDescription || item.temporaryItemDescription.trim() === "" ||
            !item.orderedQuantity || item.orderedQuantity <= 0 ||
            item.price === undefined || item.price === null || item.price < 0
          );

          if (hasIncomplete) {
            toast.error("Todos os itens temporários devem ter descrição, quantidade e preço");
            return false;
          }
        }

        // Trigger full form validation
        const isValid = await form.trigger();

        if (!isValid) {
          const errors = form.formState.errors;
          if (errors.description) {
            toast.error(errors.description.message || "Erro na descrição");
          } else if (errors.items) {
            toast.error("Erro nos itens selecionados");
          } else {
            toast.error("Por favor, corrija os erros no formulário");
          }
          return false;
        }

        return true;

      default:
        return true;
    }
  }, [currentStep, form, selectedItems, prices, orderItemMode]);

  // Handle file changes
  const handleBudgetFilesChange = useCallback((files: FileWithPreview[]) => {
    setBudgetFiles(files);
    // Mark form as dirty to enable submit
    form.setValue("budgetId", files.length > 0 ? "pending" : undefined, { shouldDirty: true, shouldTouch: true });
  }, [form]);

  const handleReceiptFilesChange = useCallback((files: FileWithPreview[]) => {
    setReceiptFiles(files);
    form.setValue("receiptId", files.length > 0 ? "pending" : undefined, { shouldDirty: true, shouldTouch: true });
  }, [form]);

  const handleNfeFilesChange = useCallback((files: FileWithPreview[]) => {
    setNfeFiles(files);
    form.setValue("nfeId", files.length > 0 ? "pending" : undefined, { shouldDirty: true, shouldTouch: true });
  }, [form]);

  // Handle item selection
  const handleSelectItem = useCallback(
    (itemId: string, quantity?: number, price?: number, icms?: number, ipi?: number) => {
      toggleItemSelection(itemId, quantity, price, icms, ipi);
    },
    [toggleItemSelection],
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
      // Prepare items based on mode
      let itemsData: any[] = [];

      if (orderItemMode === "inventory") {
        // Inventory items
        itemsData = Array.from(selectedItems).map((itemId) => ({
          itemId: String(itemId),
          orderedQuantity: Number(quantities[itemId]) || 1,
          price: Number(prices[itemId]) || 0,
          icms: Number(icmses[itemId]) || 0,
          ipi: Number(ipis[itemId]) || 0,
        }));
      } else {
        // Temporary items
        const tempItems = form.getValues("temporaryItems") || [];
        itemsData = tempItems.map((item: any) => ({
          temporaryItemDescription: item.temporaryItemDescription,
          orderedQuantity: Number(item.orderedQuantity) || 1,
          price: Number(item.price) || 0,
          icms: Number(item.icms) || 0,
          ipi: Number(item.ipi) || 0,
        }));
      }

      // Get form values to ensure we have the latest data
      const currentDescription = form.getValues("description");
      const currentSupplierId = form.getValues("supplierId");
      const currentForecast = form.getValues("forecast");
      const currentNotes = form.getValues("notes");

      // Prepare the complete form data
      const orderData: OrderCreateFormData = {
        description: currentDescription?.trim() || "",
        status: ORDER_STATUS.CREATED,
        supplierId: currentSupplierId || undefined,
        forecast: currentForecast || undefined,
        notes: currentNotes?.trim() || undefined,
        items: itemsData,
      };

      // Set all form values at once
      Object.keys(orderData).forEach((key) => {
        form.setValue(key as keyof OrderCreateFormData, orderData[key as keyof OrderCreateFormData]);
      });

      // Trigger validation
      const isValid = await form.trigger();
      if (!isValid) {
        const errors = form.formState.errors;
        console.error("Form validation errors:", errors);
        if (errors.description) {
          toast.error(errors.description.message || "Erro na descrição");
        } else {
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
      const newNfeFiles = nfeFiles.filter(f => f instanceof File);

      const hasFiles = newBudgetFiles.length > 0 || newReceiptFiles.length > 0 || newNfeFiles.length > 0;

      console.log('[SUBMIT] Has files:', hasFiles);
      console.log('[SUBMIT] Budget files:', newBudgetFiles.length);
      console.log('[SUBMIT] Receipt files:', newReceiptFiles.length);
      console.log('[SUBMIT] NFE files:', newNfeFiles.length);

      let result;
      if (hasFiles) {
        // Use FormData when there are files to upload
        const supplier = currentSupplierId ? suppliers.find(s => s.id === currentSupplierId) : undefined;
        const formDataWithFiles = createOrderFormData(
          orderData,
          {
            budgets: newBudgetFiles.length > 0 ? newBudgetFiles as File[] : undefined,
            receipts: newReceiptFiles.length > 0 ? newReceiptFiles as File[] : undefined,
            invoices: newNfeFiles.length > 0 ? newNfeFiles as File[] : undefined,
          },
          supplier ? {
            id: supplier.id,
            name: supplier.fantasyName,
          } : undefined
        );

        console.log('[SUBMIT] Using FormData with files');
        result = await createAsync(formDataWithFiles as any);
      } else {
        // Use regular JSON payload when no files
        console.log('[SUBMIT] Using JSON payload (no files)');
        result = await createAsync(orderData);
      }

      if (result.success && result.data) {
        // Success toast is handled automatically by the API client
        // No need to show it manually here

        // Clear form and selections
        form.reset();
        clearAllSelections();

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
      console.error("Submission error:", error);
      // Error is handled by the mutation hook, but let's log it
    }
  }, [validateCurrentStep, description, supplierId, forecast, notes, selectedItems, quantities, prices, icmses, ipis, orderItemMode, budgetFiles, receiptFiles, nfeFiles, suppliers, createAsync, form, clearAllSelections, navigate]);

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
  const watchedTemporaryItems = form.watch("temporaryItems");

  // Compute if form is ready to submit (no useMemo - compute on every render)
  const computeFormReadiness = () => {
    // Use watched values (they're live and trigger re-renders)
    const tempItems = watchedTemporaryItems || [];
    const hasDescription = watchedDescription?.trim().length > 0;

    console.log('[VALIDATION] Mode:', orderItemMode);
    console.log('[VALIDATION] Description:', watchedDescription, 'Valid:', hasDescription);
    console.log('[VALIDATION] Form Temporary Items:', JSON.stringify(tempItems, null, 2));

    // Check based on order mode
    if (orderItemMode === "temporary") {
      // Temporary mode: check for valid temporary items
      const hasTemporaryItems = tempItems.length > 0;

      console.log('[VALIDATION] Temp Items Count:', tempItems.length);
      console.log('[VALIDATION] Has Temporary Items:', hasTemporaryItems);

      const allTemporaryItemsValid = tempItems.every((item: any, index: number) => {
        const hasDescription = item.temporaryItemDescription && item.temporaryItemDescription.trim() !== "";
        const hasValidQuantity = item.orderedQuantity && item.orderedQuantity > 0;
        const hasValidPrice = item.price !== undefined && item.price !== null && Number(item.price) > 0;

        console.log(`[VALIDATION] Item ${index}:`, {
          description: item.temporaryItemDescription,
          hasDescription,
          quantity: item.orderedQuantity,
          hasValidQuantity,
          price: item.price,
          priceType: typeof item.price,
          priceAsNumber: Number(item.price),
          hasValidPrice,
          isValid: hasDescription && hasValidQuantity && hasValidPrice
        });

        return hasDescription && hasValidQuantity && hasValidPrice;
      });

      console.log('[VALIDATION] All Items Valid:', allTemporaryItemsValid);
      const finalResult = hasDescription && hasTemporaryItems && allTemporaryItemsValid;
      console.log('[VALIDATION] Final Result:', finalResult);

      return finalResult;
    } else {
      // Inventory mode: check for selected items with prices
      const hasSelectedItems = selectedItems.size > 0;
      const allItemsHavePrices = Array.from(selectedItems).every((itemId) => prices[itemId] !== undefined && Number(prices[itemId]) >= 0);

      return hasDescription && hasSelectedItems && allItemsHavePrices;
    }
  };

  const isFormReadyToSubmit = computeFormReadiness();

  // PDF Export function
  const exportToPDF = useCallback(
    (e?: React.MouseEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      const selectedSupplier = suppliers.find((s) => s.id === form.watch("supplierId"));
      const orderDescription = form.watch("description") || "Pedido de Compra";

      // Helper function to format measures like MeasureDisplayCompact
      const formatMeasuresCompact = (measures: any[]) => {
        if (!measures || measures.length === 0) return "-";

        // Sort measures by type order
        const sortedMeasures = [...measures].sort((a, b) => {
          const orderA = MEASURE_TYPE_ORDER[a.measureType] ?? 999;
          const orderB = MEASURE_TYPE_ORDER[b.measureType] ?? 999;
          return orderA - orderB;
        });

        // Format all measures
        const measureStrings: string[] = [];
        sortedMeasures.forEach((measure) => {
          if (measure.value !== null && measure.unit !== null) {
            measureStrings.push(measureUtils.formatMeasure({ value: measure.value, unit: measure.unit }));
          } else if (measure.unit !== null) {
            measureStrings.push(MEASURE_UNIT_LABELS[measure.unit] || measure.unit);
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

      const pdfContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${orderDescription} - ${formatDate(new Date())}</title>
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
            align-items: center;
            margin-top: 20px;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #e5e7eb;
          }

          .logo {
            width: 100px;
            height: auto;
            margin-right: 15px;
          }

          .header-info {
            flex: 1;
          }

          .title {
            font-size: 20px;
            font-weight: 700;
            margin-bottom: 8px;
            color: #1f2937;
          }

          .info {
            color: #6b7280;
            font-size: 12px;
          }

          .info p {
            margin: 2px 0;
          }

          .content-wrapper {
            flex: 1;
            overflow: auto;
            min-height: 0;
            padding-bottom: 40px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #e5e7eb;
            font-size: 12px;
          }

          th {
            background-color: #f9fafb;
            font-weight: 600;
            color: #374151;
            padding: 10px 6px;
            border-bottom: 2px solid #e5e7eb;
            border-right: 1px solid #e5e7eb;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.03em;
            text-align: left;
          }

          td {
            padding: 8px 6px;
            border-bottom: 1px solid #f3f4f6;
            border-right: 1px solid #f3f4f6;
            vertical-align: top;
          }

          tbody tr:nth-child(even) {
            background-color: #fafafa;
          }

          .text-left { text-align: left; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }

          .font-mono {
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
            font-size: 11px;
          }

          .font-medium {
            font-weight: 500;
          }

          .font-semibold {
            font-weight: 600;
          }

          .notes-section {
            margin-top: 20px;
            padding: 15px;
            background: #f9fafb;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
          }

          .notes-title {
            font-weight: 600;
            margin-bottom: 5px;
            color: #374151;
          }

          .footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-top: 15px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 10px;
            background: white;
          }

          /* Print optimizations */
          @media print {
            .footer {
              position: fixed;
              bottom: 15px;
              left: 12mm;
              right: 12mm;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="/logo.png" alt="Logo" class="logo" />
          <div class="header-info">
            <h1 class="title">${orderDescription}</h1>
            <div class="info">
              <p><strong>Data do Pedido:</strong> ${formatDate(new Date())}${form.watch("forecast") ? ` | <strong>Data de Entrega:</strong> ${formatDate(new Date(form.watch("forecast")))}` : ""} | <strong>Fornecedor:</strong> ${selectedSupplier ? (selectedSupplier.fantasyName || selectedSupplier.name) : "-"} | <strong>Total de itens:</strong> ${orderItemMode === "inventory" ? selectedItemsData.length : (form.watch("temporaryItems") || []).length}</p>
            </div>
          </div>
        </div>

        <div class="content-wrapper">
          <table>
            <thead>
              <tr>
                <th class="text-left">Código</th>
                <th class="text-left">Nome</th>
                <th class="text-left">Marca</th>
                <th class="text-left">Medidas</th>
                <th class="text-center">Quantidade</th>
              </tr>
            </thead>
            <tbody>
              ${
                orderItemMode === "inventory"
                  ? selectedItemsData
                      .map((item) => {
                        const quantity = Number(quantities[item.id]) || 1;
                        const measuresDisplay = formatMeasuresCompact(item.measures || []);

                        return `
                        <tr>
                          <td class="font-mono text-left">${item.uniCode || "-"}</td>
                          <td class="font-medium text-left">${item.name}</td>
                          <td class="text-left">${item.brand?.name || "-"}</td>
                          <td class="text-left">${measuresDisplay}</td>
                          <td class="text-center font-medium">${quantity.toLocaleString("pt-BR")}</td>
                        </tr>
                      `;
                      })
                      .join("")
                  : (form.watch("temporaryItems") || [])
                      .map((item: any) => {
                        const quantity = Number(item.orderedQuantity) || 0;
                        return `
                        <tr>
                          <td class="font-mono text-left">-</td>
                          <td class="font-medium text-left">${item.temporaryItemDescription || "-"}</td>
                          <td class="text-left">-</td>
                          <td class="text-left">-</td>
                          <td class="text-center font-medium">${quantity.toLocaleString("pt-BR")}</td>
                        </tr>
                      `;
                      })
                      .join("")
              }
            </tbody>
          </table>

          ${
            form.watch("notes")
              ? `
          <div class="notes-section">
            <div class="notes-title">Observações:</div>
            <div>${form.watch("notes")}</div>
          </div>
          `
              : ""
          }
        </div>

        <div class="footer">
          <div>
            <p>Relatório gerado pelo sistema Ankaa</p>
          </div>
          <div>
            <p><strong>Gerado em:</strong> ${formatDate(new Date())} ${new Date().toLocaleTimeString("pt-BR")}</p>
          </div>
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
    [form, suppliers, selectionCount, selectedItemsData, quantities, prices, orderItemMode],
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
    <div className="flex flex-col h-full w-full">
      <div className="flex-shrink-0 pb-4">
        <PageHeaderWithFavorite
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
      </div>

      <Card className="flex-1 min-h-0 flex flex-col w-full shadow-sm border border-border">
        <CardContent className="flex-1 flex flex-col p-6 overflow-hidden min-h-0">
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
                          {/* Description - Full width */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium flex items-center gap-2">
                              <IconFileText className="h-4 w-4" />
                              Descrição <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              placeholder="Nome do pedido (ex: Pedido de materiais de escritório)"
                              value={form.watch("description") || ""}
                              onChange={(value) => {
                                // The custom Input component passes the cleaned value directly
                                const stringValue = value !== null && value !== undefined ? String(value) : "";
                                // Update form state (validation will happen onBlur or when touched)
                                form.setValue("description", stringValue, {
                                  shouldDirty: true,
                                  shouldTouch: true,
                                });
                                // Update URL state immediately
                                updateDescription(stringValue);
                              }}
                              onBlur={() => form.trigger("description")}
                              className={`h-10 w-full bg-transparent ${form.formState.errors.description ? "border-red-500" : ""}`}
                            />
                            <FormMessage className="text-sm text-red-500">{form.formState.errors.description?.message}</FormMessage>
                          </div>

                          {/* Supplier, Date and Observations in the same row */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Left Column: Supplier and Date */}
                            <div className="space-y-6">
                              {/* Supplier Selection */}
                              <div className="space-y-2">
                                <Label className="text-sm font-medium flex items-center gap-2">
                                  <IconTruck className="h-4 w-4" />
                                  Fornecedor
                                </Label>
                                <Combobox
                                  value={form.watch("supplierId") || ""}
                                  onValueChange={(value) => {
                                    form.setValue("supplierId", value || undefined);
                                    // Update URL state
                                    updateSupplierId(value || undefined);
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
                                  className="w-full"
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

                              {/* Scheduled Date */}
                              <div className="space-y-2">
                                <Label className="text-sm font-medium flex items-center gap-2">
                                  <IconCalendar className="h-4 w-4" />
                                  Data de Entrega
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
                                  placeholder="Selecione a data de entrega (opcional)"
                                  className="w-full"
                                  mode="date"
                                  context="forecast"
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
                                className="resize-none w-full flex-1"
                                rows={5}
                              />
                            </div>
                          </div>

                          {/* Mode Switch */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium flex items-center gap-2">
                              <IconClipboardList className="h-4 w-4" />
                              Tipo de Itens
                            </Label>
                            <RadioGroup
                              value={orderItemMode}
                              onValueChange={(value) => setOrderItemMode(value as "inventory" | "temporary")}
                              className="grid grid-cols-1 md:grid-cols-2 gap-3"
                            >
                              <div
                                className="flex items-start space-x-3 space-y-0 rounded-md border p-4 hover:bg-accent cursor-pointer transition-colors group"
                                onClick={() => setOrderItemMode("inventory")}
                              >
                                <RadioGroupItem value="inventory" id="mode-inventory" className="mt-0.5" />
                                <div className="flex-1 space-y-1">
                                  <Label htmlFor="mode-inventory" className="flex items-center gap-2 font-medium cursor-pointer group-hover:text-white">
                                    <IconShoppingCart className="h-4 w-4" />
                                    Itens do Estoque
                                  </Label>
                                  <p className="text-sm text-muted-foreground group-hover:text-white/90">
                                    Selecione itens do inventário
                                  </p>
                                </div>
                              </div>
                              <div
                                className="flex items-start space-x-3 space-y-0 rounded-md border p-4 hover:bg-accent cursor-pointer transition-colors group"
                                onClick={() => setOrderItemMode("temporary")}
                              >
                                <RadioGroupItem value="temporary" id="mode-temporary" className="mt-0.5" />
                                <div className="flex-1 space-y-1">
                                  <Label htmlFor="mode-temporary" className="flex items-center gap-2 font-medium cursor-pointer group-hover:text-white">
                                    <IconFileInvoice className="h-4 w-4" />
                                    Itens Temporários
                                  </Label>
                                  <p className="text-sm text-muted-foreground group-hover:text-white/90">
                                    Compras únicas sem inventário
                                  </p>
                                </div>
                              </div>
                            </RadioGroup>
                          </div>

                          {/* Temporary Items Input (shown only in temporary mode) */}
                          {orderItemMode === "temporary" && (
                            <div className="space-y-4">
                              <Separator />
                              <div className="space-y-3">
                                <Label className="text-sm font-medium flex items-center gap-2">
                                  <IconFileInvoice className="h-4 w-4" />
                                  Itens Temporários
                                </Label>
                                <TemporaryItemsInput
                                  control={form.control}
                                  disabled={isSubmitting}
                                />
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
                                  onFilesChange={handleNfeFilesChange}
                                  existingFiles={nfeFiles}
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

                {currentStep === 2 && orderItemMode === "inventory" && (
                  <OrderItemSelector
                    selectedItems={selectedItems}
                    onSelectItem={handleSelectItem}
                    onSelectAll={() => {}}
                    onQuantityChange={handleQuantityChange}
                    onPriceChange={handlePriceChange}
                    onIcmsChange={handleIcmsChange}
                    onIpiChange={handleIpiChange}
                    quantities={quantities}
                    prices={prices}
                    icmses={icmses}
                    ipis={ipis}
                    isSelected={(itemId) => selectedItems.has(itemId)}
                    showQuantityInput={true}
                    showPriceInput={true}
                    showIcmsInput={true}
                    showIpiInput={true}
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
                    onBatchFiltersChange={setBatchFilters}
                    updateSelection={batchUpdateSelection}
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
                      <Button type="button" variant="ghost" size="sm" onClick={exportToPDF} className="gap-2 text-muted-foreground hover:text-foreground">
                        <IconDownload className="h-4 w-4" />
                        Exportar PDF
                      </Button>
                    </div>

                    {/* Summary Card */}
                    <Card className="w-full">
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                          {/* Description - spans 2 columns on lg */}
                          <div className="lg:col-span-2">
                            <p className="text-xs font-medium text-muted-foreground mb-1">DESCRIÇÃO</p>
                            <p className="text-sm font-medium text-foreground">{form.watch("description") || "Não informado"}</p>
                          </div>

                          {/* Supplier */}
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">FORNECEDOR</p>
                            <p className="text-sm font-medium text-foreground truncate">
                              {form.watch("supplierId") ? suppliers.find((s) => s.id === form.watch("supplierId"))?.fantasyName || "-" : "-"}
                            </p>
                          </div>

                          {/* Delivery */}
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">ENTREGA</p>
                            <p className="text-sm font-medium text-foreground">{form.watch("forecast") ? formatDate(new Date(form.watch("forecast"))) : "-"}</p>
                          </div>
                        </div>

                        {/* Divider */}
                        <Separator className="my-6" />

                        {/* Metrics Row */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <IconShoppingCart className="h-4 w-4 text-muted-foreground" />
                              <p className="text-xs font-medium text-muted-foreground">ITENS</p>
                            </div>
                            <p className="text-2xl font-semibold text-foreground">
                              {orderItemMode === "inventory" ? selectionCount : (form.watch("temporaryItems") || []).length}
                            </p>
                          </div>

                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <IconCalendar className="h-4 w-4 text-muted-foreground" />
                              <p className="text-xs font-medium text-muted-foreground">UNIDADES</p>
                            </div>
                            <p className="text-2xl font-semibold text-foreground">
                              {orderItemMode === "inventory"
                                ? Array.from(selectedItems).reduce((total: number, itemId: string) => total + (Number(quantities[itemId]) || 1), 0)
                                : (form.watch("temporaryItems") || []).reduce((total: number, item: any) => total + (Number(item.orderedQuantity) || 0), 0)}
                            </p>
                          </div>

                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <IconBuilding className="h-4 w-4 text-muted-foreground" />
                              <p className="text-xs font-medium text-muted-foreground">TOTAL</p>
                            </div>
                            <p className="text-2xl font-semibold text-primary">
                              {formatCurrency(
                                orderItemMode === "inventory"
                                  ? totalPrice
                                  : (form.watch("temporaryItems") || []).reduce((total: number, item: any) => {
                                      const quantity = Number(item.orderedQuantity) || 0;
                                      const price = Number(item.price) || 0;
                                      const icms = Number(item.icms) || 0;
                                      const ipi = Number(item.ipi) || 0;
                                      const subtotal = quantity * price;
                                      const icmsAmount = subtotal * (icms / 100);
                                      const ipiAmount = subtotal * (ipi / 100);
                                      const taxAmount = icmsAmount + ipiAmount;
                                      return total + subtotal + taxAmount;
                                    }, 0)
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Notes */}
                        {form.watch("notes") && (
                          <>
                            <Separator className="my-6" />
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-2">OBSERVAÇÕES</p>
                              <p className="text-sm text-muted-foreground">{form.watch("notes")}</p>
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>

                    {/* Items Table */}
                    <Card className="w-full">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          {orderItemMode === "inventory" ? <IconShoppingCart className="h-5 w-5" /> : <IconFileInvoice className="h-5 w-5" />}
                          {orderItemMode === "inventory" ? "Itens Selecionados" : "Itens Temporários"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {orderItemMode === "inventory" ? (
                          <div className="rounded-md border overflow-hidden w-full">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/50">
                                  <TableHead className="font-semibold">Código</TableHead>
                                  <TableHead className="font-semibold">Nome</TableHead>
                                  <TableHead className="font-semibold">Marca</TableHead>
                                  <TableHead className="font-semibold">Medida</TableHead>
                                  <TableHead className="text-right font-semibold">Quantidade</TableHead>
                                  <TableHead className="text-right font-semibold">Preço Unit.</TableHead>
                                  <TableHead className="text-right font-semibold">Total</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {selectedItemsData.map((item, index) => {
                                const quantity = Number(quantities[item.id]) || 1;
                                const price = Number(prices[item.id]) || 0;
                                const total = quantity * price;

                                // Get measure display - prioritize volume if both weight and volume exist
                                const getMeasureDisplay = () => {
                                  if (!item.measures || item.measures.length === 0) return "-";

                                  const volumeUnits = [MEASURE_UNIT.MILLILITER, MEASURE_UNIT.LITER, MEASURE_UNIT.CUBIC_METER, MEASURE_UNIT.CUBIC_CENTIMETER];
                                  const weightUnits = [MEASURE_UNIT.KILOGRAM, MEASURE_UNIT.GRAM];

                                  const hasVolume = item.measures.some((m) => m.unit !== null && volumeUnits.includes(m.unit as MEASURE_UNIT));
                                  const hasWeight = item.measures.some((m) => m.unit !== null && weightUnits.includes(m.unit as MEASURE_UNIT));

                                  if (hasVolume && hasWeight) {
                                    // If both exist, show only volume
                                    const volumeMeasure = item.measures.find((m) => m.unit !== null && volumeUnits.includes(m.unit as MEASURE_UNIT));
                                    return volumeMeasure && volumeMeasure.unit ? `${volumeMeasure.value} ${MEASURE_UNIT_LABELS[volumeMeasure.unit] || volumeMeasure.unit}` : "-";
                                  }

                                  // Otherwise show the first measure
                                  const firstMeasure = item.measures[0];
                                  if (!firstMeasure) return "-";
                                  return `${firstMeasure.value} ${MEASURE_UNIT_LABELS[firstMeasure.unit as keyof typeof MEASURE_UNIT_LABELS] || firstMeasure.unit}`;
                                };

                                return (
                                  <TableRow key={item.id} className={cn("transition-colors", index % 2 === 1 && "bg-muted/10")}>
                                    <TableCell className="font-mono">{item.uniCode || "-"}</TableCell>
                                    <TableCell className="font-medium">{item.name}</TableCell>
                                    <TableCell>{item.brand?.name || "-"}</TableCell>
                                    <TableCell>{getMeasureDisplay()}</TableCell>
                                    <TableCell className="text-right font-medium">{quantity.toLocaleString("pt-BR")}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(Number(price))}</TableCell>
                                    <TableCell className="text-right font-semibold">{formatCurrency(Number(total))}</TableCell>
                                  </TableRow>
                                );
                              })}
                              <TableRow className="bg-muted/30 font-semibold">
                                <TableCell colSpan={6} className="text-right">
                                  Total Geral:
                                </TableCell>
                                <TableCell className="text-right">{formatCurrency(Number(totalPrice))}</TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                        ) : (
                          <div className="rounded-md border overflow-hidden w-full">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/50">
                                  <TableHead className="font-semibold">Descrição</TableHead>
                                  <TableHead className="text-right font-semibold">Quantidade</TableHead>
                                  <TableHead className="text-right font-semibold">Preço Unit.</TableHead>
                                  <TableHead className="text-right font-semibold">ICMS (%)</TableHead>
                                  <TableHead className="text-right font-semibold">IPI (%)</TableHead>
                                  <TableHead className="text-right font-semibold">Subtotal</TableHead>
                                  <TableHead className="text-right font-semibold">Impostos</TableHead>
                                  <TableHead className="text-right font-semibold">Total</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {(form.watch("temporaryItems") || []).map((item: any, index: number) => {
                                  const quantity = Number(item.orderedQuantity) || 0;
                                  const price = Number(item.price) || 0;
                                  const icms = Number(item.icms) || 0;
                                  const ipi = Number(item.ipi) || 0;
                                  const subtotal = quantity * price;
                                  const icmsAmount = subtotal * (icms / 100);
                                  const ipiAmount = subtotal * (ipi / 100);
                                  const taxAmount = icmsAmount + ipiAmount;
                                  const total = subtotal + taxAmount;

                                  return (
                                    <TableRow key={index} className={cn("transition-colors", index % 2 === 1 && "bg-muted/10")}>
                                      <TableCell className="font-medium">{item.temporaryItemDescription || "-"}</TableCell>
                                      <TableCell className="text-right font-medium">{quantity.toLocaleString("pt-BR")}</TableCell>
                                      <TableCell className="text-right">{formatCurrency(price)}</TableCell>
                                      <TableCell className="text-right">{icms.toFixed(2)}%</TableCell>
                                      <TableCell className="text-right">{ipi.toFixed(2)}%</TableCell>
                                      <TableCell className="text-right">{formatCurrency(subtotal)}</TableCell>
                                      <TableCell className="text-right">{formatCurrency(taxAmount)}</TableCell>
                                      <TableCell className="text-right font-semibold">{formatCurrency(total)}</TableCell>
                                    </TableRow>
                                  );
                                })}
                                <TableRow className="bg-muted/30 font-semibold">
                                  <TableCell colSpan={7} className="text-right">
                                    Total Geral:
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatCurrency(
                                      (form.watch("temporaryItems") || []).reduce((total: number, item: any) => {
                                        const quantity = Number(item.orderedQuantity) || 0;
                                        const price = Number(item.price) || 0;
                                        const icms = Number(item.icms) || 0;
                                        const ipi = Number(item.ipi) || 0;
                                        const subtotal = quantity * price;
                                        const icmsAmount = subtotal * (icms / 100);
                                        const ipiAmount = subtotal * (ipi / 100);
                                        const taxAmount = icmsAmount + ipiAmount;
                                        return total + subtotal + taxAmount;
                                      }, 0)
                                    )}
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </div>
                        )}
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
