import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

interface UseUnsavedChangesGuardOptions {
  isDirty: boolean;
  isSubmitting?: boolean;
}

export function useUnsavedChangesGuard({ isDirty, isSubmitting = false }: UseUnsavedChangesGuardOptions) {
  const navigate = useNavigate();
  const [showDialog, setShowDialog] = useState(false);
  const pendingNavigationRef = useRef<string | null>(null);
  const dialogVisibleRef = useRef(false);
  const shouldBlockRef = useRef(false);
  const isInternalPushRef = useRef(false);
  const isConfirmedRef = useRef(false);

  const shouldBlock = isDirty && !isSubmitting;

  // Keep refs in sync to avoid stale closures
  useEffect(() => {
    dialogVisibleRef.current = showDialog;
  }, [showDialog]);

  // Keep ref in sync synchronously during render (not in an effect)
  // so that the beforeunload handler sees the latest value immediately
  shouldBlockRef.current = shouldBlock;

  // beforeunload handler — native browser dialog on tab close/refresh
  useEffect(() => {
    if (!shouldBlock) return;

    const handler = (e: BeforeUnloadEvent) => {
      if (isConfirmedRef.current || !shouldBlockRef.current) return;
      e.preventDefault();
      e.returnValue = ""; // Required for Chrome/Edge
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [shouldBlock]);

  // Intercept history.pushState (catches all React Router navigate() calls)
  // and popstate (catches browser back/forward)
  useEffect(() => {
    if (!shouldBlock) return;

    const originalPushState = history.pushState.bind(history);

    history.pushState = function (state: any, unused: string, url?: string | URL | null) {
      // Let our own internal pushState calls through
      if (isInternalPushRef.current) {
        return originalPushState(state, unused, url);
      }

      // Don't block if guard is inactive or dialog is already showing
      if (!shouldBlockRef.current || dialogVisibleRef.current) {
        return originalPushState(state, unused, url);
      }

      if (url) {
        const targetUrl = new URL(
          typeof url === "string" ? url : url.toString(),
          window.location.origin,
        );
        const currentPath = window.location.pathname;

        // Only block if navigating to a different page
        if (targetUrl.pathname !== currentPath) {
          pendingNavigationRef.current = targetUrl.pathname;
          setShowDialog(true);
          return; // Block the navigation
        }
      }

      return originalPushState(state, unused, url);
    };

    // popstate handler — browser back/forward
    const popstateHandler = () => {
      if (!shouldBlockRef.current) return;

      if (dialogVisibleRef.current) {
        isInternalPushRef.current = true;
        window.history.pushState(null, "", window.location.href);
        isInternalPushRef.current = false;
        return;
      }

      isInternalPushRef.current = true;
      window.history.pushState(null, "", window.location.href);
      isInternalPushRef.current = false;
      pendingNavigationRef.current = null;
      setShowDialog(true);
    };

    // Push an extra entry so we can catch the first back press
    isInternalPushRef.current = true;
    window.history.pushState(null, "", window.location.href);
    isInternalPushRef.current = false;

    window.addEventListener("popstate", popstateHandler);

    return () => {
      history.pushState = originalPushState;
      window.removeEventListener("popstate", popstateHandler);
    };
  }, [shouldBlock]);

  // Wraps navigation calls; shows dialog if dirty, navigates if clean
  const guardedNavigate = useCallback(
    (to: string) => {
      if (shouldBlock) {
        pendingNavigationRef.current = to;
        setShowDialog(true);
      } else {
        navigate(to);
      }
    },
    [shouldBlock, navigate],
  );

  const confirmNavigation = useCallback(() => {
    // Disable all blocking before navigating so the beforeunload handler
    // and popstate handler don't re-trigger after the user already confirmed
    isConfirmedRef.current = true;
    shouldBlockRef.current = false;
    dialogVisibleRef.current = false;
    setShowDialog(false);

    const target = pendingNavigationRef.current;
    pendingNavigationRef.current = null;

    if (target) {
      navigate(target);
    } else {
      // popstate case — go back
      window.history.back();
    }
  }, [navigate]);

  const cancelNavigation = useCallback(() => {
    setShowDialog(false);
    pendingNavigationRef.current = null;
  }, []);

  return { showDialog, confirmNavigation, cancelNavigation, guardedNavigate };
}
