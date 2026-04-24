import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import { IconDeviceDesktop, IconDeviceMobile, IconFileDownload } from "@tabler/icons-react";
import * as TablerIcons from "@tabler/icons-react";
import type { MessageFormData, DecoratorVariant } from "./types";
import { useState } from "react";
import { parseMarkdownToInlineFormat } from "@/utils/markdown-parser";
import { getApiBaseUrl } from "@/config/api";

interface MessagePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: MessageFormData;
}

const DECORATOR_IMAGES: Record<string, string> = {
  'header-logo': '/header-logo.webp',
  'header-logo-stripes': '/header-logo-stripes.webp',
  'footer-wave-dark': '/footer-wave-dark.webp',
  'footer-wave-logo': '/footer-wave-logo.webp',
  'footer-diagonal-stripes': '/footer-diagonal-stripes.webp',
  'footer-wave-gold': '/footer-wave-gold.webp',
  'footer-geometric': '/footer-geometric.webp',
};

const DecoratorPreview = ({ variant }: { variant: DecoratorVariant }) => {
  const src = DECORATOR_IMAGES[variant] ?? DECORATOR_IMAGES['footer-wave-dark'];
  const isHeader = variant.startsWith('header-');
  return (
    <img
      src={src}
      alt="Decoração"
      style={{
        width: '100%',
        display: 'block',
        ...(isHeader ? { height: '80px', objectFit: 'cover', objectPosition: 'left center' } : {}),
      }}
    />
  );
};

