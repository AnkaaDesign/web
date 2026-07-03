import * as React from "react";
import type { MessageBlock } from "./types";
import { MessageBlockRenderer } from "./MessageBlockRenderer";
import { transformMessageContent } from "@/utils/message-transformer";
import { cn } from "@/lib/utils";

/**
 * Canonical message canvas (Message Rendering Spec §1).
 *
 * - Fills the host's width — the HOST defines the column (modal = max-w-2xl,
 *   phone frame = 375px, details panel = full panel width). All block sizing
 *   is %-of-content-width, so any column width renders proportionally.
 * - Horizontal content padding P: 24px (16px in `compact` mode, used when the
 *   canvas renders at phone width < 480 — e.g. the 375px preview/miniature).
 * - Decorator blocks bleed edge-to-edge via `--msg-canvas-px` negative margins.
 * - 12px vertical gap between consecutive blocks (owned by MessageBlockRenderer).
 * - No prose/typography-plugin wrappers — the renderer fully owns typography.
 */

/** Reference canvas width used by miniatures (spec §2). */
export const MINIATURE_REFERENCE_WIDTH = 375;

export interface MessageCanvasProps {
  /** Blocks already in renderer format. Takes precedence over `content`. */
  blocks?: MessageBlock[];
  /** Raw `message.content` JSON — transformed internally via transformMessageContent. */
  content?: unknown;
  /** Use 16px horizontal padding (canvas width < 480). Default 24px. */
  compact?: boolean;
  className?: string;
}

export function MessageCanvas({ blocks, content, compact, className }: MessageCanvasProps) {
  const resolvedBlocks = React.useMemo<MessageBlock[]>(() => {
    if (blocks) return blocks;
    return transformMessageContent(content);
  }, [blocks, content]);

  const padding = compact ? 16 : 24;
  // A message ending in a footer decorator sits flush against the canvas
  // bottom edge; otherwise the canvas closes with its own padding.
  const lastIsDecorator =
    resolvedBlocks.length > 0 && resolvedBlocks[resolvedBlocks.length - 1].type === "decorator";

  return (
    <div
      className={cn("w-full flex flex-col", className)}
      style={{
        paddingLeft: padding,
        paddingRight: padding,
        paddingBottom: lastIsDecorator ? 0 : padding,
        ["--msg-canvas-px" as string]: `${padding}px`,
      }}
    >
      <MessageBlockRenderer blocks={resolvedBlocks} className="flex-1" />
    </div>
  );
}

export interface MessageMiniatureProps {
  /** Blocks already in renderer format. Takes precedence over `content`. */
  blocks?: MessageBlock[];
  /** Raw `message.content` JSON. */
  content?: unknown;
  /**
   * `width` (default): the miniature fills the container width
   * (`scale = containerWidth / referenceWidth`) and its height hugs the scaled
   * content, capped by `maxBodyHeight` (or the parent's height via h-full);
   * a bottom fade appears when clipped.
   * `fit`: document-thumbnail mode — the ENTIRE message is scaled to fit both
   * container dimensions, horizontally centered (used by template thumbnails).
   */
  mode?: "width" | "fit";
  /** Unscaled render width. Defaults: `width` mode 672 (desktop column, denser/shorter), `fit` mode 375. */
  referenceWidth?: number;
  /** `width` mode: cap on the scaled body height; content beyond it is clipped with a fade. */
  maxBodyHeight?: number;
  /** Fixed body height in px. Omit to size per `mode` (or pass a height via className, e.g. h-full). */
  bodyHeight?: number;
  className?: string;
}

interface MiniatureLayout {
  scale: number;
  offsetX: number;
  height?: number;
  clipped: boolean;
  /** Scaled height of the pinned trailing footer decorator (width mode). */
  footerHeight: number;
}

/**
 * Miniature preview (spec §2): a REAL full render at a reference width, scaled
 * down as one proportional unit — no font-size tricks, no truncation, no
 * re-layout. See `mode` for the two scaling strategies.
 *
 * In `width` mode, a message ending in a footer decorator gets that footer
 * PINNED to the bottom of the (possibly clipped) preview, mirroring where it
 * lives in the real message.
 */
