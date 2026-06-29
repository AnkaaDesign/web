import { useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  IconColumns,
  IconSearch,
  IconRefresh,
  IconGripVertical,
  IconAlignLeft,
  IconAlignCenter,
  IconAlignRight,
} from "@tabler/icons-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ColumnAlign } from "./data-table-types";

interface ManagerColumn {
  id: string;
  header: string;
}

interface DataTableColumnManagerProps {
  columns: ManagerColumn[];
  visibleColumns: Set<string>;
  onVisibilityChange: (cols: Set<string>) => void;
  columnOrder: string[];
  onColumnOrderChange: (order: string[]) => void;
  alignment: Record<string, ColumnAlign>;
  onAlignmentChange: (alignment: Record<string, ColumnAlign>) => void;
  /** The column's design-time default alignment (used to highlight the active button). */
  defaultAlign: (id: string) => ColumnAlign;
  /** Reset visibility + order + alignment + widths to defaults (engine.resetLayout). */
  onReset: () => void;
  triggerClassName?: string;
}

const ALIGN_OPTIONS: { value: ColumnAlign; icon: typeof IconAlignLeft; label: string }[] = [
  { value: "left", icon: IconAlignLeft, label: "Esquerda" },
  { value: "center", icon: IconAlignCenter, label: "Centro" },
  { value: "right", icon: IconAlignRight, label: "Direita" },
];

function ColumnRow({
  column,
  visible,
  align,
  onToggle,
  onAlign,
  dragDisabled,
}: {
  column: ManagerColumn;
  visible: boolean;
  align: ColumnAlign;
  onToggle: (checked: boolean) => void;
  onAlign: (a: ColumnAlign) => void;
  dragDisabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
    disabled: dragDisabled,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex items-center gap-2 rounded-md p-1.5 hover:bg-muted"
    >
      <span
        {...attributes}
        {...listeners}
        className={cn(
          "shrink-0",
          dragDisabled ? "text-muted-foreground/30" : "cursor-grab text-muted-foreground active:cursor-grabbing",
        )}
      >
        <IconGripVertical className="h-4 w-4" />
      </span>
      <Checkbox checked={visible} onCheckedChange={(c) => onToggle(c === true)} />
      <span onClick={() => onToggle(!visible)} className="min-w-0 flex-1 cursor-pointer truncate text-sm">
        {column.header}
      </span>
      <div className="flex shrink-0 items-center rounded-md border border-border">
        {ALIGN_OPTIONS.map(({ value, icon: Icon, label }) => (
          <button
            key={value}
            type="button"
            title={`Alinhar à ${label.toLowerCase()}`}
            onClick={() => onAlign(value)}
            className={cn(
              "flex h-6 w-6 items-center justify-center transition-colors first:rounded-l-md last:rounded-r-md",
              align === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>
    </div>
  );
}

export function DataTableColumnManager({
  columns,
  visibleColumns,
  onVisibilityChange,
  columnOrder,
  onColumnOrderChange,
  alignment,
  onAlignmentChange,
  defaultAlign,
  onReset,
  triggerClassName,
}: DataTableColumnManagerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const orderedColumns = useMemo(() => {
    const idx = new Map(columnOrder.map((id, i) => [id, i] as const));
    return [...columns].sort((a, b) => (idx.get(a.id) ?? Infinity) - (idx.get(b.id) ?? Infinity));
  }, [columns, columnOrder]);

  const filtered = useMemo(
    () => (search ? orderedColumns.filter((c) => c.header.toLowerCase().includes(search.toLowerCase())) : orderedColumns),
    [orderedColumns, search],
  );
  const dragDisabled = search.length > 0;

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = columnOrder.indexOf(String(active.id));
    const to = columnOrder.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onColumnOrderChange(arrayMove(columnOrder, from, to));
  };

  const toggle = (id: string, checked: boolean) => {
    const next = new Set(visibleColumns);
    if (checked) next.add(id);
    else next.delete(id);
    onVisibilityChange(next);
  };

  const setAlign = (id: string, a: ColumnAlign) => onAlignmentChange({ ...alignment, [id]: a });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("gap-2", triggerClassName)}>
          <IconColumns className="h-4 w-4" />
          Colunas ({visibleColumns.size}/{columns.length})
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[26rem] p-0" align="end">
        <div className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-medium">Gerenciar Colunas</h4>
            <Button variant="ghost" size="sm" onClick={onReset} className="h-7 px-2 text-xs">
              <IconRefresh className="mr-1 h-3 w-3" />
              Restaurar
            </Button>
          </div>
          <div className="relative mb-2">
            <IconSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar coluna..."
              value={search}
              onChange={(v) => setSearch(String(v || ""))}
              className="h-9 bg-transparent pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onVisibilityChange(new Set(columns.map((c) => c.id)))}
              className="h-7 flex-1 text-xs"
            >
              Selecionar Todas
            </Button>
            <Button variant="outline" size="sm" onClick={() => onVisibilityChange(new Set())} className="h-7 flex-1 text-xs">
              Desmarcar Todas
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[320px]">
          <div className="p-2">
            {dragDisabled ? (
              filtered.map((c) => (
                <ColumnRow
                  key={c.id}
                  column={c}
                  visible={visibleColumns.has(c.id)}
                  align={alignment[c.id] ?? defaultAlign(c.id)}
                  onToggle={(checked) => toggle(c.id, checked)}
                  onAlign={(a) => setAlign(c.id, a)}
                  dragDisabled
                />
              ))
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={filtered.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                  {filtered.map((c) => (
                    <ColumnRow
                      key={c.id}
                      column={c}
                      visible={visibleColumns.has(c.id)}
                      align={alignment[c.id] ?? defaultAlign(c.id)}
                      onToggle={(checked) => toggle(c.id, checked)}
                      onAlign={(a) => setAlign(c.id, a)}
                      dragDisabled={false}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
