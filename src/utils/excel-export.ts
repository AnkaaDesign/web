/**
 * Proper Excel Export Utility
 *
 * Uses the XLSX library to create real Excel files (.xlsx)
 * instead of TSV files masquerading as .xls
 */

import { formatDate } from "./index";
import { toast } from "@/components/ui/sonner";

export interface ExcelColumn<T> {
  label: string;
  getValue: (item: T) => string;
}

export interface ExcelExportOptions {
  filename: string;
  sheetName: string;
  maxColumnWidth?: number;
}

/**
 * Export data to a proper Excel file using XLSX library
 */
export async function exportToExcel<T>(
  data: T[],
  columns: ExcelColumn<T>[],
  options: ExcelExportOptions
): Promise<void> {
  try {
    // Dynamically import xlsx library
    const XLSX = await import("xlsx");

    // Prepare data for Excel - create array of objects with column labels as keys
    const excelData = data.map((item) => {
      const row: Record<string, any> = {};
      columns.forEach((column) => {
        row[column.label] = column.getValue(item);
      });
      return row;
    });

    // Create worksheet from data
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, options.sheetName || "Sheet1");

    // Auto-size columns based on content
    const maxWidth = options.maxColumnWidth || 50;
    const colWidths = columns.map((col) => {
      // Calculate max width based on header and content
      const headerLength = col.label.length;
      const maxContentLength = Math.max(
        ...excelData.map((row) => String(row[col.label] || "").length),
        0
      );
      const width = Math.max(headerLength, maxContentLength);
      return { wch: Math.min(width + 2, maxWidth) };
    });
    ws["!cols"] = colWidths;

    // Generate filename with date
    const timestamp = formatDate(new Date()).replace(/\//g, "-");
    const fullFilename = `${options.filename}_${timestamp}.xlsx`;

    // Write file with proper .xlsx extension
    XLSX.writeFile(wb, fullFilename);
  } catch (error) {
    console.error("Excel export error:", error);
    throw new Error("Não foi possível exportar para Excel");
  }
}

/**
 * Fallback CSV export for when Excel fails
 */
export function exportToCSV<T>(
  data: T[],
  columns: ExcelColumn<T>[],
  filename: string
): void {
  // CSV headers from visible columns
  const headers = columns.map((col) => col.label);

  // Convert items to CSV rows
  const rows = data.map((item) => columns.map((col) => col.getValue(item)));

  // Create CSV content with proper escaping
  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row
        .map((cell) => {
          const value = String(cell || "");
          // Escape quotes and wrap in quotes if contains comma or quotes
          if (value.includes(",") || value.includes('"')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        })
        .join(",")
    ),
  ].join("\n");

  // Download CSV with BOM for Excel compatibility
  const blob = new Blob(["\ufeff" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `${filename}_${formatDate(new Date()).replace(/\//g, "-")}.csv`
  );
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
