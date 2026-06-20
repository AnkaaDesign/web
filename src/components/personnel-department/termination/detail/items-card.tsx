import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { IconCalculator, IconPlus, IconPencil, IconTrash, IconLoader2, IconReceipt2, IconCoin, IconInfoCircle, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { TERMINATION_ITEM_TYPE_LABELS } from "../../../../constants";
import { formatCurrency } from "../../../../utils";
import type { Termination, TerminationItem, TaxAssistResult } from "../../../../types/termination";
import { useTerminationCalculate, useTerminationComputeTaxes, useTerminationItemDelete } from "../../../../hooks/personnel-department/use-terminations";
import { ItemFormDialog } from "./item-form-dialog";

/**
 * True when the verba description is effectively identical to its type label
 * (case/accent/whitespace-insensitive) — e.g. "Saldo de salário" under the
 * "Saldo de Salário" label. Such echoes add no information and are hidden.
 */
function descriptionEchoesLabel(description: string, label: string): boolean {
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  return normalize(description) === normalize(label);
}

interface ItemsCardProps {
  termination: Termination;
  /** True when the termination is COMPLETED/CANCELLED — blocks every mutation. */
  disabled?: boolean;
  /** Render without the outer Card chrome — used when embedded in a shared card. */
  bare?: boolean;
  className?: string;
}

export function ItemsCard({ termination, disabled = false, bare = false, className }: ItemsCardProps) {
  const calculate = useTerminationCalculate();
  const computeTaxes = useTerminationComputeTaxes();
  const deleteItem = useTerminationItemDelete();

  const [itemDialog, setItemDialog] = useState<{ open: boolean; item: TerminationItem | null }>({ open: false, item: null });
  const [showRecalculateDialog, setShowRecalculateDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<TerminationItem | null>(null);
  const [taxResult, setTaxResult] = useState<TaxAssistResult | null>(null);

  const items = termination.items || [];

  const totals = useMemo(() => {
    const earnings = items.filter((item) => item.amount > 0).reduce((sum, item) => sum + item.amount, 0);
    const discounts = items.filter((item) => item.amount < 0).reduce((sum, item) => sum + Math.abs(item.amount), 0);
    return { earnings, discounts, net: earnings - discounts };
  }, [items]);

  const handleCalculateClick = () => {
    if (items.length > 0) {
      setShowRecalculateDialog(true);
    } else {
      void runCalculate();
    }
  };

  const runCalculate = async () => {
    try {
      await calculate.mutateAsync(termination.id);
      setShowRecalculateDialog(false);
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== "production") {
        console.error("Error calculating termination:", error);
      }
    }
  };

  const runComputeTaxes = async () => {
    try {
      const response = await computeTaxes.mutateAsync(termination.id);
      setTaxResult(response.data ?? null);
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== "production") {
        console.error("Error computing termination taxes:", error);
      }
    }
  };

  const confirmDeleteItem = async () => {
    if (!deleteDialog) return;
    try {
      await deleteItem.mutateAsync(deleteDialog.id);
      setDeleteDialog(null);
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== "production") {
        console.error("Error deleting termination item:", error);
      }
    }
  };

  const calculateButton = (
    <Button variant="default" size="sm" onClick={handleCalculateClick} disabled={disabled || calculate.isPending}>
      {calculate.isPending ? <IconLoader2 className="h-4 w-4 mr-2 animate-spin" /> : <IconCalculator className="h-4 w-4 mr-2" />}
      Calcular
    </Button>
  );

  const computeTaxesButton = (
    <Button variant="outline" size="sm" onClick={runComputeTaxes} disabled={disabled || computeTaxes.isPending}>
      {computeTaxes.isPending ? <IconLoader2 className="h-4 w-4 mr-2 animate-spin" /> : <IconCoin className="h-4 w-4 mr-2" />}
      Calcular impostos
    </Button>
  );

  const addButton = (
    <Button variant="outline" size="sm" onClick={() => setItemDialog({ open: true, item: null })} disabled={disabled}>
      <IconPlus className="h-4 w-4 mr-2" />
      Adicionar Verba
    </Button>
  );

  const taxSuggestion = taxResult && (
    <Popover open onOpenChange={(open) => !open && setTaxResult(null)}>
      <PopoverTrigger asChild>
        <span className="sr-only">Sugestão de impostos</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <IconCoin className="h-4 w-4" />
            Impostos calculados (sugestão)
          </div>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 -mr-1 -mt-1" onClick={() => setTaxResult(null)} title="Fechar">
            <IconX className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-3 space-y-1 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Base INSS (saldo + aviso trabalhado)</span>
            <span className="tabular-nums">{formatCurrency(taxResult.monthlyInssBase)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">INSS sobre verbas mensais</span>
            <span className="tabular-nums">{formatCurrency(taxResult.monthlyInss)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">IRRF sobre verbas mensais</span>
            <span className="tabular-nums">{formatCurrency(taxResult.monthlyIrrf)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Base INSS 13º</span>
            <span className="tabular-nums">{formatCurrency(taxResult.thirteenthInssBase)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">INSS sobre 13º</span>
            <span className="tabular-nums">{formatCurrency(taxResult.thirteenthInss)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">IRRF sobre 13º</span>
            <span className="tabular-nums">{formatCurrency(taxResult.thirteenthIrrf)}</span>
          </div>
          <div className="flex items-center justify-between gap-4 pt-1 mt-1 border-t font-medium">
            <span>Total INSS</span>
            <span className="tabular-nums">{formatCurrency(taxResult.totalInss)}</span>
          </div>
          <div className="flex items-center justify-between gap-4 font-medium">
            <span>Total IRRF</span>
            <span className="tabular-nums">{formatCurrency(taxResult.totalIrrf)}</span>
          </div>
          <div className="flex items-center justify-between gap-4 pt-1 mt-1 border-t">
            <span className="text-muted-foreground">Base da multa do FGTS</span>
            <span className="tabular-nums">{formatCurrency(taxResult.fgtsFineBase)}</span>
          </div>
        </div>
        <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <IconInfoCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          INSS/IRRF incidem apenas sobre verbas tributáveis. Valores são uma sugestão — ajuste em "Adicionar Verba" se necessário.
        </p>
      </PopoverContent>
    </Popover>
  );

  const Wrapper = bare ? "div" : Card;

  return (
    <Wrapper className={cn("flex flex-col", !bare && "shadow-sm border border-border", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <IconReceipt2 className="h-5 w-5 text-muted-foreground" />
            Verbas Rescisórias
          </CardTitle>
          <div className="relative flex items-center gap-2">
            {disabled ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}>{calculateButton}</span>
                  </TooltipTrigger>
                  <TooltipContent>Rescisões concluídas ou canceladas não podem ser recalculadas.</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}>{computeTaxesButton}</span>
                  </TooltipTrigger>
                  <TooltipContent>Rescisões concluídas ou canceladas não podem ser recalculadas.</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}>{addButton}</span>
                  </TooltipTrigger>
                  <TooltipContent>Não é possível adicionar verbas a rescisões concluídas ou canceladas.</TooltipContent>
                </Tooltip>
              </>
            ) : (
              <>
                {calculateButton}
                {computeTaxesButton}
                {addButton}
              </>
            )}
            <div className="absolute right-0 top-full">{taxSuggestion}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
            <IconCalculator className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <div className="text-sm font-medium">Nenhuma verba calculada</div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Verba</TableHead>
                <TableHead className="text-right w-32">Valor</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{TERMINATION_ITEM_TYPE_LABELS[item.type] || item.type}</span>
                      {item.isCustom && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          Manual
                        </Badge>
                      )}
                    </div>
                    {item.isCustom && item.description && !descriptionEchoesLabel(item.description, TERMINATION_ITEM_TYPE_LABELS[item.type] || item.type) && (
                      <div className="text-xs text-muted-foreground mt-0.5">{item.description}</div>
                    )}
                  </TableCell>
                  <TableCell className={cn("text-right text-sm font-medium tabular-nums", item.amount < 0 && "text-destructive")}>
                    {item.amount < 0 ? `-${formatCurrency(Math.abs(item.amount))}` : formatCurrency(item.amount)}
                  </TableCell>
                  <TableCell>
                    {item.isCustom && (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          disabled={disabled}
                          onClick={() => setItemDialog({ open: true, item })}
                          title="Editar verba"
                        >
                          <IconPencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          disabled={disabled}
                          onClick={() => setDeleteDialog(item)}
                          title="Excluir verba"
                        >
                          <IconTrash className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="border-t-0 hover:bg-transparent">
                <TableCell className="py-1 text-right text-sm text-muted-foreground">
                  Proventos
                </TableCell>
                <TableCell className="py-1 text-right text-sm tabular-nums">{formatCurrency(totals.earnings)}</TableCell>
                <TableCell className="py-1" />
              </TableRow>
              <TableRow className="border-t-0 hover:bg-transparent">
                <TableCell className="py-1 text-right text-sm text-muted-foreground">
                  Descontos
                </TableCell>
                <TableCell className="py-1 text-right text-sm tabular-nums text-destructive">-{formatCurrency(totals.discounts)}</TableCell>
                <TableCell className="py-1" />
              </TableRow>
              <TableRow className="hover:bg-transparent">
                <TableCell className="py-1.5 text-right text-base font-bold">
                  Líquido
                </TableCell>
                <TableCell className={cn("py-1.5 text-right text-base font-bold tabular-nums", totals.net < 0 && "text-destructive")}>
                  {totals.net < 0 ? `-${formatCurrency(Math.abs(totals.net))}` : formatCurrency(totals.net)}
                </TableCell>
                <TableCell className="py-1.5" />
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </CardContent>

      {/* Add / Edit custom item */}
      <ItemFormDialog
        open={itemDialog.open}
        onOpenChange={(open) => setItemDialog((prev) => ({ open, item: open ? prev.item : null }))}
        terminationId={termination.id}
        item={itemDialog.item}
      />

      {/* Recalculate confirmation */}
      <AlertDialog open={showRecalculateDialog} onOpenChange={setShowRecalculateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recalcular verbas</AlertDialogTitle>
            <AlertDialogDescription>Recalcular substituirá as verbas calculadas automaticamente. Verbas manuais serão mantidas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={runCalculate} disabled={calculate.isPending}>
              Recalcular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete custom item confirmation */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir verba</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a verba "{deleteDialog ? TERMINATION_ITEM_TYPE_LABELS[deleteDialog.type] || deleteDialog.type : ""}"? Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteItem} disabled={deleteItem.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Wrapper>
  );
}
