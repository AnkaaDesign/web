// Widget barrel — registers every available widget with the registry.
//
// To add a new widget: create a file in this directory exporting a
// WidgetDefinition, then import it here and push it onto the array.

import { widgetRegistry } from "../registry";
import { taskTableWidget } from "./task-table";
import { itemTableWidget } from "./item-table";
import { orderTableWidget } from "./order-table";
import { borrowTableWidget } from "./borrow-table";
import { installmentTableWidget } from "./installment-table";
import { ppeDeliveryTableWidget } from "./ppe-delivery-table";
import { hrRequestsTableWidget } from "./hr-requests-table";
import { favoritesWidget } from "./favorites";
import { recentMessagesWidget } from "./recent-messages";
import { timeEntriesWidget } from "./time-entries";
import { dailyPontoWidget } from "./daily-ponto";
import { notesBoardWidget, notesBoardLegacyWidget } from "./notes-board";
// import { quickBudgetWidget } from "./quick-budget"; // Hidden from gallery — pending redesign
import { hrCalendarWidget } from "./hr-calendar";
import { productionCalendarWidget } from "./production-calendar";
import { productivityWidget } from "./productivity";

const allWidgets: any[] = [
  // Configurable workhorses (preferred — instantiate as many as needed)
  taskTableWidget,
  itemTableWidget,
  orderTableWidget,
  borrowTableWidget,
  installmentTableWidget,
  // HR approval queues (sector-restricted)
  ppeDeliveryTableWidget,
  hrRequestsTableWidget,
  // Quick-action / form widgets
  // quickBudgetWidget, // Hidden from gallery — pending redesign
  // Unified Notas widget (replaces the old Post-its + Anotações widgets).
  notesBoardWidget,
  // Navigation
  favoritesWidget,
  // Single-purpose data widgets
  recentMessagesWidget,
  timeEntriesWidget,
  dailyPontoWidget,
  // Calendar widgets (monthly, period 26→25)
  hrCalendarWidget,
  productionCalendarWidget,
  // Production analytics widgets
  productivityWidget,
];

let registered = false;
export function registerAllWidgets(): void {
  if (registered) return;
  registered = true;
  for (const w of allWidgets) {
    widgetRegistry.register(w);
  }
  // Back-compat alias: the removed "Anotações" scratchpad widget id
  // (`quick-action.note`) is registered as a HIDDEN duplicate of the unified
  // Notas widget so existing saved layouts keep rendering it, without showing a
  // second "Notas" card in the add-widget gallery.
  widgetRegistry.registerHidden(notesBoardLegacyWidget);
}

registerAllWidgets();
