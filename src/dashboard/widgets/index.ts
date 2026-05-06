// Widget barrel — registers every available widget with the registry.
//
// To add a new widget: create a file in this directory exporting a
// WidgetDefinition, then import it here and push it onto the array.

import { widgetRegistry } from "../registry";
import { taskTableWidget } from "./task-table";
import { itemTableWidget } from "./item-table";
import { favoritesWidget } from "./favorites";
import { recentMessagesWidget } from "./recent-messages";
import { timeEntriesWidget } from "./time-entries";
import { dailyPontoWidget } from "./daily-ponto";
import { quickNoteWidget } from "./quick-note";
import { quickBudgetWidget } from "./quick-budget";

const allWidgets: any[] = [
  // Configurable workhorses (preferred — instantiate as many as needed)
  taskTableWidget,
  itemTableWidget,
  // Quick-action / form widgets
  quickBudgetWidget,
  quickNoteWidget,
  // Navigation
  favoritesWidget,
  // Single-purpose data widgets
  recentMessagesWidget,
  timeEntriesWidget,
  dailyPontoWidget,
];

let registered = false;
export function registerAllWidgets(): void {
  if (registered) return;
  registered = true;
  for (const w of allWidgets) {
    widgetRegistry.register(w);
  }
}

registerAllWidgets();
