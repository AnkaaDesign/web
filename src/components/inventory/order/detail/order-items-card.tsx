import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import {
  IconPackage,
  IconCheck,
  IconDeviceFloppy,
  IconReload,
  IconBoxMultiple,
  IconCurrencyReal,
  IconAlertCircle,
  IconShoppingCart,
  IconTruck,
  IconDownload,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate, measureUtils } from "../../../../utils";
import type { Order, OrderItem } from "../../../../types";
import { ORDER_STATUS, MEASURE_UNIT_LABELS, MEASURE_TYPE_ORDER } from "../../../../constants";
import { useOrderItemBatchMutations, useOrderItemSpecializedBatchMutations } from "../../../../hooks";
import { toast } from "sonner";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { StockStatusIndicator } from "../../item/list/stock-status-indicator";

interface OrderItemsCardProps {
  order: Order;
  className?: string;
  onOrderUpdate?: () => void;
}

interface ItemChanges {
  [itemId: string]: {
    receivedQuantity: number;
    isComplete: boolean;
  };
}

interface SelectedItems {
  [itemId: string]: boolean;
}

export function OrderItemsCard({ order, className, onOrderUpdate }: OrderItemsCardProps) {
  const { batchUpdate } = useOrderItemBatchMutations({
    onBatchUpdateSuccess: () => {
      toast.success("Quantidades recebidas atualizadas com sucesso!");
      onOrderUpdate?.();
    },
  });
  const { markFulfilled, markReceived } = useOrderItemSpecializedBatchMutations({
    onMarkFulfilledSuccess: () => {
      toast.success("Itens marcados como feito com sucesso");
      onOrderUpdate?.();
      setSelectedItems({});
    },
    onMarkReceivedSuccess: () => {
      toast.success("Itens marcados como recebidos com sucesso");
      onOrderUpdate?.();
      setSelectedItems({});
    },
  });

  // Track changes to items
  const [itemChanges, setItemChanges] = useState<ItemChanges>({});
  const [selectedItems, setSelectedItems] = useState<SelectedItems>({});
  const [isSaving, setIsSaving] = useState(false);

  // Check if order allows inline editing
  const canEditItems = [ORDER_STATUS.CREATED, ORDER_STATUS.PARTIALLY_FULFILLED, ORDER_STATUS.FULFILLED, ORDER_STATUS.PARTIALLY_RECEIVED].includes(order.status);

  // Check if there are unsaved changes
  const hasChanges = useMemo(() => {
    return Object.keys(itemChanges).length > 0;
  }, [itemChanges]);

  // Get the current value for an item (either changed or _original)
  const getItemValue = useCallback(
    (item: OrderItem) => {
      if (itemChanges[item.id]) {
        return itemChanges[item.id];
      }
      return {
        receivedQuantity: item.receivedQuantity || 0,
        isComplete: item.receivedQuantity === item.orderedQuantity,
      };
    },
    [itemChanges],
  );

  // Handle selection
  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        const allSelected: SelectedItems = {};
        order.items?.forEach((item) => {
          allSelected[item.id] = true;
        });
        setSelectedItems(allSelected);
      } else {
        setSelectedItems({});
      }
    },
    [order.items],
  );

  const handleSelectItem = useCallback((itemId: string, checked: boolean) => {
    setSelectedItems((prev) => ({
      ...prev,
      [itemId]: checked,
    }));
  }, []);

  const selectedCount = useMemo(() => {
    return Object.values(selectedItems).filter(Boolean).length;
  }, [selectedItems]);

  const allSelected = useMemo(() => {
    return (order.items?.length ?? 0) > 0 && selectedCount === (order.items?.length ?? 0);
  }, [selectedCount, order.items?.length]);

  const someSelected = useMemo(() => {
    return selectedCount > 0 && selectedCount < (order.items?.length || 0);
  }, [selectedCount, order.items?.length]);

  // Handle quantity change
  const handleQuantityChange = useCallback(
    (itemId: string, value: string) => {
      // Handle both comma and dot as decimal separator
      const normalizedValue = value.replace(',', '.');
      const numValue = parseFloat(normalizedValue) || 0;
      const item = order.items?.find((i) => i.id === itemId);
      if (!item) return;

      const newQuantity = Math.max(0, Math.min(numValue, item.orderedQuantity));
      const isComplete = newQuantity === item.orderedQuantity;

      setItemChanges((prev) => ({
        ...prev,
        [itemId]: {
          receivedQuantity: newQuantity,
          isComplete,
        },
      }));
    },
    [order.items],
  );

  // Batch operations
  const handleBatchMarkFulfilled = useCallback(() => {
    const ids = Object.keys(selectedItems).filter((id) => selectedItems[id]);
    if (ids.length === 0) {
      toast.error("Selecione pelo menos um item");
      return;
    }
    markFulfilled(ids);
  }, [selectedItems, markFulfilled]);

  const handleBatchMarkReceived = useCallback(() => {
    const items = Object.keys(selectedItems)
      .filter((id) => selectedItems[id])
      .map((id) => {
        const item = order.items?.find((i) => i.id === id);
        return {
          id,
          receivedQuantity: item?.orderedQuantity || 0,
        };
      });

    if (items.length === 0) {
      toast.error("Selecione pelo menos um item");
      return;
    }

    markReceived(items);
  }, [selectedItems, order.items, markReceived]);

  // Reset changes
  const handleReset = useCallback(() => {
    setItemChanges({});
  }, []);

  // Save changes
  const handleSave = useCallback(async () => {
    if (!hasChanges) return;

    setIsSaving(true);
    try {
      // Prepare batch update data
      const orderItems = Object.entries(itemChanges).map(([itemId, changes]) => ({
        id: itemId,
        data: {
          receivedQuantity: changes.receivedQuantity,
        },
      }));

      // Use batch update - this will handle activities and status updates properly
      await batchUpdate({ orderItems });

      // Success toast is handled by the hook's onBatchUpdateSuccess
      setItemChanges({});
    } catch (error) {
      toast.error("Erro ao atualizar quantidades recebidas");
      if (process.env.NODE_ENV !== "production") {
        console.error("Error updating order items:", error);
      }
    } finally {
      setIsSaving(false);
    }
  }, [itemChanges, hasChanges, batchUpdate]);

  // Calculate summary statistics
  const summary = useMemo(() => {
    const items = order.items || [];
    let totalOrdered = 0;
    let totalReceived = 0;
    let totalValue = 0;
    let receivedValue = 0;

    items.forEach((item) => {
      const currentValues = getItemValue(item);
      const subtotal = item.orderedQuantity * item.price;
      const icmsAmount = subtotal * (item.icms / 100);
      const ipiAmount = subtotal * (item.ipi / 100);
      const itemTotal = subtotal + icmsAmount + ipiAmount;

      const receivedSubtotal = currentValues.receivedQuantity * item.price;
      const receivedIcmsAmount = receivedSubtotal * (item.icms / 100);
      const receivedIpiAmount = receivedSubtotal * (item.ipi / 100);
      const itemReceivedTotal = receivedSubtotal + receivedIcmsAmount + receivedIpiAmount;

      totalOrdered += item.orderedQuantity;
      totalReceived += currentValues.receivedQuantity;
      totalValue += itemTotal;
      receivedValue += itemReceivedTotal;
    });

    return {
      itemCount: items.length,
      totalOrdered,
      totalReceived,
      totalValue,
      receivedValue,
      percentComplete: totalOrdered > 0 ? (totalReceived / totalOrdered) * 100 : 0,
    };
  }, [order.items, getItemValue]);

  // Get row status
  const getRowStatus = useCallback(
    (item: OrderItem) => {
      const current = getItemValue(item);

      if (itemChanges[item.id]) {
        return "changed";
      } else if (current.isComplete) {
        return "complete";
      } else if (current.receivedQuantity > item.orderedQuantity) {
        return "excess";
      } else if (current.receivedQuantity > 0) {
        return "partial";
      } else if (item.fulfilledAt) {
        return "fulfilled";
      } else {
        return "pending";
      }
    },
    [itemChanges, getItemValue],
  );

  // PDF Export function
  const exportToPDF = useCallback(() => {
    const orderDescription = order.description || "Pedido de Compra";

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
          measureStrings.push(measureUtils.formatMeasure({ value: measure.value, unit: measure.unit }, true, 2, measure.measureType));
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
              <p><strong>Data do Pedido:</strong> ${order.createdAt ? formatDate(new Date(order.createdAt)) : formatDate(new Date())}${order.forecast ? ` | <strong>Data de Entrega:</strong> ${formatDate(new Date(order.forecast))}` : ""} | <strong>Fornecedor:</strong> ${order.supplier ? (order.supplier.fantasyName || order.supplier.name) : "-"} | <strong>Total de itens:</strong> ${order.items?.length || 0}</p>
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
              ${(order.items || [])
                .map((item) => {
                  const itemCode = item.item?.uniCode || "-";
                  const itemName = item.temporaryItemDescription || item.item?.name || "-";
                  const brandName = item.item?.brand?.name || "-";
                  const measuresDisplay = item.item ? formatMeasuresCompact(item.item.measures || []) : "-";
                  const orderedQuantity = item.orderedQuantity || 0;

                  return `
                    <tr>
                      <td class="font-mono text-left">${itemCode}</td>
                      <td class="font-medium text-left">${itemName}</td>
                      <td class="text-left">${brandName}</td>
                      <td class="text-left">${measuresDisplay}</td>
                      <td class="text-center font-medium">${orderedQuantity.toLocaleString("pt-BR")}</td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>

          ${
            order.notes
              ? `
          <div class="notes-section">
            <div class="notes-title">Observações:</div>
            <div>${order.notes}</div>
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
  }, [order]);

  if (!order.items || order.items.length === 0) {
    return (
      <Card className={cn("shadow-sm border border-border", className)}>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <IconPackage className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">Nenhum item encontrado</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
          <IconPackage className="h-5 w-5 text-muted-foreground" />
          Itens do Pedido
        </CardTitle>
          <Badge variant="secondary" className="text-sm">
            {summary.itemCount} {summary.itemCount === 1 ? "item" : "itens"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-0 flex-1 space-y-6 pb-24">
        {/* Summary Statistics */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-muted/50 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <IconBoxMultiple className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Quantidade Pedida</span>
            </div>
            <span className="text-lg font-semibold text-foreground">{summary.totalOrdered.toLocaleString("pt-BR")}</span>
          </div>

          <div className="bg-muted/50 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <IconCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Quantidade Recebida</span>
            </div>
            <span className="text-lg font-semibold text-foreground">{summary.totalReceived.toLocaleString("pt-BR")}</span>
          </div>

          <div className="bg-muted/50 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <IconCurrencyReal className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Valor Total</span>
            </div>
            <span className="text-lg font-semibold text-foreground">{formatCurrency(summary.totalValue)}</span>
          </div>

          <div className="bg-muted/50 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <IconCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Progresso</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-primary h-2 rounded-full transition-all duration-300" style={{ width: `${Math.min(100, summary.percentComplete)}%` }} />
              </div>
              <span className="text-sm font-semibold text-foreground">{summary.percentComplete.toFixed(0)}%</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {/* PDF Export button - always visible */}
          <Button variant="outline" size="sm" onClick={exportToPDF}>
            <IconDownload className="mr-2 h-4 w-4" />
            Exportar PDF
          </Button>

          {/* Edit action buttons - only visible when can edit */}
          {canEditItems && (
            <>
              {selectedCount > 0 && (
                <>
                  <Button variant="outline" size="sm" onClick={handleBatchMarkFulfilled} disabled={isSaving}>
                    <IconShoppingCart className="mr-2 h-4 w-4" />
                    Marcar como Feito ({selectedCount})
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleBatchMarkReceived} disabled={isSaving}>
                    <IconTruck className="mr-2 h-4 w-4" />
                    Marcar como Recebido ({selectedCount})
                  </Button>
                </>
              )}
              {hasChanges && (
                <>
                  <Button variant="default" size="sm" onClick={handleSave} disabled={isSaving}>
                    <IconDeviceFloppy className="mr-2 h-4 w-4" />
                    Salvar Alterações ({Object.keys(itemChanges).length})
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleReset} disabled={isSaving}>
                    <IconReload className="mr-2 h-4 w-4" />
                    Desfazer
                  </Button>
                </>
              )}
            </>
          )}
        </div>

        {/* Items Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
              <TableRow className="bg-muted hover:bg-muted even:bg-muted">
                <TableHead className={cn(TABLE_LAYOUT.checkbox.className, "whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0")}>
                  <div className="flex items-center justify-center h-full w-full px-2">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all items"
                      className={cn("h-4 w-4", someSelected && "data-[state=checked]:bg-muted data-[state=checked]:text-muted-foreground ")}
                      disabled={!canEditItems || (order.items?.length ?? 0) === 0}
                    />
                  </div>
                </TableHead>
                <TableHead className="max-w-[250px]">Item</TableHead>
                <TableHead className="text-center">Estoque</TableHead>
                <TableHead className="text-center">Qtd. Pedida</TableHead>
                <TableHead className="text-center">Qtd. Recebida</TableHead>
                <TableHead className="text-right">Preço Unit.</TableHead>
                <TableHead className="text-right">ICMS</TableHead>
                <TableHead className="text-right">IPI</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => {
                const currentValues = getItemValue(item);
                const rowStatus = getRowStatus(item);
                const subtotal = item.orderedQuantity * item.price;
                const icmsAmount = subtotal * (item.icms / 100);
                const ipiAmount = subtotal * (item.ipi / 100);
                const itemTotal = subtotal + icmsAmount + ipiAmount;
                const isSelected = selectedItems[item.id] || false;

                return (
                  <TableRow
                    key={item.id}
                    className={cn(
                      "transition-colors",
                      rowStatus === "changed" && "bg-yellow-50 dark:bg-yellow-900/20",
                      rowStatus === "complete" && "bg-green-50/50 dark:bg-green-900/10",
                      rowStatus === "partial" && "bg-orange-50/50 dark:bg-orange-900/10",
                      rowStatus === "excess" && "bg-blue-50/50 dark:bg-blue-900/10",
                      isSelected && "bg-accent",
                    )}
                  >
                    <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                      <div className="flex items-center justify-center h-full w-full px-2 py-1" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => handleSelectItem(item.id, checked as boolean)}
                          aria-label={`Select ${item.item?.name || "item"}`}
                          className="h-4 w-4"
                          disabled={!canEditItems}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="py-2 max-w-[250px]">
                      <div className="flex items-center gap-2">
                        <TruncatedTextWithTooltip
                          text={item.temporaryItemDescription || (item.item ? (item.item.uniCode ? `${item.item.uniCode} - ${item.item.name}` : item.item.name) : "-")}
                          className="font-medium text-sm"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-center py-2">
                      {item.item ? (
                        <StockStatusIndicator item={item.item} showQuantity={true} />
                      ) : item.temporaryItemDescription ? (
                        <span className="text-sm text-muted-foreground">N/A</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center py-2">
                      <span className="text-sm">{item.orderedQuantity}</span>
                    </TableCell>
                    <TableCell className="text-center py-2">
                      {canEditItems ? (
                        <div className="flex items-center justify-center">
                          <input
                            type="number"
                            value={currentValues.receivedQuantity > 0 ? currentValues.receivedQuantity : ""}
                            placeholder="0"
                            onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                            disabled={isSaving}
                            min={0}
                            max={item.orderedQuantity}
                            step="0.01"
                            className={cn(
                              "flex h-8 w-20 rounded-md border border-border bg-input px-2 py-2 text-sm text-center",
                              "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                              "disabled:cursor-not-allowed disabled:opacity-50",
                              "transition-all duration-200 ease-in-out",
                              currentValues.receivedQuantity > item.orderedQuantity && "text-blue-600 dark:text-blue-400",
                              currentValues.receivedQuantity === item.orderedQuantity && "text-green-600 dark:text-green-400",
                              currentValues.receivedQuantity > 0 && currentValues.receivedQuantity < item.orderedQuantity && "text-orange-600 dark:text-orange-400",
                            )}
                          />
                        </div>
                      ) : (
                        <span className={cn("text-sm", item.receivedQuantity === item.orderedQuantity && "text-green-600 dark:text-green-400")}>
                          {item.receivedQuantity || 0}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right py-2">
                      <span className="text-sm">{formatCurrency(item.price)}</span>
                    </TableCell>
                    <TableCell className="text-right py-2">
                      <span className="text-sm">{item.icms}%</span>
                    </TableCell>
                    <TableCell className="text-right py-2">
                      <span className="text-sm">{item.ipi}%</span>
                    </TableCell>
                    <TableCell className="text-right py-2">
                      <span className="text-sm font-medium">{formatCurrency(itemTotal)}</span>
                    </TableCell>
                    <TableCell className="text-center py-2">
                      <div className="flex flex-wrap items-center justify-center gap-1">
                        {rowStatus === "pending" && (
                          <Badge variant="outline" className="text-xs">
                            Pendente
                          </Badge>
                        )}
                        {rowStatus === "fulfilled" && (
                          <Badge variant="pending" className="text-xs">
                            Feito
                          </Badge>
                        )}
                        {rowStatus === "partial" && (
                          <Badge variant="secondary" className="text-xs">
                            Parcial
                          </Badge>
                        )}
                        {rowStatus === "complete" && (
                          <Badge variant="success" className="text-xs">
                            Recebido
                          </Badge>
                        )}
                        {rowStatus === "excess" && (
                          <Badge variant="default" className="text-xs">
                            Excesso
                          </Badge>
                        )}
                        {rowStatus === "changed" && (
                          <Badge variant="warning" className="text-xs">
                            Alterado
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Warning for unsaved changes */}
        {hasChanges && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-start gap-3">
            <IconAlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Alterações não salvas</p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Você tem {Object.keys(itemChanges).length} {Object.keys(itemChanges).length === 1 ? "item alterado" : "itens alterados"}. Clique em "Salvar Alterações" para
                confirmar ou "Desfazer" para cancelar.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
