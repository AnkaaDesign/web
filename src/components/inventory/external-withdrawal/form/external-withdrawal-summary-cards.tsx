import React from "react";
import { IconUser, IconFileText, IconPackage, IconHash, IconBoxMultiple, IconCurrencyReal, IconArrowBack, IconTag, IconCategory } from "@tabler/icons-react";
import type { Item } from "../../../../types";
import { MEASURE_UNIT_LABELS } from "../../../../constants";
import { formatCurrency } from "../../../../utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { cn } from "@/lib/utils";

interface ExternalWithdrawalSummaryCardsProps {
  // Basic info
  withdrawerName: string;
  type: EXTERNAL_WITHDRAWAL_TYPE;
  notes?: string;

  // Selected items with their data
  selectedItems: Map<string, Item & { quantity: number; unitPrice?: number }>;

  // Styling
  className?: string;
}

export const ExternalWithdrawalSummaryCards: React.FC<ExternalWithdrawalSummaryCardsProps> = ({ withdrawerName, type, notes, selectedItems, className }) => {
  // Calculate totals
  const totalItems = selectedItems.size;
  const totalQuantity = Array.from(selectedItems.values()).reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = type === EXTERNAL_WITHDRAWAL_TYPE.CHARGEABLE ? Array.from(selectedItems.values()).reduce((sum, item) => sum + item.quantity * (item.unitPrice || 0), 0) : 0;

  return (
    <div className={cn("space-y-6", className)}>
      {/* Basic Info Summary Card */}
      <BasicInfoSummaryCard withdrawerName={withdrawerName} willReturn={willReturn} notes={notes} />

      {/* Items Summary Card */}
      <ItemsSummaryCard selectedItems={selectedItems} willReturn={willReturn} totalItems={totalItems} totalQuantity={totalQuantity} />

      {/* Total Calculation Card (only for non-returnable items) */}
      {type === EXTERNAL_WITHDRAWAL_TYPE.CHARGEABLE && <TotalCalculationCard selectedItems={selectedItems} totalValue={totalValue} totalItems={totalItems} totalQuantity={totalQuantity} />}
    </div>
  );
};

// Basic Info Summary Card Component
interface BasicInfoSummaryCardProps {
  withdrawerName: string;
  type: EXTERNAL_WITHDRAWAL_TYPE;
  notes?: string;
  className?: string;
}

