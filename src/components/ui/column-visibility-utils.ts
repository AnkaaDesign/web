import React from "react";

/**
 * Helper function to extract text from ReactNode headers
 * This is used in column visibility managers to handle both string and ReactNode headers
 */
export function getHeaderText(header: string | React.ReactNode): string {
  if (typeof header === "string") {
    return header;
  }

  // For ReactNode headers, we can't easily extract text content
  // Return empty string to exclude from search/filtering
  return "";
}

/**
 * Check if a column should be included in column visibility management
 * Excludes control columns (select, actions) and columns without proper headers
 */
export function isDataColumn(col: { key: string; header: string | React.ReactNode }): boolean {
  if (col.key === "select" || col.key === "actions") {
    return false;
  }

  const headerText = getHeaderText(col.header);
  return headerText.trim() !== "";
}
