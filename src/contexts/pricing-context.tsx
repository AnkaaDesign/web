import { createContext, useContext, useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { getPricingVisible, resetPricingVisible, setPricingDefault, subscribePricingVisible, togglePricingVisible } from "@/utils/pricing-visibility";
import { useMyPreferences } from "@/dashboard/hooks/use-my-preferences";

interface PricingContextType {
  pricingVisible: boolean;
  togglePricing: () => void;
  /** The user's "Mostrar valores por padrão" preference — what every page load/navigation resets to. */
  pricingVisibleByDefault: boolean;
}

const PricingContext = createContext<PricingContextType | undefined>(undefined);

export function PricingProvider({ children }: { children: ReactNode }) {
  // Subscribe to the external store so the provider (and thus consumers) re-render
  // the instant the value toggles — no page reload required.
  const pricingVisible = useSyncExternalStore(subscribePricingVisible, getPricingVisible, getPricingVisible);

  // Per-user default ("Mostrar valores por padrão", Preferências). Pushed into the store so the
  // plain formatCurrency* helpers — and every reset below — see it without a React dependency.
  const { preferences } = useMyPreferences();
  const pricingVisibleByDefault = preferences?.pricesVisibleByDefault ?? false;
  useEffect(() => {
    setPricingDefault(pricingVisibleByDefault);
  }, [pricingVisibleByDefault]);

  // Reset on every navigation (sidebar/breadcrumb/link — anything that changes the route),
  // not just a hard reload: landing on a new page should never carry over a manual toggle
  // from wherever the user was before. Keyed on pathname only (not search/hash) so in-page
  // filters/pagination don't reset values the user just toggled. The reset lands on the
  // user's default — masked for everyone unless they chose "sempre visível".
  const { pathname } = useLocation();
  useEffect(() => {
    resetPricingVisible();
  }, [pathname]);

  const togglePricing = useCallback(() => {
    togglePricingVisible();
  }, []);

  const value = useMemo(
    () => ({ pricingVisible, togglePricing, pricingVisibleByDefault }),
    [pricingVisible, togglePricing, pricingVisibleByDefault],
  );

  return <PricingContext.Provider value={value}>{children}</PricingContext.Provider>;
}

/**
 * Subscribes the calling component to the show/hide-values flag — WITHOUT needing
 * the provider (it reads the same external store), so it is safe in public pages,
 * shared UI primitives and anything rendered outside <PricingProvider>.
 *
 * Any component that formats currency during its own render (formatCurrency*() are
 * plain string helpers — they read the flag but are NOT React-subscribed) must call
 * this, otherwise it keeps whatever masked/unmasked string it produced on its last
 * render and the eye toggle appears to do nothing.
 */
export const usePricingVisible = (): boolean => useSyncExternalStore(subscribePricingVisible, getPricingVisible, getPricingVisible);

export const usePricing = () => {
  const ctx = useContext(PricingContext);
  if (!ctx) throw new Error("usePricing must be used within a PricingProvider");
  return ctx;
};