export const BasicInfoSummaryCard: React.FC<BasicInfoSummaryCardProps> = ({ withdrawerName, type, notes, className }) => {
  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2">
          <IconUser className="h-5 w-5 text-muted-foreground" />
          Informações da Retirada
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-4">
          {/* Withdrawer Information */}
          <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
            <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <IconUser className="h-4 w-4" />
              Nome do Retirador
            </span>
            <span className="text-sm font-semibold text-foreground">{withdrawerName}</span>
          </div>

          {/* Return Type */}
          <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
            <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <IconArrowBack className="h-4 w-4" />
              Tipo de Retirada
            </span>
            <Badge variant={type === EXTERNAL_WITHDRAWAL_TYPE.RETURNABLE ? "success" : type === EXTERNAL_WITHDRAWAL_TYPE.CHARGEABLE ? "destructive" : "secondary"}>
              {type === EXTERNAL_WITHDRAWAL_TYPE.RETURNABLE ? "Devolutivo" : type === EXTERNAL_WITHDRAWAL_TYPE.CHARGEABLE ? "Cobrável" : "Cortesia"}
            </Badge>
          </div>

          {/* Notes */}
          {notes && (
            <div className="bg-muted/50 rounded-lg px-4 py-3">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-2">
                <IconFileText className="h-4 w-4" />
                Observações
              </span>
              <p className="text-sm text-foreground leading-relaxed">{notes}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Items Summary Card Component
interface ItemsSummaryCardProps {
  selectedItems: Map<string, Item & { quantity: number; unitPrice?: number }>;
  type: EXTERNAL_WITHDRAWAL_TYPE;
  totalItems: number;
  totalQuantity: number;
  className?: string;
}

export const ItemsSummaryCard: React.FC<ItemsSummaryCardProps> = ({ selectedItems, type, totalItems, totalQuantity, className }) => {
  const items = Array.from(selectedItems.values());

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
            <p className="text-sm">Nenhum item selecionado</p>
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
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="px-3 py-1">
              {totalItems} {totalItems === 1 ? "item" : "itens"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-6">
          {/* Summary Section */}
          <div>
            <h3 className="text-base font-semibold mb-4 text-foreground">Resumo dos Itens</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/50 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <IconHash className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Total de Itens</span>
                </div>
                <span className="text-lg font-semibold text-foreground">{totalItems}</span>
              </div>

              <div className="bg-muted/50 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <IconBoxMultiple className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Quantidade Total</span>
                </div>
                <span className="text-lg font-semibold text-foreground">
                  {totalQuantity % 1 === 0 ? totalQuantity.toLocaleString("pt-BR") : totalQuantity.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Items Table Section */}
          <div className="pt-6 border-t border-border/50">
            <h3 className="text-base font-semibold mb-4 text-foreground">Lista de Itens</h3>
            <div className="border rounded-lg overflow-hidden bg-white dark:bg-gray-950">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="w-20">Qtd</TableHead>
                    {type === EXTERNAL_WITHDRAWAL_TYPE.CHARGEABLE && (
                      <>
                        <TableHead className="w-28">Preço Unit.</TableHead>
                        <TableHead className="w-28">Total</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const itemTotal = type === EXTERNAL_WITHDRAWAL_TYPE.CHARGEABLE ? item.quantity * (item.unitPrice || 0) : 0;

                    return (
                      <TableRow key={item.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">
                              <TruncatedTextWithTooltip text={item.uniCode ? `${item.uniCode} - ${item.name}` : item.name} />
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {item.category && (
                                <>
                                  <IconCategory className="inline h-3 w-3 mr-1" />
                                  {item.category.name}
                                </>
                              )}
                              {item.category && item.brand && <span className="mx-1">•</span>}
                              {item.brand && (
                                <>
                                  <IconTag className="inline h-3 w-3 mr-1" />
                                  {item.brand.name}
                                </>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">
                            {item.quantity % 1 === 0
                              ? item.quantity.toLocaleString("pt-BR")
                              : item.quantity.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            {item.measureUnit && (
                              <div className="text-xs text-muted-foreground">{MEASURE_UNIT_LABELS[item.measureUnit as keyof typeof MEASURE_UNIT_LABELS] || ""}</div>
                            )}
                          </div>
                        </TableCell>
                        {type === EXTERNAL_WITHDRAWAL_TYPE.CHARGEABLE && (
                          <>
                            <TableCell>
                              <div className="text-sm font-medium">{formatCurrency(item.unitPrice || 0)}</div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm font-semibold">{formatCurrency(itemTotal)}</div>
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Total Calculation Card Component
interface TotalCalculationCardProps {
  selectedItems: Map<string, Item & { quantity: number; unitPrice?: number }>;
  totalValue: number;
  totalItems: number;
  totalQuantity: number;
  className?: string;
}

export const TotalCalculationCard: React.FC<TotalCalculationCardProps> = ({ selectedItems, totalValue, totalItems, totalQuantity, className }) => {
  const items = Array.from(selectedItems.values());
  const averageValue = totalQuantity > 0 ? totalValue / totalQuantity : 0;

  // Check if any items don't have prices set
  const itemsWithoutPrice = items.filter((item) => !item.unitPrice || item.unitPrice <= 0);
  const hasItemsWithoutPrice = itemsWithoutPrice.length > 0;

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-2">
          <IconCurrencyReal className="h-5 w-5 text-muted-foreground" />
          Cálculo do Total
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="space-y-6">
          {/* Summary statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-primary">{totalItems}</div>
              <div className="text-xs text-muted-foreground">{totalItems === 1 ? "Item" : "Itens"}</div>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-primary">
                {totalQuantity % 1 === 0 ? totalQuantity.toLocaleString("pt-BR") : totalQuantity.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-muted-foreground">Quantidade Total</div>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totalValue)}</div>
              <div className="text-xs text-muted-foreground">Total Geral</div>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{formatCurrency(averageValue)}</div>
              <div className="text-xs text-muted-foreground">Valor Médio</div>
            </div>
          </div>

          <Separator />

          {/* Grand total highlight */}
          <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-base font-medium text-green-800 dark:text-green-200">Total da Retirada:</span>
              <span className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totalValue)}</span>
            </div>
          </div>

          {/* Warning if no price set */}
          {hasItemsWithoutPrice && (
            <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="text-sm text-yellow-800 dark:text-yellow-200">
                <span className="font-enhanced-unicode">⚠️</span> {itemsWithoutPrice.length} {itemsWithoutPrice.length === 1 ? "item não possui" : "itens não possuem"} preço
                definido
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
