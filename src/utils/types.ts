/**
 * Utility types for data export and charting
 */

import type { ExportFormat as DashboardExportFormat } from "../types/dashboard";

// Re-export ExportFormat from dashboard types
export type ExportFormat = DashboardExportFormat;

/**
 * Chart data for export functionality
 */
export interface ChartExportData {
  /**
   * Chart title or name
   */
  title?: string;

  /**
   * Raw data points
   */
  data: Record<string, any>[];

  /**
   * Optional metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Configuration for data export
 */
export interface ExportConfig {
  /**
   * Output filename (without extension)
   */
  filename?: string;

  /**
   * Include timestamp in filename
   */
  includeTimestamp?: boolean;

  /**
   * Include filter information in export
   */
  includeFilters?: boolean;

  /**
   * Additional options specific to export format
   */
  options?: Record<string, any>;
}
