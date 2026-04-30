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
import { exportMessageToPdf } from "@/utils/message-pdf-export";

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
    exportMessageToPdf({ title: data.title, blocks: data.blocks });
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
