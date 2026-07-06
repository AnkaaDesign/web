import { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useReconciliationCategories } from "@/hooks/financial/use-reconciliation";
import { getAccountingTypeLabel } from "./match-status-badge";
import { formatCurrency } from "@/utils";
import type { BankTransaction, TransactionCategory } from "@/types/reconciliation";

// Fallback group label for categories that have no accounting type yet (e.g.
// freshly created TRANSACTION_ONLY buckets before they're assigned a cost
// group). Keeps them visible at the bottom of the picker rather than dropping
// them.
const NO_ACCOUNTING_GROUP = "Sem grupo contábil";

interface Props {
  /** The transaction being categorized (subject of the editor). */
  transaction: BankTransaction | null;
  /** Selected category ids (controlled by the parent). */
  value: string[];
  onChange: (ids: string[]) => void;
  notes?: string;
  onNotesChange?: (s: string) => void;
  /** Per-category amount split (categoryId → amount), controlled by the parent. */
  allocations?: Record<string, number>;
  onAllocationsChange?: (next: Record<string, number>) => void;
  /** Show the per-category value split when >1 selected (default true). */
  enableSplit?: boolean;
  /** Show the observation input (default true). */
  enableNotes?: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Controlled category editor: one single-select Combobox per chosen category,
 * with a trash button to drop a row and an "add" button to append another —
 * letting the user pick several categories. When more than one is selected, a
 * per-category amount split appears so the user can say how much of the
 * transaction goes to each. Aliases are always learned on save. The selected
 * ids (deduped) live in the parent via `value`/`onChange`.
 */
export function CategoryEditor({
  transaction,
  value,
  onChange,
  notes = "",
  onNotesChange,
  allocations = {},
  onAllocationsChange,
  enableSplit = true,
  enableNotes = true,
}: Props) {
  const { data: categories } = useReconciliationCategories();

  const byId = useMemo(() => {
    const map = new Map<string, TransactionCategory>();
    for (const c of categories ?? []) map.set(c.id, c);
    return map;
  }, [categories]);

  // Options are grouped by accounting type (the chart-of-accounts cost group,
  // up to 13 buckets) instead of the 2 coarse `kind` buckets. Sorting keeps
  // groups together (by their label), then respects each category's sortOrder /
  // name within a group. Categories without an accounting type fall into a
  // trailing "Sem grupo contábil" group.
  const options = useMemo<ComboboxOption[]>(() => {
    const active = (categories ?? []).filter(c => c.isActive);
    const groupOf = (c: TransactionCategory) =>
      getAccountingTypeLabel(c) ?? NO_ACCOUNTING_GROUP;
    const sorted = [...active].sort((a, b) => {
      const ga = groupOf(a);
      const gb = groupOf(b);
      // Push the fallback group to the end; otherwise sort groups alphabetically.
      if (ga !== gb) {
        if (ga === NO_ACCOUNTING_GROUP) return 1;
        if (gb === NO_ACCOUNTING_GROUP) return -1;
        return ga.localeCompare(gb, "pt-BR");
      }
      return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR");
    });
    return sorted.map(c => ({
      value: c.id,
      label: c.name,
      // Cost group shown as the option subtitle so each option reads
      // "category — accounting group".
      description: groupOf(c),
      // The Combobox groups options by `category`; we feed it the cost group.
      category: groupOf(c),
    }));
  }, [categories]);

  const txAmount = Math.abs(Number(transaction?.amount ?? 0));
  const showSplit = enableSplit && value.length > 1 && txAmount > 0;

  // Keep the allocation map in sync with the selected set: prune deselected
  // categories and default newcomers to an even split. Runs only when the
  // split is shown.
  useEffect(() => {
    if (!showSplit) return;
    const even = round2(txAmount / value.length);
    const next = { ...allocations };
    let changed = false;
    for (const k of Object.keys(next)) {
      if (!value.includes(k)) {
        delete next[k];
        changed = true;
      }
    }
    for (const id of value) {
      if (next[id] == null) {
        next[id] = even;
        changed = true;
      }
    }
    if (changed) onAllocationsChange?.(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, txAmount, showSplit]);

  const allocated = value.reduce((sum, id) => sum + (allocations[id] ?? 0), 0);
  const splitOk = Math.abs(allocated - txAmount) < 0.01;

  // One single-select Combobox per chosen category. A row may briefly hold ""
  // while the user is picking; only non-empty, de-duplicated ids reach the
  // parent. We resync from `value` whenever it changes externally (e.g. an NF
  // gets linked, or after a save/refetch) and no longer matches the rows.
  const [rows, setRows] = useState<string[]>(value.length ? value : [""]);
  const valueKey = value.join(",");
  useEffect(() => {
    const selected = rows.filter(Boolean);
    const sameSet =
      selected.length === value.length && selected.every(id => value.includes(id));
    if (!sameSet) setRows(value.length ? value : [""]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueKey]);

  const emitRows = (next: string[]) => {
    setRows(next);
    onChange(Array.from(new Set(next.filter(Boolean))));
  };
  const setRowAt = (i: number, id: string | undefined) =>
    emitRows(rows.map((r, idx) => (idx === i ? id ?? "" : r)));
  const addRow = () => setRows(prev => [...prev, ""]);
  const removeRow = (i: number) => {
    const next = rows.filter((_, idx) => idx !== i);
    emitRows(next.length ? next : [""]);
  };
  // Hide ids already chosen in other rows so the same category can't be picked twice.
  const optionsForRow = (i: number) => {
    const taken = new Set(rows.filter((_, idx) => idx !== i).filter(Boolean));
    return options.filter(o => !taken.has(o.value));
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {rows.map((rowId, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2"
          >
            <div className="flex-1">
              <Combobox
                mode="single"
                value={rowId || undefined}
                onValueChange={v =>
                  setRowAt(i, typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined)
                }
                options={optionsForRow(i)}
                placeholder="Selecione a categoria..."
                searchPlaceholder="Buscar categoria..."
                emptyText="Nenhuma categoria encontrada"
                searchable={true}
                clearable={true}
                triggerClassName="bg-background border-border"
              />
            </div>
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
              aria-label="Remover categoria"
            >
              <IconTrash className="h-4 w-4" />
            </button>
            {i === rows.length - 1 && (
              <button
                type="button"
                onClick={addRow}
                className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Adicionar categoria"
              >
                <IconPlus className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      {showSplit && (
        <div className="space-y-2">
          <Label>Divisão por categoria</Label>
          <div className="space-y-1.5">
            {value.map(id => {
              const cat = byId.get(id);
              if (!cat) return null;
              return (
                <div key={id} className="flex items-center gap-2">
                  <span className="flex-1 truncate text-sm">{cat.name}</span>
                  <div className="relative w-32">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      R$
                    </span>
                    <Input
                      className="pl-7 text-right"
                      inputMode="decimal"
                      value={String(allocations[id] ?? 0)}
                      onChange={v => {
                        const raw = typeof v === "string" ? v : v == null ? "" : String(v);
                        const n = parseFloat(raw.replace(",", ".")) || 0;
                        onAllocationsChange?.({ ...allocations, [id]: n });
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className={`text-xs ${splitOk ? "text-muted-foreground" : "text-amber-600"}`}>
            Alocado: {formatCurrency(allocated)} / {formatCurrency(txAmount)}
            {!splitOk && ` · diferença ${formatCurrency(txAmount - allocated)}`}
          </p>
        </div>
      )}

      {enableNotes && (
        <div className="space-y-2">
          <Label htmlFor="category-notes">Observação (opcional)</Label>
          <Input
            id="category-notes"
            value={notes}
            onChange={v => onNotesChange?.(typeof v === "string" ? v : v == null ? "" : String(v))}
            placeholder="Contexto para auditoria futura"
          />
        </div>
      )}
    </div>
  );
}
