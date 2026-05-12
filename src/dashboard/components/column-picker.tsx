// Column picker — ONE unified list of all columns.
//
// Each row carries: drag handle + checkbox (visibility) + label (or rename input)
// + optional sort priority/direction chip + optional reset-to-default button.
//
// Shape of UX:
//   ┌───────────────────────────────────────────────────────────────────┐
//   │ Colunas (5/32)                                       [Limpar]      │
//   │ ⋮⋮ ☑ [Logomarca________]              [   ]                        │  ← visible: drag-sortable, sort chip
//   │ ⋮⋮ ☑ [Cliente__________]   [↺]        [1↑ ✕]                       │  ← in sort list, priority + dir + remove
//   │ ⋮⋮ ☑ [Identificador____]              [2↓ ✕]                       │
//   │ ⋮⋮ ☑ [Prazo____________]              [   ]                        │
//   │ ⋮⋮ ☑ [Setor____________]              [   ]                        │
//   │ ──────────────────────────────────────────────────────────────────│
//   │ ⋮⋮ ☐ [Status___________]                                           │  ← hidden: no sort chip
//   │ ⋮⋮ ☐ [Tempo restante___]                                           │
//   └───────────────────────────────────────────────────────────────────┘
//
// Visible columns sit on top in their stored order (drag to reorder).
// Hidden columns sit below in alphabetical (catalog) order.
// Reordering hidden rows is a no-op since their position is implicit.
//
// When `labelOverrides` + `onLabelChange` are passed, the per-row text becomes
// an editable input; otherwise it's a plain label.
//
// When `sorts` + `onSortsChange` are passed, each VISIBLE row shows a sort chip
// on the right. Clicking an empty chip appends the column to the sorts list
// with `asc`. Clicking a chip already in the list toggles direction. The small
// ✕ removes the column from the sort list. Hidden rows never show the chip
// (hidden columns can't drive sort).
//
// All new props are optional, preserving full backward compat with existing
// widgets that don't pass them.

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
import {
  IconChevronUp,
  IconChevronDown,
  IconSelector,
  IconGripVertical,
  IconRotateClockwise,
} from "@tabler/icons-react";

export interface ColumnDescriptor<K extends string> {
  key: K;
  label: string;
}

export interface ColumnSort<K extends string> {
  key: K;
  direction: "asc" | "desc";
}

interface ColumnPickerProps<K extends string> {
  catalog: ColumnDescriptor<K>[];
  selected: K[];
  onChange: (next: K[]) => void;
  /**
   * Optional map of custom header label overrides keyed by column key.
   * When provided alongside `onLabelChange`, each row's name becomes an
   * editable input pre-filled with the override (or empty if none).
   */
  labelOverrides?: Partial<Record<K, string>>;
  /**
   * Called whenever a row's rename input changes. The handler receives the
   * trimmed value and decides whether to store it (non-empty) or unset it.
   * If omitted, the rename UI is not shown.
   */
  onLabelChange?: (key: K, value: string) => void;
  /**
   * Optional ordered sort list (priority by index). When passed together with
   * `onSortsChange`, each visible row renders a sort chip on the right.
   */
  sorts?: ColumnSort<K>[];
  /**
   * Called when the user toggles direction, adds, or removes a sort. The
   * handler should replace the entire list. Required (alongside `sorts`) to
   * enable the sort chip column.
   */
  onSortsChange?: (next: ColumnSort<K>[]) => void;
  /**
   * Maximum number of simultaneous sort columns. Defaults to 5. Once reached,
   * empty chips become disabled. Set to 0 / negative to remove the cap.
   */
  maxSorts?: number;
}

