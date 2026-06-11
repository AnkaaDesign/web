import { useState, useCallback, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useSearchParams } from "react-router-dom";
import { IconLoader2, IconArrowLeft, IconArrowRight, IconCheck, IconUser, IconPackage, IconPackageExport, IconDownload, IconFileInvoice, IconReceipt, IconTool } from "@tabler/icons-react";
import type { ExternalOperationCreateFormData } from "../../../../schemas";
import type { ExternalOperation, ExternalOperationItem, Item } from "../../../../types";
import { externalOperationCreateSchema } from "../../../../schemas";
import { useExternalOperationMutations, useItems, useCanViewPrices, useCustomers } from "../../../../hooks";
import { routes, EXTERNAL_OPERATION_TYPE, EXTERNAL_OPERATION_TYPE_LABELS } from "../../../../constants";
import { toast } from "@/components/ui/sonner";
import { FileUploadField, type FileWithPreview } from "@/components/common/file";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { PageHeader } from "@/components/ui/page-header";
import { FormSteps } from "@/components/ui/form-steps";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ExternalOperationItemSelector } from "./external-operation-item-selector";
import { ExternalOperationBillingSection, type BillingServiceRow } from "./external-operation-billing-section";
import { legacyToConfig } from "@/components/financial/payment-config-field";
import type { PaymentConfig } from "@/schemas/task-quote";
import { EXTERNAL_OPERATION_STATUS } from "../../../../constants";
import { useExternalOperationFormUrlState } from "@/hooks/inventory/use-external-operation-form-url-state";
import { formatCurrency, formatDate, formatDateTime } from "../../../../utils";
import { MEASURE_UNIT_LABELS } from "../../../../constants";
import { createWithdrawalFormData } from "@/utils/form-data-helper";

interface ExternalOperationEditFormProps {
  withdrawal: ExternalOperation & {
    items: ExternalOperationItem[];
  };
}

// UI-only operation mode (not persisted): item withdrawal vs. ad-hoc service billing
type OperationMode = "WITHDRAWAL" | "SERVICE";

