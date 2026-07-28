import { useSyncExternalStore } from "react";
import { getPricingVisible, subscribePricingVisible } from "@/utils/pricing-visibility";

/**
 * Subscribes the calling component to the "mostrar/ocultar valores" flag.
 *
 * Currency strings come from `formatCurrency*()` — plain helpers that read the flag
 * during render but are NOT React-subscribed. A component only shows the fresh
 * masked/unmasked string if it actually RE-RENDERS when the flag flips.
 *
 * `PricingVisibilityBoundary` (contexts/pricing-context.tsx) pushes a re-render down
 * the routed tree, but it cannot cross a `memo()` boundary whose props didn't change
 * — DetailSection, InlineEditField, the DataTable row… all legitimately bail out,
 * leaving `R$ ••••••` (or the revealed value) frozen on screen.
 *
 * Any memoized component that can render money must call this hook: reading the flag
 * through `useSyncExternalStore` makes the toggle itself a re-render trigger, so the
 * bail-out is bypassed exactly when it needs to be and never otherwise.
 *
 * It also serves components that need the flag as a VALUE — e.g. as a `useMemo`
 * dependency when a formatted currency string is cached in a memo.
 */
export function usePricingVisible(): boolean {
  return useSyncExternalStore(subscribePricingVisible, getPricingVisible, getPricingVisible);
}
