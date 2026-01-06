/**
 * Standardized layout and spacing constants for consistent UI across the application
 *
 * These constants ensure visual consistency for:
 * - Page containers and wrappers
 * - Section spacing (between cards/sections)
 * - Content padding (inside cards/sections)
 * - Page header spacing
 */

/**
 * Page-level spacing constants
 */
export const PAGE_SPACING = {
  /** Padding around the entire page content (left, right, top, bottom) */
  CONTAINER: 'px-4 py-4',

  /** Spacing between page header and main content */
  HEADER_TO_CONTENT: 'mt-4',

  /** Spacing between major sections/cards within a page */
  BETWEEN_SECTIONS: 'space-y-4',

  /** Gap for grid layouts (detail pages with multiple columns) */
  GRID_GAP: 'gap-4',
} as const;

/**
 * Card/Section-level spacing constants
 */
export const SECTION_SPACING = {
  /** Padding inside card content areas */
  CONTENT_PADDING: 'p-4',

  /** Spacing between items within a section */
  BETWEEN_ITEMS: 'space-y-4',

  /** Spacing between form fields */
  BETWEEN_FIELDS: 'space-y-4',

  /** Gap between columns in a grid layout inside cards */
  GRID_GAP: 'gap-4',
} as const;

/**
 * List/Table page specific spacing
 */
export const LIST_PAGE_SPACING = {
  /** Container - provides horizontal and top padding only (use CONTENT_WRAPPER for scrollable area) */
  CONTAINER: 'px-4 pt-4',

  /** Wrapper for scrollable content with bottom padding */
  CONTENT_WRAPPER: 'flex-1 overflow-y-auto pb-6 space-y-4',

  /** Spacing between page header and table card */
  HEADER_TO_TABLE: 'mt-4',

  /** Spacing between filters and table */
  FILTERS_TO_TABLE: 'space-y-4',
} as const;

/**
 * Detail page specific spacing
 */
export const DETAIL_PAGE_SPACING = {
  /** Container - provides horizontal and top padding only (use CONTENT_WRAPPER for scrollable area) */
  CONTAINER: 'px-4 pt-4',

  /** Wrapper for scrollable content with bottom padding */
  CONTENT_WRAPPER: 'flex-1 overflow-y-auto pb-6',

  /** Spacing between page header and content grid */
  HEADER_TO_GRID: 'mt-4',

  /** Grid layout for detail pages (responsive) */
  GRID_LAYOUT: 'grid grid-cols-1 lg:grid-cols-2 gap-4',

  /** Full width section (spans all columns) */
  FULL_WIDTH: 'lg:col-span-2',
} as const;

/**
 * Utility function to combine spacing classes
 */
export function combineSpacing(...classes: string[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Get standard page container classes
 */
export function getPageContainerClasses(variant: 'list' | 'detail' | 'form' = 'detail'): string {
  const base = 'h-full flex flex-col';

  switch (variant) {
    case 'list':
      return combineSpacing(base, LIST_PAGE_SPACING.CONTAINER);
    case 'detail':
      return combineSpacing(base, DETAIL_PAGE_SPACING.CONTAINER);
    case 'form':
      return combineSpacing(base, PAGE_SPACING.CONTAINER);
    default:
      return combineSpacing(base, PAGE_SPACING.CONTAINER);
  }
}

/**
 * Get standard section spacing classes
 */
export function getSectionSpacingClasses(): string {
  return PAGE_SPACING.BETWEEN_SECTIONS;
}

/**
 * Get standard detail grid classes
 */
export function getDetailGridClasses(): string {
  return DETAIL_PAGE_SPACING.GRID_LAYOUT;
}
