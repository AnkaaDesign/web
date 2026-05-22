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
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type {
  BankTransaction,
  ChangeCategoryPayload,
  ReconciliationCategory,
} from "@/types/reconciliation";
import { CATEGORY_LABEL } from "./match-status-badge";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: BankTransaction | null;
  onConfirm: (payload: ChangeCategoryPayload) => void;
  isLoading?: boolean;
}

const CATEGORY_OPTIONS: Array<{ value: ReconciliationCategory; label: string }> = (
  [
    "NF",
    "TRIBUTO",
    "FOLHA",
    "TRANSFERENCIA",
    "TARIFA_BANCARIA",
    "CONVENIO",
    "PRO_LABORE",
    "ALUGUEL",
    "ESTORNO",
    "OUTROS",
    "UNCLASSIFIED",
  ] as ReconciliationCategory[]
).map(c => ({ value: c, label: CATEGORY_LABEL[c] }));

export function CategoryPickerDialog({
  open,
  onOpenChange,
  transaction,
  onConfirm,
  isLoading,
}: Props) {
  const [category, setCategory] = useState<ReconciliationCategory | "">("");
  const [saveAlias, setSaveAlias] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open && transaction) {
      setCategory(transaction.category ?? "");
      setSaveAlias(false);
      setNotes("");
    }
  }, [open, transaction]);

  const handleSubmit = () => {
    if (!category) return;
    onConfirm({
      category: category as ReconciliationCategory,
      saveAlias,
      notes: notes.trim() || undefined,
    });
  };

  // The "save alias" toggle only makes sense when we actually have a memo +
  // counterparty CNPJ to learn from. Without those the alias write would no-op
  // server-side anyway; hide the checkbox to set expectations.
  const aliasAvailable = Boolean(
    transaction?.memo && transaction?.counterpartyCnpjCpf,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alterar categoria</DialogTitle>
          <DialogDescription>
            Atribua uma categoria a esta transação. Categorias diferentes de NF
            são auto-conciliadas (não precisam de nota fiscal).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Combobox
              value={category}
              onValueChange={v => setCategory((v as ReconciliationCategory) ?? "")}
              options={CATEGORY_OPTIONS}
              placeholder="Selecione a categoria..."
              searchable={true}
              clearable={false}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observação (opcional)</Label>
            <Input
              id="notes"
              value={notes}
              onChange={v => setNotes(typeof v === "string" ? v : v == null ? "" : String(v))}
              placeholder="Contexto para auditoria futura"
            />
          </div>

          {aliasAvailable && (
            <label className="flex items-start gap-2 cursor-pointer text-sm">
              <Checkbox
                checked={saveAlias}
                onCheckedChange={v => setSaveAlias(v === true)}
                className="mt-0.5"
              />
              <span className="text-muted-foreground">
                Salvar para futuras transações do mesmo fornecedor (cria alias)
              </span>
            </label>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!category || isLoading}>
            {isLoading ? "Salvando..." : "Confirmar categoria"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
