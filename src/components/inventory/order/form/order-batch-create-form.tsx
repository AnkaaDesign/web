import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { IconLoader2, IconCheck, IconShoppingCart, IconCalendar, IconDownload, IconPackages } from "@tabler/icons-react";
import type { OrderCreateFormData, OrderBatchCreateFormData } from "../../../../schemas";
import { orderCreateSchema } from "../../../../schemas";
import { useOrderBatchMutations, useSuppliers, useItems } from "../../../../hooks";
import { routes, ORDER_STATUS, MEASURE_UNIT_LABELS } from "../../../../constants";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { PageHeader } from "@/components/ui/page-header";
import { OrderItemSelector } from "./order-item-selector";
import { formatCurrency, formatDate, formatDateTime } from "../../../../utils";
import { SupplierLogoDisplay } from "@/components/ui/avatar-display";

export const OrderBatchCreateForm = () => {
  const navigate = useNavigate();

  // Form setup for individual order data (used for common fields)
  const form = useForm<OrderCreateFormData>({
    resolver: zodResolver(orderCreateSchema),
    defaultValues: {
      description: "",
      supplierId: "",
      forecast: undefined,
      notes: "",
      items: [],
    },
    mode: "onBlur",
    reValidateMode: "onChange",
  });

  // State for batch operations
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [taxes, setTaxes] = useState<Record<string, number>>({});
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [brandIds, setBrandIds] = useState<string[]>([]);
  const [supplierIds, setSupplierIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(40);
  const [totalRecords, setTotalRecords] = useState(0);

  // Mutations
  const { batchCreateAsync, isLoading: isSubmitting } = useOrderBatchMutations();

  // Fetch suppliers for selection
  const { data: suppliersResponse } = useSuppliers({
    orderBy: { fantasyName: "asc" },
    take: 100,
    include: { logo: true },
  });

  const suppliers = suppliersResponse?.data || [];

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

  // Calculate total price
  const totalPrice = Array.from(selectedItems).reduce((total, itemId) => {
    const quantity = quantities[itemId] || 1;
    const price = prices[itemId] || 0;
    return total + quantity * price;
  }, 0);

  // Handle item selection
  const handleSelectItem = useCallback(
    (itemId: string, quantity?: number, price?: number, tax?: number) => {
      setSelectedItems((prev) => {
        const newSelection = new Set(prev);
        if (newSelection.has(itemId)) {
          newSelection.delete(itemId);
          // Clean up quantities, prices and taxes when deselecting
          const newQuantities = { ...quantities };
          const newPrices = { ...prices };
          const newTaxes = { ...taxes };
          delete newQuantities[itemId];
          delete newPrices[itemId];
          delete newTaxes[itemId];
          setQuantities(newQuantities);
          setPrices(newPrices);
          setTaxes(newTaxes);
        } else {
          newSelection.add(itemId);
          // Set quantity, price and tax
          setQuantities((prev) => ({ ...prev, [itemId]: quantity || 1 }));
          if (price !== undefined) {
            setPrices((prev) => ({ ...prev, [itemId]: price }));
          }
          if (tax !== undefined) {
            setTaxes((prev) => ({ ...prev, [itemId]: tax }));
          }
        }
        return newSelection;
      });
    },
    [quantities, prices, taxes],
  );

  const handleQuantityChange = useCallback((itemId: string, quantity: number) => {
    const validQuantity = Math.max(0.01, quantity);
    setQuantities((prev) => ({ ...prev, [itemId]: validQuantity }));
  }, []);

  const handlePriceChange = useCallback((itemId: string, price: number) => {
    const validPrice = Math.max(0, price);
    setPrices((prev) => ({ ...prev, [itemId]: validPrice }));
  }, []);

  // Clear all selections
  const clearAllSelections = useCallback(() => {
    setSelectedItems(new Set());
    setQuantities({});
    setPrices({});
    setTaxes({});
  }, []);

  // Validate form
  const validateForm = useCallback((): boolean => {
    const formValues = form.getValues();

    if (!formValues.supplierId) {
      toast.error("Fornecedor é obrigatório");
      return false;
    }

    if (!formValues.forecast) {
      toast.error("Data de entrega é obrigatória");
      return false;
    }

    if (selectedItems.size === 0) {
      toast.error("Pelo menos um item deve ser selecionado");
      return false;
    }

    // Validate that all selected items have prices set
    const itemsWithoutPrice = Array.from(selectedItems).filter((itemId) => !prices[itemId] || prices[itemId] <= 0);
    if (itemsWithoutPrice.length > 0) {
      toast.error("Todos os itens selecionados devem ter preço definido");
      return false;
    }

    return true;
  }, [form, selectedItems, prices]);

  // Handle form submission
  const handleSubmit = useCallback(
    async (data: OrderCreateFormData) => {
      try {
        // Validate form
        if (!validateForm()) {
          return;
        }

        // Create batch data
        const orders: OrderCreateFormData[] = Array.from(selectedItems).map((itemId) => ({
          description: `Pedido - ${selectedItemsData?.find((item) => item.id === itemId)?.name || "Item"} - ${new Date().toLocaleDateString()}`,
          status: ORDER_STATUS.CREATED,
          supplierId: data.supplierId,
          forecast: data.forecast,
          notes: data.notes || undefined,
          items: [
            {
              itemId,
              orderedQuantity: quantities[itemId] || 1,
              price: prices[itemId] || 0,
              tax: taxes[itemId] || 0,
            },
          ],
        }));
        const result = await batchCreateAsync({ orders } as OrderBatchCreateFormData);
        if (result.success) {
          const successCount = result.data?.success?.length || 0;
          const failedCount = result.data?.failed?.length || 0;

          // Success toast is handled automatically by API client

          if (failedCount > 0) {
            toast.warning(`${failedCount} pedidos falharam`);
          }

          // Clear form and selections
          form.reset();
          clearAllSelections();

          // Navigate to the list page
          setTimeout(() => {
            navigate(routes.inventory.orders.root);
          }, 1500);
        }
      } catch (error) {
        console.error("Submission error:", error);
        // Error is handled by the mutation hook, but let's log it
      }
    },
    [validateForm, selectedItems, quantities, prices, taxes, selectedItemsData, batchCreateAsync, form, clearAllSelections, navigate],
  );

  const handleCancel = useCallback(() => {
    navigate(routes.inventory.orders.root);
  }, [navigate]);

  // PDF Export function
  const exportToPDF = useCallback(
    (e?: React.MouseEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      const formValues = form.getValues();
      const selectedSupplier = suppliers.find((s) => s.id === formValues.supplierId);

      const pdfContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Pedidos de Compra (Lote) - ${formatDate(new Date())}</title>
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
          
          .summary-box {
            margin-top: 20px;
            padding: 15px;
            background: #dbeafe;
            border-radius: 8px;
            border: 1px solid #3b82f6;
          }
          
          .summary-title {
            font-weight: 600;
            color: #1e40af;
            margin-bottom: 10px;
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
            <h1 class="title">Pedidos de Compra (Lote)</h1>
            <p class="subtitle">Documento de controle de múltiplos pedidos de materiais</p>
          </div>
        </div>
        
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Fornecedor</span>
            <span class="info-value">${selectedSupplier?.name || "-"}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Data de Entrega</span>
            <span class="info-value">${formValues.forecast ? formatDate(new Date(formValues.forecast)) : "-"}</span>
          </div>
        </div>
        
        <div class="summary-box">
          <h3 class="summary-title">Resumo do Lote</h3>
          <p><strong>Total de Pedidos:</strong> ${selectedItems.size} pedidos individuais</p>
          <p><strong>Valor Total do Lote:</strong> ${formatCurrency(totalPrice)}</p>
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
              ${(selectedItemsData || [])
                .map((item) => {
                  const quantity = quantities[item.id] || 1;
                  const price = prices[item.id] || 0;
                  const total = quantity * price;

                  // Get measure display - prioritize volume if both weight and volume exist
                  const getMeasureDisplay = () => {
                    if (!item.measures || item.measures.length === 0) return "-";

                    const volumeUnits = ["MILLILITER", "LITER", "CUBIC_METER", "CUBIC_CENTIMETER"];
                    const weightUnits = ["KILOGRAM", "GRAM"];

                    // Use centralized unit labels from constants package
                    const unitLabels = MEASURE_UNIT_LABELS;

                    const hasVolume = item.measures?.some((m) => m.unit && volumeUnits.includes(m.unit));
                    const hasWeight = item.measures?.some((m) => m.unit && weightUnits.includes(m.unit));

                    if (hasVolume && hasWeight) {
                      // If both exist, show only volume
                      const volumeMeasure = item.measures?.find((m) => m.unit && volumeUnits.includes(m.unit));
                      if (volumeMeasure) {
                        const unitLabel = unitLabels[volumeMeasure.unit! as keyof typeof MEASURE_UNIT_LABELS] || volumeMeasure.unit;
                        return volumeMeasure.value + " " + unitLabel;
                      }
                      return "-";
                    }

                    // Otherwise show the first measure
                    const firstMeasure = item.measures?.[0];
                    if (!firstMeasure?.unit) return "-";
                    const unitLabel = unitLabels[firstMeasure.unit as keyof typeof MEASURE_UNIT_LABELS] || firstMeasure.unit;
                    return (firstMeasure.value || 0) + " " + unitLabel;
                  };

                  return `
                  <tr>
                    <td class="font-mono">${item.uniCode || "-"}</td>
                    <td class="font-medium">${item.name}</td>
                    <td>${item.brand?.name || "-"}</td>
                    <td>${getMeasureDisplay()}</td>
                    <td class="text-right font-medium">${quantity.toLocaleString("pt-BR")}</td>
                    <td class="text-right">${formatCurrency(price)}</td>
                    <td class="text-right font-semibold">${formatCurrency(total)}</td>
                  </tr>
                `;
                })
                .join("")}
              <tr class="total-row">
                <td colspan="6" class="text-right">Total Geral:</td>
                <td class="text-right font-semibold">${formatCurrency(totalPrice)}</td>
              </tr>
            </tbody>
          </table>
          
          ${
            formValues.notes
              ? `
          <div class="notes-section">
            <div class="notes-title">Observações:</div>
            <div>${formValues.notes}</div>
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
    [form, suppliers, selectedItems, selectedItemsData, quantities, prices, totalPrice],
  );

  // Navigation actions
  const navigationActions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: handleCancel,
      variant: "outline" as const,
      disabled: isSubmitting,
    },
    {
      key: "submit",
      label: `Criar ${selectedItems.size} Pedidos`,
      icon: isSubmitting ? IconLoader2 : IconCheck,
      onClick: form.handleSubmit(handleSubmit),
      variant: "default" as const,
      disabled: isSubmitting || selectedItems.size === 0 || !form.formState.isValid,
      loading: isSubmitting,
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 pb-4">
        <PageHeader
          title="Cadastrar Pedidos em Lote"
          icon={IconPackages}
          variant="form"
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Estoque", href: "/estoque" },
            { label: "Pedidos", href: routes.inventory.orders.root },
            { label: "Cadastrar em Lote" },
          ]}
          actions={navigationActions}
        />
      </div>

      <Card className="flex-1 min-h-0 flex flex-col shadow-sm border border-border">
        <CardContent className="flex-1 flex flex-col p-6 overflow-hidden min-h-0">
          <Form {...form}>
            <form className="flex flex-col h-full">
              {/* Form content wrapper with scrolling */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-6">
                {/* Basic Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <IconShoppingCart className="h-5 w-5" />
                        Informações do Pedido
                      </span>
                      {selectedItems.size > 0 && (
                        <Button type="button" variant="outline" size="sm" onClick={exportToPDF} className="gap-2">
                          <IconDownload className="h-4 w-4" />
                          Baixar PDF
                        </Button>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Description will be auto-generated per order based on items */}

                      {/* Supplier Selection */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">
                          Fornecedor <span className="text-red-500">*</span>
                        </Label>
                        <Combobox
                          value={form.watch("supplierId") || ""}
                          onValueChange={(value) => form.setValue("supplierId", value)}
                          options={
                            suppliers.length === 0
                              ? [{ label: "Nenhum fornecedor ativo encontrado", value: "no-suppliers", disabled: true }]
                              : suppliers.map((supplier) => ({
                                  label: supplier.fantasyName,
                                  value: supplier.id,
                                  logo: supplier.logo,
                                }))
                          }
                          placeholder="Selecione um fornecedor"
                          searchPlaceholder="Buscar fornecedor..."
                          className={`${!form.watch("supplierId") ? "border-red-500" : ""}`}
                          renderOption={(option, isSelected) => {
                            if (option.value === "no-suppliers") {
                              return <span className="text-foreground/60 italic">{option.label}</span>;
                            }
                            return (
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
                            );
                          }}
                        />
                        {!form.watch("supplierId") && <p className="text-sm text-red-500">Fornecedor é obrigatório para pedidos em lote</p>}
                      </div>

                      {/* Scheduled Date */}
                      <DateTimeInput
                        value={(() => {
                          const forecast = form.watch("forecast");
                          if (!forecast) return undefined;
                          if (forecast instanceof Date) return forecast;
                          if (typeof forecast === "string" || typeof forecast === "number") {
                            const dateValue = new Date(forecast);
                            return isNaN(dateValue.getTime()) ? undefined : dateValue;
                          }
                          return undefined;
                        })()}
                        onChange={(date) => {
                          if (date) {
                            // Set to 13:00 São Paulo time
                            const newDate = new Date(date);
                            newDate.setHours(13, 0, 0, 0);
                            form.setValue("forecast", newDate);
                          } else {
                            form.setValue("forecast", undefined);
                          }
                        }}
                        context="delivery"
                        label={
                          <div className="flex items-center gap-2">
                            <IconCalendar className="h-4 w-4" />
                            Data de Entrega <span className="text-red-500">*</span>
                          </div>
                        }
                        placeholder="Selecione a data de entrega"
                        description="Data estimada para recebimento dos itens de todos os pedidos"
                        required={true}
                        className={`${!form.watch("forecast") ? "border-red-500" : ""}`}
                      />
                      {!form.watch("forecast") && <p className="text-sm text-red-500">Data de entrega é obrigatória para pedidos em lote</p>}

                      {/* Summary */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Resumo</Label>
                        <div className="text-sm space-y-1">
                          <p>
                            <span className="text-muted-foreground">Itens selecionados:</span> <span className="font-medium">{selectedItems.size}</span>
                          </p>
                          <p>
                            <span className="text-muted-foreground">Valor total:</span> <span className="font-medium">{formatCurrency(totalPrice)}</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Notes (full width) */}
                    <div className="space-y-2 md:col-span-3">
                      <Label className="text-sm font-medium">Observações</Label>
                      <Textarea placeholder="Observações sobre os pedidos (opcional)" {...form.register("notes")} className="min-h-20 max-h-32" rows={3} />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Item Selection */}
              <div className="flex-1 min-h-0 flex flex-col">
                <OrderItemSelector
                  selectedItems={selectedItems}
                  onSelectItem={handleSelectItem}
                  onSelectAll={() => {}}
                  onQuantityChange={handleQuantityChange}
                  onPriceChange={handlePriceChange}
                  quantities={quantities}
                  prices={prices}
                  isSelected={(itemId) => selectedItems.has(itemId)}
                  showQuantityInput={true}
                  showPriceInput={true}
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
                  className="flex-1"
                />
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};
