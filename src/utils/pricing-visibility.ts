// Single source of truth for "mostrar/ocultar valores em dinheiro".
//
// This is read synchronously (and outside React) by the formatCurrency* helpers
// in number.ts, so it must stay a plain module value. To make toggling reactive
// it also behaves as a tiny external store: React subscribes via
// useSyncExternalStore (see pricing-context.tsx) and re-renders on change.
//
// ## The value is a PERSISTED per-user preference
//
// It lives in `Preferences.pricesVisibleByDefault` — the same column the Flutter
// app writes. The sidebar eye and the "Valores em dinheiro" radio on
// /perfil/preferencias are two controls over that ONE setting, so hiding values
// on web hides them on the phone too, and a reload comes back where you left it.
// `PricingProvider` owns both directions (read on login/tab-focus, write on
// toggle); nothing else may call `setPricingVisible` except the public pages,
// which force values on for documents that are meant to be readable.
//
// The localStorage entry written here is ONLY a per-user mirror, so a reload
// paints the right thing in the same frame instead of flashing `R$ ••••••`
// before the API answers. The database is the source of truth: whatever the
// server returns overwrites the mirror, never the other way around.

let _visible = false;

// Depth of active withPricingVisible() scopes (see below). Nestable, hence a counter.
let _forceVisible = 0;

const listeners = new Set<() => void>();

const applyDomClass = (visible: boolean): void => {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("prices-hidden", !visible);
};

// Reflect the initial (hidden) value on the document as early as possible so
// charts / .price-value elements are masked correctly on first paint.
applyDomClass(_visible);

export const getPricingVisible = (): boolean => _visible || _forceVisible > 0;

/**
 * Runs `fn` with values forced visible, then restores the previous state.
 *
 * For producing DATA rather than screen output: spreadsheet/PDF exports, share links and
 * the client-side search index. Hiding values on screen must not write "R$ ••••••" into a
 * file the user deliberately exported, nor make a row unsearchable by its price.
 *
 * MUST be synchronous — it neither notifies listeners nor touches the <html> class (so
 * nothing on screen unmasks), which only holds while React can't render in between.
 */
export const withPricingVisible = <T>(fn: () => T): T => {
  _forceVisible++;
  try {
    return fn();
  } finally {
    _forceVisible--;
  }
};

export const subscribePricingVisible = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const setPricingVisible = (visible: boolean): void => {
  if (_visible === visible) return;
  _visible = visible;
  applyDomClass(visible);
  // Notify synchronously so the React tree re-renders with the fresh value.
  listeners.forEach((listener) => listener());
};

export const togglePricingVisible = (): void => {
  setPricingVisible(!_visible);
};

// =====================
// Per-user local mirror (NOT the source of truth — see the file header)
// =====================

/** Keyed by user so a shared browser never shows account A's choice to account B. */
export const pricingCacheKey = (userId: string): string => `ankaa:prices-visible:${userId}`;

/** The last value we saw for this user, or null when this browser has never seen one. */
export const readCachedPricingVisible = (userId: string): boolean | null => {
  try {
    const raw = localStorage.getItem(pricingCacheKey(userId));
    return raw === null ? null : raw === "1";
  } catch {
    // Private mode / storage disabled — the server value is a round-trip away anyway.
    return null;
  }
};

export const cachePricingVisible = (userId: string, visible: boolean): void => {
  try {
    localStorage.setItem(pricingCacheKey(userId), visible ? "1" : "0");
  } catch {
    /* ignore */
  }
};
