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
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IconLayoutGrid, IconRefresh, IconGripVertical, IconSearch, IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ManagerSection } from "./use-detail-layout";

interface DetailCustomizeManagerProps {
  sections: ManagerSection[];
  sectionOrder: string[];
  onSectionOrderChange: (order: string[]) => void;
  onToggleSection: (id: string) => void;
  onToggleField: (id: string) => void;
  onSetWidth: (id: string, width: 1 | 2) => void;
  onSetColumn: (id: string, column: 1 | 2 | null) => void;
  onFieldOrderChange: (sectionId: string, order: string[]) => void;
  onSetAll: (visible: boolean) => void;
  onReset: () => void;
  visibleCount: number;
  totalCount: number;
  triggerClassName?: string;
}

// Layout control: half-width pinned to the left or right column, or full width. Re-clicking the
// active half side returns it to auto-balance.
const LAYOUT_OPTS: { key: "left" | "right" | "full"; label: string; title: string }[] = [
  { key: "left", label: "½ ←", title: "Meia largura · coluna esquerda" },
  { key: "right", label: "½ →", title: "Meia largura · coluna direita" },
  { key: "full", label: "1/1", title: "Largura total" },
];

type ManagerField = ManagerSection["fields"][number];

function FieldRow({ field, onToggle }: { field: ManagerField; onToggle: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex items-center gap-2 rounded-md p-1 hover:bg-muted"
    >
      <span {...attributes} {...listeners} className="shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing">
        <IconGripVertical className="h-3.5 w-3.5" />
      </span>
      <Checkbox checked={field.visible} disabled={field.required} onCheckedChange={() => onToggle(field.id)} />
      <span onClick={() => !field.required && onToggle(field.id)} className="min-w-0 flex-1 cursor-pointer truncate text-sm text-muted-foreground">
        {field.label}
      </span>
    </div>
  );
}

function SectionRow({
  section,
  dragDisabled,
  onToggleSection,
  onToggleField,
  onSetWidth,
  onSetColumn,
  onFieldOrderChange,
}: {
  section: ManagerSection;
  dragDisabled: boolean;
  onToggleSection: (id: string) => void;
  onToggleField: (id: string) => void;
  onSetWidth: (id: string, width: 1 | 2) => void;
  onSetColumn: (id: string, column: 1 | 2 | null) => void;
  onFieldOrderChange: (sectionId: string, order: string[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id, disabled: dragDisabled });
  // Single-field sections need no nested accordion — the section checkbox already controls it.
  const hasFields = section.fields.length > 1;

  const fieldSensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const fieldIds = section.fields.map((f) => f.id);
  const handleFieldDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = fieldIds.indexOf(String(active.id));
    const to = fieldIds.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onFieldOrderChange(section.id, arrayMove(fieldIds, from, to));
  };

  const activeLayout = section.width === 2 ? "full" : section.column === 1 ? "left" : section.column === 2 ? "right" : "auto";

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }} className="rounded-md">
      <div className="flex items-center gap-2 rounded-md p-1.5 hover:bg-muted">
        <span
          {...attributes}
          {...listeners}
          className={cn("shrink-0", dragDisabled ? "text-muted-foreground/30" : "cursor-grab text-muted-foreground active:cursor-grabbing")}
        >
          <IconGripVertical className="h-4 w-4" />
        </span>
        <Checkbox checked={section.visible} disabled={section.required} onCheckedChange={() => onToggleSection(section.id)} />
        <button
          type="button"
          onClick={() => hasFields && setExpanded((e) => !e)}
          className={cn("flex min-w-0 flex-1 items-center gap-1 truncate text-left text-sm", hasFields && "cursor-pointer")}
        >
          {hasFields ? (
            expanded ? <IconChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <IconChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <span className="w-3.5 shrink-0" />
          )}
          <span className="truncate">{section.label}</span>
        </button>
        <div className="flex shrink-0 items-center rounded-md border border-border">
          {LAYOUT_OPTS.map((o) => (
            <button
              key={o.key}
              type="button"
              title={o.title}
              onClick={() => {
                if (o.key === "full") {
                  onSetWidth(section.id, 2);
                  return;
                }
                onSetWidth(section.id, 1);
                // Re-clicking the active side returns it to auto-balance.
                onSetColumn(section.id, activeLayout === o.key ? null : o.key === "left" ? 1 : 2);
              }}
              className={cn(
                "flex h-6 min-w-[2rem] items-center justify-center px-1 text-[0.65rem] font-semibold transition-colors first:rounded-l-md last:rounded-r-md",
                activeLayout === o.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {expanded && hasFields ? (
        <div className="ml-7 border-l border-border pb-1 pl-2">
          <DndContext sensors={fieldSensors} collisionDetection={closestCenter} onDragEnd={handleFieldDragEnd}>
            <SortableContext items={fieldIds} strategy={verticalListSortingStrategy}>
              {section.fields.map((f) => (
                <FieldRow key={f.id} field={f} onToggle={onToggleField} />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The detail-page "Gerenciar seções" popover — mirrors the DataTable column manager: search,
 * Selecionar/Desmarcar todas, drag-reorder sections, layout control per section (½ left / ½ right
 * / full), and a nested drag-reorder + show/hide of each section's fields. All changes flow into
 * the engine → debounced server persistence.
 */
export function DetailCustomizeManager({
  sections,
  sectionOrder,
  onSectionOrderChange,
  onToggleSection,
  onToggleField,
  onSetWidth,
  onSetColumn,
  onFieldOrderChange,
  onSetAll,
  onReset,
  visibleCount,
  totalCount,
  triggerClassName,
}: DetailCustomizeManagerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const filtered = useMemo(() => {
    if (!search) return sections;
    const q = search.toLowerCase();
    return sections.filter((s) => typeof s.label !== "string" || s.label.toLowerCase().includes(q));
  }, [sections, search]);
  const dragDisabled = search.length > 0;

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = sectionOrder.indexOf(String(active.id));
    const to = sectionOrder.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onSectionOrderChange(arrayMove(sectionOrder, from, to));
  };

  const rows = filtered.map((s) => (
    <SectionRow
      key={s.id}
      section={s}
      dragDisabled={dragDisabled}
      onToggleSection={onToggleSection}
      onToggleField={onToggleField}
      onSetWidth={onSetWidth}
      onSetColumn={onSetColumn}
      onFieldOrderChange={onFieldOrderChange}
    />
  ));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-2", triggerClassName)}>
          <IconLayoutGrid className="h-4 w-4" />
          Seções ({visibleCount}/{totalCount})
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[28rem] p-0" align="end">
        <div className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-medium">Gerenciar seções</h4>
            <Button variant="ghost" size="sm" onClick={onReset} className="h-7 px-2 text-xs">
              <IconRefresh className="mr-1 h-3 w-3" />
              Restaurar
            </Button>
          </div>
          <div className="relative mb-2">
            <IconSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input type="text" placeholder="Buscar seção..." value={search} onChange={(v) => setSearch(String(v || ""))} className="h-9 bg-transparent pl-9" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onSetAll(true)} className="h-7 flex-1 text-xs">
              Selecionar Todas
            </Button>
            <Button variant="outline" size="sm" onClick={() => onSetAll(false)} className="h-7 flex-1 text-xs">
              Desmarcar Todas
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[320px]">
          <div className="p-2 pt-0">
            {dragDisabled ? (
              rows
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={filtered.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                  {rows}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
