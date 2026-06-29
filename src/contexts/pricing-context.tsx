import { createContext, useContext, useCallback, useMemo, useSyncExternalStore, Fragment } from "react";
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
 * Remounts its subtree whenever pricing visibility toggles.
 *
 * Currency values are produced by formatCurrency*() — plain string helpers that
 * read the visibility flag during render but are NOT React-subscribed. Changing
 * the key forces those (hundreds of) call sites to re-render and recompute their
 * masked/unmasked strings, without having to wire a hook into each one. Much
 * cheaper than the previous full page reload: sockets, providers and the
 * react-query cache all stay mounted.
 */
export function PricingVisibilityBoundary({ children }: { children: ReactNode }) {
  const { pricingVisible } = usePricing();
  return <Fragment key={pricingVisible ? "prices-shown" : "prices-hidden"}>{children}</Fragment>;
}

export const usePricing = () => {
  const ctx = useContext(PricingContext);
  if (!ctx) throw new Error("usePricing must be used within a PricingProvider");
  return ctx;
};
