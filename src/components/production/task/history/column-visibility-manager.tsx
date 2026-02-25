import { useState, useMemo, useEffect, useRef } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { IconColumns, IconSearch, IconRefresh, IconGripVertical } from "@tabler/icons-react";
import { getDefaultVisibleColumns } from "./task-history-columns";
import { getHeaderText } from "@/components/ui/column-visibility-utils";
import type { TaskColumn } from "../list/types";

// Reconcile an order array with current columns:
// - Keep IDs that exist in columns, in their stored order
// - Append any new column IDs that weren't in the order
function reconcileOrder(order: string[], cols: TaskColumn[]): string[] {
  const colIds = new Set(cols.map((c) => c.id));
  // Keep only IDs that exist in columns, preserving order
  const kept = order.filter((id) => colIds.has(id));
  // Find new IDs not in order and append them
  const keptSet = new Set(kept);
  const newIds = cols.map((c) => c.id).filter((id) => !keptSet.has(id));
  return [...kept, ...newIds];
}

interface ColumnVisibilityManagerProps {
  columns: TaskColumn[];
  visibleColumns: Set<string>;
  onVisibilityChange: (columns: Set<string>) => void;
  /** Custom default columns to use for reset. If not provided, uses column definitions' defaultVisible property */
  defaultColumns?: Set<string>;
  /** Current column order (array of column IDs) */
  columnOrder?: string[];
  /** Callback when column order changes */
  onColumnOrderChange?: (order: string[]) => void;
  /** Callback to reset column order to defaults */
  onColumnOrderReset?: () => void;
  /** Callback to reset column widths to defaults */
  onColumnWidthsReset?: () => void;
}

function SortableColumnItem({
  column,
  isVisible,
  onToggle,
  isDragDisabled,
}: {
  column: TaskColumn;
  isVisible: boolean;
  onToggle: (checked: boolean | undefined) => void;
  isDragDisabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
    disabled: isDragDisabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between space-x-2 p-2 hover:bg-accent hover:text-accent-foreground rounded-md"
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div
          {...attributes}
          {...listeners}
          className={isDragDisabled ? "text-muted-foreground/30" : "cursor-grab active:cursor-grabbing text-muted-foreground"}
        >
          <IconGripVertical className="h-4 w-4" />
        </div>
        <span className="text-sm truncate">{column.header}</span>
      </div>
      <Switch
        id={`column-${column.id}`}
        checked={isVisible}
        onCheckedChange={onToggle}
      />
    </div>
  );
}

export function ColumnVisibilityManager({
  columns,
  visibleColumns,
  onVisibilityChange,
  defaultColumns,
  columnOrder,
  onColumnOrderChange,
  onColumnOrderReset,
  onColumnWidthsReset,
}: ColumnVisibilityManagerProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [localVisible, setLocalVisible] = useState(visibleColumns);
  const [localOrder, setLocalOrder] = useState<string[]>(columnOrder ?? columns.map((c) => c.id));

  // Track previous columns to detect when new columns are added
  const prevColumnsRef = useRef<string[]>(columns.map((c) => c.id));

  // Keep localOrder in sync when columns change (e.g., permission-based columns added after user data loads)
  useEffect(() => {
    const currentColIds = columns.map((c) => c.id);
    const prevColIds = prevColumnsRef.current;

    // Check if new columns were added
    const prevSet = new Set(prevColIds);
    const hasNewColumns = currentColIds.some((id) => !prevSet.has(id));

    if (hasNewColumns) {
      // Reconcile localOrder to include new columns
      setLocalOrder((prev) => reconcileOrder(prev, columns));
    }

    prevColumnsRef.current = currentColIds;
  }, [columns]);

  // Sync local state when popover opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setLocalVisible(visibleColumns);
      // Reconcile columnOrder with current columns to handle cases where
      // columns were added after the order was saved (e.g., permission-based columns)
      const baseOrder = columnOrder ?? columns.map((c) => c.id);
      setLocalOrder(reconcileOrder(baseOrder, columns));
      setSearchQuery("");
    }
    setOpen(newOpen);
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Sort columns by localOrder for display
  const orderedColumns = useMemo(() => {
    const orderMap = new Map(localOrder.map((id, idx) => [id, idx]));
    return [...columns].sort((a, b) => (orderMap.get(a.id) ?? Infinity) - (orderMap.get(b.id) ?? Infinity));
  }, [columns, localOrder]);

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

  const handleToggle = (columnKey: string, checked: boolean | undefined) => {
    const newVisible = new Set(localVisible);
    if (checked === true) {
      newVisible.add(columnKey);
    } else {
      newVisible.delete(columnKey);
    }
    setLocalVisible(newVisible);
  };

  const handleSelectAll = () => {
    setLocalVisible(new Set(columns.map((col) => col.id)));
  };

  const handleDeselectAll = () => {
    setLocalVisible(new Set());
  };

  const handleReset = () => {
    setLocalVisible(defaultColumns || getDefaultVisibleColumns(columns));
    setLocalOrder(columns.map((c) => c.id));
    if (onColumnWidthsReset) onColumnWidthsReset();
  };

  const handleApply = () => {
    onVisibilityChange(localVisible);
    if (onColumnOrderChange) {
      onColumnOrderChange(localOrder);
    }
    setOpen(false);
  };

  const handleClose = () => {
    setLocalVisible(visibleColumns);
    setLocalOrder(columnOrder ?? columns.map((c) => c.id));
    setOpen(false);
  };

  const visibleCount = localVisible.size;
  const totalCount = columns.length;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="default" className="gap-2">
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
            <Input type="text" placeholder="Buscar coluna..." value={searchQuery} onChange={(value) => setSearchQuery(String(value || ""))} className="pl-9 h-9 bg-transparent" />
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
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={filteredColumns.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                {filteredColumns.map((column) => (
                  <SortableColumnItem
                    key={column.id}
                    column={column}
                    isVisible={localVisible.has(column.id)}
                    onToggle={(checked) => handleToggle(column.id, checked)}
                    isDragDisabled={isDragDisabled}
                  />
                ))}
              </SortableContext>
            </DndContext>
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
