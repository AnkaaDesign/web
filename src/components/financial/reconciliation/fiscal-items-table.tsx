import { useMemo } from "react";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { useReconciliationCategories } from "@/hooks/financial/use-reconciliation";
import { getAccountingTypeLabel } from "./match-status-badge";
import { formatCurrency } from "@/utils";
import { cn } from "@/lib/utils";
import type { FiscalDocType, FiscalItemTaxes } from "@/types/reconciliation";

/** Minimal row shape shared by FiscalDocumentItem and MatchCandidateItem. */
export interface FiscalItemRow {
  id: string;
  code: string | null;
  description: string;
  quantity?: number | string | null;
  unit?: string | null;
  unitValue?: number | string | null;
  totalValue: number | string;
  ncm?: string | null;
  cfop?: string | null;
  taxes?: FiscalItemTaxes | null;
  categoryId?: string | null;
  category?: { id: string; name: string; slug: string; color: string | null } | null;
  categoryConfidence?: number | null;
}

interface Props {
  items: FiscalItemRow[];
  docType: FiscalDocType;
  /** When true, the Categoria cell is an editable single-select combobox. */
  editable?: boolean;
  /** Footer total (defaults to the sum of line totals). */
  totalValue?: number | string;
  onItemCategoryChange?: (itemId: string, categoryId: string | null) => void;
  /** Visually denser variant for embedding inside candidate cards. */
  dense?: boolean;
  /** Hide the secondary line under the description (NCM/CFOP + per-item taxes),
   *  leaving only the product/service description. */
  hideLineMeta?: boolean;
  className?: string;
}

function toNum(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatQuantity(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 4 });
}

/**
 * Renders an NF's line items / services as a table. NFe/NFCe/CTe show the full
 * product columns (qtd/unitário); NFSe drops those (single service value). The
 * Categoria column is a colored chip when read-only, or an inline category
 * combobox when `editable` — used by the NF detail page and the transaction
 * candidate/linked cards alike.
 */
