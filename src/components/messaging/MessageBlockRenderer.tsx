import * as React from "react";
import type { MessageBlock, MessageBlockRendererProps } from "./types";
import { HeadingBlock } from "./HeadingBlock";
import { ParagraphBlock } from "./ParagraphBlock";
import { ImageBlock } from "./ImageBlock";
import { ButtonBlock } from "./ButtonBlock";
import { DividerBlock } from "./DividerBlock";
import { SpacerBlock } from "./SpacerBlock";
import { ListBlock } from "./ListBlock";
import { QuoteBlock } from "./QuoteBlock";
import { IconBlock } from "./IconBlock";
import { RowBlock } from "./RowBlock";
import { cn } from "@/lib/utils";

/**
 * MessageBlockRenderer - Renders all message content block types
 *
 * Supports:
 * - Headings (h1-h6)
 * - Paragraphs with inline formatting (bold, italic, links)
 * - Images with captions
 * - Interactive buttons
 * - Dividers
 * - Ordered and unordered lists
 * - Blockquotes with attribution
 *
 * Features:
 * - Fully responsive design
 * - Accessible semantic HTML
 * - ARIA labels and roles
 * - Design system integration
 * - Type-safe rendering
 */
export const MessageBlockRenderer = React.memo<MessageBlockRendererProps>(
  ({ blocks, className }) => {
    // Don't render if there are no blocks
    if (!blocks || blocks.length === 0) {
      return null;
    }

    const renderBlock = (block: MessageBlock, index: number) => {
      const key = block.id || `block-${index}`;

      // Helper to wrap blocks with alignment for standalone usage
      const withAlignment = (content: React.ReactNode, alignment?: 'left' | 'center' | 'right') => {
        if (!alignment) return content;

        const alignmentClasses = {
          left: 'justify-start',
          center: 'justify-center',
          right: 'justify-end',
        };

        return (
          <div className={cn("flex my-4 first:mt-0 last:mb-0", alignmentClasses[alignment])}>
            {content}
          </div>
        );
      };

      switch (block.type) {
        case 'heading':
          return <HeadingBlock key={key} block={block} />;

        case 'paragraph':
          return <ParagraphBlock key={key} block={block} />;

        case 'image':
          return <ImageBlock key={key} block={block} />;

        case 'button':
          return <ButtonBlock key={key} block={block} />;

        case 'divider':
          return <DividerBlock key={key} block={block} />;

        case 'spacer':
          return <SpacerBlock key={key} height={block.height} id={block.id} />;

        case 'list':
          return <ListBlock key={key} block={block} />;

        case 'quote':
          return <QuoteBlock key={key} block={block} />;

        case 'icon':
          return withAlignment(<IconBlock key={key} block={block} />, block.alignment);

        case 'row':
          return <RowBlock key={key} block={block} />;

        default:
          // Type-safe exhaustiveness check
          const _exhaustiveCheck: never = block;
          console.warn('Unknown block type:', _exhaustiveCheck);
          return null;
      }
    };

    return (
      <article
        className={cn(
          "message-blocks prose prose-neutral dark:prose-invert max-w-none",
          className
        )}
        role="article"
      >
        {blocks.map((block, index) => renderBlock(block, index))}
      </article>
    );
  }
);

MessageBlockRenderer.displayName = "MessageBlockRenderer";