export function MessageMiniature({
  blocks,
  content,
  mode = "width",
  referenceWidth,
  maxBodyHeight,
  bodyHeight,
  className,
}: MessageMiniatureProps) {
  const refWidth = referenceWidth ?? (mode === "width" ? 672 : MINIATURE_REFERENCE_WIDTH);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const footerRef = React.useRef<HTMLDivElement>(null);
  const [layout, setLayout] = React.useState<MiniatureLayout | null>(null);

  const resolvedBlocks = React.useMemo<MessageBlock[]>(() => {
    if (blocks) return blocks;
    return transformMessageContent(content);
  }, [blocks, content]);

  // Width mode pins a trailing footer decorator to the preview bottom.
  const trailingDecorator =
    mode === "width" &&
    resolvedBlocks.length > 0 &&
    resolvedBlocks[resolvedBlocks.length - 1].type === "decorator"
      ? resolvedBlocks[resolvedBlocks.length - 1]
      : null;
  const mainBlocks = React.useMemo(
    () => (trailingDecorator ? resolvedBlocks.slice(0, -1) : resolvedBlocks),
    [resolvedBlocks, trailingDecorator],
  );

  React.useLayoutEffect(() => {
    const container = containerRef.current;
    const inner = contentRef.current;
    if (!container || !inner) return;

    const update = () => {
      const width = container.clientWidth;
      // transform:scale doesn't affect layout size, so offsetHeight is the
      // natural (unscaled) content height at the reference width.
      const contentHeight = inner.offsetHeight;
      const footerNatural = footerRef.current?.offsetHeight ?? 0;
      if (width <= 0) return;

      const widthScale = width / refWidth;

      if (mode === "width") {
        const footerHeight = footerNatural * widthScale;
        const desired = contentHeight * widthScale + footerHeight;
        const capped =
          bodyHeight ??
          (maxBodyHeight !== undefined ? Math.min(desired, maxBodyHeight) : container.clientHeight || desired);
        setLayout({
          scale: widthScale,
          offsetX: 0,
          // Only drive the element height when the parent isn't doing it.
          height: bodyHeight ?? (maxBodyHeight !== undefined ? capped : undefined),
          clipped: desired > capped + 1,
          footerHeight,
        });
      } else {
        const height = bodyHeight ?? container.clientHeight;
        const heightScale = height > 0 && contentHeight > 0 ? height / contentHeight : widthScale;
        const scale = Math.min(widthScale, heightScale);
        setLayout({
          scale,
          offsetX: Math.max(0, (width - refWidth * scale) / 2),
          height: bodyHeight,
          clipped: false,
          footerHeight: 0,
        });
      }
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    observer.observe(inner);
    if (footerRef.current) observer.observe(footerRef.current);
    return () => observer.disconnect();
  }, [mode, refWidth, maxBodyHeight, bodyHeight, trailingDecorator]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={cn("relative overflow-hidden pointer-events-none select-none", className)}
      style={layout?.height !== undefined ? { height: layout.height } : undefined}
    >
      <div
        ref={contentRef}
        style={{
          width: refWidth,
          transform: layout ? `translateX(${layout.offsetX}px) scale(${layout.scale})` : undefined,
          transformOrigin: "top left",
          visibility: layout ? undefined : "hidden",
        }}
      >
        <MessageCanvas blocks={mainBlocks} compact={refWidth < 480} />
      </div>
      {layout?.clipped && (
        <div
          className="absolute inset-x-0 h-10 bg-gradient-to-t from-card to-transparent"
          style={{ bottom: layout.footerHeight }}
        />
      )}
      {trailingDecorator && (
        <div
          ref={footerRef}
          className="absolute bottom-0 left-0"
          style={{
            width: refWidth,
            transform: layout ? `scale(${layout.scale})` : undefined,
            transformOrigin: "bottom left",
            visibility: layout ? undefined : "hidden",
          }}
        >
          <MessageCanvas blocks={[trailingDecorator]} compact={refWidth < 480} />
        </div>
      )}
    </div>
  );
}
