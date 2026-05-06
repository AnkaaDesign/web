// Widget registry — single source of truth for which widgets exist
// and which sectors can use them.
//
// Widgets register themselves explicitly (no auto-discovery — see widgets/index.ts).
// `getAvailableWidgets(sector)` is used by the AddWidgetModal to filter the picker
// and by `useDashboardLayout` to strip unauthorized widgets defensively.

import { SECTOR_PRIVILEGES } from "../constants";
import type { WidgetCategory, WidgetDefinition } from "./types";

class WidgetRegistry {
  private defs = new Map<string, WidgetDefinition<any>>();

  register<T>(def: WidgetDefinition<T>): void {
    if (this.defs.has(def.id)) {
      // Re-registering should be loud in dev — usually means a duplicate file
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn(`[WidgetRegistry] Duplicate registration for "${def.id}"`);
      }
    }
    this.defs.set(def.id, def as WidgetDefinition<any>);
  }

  get(id: string): WidgetDefinition<any> | undefined {
    return this.defs.get(id);
  }

  has(id: string): boolean {
    return this.defs.has(id);
  }

  /**
   * All registered widgets. Used by the picker, after filtering by sector.
   */
  all(): WidgetDefinition<any>[] {
    return Array.from(this.defs.values());
  }

  /**
   * Widgets the user is allowed to add to their dashboard.
   *
   * Rules (mirror canAccessAnyPrivilege):
   * - ADMIN sees everything
   * - Widgets with `allowedSectors === "*"` are visible to everyone
   * - Otherwise the user's sector must appear in `allowedSectors`
   */
  getAvailableWidgets(userSector: SECTOR_PRIVILEGES | null | undefined): WidgetDefinition<any>[] {
    if (!userSector) return [];
    const isAdmin = userSector === SECTOR_PRIVILEGES.ADMIN;
    return this.all().filter((def) => {
      if (def.allowedSectors === "*") return true;
      if (isAdmin) return true;
      return def.allowedSectors.includes(userSector);
    });
  }

  /**
   * Group available widgets by category for the picker UI.
   */
  groupByCategory(
    userSector: SECTOR_PRIVILEGES | null | undefined,
  ): Array<{ category: WidgetCategory; widgets: WidgetDefinition<any>[] }> {
    const widgets = this.getAvailableWidgets(userSector);
    const groups = new Map<WidgetCategory, WidgetDefinition<any>[]>();
    for (const w of widgets) {
      const list = groups.get(w.category) ?? [];
      list.push(w);
      groups.set(w.category, list);
    }
    return Array.from(groups.entries()).map(([category, widgets]) => ({ category, widgets }));
  }

  /**
   * Check if a user can use a specific widget. Used to defensively strip
   * unauthorized widgets from a layout before render or save.
   */
  canUserUse(widgetId: string, userSector: SECTOR_PRIVILEGES | null | undefined): boolean {
    if (!userSector) return false;
    const def = this.get(widgetId);
    if (!def) return false;
    if (def.allowedSectors === "*") return true;
    if (userSector === SECTOR_PRIVILEGES.ADMIN) return true;
    return def.allowedSectors.includes(userSector);
  }
}

export const widgetRegistry = new WidgetRegistry();
export type { WidgetRegistry };