export function ColumnPicker<K extends string>({
  catalog,
  selected,
  onChange,
  labelOverrides,
  onLabelChange,
  sorts,
  onSortsChange,
  maxSorts = 5,
}: ColumnPickerProps<K>) {
  const renameEnabled = typeof onLabelChange === "function";
  const sortEnabled = Array.isArray(sorts) && typeof onSortsChange === "function";

  const byKey = useMemo(() => {
    const m = new Map<K, ColumnDescriptor<K>>();
    for (const c of catalog) m.set(c.key, c);
    return m;
  }, [catalog]);

  // Visible (selected) keys in stored order, then hidden keys in catalog order.
  const orderedKeys = useMemo<K[]>(() => {
    const selectedSet = new Set(selected);
    const visible = selected.filter((k) => byKey.has(k));
    const hidden = catalog.filter((c) => !selectedSet.has(c.key)).map((c) => c.key);
    return [...visible, ...hidden];
  }, [catalog, selected, byKey]);

  // Build a quick lookup for sort priority/direction by key.
  const sortIndex = useMemo(() => {
    const m = new Map<K, { priority: number; direction: "asc" | "desc" }>();
    if (sorts) {
      sorts.forEach((s, i) => m.set(s.key, { priority: i + 1, direction: s.direction }));
    }
    return m;
  }, [sorts]);

  const visibleCount = selected.length;
  const totalCount = catalog.length;
  const sortCapReached = sortEnabled && maxSorts > 0 && (sorts?.length ?? 0) >= maxSorts;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeKey = active.id as K;
    const overKey = over.id as K;
    const activeIsVisible = selected.includes(activeKey);
    const overIsVisible = selected.includes(overKey);

    // Only meaningful when both rows are in the visible (sortable) part.
    // Dragging a hidden row, or dropping into the hidden section, is ignored
    // because hidden ordering is implicit (catalog order).
    if (!activeIsVisible || !overIsVisible) return;
    const oldIndex = selected.indexOf(activeKey);
    const newIndex = selected.indexOf(overKey);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(selected, oldIndex, newIndex));
  };

  const toggle = (key: K) => {
    if (selected.includes(key)) {
      if (selected.length <= 1) return; // never allow zero columns
      onChange(selected.filter((k) => k !== key));
      // If this column was driving sort, drop it from the sorts list too.
      if (sortEnabled && sorts?.some((s) => s.key === key)) {
        onSortsChange!(sorts!.filter((s) => s.key !== key));
      }
    } else {
      onChange([...selected, key]);
    }
  };

  // Sort chip cycles state: NÃO → ASC → DESC → NÃO. One button, three labels.
  const onSortChipClick = (key: K) => {
    if (!sortEnabled) return;
    const current = sorts!;
    const existing = current.find((s) => s.key === key);
    if (!existing) {
      // NÃO → ASC: add at end (respect cap).
      if (maxSorts > 0 && current.length >= maxSorts) return;
      onSortsChange!([...current, { key, direction: "asc" }]);
    } else if (existing.direction === "asc") {
      // ASC → DESC: flip in place.
      onSortsChange!(
        current.map((s) => (s.key === key ? { ...s, direction: "desc" } : s)),
      );
    } else {
      // DESC → NÃO: remove.
      onSortsChange!(current.filter((s) => s.key !== key));
    }
  };

  return (
    <div className="space-y-2">
      <div className="border border-border rounded-md">
        <div className="flex items-center px-3 py-2 border-b border-border bg-muted/30">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Colunas ({visibleCount}/{totalCount})
          </span>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={orderedKeys} strategy={verticalListSortingStrategy}>
            <ul className="divide-y divide-border">
              {orderedKeys.map((key, idx) => {
                const def = byKey.get(key);
                if (!def) return null;
                const isVisible = selected.includes(key);
                // Insert a subtle separator between visible and hidden groups.
                const prevKey = orderedKeys[idx - 1];
                const prevIsVisible = prevKey ? selected.includes(prevKey) : true;
                const isFirstHidden = !isVisible && prevIsVisible && idx > 0;
                const sortInfo = sortIndex.get(key);
                return (
                  <SortableRow
                    key={key}
                    id={key}
                    label={def.label}
                    isVisible={isVisible}
                    canUncheck={visibleCount > 1}
                    onToggle={() => toggle(key)}
                    renameEnabled={renameEnabled}
                    overrideValue={labelOverrides?.[key] ?? ""}
                    onRename={(v) => onLabelChange?.(key, v)}
                    showGroupSeparator={isFirstHidden}
                    sortEnabled={sortEnabled}
                    sortInfo={sortInfo}
                    sortCapReached={sortCapReached}
                    onSortChipClick={() => onSortChipClick(key)}
                  />
                );
              })}
            </ul>
          </SortableContext>
        </DndContext>
      </div>

      <p className="text-[11px] text-muted-foreground">
        {sortEnabled
          ? renameEnabled
            ? "Marque para exibir, arraste pela alça para reordenar, edite o nome do cabeçalho e use o chip à direita para definir a ordenação."
            : "Marque para exibir, arraste pela alça para reordenar e use o chip à direita para definir a ordenação."
          : renameEnabled
            ? "Marque para exibir, arraste pela alça para reordenar e edite o nome do cabeçalho diretamente em cada linha."
            : "Marque as colunas que deseja exibir. Arraste pela alça para reordenar — a ordem aqui define a ordem na tabela."}
      </p>
    </div>
  );
}

// ----- Sortable row -----

