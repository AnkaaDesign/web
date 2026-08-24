import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { toast } from "@/components/ui/sonner";
import {
  cachePricingVisible,
  getPricingVisible,
  pricingCacheKey,
  readCachedPricingVisible,
  setPricingVisible,
  subscribePricingVisible,
} from "@/utils/pricing-visibility";
import { useAuth } from "@/contexts/auth-context";
import { useMyPreferences } from "@/dashboard/hooks/use-my-preferences";

interface PricingContextType {
  /** Whether money is currently readable. Persisted — see `pricing-visibility.ts`. */
  pricingVisible: boolean;
  /** The sidebar eye: flips the saved preference. */
  togglePricing: () => void;
  /** The Preferências radio: sets the saved preference to an explicit value. */
  setPricingPreference: (visible: boolean) => void;
  /** True while a write to `Preferences.pricesVisibleByDefault` is in flight. */
  isSavingPricing: boolean;
}

const PricingContext = createContext<PricingContextType | undefined>(undefined);

/**
 * Owns both directions of the persisted "mostrar/ocultar valores" preference
 * (`Preferences.pricesVisibleByDefault`, shared with the Flutter app):
 *
 *  - READ: from the local mirror before first paint, then from the API, then
 *    again every time the tab regains focus (that is what makes a change made
 *    on the phone show up here without a reload).
 *  - WRITE: the eye and the Preferências radio both go through `write()`, which
 *    applies optimistically and rolls back with a toast if the PUT fails.
 *
 * There is deliberately NO reset on navigation: the choice is a saved setting,
 * not a per-page peek, so it has to survive route changes the same way it
 * survives a reload or a hop to another device.
 */
export function PricingProvider({ children }: { children: ReactNode }) {
  // Subscribe to the external store so the provider (and thus consumers) re-render
  // the instant the value changes — no page reload required.
  const pricingVisible = useSyncExternalStore(subscribePricingVisible, getPricingVisible, getPricingVisible);

  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { preferences, updateMine, refetchMine } = useMyPreferences();
  const preferencesId = preferences?.id ?? null;
  const [isSavingPricing, setIsSavingPricing] = useState(false);

  // A choice the user made here that the server has not confirmed yet. While it is
  // set, the incoming server value is ignored — otherwise the not-yet-refetched
  // old value would immediately undo the click.
  const pendingRef = useRef<boolean | null>(null);

  // 1. Paint from the per-user mirror before the browser paints anything, so a
  //    reload of a "sempre visíveis" account never flashes R$ ••••••. With no
  //    mirror for this account (first login in this browser, or a different
  //    person on a shared one) start MASKED rather than inheriting whatever the
  //    previous session left in the module store.
  useLayoutEffect(() => {
    if (!userId) return;
    setPricingVisible(readCachedPricingVisible(userId) ?? false);
  }, [userId]);

  // 2. The database wins as soon as it answers.
  const serverVisible = preferences?.pricesVisibleByDefault;
  useEffect(() => {
    if (!userId || typeof serverVisible !== "boolean") return;
    if (pendingRef.current !== null) return;
    setPricingVisible(serverVisible);
    cachePricingVisible(userId, serverVisible);
  }, [serverVisible, userId]);

  const write = useCallback(
    async (next: boolean) => {
      const previous = getPricingVisible();
      if (next === previous && pendingRef.current === null) return;

      // Optimistic: the eye must feel instant even on a slow connection.
      pendingRef.current = next;
      setPricingVisible(next);
      if (userId) cachePricingVisible(userId, next);

      // The Preferences row self-creates on first load; until it exists there is
      // nothing to PUT. Effect 4 flushes the pending value the moment it appears.
      if (!preferencesId) return;

      setIsSavingPricing(true);
      try {
        await updateMine({ pricesVisibleByDefault: next } as never);
        pendingRef.current = null;
      } catch {
        pendingRef.current = null;
        setPricingVisible(previous);
        if (userId) cachePricingVisible(userId, previous);
        toast.error("Não foi possível salvar a preferência de valores.");
      } finally {
        setIsSavingPricing(false);
      }
    },
    [preferencesId, updateMine, userId],
  );

  // 3. Pull the preference again whenever the tab comes back to the foreground —
  //    the cheap way to notice a change made on the phone (or in another tab)
  //    without waiting out the 10-minute query staleTime.
  useEffect(() => {
    if (!userId) return;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      if (pendingRef.current !== null) return;
      void refetchMine();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [userId, refetchMine]);

  // 4. Flush a choice made before the Preferences row existed.
  useEffect(() => {
    if (!preferencesId || pendingRef.current === null) return;
    void write(pendingRef.current);
  }, [preferencesId, write]);

  // 5. Other tabs of this browser: mirror writes are the notification channel.
  useEffect(() => {
    if (!userId) return;
    const key = pricingCacheKey(userId);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key || pendingRef.current !== null) return;
      if (event.newValue === "1" || event.newValue === "0") setPricingVisible(event.newValue === "1");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [userId]);

  const togglePricing = useCallback(() => {
    void write(!getPricingVisible());
  }, [write]);

  const setPricingPreference = useCallback(
    (visible: boolean) => {
      void write(visible);
    },
    [write],
  );

  const value = useMemo(
    () => ({ pricingVisible, togglePricing, setPricingPreference, isSavingPricing }),
    [pricingVisible, togglePricing, setPricingPreference, isSavingPricing],
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
