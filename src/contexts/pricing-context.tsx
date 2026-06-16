import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import { setPricingVisible } from "@/utils/pricing-visibility";

interface PricingContextType {
  pricingVisible: boolean;
  togglePricing: () => void;
}

const PricingContext = createContext<PricingContextType | undefined>(undefined);

export function PricingProvider({ children }: { children: ReactNode }) {
  const [pricingVisible, setPricingVisibleState] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("ankaa-pricing-visible");
      return stored !== null ? stored === "true" : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("ankaa-pricing-visible", String(pricingVisible));
    } catch {}
    setPricingVisible(pricingVisible);
    if (!pricingVisible) {
      document.documentElement.classList.add("prices-hidden");
    } else {
      document.documentElement.classList.remove("prices-hidden");
    }
  }, [pricingVisible]);

  const togglePricing = useCallback(() => {
    setPricingVisibleState((prev) => !prev);
  }, []);

  const value = useMemo(() => ({ pricingVisible, togglePricing }), [pricingVisible, togglePricing]);

  return <PricingContext.Provider value={value}>{children}</PricingContext.Provider>;
}

export const usePricing = () => {
  const ctx = useContext(PricingContext);
  if (!ctx) throw new Error("usePricing must be used within a PricingProvider");
  return ctx;
};
