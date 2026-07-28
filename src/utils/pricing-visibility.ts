// Single source of truth for "show/hide currency values".
//
// This is read synchronously (and outside React) by the formatCurrency* helpers
// in number.ts, so it must stay a plain module value. To make toggling reactive
// it also behaves as a tiny external store: React subscribes via
// useSyncExternalStore (see pricing-context.tsx) and re-renders on change.
//
// The live on/off state is deliberately NOT persisted (no localStorage): every
// full page reload comes back at the user's DEFAULT, regardless of what they last
// toggled. SPA route changes also reset it (PricingProvider resets on every
// `pathname` change), so revealing values on one page never carries over.
//
// What IS persisted is only the DEFAULT the reset lands on — the per-user
// `Preferences.pricesVisibleByDefault` ("Mostrar valores por padrão"), pushed in
// here by PricingProvider once the user's preferences resolve:
//   false (default) → each page starts masked, the eye reveals.
//   true            → each page starts visible, the eye hides.

let _default = false;
let _visible = _default;

const listeners = new Set<() => void>();

const applyDomClass = (visible: boolean): void => {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("prices-hidden", !visible);
};

// Reflect the initial (hidden) value on the document as early as possible so
// charts / .price-value elements are masked correctly on first paint.
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
  applyDomClass(visible);
  // Notify synchronously so the React tree re-renders with the fresh value.
  listeners.forEach((listener) => listener());
};

export const togglePricingVisible = (): void => {
  setPricingVisible(!_visible);
};

export const getPricingDefault = (): boolean => _default;

/**
 * Sets the value every reset (page load / navigation) lands on.
 *
 * Called by PricingProvider when the user's `Preferences.pricesVisibleByDefault`
 * resolves — and again whenever the user changes it in Preferências. Applying it
 * immediately is what makes the setting take effect on the current page too,
 * instead of only on the next navigation.
 */
export const setPricingDefault = (visible: boolean): void => {
  if (_default === visible) return;
  _default = visible;
  setPricingVisible(visible);
};

/** Back to the user's default — what a page load or navigation does. */
export const resetPricingVisible = (): void => {
  setPricingVisible(_default);
};
