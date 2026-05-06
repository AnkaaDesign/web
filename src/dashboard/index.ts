// Public surface of the dashboard module.
// Importing this file as a side-effect registers all built-in widgets.

import "./widgets";

export type {
  DashboardLayout,
  WidgetCategory,
  WidgetCols,
  WidgetConfigProps,
  WidgetDefinition,
  WidgetInstance,
  WidgetRenderProps,
  WidgetRows,
  WidgetSize,
} from "./types";
export { WIDGET_CATEGORY_LABELS } from "./types";
export { widgetRegistry } from "./registry";
export { useDashboardLayout } from "./hooks/use-dashboard-layout";
export { DashboardGrid } from "./components/dashboard-grid";
export { EditToolbar } from "./components/edit-toolbar";
export { AddWidgetModal } from "./components/add-widget-modal";
export { ConfigureWidgetModal } from "./components/configure-widget-modal";
export { getDefaultLayoutForSector } from "./presets";
