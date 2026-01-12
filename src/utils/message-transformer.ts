/**
 * Message Content Transformer
 *
 * Transforms message content between editor format (for creation)
 * and renderer format (for display)
 */

import type { ContentBlock } from '@/components/administration/message/editor/types';
import type { MessageBlock, InlineFormat } from '@/components/messaging/types';
import { parseMarkdownToInlineFormat } from './markdown-parser';

/**
 * Converts plain text string to InlineFormat array
 * Now supports markdown-style formatting: **bold**, *italic*, __underline__, [link](url)
 */
function textToInlineFormat(text: string): InlineFormat[] {
  if (!text) return [];

  // Use the markdown parser to convert formatting markers to InlineFormat objects
  return parseMarkdownToInlineFormat(text);
}

/**
 * Transforms content blocks from editor format to renderer format
 *
 * Editor format (what's stored in DB):
 * - heading1, heading2, heading3 -> separate types
 * - content: string
 * - image.url
 *
 * Renderer format (what's displayed):
 * - heading with level: 1-6
 * - content: InlineFormat[]
 * - image.src
 */
export function transformBlocksForDisplay(editorBlocks: ContentBlock[]): MessageBlock[] {
  if (!editorBlocks || !Array.isArray(editorBlocks)) {
    return [];
  }

  return editorBlocks.map((block): MessageBlock | null => {
    // IMPORTANT: Check if block is already in renderer format
    // Renderer format has: heading with level, content as InlineFormat[]
    // Editor format has: heading1/heading2/heading3, content as string

    // Check if content is already an InlineFormat array (renderer format)
    const hasInlineFormatContent = Array.isArray(block.content) &&
      block.content.length > 0 &&
      typeof block.content[0] === 'object' &&
      'type' in block.content[0];

    // Handle heading blocks (both editor format: heading1/2/3 and renderer format: heading with level)
    if (block.type === 'heading1' || block.type === 'heading2' || block.type === 'heading3') {
      const level = block.type === 'heading1' ? 1 : block.type === 'heading2' ? 2 : 3;
      return {
        ...block,
        type: 'heading',
        level,
        // Content is already InlineFormat[] or needs conversion from string
        content: hasInlineFormatContent ? block.content as InlineFormat[] : textToInlineFormat(block.content),
      };
    }

    // Handle heading with level (pure renderer format)
    if (block.type === 'heading' && 'level' in block) {
      return {
        ...block,
        type: 'heading',
        content: hasInlineFormatContent ? block.content as InlineFormat[] : textToInlineFormat(block.content),
      } as MessageBlock;
    }

    // Handle paragraph blocks (editor or renderer format)
    if (block.type === 'paragraph') {
      return {
        ...block,
        type: 'paragraph',
        content: hasInlineFormatContent ? block.content as InlineFormat[] : textToInlineFormat(block.content),
      };
    }

    // Handle quote blocks (editor or renderer format)
    if (block.type === 'quote') {
      return {
        ...block,
        type: 'quote',
        content: hasInlineFormatContent ? block.content as InlineFormat[] : textToInlineFormat(block.content),
      };
    }

    // Handle image blocks (url -> src)
    if (block.type === 'image') {
      return {
        ...block,
        type: 'image',
        src: block.url,
        alt: block.alt || '',
      };
    }

    // Handle button blocks
    if (block.type === 'button') {
      return {
        ...block,
        type: 'button',
      };
    }

    // Handle divider blocks
    if (block.type === 'divider') {
      return {
        ...block,
        type: 'divider',
      };
    }

    // Handle spacer blocks
    if (block.type === 'spacer') {
      return {
        ...block,
        type: 'spacer',
        height: block.height || 'md',
      };
    }

    // Handle list blocks
    if (block.type === 'list') {
      return {
        ...block,
        type: 'list',
        ordered: (block as any).listType === 'number' || block.ordered || false,
        items: block.items || [],
      };
    }

    // Handle icon blocks
    if (block.type === 'icon') {
      return {
        ...block,
        type: 'icon',
        icon: (block as any).icon,
        size: (block as any).size || 'md',
        color: (block as any).color || 'text-foreground',
        alignment: (block as any).alignment || 'center',
      };
    }

    // Handle row blocks (recursively transform nested blocks)
    if (block.type === 'row') {
      const rowBlock = block as any;
      const nestedBlocks = rowBlock.blocks || [];
      const transformedNested = transformBlocksForDisplay(nestedBlocks);

      return {
        ...block,
        type: 'row',
        blocks: transformedNested,
        columns: rowBlock.columns,
        gap: rowBlock.gap || 'md',
        verticalAlign: rowBlock.verticalAlign || 'top',
      };
    }

    // Handle callout blocks (convert to paragraph for now, renderer doesn't support callout yet)
    if (block.type === 'callout') {
      return {
        ...block,
        type: 'paragraph',
        content: hasInlineFormatContent ? block.content as InlineFormat[] : textToInlineFormat(block.content),
      };
    }

    // Unknown block type - skip rendering
    return null;
  }).filter((block): block is MessageBlock => block !== null);
}

/**
 * Transforms message content from API response
 * Handles both old format (content.blocks) and new format (content as array)
 */
export function transformMessageContent(content: any): MessageBlock[] {
  // Handle different content formats
  if (!content) {
    return [];
  }

  // New format: content is directly an object with blocks
  if (content.blocks && Array.isArray(content.blocks)) {
    return transformBlocksForDisplay(content.blocks);
  }

  // Old format: content is directly an array
  if (Array.isArray(content)) {
    return transformBlocksForDisplay(content);
  }

  // Unknown content format - return empty array
  return [];
}
