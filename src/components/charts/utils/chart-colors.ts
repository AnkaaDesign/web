/**
 * Chart Color Palettes
 * Provides consistent color schemes for all chart components
 */

export const COLOR_PALETTES = {
  // Primary palette for general use
  primary: [
    '#3b82f6', // blue-500
    '#8b5cf6', // violet-500
    '#ec4899', // pink-500
    '#f59e0b', // amber-500
    '#10b981', // emerald-500
    '#06b6d4', // cyan-500
    '#f97316', // orange-500
    '#84cc16', // lime-500
    '#a855f7', // purple-500
    '#14b8a6', // teal-500
  ],

  // Status-based colors
  status: {
    pending: '#f59e0b',      // amber-500
    in_progress: '#3b82f6',  // blue-500
    completed: '#10b981',    // emerald-500
    cancelled: '#ef4444',    // red-500
    on_hold: '#6b7280',      // gray-500
    review: '#8b5cf6',       // violet-500
  },

  // Priority colors
  priority: {
    low: '#10b981',      // green
    medium: '#f59e0b',   // amber
    high: '#f97316',     // orange
    critical: '#ef4444', // red
  },

  // Sequential palette (for continuous data)
  sequential: {
    blue: [
      '#eff6ff', '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa',
      '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a',
    ],
    green: [
      '#f0fdf4', '#dcfce7', '#bbf7d0', '#86efac', '#4ade80',
      '#10b981', '#059669', '#047857', '#065f46', '#064e3b',
    ],
    red: [
      '#fef2f2', '#fee2e2', '#fecaca', '#fca5a5', '#f87171',
      '#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d',
    ],
    orange: [
      '#fff7ed', '#ffedd5', '#fed7aa', '#fdba74', '#fb923c',
      '#f97316', '#ea580c', '#c2410c', '#9a3412', '#7c2d12',
    ],
    purple: [
      '#faf5ff', '#f3e8ff', '#e9d5ff', '#d8b4fe', '#c084fc',
      '#a855f7', '#9333ea', '#7e22ce', '#6b21a8', '#581c87',
    ],
  },

  // Diverging palette (for data with a meaningful midpoint)
  diverging: {
    redBlue: [
      '#b91c1c', '#dc2626', '#ef4444', '#f87171', '#fca5a5',
      '#f3f4f6',
      '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8',
    ],
    redGreen: [
      '#b91c1c', '#dc2626', '#ef4444', '#f87171', '#fca5a5',
      '#f3f4f6',
      '#86efac', '#4ade80', '#10b981', '#059669', '#047857',
    ],
    purpleGreen: [
      '#7e22ce', '#9333ea', '#a855f7', '#c084fc', '#d8b4fe',
      '#f3f4f6',
      '#86efac', '#4ade80', '#10b981', '#059669', '#047857',
    ],
  },

  // Category colors (for categorical data)
  category: [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#84cc16', // lime
    '#f97316', // orange
    '#14b8a6', // teal
    '#6366f1', // indigo
    '#a855f7', // purple
  ],

  // Rainbow palette
  rainbow: [
    '#ef4444', // red
    '#f97316', // orange
    '#f59e0b', // amber
    '#84cc16', // lime
    '#10b981', // emerald
    '#06b6d4', // cyan
    '#3b82f6', // blue
    '#6366f1', // indigo
    '#8b5cf6', // violet
    '#a855f7', // purple
    '#ec4899', // pink
  ],

  // Neutral/grayscale palette
  neutral: [
    '#f9fafb', // gray-50
    '#f3f4f6', // gray-100
    '#e5e7eb', // gray-200
    '#d1d5db', // gray-300
    '#9ca3af', // gray-400
    '#6b7280', // gray-500
    '#4b5563', // gray-600
    '#374151', // gray-700
    '#1f2937', // gray-800
    '#111827', // gray-900
  ],

  // Inventory-specific colors
  inventory: {
    inStock: '#10b981',      // green
    lowStock: '#f59e0b',     // amber
    outOfStock: '#ef4444',   // red
    overStock: '#3b82f6',    // blue
    reserved: '#8b5cf6',     // violet
  },

  // ABC/XYZ Analysis colors
  abc: {
    A: '#10b981', // green - high value
    B: '#f59e0b', // amber - medium value
    C: '#6b7280', // gray - low value
  },

  xyz: {
    X: '#3b82f6', // blue - stable demand
    Y: '#f59e0b', // amber - variable demand
    Z: '#ef4444', // red - irregular demand
  },

  // Financial colors
  financial: {
    revenue: '#10b981',    // green
    cost: '#ef4444',       // red
    profit: '#3b82f6',     // blue
    loss: '#f97316',       // orange
    neutral: '#6b7280',    // gray
  },

  // Performance colors
  performance: {
    excellent: '#10b981',  // green
    good: '#84cc16',       // lime
    average: '#f59e0b',    // amber
    poor: '#f97316',       // orange
    critical: '#ef4444',   // red
  },
};

/**
 * Get a color from a palette by index
 * Wraps around if index exceeds palette length
 */
export function getColorFromPalette(palette: string[], index: number): string {
  return palette[index % palette.length];
}

/**
 * Get a color based on a value and thresholds
 */
export function getColorByThreshold(
  value: number,
  thresholds: { min: number; max: number; color: string }[]
): string {
  const sorted = [...thresholds].sort((a, b) => a.min - b.min);

  for (const threshold of sorted) {
    if (value >= threshold.min && value <= threshold.max) {
      return threshold.color;
    }
  }

  return COLOR_PALETTES.neutral[5]; // default gray
}

/**
 * Generate a gradient between two colors
 */
export function generateGradient(
  color1: string,
  color2: string,
  steps: number = 10
): string[] {
  // This is a simplified version - for production, use a color library
  const colors: string[] = [];

  for (let i = 0; i < steps; i++) {
    const ratio = i / (steps - 1);
    // For now, just return the palette colors
    colors.push(ratio < 0.5 ? color1 : color2);
  }

  return colors;
}

/**
 * Get opacity-adjusted color
 */
export function withOpacity(color: string, opacity: number): string {
  // Convert hex to rgba with opacity
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Get contrasting text color (black or white) for a background color
 */
export function getContrastColor(backgroundColor: string): string {
  // Convert hex to RGB
  const hex = backgroundColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5 ? '#000000' : '#ffffff';
}
