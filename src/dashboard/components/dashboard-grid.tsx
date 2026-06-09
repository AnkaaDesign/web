// 4-column responsive grid wrapping all widget tiles. Drag-reorder via dnd-kit.
//
// Responsive columns:
//   - viewport ≥ 1024px (lg): 4 columns
//   - viewport ≥ 640px  (sm): 2 columns
//   - viewport <  640px:      1 column
// Widget col-spans are clamped to the current viewport's column count, so a
// 4-wide widget on mobile becomes full-width without needing CSS hacks.

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import { WidgetTile } from "./widget-tile";
import type { DashboardLayout, WidgetInstance, WidgetSize } from "../types";

interface DashboardGridProps {
  layout: DashboardLayout;
  isEditing: boolean;
  onReorder: (items: WidgetInstance[]) => void;
  onResize: (instanceId: string, size: WidgetSize) => void;
  onConfigure: (instanceId: string) => void;
  onRenameCommit: (instanceId: string, title: string) => void;
  onRemove: (instanceId: string) => void;
}

function useResponsiveCols(): 1 | 2 | 4 {
  const [cols, setCols] = useState<1 | 2 | 4>(() => resolve());
  useEffect(() => {
    const onResize = () => setCols(resolve());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return cols;
}

function resolve(): 1 | 2 | 4 {
  if (typeof window === "undefined") return 4;
  const w = window.innerWidth;
  if (w >= 1024) return 4;
  if (w >= 640) return 2;
  return 1;
}

export function DashboardGrid({
  layout,
  isEditing,
  onReorder,
  onResize,
  onConfigure,
  onRenameCommit,
  onRemove,
}: DashboardGridProps) {
  const responsiveCols = useResponsiveCols();

  const sensors = useSensors(
    // 8px activation distance prevents accidental drags on click — important
    // because tiles also contain interactive children (links, buttons).
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = useMemo(() => layout.items.map((it) => it.instanceId), [layout.items]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = layout.items.findIndex((it) => it.instanceId === active.id);
    const newIndex = layout.items.findIndex((it) => it.instanceId === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(layout.items, oldIndex, newIndex));
  };

  if (layout.items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
        <p className="text-sm">Nenhum widget adicionado.</p>
        <p className="text-xs mt-1">
          {isEditing
            ? "Use o botão “Adicionar widget” no topo para começar."
            : "Entre no modo de edição para adicionar widgets."}
        </p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div
          className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
          style={{ gridAutoRows: "180px" }}
        >
          {layout.items.map((instance) => (
            <WidgetTile
              key={instance.instanceId}
              instance={instance}
              isEditing={isEditing}
              responsiveCols={responsiveCols}
              onResize={(size) => onResize(instance.instanceId, size)}
              onConfigure={() => onConfigure(instance.instanceId)}
              onRenameCommit={(title) => onRenameCommit(instance.instanceId, title)}
              onRemove={() => onRemove(instance.instanceId)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
