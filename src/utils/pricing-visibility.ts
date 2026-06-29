// Single source of truth for "show/hide currency values".
//
// This is read synchronously (and outside React) by the formatCurrency* helpers
// in number.ts, so it must stay a plain module value. To make toggling reactive
// it also behaves as a tiny external store: React subscribes via
// useSyncExternalStore (see pricing-context.tsx) and re-renders on change.

const STORAGE_KEY = "ankaa-pricing-visible";

const readInitial = (): boolean => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored !== null ? stored === "true" : true;
  } catch {
    return true;
  }
};

let _visible = readInitial();

const listeners = new Set<() => void>();

const applyDomClass = (visible: boolean): void => {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("prices-hidden", !visible);
};

// Reflect the persisted value on the document as early as possible so charts /
// .price-value elements are masked correctly on first paint.
applyDomClass(_visible);

export const getPricingVisible = (): boolean => _visible;

export const subscribePricingVisible = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const setPricingVisible = (visible: boolean): void => {
  if (_visible === visible) return;
  _visible = visible;
  try {
    localStorage.setItem(STORAGE_KEY, String(visible));
  } catch {}
  applyDomClass(visible);
  // Notify synchronously so the React tree re-renders with the fresh value.
  listeners.forEach((listener) => listener());
};

export const togglePricingVisible = (): void => {
  setPricingVisible(!_visible);
};
