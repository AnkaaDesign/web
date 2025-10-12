/**
 * Statistics Page Layout Component
 *
 * Common layout structure for all statistics pages featuring:
 * - Page header with breadcrumbs
 * - Date range selector
 * - Filter panel
 * - Content area with responsive grid
 * - Export and refresh functionality
 */

import { ReactNode } from "react";
import { DashboardHeader } from "./DashboardHeader";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface StatisticsPageLayoutProps {
  /**
   * Page title
   */
  title: string;

  /**
   * Main content (KPI cards, charts, tables)
   */
  children: ReactNode;

  /**
   * Optional filters panel (sidebar or top)
   */
  filters?: ReactNode;

  /**
   * Callback when refresh is clicked
   */
  onRefresh?: () => void;

  /**
   * Callback when export is clicked
   */
  onExport?: () => void;

  /**
   * Callback when share is clicked
   */
  onShare?: () => void;

  /**
   * Callback when date range changes
   */
  onDateRangeChange?: (start: Date, end: Date) => void;

  /**
   * Callback when filter panel is toggled
   */
  onFilterClick?: () => void;

  /**
   * Callback when settings is clicked
   */
  onSettingsClick?: () => void;

  /**
   * Is data currently refreshing?
   */
  isRefreshing?: boolean;

  /**
   * Last updated timestamp
   */
  lastUpdated?: Date;

  /**
   * Show filters in sidebar vs top
   */
  filtersLayout?: "sidebar" | "top";

  /**
   * Additional className for container
   */
  className?: string;
}

/**
 * Statistics Page Layout
 *
 * Provides consistent structure for all statistics pages with header,
 * filters, content area, and actions.
 */
export function StatisticsPageLayout({
  title,
  children,
  filters,
  onRefresh,
  onExport,
  onShare,
  onDateRangeChange,
  onFilterClick,
  onSettingsClick,
  isRefreshing = false,
  lastUpdated,
  filtersLayout = "top",
  className,
}: StatisticsPageLayoutProps) {
  return (
    <div className={cn("flex flex-col gap-6 p-6", className)}>
      {/* Header */}
      <DashboardHeader
        title={title}
        onRefresh={onRefresh}
        onExport={onExport}
        onShare={onShare}
        onDateRangeChange={onDateRangeChange}
        onFilterClick={onFilterClick}
        onSettingsClick={onSettingsClick}
        isRefreshing={isRefreshing}
        lastUpdated={lastUpdated}
      />

      {/* Filters - Top Layout */}
      {filters && filtersLayout === "top" && (
        <Card className="p-4">
          {filters}
        </Card>
      )}

      {/* Main Content Area */}
      <div className="flex gap-6">
        {/* Filters - Sidebar Layout */}
        {filters && filtersLayout === "sidebar" && (
          <aside className="w-64 flex-shrink-0 space-y-4">
            <Card className="p-4 sticky top-6">
              {filters}
            </Card>
          </aside>
        )}

        {/* Content */}
        <div className="flex-1 space-y-6">
          {children}
        </div>
      </div>
    </div>
  );
}
