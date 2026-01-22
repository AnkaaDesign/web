import { useState, useCallback, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useSearchParams } from "react-router-dom";
import { IconLoader2, IconArrowLeft, IconArrowRight, IconCheck, IconUser, IconArrowBack, IconPackage, IconPackageExport, IconDownload, IconFileInvoice, IconReceipt } from "@tabler/icons-react";
import type { ExternalWithdrawalCreateFormData, ItemGetManyFormData } from "../../../../schemas";
import { externalWithdrawalCreateSchema } from "../../../../schemas";
import { useExternalWithdrawalMutations, useItems } from "../../../../hooks";
import { routes, EXTERNAL_WITHDRAWAL_TYPE, EXTERNAL_WITHDRAWAL_TYPE_LABELS } from "../../../../constants";
import { toast } from "sonner";
import { FileUploadField, type FileWithPreview } from "@/components/common/file";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Form } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { PageHeader } from "@/components/ui/page-header";
import { FormSteps } from "@/components/ui/form-steps";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ItemSelectorTable } from "@/components/inventory/common/item-selector";
import { useExternalWithdrawalFormUrlState } from "@/hooks/use-external-withdrawal-form-url-state";
import { formatCurrency, formatDate, formatDateTime } from "../../../../utils";
import { MEASURE_UNIT, MEASURE_UNIT_LABELS } from "../../../../constants";
import { createWithdrawalFormData } from "@/utils/form-data-helper";

