import { useMemo, useState } from "react";
import { IconChevronDown } from "@tabler/icons-react";
import { useItems } from "../../../../hooks";
import type { Item, WarehouseLocation } from "../../../../types";
import { WAREHOUSE_LOCATION_TYPE } from "../../../../constants";
import { cn } from "@/lib/utils";
import { WAREHOUSE_TYPE_STYLE, columnsForLevel } from "./warehouse-type-style";

interface WarehouseLocationFrontViewProps {
  location: WarehouseLocation;
  /** Item ids matching an active search — their badges blink red. */
  highlightItemIds?: Set<string>;
}

export function WarehouseLocationFrontView({ location, highlightItemIds }: WarehouseLocationFrontViewProps) {
  const style = WAREHOUSE_TYPE_STYLE[location.type] ?? WAREHOUSE_TYPE_STYLE[WAREHOUSE_LOCATION_TYPE.ESTANTE];
  const TypeIcon = style.icon;
  const [showUnplaced, setShowUnplaced] = useState(true);

  const { data: itemsResponse, isLoading } = useItems({ where: { warehouseLocationId: location.id }, orderBy: { name: "asc" }, limit: 500 });
  const items = useMemo<Item[]>(() => itemsResponse?.data ?? [], [itemsResponse]);

  const isKanban = location.type === WAREHOUSE_LOCATION_TYPE.ESTANTE_KANBAN;
  const isPallet = location.type === WAREHOUSE_LOCATION_TYPE.PALETE;
  const isPanel = location.type === WAREHOUSE_LOCATION_TYPE.PAINEL;
  // Columns (the "C" — caixa kanban) only exist on kanban racks; a regular estante
  // is addressed by prateleira only (S1-E2-P4), no column.
  const hasColumns = isKanban;
  const levels = Math.max(1, location.levels);
  // levels read top → bottom (nível 1 no topo); columns left → right.
  const levelOrder = useMemo(() => Array.from({ length: levels }, (_, i) => i + 1), [levels]);
  const codeStr = [location.section, location.code].filter(Boolean).join("-") || location.name;
  const totalBoxes = useMemo(() => (isKanban ? levelOrder.reduce((a, l) => a + columnsForLevel(location, l), 0) : 0), [isKanban, levelOrder, location]);
  const countText = isPallet
    ? ""
    : isPanel
      ? `${levels} ${levels === 1 ? "linha" : "linhas"}`
      : isKanban
        ? `${levels} ${levels === 1 ? "prateleira" : "prateleiras"} · ${totalBoxes} ${totalBoxes === 1 ? "caixa" : "caixas"}`
        : `${levels} ${levels === 1 ? "prateleira" : "prateleiras"}`;

  // bucket items: pallet → one bin; kanban → level×column cells; estante → per level.
  // An item can occupy MULTIPLE cells (locationCells) → it appears on every listed shelf/cell.
  // An item with NO cells occupies the WHOLE structure → shown on EVERY shelf/cell (wholeItems).
  const { byCell, byLevel, palletItems, wholeItems, unplaced } = useMemo(() => {
    const cell = new Map<string, Item[]>();
    const lvl = new Map<number, Item[]>();
    const pallet: Item[] = [];
    const whole: Item[] = [];
    const noPos: Item[] = [];
    const push = (m: Map<string | number, Item[]>, k: string | number, it: Item) => { const a = m.get(k) ?? []; a.push(it); m.set(k, a); };
    for (const item of items) {
      if (isPallet) { pallet.push(item); continue; }
      const cells = item.locationCells ?? [];
      if (cells.length === 0) { whole.push(item); continue; } // whole structure → every shelf
      let placed = false;
      let bad = false;
      for (const { level: L, column: C } of cells) {
        if (L == null || L < 1 || L > levels) { bad = true; continue; }
        if (hasColumns) {
          if (C == null || C < 1 || C > columnsForLevel(location, L)) { bad = true; continue; }
          push(cell as Map<string | number, Item[]>, `${L}:${C}`, item);
          placed = true;
        } else {
          push(lvl as Map<string | number, Item[]>, L, item);
          placed = true;
        }
      }
      if (bad && !placed) noPos.push(item); // every listed cell was out of range
    }
    return { byCell: cell, byLevel: lvl, palletItems: pallet, wholeItems: whole, unplaced: noPos };
  }, [items, isPallet, hasColumns, levels, location]);

  const itemLabel = (it: Item) => (it.uniCode ? `${it.uniCode} - ${it.name}` : it.name);
  // Item badge. On full-width shelf rows (estante per-level, pallet) the card sizes to its
  // content and stays on ONE line (truncating only pathological names). `fullWidth` kanban
  // cells fill their narrow grid column and keep the 2-line clamp.
  const renderBadge = (item: Item, fullWidth = false) => {
    const hot = highlightItemIds?.has(item.id);
    return (
      <div
        key={item.id}
        title={`${itemLabel(item)} (${item.quantity})`}
        className={cn(
          "flex h-12 items-center rounded-md border px-2 text-[11px] leading-tight",
          fullWidth ? "w-full" : "w-auto max-w-full",
          hot ? "animate-pulse border-red-500/60 bg-red-500/20 text-foreground" : "border-border bg-secondary text-secondary-foreground",
        )}
      >
        <span className={cn("w-full text-left", fullWidth ? "line-clamp-2" : "truncate")}>{itemLabel(item)}</span>
      </div>
    );
  };
  const emptyCell = <span className="text-[10px] text-muted-foreground/50">—</span>;

  return (
    <div className="space-y-4">
      {/* header — [type icon][code] on the left, shelf/box count on the right (justified);
          pr-10 keeps the right-side count clear of the dialog's close (X) button */}
      <div className="flex items-center justify-between gap-3 pr-10">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border" style={{ backgroundColor: style.fill, borderColor: style.color, color: style.color }}>
            <TypeIcon className="h-4 w-4" />
          </span>
          <span className="truncate text-base font-semibold leading-none">{codeStr}</span>
        </div>
        {countText && <span className="shrink-0 text-sm text-muted-foreground">{countText}</span>}
      </div>

      {isLoading && items.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Carregando itens...</div>
      ) : isPallet ? (
        // pallet → single bin
        <div className="rounded-md border-2 border-muted-foreground/40 bg-gradient-to-b from-muted/40 to-muted/10 p-3">
          {palletItems.length === 0 ? <p className="text-center text-xs text-muted-foreground/50">Vazio</p> : <div className="flex flex-wrap justify-center gap-1.5">{palletItems.map((it) => renderBadge(it))}</div>}
        </div>
      ) : (
        // estante / dupla / kanban / painel — stacked shelves (high → low). A whole-structure
        // item (wholeItems) is rendered on EVERY shelf/cell.
        <div className="overflow-x-auto rounded-md border-x-[6px] border-y-2 border-muted-foreground/40 bg-gradient-to-b from-muted/40 to-muted/10 p-2">
          {/* column headers — only for kanban (the caixas) */}
          {hasColumns && (
            <div className="mb-1 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.max(1, ...levelOrder.map((l) => columnsForLevel(location, l)))}, minmax(96px, 1fr))` }}>
              {Array.from({ length: Math.max(1, ...levelOrder.map((l) => columnsForLevel(location, l))) }, (_, i) => <div key={i} className="text-center text-[11px] font-semibold text-muted-foreground">C{i + 1}</div>)}
            </div>
          )}
          {levelOrder.map((level) => {
            const maxCols = hasColumns ? Math.max(1, ...levelOrder.map((l) => columnsForLevel(location, l))) : 1;
            const cols = hasColumns ? columnsForLevel(location, level) : 1;
            return (
              <div key={level} className="mb-1.5 last:mb-0">
                <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${maxCols}, minmax(${hasColumns ? 96 : 0}px, 1fr))` }}>
                  {hasColumns
                    ? Array.from({ length: maxCols }, (_, i) => {
                        const column = i + 1;
                        if (column > cols) return <div key={i} />;
                        const cellItems = [...wholeItems, ...(byCell.get(`${level}:${column}`) ?? [])];
                        return (
                          <div key={column} className="flex min-h-[3.5rem] min-w-0 flex-col items-center justify-center gap-1 px-1 text-center" title={`${codeStr}-P${level}-C${column}`}>
                            {cellItems.length === 0 ? emptyCell : <div className="flex w-full flex-col items-center gap-1">{cellItems.map((it) => renderBadge(it, true))}</div>}
                          </div>
                        );
                      })
                    : (() => {
                        const cellItems = [...wholeItems, ...(byLevel.get(level) ?? [])];
                        return (
                          <div className="flex min-h-[3.5rem] min-w-0 flex-wrap items-center justify-center gap-1 px-1 text-center" title={`${codeStr}-P${level}`}>
                            {cellItems.length === 0 ? emptyCell : cellItems.map((it) => renderBadge(it))}
                          </div>
                        );
                      })()}
                </div>
                {/* metal shelf plank */}
                <div className="mt-1 h-1.5 rounded-sm bg-gradient-to-b from-muted-foreground/45 to-muted-foreground/15 shadow-sm" />
              </div>
            );
          })}
        </div>
      )}

      {/* unplaced (genuine data errors — level/column out of range) */}
      {unplaced.length > 0 && (
        <div className="border-t border-border pt-3">
          <button type="button" onClick={() => setShowUnplaced((sx) => !sx)} className="flex w-full items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <IconChevronDown className={cn("h-4 w-4 transition-transform", !showUnplaced && "-rotate-90")} />
            Sem posição ({unplaced.length})
          </button>
          {showUnplaced && <div className="mt-2 flex flex-wrap gap-1.5">{unplaced.map((it) => renderBadge(it))}</div>}
        </div>
      )}

      {!isLoading && items.length === 0 && <p className="text-center text-sm text-muted-foreground">Nenhum item nesta estrutura.</p>}
    </div>
  );
}
