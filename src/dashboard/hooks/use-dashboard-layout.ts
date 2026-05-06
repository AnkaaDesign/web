// Edit-mode state machine + persistence for the home dashboard layout.
//
// Read flow: preferences.dashboardLayoutWeb (JSON) → parsed via dashboardLayoutSchema.
// If absent or invalid → fall back to the sector preset for the current user.
//
// Edit flow: enterEdit() snapshots the current layout. Mutations (add/remove/reorder/
// resize/configure) update local working state and mark dirty. saveAndExit() PUTs
// to /preferences/:id; discardAndExit() restores from the snapshot.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "../../contexts/auth-context";
import { usePrivileges } from "../../hooks/common/use-privileges";
import { useMyPreferences } from "./use-my-preferences";
import { widgetRegistry } from "../registry";
import { parseLayout } from "../schemas";
import { DASHBOARD_LAYOUT_VERSION } from "../types";
import type { DashboardLayout, WidgetInstance, WidgetSize } from "../types";
import { getDefaultLayoutForSector } from "../presets";

function clampSize(widgetId: string, requested: WidgetSize): WidgetSize {
  const def = widgetRegistry.get(widgetId);
  if (!def) return requested;
  const cols = Math.max(def.minSize.cols, Math.min(def.maxSize.cols, requested.cols)) as WidgetSize["cols"];
  const rows = Math.max(def.minSize.rows, Math.min(def.maxSize.rows, requested.rows)) as WidgetSize["rows"];
  return { cols, rows };
}

function newInstanceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for older environments — non-RFC but unique enough for instance IDs
  return `inst-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Strip widgets the user is no longer allowed to use (sector changed, widget removed).
 * Also clamps each instance's size to the current widget's min/max.
 */
function sanitizeLayout(
  layout: DashboardLayout,
  userSector: ReturnType<typeof usePrivileges>["currentPrivilege"],
): DashboardLayout {
  const items = layout.items.flatMap<WidgetInstance>((item) => {
    if (!widgetRegistry.has(item.widgetId)) return [];
    if (!widgetRegistry.canUserUse(item.widgetId, userSector)) return [];
    return [{ ...item, size: clampSize(item.widgetId, item.size) }];
  });
  return { ...layout, items };
}

export interface UseDashboardLayoutReturn {
  layout: DashboardLayout;
  isLoading: boolean;
  isSaving: boolean;
  isDirty: boolean;
  isEditing: boolean;
  enterEdit: () => void;
  saveAndExit: () => Promise<void>;
  discardAndExit: () => void;
  addWidget: (widgetId: string, config?: unknown) => void;
  removeWidget: (instanceId: string) => void;
  /** Reorder by replacing the items array — used by dnd-kit on drag end. */
  reorderItems: (items: WidgetInstance[]) => void;
  resizeWidget: (instanceId: string, size: WidgetSize) => void;
  configureWidget: (instanceId: string, config: unknown) => void;
  /** Reset the layout to the sector default. Useful on first run / corruption recovery. */
  resetToPreset: () => void;
}

export function useDashboardLayout(): UseDashboardLayoutReturn {
  const { user } = useAuth();
  const { currentPrivilege } = usePrivileges();
  const { preferences, isLoading, isUpdating, updateMine } = useMyPreferences();

  // Resolve persisted layout, falling back to sector preset.
  const persisted = useMemo<DashboardLayout>(() => {
    const parsed = preferences ? parseLayout(preferences.dashboardLayoutWeb) : null;
    const base = parsed ?? getDefaultLayoutForSector(currentPrivilege);
    return sanitizeLayout(base, currentPrivilege);
    // Re-resolve when user/sector changes or preferences arrive.
  }, [preferences, currentPrivilege]);

  // Working layout (mutated during edit mode). Synced to `persisted` while not editing.
  const [working, setWorking] = useState<DashboardLayout>(persisted);
  const [isEditing, setIsEditing] = useState(false);
  const snapshotRef = useRef<DashboardLayout | null>(null);

  // Keep working state in sync with persisted whenever NOT editing.
  useEffect(() => {
    if (!isEditing) {
      setWorking(persisted);
    }
  }, [persisted, isEditing]);

  const isDirty = useMemo(() => {
    if (!isEditing || !snapshotRef.current) return false;
    // Cheap: compare via JSON. Layout is always small (<1KB).
    return JSON.stringify(snapshotRef.current) !== JSON.stringify(working);
  }, [isEditing, working]);

  const enterEdit = useCallback(() => {
    snapshotRef.current = working;
    setIsEditing(true);
  }, [working]);

  const discardAndExit = useCallback(() => {
    if (snapshotRef.current) {
      setWorking(snapshotRef.current);
    }
    snapshotRef.current = null;
    setIsEditing(false);
  }, []);

  const saveAndExit = useCallback(async () => {
    const next: DashboardLayout = {
      ...working,
      version: DASHBOARD_LAYOUT_VERSION,
      updatedAt: new Date().toISOString(),
    };
    try {
      await updateMine({ dashboardLayoutWeb: next as unknown as any });
      snapshotRef.current = null;
      setIsEditing(false);
      toast.success("Layout salvo");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao salvar layout";
      toast.error(message);
      throw err;
    }
  }, [working, updateMine]);

  const addWidget = useCallback(
    (widgetId: string, config?: unknown) => {
      const def = widgetRegistry.get(widgetId);
      if (!def) return;
      if (!widgetRegistry.canUserUse(widgetId, currentPrivilege)) {
        toast.error("Você não tem permissão para adicionar este widget.");
        return;
      }
      setWorking((prev) => ({
        ...prev,
        items: [
          ...prev.items,
          {
            instanceId: newInstanceId(),
            widgetId,
            size: def.defaultSize,
            config: config ?? def.defaultConfig,
          },
        ],
      }));
    },
    [currentPrivilege],
  );

  const removeWidget = useCallback((instanceId: string) => {
    setWorking((prev) => ({
      ...prev,
      items: prev.items.filter((it) => it.instanceId !== instanceId),
    }));
  }, []);

  const reorderItems = useCallback((items: WidgetInstance[]) => {
    setWorking((prev) => ({ ...prev, items }));
  }, []);

  const resizeWidget = useCallback((instanceId: string, size: WidgetSize) => {
    setWorking((prev) => ({
      ...prev,
      items: prev.items.map((it) =>
        it.instanceId === instanceId ? { ...it, size: clampSize(it.widgetId, size) } : it,
      ),
    }));
  }, []);

  const configureWidget = useCallback((instanceId: string, config: unknown) => {
    setWorking((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.instanceId === instanceId ? { ...it, config } : it)),
    }));
  }, []);

  const resetToPreset = useCallback(() => {
    const preset = getDefaultLayoutForSector(currentPrivilege);
    setWorking(sanitizeLayout(preset, currentPrivilege));
  }, [currentPrivilege]);

  return {
    layout: working,
    isLoading: isLoading || !user,
    isSaving: isUpdating,
    isDirty,
    isEditing,
    enterEdit,
    saveAndExit,
    discardAndExit,
    addWidget,
    removeWidget,
    reorderItems,
    resizeWidget,
    configureWidget,
    resetToPreset,
  };
}
