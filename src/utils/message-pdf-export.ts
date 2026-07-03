import { parseMarkdownToInlineFormat } from "@/utils/markdown-parser";
import { getApiBaseUrl } from "@/config/api";
import type { MessageFormData } from "@/components/administration/message/editor/types";
import {
  CANVAS_MAX_WIDTH,
  CANVAS_PADDING,
  BLOCK_GAP,
  FONT_SIZE_PX,
  FONT_WEIGHT,
  HEADING_STYLES,
  PARAGRAPH_FONT_SIZE,
  PARAGRAPH_LINE_HEIGHT,
  QUOTE_BORDER_WIDTH,
  QUOTE_PADDING_LEFT,
  LIST_ITEM_GAP,
  LIST_INDENT_PER_LEVEL,
  IMAGE_DEFAULT_WIDTH,
  IMAGE_BORDER_RADIUS,
  IMAGE_CAPTION_FONT_SIZE,
  IMAGE_CAPTION_GAP,
  COMPANY_ASSET_SRCS,
  COMPANY_ASSET_DEFAULT_WIDTH,
  companyAssetCapWidthPct,
  DECORATOR_IMAGES,
  HEADER_LOGO_WIDTH_PCT,
  HEADER_LOGO_MAX_WIDTH_PX,
  HEADER_LOGO_PADDING_TOP,
  HEADER_LOGO_PADDING_BOTTOM,
  SPACER_HEIGHTS,
  DIVIDER_MARGIN_Y,
  ROW_GUTTER,
} from "@/components/messaging/render-constants";

/**
 * PDF export — Message Rendering Spec §8.
 *
 * Keeps the A4 paginator with repeated header/footer bands; all canonical
 * block rules apply with W = printable width and sizes scaled by
 * printScale = printableWidthPx / 672, so each page is a faithful scaled
 * canvas. Buttons and icons are omitted (interactive-only).
 */

const PX_PER_MM = 96 / 25.4;
const PRINTABLE_WIDTH_PX = 210 * PX_PER_MM; // A4 width, zero page margins
const PRINT_SCALE = PRINTABLE_WIDTH_PX / CANVAS_MAX_WIDTH;

/** Scale a spec px value to print px. */
const sp = (px: number): string => `${Math.round(px * PRINT_SCALE * 100) / 100}px`;

/** Content (horizontal) padding P, scaled. */
const PAD = sp(CANVAS_PADDING);

/** Scale a CSS size value: numeric px values scale, % passes through (it is relative to C already). */
const scaleSize = (value: string): string => {
  const m = /^(\d+(?:\.\d+)?)px$/.exec(String(value).trim());
  if (m) return sp(parseFloat(m[1]));
  return value;
};

const PRIMARY_GREEN = "#15803d"; // green-700, matches web --primary

const resolveImageUrl = (url: string) => {
  if (!url) return url;
  if (url.startsWith("/")) return `${getApiBaseUrl()}${url}`;
  return url;
};

