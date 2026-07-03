/**
 * Canonical rendering constants — Message Rendering Spec v1.
 * Shared by the web block renderer (src/components/messaging/*) and the
 * PDF exporter (src/utils/message-pdf-export.ts). Keep in sync with the
 * Flutter implementation.
 */

/** Canvas (spec §1) */
export const CANVAS_MAX_WIDTH = 672;
export const CANVAS_PADDING = 24; // when canvas width >= 480
export const CANVAS_PADDING_COMPACT = 16; // when canvas width < 480
export const BLOCK_GAP = 12;

/** Typography (spec §3) */
export const FONT_SIZE_PX: Record<string, number> = {
  xs: 12,
  sm: 13,
  base: 15,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
};

export const FONT_WEIGHT: Record<string, number> = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
};

export interface HeadingStyle {
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
}

/** h1 28/700/1.3, h2 22/600/1.35, h3 18/600/1.45 (h4–h6 are renderer extras). */
export const HEADING_STYLES: Record<number, HeadingStyle> = {
  1: { fontSize: 28, fontWeight: 700, lineHeight: 1.3 },
  2: { fontSize: 22, fontWeight: 600, lineHeight: 1.35 },
  3: { fontSize: 18, fontWeight: 600, lineHeight: 1.45 },
  4: { fontSize: 16, fontWeight: 600, lineHeight: 1.45 },
  5: { fontSize: 15, fontWeight: 600, lineHeight: 1.45 },
  6: { fontSize: 13, fontWeight: 600, lineHeight: 1.45 },
};

export const PARAGRAPH_FONT_SIZE = 15;
export const PARAGRAPH_LINE_HEIGHT = 1.5;

/** Quote (spec §3): 3px primary-green left border, 12px left padding, author 13px muted. */
export const QUOTE_BORDER_WIDTH = 3;
export const QUOTE_PADDING_LEFT = 12;
export const QUOTE_AUTHOR_FONT_SIZE = 13;

/** List (spec §3): 15px text, 4px between items, 20px indent per level. */
export const LIST_ITEM_GAP = 4;
export const LIST_INDENT_PER_LEVEL = 20;
export const LIST_BULLETS_BY_DEPTH = ['•', '◦', '▪'];

/** Image (spec §4) */
export const IMAGE_DEFAULT_WIDTH = '50%';
export const IMAGE_BORDER_RADIUS = 8;
export const IMAGE_CAPTION_FONT_SIZE = 13;
export const IMAGE_CAPTION_GAP = 4;

/** Company assets (spec §5) */
export const COMPANY_ASSET_SRCS: Record<string, string> = {
  logo: '/logo.png',
  icon: '/android-chrome-192x192.png',
};

/** Known intrinsic aspect ratios (w/h) of the company assets. */
export const COMPANY_ASSET_ASPECT: Record<string, number> = {
  logo: 875 / 379,
  icon: 1,
};

export const COMPANY_ASSET_DEFAULT_WIDTH = '50%';

/** Proportional height cap: h <= 0.22 × C (spec §5). */
export const COMPANY_ASSET_HEIGHT_CAP_RATIO = 0.22;

/**
 * Since asset aspects are constant, the height cap can be expressed as a
 * max-width percentage of the content area: capWidth = cap × C × aspect.
 */
export function companyAssetCapWidthPct(asset: string): number {
  const aspect = COMPANY_ASSET_ASPECT[asset] ?? 1;
  return COMPANY_ASSET_HEIGHT_CAP_RATIO * 100 * aspect;
}

/** Decorators (spec §6) — header-logo uses the compact trimmed 394×156 asset. */
export const DECORATOR_IMAGES: Record<string, string> = {
  'header-logo': '/header-logo-compact.webp',
  'header-logo-stripes': '/header-logo-stripes.webp',
  'footer-wave-dark': '/footer-wave-dark.webp',
  'footer-wave-logo': '/footer-wave-logo.webp',
  'footer-diagonal-stripes': '/footer-diagonal-stripes.webp',
  'footer-wave-gold': '/footer-wave-gold.webp',
  'footer-geometric': '/footer-geometric.webp',
};

/**
 * header-logo: left-aligned, width = min(0.60 × C, 340px), natural aspect
 * (trimmed asset 394×156 — no transparent margins, so it sits flush with the
 * text edge). The absolute cap keeps it sane on wide canvases (details panel).
 */
export const HEADER_LOGO_WIDTH_PCT = 60;
export const HEADER_LOGO_MAX_WIDTH_PX = 340;
export const HEADER_LOGO_PADDING_TOP = 12;
export const HEADER_LOGO_PADDING_BOTTOM = 4;

/** Spacer (spec §7): sm 16, md 32, lg 48, xl 64. */
export const SPACER_HEIGHTS: Record<string, number> = {
  sm: 16,
  md: 32,
  lg: 48,
  xl: 64,
};

/** Divider (spec §7): 1px hairline, 8px vertical margin. */
export const DIVIDER_MARGIN_Y = 8;

/** Row (spec §7): 12px gutter. */
export const ROW_GUTTER = 12;
