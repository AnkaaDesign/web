// Shared helpers for widgets that wrap an existing home-dashboard list component.
// All these widgets pull from the same `useHomeDashboard` query — react-query
// dedupes the request so the call cost is one network round-trip regardless of
// how many widgets the user has configured.

import { type ReactNode } from "react";
import { useHomeDashboard } from "../../hooks/common/use-dashboard";
import type { HomeDashboardData } from "../../types";

interface HomeDashboardWidgetBodyProps<TSlice> {
  selector: (data: HomeDashboardData) => TSlice;
  /** Render the slice. Slice may be empty/missing — let the wrapped component handle that. */
  children: (slice: TSlice) => ReactNode;
}

/**
 * Common loading + error skeleton for widgets driven by the home-dashboard query.
 * Existing list components handle their own empty state, so we don't need to
 * special-case "data is empty" here.
 */
export function HomeDashboardWidgetBody<TSlice>({
  selector,
  children,
}: HomeDashboardWidgetBodyProps<TSlice>) {
  const { data, isLoading, isError } = useHomeDashboard({ platform: "web" });

  if (isLoading) {
    return <div className="h-full w-full animate-pulse rounded-lg bg-muted/30" />;
  }
  if (isError || !data?.data) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
        Não foi possível carregar este widget.
      </div>
    );
  }

  return <>{children(selector(data.data))}</>;
}