export const exportMessageToPdf = (data: Pick<MessageFormData, "title" | "blocks">) => {
  const printWindow = window.open("", "_blank", "width=900,height=1200");
  if (!printWindow) return;

  const esc = (s: string) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escAttr = (s: string) =>
    String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");

  const fmtToHtml = (text: string): string => {
    const segments = parseMarkdownToInlineFormat(text);
    return segments
      .map((seg: any) => {
        const c = esc(seg.content ?? "").replace(/\n/g, "<br>");
        switch (seg.type) {
          case "bold":
            return `<strong>${c}</strong>`;
          case "italic":
            return `<em>${c}</em>`;
          case "underline":
            return `<u>${c}</u>`;
          case "link":
            return `<a href="${escAttr(seg.url ?? "")}" style="color:${PRIMARY_GREEN}">${c}</a>`;
          case "color":
            return `<span style="color:${escAttr(seg.color ?? "")}">${c}</span>`;
          default:
            return c;
        }
      })
      .join("");
  };

  /** Font-size token → scaled print size (spec tokens: xs 12 … 3xl 28). */
  const tokenSize = (token: string | undefined, fallbackPx: number): string =>
    sp(token && FONT_SIZE_PX[token] ? FONT_SIZE_PX[token] : fallbackPx);

  const tokenWeight = (token: string | undefined, fallback: number): number =>
    token && FONT_WEIGHT[token] ? FONT_WEIGHT[token] : fallback;

  const toHtml = (block: any): string => {
    switch (block.type) {
      case "heading1":
      case "heading2":
      case "heading3": {
        const level = block.type === "heading1" ? 1 : block.type === "heading2" ? 2 : 3;
        const hs = HEADING_STYLES[level];
        const tag = `h${level}`;
        const sz = tokenSize(block.fontSize, hs.fontSize);
        const wt = tokenWeight(block.fontWeight, hs.fontWeight);
        return `<${tag} style="font-size:${sz};font-weight:${wt};margin:0;line-height:${hs.lineHeight};color:#111827">${fmtToHtml(block.content ?? "")}</${tag}>`;
      }
      case "paragraph": {
        const sz = tokenSize(block.fontSize, PARAGRAPH_FONT_SIZE);
        const wt = tokenWeight(block.fontWeight, 400);
        return `<p style="font-size:${sz};font-weight:${wt};line-height:${PARAGRAPH_LINE_HEIGHT};margin:0;color:#111827">${fmtToHtml(block.content ?? "")}</p>`;
      }
      case "quote": {
        const sz = tokenSize(block.fontSize, PARAGRAPH_FONT_SIZE);
        const wt = tokenWeight(block.fontWeight, 400);
        return `<blockquote style="border-left:${sp(QUOTE_BORDER_WIDTH)} solid ${PRIMARY_GREEN};padding:0 0 0 ${sp(QUOTE_PADDING_LEFT)};margin:0;font-style:italic;color:#111827;font-size:${sz};font-weight:${wt};line-height:${PARAGRAPH_LINE_HEIGHT}">${fmtToHtml(block.content ?? "")}</blockquote>`;
      }
      case "divider":
        return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:${sp(DIVIDER_MARGIN_Y)} 0">`;
      case "spacer": {
        const h = SPACER_HEIGHTS[block.height ?? "md"] ?? SPACER_HEIGHTS.md;
        return `<div style="height:${sp(h)}"></div>`;
      }
      case "list": {
        const items = ((block.items as string[]) || [])
          .map(
            (item, i) =>
              `<li style="font-size:${sp(PARAGRAPH_FONT_SIZE)};line-height:${PARAGRAPH_LINE_HEIGHT};margin-top:${i > 0 ? sp(LIST_ITEM_GAP) : "0"};color:#111827">${fmtToHtml(item)}</li>`,
          )
          .join("");
        const tag = block.ordered ? "ol" : "ul";
        const listStyle = block.ordered ? "decimal" : "disc";
        return `<${tag} style="list-style:${listStyle};padding-left:${sp(LIST_INDENT_PER_LEVEL)};margin:0">${items}</${tag}>`;
      }
      case "button":
        return "";
      case "image": {
        if (!block.url) return "";
        const alignJustify: Record<string, string> = {
          left: "flex-start",
          center: "center",
          right: "flex-end",
        };
        // Spec §4: default alignment center; width = customWidth ?? size ?? 50%
        const justify = alignJustify[block.alignment || "center"] || "center";
        const width = scaleSize(block.customWidth || block.size || IMAGE_DEFAULT_WIDTH);
        const caption = block.caption
          ? `<p style="font-size:${sp(IMAGE_CAPTION_FONT_SIZE)};color:#9ca3af;text-align:center;margin:${sp(IMAGE_CAPTION_GAP)} 0 0 0">${esc(block.caption)}</p>`
          : "";
        return `<div style="display:flex;justify-content:${justify}"><div style="width:${width};max-width:100%"><img src="${escAttr(resolveImageUrl(block.url))}" alt="${escAttr(block.alt || "")}" style="width:100%;height:auto;border-radius:${sp(IMAGE_BORDER_RADIUS)}">${caption}</div></div>`;
      }
      case "icon":
        return "";
      case "row": {
        const gapMap: Record<string, number> = { none: 0, sm: 8, md: ROW_GUTTER, lg: 16 };
        const gap = sp(gapMap[block.gap || "md"] ?? ROW_GUTTER);
        const cells = ((block.blocks as any[]) || [])
          .map(
            (b) =>
              `<div style="flex:${b.type === "icon" ? "0 0 auto" : "1 1 0"};min-width:0">${toHtml(b)}</div>`,
          )
          .join("");
        return `<div style="display:flex;gap:${gap};align-items:flex-start">${cells}</div>`;
      }
      case "decorator": {
        const LEGACY: Record<string, string> = {
          "header-main": "header-logo",
          "footer-main": "footer-wave-dark",
        };
        const variant = LEGACY[block.variant] ?? block.variant;
        const imgSrc = DECORATOR_IMAGES[variant];
        if (!imgSrc) return "";
        const src = `${window.location.origin}${imgSrc}`;
        if (variant === "header-logo") {
          // Spec §6: compact cropped logo, left-aligned, HEADER_LOGO_WIDTH_PCT of the content
          // area, natural aspect; padding: left P, top 12, bottom 4.
          return `<div style="padding:${sp(HEADER_LOGO_PADDING_TOP)} ${PAD} ${sp(HEADER_LOGO_PADDING_BOTTOM)} ${PAD}"><img src="${src}" style="width:min(${HEADER_LOGO_WIDTH_PCT}%, ${sp(HEADER_LOGO_MAX_WIDTH_PX)});height:auto;display:block" /></div>`;
        }
        // Full-bleed bands, natural aspect (no crop/stretch)
        return `<img src="${src}" style="width:100%;height:auto;display:block" />`;
      }
      case "company-asset": {
        const url = COMPANY_ASSET_SRCS[block.asset] ?? COMPANY_ASSET_SRCS.logo;
        // Spec §5: width = size ?? 50% (px honored, scaled); height cap
        // h <= 0.18C expressed as an equivalent max-width percentage.
        const width = scaleSize(block.size || COMPANY_ASSET_DEFAULT_WIDTH);
        const capPct = companyAssetCapWidthPct(block.asset);
        const alignJustify: Record<string, string> = {
          left: "flex-start",
          center: "center",
          right: "flex-end",
        };
        const justify = alignJustify[block.alignment || "center"] || "center";
        return `<div style="display:flex;justify-content:${justify}"><img src="${window.location.origin}${url}" style="width:${width};max-width:min(100%, ${capPct}%);height:auto" /></div>`;
      }
      default:
        return "";
    }
  };

  const wrapBlock = (block: any, inner: string) => {
    if (block.type === "decorator") {
      // header-logo carries its own padding; bands are full-bleed
      return `<div style="width:100%;margin:0;padding:0;line-height:0;font-size:0;overflow:hidden">${inner}</div>`;
    }
    // 12px gap between consecutive blocks → half above + half below each block
    return `<div style="padding:${sp(BLOCK_GAP / 2)} ${PAD}">${inner}</div>`;
  };

  const blocks = data.blocks;
  const firstBlock = blocks[0];
  const lastBlock = blocks[blocks.length - 1];
  const hasHeader = firstBlock?.type === "decorator" && blocks.length > 0;
  const hasFooter = lastBlock?.type === "decorator" && !(hasHeader && blocks.length === 1);

  const headerHtmlStr = hasHeader ? toHtml(firstBlock) : "";
  const footerHtmlStr = hasFooter ? toHtml(lastBlock) : "";

  const contentBlocks = blocks.filter((_, i) => {
    if (hasHeader && i === 0) return false;
    if (hasFooter && i === blocks.length - 1) return false;
    return true;
  });
  const blockItems = contentBlocks
    .map((block) => {
      const inner = toHtml(block);
      return inner ? wrapBlock(block, inner) : "";
    })
    .filter(Boolean);

  const measureHtml = [
    hasHeader ? `<div id="hm" style="width:100%">${headerHtmlStr}</div>` : "",
    hasFooter ? `<div id="fm" style="width:100%">${footerHtmlStr}</div>` : "",
    ...blockItems.map((html, i) => `<div data-b="${i}" style="width:100%">${html}</div>`),
  ].join("");

  printWindow.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${esc(data.title || "Mensagem")}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
    color: #111827;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  strong { font-weight: 700; }
  em { font-style: italic; }
  u { text-decoration: underline; }
  a { color: ${PRIMARY_GREEN}; }
  img { max-width: 100%; }
</style>
</head>
<body>
<div id="mc" style="position:fixed;top:-9999px;left:0;width:210mm;visibility:hidden">${measureHtml}</div>
<div id="out"></div>
<script>
(function() {
  var HEADER_HTML = ${JSON.stringify(headerHtmlStr)};
  var FOOTER_HTML = ${JSON.stringify(footerHtmlStr)};
  var PX_PER_MM = 96 / 25.4;

  function build() {
    var mc = document.getElementById('mc');

    var hmEl = document.getElementById('hm');
    var fmEl = document.getElementById('fm');
    var HEADER_PX = hmEl ? Math.ceil(hmEl.getBoundingClientRect().height) : 0;
    var FOOTER_PX = fmEl ? Math.ceil(fmEl.getBoundingClientRect().height) : 0;

    var PAGE_PX = Math.floor(297 * PX_PER_MM);
    var AVAIL_PX = PAGE_PX - HEADER_PX - FOOTER_PX;

    var els = Array.from(mc.querySelectorAll('[data-b]'));
    var items = els.map(function(el) {
      return { h: Math.ceil(el.getBoundingClientRect().height), html: el.innerHTML };
    });

    var pages = [], page = [], used = 0;
    items.forEach(function(item) {
      if (used + item.h > AVAIL_PX && page.length > 0) {
        pages.push(page); page = [item]; used = item.h;
      } else {
        page.push(item); used += item.h;
      }
    });
    if (page.length > 0) pages.push(page);
    if (pages.length === 0) pages = [[]];

    var hBar = HEADER_PX > 0
      ? '<div style="line-height:0;font-size:0;overflow:hidden;flex-shrink:0">' + HEADER_HTML + '</div>'
      : '';
    var fBar = FOOTER_PX > 0
      ? '<div style="line-height:0;font-size:0;overflow:hidden;flex-shrink:0">' + FOOTER_HTML + '</div>'
      : '';

    var html = pages.map(function(p, i) {
      var notLast = i < pages.length - 1;
      var content = p.map(function(b) { return b.html; }).join('');
      return '<div style="width:210mm;height:297mm;display:flex;flex-direction:column;' +
             (notLast ? 'page-break-after:always;break-after:page;' : '') + '">' +
        hBar +
        '<div style="flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column;">' + content + '</div>' +
        fBar +
        '</div>';
    }).join('');

    document.getElementById('out').innerHTML = html;
    mc.remove();

    setTimeout(function() { window.print(); }, 400);
  }

  if (document.readyState === 'complete') { build(); }
  else { window.addEventListener('load', build); }
})();
<\/script>
</body>
</html>`);
  printWindow.document.close();
};
