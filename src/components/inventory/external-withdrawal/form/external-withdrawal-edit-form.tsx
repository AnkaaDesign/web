import { useState, useCallback, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useSearchParams } from "react-router-dom";
import { IconLoader2, IconArrowLeft, IconArrowRight, IconCheck, IconUser, IconArrowBack, IconPackage, IconPackageExport, IconDownload, IconFileInvoice, IconReceipt } from "@tabler/icons-react";
import type { ExternalWithdrawalCreateFormData } from "../../../../schemas";
import type { ExternalWithdrawal, ExternalWithdrawalItem, Item } from "../../../../types";
import { externalWithdrawalCreateSchema } from "../../../../schemas";
import { useExternalWithdrawalMutations, useItems } from "../../../../hooks";
import { routes } from "../../../../constants";
import { toast } from "sonner";
import { FileUploadField, type FileWithPreview } from "@/components/file";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Form } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/ui/page-header";
import { FormSteps } from "@/components/ui/form-steps";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ExternalWithdrawalItemSelector } from "./external-withdrawal-item-selector";
import { useExternalWithdrawalFormUrlState } from "@/hooks/use-external-withdrawal-form-url-state";
import { formatCurrency, formatDate, formatDateTime } from "../../../../utils";
import { MEASURE_UNIT_LABELS } from "../../../../constants";
import { createWithdrawalFormData } from "@/utils/form-data-helper";

interface ExternalWithdrawalEditFormProps {
  withdrawal: ExternalWithdrawal & {
    items: ExternalWithdrawalItem[];
  };
}

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

