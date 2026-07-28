// Single source of truth for "show/hide currency values".
//
// This is read synchronously (and outside React) by the formatCurrency* helpers
// in number.ts, so it must stay a plain module value. To make toggling reactive
// it also behaves as a tiny external store: React subscribes via
// useSyncExternalStore (see pricing-context.tsx) and re-renders on change.
//
// Deliberately NOT persisted (no localStorage): every full page reload comes
// back hidden, regardless of what the user last chose. SPA route changes also
// reset it (PricingProvider resets on every `pathname` change), so revealing
// values on one page never carries over to the next.

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
