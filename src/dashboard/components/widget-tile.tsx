// Per-widget grid cell. Provides drag-reorder, edit chrome, and grid spans.
//
// IMPORTANT: the tile is intentionally chromeless so each widget can supply its
// own visual style (the existing home-dashboard components, for instance, use
// `DashboardCardList` which already renders a card border). Edit-mode controls
// are an absolute-positioned floating toolbar at the top of the tile so they
// don't double up the chrome.

import { Suspense, useMemo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  IconGripVertical,
  IconSettings,
  IconTrash,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { Button } from "../../components/ui/button";
import { SizeSelector } from "./size-selector";
import { widgetRegistry } from "../registry";
import type { WidgetInstance, WidgetSize } from "../types";

interface WidgetTileProps {
  instance: WidgetInstance;
  isEditing: boolean;
  responsiveCols: number;
  onResize: (size: WidgetSize) => void;
  onConfigure: () => void;
  onRemove: () => void;
}

export function WidgetTile({
  instance,
  isEditing,
  responsiveCols,
  onResize,
  onConfigure,
  onRemove,
}: WidgetTileProps) {
  const def = widgetRegistry.get(instance.widgetId);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: instance.instanceId,
    disabled: !isEditing,
  });

  const colSpan = Math.min(instance.size.cols, responsiveCols);
  const rowSpan = instance.size.rows;

  const style = useMemo(
    () => ({
      gridColumn: `span ${colSpan}`,
      gridRow: `span ${rowSpan}`,
      transform: CSS.Translate.toString(transform),
      transition,
      zIndex: isDragging ? 30 : undefined,
      opacity: isDragging ? 0.6 : undefined,
    }),
    [colSpan, rowSpan, transform, transition, isDragging],
  );

  if (!def) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-4 flex flex-col items-start gap-2"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-destructive">
          <IconAlertTriangle className="h-4 w-4" />
          Widget não encontrado
        </div>
        <p className="text-xs text-muted-foreground">
          ID <code className="font-mono">{instance.widgetId}</code> não está registrado.
        </p>
        {isEditing && (
          <Button variant="ghost" size="sm" onClick={onRemove} className="h-7 mt-1">
            <IconTrash className="h-3.5 w-3.5 mr-1" /> Remover
          </Button>
        )}
      </div>
    );
  }

  const Render = def.RenderComponent;
  const ConfigComponent = def.ConfigComponent;
  const hasConfigUi = !!ConfigComponent || !isEmptyConfigSchema(def.configSchema);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative h-full min-h-0 ${isEditing ? "ring-2 ring-primary/40 ring-offset-2 ring-offset-background rounded-lg" : ""}`}
    >
      {/* Edit-mode floating toolbar — overlays the top of the tile without consuming layout space */}
      {isEditing && (
        <div className="absolute top-1 right-1 z-20 flex items-center gap-0.5 rounded-md border border-border bg-card/95 backdrop-blur-sm shadow-md p-0.5">
          <button
            type="button"
            className="cursor-grab active:cursor-grabbing rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent"
            aria-label={`Arrastar ${def.name}`}
            {...attributes}
            {...listeners}
          >
            <IconGripVertical className="h-4 w-4" />
          </button>
          <SizeSelector
            value={instance.size}
            min={def.minSize}
            max={def.maxSize}
            onChange={onResize}
          />
          {hasConfigUi && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={onConfigure}
              title="Configurar widget"
            >
              <IconSettings className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            onClick={onRemove}
            title="Remover widget"
          >
            <IconTrash className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      <div className="h-full min-h-0">
        <Suspense
          fallback={
            <div className="h-full w-full animate-pulse rounded-lg bg-muted/30" />
          }
        >
          <Render
            instanceId={instance.instanceId}
            config={instance.config}
            size={instance.size}
            isEditing={isEditing}
          />
        </Suspense>
      </div>
    </div>
  );
}

function isEmptyConfigSchema(schema: unknown): boolean {
  if (!schema || typeof schema !== "object") return true;
  const def = (schema as { _def?: { typeName?: string; shape?: () => unknown } })._def;
  if (def?.typeName !== "ZodObject") return false;
  try {
    const shape = def.shape?.();
    return !shape || Object.keys(shape as object).length === 0;
  } catch {
    return false;
  }
}
