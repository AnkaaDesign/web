import * as React from "react";
import type { HeadingBlock as HeadingBlockType } from "./types";
import { InlineContent } from "./InlineContent";
import { cn } from "@/lib/utils";
import { FONT_SIZE_PX, FONT_WEIGHT, HEADING_STYLES } from "./render-constants";

interface HeadingBlockProps {
  block: HeadingBlockType;
  className?: string;
}

/**
 * Renders a semantic heading element (Message Rendering Spec §3):
 * h1 28px/700/1.3, h2 22px/600/1.35, h3 18px/600/1.45.
 * Custom fontSize/fontWeight tokens override the level defaults.
 */
export const HeadingBlock = React.memo<HeadingBlockProps>(({ block, className }) => {
  const { level, content, id, fontSize, fontWeight } = block;

  // Don't render empty headings
  if (!content || content.length === 0) {
    return null;
  }

  const levelStyle = HEADING_STYLES[level] ?? HEADING_STYLES[3];

  const style: React.CSSProperties = {
    fontSize: fontSize && FONT_SIZE_PX[fontSize] ? FONT_SIZE_PX[fontSize] : levelStyle.fontSize,
    fontWeight: fontWeight && FONT_WEIGHT[fontWeight] ? FONT_WEIGHT[fontWeight] : levelStyle.fontWeight,
    lineHeight: levelStyle.lineHeight,
    margin: 0,
  };

  const headingClassName = cn(
    "text-foreground tracking-tight scroll-mt-20 break-words whitespace-normal",
    className
  );

  switch (level) {
    case 1:
      return <h1 id={id} style={style} className={headingClassName}><InlineContent content={content} /></h1>;
    case 2:
      return <h2 id={id} style={style} className={headingClassName}><InlineContent content={content} /></h2>;
    case 3:
      return <h3 id={id} style={style} className={headingClassName}><InlineContent content={content} /></h3>;
    case 4:
      return <h4 id={id} style={style} className={headingClassName}><InlineContent content={content} /></h4>;
    case 5:
      return <h5 id={id} style={style} className={headingClassName}><InlineContent content={content} /></h5>;
    case 6:
      return <h6 id={id} style={style} className={headingClassName}><InlineContent content={content} /></h6>;
    default:
      return null;
  }
});

HeadingBlock.displayName = "HeadingBlock";
