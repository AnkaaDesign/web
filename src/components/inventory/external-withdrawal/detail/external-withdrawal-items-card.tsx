import { useState, useCallback, useMemo } from "react";
import { IconPackage, IconCurrencyReal, IconTag, IconCategory, IconBoxMultiple, IconCheck, IconDeviceFloppy, IconReload, IconAlertCircle } from "@tabler/icons-react";
import type { ExternalWithdrawal, ExternalWithdrawalItem } from "../../../../types";
import { EXTERNAL_WITHDRAWAL_STATUS, EXTERNAL_WITHDRAWAL_TYPE } from "../../../../constants";
import { formatCurrency } from "../../../../utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { cn } from "@/lib/utils";
import { useBatchUpdateExternalWithdrawalItems } from "../../../../hooks";
import { toast } from "sonner";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";

interface ExternalWithdrawalItemsCardProps {
  withdrawal: ExternalWithdrawal;
  className?: string;
  onWithdrawalUpdate?: () => void;
}

interface ItemChanges {
  [itemId: string]: {
    returnedQuantity: number;
    isComplete: boolean;
  };
}

interface SelectedItems {
  [itemId: string]: boolean;
}

export function ExternalWithdrawalItemsCard({ withdrawal, className, onWithdrawalUpdate }: ExternalWithdrawalItemsCardProps) {
  const { mutateAsync: batchUpdateItems } = useBatchUpdateExternalWithdrawalItems();

  // Track changes to items
  const [itemChanges, setItemChanges] = useState<ItemChanges>({});
  const [selectedItems, setSelectedItems] = useState<SelectedItems>({});
  const [isSaving, setIsSaving] = useState(false);

  // Check if withdrawal allows inline editing
  const canEditItems = withdrawal.type === EXTERNAL_WITHDRAWAL_TYPE.RETURNABLE && [EXTERNAL_WITHDRAWAL_STATUS.PENDING, EXTERNAL_WITHDRAWAL_STATUS.PARTIALLY_RETURNED].includes(withdrawal.status);

  // Check withdrawal type for conditional rendering
  const isReturnable = withdrawal.type === EXTERNAL_WITHDRAWAL_TYPE.RETURNABLE;

  // Check if there are unsaved changes
  const hasChanges = useMemo(() => {
    return Object.keys(itemChanges).length > 0;
  }, [itemChanges]);

  const items = withdrawal.items || [];

  // Get the current value for an item (either changed or original)
  const getItemValue = useCallback(
    (item: ExternalWithdrawalItem) => {
      if (itemChanges[item.id]) {
        return itemChanges[item.id];
      }
      return {
        returnedQuantity: item.returnedQuantity || 0,
        isComplete: item.returnedQuantity === item.withdrawedQuantity,
      };
    },
    [itemChanges],
  );

  // Handle quantity change
  const handleQuantityChange = useCallback(
    (itemId: string, value: string) => {
      const numValue = parseFloat(value) || 0;
      const item = items.find((i) => i.id === itemId);
      if (!item) return;

      const newQuantity = Math.max(0, Math.min(numValue, item.withdrawedQuantity));
      const isComplete = newQuantity === item.withdrawedQuantity;

      setItemChanges((prev) => ({
        ...prev,
        [itemId]: {
          returnedQuantity: newQuantity,
          isComplete,
        },
      }));
    },
    [items],
  );

  // Handle selection
  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        const allSelected: SelectedItems = {};
        items.forEach((item) => {
          allSelected[item.id] = true;
        });
        setSelectedItems(allSelected);
      } else {
        setSelectedItems({});
      }
    },
    [items],
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
    return items.length > 0 && selectedCount === items.length;
  }, [selectedCount, items.length]);

  const someSelected = useMemo(() => {
    return selectedCount > 0 && selectedCount < items.length;
  }, [selectedCount, items.length]);

  // Batch mark selected as returned
  const handleBatchMarkReturned = useCallback(async () => {
    const itemsToReturn = Object.keys(selectedItems)
      .filter((id) => selectedItems[id])
      .map((id) => {
        const item = items.find((i) => i.id === id);
        return {
          id,
          data: {
            returnedQuantity: item?.withdrawedQuantity || 0,
          },
        };
      });

    if (itemsToReturn.length === 0) {
      toast.error("Selecione pelo menos um item");
      return;
    }

    try {
      await batchUpdateItems({
        externalWithdrawalItems: itemsToReturn,
      });
      toast.success("Itens marcados como devolvidos com sucesso");
      onWithdrawalUpdate?.();
      setSelectedItems({});
    } catch (error) {
      toast.error("Erro ao marcar itens como devolvidos");
    }
  }, [selectedItems, items, batchUpdateItems, onWithdrawalUpdate]);

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
      const batchUpdateData = {
        externalWithdrawalItems: Object.entries(itemChanges).map(([itemId, changes]) => ({
          id: itemId,
          data: {
            returnedQuantity: changes.returnedQuantity,
          },
        })),
      };
      await batchUpdateItems(batchUpdateData);

      toast.success("Quantidades devolvidas atualizadas com sucesso!");
      setItemChanges({});

      // Trigger withdrawal refresh
      if (onWithdrawalUpdate) {
        onWithdrawalUpdate();
      }
    } catch (error) {
      toast.error("Erro ao atualizar quantidades devolvidas");
      if (process.env.NODE_ENV !== "production") {
        console.error("Error updating withdrawal items:", error);
      }
    } finally {
      setIsSaving(false);
    }
  }, [itemChanges, hasChanges, batchUpdateItems, onWithdrawalUpdate]);

  // Calculate summary statistics
  const summary = useMemo(() => {
    let totalWithdrawed = 0;
    let totalReturned = 0;
    let totalValue = 0;
    let returnedValue = 0;

    items.forEach((item) => {
      const currentValues = getItemValue(item);
      const itemTotal = (item.withdrawedQuantity || 0) * (item.price || 0);
      const itemReturnedTotal = currentValues.returnedQuantity * (item.price || 0);

      totalWithdrawed += item.withdrawedQuantity || 0;
      totalReturned += currentValues.returnedQuantity;
      totalValue += itemTotal;
      returnedValue += itemReturnedTotal;
    });

    return {
      itemCount: items.length,
      totalWithdrawed,
      totalReturned,
      totalValue,
      returnedValue,
      percentComplete: totalWithdrawed > 0 ? (totalReturned / totalWithdrawed) * 100 : 0,
    };
  }, [items, getItemValue]);

  // Get row status for external withdrawal items
  const getRowStatus = useCallback(
    (item: ExternalWithdrawalItem) => {
      // For non-returnable types, show status based on withdrawal status
      if (!isReturnable) {
        if (withdrawal.status === EXTERNAL_WITHDRAWAL_STATUS.DELIVERED) {
          return "delivered";
        } else if (withdrawal.status === EXTERNAL_WITHDRAWAL_STATUS.CHARGED) {
          return "charged";
        } else if (withdrawal.status === EXTERNAL_WITHDRAWAL_STATUS.LIQUIDATED) {
          return "liquidated";
        } else if (withdrawal.status === EXTERNAL_WITHDRAWAL_STATUS.CANCELLED) {
          return "cancelled";
        }
        return "pending";
      }

      // For returnable types, show status based on returned quantities
      const current = getItemValue(item);

      if (itemChanges[item.id]) {
        return "changed";
      } else if (current.returnedQuantity === 0) {
        return "pending";
      } else if (current.returnedQuantity === item.withdrawedQuantity) {
        return "complete";
      } else if (current.returnedQuantity > item.withdrawedQuantity) {
        return "excess";
      } else {
        return "partial";
      }
    },
    [itemChanges, getItemValue, isReturnable, withdrawal.status],
  );

  if (items.length === 0) {
    return (
      <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
        <CardHeader className="pb-6">
          <CardTitle className="flex items-center gap-2">
          <IconPackage className="h-5 w-5 text-muted-foreground" />
          Itens da Retirada
        </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground bg-muted/30 rounded-lg p-4">
            <IconPackage className="h-4 w-4" />
            <p className="text-sm">Nenhum item encontrado</p>
          </div>
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
          Itens da Retirada
        </CardTitle>
          <Badge variant="secondary" className="text-sm">
            {summary.itemCount} {summary.itemCount === 1 ? "item" : "itens"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-1 space-y-6 pb-24">
        {/* Summary Statistics */}
        <div className={cn("grid gap-4 grid-cols-1 sm:grid-cols-2", isReturnable ? "lg:grid-cols-4" : "lg:grid-cols-2")}>
          <div className="bg-muted/50 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <IconBoxMultiple className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Quantidade Retirada</span>
            </div>
            <span className="text-lg font-semibold text-foreground">{summary.totalWithdrawed.toLocaleString("pt-BR")}</span>
          </div>

          {isReturnable && (
            <div className="bg-muted/50 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <IconCheck className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Quantidade Devolvida</span>
              </div>
              <span className="text-lg font-semibold text-foreground">{summary.totalReturned.toLocaleString("pt-BR")}</span>
            </div>
          )}

          <div className="bg-muted/50 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <IconCurrencyReal className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Valor Total</span>
            </div>
            <span className="text-lg font-semibold text-foreground">{formatCurrency(summary.totalValue)}</span>
          </div>

          {isReturnable && (
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
          )}
        </div>

        {/* Action Buttons */}
        {canEditItems && (
          <div className="flex flex-wrap gap-2">
            {selectedCount > 0 && (
              <Button variant="outline" size="sm" onClick={handleBatchMarkReturned} disabled={isSaving}>
                <IconCheck className="mr-2 h-4 w-4" />
                Marcar como Devolvidos ({selectedCount})
              </Button>
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
          </div>
        )}

        {/* Items Table */}
        <div className="border rounded-lg overflow-hidden dark:border-border">
          <Table>
            <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
              <TableRow className="bg-muted hover:bg-muted even:bg-muted">
                {isReturnable && (
                  <TableHead className={cn(TABLE_LAYOUT.checkbox.className, "whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0")}>
                    <div className="flex items-center justify-center h-full w-full px-2">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all items"
                        className={cn("h-4 w-4", someSelected && "data-[state=checked]:bg-muted data-[state=checked]:text-muted-foreground ")}
                        disabled={!canEditItems || items.length === 0}
                      />
                    </div>
                  </TableHead>
                )}
                <TableHead>Item</TableHead>
                <TableHead className="text-center">Qtd. Retirada</TableHead>
                {isReturnable && <TableHead className="text-center">Qtd. Devolvida</TableHead>}
                <TableHead className="text-right">Preço Unit.</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((withdrawalItem) => {
                const { item } = withdrawalItem;
                const currentValues = getItemValue(withdrawalItem);
                const rowStatus = getRowStatus(withdrawalItem);
                const itemTotal = (withdrawalItem.withdrawedQuantity || 0) * (withdrawalItem.price || 0);
                const isSelected = selectedItems[withdrawalItem.id] || false;

                // Build item display name with unicode
                const itemDisplayName = item ? (item.uniCode ? `${item.uniCode} - ${item.name}` : item.name) : "Item não encontrado";

                return (
                  <TableRow
                    key={withdrawalItem.id}
                    className={cn(
                      "transition-colors",
                      rowStatus === "changed" && "bg-yellow-50 dark:bg-yellow-900/20",
                      rowStatus === "complete" && "bg-green-50/50 dark:bg-green-900/10",
                      rowStatus === "partial" && "bg-orange-50/50 dark:bg-orange-900/10",
                      rowStatus === "excess" && "bg-blue-50/50 dark:bg-blue-900/10",
                      rowStatus === "delivered" && "bg-green-50/50 dark:bg-green-900/10",
                      rowStatus === "charged" && "bg-blue-50/50 dark:bg-blue-900/10",
                      rowStatus === "liquidated" && "bg-green-50/50 dark:bg-green-900/10",
                      isSelected && "bg-accent",
                    )}
                  >
                    {isReturnable && (
                      <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                        <div className="flex items-center justify-center h-full w-full px-2 py-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => handleSelectItem(withdrawalItem.id, checked as boolean)}
                            aria-label={`Select ${item?.name || "item"}`}
                            className="h-4 w-4"
                            disabled={!canEditItems}
                          />
                        </div>
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <TruncatedTextWithTooltip text={itemDisplayName} className="font-medium text-sm" />
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {item?.categoryId && (
                            <span className="flex items-center gap-1">
                              <IconCategory className="h-3 w-3" />
                              {item?.category?.name || "Categoria"}
                            </span>
                          )}
                          {item?.brandId && (
                            <span className="flex items-center gap-1">
                              <IconTag className="h-3 w-3" />
                              {item?.brand?.name || "Marca"}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-mono text-sm">{withdrawalItem.withdrawedQuantity || 0}</span>
                    </TableCell>
                    {isReturnable && (
                      <TableCell className="text-center">
                        {canEditItems ? (
                          <div className="flex justify-center">
                            <Input
                              type="decimal"
                              decimals={2}
                              value={currentValues.returnedQuantity}
                              onChange={(value) => handleQuantityChange(withdrawalItem.id, value?.toString() || "0")}
                              disabled={isSaving}
                              min={0}
                              max={withdrawalItem.withdrawedQuantity}
                              className={cn(
                                "w-20 h-8 text-center font-mono text-sm",
                                currentValues.returnedQuantity > withdrawalItem.withdrawedQuantity && "text-blue-600 dark:text-blue-400",
                                currentValues.returnedQuantity === withdrawalItem.withdrawedQuantity && "text-green-600 dark:text-green-400",
                                currentValues.returnedQuantity > 0 && currentValues.returnedQuantity < withdrawalItem.withdrawedQuantity && "text-orange-600 dark:text-orange-400",
                              )}
                            />
                          </div>
                        ) : (
                          <span className={cn("font-mono text-sm", withdrawalItem.returnedQuantity === withdrawalItem.withdrawedQuantity && "text-green-600 dark:text-green-400")}>
                            {withdrawalItem.returnedQuantity || 0}
                          </span>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <span className="font-mono text-sm">{formatCurrency(withdrawalItem.price || 0)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-mono text-sm font-medium">{formatCurrency(itemTotal)}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      {rowStatus === "pending" && (
                        <Badge variant="outline" className="text-xs">
                          Pendente
                        </Badge>
                      )}
                      {rowStatus === "partial" && (
                        <Badge variant="secondary" className="text-xs">
                          Parcial
                        </Badge>
                      )}
                      {rowStatus === "complete" && (
                        <Badge variant="success" className="text-xs">
                          Devolvido
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
                      {rowStatus === "delivered" && (
                        <Badge variant="success" className="text-xs">
                          Entregue
                        </Badge>
                      )}
                      {rowStatus === "charged" && (
                        <Badge variant="default" className="text-xs">
                          Cobrado
                        </Badge>
                      )}
                      {rowStatus === "liquidated" && (
                        <Badge variant="success" className="text-xs">
                          Liquidado
                        </Badge>
                      )}
                      {rowStatus === "cancelled" && (
                        <Badge variant="destructive" className="text-xs">
                          Cancelado
                        </Badge>
                      )}
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
