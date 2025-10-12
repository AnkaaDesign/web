/**
 * Filter and Grouping Presets
 * Predefined filter configurations and grouping templates
 */

export {
  FILTER_PRESETS,
  TIME_BASED_PRESETS,
  ENTITY_PRESETS,
  INVENTORY_PRESETS,
  getPreset,
  getAllPresetIds,
  getPresetsByCategory,
} from "./filter-presets";

export {
  GROUPING_PRESETS,
  getGroupingPreset,
  getAllGroupingPresetIds,
  getGroupingPresetsByCategory,
  createGroupingPreset,
} from "./grouping-presets";

export type { GroupingPreset } from "./grouping-presets";
