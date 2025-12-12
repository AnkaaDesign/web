import type { Paint } from "../../../../types";

// Convert hex to HSL for better color sorting
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  // Remove the hash if present
  hex = hex.replace(/^#/, "");

  // Parse the hex values
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

// Advanced color sorting algorithm that creates a smooth color flow
export function getAdvancedColorSortValue(paint: Paint): number {
  const hsl = hexToHsl(paint.hex || "#000000");

  // For grayscale colors (low saturation), sort by lightness
  if (hsl.s < 15) {
    // Map lightness to ensure blacks are first, then grays, then whites
    const lightnessOrder = hsl.l < 20 ? 0 : hsl.l < 80 ? 1 : 2;
    return lightnessOrder * 100000 + (100 - hsl.l) * 100;
  }

  // For colored paints, sort by hue to create a smooth rainbow spectrum
  // Primary sort by hue (creates color wheel ordering)
  const primarySort = hsl.h * 1000000;

  // Secondary sort by saturation (more saturated colors first within the hue)
  const saturationSort = (100 - hsl.s) * 100;

  // Tertiary sort by lightness (medium tones first, then dark, then light)
  let lightnessSort;
  if (hsl.l >= 40 && hsl.l <= 60) {
    lightnessSort = 0; // Medium tones first
  } else if (hsl.l < 40) {
    lightnessSort = 40 - hsl.l; // Dark tones
  } else {
    lightnessSort = hsl.l - 60; // Light tones
  }

  // Combine all factors for final sort value
  return primarySort + saturationSort + lightnessSort;
}

// Get a numeric value for sorting colors (legacy - kept for compatibility)
export function getColorSortValue(paint: Paint): number {
  // Use the advanced algorithm for color sorting
  return getAdvancedColorSortValue(paint);
}

// Get contrasting text color for a background
export function getContrastingTextColor(hex: string | null | undefined): string {
  if (!hex) return "#FFFFFF";

  // Remove the hash if present
  const cleanHex = String(hex).replace(/^#/, "");

  // Validate hex format
  const hexPattern = /^([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  if (!hexPattern.test(cleanHex)) {
    return "#FFFFFF";
  }

  // Handle 3-character hex
  let fullHex = cleanHex;
  if (cleanHex.length === 3) {
    fullHex = cleanHex
      .split("")
      .map((char) => char + char)
      .join("");
  }

  // Parse the hex values
  const r = parseInt(fullHex.substr(0, 2), 16);
  const g = parseInt(fullHex.substr(2, 2), 16);
  const b = parseInt(fullHex.substr(4, 2), 16);

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return black or white based on luminance
  return luminance > 0.5 ? "#000000" : "#FFFFFF";
}

// Format hex color for display
export function formatHexColor(hex: string | null | undefined): string {
  if (!hex) return "#000000";
  // Ensure hex is a string and trim any whitespace
  const cleanHex = String(hex).trim();
  // Validate hex format (3 or 6 characters)
  const hexPattern = /^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  if (!hexPattern.test(cleanHex)) {
    return "#000000";
  }
  return cleanHex.startsWith("#") ? cleanHex : `#${cleanHex}`;
}

// Get hex color from paint object
export function getHexFromPaint(paint: Paint): string {
  return formatHexColor(paint.hex);
}

// Calculate luminance of a color
export function getLuminance(hex: string): number {
  // Remove the hash if present
  const cleanHex = hex.replace(/^#/, "");

  // Handle 3-character hex
  let fullHex = cleanHex;
  if (cleanHex.length === 3) {
    fullHex = cleanHex
      .split("")
      .map((char) => char + char)
      .join("");
  }

  // Parse the hex values
  const r = parseInt(fullHex.substr(0, 2), 16) / 255;
  const g = parseInt(fullHex.substr(2, 2), 16) / 255;
  const b = parseInt(fullHex.substr(4, 2), 16) / 255;

  // Apply gamma correction
  const gammaCorrect = (value: number): number => {
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  };

  const rg = gammaCorrect(r);
  const gg = gammaCorrect(g);
  const bg = gammaCorrect(b);

  // Calculate relative luminance
  return 0.2126 * rg + 0.7152 * gg + 0.0722 * bg;
}