export const ExternalWithdrawalEditForm = ({ withdrawal }: ExternalWithdrawalEditFormProps) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize state from URL parameters
  const [currentStep, setCurrentStep] = useState(getStepFromUrl(searchParams));

  // File upload state
  const [receiptFiles, setReceiptFiles] = useState<FileWithPreview[]>([]);
  const [nfeFiles, setNfeFiles] = useState<FileWithPreview[]>([]);

  // Convert existing withdrawal data to initial state
  const initialSelectedItems = useMemo(() => new Set(withdrawal.items.map((item: ExternalWithdrawalItem) => item.itemId)), [withdrawal.items]);

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
    willReturn,
    notes,
    updateWithdrawerName,
    updateWillReturn,
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
  } = useExternalWithdrawalFormUrlState({
    defaultQuantity: 1,
    defaultPrice: 0,
    preserveQuantitiesOnDeselect: false,
    defaultPageSize: 40,
    // Initialize with existing data
    initialData: {
      withdrawerName: withdrawal.withdrawerName,
      willReturn: withdrawal.willReturn,
      notes: withdrawal.notes || "",
      selectedItems: initialSelectedItems,
      quantities: initialQuantities,
      prices: initialPrices,
    },
  });

  // Form setup with default values from URL state
  const defaultValues: Partial<ExternalWithdrawalCreateFormData> = {
    withdrawerName: withdrawerName || withdrawal.withdrawerName,
    willReturn: willReturn,
    notes: notes || withdrawal.notes || "",
    items: [],
  };

  const form = useForm<ExternalWithdrawalCreateFormData>({
    resolver: zodResolver(externalWithdrawalCreateSchema),
    mode: "onChange",
    defaultValues,
  });

  // Mutations - use update instead of create
  const { updateAsync, isLoading: isSubmitting } = useExternalWithdrawalMutations();

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

  // Calculate total price (only if willReturn is false)
  const totalPrice = !willReturn
    ? Array.from(selectedItems).reduce((total, itemId) => {
        const quantity = Number(quantities[itemId]) || 1;
        const price = Number(prices[itemId]) || 0;
        return total + quantity * price;
      }, 0)
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
      case 1:
        // Validate basic information using URL state
        if (!withdrawerName?.trim()) {
          toast.error("Nome do retirador é obrigatório");
          return false;
        }
        if ((withdrawerName?.trim().length || 0) < 2) {
          toast.error("Nome do retirador deve ter pelo menos 2 caracteres");
          return false;
        }
        if (withdrawerName && withdrawerName.trim().length > 200) {
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
        if (selectionCount === 0) {
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

        // Validate prices if not returning
        if (!willReturn) {
          const missingPrices = Array.from(selectedItems).filter((itemId) => {
            const price = prices[itemId];
            return price === undefined || price === null || price < 0;
          });

          if (missingPrices.length > 0) {
            toast.error(`Todos os itens selecionados devem ter preço definido quando não serão devolvidos`);
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
  }, [currentStep, withdrawerName, selectionCount, selectedItems, quantities, willReturn, prices, notes]);

  // Handle file changes
  const handleReceiptFilesChange = useCallback((files: FileWithPreview[]) => {
    setReceiptFiles(files);
    form.setValue("receiptId", files.length > 0 ? "pending" : undefined, { shouldDirty: true, shouldTouch: true });
  }, [form]);

  const handleNfeFilesChange = useCallback((files: FileWithPreview[]) => {
    setNfeFiles(files);
    form.setValue("nfeId", files.length > 0 ? "pending" : undefined, { shouldDirty: true, shouldTouch: true });
  }, [form]);

  // Handle navigation with validation
  const handleNext = useCallback(() => {
    if (validateCurrentStep()) {
      nextStep();
    }
  }, [validateCurrentStep, nextStep]);

  const handleCancel = useCallback(() => {
    navigate(routes.inventory.externalWithdrawals?.list || "/inventory/external-withdrawals");
  }, [navigate]);

  // Submit handler
  const handleSubmit = useCallback(async () => {
    if (!validateCurrentStep()) return;

    try {
      // Check if there are new files to upload
      const newReceiptFiles = receiptFiles.filter(f => f instanceof File && !(f as any).uploadedFileId);
      const newNfeFiles = nfeFiles.filter(f => f instanceof File && !(f as any).uploadedFileId);
      const hasNewFiles = newReceiptFiles.length > 0 || newNfeFiles.length > 0;

      console.log('[EXTERNAL WITHDRAWAL EDIT] Submission data:', {
        hasNewFiles,
        receiptFilesCount: newReceiptFiles.length,
        nfeFilesCount: newNfeFiles.length,
      });

      const updateData = {
        withdrawerName: withdrawerName?.trim() || "",
        willReturn,
        notes: notes?.trim() || null,
      };

      if (hasNewFiles) {
        console.log('[EXTERNAL WITHDRAWAL EDIT] Creating FormData with files');
        const formData = createWithdrawalFormData(
          updateData,
          {
            receipts: newReceiptFiles.length > 0 ? newReceiptFiles as File[] : undefined,
            invoices: newNfeFiles.length > 0 ? newNfeFiles as File[] : undefined,
          },
          undefined // No customer context for external withdrawals
        );

        await updateAsync({
          id: withdrawal.id,
          data: formData as any,
        });
      } else {
        console.log('[EXTERNAL WITHDRAWAL EDIT] Submitting without files');
        await updateAsync({
          id: withdrawal.id,
          data: updateData,
        });
      }

      // Success notification is handled by API client
      navigate(routes.inventory.externalWithdrawals?.list || "/inventory/external-withdrawals");
    } catch (error) {
      console.error("Error updating external withdrawal:", error);
      // Error is handled by the mutation hook
    }
  }, [validateCurrentStep, selectedItems, quantities, prices, withdrawerName, willReturn, notes, updateAsync, withdrawal.id, navigate, receiptFiles, nfeFiles]);

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
            <h1>Retirada Externa #${withdrawal.id.slice(-8)}</h1>
            <p>Gerado em ${formatDateTime(new Date())}</p>
          </div>
        </div>
        
        <div class="info-section">
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Retirador</span>
              <span class="info-value">${withdrawerName}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Tipo de Retirada</span>
              <span class="info-value">${willReturn ? "Com Devolução" : "Sem Devolução"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Quantidade de Itens</span>
              <span class="info-value">${selectionCount} ${selectionCount === 1 ? "item" : "itens"}</span>
            </div>
            ${
              !willReturn
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
                ${!willReturn ? '<th class="text-right">Preço Unit.</th><th class="text-right">Total</th>' : ""}
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
                    <td>${item.brand?.name || "-"}</td>
                    <td class="text-right">${quantity}${item.measureUnit && MEASURE_UNIT_LABELS[item.measureUnit as keyof typeof MEASURE_UNIT_LABELS] ? ` ${MEASURE_UNIT_LABELS[item.measureUnit as keyof typeof MEASURE_UNIT_LABELS]}` : ""}</td>
                    ${!willReturn ? `<td class="text-right">${formatCurrency(price)}</td><td class="text-right font-medium">${formatCurrency(itemTotal)}</td>` : ""}
                  </tr>
                `;
                })
                .join("")}
            </tbody>
            ${
              !willReturn
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
    [withdrawerName, willReturn, notes, selectionCount, selectedItemsData, quantities, prices, totalPrice, withdrawal.id],
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
    navigationActions.push({
      key: "submit",
      label: "Salvar Alterações",
      icon: isSubmitting ? IconLoader2 : IconCheck,
      onClick: handleSubmit,
      variant: "default" as const,
      disabled: isSubmitting || selectionCount === 0,
      loading: isSubmitting,
    });
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex-shrink-0">
        <PageHeader
          title="Editar Retirada Externa"
          icon={IconPackageExport}
          variant="form"
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Estoque", href: "/estoque" },
            { label: "Retiradas Externas", href: routes.inventory.externalWithdrawals?.list || "/inventory/external-withdrawals" },
            { label: "Editar" },
          ]}
          actions={navigationActions}
        />
      </div>

      <Card className="flex-1 min-h-0 flex flex-col shadow-sm border border-border">
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
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <IconUser className="h-5 w-5" />
                          Informações da Retirada
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {/* Withdrawer Name */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">
                            Nome do Retirador <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            placeholder="Digite o nome da pessoa que está retirando"
                            value={withdrawerName}
                            onChange={(e) => updateWithdrawerName(e.target.value)}
                            className="h-10"
                            maxLength={200}
                          />
                          {withdrawerName && (withdrawerName.trim().length || 0) < 2 && <p className="text-sm text-destructive">Nome deve ter pelo menos 2 caracteres</p>}
                          {withdrawerName && withdrawerName.trim().length > 200 && <p className="text-sm text-destructive">Nome deve ter no máximo 200 caracteres</p>}
                        </div>

                        {/* Will Return Toggle */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium flex items-center gap-2">
                              <IconArrowBack className="h-4 w-4" />
                              Itens serão devolvidos?
                            </Label>
                            <Switch
                              checked={willReturn}
                              onCheckedChange={(value) => {
                                updateWillReturn(value);
                              }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {willReturn ? "Os itens serão devolvidos (sem cobrança)" : "Os itens não serão devolvidos (com cobrança)"}
                          </p>
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Observações</Label>
                          <Textarea
                            placeholder="Observações sobre a retirada (opcional)"
                            value={notes}
                            onChange={(e) => updateNotes(e.target.value)}
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
                  <>
                    <ExternalWithdrawalItemSelector
                      selectedItems={selectedItems}
                      onSelectItem={toggleItemSelection}
                      onSelectAll={() => {}}
                      onQuantityChange={setItemQuantity}
                      onPriceChange={setItemPrice}
                      quantities={quantities}
                      prices={prices}
                      isSelected={(itemId) => selectedItems.has(itemId)}
                      showQuantityInput={true}
                      showPriceInput={!willReturn}
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
                  </>
                )}

                {currentStep === 3 && (
                  <div className="space-y-6">
                    {/* Summary Card */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <IconPackageExport className="h-5 w-5" />
                            Resumo da Retirada
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
                            <p className="mt-1 font-medium">{willReturn ? "Com Devolução" : "Sem Devolução"}</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-muted-foreground">Quantidade de Itens:</span>
                            <p className="mt-1 font-medium">
                              {selectionCount} {selectionCount === 1 ? "item" : "itens"}
                            </p>
                          </div>
                          {!willReturn && (
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
                        <div className="rounded-md border overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Código</TableHead>
                                <TableHead>Item</TableHead>
                                <TableHead>Categoria</TableHead>
                                <TableHead>Marca</TableHead>
                                <TableHead className="text-right">Quantidade</TableHead>
                                {!willReturn && (
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
                                    <TableCell>{item.brand?.name || "-"}</TableCell>
                                    <TableCell className="text-right">
                                      {quantity}
                                      {item.measureUnit && MEASURE_UNIT_LABELS[item.measureUnit as keyof typeof MEASURE_UNIT_LABELS]
                                        ? ` ${MEASURE_UNIT_LABELS[item.measureUnit as keyof typeof MEASURE_UNIT_LABELS]}`
                                        : ""}
                                    </TableCell>
                                    {!willReturn && (
                                      <>
                                        <TableCell className="text-right">{formatCurrency(price)}</TableCell>
                                        <TableCell className="text-right font-medium">{formatCurrency(itemTotal)}</TableCell>
                                      </>
                                    )}
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                            {!willReturn && (
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