export function FiscalItemsTable({
  items,
  docType,
  editable,
  totalValue,
  onItemCategoryChange,
  dense,
  hideLineMeta,
  className,
}: Props) {
  const isNfse = docType === "NFSE";
  const { data: categories } = useReconciliationCategories();

  const categoryOptions = useMemo<ComboboxOption[]>(
    () =>
      (categories ?? [])
        .filter(c => c.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
        .map(c => ({
          value: c.id,
          label: c.name,
          // The chart-of-accounts cost group, shown as the option subtitle so the
          // picker reads "category — accounting group".
          description: getAccountingTypeLabel(c) ?? undefined,
          metadata: { color: c.color },
        })),
    [categories],
  );

  // Always render the Qtd/Unitário columns — even for NFSe (which has no line
  // quantities, so they read "—"). Keeping the SAME column set for every doc type
  // makes every candidate/linked-NF items table line up identically instead of
  // NFSe cards being laid out differently from NFe cards.
  const showQtyCols = true;
  const footerTotal = toNum(totalValue) ?? items.reduce((s, i) => s + (toNum(i.totalValue) ?? 0), 0);
  // Columns: Código, Descrição, Categoria, [Qtd, Unitário], Total (always last).
  const leadingCols = 3 + (showQtyCols ? 2 : 0); // up to but not including Total
  const cell = dense ? "px-2 py-1.5" : "px-3 py-2";
  // Header cells: fixed height so the header row matches the data rows (whose
  // height is driven by the category combobox), instead of looking shorter.
  const headCell = dense ? "px-2 h-11 align-middle" : "px-3 h-12 align-middle";

  return (
    <div className={cn("rounded-md border border-border/60 overflow-x-auto", className)}>
      {/* table-fixed + explicit column widths so EVERY items table (across all
          candidate / linked-NF cards and the NF detail page) lines up identically. */}
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col style={{ width: "7.5rem" }} />
          <col />
          <col style={{ width: "20rem" }} />
          {showQtyCols && <col style={{ width: "6.875rem" }} />}
          {showQtyCols && <col style={{ width: "8.75rem" }} />}
          <col style={{ width: "9.375rem" }} />
        </colgroup>
        <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className={cn("text-left font-medium whitespace-nowrap", headCell)}>Código</th>
            <th className={cn("text-left font-medium", headCell)}>{isNfse ? "Serviço" : "Descrição"}</th>
            <th className={cn("text-left font-medium whitespace-nowrap", headCell)}>Categoria</th>
            {showQtyCols && <th className={cn("text-right font-medium whitespace-nowrap", headCell)}>Qtd.</th>}
            {showQtyCols && <th className={cn("text-right font-medium whitespace-nowrap", headCell)}>Unitário</th>}
            <th className={cn("text-right font-medium whitespace-nowrap", headCell)}>Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {items.map(item => {
            const qty = toNum(item.quantity);
            const unitValue = toNum(item.unitValue);
            const total = toNum(item.totalValue) ?? 0;
            return (
              <tr key={item.id} className="align-middle">
                <td className={cn("text-muted-foreground truncate", cell)}>{item.code || "—"}</td>
                <td className={cell}>
                  <p className="truncate" title={item.description}>{item.description}</p>
                  {!hideLineMeta && (item.ncm || item.cfop) && (
                    <p className="truncate text-[10px] text-muted-foreground mt-0.5">
                      {item.ncm ? `NCM ${item.ncm}` : ""}
                      {item.ncm && item.cfop ? " · " : ""}
                      {item.cfop ? `CFOP ${item.cfop}` : ""}
                    </p>
                  )}
                  {!hideLineMeta && <ItemTaxes taxes={item.taxes} />}
                </td>
                <td
                  className={cell}
                  // When the table is embedded in a clickable candidate card,
                  // stop click/keydown from bubbling so interacting with the
                  // category combobox never toggles the card's selection.
                  onClick={editable && onItemCategoryChange ? e => e.stopPropagation() : undefined}
                  onKeyDown={
                    editable && onItemCategoryChange ? e => e.stopPropagation() : undefined
                  }
                >
                  {editable && onItemCategoryChange ? (
                    <Combobox
                      value={item.categoryId ?? undefined}
                      onValueChange={v =>
                        onItemCategoryChange(item.id, typeof v === "string" ? v : null)
                      }
                      options={categoryOptions}
                      mode="single"
                      searchable
                      clearable
                      placeholder="Categorizar"
                      searchPlaceholder="Buscar categoria..."
                      emptyText="Nenhuma categoria"
                      className="h-8 text-xs"
                      triggerClassName="px-2"
                      renderOption={renderCategoryOption}
                      renderValue={renderCategoryValue}
                    />
                  ) : (
                    <CategoryChip item={item} />
                  )}
                </td>
                {showQtyCols && (
                  <td className={cn("text-right tabular-nums whitespace-nowrap", cell)}>
                    {qty !== null && qty > 0 ? (
                      <>
                        {formatQuantity(qty)}
                        {item.unit ? <span className="text-muted-foreground"> {item.unit}</span> : null}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                )}
                {showQtyCols && (
                  <td className={cn("text-right tabular-nums whitespace-nowrap", cell)}>
                    {unitValue !== null && unitValue > 0 ? (
                      formatCurrency(unitValue)
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                )}
                <td className={cn("text-right font-semibold tabular-nums whitespace-nowrap", cell)}>
                  {formatCurrency(total)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-muted/30 border-t-2 border-border">
          <tr>
            <td className={cn("font-semibold uppercase text-xs tracking-wide", cell)} colSpan={leadingCols} />
            <td className={cn("text-right font-bold text-base tabular-nums whitespace-nowrap", cell)}>
              {formatCurrency(footerTotal)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function renderCategoryOption(o: ComboboxOption, _selected: boolean) {
  const color = (o.metadata as { color?: string | null } | undefined)?.color;
  const group = o.description;
  return (
    <span className="flex items-center gap-2 min-w-0">
      {color && <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />}
      <span className="flex min-w-0 flex-col">
        <span className="truncate">{o.label}</span>
        {group && (
          <span className="truncate text-[10px] leading-tight text-muted-foreground">{group}</span>
        )}
      </span>
    </span>
  );
}

function renderCategoryValue(o: ComboboxOption | ComboboxOption[]) {
  const opt = Array.isArray(o) ? o[0] : o;
  if (!opt) return <span className="text-muted-foreground">Categorizar</span>;
  const color = (opt.metadata as { color?: string | null } | undefined)?.color;
  return (
    <span className="flex items-center gap-1.5 truncate">
      {color && <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />}
      <span className="truncate">{opt.label}</span>
    </span>
  );
}

function CategoryChip({ item }: { item: FiscalItemRow }) {
  if (!item.category?.name) return <span className="text-muted-foreground text-xs">—</span>;
  // Cost group (chart-of-accounts rollup) shown as a small muted label beneath
  // the colored chip when the category carries an accounting type.
  const accountingLabel = getAccountingTypeLabel(item.category);
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <Badge
        variant="secondary"
        size="sm"
        className="whitespace-nowrap"
        style={
          item.category.color
            ? { backgroundColor: item.category.color, color: "#fff", borderColor: "transparent" }
            : undefined
        }
      >
        {item.category.name}
        {typeof item.categoryConfidence === "number" ? ` · ${Math.round(item.categoryConfidence)}%` : ""}
      </Badge>
      {accountingLabel && (
        <span className="text-[10px] leading-none text-muted-foreground">
          {accountingLabel}
        </span>
      )}
    </span>
  );
}

function ItemTaxes({ taxes }: { taxes: FiscalItemTaxes | null | undefined }) {
  if (!taxes) return null;
  const parts: string[] = [];
  if (taxes.icms?.vICMS != null) parts.push(`ICMS ${formatCurrency(taxes.icms.vICMS)}`);
  if (taxes.ipi?.vIPI != null) parts.push(`IPI ${formatCurrency(taxes.ipi.vIPI)}`);
  if (taxes.pis?.vPIS != null) parts.push(`PIS ${formatCurrency(taxes.pis.vPIS)}`);
  if (taxes.cofins?.vCOFINS != null) parts.push(`COFINS ${formatCurrency(taxes.cofins.vCOFINS)}`);
  if (parts.length === 0) return null;
  return <p className="text-[10px] text-muted-foreground mt-1">{parts.join(" · ")}</p>;
}
