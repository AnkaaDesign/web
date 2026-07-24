// =====================================================
// Attention system — predicate evaluator
// =====================================================
//
// A tiny, dependency-free evaluator for the serializable PredicateNode DSL.
// Duplicated shape lives on the API side too (per the repo's schema-duplication
// convention) so a rule authored once evaluates identically in both places.
//
// Coercion rules:
//  • `$now` resolves to Date.now().
//  • For gt/lt/gte/lte, Date values and ISO strings are coerced to epoch ms so
//    "forecastDate < $now" works regardless of whether the field arrived as a
//    Date, a number, or an ISO string.
//  • eq/ne compare with `===`/`!==` after light normalisation (Date → ms).

import type { PredicateNode, PredicatePrimitive } from "./types";
import { NOW_SENTINEL } from "./types";

/** Read a dotted path (`truck.chassisNumber`) off an object; missing → undefined. */
export function getFieldValue(entity: unknown, path: string): unknown {
  if (entity == null) return undefined;
  let cur: unknown = entity;
  for (const key of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

/** Coerce dates / ISO strings / numbers to epoch ms; null-ish → NaN. */
function toEpoch(value: unknown, now: number): number {
  if (value === NOW_SENTINEL) return now;
  if (value == null) return NaN;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  const t = Date.parse(String(value));
  return Number.isNaN(t) ? Number(value) : t;
}

/** Normalise a scalar for equality comparison (Date → ms). */
function normEq(value: unknown): PredicatePrimitive | number {
  if (value instanceof Date) return value.getTime();
  if (value === undefined) return null;
  return value as PredicatePrimitive;
}

function isNullish(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

/**
 * Evaluate a predicate against an entity at time `now` (epoch ms). Pure and
 * side-effect free; returns false on any malformed node rather than throwing,
 * so a bad rule can never crash a render.
 */
export function evaluatePredicate(node: PredicateNode | undefined, entity: unknown, now: number): boolean {
  if (!node) return false;
  switch (node.op) {
    case "and":
      return node.nodes.every((n) => evaluatePredicate(n, entity, now));
    case "or":
      return node.nodes.some((n) => evaluatePredicate(n, entity, now));
    case "not":
      return !evaluatePredicate(node.node, entity, now);
    case "isNull":
      return isNullish(getFieldValue(entity, node.field));
    case "notNull":
      return !isNullish(getFieldValue(entity, node.field));
    case "isTrue":
      return getFieldValue(entity, node.field) === true;
    case "isFalse":
      return getFieldValue(entity, node.field) === false;
    case "eq":
      return normEq(getFieldValue(entity, node.field)) === normEq(node.value === NOW_SENTINEL ? now : node.value);
    case "ne":
      return normEq(getFieldValue(entity, node.field)) !== normEq(node.value === NOW_SENTINEL ? now : node.value);
    case "gt":
    case "lt":
    case "gte":
    case "lte": {
      const a = toEpoch(getFieldValue(entity, node.field), now);
      const b = toEpoch(node.value, now);
      if (Number.isNaN(a) || Number.isNaN(b)) return false;
      if (node.op === "gt") return a > b;
      if (node.op === "lt") return a < b;
      if (node.op === "gte") return a >= b;
      return a <= b;
    }
    default:
      return false;
  }
}