export const MessagePreviewDialog = ({ open, onOpenChange, data }: MessagePreviewDialogProps) => {
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');

  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=1200');
    if (!printWindow) return;

    const previewEl = document.getElementById('message-preview-content');

    const esc = (s: string) =>
      String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const escAttr = (s: string) =>
      String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

    const fmtToHtml = (text: string): string => {
      const segments = parseMarkdownToInlineFormat(text);
      return segments.map((seg: any) => {
        const c = esc(seg.content ?? '').replace(/\n/g, '<br>');
        switch (seg.type) {
          case 'bold': return `<strong>${c}</strong>`;
          case 'italic': return `<em>${c}</em>`;
          case 'underline': return `<u>${c}</u>`;
          case 'link': return `<a href="${escAttr(seg.url ?? '')}" style="color:#3bc914">${c}</a>`;
          case 'color': return `<span style="color:${escAttr(seg.color ?? '')}">${c}</span>`;
          default: return c;
        }
      }).join('');
    };

    const sizeMap: Record<string, string> = {
      xs: '9px', sm: '11px', base: '13px', lg: '15px',
      xl: '17px', '2xl': '20px', '3xl': '24px',
    };
    const weightMap: Record<string, string> = {
      normal: '400', medium: '500', semibold: '600', bold: '700',
    };

    // Inner content block renderer — no outer margin/padding (wrapper controls vertical rhythm)
    const toHtml = (block: any): string => {
      switch (block.type) {
        case 'heading1':
        case 'heading2':
        case 'heading3': {
          const levelDefaults: Record<string, { tag: string; size: string; weight: string }> = {
            heading1: { tag: 'h1', size: '18px', weight: '700' },
            heading2: { tag: 'h2', size: '15px', weight: '600' },
            heading3: { tag: 'h3', size: '13px', weight: '600' },
          };
          const lv = levelDefaults[block.type];
          const sz = sizeMap[block.fontSize] || lv.size;
          const wt = weightMap[block.fontWeight] || lv.weight;
          return `<${lv.tag} style="font-size:${sz};font-weight:${wt};margin:0 0 2px 0;line-height:1.25;color:#111827">${fmtToHtml(block.content ?? '')}</${lv.tag}>`;
        }
        case 'paragraph': {
          const sz = sizeMap[block.fontSize] || '12px';
          const wt = weightMap[block.fontWeight] || '400';
          return `<p style="font-size:${sz};font-weight:${wt};line-height:1.5;margin:0;color:#111827">${fmtToHtml(block.content ?? '')}</p>`;
        }
        case 'quote': {
          const sz = sizeMap[block.fontSize] || '12px';
          return `<blockquote style="border-left:3px solid #3bc914;padding:5px 10px;margin:0;font-style:italic;color:#374151;font-size:${sz};background:#f9fafb;border-radius:0 3px 3px 0">${fmtToHtml(block.content ?? '')}</blockquote>`;
        }
        case 'divider':
          return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:0">`;
        case 'spacer': {
          const hMap: Record<string, string> = { sm: '6px', md: '12px', lg: '20px', xl: '30px' };
          return `<div style="height:${hMap[block.height ?? 'md'] ?? '12px'}"></div>`;
        }
        case 'list': {
          const items = (block.items as string[] || [])
            .map(item => `<li style="font-size:12px;line-height:1.5;margin-bottom:2px;color:#111827">${fmtToHtml(item)}</li>`)
            .join('');
          const tag = block.ordered ? 'ol' : 'ul';
          const listStyle = block.ordered ? 'decimal' : 'disc';
          return `<${tag} style="list-style:${listStyle};padding-left:18px;margin:0">${items}</${tag}>`;
        }
        case 'button':
          return '';
        case 'image': {
          if (!block.url) return '';
          const alignJustify: Record<string, string> = { left: 'flex-start', center: 'center', right: 'flex-end' };
          const justify = alignJustify[block.alignment || 'left'] || 'flex-start';
          const maxW = block.customWidth || block.size || '50%';
          const caption = block.caption
            ? `<p style="font-size:12px;color:#9ca3af;text-align:center;margin-top:6px">${esc(block.caption)}</p>`
            : '';
          return `<div style="display:flex;justify-content:${justify}"><div style="max-width:${maxW}"><img src="${escAttr(resolveImageUrl(block.url))}" alt="${escAttr(block.alt || '')}" style="width:100%;height:auto;border-radius:8px">${caption}</div></div>`;
        }
        case 'icon':
          return '';
        case 'row': {
          const gapMap: Record<string, string> = { none: '0', sm: '8px', md: '16px', lg: '24px' };
          const gap = gapMap[block.gap || 'md'] || '16px';
          const cells = (block.blocks as any[] || [])
            .map(b => `<div style="flex:${b.type === 'icon' ? '0 0 auto' : '1 1 0'};min-width:0">${toHtml(b)}</div>`)
            .join('');
          return `<div style="display:flex;gap:${gap};align-items:flex-start">${cells}</div>`;
        }
        case 'decorator': {
          const imgSrc = DECORATOR_IMAGES[block.variant] ?? DECORATOR_IMAGES['footer-wave-dark'];
          return `<img src="${window.location.origin}${imgSrc}" style="width:100%;display:block" />`;
        }
        case 'company-asset': {
          const url = block.asset === 'logo' ? '/logo.png' : '/android-chrome-192x192.png';
          const maxW = block.size || '75%';
          const align = block.alignment === 'center' ? 'center' : block.alignment === 'right' ? 'right' : 'left';
          return `<div style="text-align:${align}"><img src="${window.location.origin}${url}" style="max-width:${maxW};height:auto" /></div>`;
        }
        default:
          return '';
      }
    };

    // Wrapper: decorator = edge-to-edge, everything else = tight vertical + 14mm horizontal margin
    const wrapBlock = (block: any, inner: string) => {
      if (block.type === 'decorator') {
        return `<div style="width:100%;margin:0;padding:0;line-height:0;font-size:0;overflow:hidden">${inner}</div>`;
      }
      if (block.type === 'company-asset') {
        return `<div style="padding:4px 8mm">${inner}</div>`;
      }
      return `<div style="padding:3px 8mm">${inner}</div>`;
    };

    // Detect header (first block = decorator) and footer (last block = decorator)
    const blocks = data.blocks;
    const firstBlock = blocks[0];
    const lastBlock = blocks[blocks.length - 1];
    const hasHeader = firstBlock?.type === 'decorator' && blocks.length > 0;
    const hasFooter = lastBlock?.type === 'decorator' && !(hasHeader && blocks.length === 1);

    // Pre-generate header / footer HTML strings to embed in the script.
    const headerHtmlStr = hasHeader ? toHtml(firstBlock) : '';
    const footerHtmlStr = hasFooter ? toHtml(lastBlock) : '';

    // Generate individual wrapped block HTML strings for content blocks.
    const contentBlocks = blocks.filter((_, i) => {
      if (hasHeader && i === 0) return false;
      if (hasFooter && i === blocks.length - 1) return false;
      return true;
    });
    const blockItems = contentBlocks
      .map(block => { const inner = toHtml(block); return inner ? wrapBlock(block, inner) : ''; })
      .filter(Boolean);

    // Measurement container includes header/footer divs so JS can measure their actual heights.
    const measureHtml = [
      hasHeader ? `<div id="hm" style="width:100%">${headerHtmlStr}</div>` : '',
      hasFooter ? `<div id="fm" style="width:100%">${footerHtmlStr}</div>` : '',
      ...blockItems.map((html, i) => `<div data-b="${i}" style="width:100%">${html}</div>`),
    ].join('');

    printWindow.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${esc(data.title || 'Mensagem')}</title>
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
<!-- Hidden measurement container: 210mm wide so heights match print layout -->
<div id="mc" style="position:fixed;top:-9999px;left:0;width:210mm;visibility:hidden">${measureHtml}</div>
<div id="out"></div>
<script>
(function() {
  var HEADER_HTML = ${JSON.stringify(headerHtmlStr)};
  var FOOTER_HTML = ${JSON.stringify(footerHtmlStr)};
  var PX_PER_MM = 96 / 25.4;

  function build() {
    var mc = document.getElementById('mc');

    // Measure actual header/footer rendered heights so bars have no blank space
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

    // No fixed height — image renders at its natural height, no blank strip
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

  // Helper to render text content with newlines converted to <br /> elements
  const renderTextWithLineBreaks = (text: string) => {
    if (!text.includes('\n')) {
      return text;
    }

    const parts = text.split('\n');
    return parts.map((part, i) => (
      <span key={i}>
        {part}
        {i < parts.length - 1 && <br />}
      </span>
    ));
  };

  // Helper to render formatted text with markdown support
  const renderFormattedText = (text: string) => {
    const formatted = parseMarkdownToInlineFormat(text);
    return formatted.map((format, index) => {
      const key = `fmt-${index}`;
      switch (format.type) {
        case 'text':
          return <span key={key}>{renderTextWithLineBreaks(format.content)}</span>;
        case 'bold':
          return <strong key={key} className="font-semibold">{renderTextWithLineBreaks(format.content)}</strong>;
        case 'italic':
          return <em key={key} className="italic">{renderTextWithLineBreaks(format.content)}</em>;
        case 'link':
          return (
            <a
              key={key}
              href={format.url}
              className="text-primary hover:underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              {renderTextWithLineBreaks(format.content)}
            </a>
          );
        case 'underline':
          return <u key={key}>{renderTextWithLineBreaks(format.content)}</u>;
        case 'color':
          return (
            <span key={key} style={{ color: format.color }}>
              {renderTextWithLineBreaks(format.content)}
            </span>
          );
        default:
          return null;
      }
    });
  };

  const resolveImageUrl = (url: string) => {
    if (!url) return url;
    if (url.startsWith("/")) return `${getApiBaseUrl()}${url}`;
    return url;
  };

  const renderBlock = (block: any) => {
    // Helper to get font size class
    const getFontSizeClass = (size?: string) => {
      const sizes: Record<string, string> = {
        xs: 'text-xs',
        sm: 'text-sm',
        base: 'text-base',
        lg: 'text-lg',
        xl: 'text-xl',
        '2xl': 'text-2xl',
        '3xl': 'text-3xl',
      };
      return size ? sizes[size] : '';
    };

    // Default sizes for headings when no custom size is set
    const defaultHeadingSizes: Record<number, string> = {
      1: 'text-4xl md:text-5xl',
      2: 'text-3xl md:text-4xl',
      3: 'text-2xl md:text-3xl',
    };

    // Get effective heading size: custom if provided, otherwise default
    const getEffectiveHeadingSize = (level: number, customSize?: string) => {
      if (!customSize) return defaultHeadingSizes[level];
      return getFontSizeClass(customSize);
    };

    // Helper to get font weight class
    const getFontWeightClass = (weight?: string) => {
      const weights: Record<string, string> = {
        normal: 'font-normal',
        medium: 'font-medium',
        semibold: 'font-semibold',
        bold: 'font-bold',
      };
      return weight ? weights[weight] : '';
    };

    switch (block.type) {
      case 'heading1':
        return (
          <h1 className={`${getEffectiveHeadingSize(1, block.fontSize)} ${getFontWeightClass(block.fontWeight) || 'font-bold'} break-words whitespace-normal`}>
            {renderFormattedText(block.content)}
          </h1>
        );
      case 'heading2':
        return (
          <h2 className={`${getEffectiveHeadingSize(2, block.fontSize)} ${getFontWeightClass(block.fontWeight) || 'font-semibold'} break-words whitespace-normal`}>
            {renderFormattedText(block.content)}
          </h2>
        );
      case 'heading3':
        return (
          <h3 className={`${getEffectiveHeadingSize(3, block.fontSize)} ${getFontWeightClass(block.fontWeight) || 'font-medium'} break-words whitespace-normal`}>
            {renderFormattedText(block.content)}
          </h3>
        );
      case 'paragraph':
        return (
          <p className={`${getFontSizeClass(block.fontSize) || 'text-base'} ${getFontWeightClass(block.fontWeight) || 'font-normal'} leading-relaxed break-words whitespace-normal`}>
            {renderFormattedText(block.content)}
          </p>
        );
      case 'quote':
        return (
          <blockquote className={`border-l-4 border-primary pl-4 italic ${getFontSizeClass(block.fontSize) || 'text-lg'} ${getFontWeightClass(block.fontWeight) || 'font-normal'} break-words whitespace-normal`}>
            {renderFormattedText(block.content)}
          </blockquote>
        );
      case 'image':
        // Calculate size style (matching ImageBlock component)
        const getSizeStyle = () => {
          // If customWidth is provided, use it directly
          if (block.customWidth) {
            return { maxWidth: block.customWidth };
          }

          // If size is provided, use it
          if (block.size) {
            return { maxWidth: block.size };
          }

          // Default to 50% (medium)
          return { maxWidth: '50%' };
        };

        return (
          <div className={`flex ${block.alignment === 'center' ? 'justify-center' : block.alignment === 'right' ? 'justify-end' : 'justify-start'}`}>
            <div style={getSizeStyle()}>
              <img
                src={resolveImageUrl(block.url)}
                alt={block.alt || ''}
                className="w-full h-auto rounded-lg"
              />
              {block.caption && (
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  {block.caption}
                </p>
              )}
            </div>
          </div>
        );
      case 'button': {
        const buttonContent = (
          <Button
            variant={block.variant || 'default'}
            className="my-2 print:hidden"
            onClick={() => block.url && window.open(block.url, '_blank', 'noopener,noreferrer')}
          >
            {block.text}
          </Button>
        );

        if (block.alignment) {
          const buttonAlignmentClasses = {
            left: 'justify-start',
            center: 'justify-center',
            right: 'justify-end',
          };
          return (
            <div className={`flex my-4 first:mt-0 last:mb-0 print:hidden ${buttonAlignmentClasses[block.alignment as keyof typeof buttonAlignmentClasses]}`}>
              {buttonContent}
            </div>
          );
        }

        return buttonContent;
      }
      case 'divider':
        return <Separator />;
      case 'list':
        return block.ordered ? (
          <ol className="list-decimal list-inside space-y-1">
            {block.items.map((item: string, i: number) => (
              <li key={i}>{renderFormattedText(item)}</li>
            ))}
          </ol>
        ) : (
          <ul className="list-disc list-inside space-y-1">
            {block.items.map((item: string, i: number) => (
              <li key={i}>{renderFormattedText(item)}</li>
            ))}
          </ul>
        );
      case 'spacer':
        const spacerHeights = {
          sm: 'h-4',  // 1rem / 16px
          md: 'h-8',  // 2rem / 32px
          lg: 'h-12', // 3rem / 48px
          xl: 'h-16', // 4rem / 64px
        };
        return <div className={spacerHeights[(block.height || 'md') as keyof typeof spacerHeights]} />;
      case 'icon':
        const IconComponent = block.icon ? (TablerIcons as any)[block.icon] : null;
        if (!IconComponent) return null;

        const iconSizeClasses = {
          sm: 'h-4 w-4',
          md: 'h-6 w-6',
          lg: 'h-8 w-8',
          xl: 'h-12 w-12',
        };

        const iconAlignmentClasses = {
          left: 'justify-start',
          center: 'justify-center',
          right: 'justify-end',
        };

        const iconContent = (
          <IconComponent
            className={`flex-shrink-0 ${iconSizeClasses[(block.size || 'md') as keyof typeof iconSizeClasses]} ${block.color || 'text-foreground'}`}
          />
        );

        // Apply alignment wrapper for standalone icons (not in rows)
        return block.alignment ? (
          <div className={`flex my-4 first:mt-0 last:mb-0 ${iconAlignmentClasses[block.alignment as keyof typeof iconAlignmentClasses]}`}>
            {iconContent}
          </div>
        ) : iconContent;
      case 'decorator':
        return <DecoratorPreview variant={block.variant} />;
      case 'company-asset': {
        const assetUrl = block.asset === 'logo' ? '/logo.png' : '/android-chrome-192x192.png';
        const sizeStyle = block.size ? { maxWidth: block.size } : { maxWidth: '75%' };
        return (
          <div className={`flex ${block.alignment === 'center' ? 'justify-center' : block.alignment === 'right' ? 'justify-end' : 'justify-start'}`}>
            <div style={sizeStyle}>
              <img src={assetUrl} alt={block.asset === 'logo' ? 'Logo' : 'Ícone'} className="w-full h-auto" />
            </div>
          </div>
        );
      }
      case 'row':
        const rowGapClasses = {
          none: 'gap-0',
          sm: 'gap-2',
          md: 'gap-4',
          lg: 'gap-6',
        };

        const rowAlignClasses = {
          top: 'items-start',
          center: 'items-center',
          bottom: 'items-end',
        };

        return (
          <div className={`flex flex-wrap md:flex-nowrap ${rowGapClasses[(block.gap || 'md') as keyof typeof rowGapClasses]} ${rowAlignClasses[(block.verticalAlign || 'top') as keyof typeof rowAlignClasses]} my-4 first:mt-0 last:mb-0 [&>*]:m-0`}>
            {(block.blocks || []).map((nestedBlock: any, idx: number) => {
              // Icons should only take their natural width, other blocks should grow
              const isIconBlock = nestedBlock.type === 'icon';
              const flexClass = isIconBlock ? 'flex-none' : 'flex-1 min-w-0';
              // Icons need slight top margin to align with text baseline
              const iconAdjustment = isIconBlock ? 'mt-[0.2em]' : '';

              return (
                <div key={nestedBlock.id || `nested-${idx}`} className={`${flexClass} ${iconAdjustment} [&>*]:my-0 [&>*]:first:mt-0 [&>*]:last:mb-0`}>
                  {renderBlock(nestedBlock)}
                </div>
              );
            })}
          </div>
        );
      default:
        return null;
    }
  };

  const PreviewContent = () => (
    // bg-background ensures dark mode responds correctly (dark bg in dark mode)
    // overflow-hidden + rounded-xl clips decorator SVGs to the card border-radius
    <div
      className="w-full overflow-hidden rounded-xl border border-border bg-background text-foreground"
      id="message-preview-content"
    >
      {/* Title */}
      <div className="px-6 pt-5 pb-4">
        <h2 className="text-2xl font-bold break-words">{data.title}</h2>
      </div>
      <Separator />

      {/* Blocks — decorators are edge-to-edge (no px), company-asset gets extra py, rest get px-6 py-2 */}
      {data.blocks.length > 0 ? (
        <div>
          {data.blocks.map((block) => {
            const isDecorator = block.type === 'decorator';
            const isCompanyAsset = block.type === 'company-asset';
            return (
              <div
                key={block.id}
                data-block-id={block.id}
                className={isDecorator ? 'w-full' : isCompanyAsset ? 'px-6 py-5' : 'px-6 py-2'}
              >
                {renderBlock(block)}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="px-6 py-8 text-center text-muted-foreground">
          Nenhum conteúdo adicionado ainda
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
          <DialogTitle>Preview da Mensagem</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Left sidebar with view toggle */}
          <div className="w-48 border-r bg-muted/30 p-4 flex flex-col gap-2 flex-shrink-0">
            <div className="text-sm font-medium text-muted-foreground mb-2">Visualização</div>
            <Button
              variant={viewMode === 'desktop' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('desktop')}
              className="justify-start gap-2"
            >
              <IconDeviceDesktop className="h-4 w-4" />
              Desktop
            </Button>
            <Button
              variant={viewMode === 'mobile' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('mobile')}
              className="justify-start gap-2"
            >
              <IconDeviceMobile className="h-4 w-4" />
              Mobile
            </Button>

            {viewMode === 'mobile' && (
              <div className="mt-4 p-3 bg-background rounded-lg text-xs text-muted-foreground">
                <div className="font-medium mb-1">iPhone 13/14</div>
                <div>375 × 812 px</div>
              </div>
            )}

            <div className="mt-auto pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
                className="w-full justify-start gap-2"
              >
                <IconFileDownload className="h-4 w-4" />
                Exportar PDF
              </Button>
            </div>
          </div>

          {/* Preview area */}
          <div className="flex-1 overflow-hidden bg-muted/20 min-h-0 flex items-center justify-center p-6">
            {viewMode === 'mobile' ? (
              // Mobile frame with realistic design - iPhone 13/14 (375x812 aspect ratio)
              // Using fixed width approach with proper scaling
              <div className="relative flex items-center justify-center w-full h-full">
                <div
                  className="relative"
                  style={{
                    width: '375px',
                    maxWidth: '100%',
                    height: '100%',
                    maxHeight: '812px',
                    aspectRatio: '375 / 812',
                  }}
                >
                  <div className="w-full h-full rounded-[3rem] border-[14px] border-gray-800 dark:border-gray-700 shadow-2xl overflow-hidden bg-white dark:bg-gray-900 flex flex-col">
                    {/* Status bar */}
                    <div className="h-11 bg-white dark:bg-gray-900 flex items-center justify-between px-6 pt-2 flex-shrink-0 relative">
                      <div className="text-xs font-semibold">9:41</div>
                      <div className="absolute left-1/2 top-0 -translate-x-1/2 w-36 h-7 bg-gray-800 dark:bg-gray-900 rounded-b-3xl"></div>
                      <div className="flex items-center gap-1">
                        <svg className="w-4 h-3" viewBox="0 0 16 12" fill="currentColor"><path d="M1 4h2V3H1v1zm3 0h2V3H4v1zm3 0h2V3H7v1zm3 0h2V3h-2v1zm3-1v1h2V3h-2z" opacity=".4"/><path d="M1 6h2V5H1v1zm3 0h2V5H4v1zm3 0h2V5H7v1zm3 0h2V5h-2v1zm3 0h2V5h-2v1zM1 8h2V7H1v1zm3 0h2V7H4v1zm3 0h2V7H7v1zm3 0h2V7h-2v1zm3 0h2V7h-2v1z"/></svg>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M17.778 8.222c-4.296-4.296-11.26-4.296-15.556 0A1 1 0 01.808 6.808c5.076-5.077 13.308-5.077 18.384 0a1 1 0 01-1.414 1.414zM14.95 11.05a7 7 0 00-9.9 0 1 1 0 01-1.414-1.414 9 9 0 0112.728 0 1 1 0 01-1.414 1.414zM12.12 13.88a3 3 0 00-4.242 0 1 1 0 01-1.415-1.415 5 5 0 017.072 0 1 1 0 01-1.415 1.415zM9 16a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd"/></svg>
                        <svg className="w-6 h-4" fill="currentColor" viewBox="0 0 24 12"><rect x="0" y="0" width="18" height="12" rx="2" opacity=".3"/><rect x="0" y="0" width="14" height="12" rx="2"/><rect x="20" y="4" width="3" height="4" rx="1"/></svg>
                      </div>
                    </div>

                    {/* Content - Only this scrolls */}
                    <div className="bg-background flex-1 overflow-y-auto min-h-0">
                      <PreviewContent />
                    </div>

                    {/* Home indicator */}
                    <div className="h-8 bg-white dark:bg-gray-900 flex items-center justify-center flex-shrink-0">
                      <div className="w-32 h-1.5 bg-gray-800 dark:bg-gray-700 rounded-full"></div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Desktop view - scrollable content
              <div className="w-full max-w-4xl h-full overflow-y-auto">
                <PreviewContent />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