const steps = [
  {
    id: 1,
    name: "Informações Básicas",
    description: "Responsável e detalhes da retirada",
  },
  {
    id: 2,
    name: "Seleção de Itens",
    description: "Escolha os itens e quantidades",
  },
  {
    id: 3,
    name: "Revisão",
    description: "Confirme os dados da retirada",
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

export const ExternalWithdrawalCreateForm = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize state from URL parameters
  const [currentStep, setCurrentStep] = useState(getStepFromUrl(searchParams));

  // File upload state
  const [receiptFiles, setReceiptFiles] = useState<FileWithPreview[]>([]);
  const [nfeFiles, setNfeFiles] = useState<FileWithPreview[]>([]);

  // URL state management for item selection (Stage 2)
  const {
    selectedItems,
    quantities,
    prices,
    withdrawerName,
    type: withdrawalType,
    notes,
    updateWithdrawerName,
    updateType,
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
    selectionCount,
    clearAllSelections,
  } = useExternalWithdrawalFormUrlState({
    defaultQuantity: 1,
    defaultPrice: 0,
    preserveQuantitiesOnDeselect: false,
    defaultPageSize: 40,
  });

  // Form setup with default values from URL state
  const defaultValues: Partial<ExternalWithdrawalCreateFormData> = {
    withdrawerName: withdrawerName || "",
    type: withdrawalType,
    notes: notes || "",
    items: [],
  };

  const form = useForm<ExternalWithdrawalCreateFormData>({
    resolver: zodResolver(externalWithdrawalCreateSchema),
    mode: "onChange",
    defaultValues,
  });

  // Keep form in sync with URL state
  useEffect(() => {
    form.setValue("withdrawerName", withdrawerName || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withdrawerName]);

  useEffect(() => {
    form.setValue("type", withdrawalType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withdrawalType]);

  useEffect(() => {
    form.setValue("notes", notes || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  // Mutations
  const { createAsync, isLoading: isSubmitting } = useExternalWithdrawalMutations();

  // Fetch selected items data for display
  const { data: selectedItemsResponse } = useItems({
    where: selectedItems.size > 0 ? { id: { in: Array.from(selectedItems) } } : undefined,
    include: {
      brand: true,
      category: true,
      prices: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
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

  // Calculate total price (only for CHARGEABLE type)
  const totalPrice = withdrawalType === EXTERNAL_WITHDRAWAL_TYPE.CHARGEABLE
    ? Array.from(selectedItems).reduce((total, itemId) => {
        const quantity = Number(quantities[itemId]) || 1;
        const price = Number(prices[itemId]) || 0;
        return total + quantity * price;
      }, 0)
    : 0;

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
  const validateCurrentStep = useCallback((): boolean => {
    switch (currentStep) {
      case 1:
        // Validate basic information using URL state
        if (!withdrawerName?.trim()) {
          toast.error("Nome do retirador é obrigatório");
          return false;
        }
        if (withdrawerName.trim().length < 2) {
          toast.error("Nome do retirador deve ter pelo menos 2 caracteres");
          return false;
        }
        if (withdrawerName.trim().length > 200) {
          toast.error("Nome do retirador deve ter no máximo 200 caracteres");
          return false;
        }
        if (notes && notes.length > 500) {
          toast.error("Observações devem ter no máximo 500 caracteres");
          return false;
        }
        return true;

      case 2:
        // Validate item selection
        if (selectedItems.size === 0) {
          toast.error("Pelo menos um item deve ser selecionado");
          return false;
        }

        // Validate item quantities
        const itemsWithInvalidQuantity = Array.from(selectedItems).filter((itemId) => {
          const quantity = quantities[itemId];
          return !quantity || quantity <= 0;
        });
        if (itemsWithInvalidQuantity.length > 0) {
          toast.error("Todos os itens selecionados devem ter quantidade maior que zero");
          return false;
        }

        // Validate that all selected items have prices set (only for CHARGEABLE type)
        if (withdrawalType === EXTERNAL_WITHDRAWAL_TYPE.CHARGEABLE) {
          const itemsWithoutPrice = Array.from(selectedItems).filter((itemId) => {
            const price = prices[itemId];
            return price === null || price === undefined || price < 0;
          });
          if (itemsWithoutPrice.length > 0) {
            toast.error("Todos os itens selecionados devem ter preço definido para retiradas cobráveis");
            return false;
          }
        }
        return true;

      case 3:
        // Final validation - validate all data is present
        // Check step 1 validations
        if (!withdrawerName?.trim()) {
          toast.error("Nome do retirador é obrigatório");
          return false;
        }
        if (withdrawerName.trim().length < 2) {
          toast.error("Nome do retirador deve ter pelo menos 2 caracteres");
          return false;
        }
        if (withdrawerName.trim().length > 200) {
          toast.error("Nome do retirador deve ter no máximo 200 caracteres");
          return false;
        }
        if (notes && notes.length > 500) {
          toast.error("Observações devem ter no máximo 500 caracteres");
          return false;
        }

        // Check step 2 validations
        if (selectedItems.size === 0) {
          toast.error("Pelo menos um item deve ser selecionado");
          return false;
        }

        // Validate item quantities
        const itemsWithInvalidQuantityStep3 = Array.from(selectedItems).filter((itemId) => {
          const quantity = quantities[itemId];
          return !quantity || quantity <= 0;
        });
        if (itemsWithInvalidQuantityStep3.length > 0) {
          toast.error("Todos os itens selecionados devem ter quantidade maior que zero");
          return false;
        }

        // Validate prices if CHARGEABLE
        if (withdrawalType === EXTERNAL_WITHDRAWAL_TYPE.CHARGEABLE) {
          const itemsWithoutPrice = Array.from(selectedItems).filter((itemId) => {
            const price = prices[itemId];
            return price === null || price === undefined || price < 0;
          });
          if (itemsWithoutPrice.length > 0) {
            toast.error("Todos os itens selecionados devem ter preço definido para retiradas cobráveis");
            return false;
          }
        }

        return true;

      default:
        return true;
    }
  }, [currentStep, withdrawerName, selectedItems, quantities, prices, withdrawalType, notes]);

  // Handle item selection
  const handleSelectItem = useCallback(
    (itemId: string, quantity?: number, price?: number, icms?: number, ipi?: number) => {
      // External withdrawal uses quantity and price, accept icms/ipi for compatibility
      toggleItemSelection(itemId, quantity, price);
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

  // Handle file changes
  const handleReceiptFilesChange = useCallback((files: FileWithPreview[]) => {
    setReceiptFiles(files);
    form.setValue("receiptId", files.length > 0 ? "pending" : undefined, { shouldDirty: true, shouldTouch: true });
  }, [form]);

  const handleNfeFilesChange = useCallback((files: FileWithPreview[]) => {
    setNfeFiles(files);
    form.setValue("nfeId", files.length > 0 ? "pending" : undefined, { shouldDirty: true, shouldTouch: true });
  }, [form]);

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    try {
      // Validate final form
      if (!validateCurrentStep()) {
        return;
      }

      // Get form values to ensure they're in sync
      const formValues = form.getValues();
      const withdrawalData: ExternalWithdrawalCreateFormData = {
        withdrawerName: formValues.withdrawerName || withdrawerName?.trim() || "",
        type: formValues.type || withdrawalType,
        notes: formValues.notes || notes?.trim() || undefined,
        items: Array.from(selectedItems).map((itemId: string) => ({
          itemId,
          withdrawedQuantity: Number(quantities[itemId]) || 1,
          price: withdrawalType === EXTERNAL_WITHDRAWAL_TYPE.CHARGEABLE ? Number(prices[itemId]) || 0 : undefined,
        })),
      }; // Validate with schema before submitting
      const parseResult = externalWithdrawalCreateSchema.safeParse(withdrawalData);
      if (!parseResult.success) {
        if (process.env.NODE_ENV !== "production") {
          console.error("Schema validation failed:", parseResult.error);
        }
        toast.error("Erro na validação dos dados");
        return;
      }

      // Check if there are new files to upload
      const newReceiptFiles = receiptFiles.filter(f => f instanceof File && !(f as any).uploadedFileId);
      const newNfeFiles = nfeFiles.filter(f => f instanceof File && !(f as any).uploadedFileId);
      const hasNewFiles = newReceiptFiles.length > 0 || newNfeFiles.length > 0;

      let result;
      if (hasNewFiles) {
        const formData = createWithdrawalFormData(
          withdrawalData,
          {
            receipts: newReceiptFiles.length > 0 ? newReceiptFiles as File[] : undefined,
            invoices: newNfeFiles.length > 0 ? newNfeFiles as File[] : undefined,
          },
          undefined // No customer context for external withdrawals
        );
        result = await createAsync(formData as any);
      } else {
        result = await createAsync(withdrawalData);
      }

      if (result.success && result.data) {
        // Clear form and selections
        form.reset();
        clearAllSelections();

        // Navigate to the details page of the newly created external withdrawal
        setTimeout(() => {
          if (result.data?.id) {
            navigate(routes.inventory.externalWithdrawals.details(result.data.id));
          } else {
            // Fallback to list if no ID is returned
            navigate(routes.inventory.externalWithdrawals.root);
          }
        }, 1500);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Submission error:", error);
      }
      // Error is handled by the mutation hook, but let's log it
    }
  }, [validateCurrentStep, withdrawerName, withdrawalType, notes, selectedItems, quantities, prices, createAsync, form, clearAllSelections, navigate, receiptFiles, nfeFiles]);

  const handleCancel = useCallback(() => {
    navigate(routes.inventory.externalWithdrawals.root);
  }, [navigate]);

  const handleNext = useCallback(() => {
    if (validateCurrentStep()) {
      nextStep();
    }
  }, [validateCurrentStep, nextStep]);

  const isLastStep = currentStep === steps.length;
  const isFirstStep = currentStep === 1;

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
        <title>Retirada Externa - ${formatDate(new Date())}</title>
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
          ${
            withdrawalType === EXTERNAL_WITHDRAWAL_TYPE.CHARGEABLE
              ? `
          th:nth-child(6), td:nth-child(6) { width: 90px; text-align: right; } /* Preço Unit. */
          th:nth-child(7), td:nth-child(7) { width: 90px; text-align: right; } /* Total */
          `
              : ""
          }
          
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
            <h1 class="title">Retirada Externa</h1>
            <p class="subtitle">Documento de controle de retirada de materiais</p>
          </div>
        </div>
        
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Retirado por</span>
            <span class="info-value">${withdrawerName}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Data da Retirada</span>
            <span class="info-value">${formatDate(new Date())}</span>
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
                ${
                  withdrawalType === EXTERNAL_WITHDRAWAL_TYPE.CHARGEABLE
                    ? `
                <th class="text-right">Preço Unit.</th>
                <th class="text-right">Total</th>
                `
                    : ""
                }
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
                    // Use backward compatibility fields first if available
                    if (item.measureValue && item.measureUnit) {
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
                      const unitLabel = unitLabels[item.measureUnit as keyof typeof unitLabels] || item.measureUnit;
                      return `${item.measureValue} ${unitLabel}`;
                    }

                    if (!item.measures || item.measures.length === 0) return "-";

                    const volumeUnits = ["MILLILITER", "LITER", "CUBIC_METER", "CUBIC_CENTIMETER"];
                    const weightUnits = ["KILOGRAM", "GRAM"];

                    const hasVolume = item.measures.some((m) => m.unit && volumeUnits.includes(m.unit));
                    const hasWeight = item.measures.some((m) => m.unit && weightUnits.includes(m.unit));

                    if (hasVolume && hasWeight) {
                      // If both exist, show only volume
                      const volumeMeasure = item.measures.find((m) => m.unit && volumeUnits.includes(m.unit));
                      if (volumeMeasure && volumeMeasure.unit) {
                        const unitLabels = {
                          MILLILITER: "ml",
                          LITER: "l",
                          CUBIC_METER: "m³",
                          CUBIC_CENTIMETER: "cm³",
                        };
                        const unitLabel = unitLabels[volumeMeasure.unit as keyof typeof unitLabels] || volumeMeasure.unit;
                        return `${volumeMeasure.value} ${unitLabel}`;
                      }
                      return "-";
                    }

                    // Otherwise show the first measure
                    const firstMeasure = item.measures[0];
                    if (firstMeasure && firstMeasure.unit) {
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
                      return `${firstMeasure.value} ${unitLabel}`;
                    }
                    return "-";
                  };

                  return `
                  <tr>
                    <td class="font-mono">${item.uniCode || "-"}</td>
                    <td class="font-medium">${item.name}</td>
                    <td>${item.brand?.name || "-"}</td>
                    <td>${getMeasureDisplay()}</td>
                    <td class="text-right font-medium">${quantity.toLocaleString("pt-BR")}</td>
                    ${
                      withdrawalType === EXTERNAL_WITHDRAWAL_TYPE.CHARGEABLE
                        ? `
                    <td class="text-right">${formatCurrency(price)}</td>
                    <td class="text-right font-semibold">${formatCurrency(total)}</td>
                    `
                        : ""
                    }
                  </tr>
                `;
                })
                .join("")}
              ${
                withdrawalType === EXTERNAL_WITHDRAWAL_TYPE.CHARGEABLE
                  ? `
              <tr class="total-row">
                <td colspan="6" class="text-right">Total Geral:</td>
                <td class="text-right font-semibold">${formatCurrency(totalPrice)}</td>
              </tr>
              `
                  : ""
              }
            </tbody>
          </table>
          
          ${
            notes
              ? `
          <div class="notes-section">
            <div class="notes-title">Observações:</div>
            <div>${notes}</div>
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
    [withdrawerName, withdrawalType, notes, selectionCount, selectedItemsData, quantities, prices, totalPrice],
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
      disabled: isSubmitting || selectionCount === 0,
      loading: isSubmitting,
    });
  }

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4 pb-4">
      <PageHeader
        className="flex-shrink-0"
        title="Cadastrar Retirada Externa"
        icon={IconPackageExport}
        breadcrumbs={[
          { label: "Início", href: "/" },
          { label: "Estoque", href: "/estoque" },
          { label: "Retiradas Externas", href: routes.inventory.externalWithdrawals?.root || "/inventory/external-withdrawals" },
          { label: "Cadastrar" },
        ]}
        actions={navigationActions}
      />

      <Card className="flex-1 min-h-0 flex flex-col shadow-sm border border-border">
        <CardContent className="flex-1 flex flex-col p-4 overflow-hidden min-h-0">
          <Form {...form}>
            <form className="flex flex-col h-full" onSubmit={(e) => e.preventDefault()}>
              {/* Step Indicator */}
              <div className="flex-shrink-0 mb-6">
                <FormSteps steps={steps} currentStep={currentStep} />
              </div>

              {/* Step Content */}
              <div className={cn("flex-1 min-h-0", currentStep === 2 ? "flex flex-col overflow-hidden" : "overflow-y-auto")}>
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <IconUser className="h-5 w-5" />
                          Informações da Retirada
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {/* Withdrawer Name and Type in same row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Withdrawer Name */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">
                              Nome do Retirador <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              placeholder="Digite o nome da pessoa que está retirando"
                              value={form.watch("withdrawerName") || ""}
                              onChange={(value) => {
                                // The custom Input component passes the cleaned value directly
                                const stringValue = value !== null && value !== undefined ? String(value) : "";
                                form.setValue("withdrawerName", stringValue, {
                                  shouldValidate: true,
                                  shouldDirty: true,
                                  shouldTouch: true,
                                });
                                // Update URL state when form changes
                                updateWithdrawerName(stringValue);
                              }}
                              className="h-10 bg-transparent"
                              maxLength={200}
                            />
                            {form.formState.errors.withdrawerName && <p className="text-sm text-destructive">{form.formState.errors.withdrawerName.message}</p>}
                            {!form.formState.errors.withdrawerName && withdrawerName && withdrawerName.trim().length < 2 && (
                              <p className="text-sm text-destructive">Nome deve ter pelo menos 2 caracteres</p>
                            )}
                          </div>

                          {/* Withdrawal Type */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">
                              Tipo de Retirada <span className="text-destructive">*</span>
                            </Label>
                            <Combobox
                              value={withdrawalType}
                              onValueChange={(value: string | string[] | null | undefined) => {
                                const typeValue = value as EXTERNAL_WITHDRAWAL_TYPE;
                                form.setValue("type", typeValue, {
                                  shouldValidate: true,
                                  shouldDirty: true,
                                  shouldTouch: true,
                                });
                                updateType(typeValue);
                              }}
                              options={[
                                {
                                  value: EXTERNAL_WITHDRAWAL_TYPE.RETURNABLE,
                                  label: EXTERNAL_WITHDRAWAL_TYPE_LABELS[EXTERNAL_WITHDRAWAL_TYPE.RETURNABLE],
                                },
                                {
                                  value: EXTERNAL_WITHDRAWAL_TYPE.CHARGEABLE,
                                  label: EXTERNAL_WITHDRAWAL_TYPE_LABELS[EXTERNAL_WITHDRAWAL_TYPE.CHARGEABLE],
                                },
                                {
                                  value: EXTERNAL_WITHDRAWAL_TYPE.COMPLIMENTARY,
                                  label: EXTERNAL_WITHDRAWAL_TYPE_LABELS[EXTERNAL_WITHDRAWAL_TYPE.COMPLIMENTARY],
                                },
                              ]}
                              placeholder="Selecione o tipo"
                              className="h-10"
                              searchable={false}
                              clearable={false}
                            />
                            <p className="text-xs text-muted-foreground">
                              {withdrawalType === EXTERNAL_WITHDRAWAL_TYPE.RETURNABLE && "Itens serão devolvidos (sem cobrança)"}
                              {withdrawalType === EXTERNAL_WITHDRAWAL_TYPE.CHARGEABLE && "Itens não serão devolvidos (com cobrança)"}
                              {withdrawalType === EXTERNAL_WITHDRAWAL_TYPE.COMPLIMENTARY && "Itens cortesia (sem devolução e sem cobrança)"}
                            </p>
                          </div>
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Observações</Label>
                          <Textarea
                            placeholder="Observações sobre a retirada (opcional)"
                            value={notes}
                            onChange={(value) => updateNotes(typeof value === "string" ? value : "")}
                            className="min-h-20 max-h-32"
                            rows={3}
                            maxLength={500}
                          />
                          {notes && notes.length > 500 && <p className="text-sm text-destructive">Observações devem ter no máximo 500 caracteres</p>}
                          {notes && <p className="text-xs text-muted-foreground">{notes.length}/500 caracteres</p>}
                        </div>

                        {/* File uploads */}
                        <div className="space-y-4">
                          <Separator />
                          <Label className="text-sm font-medium">Documentos (Opcional)</Label>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      </CardContent>
                    </Card>
                  </div>
                )}

                {currentStep === 2 && (
                  <ItemSelectorTable
                    selectedItems={selectedItems}
                    onSelectItem={handleSelectItem}
                    onSelectAll={() => {}}
                    quantities={quantities}
                    prices={prices}
                    onQuantityChange={handleQuantityChange}
                    onPriceChange={handlePriceChange}
                    editableColumns={{
                      showQuantityInput: true,
                      showPriceInput: withdrawalType === EXTERNAL_WITHDRAWAL_TYPE.CHARGEABLE,
                    }}
                    fixedColumnsConfig={{
                      fixedColumns: ['name'],
                      fixedReasons: {
                        name: 'Essencial para identificar o item sendo retirado',
                      },
                    }}
                    defaultColumns={['uniCode', 'name', 'brand.name', 'measures', 'quantity']}
                    storageKey="external-withdrawal-item-selector"
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
                    className="h-full flex-1"
                  />
                )}

                {currentStep === 3 && (
                  <div className="space-y-6">
                    {/* Information Summary */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <IconCheck className="h-5 w-5" />
                            Informações da Retirada
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
                            <span className="text-sm font-medium text-muted-foreground">Retirador:</span>
                            <p className="mt-1 font-medium">{withdrawerName}</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-muted-foreground">Tipo de Retirada:</span>
                            <p className="mt-1 font-medium">{EXTERNAL_WITHDRAWAL_TYPE_LABELS[withdrawalType]}</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-muted-foreground">Quantidade de Itens:</span>
                            <p className="mt-1 font-medium">
                              {selectionCount} {selectionCount === 1 ? "item" : "itens"}
                            </p>
                          </div>
                          {withdrawalType === EXTERNAL_WITHDRAWAL_TYPE.CHARGEABLE && (
                            <div>
                              <span className="text-sm font-medium text-muted-foreground">Valor Total:</span>
                              <p className="mt-1 font-medium">{formatCurrency(totalPrice)}</p>
                            </div>
                          )}
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
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <IconPackage className="h-5 w-5" />
                          Itens Selecionados
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="rounded-md border overflow-hidden dark:border-border/40">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead className="font-semibold">Código</TableHead>
                                <TableHead className="font-semibold">Nome</TableHead>
                                <TableHead className="font-semibold">Marca</TableHead>
                                <TableHead className="font-semibold">Medida</TableHead>
                                <TableHead className="text-right font-semibold">Quantidade</TableHead>
                                {withdrawalType === EXTERNAL_WITHDRAWAL_TYPE.CHARGEABLE && (
                                  <>
                                    <TableHead className="text-right font-semibold">Preço Unit.</TableHead>
                                    <TableHead className="text-right font-semibold">Total</TableHead>
                                  </>
                                )}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedItemsData.map((item, index) => {
                                const quantity = Number(quantities[item.id]) || 1;
                                const price = Number(prices[item.id]) || 0;
                                const total = quantity * price;

                                // Get measure display - prioritize volume if both weight and volume exist
                                const getMeasureDisplay = () => {
                                  // Use backward compatibility fields first if available
                                  if (item.measureValue && item.measureUnit) {
                                    const unitLabel = MEASURE_UNIT_LABELS[item.measureUnit as keyof typeof MEASURE_UNIT_LABELS] || item.measureUnit;
                                    return `${item.measureValue} ${unitLabel}`;
                                  }

                                  if (!item.measures || item.measures.length === 0) return "-";

                                  const volumeUnits = [MEASURE_UNIT.MILLILITER, MEASURE_UNIT.LITER, MEASURE_UNIT.CUBIC_METER, MEASURE_UNIT.CUBIC_CENTIMETER];
                                  const weightUnits = [MEASURE_UNIT.KILOGRAM, MEASURE_UNIT.GRAM];

                                  const hasVolume = item.measures.some((m) => m.unit && volumeUnits.includes(m.unit));
                                  const hasWeight = item.measures.some((m) => m.unit && weightUnits.includes(m.unit));

                                  if (hasVolume && hasWeight) {
                                    // If both exist, show only volume
                                    const volumeMeasure = item.measures.find((m) => m.unit && volumeUnits.includes(m.unit));
                                    if (volumeMeasure && volumeMeasure.unit) {
                                      const unitLabel = MEASURE_UNIT_LABELS[volumeMeasure.unit as keyof typeof MEASURE_UNIT_LABELS] || volumeMeasure.unit;
                                      return `${volumeMeasure.value} ${unitLabel}`;
                                    }
                                    return "-";
                                  }

                                  // Otherwise show the first measure
                                  const firstMeasure = item.measures[0];
                                  if (firstMeasure && firstMeasure.unit) {
                                    const unitLabel = MEASURE_UNIT_LABELS[firstMeasure.unit as keyof typeof MEASURE_UNIT_LABELS] || firstMeasure.unit;
                                    return `${firstMeasure.value} ${unitLabel}`;
                                  }
                                  return "-";
                                };

                                return (
                                  <TableRow key={item.id} className={cn("transition-colors", index % 2 === 1 && "bg-muted/10")}>
                                    <TableCell className="font-mono">{item.uniCode || "-"}</TableCell>
                                    <TableCell className="font-medium">{item.name}</TableCell>
                                    <TableCell>{item.brand?.name || "-"}</TableCell>
                                    <TableCell>{getMeasureDisplay()}</TableCell>
                                    <TableCell className="text-right font-medium">{quantity.toLocaleString("pt-BR")}</TableCell>
                                    {withdrawalType === EXTERNAL_WITHDRAWAL_TYPE.CHARGEABLE && (
                                      <>
                                        <TableCell className="text-right">{formatCurrency(price)}</TableCell>
                                        <TableCell className="text-right font-semibold">{formatCurrency(total)}</TableCell>
                                      </>
                                    )}
                                  </TableRow>
                                );
                              })}
                              {withdrawalType === EXTERNAL_WITHDRAWAL_TYPE.CHARGEABLE && (
                                <TableRow className="bg-muted/30 font-semibold">
                                  <TableCell colSpan={6} className="text-right">
                                    Total Geral:
                                  </TableCell>
                                  <TableCell className="text-right">{formatCurrency(totalPrice)}</TableCell>
                                </TableRow>
                              )}
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
