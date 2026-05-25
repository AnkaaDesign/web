import { useLocation } from "react-router-dom";

/**
 * Snapshot the current location as a "/path?query" string, suitable for
 * `navigate(to, { state: { returnTo } })`.
 *
 * The budget (orçamento) and billing (faturamento) detail pages read this
 * `returnTo` and send the user back to the page they came from after
 * save/cancel — instead of a hardcoded list route. When absent (e.g. a page
 * opened via a direct URL), those pages fall back to their previous behavior.
 */
export function useReturnTo(): string {
  const location = useLocation();
  return `${location.pathname}${location.search}`;
}

/** The shape stored in navigation state and read by the detail pages. */
export interface ReturnToState {
  returnTo?: string;
}

/** Read the `returnTo` path from React Router location state, if present. */
export function readReturnTo(state: unknown): string | undefined {
  return (state as ReturnToState | null)?.returnTo;
}
