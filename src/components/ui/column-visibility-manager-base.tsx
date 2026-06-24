import React, { useState, useMemo, useEffect, useRef } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { IconColumns, IconSearch, IconRefresh, IconGripVertical } from "@tabler/icons-react";
import { getHeaderText } from "@/components/ui/column-visibility-utils";
import { cn } from "@/lib/utils";

/**
 * Canonical column shape consumed by the base manager. Each per-list manager
 * adapts its own column definition (which may key off `key` or `id`) into this.
 */
export interface ColumnVisibilityBaseColumn {
  id: string;
  header: React.ReactNode;
}

export interface ColumnVisibilityManagerBaseProps {
  columns: ColumnVisibilityBaseColumn[];
  visibleColumns: Set<string>;
  onVisibilityChange: (columns: Set<string>) => void;
  /** Returns the set of columns to restore when the user clicks "Restaurar". */
  getDefaultVisibleColumns: () => Set<string>;
  /** When provided, the applied selection is also persisted to localStorage under this key. */
  storageKey?: string;
  /** Current column order (array of column ids). Enables drag-to-reorder when paired with onColumnOrderChange. */
  columnOrder?: string[];
  /** Callback when the column order changes — presence of this prop turns on drag-to-reorder. */
  onColumnOrderChange?: (order: string[]) => void;
  /** Optional callback to also reset column widths when "Restaurar" is clicked. */
  onColumnWidthsReset?: () => void;
  /** Optional override for the trigger button className. */
  triggerClassName?: string;
}

// Reconcile a stored order array with the current columns:
// - keep ids that still exist, in their stored order
// - append any new column ids that weren't in the stored order
function reconcileOrder(order: string[], cols: ColumnVisibilityBaseColumn[]): string[] {
  const colIds = new Set(cols.map((c) => c.id));
  const kept = order.filter((id) => colIds.has(id));
  const keptSet = new Set(kept);
  const newIds = cols.map((c) => c.id).filter((id) => !keptSet.has(id));
  return [...kept, ...newIds];
}

function ColumnRow({
  column,
  isVisible,
  onToggle,
  sortable,
  isDragDisabled,
}: {
  column: ColumnVisibilityBaseColumn;
  isVisible: boolean;
  onToggle: (checked: boolean) => void;
  sortable: boolean;
  isDragDisabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
    disabled: !sortable || isDragDisabled,
  });

  const style = sortable
    ? {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  return (
    <Label
      ref={sortable ? setNodeRef : undefined}
      style={style}
      htmlFor={`column-${column.id}`}
      className="flex items-center gap-2 p-2 hover:bg-accent hover:text-accent-foreground rounded-md cursor-pointer"
    >
      {sortable && (
        <span
          {...attributes}
          {...listeners}
          className={isDragDisabled ? "text-muted-foreground/30" : "cursor-grab active:cursor-grabbing text-muted-foreground"}
          onClick={(e) => e.preventDefault()}
        >
          <IconGripVertical className="h-4 w-4" />
        </span>
      )}
      <Checkbox id={`column-${column.id}`} checked={isVisible} onCheckedChange={(checked) => onToggle(checked === true)} />
      <span className="flex-1 min-w-0 text-sm truncate">{column.header}</span>
    </Label>
  );
}