function SortableRow<K extends string>({
  id,
  label,
  isVisible,
  canUncheck,
  onToggle,
  renameEnabled,
  overrideValue,
  onRename,
  showGroupSeparator,
  sortEnabled,
  sortInfo,
  sortCapReached,
  onSortChipClick,
}: {
  id: K;
  label: string;
  isVisible: boolean;
  canUncheck: boolean;
  onToggle: () => void;
  renameEnabled: boolean;
  overrideValue: string;
  onRename: (value: string) => void;
  showGroupSeparator: boolean;
  sortEnabled: boolean;
  sortInfo: { priority: number; direction: "asc" | "desc" } | undefined;
  sortCapReached: boolean;
  onSortChipClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    // Hidden rows participate in the sortable context so dnd-kit measures them
    // and renders smooth transitions, but reorder events involving them are
    // ignored at the parent level.
    disabled: !isVisible,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
    zIndex: isDragging ? 10 : undefined,
  };
  const hasOverride = renameEnabled && overrideValue.trim().length > 0;
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-3 py-1.5 bg-card hover:bg-accent/30 ${
        showGroupSeparator ? "border-t-2 border-t-border/70" : ""
      } ${isVisible ? "" : "opacity-70"}`}
    >
      <button
        type="button"
        className={`text-muted-foreground hover:text-foreground shrink-0 ${
          isVisible
            ? "cursor-grab active:cursor-grabbing"
            : "cursor-not-allowed opacity-40"
        }`}
        aria-label={isVisible ? "Arrastar coluna" : "Marque para reordenar"}
        disabled={!isVisible}
        {...attributes}
        {...listeners}
      >
        <IconGripVertical className="h-3.5 w-3.5" />
      </button>
      <input
        type="checkbox"
        checked={isVisible}
        onChange={onToggle}
        disabled={isVisible && !canUncheck}
        aria-label={isVisible ? `Ocultar ${label}` : `Mostrar ${label}`}
        className="h-3.5 w-3.5 rounded border-border accent-primary disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
      />
      {renameEnabled ? (
        <input
          type="text"
          value={overrideValue}
          onChange={(e) => onRename(e.target.value)}
          placeholder={label}
          aria-label={`Renomear ${label}`}
          className="flex-1 min-w-0 h-7 px-2 text-sm rounded bg-transparent border-0 shadow-none outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 placeholder:text-muted-foreground hover:bg-accent/40 focus:bg-accent/40 transition-colors"
        />
      ) : (
        <span className="flex-1 text-sm truncate">{label}</span>
      )}
      {sortEnabled && isVisible && (
        <SortChip
          info={sortInfo}
          capReached={sortCapReached}
          label={label}
          onClick={onSortChipClick}
        />
      )}
      {renameEnabled && (
        <button
          type="button"
          onClick={() => onRename("")}
          disabled={!hasOverride}
          aria-label={`Restaurar nome padrão de ${label}`}
          className="shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <IconRotateClockwise className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  );
}

// ----- Sort chip — single button, three states (NÃO → ASC → DESC → NÃO) -----

function SortChip({
  info,
  capReached,
  label,
  onClick,
}: {
  info: { priority: number; direction: "asc" | "desc" } | undefined;
  capReached: boolean;
  label: string;
  onClick: () => void;
}) {
  // No state → "NÃO" outline pill with chevron-up-down (unsorted) icon.
  if (!info) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={capReached}
        aria-label={`Ordenar por ${label}`}
        className="shrink-0 inline-flex items-center justify-center gap-1.5 h-8 min-w-[5.5rem] px-3 rounded-md border-2 border-border bg-card text-muted-foreground text-[11px] font-bold uppercase tracking-wide hover:border-primary hover:bg-primary/5 hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <IconSelector className="h-4 w-4" />
        <span>Não</span>
      </button>
    );
  }
  // Active — solid primary pill with priority badge + ASC/DESC label + chevron.
  const DirIcon = info.direction === "asc" ? IconChevronUp : IconChevronDown;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Alternar ordenação de ${label} (atual: ${info.direction === "asc" ? "Crescente" : "Decrescente"})`}
      className="shrink-0 inline-flex items-center gap-1.5 h-8 min-w-[5.5rem] px-2.5 rounded-md border-2 border-primary bg-primary text-primary-foreground text-[11px] font-bold uppercase tracking-wide hover:bg-primary/85 transition-colors shadow-sm tabular-nums"
    >
      <span className="inline-flex items-center justify-center h-5 min-w-5 px-1 rounded bg-primary-foreground/25 text-[10px]">
        {info.priority}
      </span>
      <DirIcon className="h-4 w-4" />
      <span>{info.direction === "asc" ? "Asc" : "Desc"}</span>
    </button>
  );
}
