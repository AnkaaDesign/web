import { parseMarkdownToInlineFormat } from "@/utils/markdown-parser";
import { getApiBaseUrl } from "@/config/api";
import type { MessageFormData } from "@/components/administration/message/editor/types";

const DECORATOR_IMAGES: Record<string, string> = {
  "header-logo": "/header-logo.webp",
  "header-logo-stripes": "/header-logo-stripes.webp",
  "footer-wave-dark": "/footer-wave-dark.webp",
  "footer-wave-logo": "/footer-wave-logo.webp",
  "footer-diagonal-stripes": "/footer-diagonal-stripes.webp",
  "footer-wave-gold": "/footer-wave-gold.webp",
  "footer-geometric": "/footer-geometric.webp",
};

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
            return `<a href="${escAttr(seg.url ?? "")}" style="color:#3bc914">${c}</a>`;
          case "color":
            return `<span style="color:${escAttr(seg.color ?? "")}">${c}</span>`;
          default:
            return c;
        }
      })
      .join("");
  };

  const sizeMap: Record<string, string> = {
    xs: "9px",
    sm: "11px",
    base: "13px",
    lg: "15px",
    xl: "17px",
    "2xl": "20px",
    "3xl": "24px",
  };
  const weightMap: Record<string, string> = {
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  };

  const toHtml = (block: any): string => {
    switch (block.type) {
      case "heading1":
      case "heading2":
      case "heading3": {
        const levelDefaults: Record<string, { tag: string; size: string; weight: string }> = {
          heading1: { tag: "h1", size: "18px", weight: "700" },
          heading2: { tag: "h2", size: "15px", weight: "600" },
          heading3: { tag: "h3", size: "13px", weight: "600" },
        };
        const lv = levelDefaults[block.type];
        const sz = sizeMap[block.fontSize] || lv.size;
        const wt = weightMap[block.fontWeight] || lv.weight;
        return `<${lv.tag} style="font-size:${sz};font-weight:${wt};margin:0 0 2px 0;line-height:1.25;color:#111827">${fmtToHtml(block.content ?? "")}</${lv.tag}>`;
      }
      case "paragraph": {
        const sz = sizeMap[block.fontSize] || "12px";
        const wt = weightMap[block.fontWeight] || "400";
        return `<p style="font-size:${sz};font-weight:${wt};line-height:1.5;margin:0;color:#111827">${fmtToHtml(block.content ?? "")}</p>`;
      }
      case "quote": {
        const sz = sizeMap[block.fontSize] || "12px";
        return `<blockquote style="border-left:3px solid #3bc914;padding:5px 10px;margin:0;font-style:italic;color:#374151;font-size:${sz};background:#f9fafb;border-radius:0 3px 3px 0">${fmtToHtml(block.content ?? "")}</blockquote>`;
      }
      case "divider":
        return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:0">`;
      case "spacer": {
        const hMap: Record<string, string> = { sm: "6px", md: "12px", lg: "20px", xl: "30px" };
        return `<div style="height:${hMap[block.height ?? "md"] ?? "12px"}"></div>`;
      }
      case "list": {
        const items = ((block.items as string[]) || [])
          .map(
            (item) =>
              `<li style="font-size:12px;line-height:1.5;margin-bottom:2px;color:#111827">${fmtToHtml(item)}</li>`,
          )
          .join("");
        const tag = block.ordered ? "ol" : "ul";
        const listStyle = block.ordered ? "decimal" : "disc";
        return `<${tag} style="list-style:${listStyle};padding-left:18px;margin:0">${items}</${tag}>`;
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
        const justify = alignJustify[block.alignment || "left"] || "flex-start";
        const maxW = block.customWidth || block.size || "50%";
        const caption = block.caption
          ? `<p style="font-size:12px;color:#9ca3af;text-align:center;margin-top:6px">${esc(block.caption)}</p>`
          : "";
        return `<div style="display:flex;justify-content:${justify}"><div style="max-width:${maxW}"><img src="${escAttr(resolveImageUrl(block.url))}" alt="${escAttr(block.alt || "")}" style="width:100%;height:auto;border-radius:8px">${caption}</div></div>`;
      }
      case "icon":
        return "";
      case "row": {
        const gapMap: Record<string, string> = { none: "0", sm: "8px", md: "16px", lg: "24px" };
        const gap = gapMap[block.gap || "md"] || "16px";
        const cells = ((block.blocks as any[]) || [])
          .map(
            (b) =>
              `<div style="flex:${b.type === "icon" ? "0 0 auto" : "1 1 0"};min-width:0">${toHtml(b)}</div>`,
          )
          .join("");
        return `<div style="display:flex;gap:${gap};align-items:flex-start">${cells}</div>`;
      }
      case "decorator": {
        const imgSrc = DECORATOR_IMAGES[block.variant] ?? DECORATOR_IMAGES["footer-wave-dark"];
        return `<img src="${window.location.origin}${imgSrc}" style="width:100%;display:block" />`;
      }
      case "company-asset": {
        const url = block.asset === "logo" ? "/logo.png" : "/android-chrome-192x192.png";
        const maxW = block.size || "75%";
        const align =
          block.alignment === "center" ? "center" : block.alignment === "right" ? "right" : "left";
        return `<div style="text-align:${align}"><img src="${window.location.origin}${url}" style="max-width:${maxW};height:auto" /></div>`;
      }
      default:
        return "";
    }
  };

  const wrapBlock = (block: any, inner: string) => {
    if (block.type === "decorator") {
      return `<div style="width:100%;margin:0;padding:0;line-height:0;font-size:0;overflow:hidden">${inner}</div>`;
    }
    if (block.type === "company-asset") {
      return `<div style="padding:4px 8mm">${inner}</div>`;
    }
    return `<div style="padding:3px 8mm">${inner}</div>`;
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
  a { color: #3bc914; }
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
