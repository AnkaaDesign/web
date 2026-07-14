import { createContext, useContext, useCallback, useMemo, useSyncExternalStore, cloneElement, isValidElement } from "react";
import type { ReactNode } from "react";
import { getPricingVisible, subscribePricingVisible, togglePricingVisible } from "@/utils/pricing-visibility";

interface PricingContextType {
  pricingVisible: boolean;
  togglePricing: () => void;
}

const PricingContext = createContext<PricingContextType | undefined>(undefined);

export function PricingProvider({ children }: { children: ReactNode }) {
  // Subscribe to the external store so the provider (and thus consumers) re-render
  // the instant the value toggles — no page reload required.
  const pricingVisible = useSyncExternalStore(subscribePricingVisible, getPricingVisible, getPricingVisible);

  const togglePricing = useCallback(() => {
    togglePricingVisible();
  }, []);

  const value = useMemo(() => ({ pricingVisible, togglePricing }), [pricingVisible, togglePricing]);

  return <PricingContext.Provider value={value}>{children}</PricingContext.Provider>;
}

/**
 * Re-renders (does NOT remount) its subtree whenever pricing visibility toggles.
 *
 * Currency values are produced by formatCurrency*() — plain string helpers that
 * read the visibility flag during render but are NOT React-subscribed. On toggle
 * those (hundreds of) call sites must recompute their masked/unmasked strings.
 *
 * We must NOT do this with a changing `key`: that unmounts and remounts the whole
 * routed tree, destroying all in-progress component state — most painfully, a user
 * filling out the task/budget create forms loses every field they typed (the forms
 * keep their state in react-hook-form + local useState with no draft persistence).
 *
 * Instead, consuming `pricingVisible` re-renders this boundary on every toggle, and
 * cloneElement hands React a fresh element reference for the same subtree (same type,
 * key and position). React reconciles that as an UPDATE — it propagates a re-render
 * downward so formatCurrency*() recomputes, while preserving component state (no
 * unmount). The `.prices-hidden` CSS blur (applied on <html>, reactive on its own)
 * remains the backstop for charts and any memoized leaf.
 */
export function PricingVisibilityBoundary({ children }: { children: ReactNode }) {
  const { pricingVisible } = usePricing();
  // Reference the flag so this component re-subscribes/re-renders on every toggle.
  void pricingVisible;
  return isValidElement(children) ? cloneElement(children) : <>{children}</>;
}

export const usePricing = () => {
  const ctx = useContext(PricingContext);
  if (!ctx) throw new Error("usePricing must be used within a PricingProvider");
  return ctx;
};
