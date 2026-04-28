/**
 * Paint Mix Presets
 *
 * Slot definitions per paint type. Paint types are dynamic (rows in DB), so we
 * match by lowercase keyword on the paint type's `name`. A generic fallback
 * preset is returned when no keyword matches.
 *
 * Each slot describes:
 *   - id: stable internal id, used as React key and form field name segment
 *   - label: pt-BR display label
 *   - defaultRatio: ratio used in the first render (user can override)
 *   - itemNameKeywords: hints used by the page to bubble matching
 *     `componentItems` to the top of the per-slot Combobox.
 */

export interface MixSlot {
  id: string;
  label: string;
  defaultRatio: number;
  itemNameKeywords: string[];
}

export interface MixPreset {
  matchKeywords: string[];
  slots: MixSlot[];
}

export const PAINT_MIX_PRESETS: MixPreset[] = [
  {
    matchKeywords: ["poliéster", "poliester", "polyester"],
    slots: [
      { id: "varnish", label: "Verniz", defaultRatio: 3, itemNameKeywords: ["verniz"] },
      { id: "catalyst", label: "Catalisador", defaultRatio: 1, itemNameKeywords: ["catalisador", "endurecedor"] },
      { id: "thinner", label: "Diluente", defaultRatio: 1, itemNameKeywords: ["diluente", "thinner", "redutor"] },
    ],
  },
  {
    matchKeywords: ["acrílica", "acrilica", "acrylic"],
    slots: [
      { id: "paint", label: "Tinta Acrílica", defaultRatio: 3, itemNameKeywords: ["acrílica", "acrilica"] },
      { id: "catalyst", label: "Catalisador", defaultRatio: 1, itemNameKeywords: ["catalisador", "endurecedor"] },
      { id: "thinner", label: "Diluente", defaultRatio: 1, itemNameKeywords: ["diluente", "thinner", "redutor"] },
    ],
  },
  {
    matchKeywords: ["laca", "lacquer"],
    slots: [
      { id: "paint", label: "Laca", defaultRatio: 3, itemNameKeywords: ["laca", "lacquer"] },
      { id: "catalyst", label: "Catalisador", defaultRatio: 1, itemNameKeywords: ["catalisador", "endurecedor"] },
      { id: "thinner", label: "Diluente", defaultRatio: 1, itemNameKeywords: ["diluente", "thinner", "redutor"] },
    ],
  },
  {
    matchKeywords: ["poliuretano", "polyurethane", "pu"],
    slots: [
      { id: "paint", label: "Tinta PU", defaultRatio: 4, itemNameKeywords: ["poliuretano", "pu"] },
      { id: "catalyst", label: "Catalisador", defaultRatio: 1, itemNameKeywords: ["catalisador", "endurecedor"] },
      { id: "thinner", label: "Diluente", defaultRatio: 1, itemNameKeywords: ["diluente", "thinner", "redutor"] },
    ],
  },
  {
    matchKeywords: ["epóxi", "epoxi", "epoxy"],
    slots: [
      { id: "paint", label: "Tinta Epóxi", defaultRatio: 4, itemNameKeywords: ["epóxi", "epoxi", "epoxy"] },
      { id: "catalyst", label: "Catalisador", defaultRatio: 1, itemNameKeywords: ["catalisador", "endurecedor"] },
      { id: "thinner", label: "Diluente", defaultRatio: 1, itemNameKeywords: ["diluente", "thinner", "redutor"] },
    ],
  },
];

export const DEFAULT_PRESET: MixPreset = {
  matchKeywords: [],
  slots: [
    { id: "base", label: "Base", defaultRatio: 3, itemNameKeywords: [] },
    { id: "catalyst", label: "Catalisador", defaultRatio: 1, itemNameKeywords: ["catalisador", "endurecedor"] },
    { id: "thinner", label: "Diluente", defaultRatio: 1, itemNameKeywords: ["diluente", "thinner", "redutor"] },
  ],
};

/**
 * Find the preset matching the given paint type name. Falls back to
 * `DEFAULT_PRESET` when nothing matches.
 */
export function findPresetForPaintType(paintTypeName: string | null | undefined): MixPreset {
  if (!paintTypeName) return DEFAULT_PRESET;
  const lower = paintTypeName.toLowerCase();
  return (
    PAINT_MIX_PRESETS.find((p) => p.matchKeywords.some((k) => lower.includes(k))) ??
    DEFAULT_PRESET
  );
}
