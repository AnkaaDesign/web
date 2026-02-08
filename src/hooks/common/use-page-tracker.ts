import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackPageAccess } from "../../utils";

interface UsePageTrackerOptions {
  title: string;
  icon?: string;
  trackingEnabled?: boolean;
}

export function usePageTracker({ title, icon, trackingEnabled = true }: UsePageTrackerOptions) {
  const location = useLocation();

  useEffect(() => {
    if (trackingEnabled && title) {
      trackPageAccess(location.pathname, title, icon);
    }
  }, [location.pathname, title, icon, trackingEnabled]);
}
