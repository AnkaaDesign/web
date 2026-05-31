import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CategoryEditor } from "./category-editor";
import type {
  BankTransaction,
  ChangeCategoryPayload,
} from "@/types/reconciliation";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: BankTransaction | null;
  onConfirm: (payload: ChangeCategoryPayload) => void;
  isLoading?: boolean;
}

export function CategoryPickerDialog({
  open,
  onOpenChange,
  transaction,
  onConfirm,
  isLoading,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open && transaction) {
      setSelectedIds([...new Set(transaction.categories?.map(c => c.categoryId) ?? [])]);
      // Seed allocations from any existing per-category amounts.
      const seed: Record<string, number> = {};
      for (const c of transaction.categories ?? []) {
        if (c.allocatedAmount != null) seed[c.categoryId] = Math.abs(Number(c.allocatedAmount));
      }
      setAllocations(seed);
      setNotes("");
    }
  }, [open, transaction]);

  const handleSubmit = () => {
    if (selectedIds.length === 0) return;
    onConfirm({
      categoryIds: selectedIds,
      allocations:
        selectedIds.length > 1
          ? selectedIds.map(id => ({ categoryId: id, allocatedAmount: allocations[id] ?? 0 }))
          : undefined,
      // Always learn an alias from a manual categorization.
      saveAlias: true,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Alterar categorias</DialogTitle>
          <DialogDescription>
            Atribua uma ou mais categorias a esta transação. Uma categoria de
            transação "auto-conciliante" (ex.: Aluguel, Tarifa) dispensa a nota
            fiscal — a transação é conciliada por estar classificada.
          </DialogDescription>
        </DialogHeader>

        <CategoryEditor
          transaction={transaction}
          value={selectedIds}
          onChange={setSelectedIds}
          notes={notes}
          onNotesChange={setNotes}
          allocations={allocations}
          onAllocationsChange={setAllocations}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={selectedIds.length === 0 || isLoading}>
            {isLoading ? "Salvando..." : "Confirmar categorias"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