export function ColumnVisibilityManagerBase({
  columns,
  visibleColumns,
  onVisibilityChange,
  getDefaultVisibleColumns,
  storageKey,
  columnOrder,
  onColumnOrderChange,
  onColumnWidthsReset,
  triggerClassName,
}: ColumnVisibilityManagerBaseProps) {
  const sortable = typeof onColumnOrderChange === "function";

  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [localVisible, setLocalVisible] = useState(visibleColumns);
  const [localOrder, setLocalOrder] = useState<string[]>(columnOrder ?? columns.map((c) => c.id));

  // Track previous columns so we can fold newly-added columns into the order
  // (e.g. permission-gated columns that appear after data loads).
  const prevColumnsRef = useRef<string[]>(columns.map((c) => c.id));
  useEffect(() => {
    const currentColIds = columns.map((c) => c.id);
    const prevSet = new Set(prevColumnsRef.current);
    if (currentColIds.some((id) => !prevSet.has(id))) {
      setLocalOrder((prev) => reconcileOrder(prev, columns));
    }
    prevColumnsRef.current = currentColIds;
  }, [columns]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setLocalVisible(visibleColumns);
      setLocalOrder(reconcileOrder(columnOrder ?? columns.map((c) => c.id), columns));
      setSearchQuery("");
    }
    setOpen(newOpen);
  };

  // Display order: when sortable, honor localOrder; otherwise keep natural order.
  const orderedColumns = useMemo(() => {
    if (!sortable) return columns;
    const orderMap = new Map(localOrder.map((id, idx) => [id, idx]));
    return [...columns].sort((a, b) => (orderMap.get(a.id) ?? Infinity) - (orderMap.get(b.id) ?? Infinity));
  }, [columns, localOrder, sortable]);

  const filteredColumns = useMemo(() => {
    if (!searchQuery) return orderedColumns;
    return orderedColumns.filter((col) => getHeaderText(col.header).toLowerCase().includes(searchQuery.toLowerCase()));
  }, [orderedColumns, searchQuery]);

  const isDragDisabled = searchQuery.length > 0;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = localOrder.indexOf(String(active.id));
    const newIndex = localOrder.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    setLocalOrder(arrayMove(localOrder, oldIndex, newIndex));
  };

  const handleToggle = (columnKey: string, checked: boolean) => {
    const newVisible = new Set(localVisible);
    if (checked) {
      newVisible.add(columnKey);
    } else {
      newVisible.delete(columnKey);
    }
    setLocalVisible(newVisible);
  };

  const handleSelectAll = () => setLocalVisible(new Set(columns.map((col) => col.id)));
  const handleDeselectAll = () => setLocalVisible(new Set());

  const handleReset = () => {
    setLocalVisible(getDefaultVisibleColumns());
    if (sortable) setLocalOrder(columns.map((c) => c.id));
    if (onColumnWidthsReset) onColumnWidthsReset();
  };

  const handleApply = () => {
    onVisibilityChange(localVisible);
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(localVisible)));
    }
    if (onColumnOrderChange) onColumnOrderChange(localOrder);
    setOpen(false);
  };

  const handleClose = () => {
    setLocalVisible(visibleColumns);
    setLocalOrder(columnOrder ?? columns.map((c) => c.id));
    setOpen(false);
  };

  const visibleCount = localVisible.size;
  const totalCount = columns.length;

  const rows = filteredColumns.map((column) => (
    <ColumnRow
      key={column.id}
      column={column}
      isVisible={localVisible.has(column.id)}
      onToggle={(checked) => handleToggle(column.id, checked)}
      sortable={sortable}
      isDragDisabled={isDragDisabled}
    />
  ));

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="default" className={cn("gap-2", triggerClassName)}>
          <IconColumns className="h-4 w-4" />
          Colunas ({visibleCount}/{totalCount})
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-sm">Gerenciar Colunas</h4>
            <Button variant="ghost" size="sm" onClick={handleReset} className="h-7 px-2 text-xs">
              <IconRefresh className="h-3 w-3 mr-1" />
              Restaurar
            </Button>
          </div>

          <div className="relative">
            <IconSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar coluna..."
              value={searchQuery}
              onChange={(value) => setSearchQuery(String(value || ""))}
              className="pl-9 h-9 bg-transparent"
            />
          </div>

          <div className="flex gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={handleSelectAll} className="flex-1 h-7 text-xs">
              Selecionar Todas
            </Button>
            <Button variant="outline" size="sm" onClick={handleDeselectAll} className="flex-1 h-7 text-xs">
              Desmarcar Todas
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[300px]">
          <div className="space-y-1 p-2">
            {sortable ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={filteredColumns.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                  {rows}
                </SortableContext>
              </DndContext>
            ) : (
              rows
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t flex justify-between">
          <Button variant="outline" size="sm" onClick={handleClose}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleApply}>
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
