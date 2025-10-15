import { useState, useCallback, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useSearchParams } from "react-router-dom";
import { IconLoader2, IconArrowLeft, IconArrowRight, IconCheck, IconBuilding, IconShoppingCart, IconCalendar, IconDownload, IconX, IconAlertTriangle, IconFileInvoice, IconReceipt, IconCurrencyReal } from "@tabler/icons-react";
import type { OrderCreateFormData } from "../../../../schemas";
import { orderCreateSchema } from "../../../../schemas";
import { useOrderMutations, useItems, useSuppliers } from "../../../../hooks";
import { routes, FAVORITE_PAGES, ORDER_STATUS, MEASURE_UNIT, MEASURE_UNIT_LABELS } from "../../../../constants";
import { toast } from "sonner";
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
import { useOrderFormUrlState } from "@/hooks/use-order-form-url-state";
import { formatCurrency, formatDate, formatDateTime } from "../../../../utils";

const steps = [
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

export const OrderCreateForm = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize state from URL parameters
  const [currentStep, setCurrentStep] = useState(getStepFromUrl(searchParams));

  // File upload state
  const [budgetFiles, setBudgetFiles] = useState<FileWithPreview[]>([]);
  const [receiptFiles, setReceiptFiles] = useState<FileWithPreview[]>([]);
  const [nfeFiles, setNfeFiles] = useState<FileWithPreview[]>([]);

  // URL state management for item selection (Stage 2)
  const {
    selectedItems,
    quantities,
    prices,
    taxes,
    description,
    supplierId,
    forecast,
    notes,
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
    setBatchFilters,
    toggleItemSelection,
    setItemQuantity,
    setItemPrice,
    setItemTax,
    selectionCount,
    clearAllSelections,
  } = useOrderFormUrlState({
    defaultQuantity: 1,
    defaultPrice: 0,
    preserveQuantitiesOnDeselect: false,
    defaultPageSize: 40,
  });

  // Form setup with default values from URL state
  const form = useForm<OrderCreateFormData>({
    resolver: zodResolver(orderCreateSchema),
    defaultValues: {
      description: description || "",
      supplierId: supplierId && supplierId.trim() !== "" ? supplierId : undefined,
      forecast: forecast || undefined,
      notes: notes || "",
      items: [],
    },
    mode: "onChange", // Validate on every change for real-time feedback
    reValidateMode: "onChange", // Re-validate on every change
    criteriaMode: "all", // Show all errors
    shouldFocusError: true, // Focus on first error field when validation fails
  });

  // Sync URL state changes back to form and trigger validation
  useEffect(() => {
    form.setValue("description", description || "", { shouldValidate: true, shouldDirty: true, shouldTouch: true });
  }, [description, form]);

  useEffect(() => {
    form.setValue("supplierId", supplierId || undefined, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
  }, [supplierId, form]);

  useEffect(() => {
    form.setValue("forecast", forecast || undefined, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
  }, [forecast, form]);

  useEffect(() => {
    form.setValue("notes", notes || "", { shouldValidate: true, shouldDirty: true, shouldTouch: true });
  }, [notes, form]);

  // Sync selected items to form for validation
  useEffect(() => {
    const items = Array.from(selectedItems).map((itemId) => ({
      itemId,
      orderedQuantity: quantities[itemId] || 1,
      price: prices[itemId] || 0,
      tax: taxes[itemId] || 0,
    }));
    form.setValue("items", items, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
  }, [selectedItems, quantities, prices, taxes, form]);

  // Mutations
  const { createAsync, isLoading: isSubmitting } = useOrderMutations();

  // Fetch suppliers for selection
  const { data: suppliersResponse } = useSuppliers({
    orderBy: { fantasyName: "asc" },
    take: 100,
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

  // Keep step in sync with URL
  useEffect(() => {
    const stepFromUrl = getStepFromUrl(searchParams);
    if (stepFromUrl !== currentStep) {
      setCurrentStep(stepFromUrl);
    }
  }, [searchParams]); // Removed currentStep to prevent circular dependency

  // Calculate total price
  const totalPrice = Array.from(selectedItems).reduce((total: number, itemId: string) => {
    const quantity = Number(quantities[itemId]) || 1;
    const price = Number(prices[itemId]) || 0;
    const tax = Number(taxes[itemId]) || 0;
    const subtotal = quantity * price;
    const taxAmount = subtotal * (tax / 100);
    return total + subtotal + taxAmount;
  }, 0);

  // Navigation helpers
  const nextStep = useCallback(() => {
    if (currentStep < steps.length) {
      const newStep = currentStep + 1;
      setCurrentStep(newStep);
      setSearchParams(setStepInUrl(searchParams, newStep), { replace: true });
    }
  }, [currentStep, searchParams, setSearchParams]);

  const prevStep = useCallback(() => {
    if (currentStep > 1) {
      const newStep = currentStep - 1;
      setCurrentStep(newStep);
      setSearchParams(setStepInUrl(searchParams, newStep), { replace: true });
    }
  }, [currentStep, searchParams, setSearchParams]);

  // Stage validation
  const validateCurrentStep = useCallback(async (): Promise<boolean> => {
    switch (currentStep) {
      case 1:
        // Additional validation for description
        const formDescription = form.getValues("description");
        if (!formDescription || formDescription.trim().length === 0) {
          toast.error("Descrição é obrigatória");
          return false;
        }
        if (formDescription.trim().length > 500) {
          toast.error("Descrição deve ter no máximo 500 caracteres");
          return false;
        }

        // Trigger form validation for step 1 fields
        const step1Valid = await form.trigger(["description", "supplierId", "forecast", "notes"]);
        if (!step1Valid) {
          // Get the first error message from form errors
          const errors = form.formState.errors;
          if (errors.description) {
            toast.error(errors.description.message || "Erro na descrição");
          }
          return false;
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
        // Additional checks
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
  }, [currentStep, form, selectedItems, prices]);

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
    (itemId: string, quantity?: number, price?: number, tax?: number) => {
      toggleItemSelection(itemId, quantity, price, tax);
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

  const handleTaxChange = useCallback(
    (itemId: string, tax: number) => {
      const validTax = Math.max(0, Math.min(100, tax));
      setItemTax(itemId, validTax);
    },
    [setItemTax],
  );

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    try {
      // Prepare items for validation
      const itemsData = Array.from(selectedItems).map((itemId) => ({
        itemId: String(itemId),
        orderedQuantity: Number(quantities[itemId]) || 1,
        price: Number(prices[itemId]) || 0,
        tax: Number(taxes[itemId]) || 0,
      }));

      // Get form values to ensure we have the latest data
      const currentDescription = form.getValues("description");
      const currentSupplierId = form.getValues("supplierId");
      const currentForecast = form.getValues("forecast");
      const currentNotes = form.getValues("notes");

      // Prepare the complete form data
      const formData: OrderCreateFormData = {
        description: currentDescription?.trim() || "",
        status: ORDER_STATUS.CREATED,
        supplierId: currentSupplierId || undefined,
        forecast: currentForecast || undefined,
        notes: currentNotes?.trim() || undefined,
        items: itemsData,
      };

      // Set all form values at once
      Object.keys(formData).forEach((key) => {
        form.setValue(key as keyof OrderCreateFormData, formData[key as keyof OrderCreateFormData]);
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
      const result = await createAsync(formData);
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
  }, [validateCurrentStep, description, supplierId, forecast, notes, selectedItems, quantities, prices, taxes, createAsync, form, clearAllSelections, navigate]);

  const handleCancel = useCallback(() => {
    navigate(routes.inventory.orders.root);
  }, [navigate]);

  const handleNext = useCallback(async () => {
    const isValid = await validateCurrentStep();
    if (isValid) {
      nextStep();
    }
  }, [validateCurrentStep, nextStep]);

  const isLastStep = currentStep === steps.length;
  const isFirstStep = currentStep === 1;

  // Watch form description for submit button state
  const watchedDescription = form.watch("description");

  // Compute if form is ready to submit
  const isFormReadyToSubmit = useMemo(() => {
    // Check if we have a description
    const hasDescription = watchedDescription?.trim().length > 0;

    // Check if we have selected items with prices
    const hasSelectedItems = selectedItems.size > 0;
    const allItemsHavePrices = Array.from(selectedItems).every((itemId) => prices[itemId] !== undefined && Number(prices[itemId]) >= 0);

    return hasDescription && hasSelectedItems && allItemsHavePrices;
  }, [watchedDescription, selectedItems, prices]);

  // PDF Export function
  const exportToPDF = useCallback(
    (e?: React.MouseEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      const selectedSupplier = suppliers.find((s) => s.id === form.watch("supplierId"));

      const pdfContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Pedido de Compra - ${formatDate(new Date())}</title>
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
            height: auto;
            margin-right: 20px;
          }
          
          .header-info {
            flex: 1;
          }
          
          .title {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 10px;
            color: #1f2937;
          }
          
          .subtitle {
            font-size: 14px;
            color: #6b7280;
            margin-bottom: 5px;
          }
          
          .info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin-bottom: 20px;
            padding: 15px;
            background: #f9fafb;
            border-radius: 8px;
          }
          
          .info-item {
            display: flex;
            flex-direction: column;
          }
          
          .info-label {
            font-size: 11px;
            font-weight: 600;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 2px;
          }
          
          .info-value {
            font-size: 14px;
            color: #1f2937;
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
            table-layout: fixed;
            word-wrap: break-word;
          }
          
          th {
            background-color: #f9fafb;
            font-weight: 600;
            color: #374151;
            padding: 10px 12px;
            border-bottom: 2px solid #e5e7eb;
            border-right: 1px solid #e5e7eb;
            text-transform: uppercase;
            letter-spacing: 0.03em;
            text-align: left;
          }
          
          th:last-child {
            border-right: none;
          }
          
          td {
            padding: 8px 12px;
            border-bottom: 1px solid #f3f4f6;
            border-right: 1px solid #f3f4f6;
            vertical-align: top;
          }
          
          td:last-child {
            border-right: none;
          }
          
          tbody tr:nth-child(even) {
            background-color: #fafafa;
          }
          
          tbody tr:hover {
            background-color: #f3f4f6;
          }
          
          .text-right {
            text-align: right;
          }
          
          .text-center {
            text-align: center;
          }
          
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
          
          .text-muted {
            color: #6b7280;
          }
          
          .total-row {
            font-weight: 600;
            background-color: #f3f4f6 !important;
            border-top: 2px solid #e5e7eb;
          }
          
          .footer {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            padding-top: 15px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 10px;
            flex-shrink: 0;
            background: white;
          }
          
          .footer-right {
            text-align: right;
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
          
          /* Column widths */
          th:nth-child(1), td:nth-child(1) { width: 90px; } /* UniCode */
          th:nth-child(2), td:nth-child(2) { width: 180px; } /* Nome */
          th:nth-child(3), td:nth-child(3) { width: 100px; } /* Marca */
          th:nth-child(4), td:nth-child(4) { width: 80px; } /* Medida */
          th:nth-child(5), td:nth-child(5) { width: 90px; text-align: right; } /* Quantidade */
          th:nth-child(6), td:nth-child(6) { width: 90px; text-align: right; } /* Preço Unit. */
          th:nth-child(7), td:nth-child(7) { width: 90px; text-align: right; } /* Total */
          
          /* Print optimizations */
          @media print {
            html, body {
              width: 100%;
              height: 100%;
              overflow: visible;
            }
            
            body {
              display: block;
              min-height: 100vh;
              position: relative;
              padding-bottom: 50px;
            }
            
            .header { 
              margin-bottom: 15px; 
              padding-bottom: 10px;
            }
            
            .logo { 
              width: 80px; 
            }
            
            table { 
              font-size: 10px;
              page-break-inside: auto;
            }
            
            th { 
              padding: 6px 8px;
              font-size: 10px;
            }
            
            td { 
              padding: 5px 8px;
            }
            
            tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
            
            thead {
              display: table-header-group;
            }
            
            .footer {
              position: fixed;
              bottom: 15px;
              left: 12mm;
              right: 12mm;
              background: white;
              font-size: 8px;
            }
            
            .content-wrapper {
              padding-bottom: 60px;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="/logo.png" alt="Ankaa Logo" class="logo" />
          <div class="header-info">
            <h1 class="title">Pedido de Compra</h1>
            <p class="subtitle">Documento de controle de pedido de materiais</p>
          </div>
        </div>
        
        <div class="info-grid">
          <div class="info-item full-width">
            <span class="info-label">Descrição</span>
            <span class="info-value">${form.watch("description") || "-"}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Fornecedor</span>
            <span class="info-value">${selectedSupplier?.name || "-"}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Data de Entrega</span>
            <span class="info-value">${form.watch("forecast") ? formatDate(new Date(form.watch("forecast"))) : "-"}</span>
          </div>
        </div>
        
        <div class="content-wrapper">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nome do Item</th>
                <th>Marca</th>
                <th>Medida</th>
                <th class="text-right">Quantidade</th>
                <th class="text-right">Preço Unit.</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${selectedItemsData
                .map((item) => {
                  const quantity = Number(quantities[item.id]) || 1;
                  const price = Number(prices[item.id]) || 0;
                  const total = quantity * price;

                  // Get measure display - prioritize volume if both weight and volume exist
                  const getMeasureDisplay = () => {
                    if (!item.measures || item.measures.length === 0) return "-";

                    const volumeUnits = ["MILLILITER", "LITER", "CUBIC_METER", "CUBIC_CENTIMETER"];
                    const weightUnits = ["KILOGRAM", "GRAM"];

                    const hasVolume = item.measures.some((m) => m.unit !== null && volumeUnits.includes(m.unit as string));
                    const hasWeight = item.measures.some((m) => m.unit !== null && weightUnits.includes(m.unit as string));

                    if (hasVolume && hasWeight) {
                      // If both exist, show only volume
                      const volumeMeasure = item.measures.find((m) => m.unit !== null && volumeUnits.includes(m.unit as string));
                      if (volumeMeasure) {
                        const unitLabels = {
                          MILLILITER: "ml",
                          LITER: "l",
                          CUBIC_METER: "m³",
                          CUBIC_CENTIMETER: "cm³",
                        };
                        const unitLabel = unitLabels[volumeMeasure.unit as keyof typeof unitLabels] || volumeMeasure.unit;
                        return volumeMeasure.value + " " + unitLabel;
                      }
                      return "-";
                    }

                    // Otherwise show the first measure
                    const firstMeasure = item.measures[0];
                    if (!firstMeasure) return "-";

                    const unitLabels = {
                      // Weight units
                      KILOGRAM: "kg",
                      GRAM: "g",
                      // Volume units
                      MILLILITER: "ml",
                      LITER: "l",
                      CUBIC_METER: "m³",
                      CUBIC_CENTIMETER: "cm³",
                      // Length units
                      MILLIMETER: "mm",
                      CENTIMETER: "cm",
                      METER: "m",
                      INCHES: "pol",
                      // Diameter units (fractional inches)
                      INCH_1_8: '1/8"',
                      INCH_1_4: '1/4"',
                      INCH_3_8: '3/8"',
                      INCH_1_2: '1/2"',
                      INCH_5_8: '5/8"',
                      INCH_3_4: '3/4"',
                      INCH_7_8: '7/8"',
                      INCH_1: '1"',
                      INCH_1_1_4: '1.1/4"',
                      INCH_1_1_2: '1.1/2"',
                      INCH_2: '2"',
                      // Thread pitch units
                      THREAD_MM: "mm (passo)",
                      THREAD_TPI: "TPI",
                      // Electrical units
                      WATT: "W",
                      VOLT: "V",
                      AMPERE: "A",
                      // Area units
                      SQUARE_CENTIMETER: "cm²",
                      SQUARE_METER: "m²",
                      // Count and packaging units
                      UNIT: "un",
                      PAIR: "par",
                      DOZEN: "dz",
                      HUNDRED: "ct",
                      THOUSAND: "mil",
                      // Container and packaging units
                      PACKAGE: "pct",
                      BOX: "cx",
                      ROLL: "rl",
                      SHEET: "fl",
                      SET: "cj",
                      SACK: "sc",
                    };
                    const unitLabel = unitLabels[firstMeasure.unit as keyof typeof unitLabels] || firstMeasure.unit;
                    return firstMeasure.value + " " + unitLabel;
                  };

                  return `
                  <tr>
                    <td class="font-mono">${item.uniCode || "-"}</td>
                    <td class="font-medium">${item.name}</td>
                    <td>${item.brand?.name || "-"}</td>
                    <td>${getMeasureDisplay()}</td>
                    <td class="text-right font-medium">${quantity.toLocaleString("pt-BR")}</td>
                    <td class="text-right">${formatCurrency(Number(price))}</td>
                    <td class="text-right font-semibold">${formatCurrency(Number(total))}</td>
                  </tr>
                `;
                })
                .join("")}
              <tr class="total-row">
                <td colspan="6" class="text-right">Total Geral:</td>
                <td class="text-right font-semibold">${formatCurrency(Number(totalPrice))}</td>
              </tr>
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
          <div class="footer-right">
            <p><strong>Gerado em:</strong> ${formatDateTime(new Date())}</p>
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
    [form, suppliers, selectionCount, selectedItemsData, quantities, prices, totalPrice],
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
                          <IconBuilding className="h-5 w-5" />
                          Informações do Pedido
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-6">
                          {/* Description - Full width */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">
                              Descrição <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              placeholder="Nome do pedido (ex: Pedido de materiais de escritório)"
                              value={form.watch("description") || ""}
                              onChange={(value) => {
                                // The custom Input component passes the cleaned value directly
                                const stringValue = value !== null && value !== undefined ? String(value) : "";
                                // Update form state with validation
                                form.setValue("description", stringValue, {
                                  shouldValidate: true,
                                  shouldDirty: true,
                                  shouldTouch: true,
                                });
                                // Update URL state immediately
                                updateDescription(stringValue);
                              }}
                              onBlur={() => form.trigger("description")}
                              className={`h-10 w-full ${form.formState.errors.description ? "border-red-500" : ""}`}
                            />
                            <FormMessage className="text-sm text-red-500">{form.formState.errors.description?.message}</FormMessage>
                          </div>

                          {/* Supplier, Date and Observations in the same row */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Left Column: Supplier and Date */}
                            <div className="space-y-6">
                              {/* Supplier Selection */}
                              <div className="space-y-2">
                                <Label className="text-sm font-medium">Fornecedor</Label>
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
                                        }))
                                  }
                                  placeholder="Selecione um fornecedor (opcional)"
                                  emptyText="Nenhum fornecedor encontrado"
                                  className="w-full"
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
                              <Label className="text-sm font-medium">Observações</Label>
                              <Textarea
                                placeholder="Observações sobre o pedido (opcional)"
                                value={form.watch("notes") || ""}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  // Update form state
                                  form.setValue("notes", value, {
                                    shouldValidate: true,
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
                                  maxFiles={1}
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
                                  maxFiles={1}
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
                  <OrderItemSelector
                    selectedItems={selectedItems}
                    onSelectItem={handleSelectItem}
                    onSelectAll={() => {}}
                    onQuantityChange={handleQuantityChange}
                    onPriceChange={handlePriceChange}
                    onTaxChange={handleTaxChange}
                    quantities={quantities}
                    prices={prices}
                    taxes={taxes}
                    isSelected={(itemId) => selectedItems.has(itemId)}
                    showQuantityInput={true}
                    showPriceInput={true}
                    showTaxInput={true}
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
                            <p className="text-2xl font-semibold text-foreground">{selectionCount}</p>
                          </div>

                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <IconCalendar className="h-4 w-4 text-muted-foreground" />
                              <p className="text-xs font-medium text-muted-foreground">UNIDADES</p>
                            </div>
                            <p className="text-2xl font-semibold text-foreground">
                              {Array.from(selectedItems).reduce((total: number, itemId: string) => total + (Number(quantities[itemId]) || 1), 0)}
                            </p>
                          </div>

                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <IconBuilding className="h-4 w-4 text-muted-foreground" />
                              <p className="text-xs font-medium text-muted-foreground">TOTAL</p>
                            </div>
                            <p className="text-2xl font-semibold text-primary">{formatCurrency(totalPrice)}</p>
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
                          <IconShoppingCart className="h-5 w-5" />
                          Itens Selecionados
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
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