const buildSteps = (mode: OperationMode) => [
  {
    id: 1,
    name: "Informações Básicas",
    description: "Responsável e detalhes da operação",
  },
  {
    id: 2,
    name: mode === "SERVICE" ? "Seleção de Itens (opcional)" : "Seleção de Itens",
    description: mode === "SERVICE" ? "Materiais do estoque utilizados no serviço" : "Escolha os itens e quantidades",
  },
  {
    id: 3,
    name: "Revisão",
    description: "Confirme os dados da operação",
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

export const ExternalOperationEditForm = ({ withdrawal }: ExternalOperationEditFormProps) => {
  const navigate = useNavigate();
  const canViewPrices = useCanViewPrices();
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize state from URL parameters
  const [currentStep, setCurrentStep] = useState(getStepFromUrl(searchParams));

  // Initialize file state with existing files from withdrawal
  const initialReceiptFiles = useMemo(() => {
    const files = (withdrawal.receipts || []).map(file => ({
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
  }, [withdrawal.receipts]);

  const initialInvoiceFiles = useMemo(() => {
    const files = (withdrawal.invoices || []).map(file => ({
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
  }, [withdrawal.invoices]);

  // File upload state
  const [receiptFiles, setReceiptFiles] = useState<FileWithPreview[]>(initialReceiptFiles);
  const [invoiceFiles, setInvoiceFiles] = useState<FileWithPreview[]>(initialInvoiceFiles);
  const [hasFileChanges, setHasFileChanges] = useState(false);

  // Items/services/customer/billing are locked after PENDING (mirror of the API rule)
  const isPending = withdrawal.status === EXTERNAL_OPERATION_STATUS.PENDING;

  // Operation mode (UI-only, not persisted) derived from the saved data:
  // CHARGEABLE with no items and at least one service => "Serviço"; everything else => "Retirada de Itens"
  const initialOperationMode = useMemo<OperationMode>(
    () =>
      withdrawal.type === EXTERNAL_OPERATION_TYPE.CHARGEABLE && (withdrawal.items?.length ?? 0) === 0 && (withdrawal.services?.length ?? 0) >= 1
        ? "SERVICE"
        : "WITHDRAWAL",
    [withdrawal.type, withdrawal.items, withdrawal.services],
  );
  const [operationMode, setOperationMode] = useState<OperationMode>(initialOperationMode);

  // Step labels depend on the operation mode
  const steps = useMemo(() => buildSteps(operationMode), [operationMode]);

  // Billing state (CHARGEABLE only), initialized from the withdrawal
  const initialServices = useMemo<BillingServiceRow[]>(
    () =>
      [...(withdrawal.services || [])]
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((service) => ({ id: service.id, description: service.description, amount: Number(service.amount) || 0 })),
    [withdrawal.services],
  );
  const [customerId, setCustomerId] = useState<string | null>(withdrawal.customerId ?? null);
  const [generateInvoice, setGenerateInvoice] = useState(withdrawal.generateInvoice ?? true);
  const [generateBankSlip, setGenerateBankSlip] = useState(withdrawal.generateBankSlip ?? true);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(
    (withdrawal.paymentConfig as PaymentConfig | null) ?? legacyToConfig(withdrawal.paymentCondition),
  );
  const [services, setServices] = useState<BillingServiceRow[]>(initialServices);

  // Valid services (description filled + amount > 0)
  const validServices = useMemo(() => services.filter((s) => s.description.trim().length > 0 && (Number(s.amount) || 0) > 0), [services]);

  // Sync file state when withdrawal files change
  useEffect(() => {
    setReceiptFiles(initialReceiptFiles);
    setInvoiceFiles(initialInvoiceFiles);
  }, [initialReceiptFiles, initialInvoiceFiles]);

  // Convert existing withdrawal data to initial state
  const initialSelectedItems = useMemo(() => new Set(withdrawal.items.map((item: ExternalOperationItem) => item.itemId)), [withdrawal.items]);

  const initialQuantities = useMemo(
    () =>
      withdrawal.items.reduce(
        (acc, item) => {
          acc[item.itemId] = item.withdrawedQuantity;
          return acc;
        },
        {} as Record<string, number>,
      ),
    [withdrawal.items],
  );

  const initialPrices = useMemo(
    () =>
      withdrawal.items.reduce(
        (acc, item) => {
          if (item.price !== null && item.price !== undefined) {
            acc[item.itemId] = item.price;
          }
          return acc;
        },
        {} as Record<string, number>,
      ),
    [withdrawal.items],
  );

  // URL state management for item selection (Stage 2) - initialized with existing data
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
  } = useExternalOperationFormUrlState({
    defaultQuantity: 1,
    defaultPrice: 0,
    preserveQuantitiesOnDeselect: false,
    defaultPageSize: 40,
    // Initialize with existing data
    initialData: {
      withdrawerName: withdrawal.withdrawerName,
      type: withdrawal.type,
      notes: withdrawal.notes || "",
      selectedItems: initialSelectedItems,
      quantities: initialQuantities,
      prices: initialPrices,
    },
  });

  // Mode change: "Serviço" implies CHARGEABLE; back to "Retirada de Itens" restores the saved type (or the RETURNABLE default)
  const handleModeChange = useCallback(
    (mode: OperationMode) => {
      if (mode === operationMode) return;
      setOperationMode(mode);
      if (mode === "SERVICE") {
        updateType(EXTERNAL_OPERATION_TYPE.CHARGEABLE);
      } else {
        updateType(initialOperationMode === "WITHDRAWAL" ? withdrawal.type : EXTERNAL_OPERATION_TYPE.RETURNABLE);
      }
    },
    [operationMode, updateType, initialOperationMode, withdrawal.type],
  );

  // Form setup with default values from URL state
  const defaultValues: Partial<ExternalOperationCreateFormData> = {
    withdrawerName: withdrawerName || withdrawal.withdrawerName,
    type: withdrawalType,
    notes: notes || withdrawal.notes || "",
    items: [],
  };

  const form = useForm<ExternalOperationCreateFormData>({
    resolver: zodResolver(externalOperationCreateSchema),
    mode: "onChange",
    defaultValues,
  });

  // Mutations - use update instead of create
  const { updateAsync, isLoading: isSubmitting } = useExternalOperationMutations();

  // Fetch selected items data for display
  const { data: selectedItemsResponse } = useItems({
    where: selectedItems.size > 0 ? { id: { in: Array.from(selectedItems) } } : undefined,
    include: {
      brands: true,
      category: true,
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

  const isChargeable = withdrawalType === EXTERNAL_OPERATION_TYPE.CHARGEABLE;
  const servicesTotal = isChargeable ? validServices.reduce((sum, s) => sum + (Number(s.amount) || 0), 0) : 0;

  // Fetch the selected billing customer (for the "Responsável" prefill)
  const { data: selectedCustomerResponse } = useCustomers({
    where: customerId ? { id: customerId } : undefined,
    limit: 1,
    enabled: !!customerId,
  });
  const selectedCustomer = customerId ? selectedCustomerResponse?.data?.[0] : undefined;

  // Prefill "Responsável" with the customer's fantasy name when the field is still empty (never overwrite user input)
  useEffect(() => {
    if (selectedCustomer?.fantasyName && !withdrawerName?.trim()) {
      updateWithdrawerName(selectedCustomer.fantasyName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomer?.id]);

  // Calculate total price (only for CHARGEABLE type) — items + services
  const totalPrice = withdrawalType === EXTERNAL_OPERATION_TYPE.CHARGEABLE
    ? Array.from(selectedItems).reduce((total, itemId) => {
        const quantity = Number(quantities[itemId]) || 1;
        const price = Number(prices[itemId]) || 0;
        return total + quantity * price;
      }, 0) + servicesTotal
    : 0;

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
      case 1: {
        // Validate basic information using URL state
        const trimmedName = withdrawerName?.trim() || "";
        if (trimmedName.length > 0 && trimmedName.length < 2) {
          toast.error("Nome de quem retirou deve ter pelo menos 2 caracteres");
          return false;
        }
        if (trimmedName.length > 200) {
          toast.error("Nome de quem retirou deve ter no máximo 200 caracteres");
          return false;
        }
        // Billing/withdrawer fields are only editable while PENDING
        if (isPending && withdrawalType === EXTERNAL_OPERATION_TYPE.CHARGEABLE && !customerId) {
          toast.error("Cliente é obrigatório para operações cobráveis");
          return false;
        }
        if (isPending && !(withdrawalType === EXTERNAL_OPERATION_TYPE.CHARGEABLE && customerId) && !trimmedName) {
          toast.error("Informe um cliente ou quem retirou.");
          return false;
        }
        if (notes && notes.length > 500) {
          toast.error("Observações devem ter no máximo 500 caracteres");
          return false;
        }
        // Validate partially filled service rows (CHARGEABLE only)
        if (withdrawalType === EXTERNAL_OPERATION_TYPE.CHARGEABLE) {
          const hasIncompleteService = services.some((s) => (s.description.trim().length > 0) !== ((Number(s.amount) || 0) > 0));
          if (hasIncompleteService) {
            toast.error("Preencha descrição e valor de todos os serviços ou remova as linhas incompletas");
            return false;
          }
        }
        // Service mode requires at least one complete service
        if (operationMode === "SERVICE" && validServices.length === 0) {
          toast.error("Adicione pelo menos um serviço");
          return false;
        }
        return true;
      }

      case 2:
        // Validate item selection (in service mode items are optional)
        if (operationMode === "SERVICE") {
          if (validServices.length === 0) {
            toast.error("Adicione pelo menos um serviço");
            return false;
          }
        } else if (selectionCount === 0) {
          toast.error("Selecione pelo menos um item");
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

        // Validate prices if not returning (items are locked — and not submitted — after PENDING)
        if (isPending && withdrawalType === EXTERNAL_OPERATION_TYPE.CHARGEABLE) {
          const missingPrices = Array.from(selectedItems).filter((itemId) => {
            const price = prices[itemId];
            return price === undefined || price === null || price <= 0;
          });

          if (missingPrices.length > 0) {
            toast.error("Operações cobráveis exigem preço unitário maior que zero.");
            return false;
          }
        }

        return true;

      case 3: {
        // Final validation before submission
        const finalName = withdrawerName?.trim() || "";
        if (finalName.length > 0 && finalName.length < 2) {
          toast.error("Nome de quem retirou deve ter pelo menos 2 caracteres");
          return false;
        }
        if (isPending && withdrawalType === EXTERNAL_OPERATION_TYPE.CHARGEABLE && !customerId) {
          toast.error("Cliente é obrigatório para operações cobráveis");
          return false;
        }
        if (isPending && !(withdrawalType === EXTERNAL_OPERATION_TYPE.CHARGEABLE && customerId) && !finalName) {
          toast.error("Informe um cliente ou quem retirou.");
          return false;
        }
        if (isPending && withdrawalType === EXTERNAL_OPERATION_TYPE.CHARGEABLE) {
          const missingPrices = Array.from(selectedItems).filter((itemId) => {
            const price = prices[itemId];
            return price === undefined || price === null || price <= 0;
          });
          if (missingPrices.length > 0) {
            toast.error("Operações cobráveis exigem preço unitário maior que zero.");
            return false;
          }
        }
        return true;
      }

      default:
        return false;
    }
  }, [currentStep, withdrawerName, selectionCount, selectedItems, quantities, withdrawalType, prices, notes, services, validServices, operationMode, customerId, isPending]);

  // Handle file changes (files are uploaded via multipart on submit; not tracked in the zod schema)
  const handleReceiptFilesChange = useCallback((files: FileWithPreview[]) => {
    setReceiptFiles(files);
    setHasFileChanges(true);
  }, []);

  const handleInvoiceFilesChange = useCallback((files: FileWithPreview[]) => {
    setInvoiceFiles(files);
    setHasFileChanges(true);
  }, []);

  // Handle navigation with validation
  const handleNext = useCallback(() => {
    if (validateCurrentStep()) {
      nextStep();
    }
  }, [validateCurrentStep, nextStep]);

  const handleCancel = useCallback(() => {
    navigate(routes.inventory.externalOperations?.list || "/inventory/external-operations");
  }, [navigate]);

  // Detect which fields actually changed from the original withdrawal
  const formChanges = useMemo(() => {
    const withdrawerNameChanged = (withdrawerName?.trim() || "") !== (withdrawal.withdrawerName?.trim() || "");
    const typeChanged = withdrawalType !== withdrawal.type;
    const notesChanged = (notes?.trim() || "") !== (withdrawal.notes?.trim() || "");

    // Check if selected items have changed
    const originalItemIds = new Set(withdrawal.items.map((item) => item.itemId));
    const itemsChanged = selectedItems.size !== originalItemIds.size || Array.from(selectedItems).some((id) => !originalItemIds.has(id));

    // Check if quantities have changed for existing items
    const quantitiesChanged = withdrawal.items.some((item) => {
      const currentQty = quantities[item.itemId];
      return currentQty !== undefined && currentQty !== item.withdrawedQuantity;
    });

    // Check if prices have changed for existing items
    const pricesChanged = withdrawal.items.some((item) => {
      const currentPrice = prices[item.itemId];
      return currentPrice !== undefined && currentPrice !== item.price;
    });

    // Billing / services changes (CHARGEABLE)
    const customerChanged = (customerId ?? null) !== (withdrawal.customerId ?? null);
    const generateInvoiceChanged = generateInvoice !== (withdrawal.generateInvoice ?? true);
    const generateBankSlipChanged = generateBankSlip !== (withdrawal.generateBankSlip ?? true);
    const initialPaymentConfig = (withdrawal.paymentConfig as PaymentConfig | null) ?? legacyToConfig(withdrawal.paymentCondition);
    const paymentConfigChanged = JSON.stringify(paymentConfig ?? null) !== JSON.stringify(initialPaymentConfig ?? null);
    const servicesChanged =
      JSON.stringify(validServices.map((s) => ({ description: s.description.trim(), amount: Number(s.amount) || 0 }))) !==
      JSON.stringify(initialServices.map((s) => ({ description: s.description.trim(), amount: Number(s.amount) || 0 })));

    return {
      withdrawerNameChanged,
      typeChanged,
      notesChanged,
      itemsChanged,
      quantitiesChanged,
      pricesChanged,
      customerChanged,
      generateInvoiceChanged,
      generateBankSlipChanged,
      paymentConfigChanged,
      servicesChanged,
    };
  }, [withdrawerName, withdrawalType, notes, selectedItems, quantities, prices, withdrawal, customerId, generateInvoice, generateBankSlip, paymentConfig, validServices, initialServices]);

  // Submit handler — only send fields the user actually changed (unset/unchanged keys must be
  // omitted: null values become "" in multipart form-data and get rejected by the API)
  const handleSubmit = useCallback(async () => {
    if (!validateCurrentStep()) return;

    try {
      // Check if there are new files to upload
      const newReceiptFiles = receiptFiles.filter(f => f instanceof File && !(f as any).uploadedFileId);
      const newInvoiceFiles = invoiceFiles.filter(f => f instanceof File && !(f as any).uploadedFileId);
      const hasNewFiles = newReceiptFiles.length > 0 || newInvoiceFiles.length > 0;

      const chargeable = withdrawalType === EXTERNAL_OPERATION_TYPE.CHARGEABLE;
      const updateData: Record<string, any> = {};

      if (formChanges.notesChanged) {
        updateData.notes = notes?.trim() || null;
      }

      // Items/services/customer/billing config and withdrawer/type can only change while PENDING
      if (isPending) {
        if (formChanges.withdrawerNameChanged) {
          updateData.withdrawerName = withdrawerName?.trim() || null;
        }
        if (formChanges.typeChanged) {
          updateData.type = withdrawalType;
        }
        if (formChanges.itemsChanged || formChanges.quantitiesChanged || formChanges.pricesChanged || formChanges.typeChanged) {
          updateData.items = Array.from(selectedItems).map((itemId: string) => ({
            itemId,
            withdrawedQuantity: Number(quantities[itemId]) || 1,
            price: chargeable ? Number(prices[itemId]) || 0 : null,
          }));
        }
        if (chargeable) {
          if (formChanges.customerChanged) {
            updateData.customerId = customerId;
          }
          if (formChanges.generateInvoiceChanged) {
            updateData.generateInvoice = generateInvoice;
          }
          if (formChanges.generateBankSlipChanged) {
            updateData.generateBankSlip = generateBankSlip;
          }
          if (formChanges.paymentConfigChanged) {
            updateData.paymentConfig = paymentConfig;
          }
          if (formChanges.servicesChanged) {
            updateData.services = validServices.map((service, index) => ({
              ...(service.id ? { id: service.id } : {}),
              description: service.description.trim(),
              amount: Number(service.amount) || 0,
              position: index,
            }));
          }
        } else if (formChanges.typeChanged) {
          // Switched away from CHARGEABLE: clear billing data
          updateData.customerId = null;
          updateData.paymentConfig = null;
          updateData.services = [];
        }
      }

      if (hasNewFiles) {
        const formData = createWithdrawalFormData(
          updateData,
          {
            receipts: newReceiptFiles.length > 0 ? newReceiptFiles as File[] : undefined,
            invoices: newInvoiceFiles.length > 0 ? newInvoiceFiles as File[] : undefined,
          },
          undefined // No customer context for external withdrawals
        );

        await updateAsync({
          id: withdrawal.id,
          data: formData as any,
        });
      } else {
        await updateAsync({
          id: withdrawal.id,
          data: updateData,
        });
      }

      // Success notification is handled by API client
      navigate(routes.inventory.externalOperations?.list || "/inventory/external-operations");
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error updating external withdrawal:", error);
      }
      // Error is handled by the mutation hook
    }
  }, [validateCurrentStep, selectedItems, quantities, prices, withdrawerName, withdrawalType, notes, updateAsync, withdrawal.id, navigate, receiptFiles, invoiceFiles, isPending, customerId, generateInvoice, generateBankSlip, paymentConfig, validServices, formChanges]);

  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === steps.length;

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
        <title>Operação Externa - ${formatDate(new Date())}</title>
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
            <h1>Operação Externa #${withdrawal.id.slice(-8)}</h1>
            <p>Gerado em ${formatDateTime(new Date())}</p>
          </div>
        </div>
        
        <div class="info-section">
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Retirado por</span>
              <span class="info-value">${withdrawerName?.trim() || "-"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Tipo de Operação</span>
              <span class="info-value">${EXTERNAL_OPERATION_TYPE_LABELS[withdrawalType]}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Quantidade de Itens</span>
              <span class="info-value">${selectionCount} ${selectionCount === 1 ? "item" : "itens"}</span>
            </div>
            ${
              canViewPrices && withdrawalType === EXTERNAL_OPERATION_TYPE.CHARGEABLE
                ? `
              <div class="info-item">
                <span class="info-label">Valor Total</span>
                <span class="info-value">${formatCurrency(totalPrice)}</span>
              </div>
            `
                : ""
            }
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
                ${canViewPrices && withdrawalType === EXTERNAL_OPERATION_TYPE.CHARGEABLE ? '<th class="text-right">Preço Unit.</th><th class="text-right">Total</th>' : ""}
              </tr>
            </thead>
            <tbody>
              ${selectedItemsData
                .map((item: Item) => {
                  const quantity = Number(quantities[item.id]) || 1;
                  const price = Number(prices[item.id]) || 0;
                  const itemTotal = quantity * price;
                  return `
                  <tr>
                    <td class="text-mono">${item.uniCode || "-"}</td>
                    <td>${item.name}</td>
                    <td>${item.category?.name || "-"}</td>
                    <td>${item.brands?.map((b) => b.name).join(", ") || "-"}</td>
                    <td class="text-right">${quantity}${item.measureUnit && MEASURE_UNIT_LABELS[item.measureUnit as keyof typeof MEASURE_UNIT_LABELS] ? ` ${MEASURE_UNIT_LABELS[item.measureUnit as keyof typeof MEASURE_UNIT_LABELS]}` : ""}</td>
                    ${canViewPrices && withdrawalType === EXTERNAL_OPERATION_TYPE.CHARGEABLE ? `<td class="text-right">${formatCurrency(price)}</td><td class="text-right font-medium">${formatCurrency(itemTotal)}</td>` : ""}
                  </tr>
                `;
                })
                .join("")}
            </tbody>
            ${
              canViewPrices && withdrawalType === EXTERNAL_OPERATION_TYPE.CHARGEABLE
                ? `
              <tfoot>
                <tr class="total-row">
                  <td colspan="5" class="text-right">Total Geral</td>
                  <td></td>
                  <td class="text-right">${formatCurrency(totalPrice)}</td>
                </tr>
              </tfoot>
            `
                : ""
            }
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
    [withdrawerName, withdrawalType, notes, selectionCount, selectedItemsData, quantities, prices, totalPrice, withdrawal.id],
  );

  // Detect if form has actual changes from original withdrawal.
  // After PENDING, items/billing/withdrawer/type are locked (and never submitted), so their
  // diffs are excluded from change detection — only notes and file changes count.
  const hasFormChanges = useMemo(() => {
    const lockedFieldChanges = isPending
      ? formChanges.withdrawerNameChanged ||
        formChanges.typeChanged ||
        formChanges.itemsChanged ||
        formChanges.quantitiesChanged ||
        formChanges.pricesChanged ||
        formChanges.customerChanged ||
        formChanges.generateInvoiceChanged ||
        formChanges.generateBankSlipChanged ||
        formChanges.paymentConfigChanged ||
        formChanges.servicesChanged
      : false;

    return lockedFieldChanges || formChanges.notesChanged || hasFileChanges;
  }, [formChanges, isPending, hasFileChanges]);

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
    const submitDisabled = isSubmitting || !hasFormChanges || (operationMode === "SERVICE" ? validServices.length === 0 : selectionCount === 0);
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
        title="Editar Operação Externa"
        icon={IconPackageExport}
        breadcrumbs={[
          { label: "Início", href: "/" },
          { label: "Estoque", href: "/estoque" },
          { label: "Operações Externas", href: routes.inventory.externalOperations?.list || "/inventory/external-operations" },
          { label: "Editar" },
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
                          Informações da Operação
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {/* Operation Mode and Withdrawal Subtype in same row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Operation Mode (UI-only, locked after PENDING) */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">
                              Tipo de Operação <span className="text-destructive">*</span>
                            </Label>
                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                type="button"
                                variant={operationMode === "WITHDRAWAL" ? "default" : "outline"}
                                onClick={() => handleModeChange("WITHDRAWAL")}
                                disabled={!isPending}
                                className="h-10 justify-center gap-2"
                              >
                                <IconPackage className="h-4 w-4" />
                                Retirada de Itens
                              </Button>
                              <Button
                                type="button"
                                variant={operationMode === "SERVICE" ? "default" : "outline"}
                                onClick={() => handleModeChange("SERVICE")}
                                disabled={!isPending}
                                className="h-10 justify-center gap-2"
                              >
                                <IconTool className="h-4 w-4" />
                                Serviço
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {operationMode === "WITHDRAWAL"
                                ? "Retirada de itens do estoque (retornável, cobrável ou cortesia)"
                                : "Cobrança de serviços avulsos, com itens do estoque opcionais"}
                            </p>
                          </div>

                          {/* Withdrawal Type (withdrawal mode only, locked after PENDING) */}
                          {operationMode === "WITHDRAWAL" && (
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">
                                Tipo de Operação <span className="text-destructive">*</span>
                              </Label>
                              <Combobox
                                value={withdrawalType}
                                onValueChange={(value: string | string[] | null | undefined) => {
                                  const typeValue = value as EXTERNAL_OPERATION_TYPE;
                                  updateType(typeValue);
                                }}
                                options={[
                                  {
                                    value: EXTERNAL_OPERATION_TYPE.RETURNABLE,
                                    label: EXTERNAL_OPERATION_TYPE_LABELS[EXTERNAL_OPERATION_TYPE.RETURNABLE],
                                  },
                                  {
                                    value: EXTERNAL_OPERATION_TYPE.CHARGEABLE,
                                    label: EXTERNAL_OPERATION_TYPE_LABELS[EXTERNAL_OPERATION_TYPE.CHARGEABLE],
                                  },
                                  {
                                    value: EXTERNAL_OPERATION_TYPE.COMPLIMENTARY,
                                    label: EXTERNAL_OPERATION_TYPE_LABELS[EXTERNAL_OPERATION_TYPE.COMPLIMENTARY],
                                  },
                                ]}
                                placeholder="Selecione o tipo"
                                className="h-10"
                                searchable={false}
                                clearable={false}
                                disabled={!isPending}
                              />
                              <p className="text-xs text-muted-foreground">
                                {withdrawalType === EXTERNAL_OPERATION_TYPE.RETURNABLE && "Itens serão devolvidos (sem cobrança)"}
                                {withdrawalType === EXTERNAL_OPERATION_TYPE.CHARGEABLE && "Itens não serão devolvidos (com cobrança)"}
                                {withdrawalType === EXTERNAL_OPERATION_TYPE.COMPLIMENTARY && "Itens cortesia (sem devolução e sem cobrança)"}
                              </p>
                            </div>
                          )}

                          {/* Withdrawer Name (optional; locked after PENDING) */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Retirado por</Label>
                            <Input
                              placeholder="Nome de quem retirou (opcional)"
                              value={withdrawerName}
                              onChange={(value: string | number | null) => updateWithdrawerName(typeof value === 'string' ? value : String(value ?? ''))}
                              className="h-10 bg-transparent"
                              maxLength={200}
                              disabled={!isPending}
                            />
                            {withdrawerName && (withdrawerName.trim().length || 0) < 2 && <p className="text-sm text-destructive">Nome deve ter pelo menos 2 caracteres</p>}
                            {withdrawerName && withdrawerName.trim().length > 200 && <p className="text-sm text-destructive">Nome deve ter no máximo 200 caracteres</p>}
                          </div>
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Observações</Label>
                          <Textarea
                            placeholder="Observações sobre a operação (opcional)"
                            value={notes}
                            onChange={(e) => updateNotes(e.target.value)}
                            className="min-h-20 max-h-32"
                            rows={3}
                            maxLength={500}
                          />
                          {notes && notes.length > 500 && <p className="text-sm text-destructive">Observações devem ter no máximo 500 caracteres</p>}
                          {notes && <p className="text-xs text-muted-foreground">{notes.length}/500 caracteres</p>}
                        </div>

                      </CardContent>
                    </Card>

                    {/* Billing section (CHARGEABLE only) */}
                    {isChargeable && (
                      <ExternalOperationBillingSection
                        customerId={customerId}
                        onCustomerIdChange={setCustomerId}
                        initialCustomer={withdrawal.customer ?? undefined}
                        generateInvoice={generateInvoice}
                        onGenerateInvoiceChange={setGenerateInvoice}
                        generateBankSlip={generateBankSlip}
                        onGenerateBankSlipChange={setGenerateBankSlip}
                        paymentConfig={paymentConfig}
                        onPaymentConfigChange={setPaymentConfig}
                        services={services}
                        onServicesChange={setServices}
                        servicesRequired={operationMode === "SERVICE"}
                        disabled={!isPending}
                        disabledReason='Itens, serviços, cliente e configuração de faturamento só podem ser alterados enquanto a operação está com status "Pendente".'
                      />
                    )}

                    {/* Documents — always the last section of the form */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <IconFileInvoice className="h-5 w-5" />
                          Documentos (Opcional)
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
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
                              onFilesChange={handleInvoiceFilesChange}
                              existingFiles={invoiceFiles}
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
                      </CardContent>
                    </Card>
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="flex flex-col flex-1 min-h-0 gap-3">
                    {!isPending && (
                      <div className="flex-shrink-0 rounded-md border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                        Os itens não podem ser alterados porque a operação não está mais com status "Pendente".
                      </div>
                    )}
                    <div className={cn("flex flex-col flex-1 min-h-0", !isPending && "pointer-events-none opacity-60")} aria-disabled={!isPending}>
                    <ExternalOperationItemSelector
                      selectedItems={selectedItems}
                      onSelectItem={toggleItemSelection}
                      onSelectAll={() => {}}
                      onQuantityChange={setItemQuantity}
                      onPriceChange={setItemPrice}
                      quantities={quantities}
                      prices={prices}
                      isSelected={(itemId) => selectedItems.has(itemId)}
                      showQuantityInput={true}
                      showPriceInput={withdrawalType === EXTERNAL_OPERATION_TYPE.CHARGEABLE}
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
                    />
                    </div>
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="space-y-6">
                    {/* Summary Card */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <IconPackageExport className="h-5 w-5" />
                            Resumo da Operação
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
                            <span className="text-sm font-medium text-muted-foreground">Retirado por:</span>
                            <p className="mt-1 font-medium">{withdrawerName?.trim() || "Não informado"}</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-muted-foreground">Tipo de Operação:</span>
                            <p className="mt-1 font-medium">
                              {operationMode === "SERVICE" ? "Serviço" : `Retirada de Itens (${EXTERNAL_OPERATION_TYPE_LABELS[withdrawalType]})`}
                            </p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-muted-foreground">Quantidade de Itens:</span>
                            <p className="mt-1 font-medium">
                              {selectionCount} {selectionCount === 1 ? "item" : "itens"}
                            </p>
                          </div>
                          {canViewPrices && withdrawalType === EXTERNAL_OPERATION_TYPE.CHARGEABLE && (
                            <div>
                              <span className="text-sm font-medium text-muted-foreground">Valor Total:</span>
                              <p className="mt-1 font-medium">{formatCurrency(totalPrice)}</p>
                            </div>
                          )}
                          {isChargeable && (
                            <>
                              <div>
                                <span className="text-sm font-medium text-muted-foreground">Faturamento:</span>
                                <p className="mt-1 font-medium">
                                  {[generateInvoice ? "NFS-e" : null, generateBankSlip ? "Boleto" : null].filter(Boolean).join(" + ") || "Sem emissão automática"}
                                </p>
                              </div>
                              <div>
                                <span className="text-sm font-medium text-muted-foreground">Serviços:</span>
                                <p className="mt-1 font-medium">
                                  {validServices.length > 0
                                    ? `${validServices.length} ${validServices.length === 1 ? "serviço" : "serviços"} (${formatCurrency(servicesTotal)})`
                                    : "Nenhum"}
                                </p>
                              </div>
                            </>
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
                        <div className="rounded-md border overflow-hidden dark:border-border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Código</TableHead>
                                <TableHead>Item</TableHead>
                                <TableHead>Categoria</TableHead>
                                <TableHead>Marca</TableHead>
                                <TableHead className="text-right">Quantidade</TableHead>
                                {canViewPrices && withdrawalType === EXTERNAL_OPERATION_TYPE.CHARGEABLE && (
                                  <>
                                    <TableHead className="text-right">Preço Unit.</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                  </>
                                )}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedItemsData.map((item: Item) => {
                                const quantity = Number(quantities[item.id]) || 1;
                                const price = Number(prices[item.id]) || 0;
                                const itemTotal = quantity * price;

                                return (
                                  <TableRow key={item.id}>
                                    <TableCell className="font-mono">{item.uniCode || "-"}</TableCell>
                                    <TableCell>{item.name}</TableCell>
                                    <TableCell>{item.category?.name || "-"}</TableCell>
                                    <TableCell>{item.brands?.map((b) => b.name).join(", ") || "-"}</TableCell>
                                    <TableCell className="text-right">
                                      {quantity}
                                      {item.measureUnit && MEASURE_UNIT_LABELS[item.measureUnit as keyof typeof MEASURE_UNIT_LABELS]
                                        ? ` ${MEASURE_UNIT_LABELS[item.measureUnit as keyof typeof MEASURE_UNIT_LABELS]}`
                                        : ""}
                                    </TableCell>
                                    {canViewPrices && withdrawalType === EXTERNAL_OPERATION_TYPE.CHARGEABLE && (
                                      <>
                                        <TableCell className="text-right">{formatCurrency(price)}</TableCell>
                                        <TableCell className="text-right font-medium">{formatCurrency(itemTotal)}</TableCell>
                                      </>
                                    )}
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                            {canViewPrices && withdrawalType === EXTERNAL_OPERATION_TYPE.CHARGEABLE && (
                              <TableFooter>
                                <TableRow>
                                  <TableCell colSpan={5} className="text-right font-medium">
                                    Total Geral
                                  </TableCell>
                                  <TableCell className="text-right">&nbsp;</TableCell>
                                  <TableCell className="text-right font-bold text-base">{formatCurrency(totalPrice)}</TableCell>
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
