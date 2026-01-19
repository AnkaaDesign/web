import type { Task } from "../types";

/**
 * Calculates the measures for a task based on its truck layout.
 * Formula: (sum of section widths) × layout height
 * Takes either left or right side layout (both sides have the same dimensions).
 *
 * @param task - The task object with truck and layout data
 * @returns Measures in square meters, or null if no layout data exists
 */
export function calculateTaskMeasures(task: Task): number | null {
  if (!task.truck) return null;

  const { truck } = task;

  // Try left side layout first, then right side (both have the same dimensions)
  const layout = truck.leftSideLayout || truck.rightSideLayout;

  if (!layout?.layoutSections || layout.layoutSections.length === 0) {
    return null;
  }

  // Calculate total width by summing all section widths
  const totalWidth = layout.layoutSections.reduce(
    (sum, section) => sum + section.width,
    0
  );

  // Calculate measures: width × height
  const measures = totalWidth * layout.height;

  return measures > 0 ? measures : null;
}

/**
 * Gets the width and height dimensions for a task.
 *
 * @param task - The task object with truck and layout data
 * @returns Object with width and height, or null if no layout data exists
 */
export function getTaskDimensions(task: Task): { width: number; height: number } | null {
  if (!task.truck) return null;

  const { truck } = task;

  // Try left side layout first, then right side (both have the same dimensions)
  const layout = truck.leftSideLayout || truck.rightSideLayout;

  if (!layout?.layoutSections || layout.layoutSections.length === 0) {
    return null;
  }

  // Calculate total width by summing all section widths
  const totalWidth = layout.layoutSections.reduce(
    (sum, section) => sum + section.width,
    0
  );

  return {
    width: totalWidth,
    height: layout.height,
  };
}

/**
 * Formats the measures for display as "W x H" in centimeters.
 *
 * @param task - The task object with truck and layout data
 * @returns Formatted string (e.g., "850 x 244")
 */
export function formatTaskMeasures(task: Task): string {
  const dimensions = getTaskDimensions(task);

  if (!dimensions) return "-";

  const widthCm = Math.round(dimensions.width * 100);
  const heightCm = Math.round(dimensions.height * 100);

  return `${widthCm} x ${heightCm}`;
}
