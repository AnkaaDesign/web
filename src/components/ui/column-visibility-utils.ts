import React from "react";

/**
 * Helper function to recursively extract text from ReactNode headers
 * This is used in column visibility managers to handle both string and ReactNode headers
 */
export function getHeaderText(header: string | React.ReactNode): string {
  if (typeof header === "string") {
    return header;
  }

  if (typeof header === "number") {
    return String(header);
  }

  if (header === null || header === undefined) {
    return "";
  }

  // Handle React elements - recursively extract text from children
  if (React.isValidElement(header)) {
    const { children } = header.props as { children?: React.ReactNode };
    if (children) {
      return getHeaderText(children);
    }
    return "";
  }

  // Handle arrays of children
  if (Array.isArray(header)) {
    return header.map(getHeaderText).join("");
  }

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
