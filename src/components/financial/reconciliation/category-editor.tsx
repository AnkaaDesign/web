import { useEffect, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { IconX } from "@tabler/icons-react";
import { useReconciliationCategories } from "@/hooks/financial/use-reconciliation";
import { getCategoryTextColor, getAccountingTypeLabel } from "./match-status-badge";
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
  notes: string;
  onNotesChange: (s: string) => void;
  /** Per-category amount split (categoryId → amount), controlled by the parent. */
  allocations: Record<string, number>;
  onAllocationsChange: (next: Record<string, number>) => void;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Controlled category editor: a grouped multi-select Combobox + a single row of
 * removable selected chips (the Combobox's own badges are hidden to avoid
 * duplication). When more than one category is selected, a per-category amount
 * split appears so the user can say how much of the transaction goes to each.
 * Aliases are always learned on save. State lives in the parent.
 */
export function CategoryEditor({
  transaction,
  value,
  onChange,
  notes,
  onNotesChange,
  allocations,
  onAllocationsChange,
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
      // The Combobox groups options by `category`; we feed it the cost group.
      category: groupOf(c),
    }));
  }, [categories]);

  const txAmount = Math.abs(Number(transaction?.amount ?? 0));
  const showSplit = value.length > 1 && txAmount > 0;

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
    if (changed) onAllocationsChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, txAmount, showSplit]);

  const removeId = (id: string) => onChange(value.filter(x => x !== id));
  const anyResolvingSelected = value.some(id => byId.get(id)?.isResolving);

  const allocated = value.reduce((sum, id) => sum + (allocations[id] ?? 0), 0);
  const splitOk = Math.abs(allocated - txAmount) < 0.01;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Categorias</Label>
        <Combobox
          mode="multiple"
          value={value}
          onValueChange={v => {
            const arr = Array.isArray(v) ? v : v ? [v] : [];
            onChange(arr);
          }}
          options={options}
          placeholder="Selecione as categorias..."
          searchPlaceholder="Buscar categoria..."
          emptyText="Nenhuma categoria encontrada"
          searchable={true}
          clearable={true}
          hideDefaultBadges
        />
        {value.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {value.map(id => {
              const cat = byId.get(id);
              if (!cat) return null;
              const accountingLabel = getAccountingTypeLabel(cat);
              return (
                <span key={id} className="inline-flex flex-col items-start gap-0.5">
                  <Badge
                    variant="secondary"
                    size="sm"
                    className="whitespace-nowrap gap-1 pr-1"
                    style={
                      cat.color
                        ? {
                            backgroundColor: cat.color,
                            color: getCategoryTextColor(cat.color) ?? "#fff",
                            borderColor: "transparent",
                          }
                        : undefined
                    }
                  >
                    {cat.name}
                    <button
                      type="button"
                      onClick={() => removeId(id)}
                      className="rounded-full hover:bg-black/20 p-0.5"
                      aria-label={`Remover ${cat.name}`}
                    >
                      <IconX className="h-3 w-3" />
                    </button>
                  </Badge>
                  {accountingLabel && (
                    <span className="text-[10px] leading-none text-muted-foreground">
                      {accountingLabel}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        )}
        {anyResolvingSelected && (
          <p className="text-xs text-muted-foreground">
            Uma categoria auto-conciliante foi selecionada — a transação será
            conciliada sem exigir nota fiscal.
          </p>
        )}
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
                        onAllocationsChange({ ...allocations, [id]: n });
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

      <div className="space-y-2">
        <Label htmlFor="category-notes">Observação (opcional)</Label>
        <Input
          id="category-notes"
          value={notes}
          onChange={v => onNotesChange(typeof v === "string" ? v : v == null ? "" : String(v))}
          placeholder="Contexto para auditoria futura"
        />
      </div>
    </div>
  );
}
