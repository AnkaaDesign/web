// Column picker — two sections, both keyed off checkboxes for visibility,
// with drag-reorder on the visible section.
//
// Shape of UX:
//   ┌──────────────────────────────────────────┐
//   │ Visíveis (4)                  [Limpar]   │
//   │ ⋮⋮ ☑ Logomarca                            │  ← drag-sortable; uncheck removes
//   │ ⋮⋮ ☑ Cliente                              │
//   │ ⋮⋮ ☑ Identificador                        │
//   │ ⋮⋮ ☑ Prazo                                │
//   ├──────────────────────────────────────────┤
//   │ Disponíveis                               │
//   │ ☐ Setor          ☐ Status                 │  ← 2-col grid; check adds
//   │ ☐ Tempo restante ☐ ...                    │
//   └──────────────────────────────────────────┘
//
// Single mental model — "check the columns I want, drag to order them."
// Order is preserved only for visible (checked) columns; unchecked columns
// fall back to the catalog order.
//
// Generic over a key type so it can be reused by any table widget. dnd-kit
// is already loaded for the dashboard grid, so we reuse it.

import { useMemo } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IconGripVertical } from "@tabler/icons-react";

export interface ColumnDescriptor<K extends string> {
  key: K;
  label: string;
}

interface ColumnPickerProps<K extends string> {
  catalog: ColumnDescriptor<K>[];
  selected: K[];
  onChange: (next: K[]) => void;
}

export function ColumnPicker<K extends string>({
  catalog,
  selected,
  onChange,
}: ColumnPickerProps<K>) {
  const byKey = useMemo(() => {
    const m = new Map<K, ColumnDescriptor<K>>();
    for (const c of catalog) m.set(c.key, c);
    return m;
  }, [catalog]);

  const available = useMemo(
    () =>
      catalog
        .filter((c) => !selected.includes(c.key))
        .slice()
        .sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
    [catalog, selected],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = selected.indexOf(active.id as K);
    const newIndex = selected.indexOf(over.id as K);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(selected, oldIndex, newIndex));
  };

  const remove = (key: K) => {
    if (selected.length <= 1) return; // never allow zero columns
    onChange(selected.filter((k) => k !== key));
  };
  const add = (key: K) => {
    if (selected.includes(key)) return;
    onChange([...selected, key]);
  };
  const clear = () => {
    if (selected.length <= 1) return;
    onChange([selected[0]]); // keep one to avoid empty state
  };

  return (
    <div className="space-y-3">
      <div className="border border-border rounded-md">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Visíveis ({selected.length})
          </span>
          {selected.length > 1 && (
            <button
              type="button"
              onClick={clear}
              className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
            >
              Limpar
            </button>
          )}
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={selected} strategy={verticalListSortingStrategy}>
            <ul className="divide-y divide-border">
              {selected.map((key) => {
                const def = byKey.get(key);
                if (!def) return null;
                return (
                  <SortableRow
                    key={key}
                    id={key}
                    label={def.label}
                    onToggle={() => remove(key)}
                    canUncheck={selected.length > 1}
                  />
                );
              })}
            </ul>
          </SortableContext>
        </DndContext>
      </div>

      {available.length > 0 && (
        <div className="border border-border rounded-md">
          <div className="px-3 py-2 border-b border-border bg-muted/30">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Disponíveis ({available.length})
            </span>
          </div>
          <ul className="grid grid-cols-2 divide-y divide-border max-h-48 overflow-y-auto">
            {available.map((c) => (
              <li
                key={c.key}
                className="col-span-1 odd:border-r odd:border-border last:odd:border-r-0"
              >
                <label className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={() => add(c.key)}
                    className="h-3.5 w-3.5 rounded border-border accent-primary shrink-0"
                  />
                  <span className="truncate">{c.label}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Marque as colunas que deseja exibir. Arraste pela alça para reordenar — a ordem aqui define a ordem na tabela.
      </p>
    </div>
  );
}

// ----- Sortable row -----

function SortableRow<K extends string>({
  id,
  label,
  onToggle,
  canUncheck,
}: {
  id: K;
  label: string;
  onToggle: () => void;
  canUncheck: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-3 py-1.5 bg-card hover:bg-accent/30"
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
        aria-label="Arrastar coluna"
        {...attributes}
        {...listeners}
      >
        <IconGripVertical className="h-3.5 w-3.5" />
      </button>
      <input
        type="checkbox"
        checked
        onChange={onToggle}
        disabled={!canUncheck}
        aria-label={`Ocultar ${label}`}
        className="h-3.5 w-3.5 rounded border-border accent-primary disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
      />
      <span className="flex-1 text-sm truncate">{label}</span>
    </li>
  );
}
