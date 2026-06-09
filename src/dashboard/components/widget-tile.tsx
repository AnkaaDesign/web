// Per-widget grid cell. Provides drag-reorder, edit chrome, and grid spans.
//
// IMPORTANT: the tile is intentionally chromeless so each widget can supply its
// own visual style (the existing home-dashboard components, for instance, use
// `DashboardCardList` which already renders a card border). Edit-mode controls
// are an absolute-positioned floating toolbar at the top of the tile so they
// don't double up the chrome.

import { Suspense, useMemo, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  IconGripVertical,
  IconSettings,
  IconTrash,
  IconAlertTriangle,
  IconLock,
  IconPencil,
} from "@tabler/icons-react";
import { Button } from "../../components/ui/button";
import { ErrorBoundary } from "../../components/ui/error-boundary";
import { SizeSelector } from "./size-selector";
import { WidgetChromeProvider } from "./widget-chrome-context";
import { widgetRegistry } from "../registry";
import type { WidgetInstance, WidgetSize } from "../types";

// A widget can throw when its data fetch hits a 403 (e.g. an ADMIN-only stats
// endpoint hit by a user whose sector was changed since the layout was saved).
// We don't want that to crash the dashboard or unmount sibling widgets — and
// 403 in particular is a permission issue, not a real error, so we render a
// quiet placeholder rather than an alarming red banner.
function isForbiddenError(error: Error): boolean {
  const anyErr = error as { statusCode?: number; response?: { status?: number }; _statusCode?: number };
  if (anyErr.statusCode === 403 || anyErr._statusCode === 403 || anyErr.response?.status === 403) return true;
  return /403|forbidden|privilégios|acesso negado/i.test(error.message || "");
}

function WidgetErrorFallback({ error }: { error: Error; reset: () => void }) {
  if (isForbiddenError(error)) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center gap-2">
        <IconLock className="h-5 w-5 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Sem permissão para este widget</p>
      </div>
    );
  }
  return (
    <div className="h-full w-full flex flex-col items-center justify-center rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-4 text-center gap-2">
      <IconAlertTriangle className="h-5 w-5 text-destructive" />
      <p className="text-xs text-muted-foreground">Não foi possível carregar este widget</p>
    </div>
  );
}

interface WidgetTileProps {
  instance: WidgetInstance;
  isEditing: boolean;
  responsiveCols: number;
  onResize: (size: WidgetSize) => void;
  onConfigure: () => void;
  /** Persist a new title for this instance (writes config.title). */
  onRenameCommit: (title: string) => void;
  onRemove: () => void;
}

export function WidgetTile({
  instance,
  isEditing,
  responsiveCols,
  onResize,
  onConfigure,
  onRenameCommit,
  onRemove,
}: WidgetTileProps) {
  const def = widgetRegistry.get(instance.widgetId);
  const [renameSignal, setRenameSignal] = useState(0);

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

  // Run the saved config through the widget's Zod schema so any newly-added
  // fields with defaults are backfilled on layouts saved before the field
  // existed. Falls back to `defaultConfig` if the saved config is unparseable
  // (corruption / a renamed field with no migration). Without this, adding a
  // new sub-object like `display: { density, ... }` would crash render for
  // every existing instance until the user opens-and-saves the widget.
  const parsedConfig = useMemo(() => {
    const result = def.configSchema.safeParse(instance.config);
    return result.success ? result.data : def.defaultConfig;
  }, [def.configSchema, def.defaultConfig, instance.config]);

  // Title shown in the widget header (config.title), falling back to the
  // widget's display name. Used to seed the inline rename input.
  const currentTitle = useMemo(() => {
    const c = parsedConfig as { title?: unknown } | null;
    const t = c && typeof c === "object" ? c.title : undefined;
    return typeof t === "string" && t.trim() ? t : def.name;
  }, [parsedConfig, def.name]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative h-full min-h-0 ${isEditing ? "ring-2 ring-primary/40 ring-offset-2 ring-offset-background rounded-lg" : ""}`}
    >
      {/* Edit-mode floating toolbars — drag handle on the left next to the
          title, action toolbar on the right. Sit above the card content with
          high z-index so they're always clickable, even when the widget hides
          its own header (`showHeader=false`) and the table content reaches
          the very top edge. */}
      {isEditing && (
        <>
          <button
            type="button"
            className="absolute top-2 left-2 z-50 cursor-grab active:cursor-grabbing rounded-md border border-border bg-card shadow-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent pointer-events-auto"
            aria-label={`Arrastar ${def.name}`}
            {...attributes}
            {...listeners}
          >
            <IconGripVertical className="h-4 w-4" />
          </button>
          <div className="absolute top-2 right-2 z-50 flex items-center gap-0.5 rounded-md border border-border bg-card shadow-md p-0.5 pointer-events-auto">
            <SizeSelector
              value={instance.size}
              min={def.minSize}
              max={def.maxSize}
              onChange={onResize}
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setRenameSignal((n) => n + 1)}
              title="Renomear widget"
            >
              <IconPencil className="h-3.5 w-3.5" />
            </Button>
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
        </>
      )}
      <div className="h-full min-h-0">
        <ErrorBoundary fallback={WidgetErrorFallback}>
          <Suspense
            fallback={
              <div className="h-full w-full animate-pulse rounded-lg bg-muted/30" />
            }
          >
            <WidgetChromeProvider
              value={{
                isEditing,
                currentTitle,
                renameSignal,
                onRenameCommit: isEditing ? onRenameCommit : undefined,
              }}
            >
              <Render
                instanceId={instance.instanceId}
                config={parsedConfig}
                size={instance.size}
                isEditing={isEditing}
              />
            </WidgetChromeProvider>
          </Suspense>
        </ErrorBoundary>
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
