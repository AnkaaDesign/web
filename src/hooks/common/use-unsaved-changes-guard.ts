import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, type NavigateOptions } from "react-router-dom";

interface UseUnsavedChangesGuardOptions {
  isDirty: boolean;
  isSubmitting?: boolean;
}

// Marker placed on the history state of the sentinel entry we push so we can
// detect (and avoid duplicating) it across re-renders / effect re-runs.
const SENTINEL_KEY = "__unsavedChangesSentinel";

/**
 * Blocks navigation away from a dirty form until the user confirms.
 *
 * The app uses <BrowserRouter> (not a data router), so React Router's
 * useBlocker is unavailable. We guard three navigation channels:
 *   1. Browser back/forward  -> popstate + a one-entry history "sentinel".
 *   2. In-app SPA navigation -> a temporary patch over history.pushState
 *      (catches every navigate()/<Link>) plus the explicit guardedNavigate().
 *   3. Tab close / refresh / hard navigation -> beforeunload.
 *
 * Key invariant for the back-button case: while the guard is active there is
 * exactly ONE sentinel entry sitting directly above the form's own entry, and
 * the user is positioned on that sentinel. A Back press lands them on the form
 * entry (firing popstate); we immediately re-push the sentinel (which also
 * truncates forward history, preserving "exactly one sentinel") and prompt.
 * Confirming therefore has to step back TWO entries (sentinel + form) to reach
 * the previous route.
 */
export function useUnsavedChangesGuard({ isDirty, isSubmitting = false }: UseUnsavedChangesGuardOptions) {
  const navigate = useNavigate();
  const [showDialog, setShowDialog] = useState(false);

  const pendingNavigationRef = useRef<string | null>(null);
  const pendingOptionsRef = useRef<NavigateOptions | undefined>(undefined);
  const dialogVisibleRef = useRef(false);
  const shouldBlockRef = useRef(false);
  const isInternalPushRef = useRef(false);
  // Durable opt-out. Once the user confirms leaving (or the form marks itself
  // as saved via allowNavigation), the guard must NEVER fire again — even
  // though the form is still technically dirty and a re-render keeps
  // shouldBlockRef true. This flag is what breaks the back-button loop: it is
  // set once and is intentionally NOT reset on every render.
  const bypassRef = useRef(false);

  const shouldBlock = isDirty && !isSubmitting;

  // Single source of truth for "intercept navigation right now?". Used by all
  // three handlers so confirming/saving reliably disables every channel.
  const isActive = useCallback(() => shouldBlockRef.current && !bypassRef.current, []);

  useEffect(() => {
    dialogVisibleRef.current = showDialog;
  }, [showDialog]);

  // Synced during render (not in an effect) so the handlers always observe the
  // latest dirty state immediately.
  shouldBlockRef.current = shouldBlock;

  // (3) Native browser dialog on tab close / refresh / hard navigation.
  // Always attached; it no-ops unless the guard is currently active.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isActive()) return;
      e.preventDefault();
      e.returnValue = ""; // Required for Chrome/Edge to show the prompt.
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isActive]);

  // (1) + (2) SPA navigation and browser back/forward.
  useEffect(() => {
    if (!shouldBlock) return;

    const originalPushState = history.pushState.bind(history);

    // Re-establish the sentinel only if it isn't already the current entry, so
    // repeated effect runs / re-renders never stack multiple sentinels (which
    // would break the go(-2) math on confirm).
    const ensureSentinel = () => {
      if (window.history.state && (window.history.state as any)[SENTINEL_KEY]) return;
      isInternalPushRef.current = true;
      originalPushState({ [SENTINEL_KEY]: true }, "", window.location.href);
      isInternalPushRef.current = false;
    };

    // Catch every react-router navigate()/<Link>, which ultimately call
    // history.pushState.
    history.pushState = function (state: any, unused: string, url?: string | URL | null) {
      // Let our own sentinel pushes through; honor the durable bypass; never
      // double-prompt while a dialog is already open.
      if (isInternalPushRef.current || !isActive() || dialogVisibleRef.current) {
        return originalPushState(state, unused, url);
      }

      if (url) {
        const targetUrl = new URL(typeof url === "string" ? url : url.toString(), window.location.origin);
        // Only block real page changes (ignore same-path query/hash updates).
        if (targetUrl.pathname !== window.location.pathname) {
          pendingNavigationRef.current = targetUrl.pathname + targetUrl.search + targetUrl.hash;
          pendingOptionsRef.current = undefined;
          setShowDialog(true);
          return; // Block the navigation; confirmNavigation will replay it.
        }
      }

      return originalPushState(state, unused, url);
    };

    const popstateHandler = () => {
      // Confirmed/saved: let the browser navigation proceed untouched.
      if (!isActive()) return;

      // The user just moved off the sentinel (a Back press lands them on the
      // form entry). Re-pin the sentinel — this also truncates forward history,
      // keeping exactly one sentinel above the form entry.
      const alreadyPrompting = dialogVisibleRef.current;
      ensureSentinel();

      if (!alreadyPrompting) {
        // null target signals "the destination is wherever Back would go".
        pendingNavigationRef.current = null;
        pendingOptionsRef.current = undefined;
        setShowDialog(true);
      }
    };

    ensureSentinel();
    window.addEventListener("popstate", popstateHandler);

    return () => {
      history.pushState = originalPushState;
      window.removeEventListener("popstate", popstateHandler);
    };
  }, [shouldBlock, isActive]);

  const guardedNavigate = useCallback(
    (to: string, options?: NavigateOptions) => {
      if (isActive()) {
        pendingNavigationRef.current = to;
        pendingOptionsRef.current = options;
        setShowDialog(true);
      } else {
        navigate(to, options);
      }
    },
    [isActive, navigate],
  );

  const confirmNavigation = useCallback(() => {
    // Durably disable the guard BEFORE navigating so none of the three channels
    // (popstate, patched pushState, beforeunload) can re-trigger afterwards.
    bypassRef.current = true;
    dialogVisibleRef.current = false;
    setShowDialog(false);

    const target = pendingNavigationRef.current;
    const options = pendingOptionsRef.current;
    pendingNavigationRef.current = null;
    pendingOptionsRef.current = undefined;

    if (target) {
      navigate(target, options);
    } else {
      // Browser-back case: skip BOTH the sentinel (top) and the form entry to
      // reach the previous route. React Router's own popstate listener still
      // fires and syncs its location; ours bails because bypass is set.
      window.history.go(-2);
    }
  }, [navigate]);

  const cancelNavigation = useCallback(() => {
    setShowDialog(false);
    dialogVisibleRef.current = false;
    pendingNavigationRef.current = null;
    pendingOptionsRef.current = undefined;
    // The sentinel is intentionally left in place so the next Back press is
    // captured again.
  }, []);

  // Forms call this on a successful save, immediately before navigating away
  // (or doing a window.location redirect), so the post-save navigation — and
  // the re-arming of the guard when `isSubmitting` flips back to false in a
  // finally block — can never resurface the dialog or a beforeunload prompt.
  const allowNavigation = useCallback(() => {
    bypassRef.current = true;
    dialogVisibleRef.current = false;
    setShowDialog(false);
  }, []);

  return { showDialog, confirmNavigation, cancelNavigation, guardedNavigate, allowNavigation };
}
