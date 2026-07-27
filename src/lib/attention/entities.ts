// =====================================================
// Attention system — per-entity descriptors
// =====================================================
//
// The seam that makes the system an ABSTRACTION rather than a per-entity special
// case. Every surface that has to answer "what does attention on a X look like?"
// reads it from here instead of hardcoding the entity:
//
//   • the sidebar   — which nav entries an X's attention lights (`navPaths`)
//   • the poller    — which sectors can see any X rule, so we don't fetch for others
//   • the messages  — how to name an X to the user (`label`)
//
// Onboarding a new entity is: add it to `ATTENTION_ENTITY_TYPES` (here and in
// `api/src/schemas/attention.ts`), declare a descriptor below, and write at least one
// rule in `rules.ts`. Nothing in the sidebar, the engine, the detail page or the
// tables needs to change — they all iterate this registry.
//
// `audience` is DERIVED from the rules, never restated: a rule's `targetSectors` is
// already the authority on who a signal is for, and a second hand-maintained copy is
// exactly how the nav and the row drifted apart before.

import { routes } from "@/constants";

import { ATTENTION_RULES } from "./rules";
import type { AttentionEntityType } from "./types";

export interface AttentionEntityDescriptor {
  entityType: AttentionEntityType;
  /** Singular, lowercase, pt-BR — used in tooltips / warning copy ("esta tarefa"). */
  label: string;
  /**
   * Nav route paths that this entity's attention should light. The sidebar resolves
   * each path's whole trail, so list only the LEAF pages the user should be led to.
   * An entity whose attention has no nav home leaves this empty.
   */
  navPaths: string[];
}

/**
 * Declared descriptors. Only entity types that actually carry attention RULES need
 * an entry — presence (the "is editing" ring) works for every type in
 * `ATTENTION_ENTITY_TYPES` without any declaration.
 */
export const ATTENTION_ENTITIES: AttentionEntityDescriptor[] = [
  {
    entityType: "TASK",
    label: "tarefa",
    // Tasks live on both Agenda (preparation) and Cronograma (schedule).
    navPaths: [routes.production.preparation.root, routes.production.schedule.root],
  },
  {
    entityType: "CUT",
    label: "recorte",
    navPaths: [routes.production.cutting.root],
  },
];

const BY_TYPE = new Map<AttentionEntityType, AttentionEntityDescriptor>(ATTENTION_ENTITIES.map((d) => [d.entityType, d]));

export function attentionEntityDescriptor(type: AttentionEntityType): AttentionEntityDescriptor | undefined {
  return BY_TYPE.get(type);
}

/**
 * Sectors that can see AT LEAST ONE rule for this entity type, derived from the rule
 * registry. `null` means "everyone" (some rule is untargeted), which mirrors
 * `ruleAppliesToUser`'s `targetSectors.length === 0 → true`.
 */
export function attentionAudience(type: AttentionEntityType): string[] | null {
  const applicable = ATTENTION_RULES.filter((r) => r.enabled && r.entityType === type);
  if (applicable.some((r) => r.targetSectors.length === 0)) return null;
  return [...new Set(applicable.flatMap((r) => r.targetSectors))];
}

/**
 * Entity types with at least one enabled rule AND a declared descriptor — the set the
 * sidebar projects and the summary poller asks the server about. Derived, so enabling
 * or retiring a rule can never leave a stale nav indicator behind.
 */
export const ATTENTION_ACTIVE_TYPES: AttentionEntityType[] = ATTENTION_ENTITIES.filter((d) =>
  ATTENTION_RULES.some((r) => r.enabled && r.entityType === d.entityType),
).map((d) => d.entityType);
