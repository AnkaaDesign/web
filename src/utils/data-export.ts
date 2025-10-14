/**
 * Generic Data Export Utilities
 *
 * Provides utilities for exporting data in various formats
 */

import type { ChartExportData, ExportConfig, ExportFormat } from "./types";

/**
 * Export data in various formats
 */
export async function exportData(
  data: ChartExportData[],
  format: ExportFormat,
  config: ExportConfig = {}
): Promise<void> {
  const {
    filename = "export",
    includeTimestamp = true,
    includeFilters = false,
  } = config;

  const timestamp = includeTimestamp
    ? new Date().toISOString().replace(/[:.]/g, "-")
    : "";
  const finalFilename = `${filename}${timestamp ? `-${timestamp}` : ""}`;

  switch (format) {
    case "csv":
      await exportToCSV(data, finalFilename);
      break;
    case "excel":
      await exportToExcel(data, finalFilename);
      break;
    case "pdf":
      await exportToPDF(data, finalFilename);
      break;
    case "json":
      await exportToJSON(data, finalFilename);
      break;
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

/**
 * Export to CSV
 */
async function exportToCSV(
  data: ChartExportData[],
  filename: string
): Promise<void> {
  const csvData = data.map((chart) => {
    const headers = Object.keys(chart.data[0] || {});
    const rows = chart.data.map((row) =>
      headers.map((header) => JSON.stringify(row[header] ?? "")).join(",")
    );
    return [headers.join(","), ...rows].join("\n");
  });

  const blob = new Blob([csvData.join("\n\n")], { type: "text/csv" });
  downloadBlob(blob, `${filename}.csv`);
}

/**
 * Export to Excel (simplified - just CSV with different extension)
 */
async function exportToExcel(
  data: ChartExportData[],
  filename: string
): Promise<void> {
  // For a real Excel export, you'd use a library like xlsx
  // For now, this is a simplified version
  await exportToCSV(data, filename);
}

/**
 * Export to PDF
 */
async function exportToPDF(
  data: ChartExportData[],
  filename: string
): Promise<void> {
  // PDF export would require a library like jsPDF
  // For now, throw an error
  throw new Error("PDF export not yet implemented");
}

/**
 * Export to JSON
 */
async function exportToJSON(
  data: ChartExportData[],
  filename: string
): Promise<void> {
  const jsonData = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonData], { type: "application/json" });
  downloadBlob(blob, `${filename}.json`);
}

/**
 * Download a blob as a file
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Re-export for backwards compatibility
export { exportData as exportStatistics };
