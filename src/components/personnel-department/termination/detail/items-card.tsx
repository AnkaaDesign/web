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
import { IconCalculator, IconPlus, IconPencil, IconTrash, IconLoader2, IconReceipt2 } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { TERMINATION_ITEM_TYPE_LABELS } from "../../../../constants";
import { formatCurrency } from "../../../../utils";
import type { Termination, TerminationItem } from "../../../../types/termination";
import { useTerminationCalculate, useTerminationItemDelete } from "../../../../hooks/personnel-department/use-terminations";
import { ItemFormDialog } from "./item-form-dialog";

interface ItemsCardProps {
  termination: Termination;
  /** True when the termination is COMPLETED/CANCELLED — blocks every mutation. */
  disabled?: boolean;
  className?: string;
}

export function ItemsCard({ termination, disabled = false, className }: ItemsCardProps) {
  const calculate = useTerminationCalculate();
  const deleteItem = useTerminationItemDelete();

  const [itemDialog, setItemDialog] = useState<{ open: boolean; item: TerminationItem | null }>({ open: false, item: null });
  const [showRecalculateDialog, setShowRecalculateDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<TerminationItem | null>(null);

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
    <Button variant="outline" size="sm" onClick={handleCalculateClick} disabled={disabled || calculate.isPending}>
      {calculate.isPending ? <IconLoader2 className="h-4 w-4 mr-2 animate-spin" /> : <IconCalculator className="h-4 w-4 mr-2" />}
      Calcular
    </Button>
  );

  const addButton = (
    <Button variant="default" size="sm" onClick={() => setItemDialog({ open: true, item: null })} disabled={disabled}>
      <IconPlus className="h-4 w-4 mr-2" />
      Adicionar Verba
    </Button>
  );

  return (
    <Card className={cn("shadow-sm border border-border flex flex-col", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <IconReceipt2 className="h-5 w-5 text-muted-foreground" />
            Verbas Rescisórias
          </CardTitle>
          <div className="flex items-center gap-2">
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
                    <span tabIndex={0}>{addButton}</span>
                  </TooltipTrigger>
                  <TooltipContent>Não é possível adicionar verbas a rescisões concluídas ou canceladas.</TooltipContent>
                </Tooltip>
              </>
            ) : (
              <>
                {calculateButton}
                {addButton}
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
            <IconCalculator className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <div className="text-base font-medium mb-1">Nenhuma verba calculada</div>
            <div className="text-sm">Use o botão "Calcular" para gerar as verbas automaticamente ou adicione verbas manuais.</div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[220px]">Verba</TableHead>
                <TableHead className="text-right w-28">Referência</TableHead>
                <TableHead className="text-right w-32">Base</TableHead>
                <TableHead className="text-right w-36">Valor</TableHead>
                <TableHead className="w-20"></TableHead>
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
                    {item.description && <div className="text-xs text-muted-foreground mt-0.5">{item.description}</div>}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{item.referenceQuantity ?? "-"}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{item.baseValue != null ? formatCurrency(item.baseValue) : "-"}</TableCell>
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
              <TableRow>
                <TableCell colSpan={3} className="text-right text-sm">
                  Proventos
                </TableCell>
                <TableCell className="text-right text-sm font-medium tabular-nums">{formatCurrency(totals.earnings)}</TableCell>
                <TableCell />
              </TableRow>
              <TableRow>
                <TableCell colSpan={3} className="text-right text-sm">
                  Descontos
                </TableCell>
                <TableCell className="text-right text-sm font-medium tabular-nums text-destructive">-{formatCurrency(totals.discounts)}</TableCell>
                <TableCell />
              </TableRow>
              <TableRow>
                <TableCell colSpan={3} className="text-right text-sm font-semibold">
                  Líquido
                </TableCell>
                <TableCell className={cn("text-right text-sm font-semibold tabular-nums", totals.net < 0 && "text-destructive")}>
                  {totals.net < 0 ? `-${formatCurrency(Math.abs(totals.net))}` : formatCurrency(totals.net)}
                </TableCell>
                <TableCell />
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
    </Card>
  );
}
