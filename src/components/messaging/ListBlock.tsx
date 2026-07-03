import * as React from "react";
import type { ListBlock as ListBlockType } from "./types";
import { InlineContent } from "./InlineContent";
import { cn } from "@/lib/utils";
import {
  LIST_BULLETS_BY_DEPTH,
  LIST_ITEM_GAP,
  LIST_INDENT_PER_LEVEL,
  PARAGRAPH_FONT_SIZE,
  PARAGRAPH_LINE_HEIGHT,
} from "./render-constants";

interface ListBlockProps {
  block: ListBlockType;
  className?: string;
  /** Nesting depth (0 = top level). The block model is flat today. */
  depth?: number;
}

/**
 * Renders ordered/unordered lists (Message Rendering Spec §3):
 * unordered bullets • ◦ ▪ by depth, ordered numeric; 15px text;
 * 4px between items; 20px indent per level.
 */
export const ListBlock = React.memo<ListBlockProps>(({ block, className, depth = 0 }) => {
  const { ordered, items, id } = block;

  // Don't render empty lists
  if (!items || items.length === 0) {
    return null;
  }

  const ListTag = ordered ? 'ol' : 'ul';
  const bullet = LIST_BULLETS_BY_DEPTH[Math.min(depth, LIST_BULLETS_BY_DEPTH.length - 1)];

  return (
    <ListTag
      id={id}
      className={cn("m-0 list-none", className)}
      style={{ paddingLeft: depth * LIST_INDENT_PER_LEVEL }}
    >
      {items.map((item, index) => {
        // Convert string to InlineFormat array if needed
        const content = typeof item === 'string' ? [{ type: 'text' as const, content: item }] : item;

        return (
          <li
            key={`list-item-${index}`}
            className="flex text-foreground break-words"
            style={{
              fontSize: PARAGRAPH_FONT_SIZE,
              lineHeight: PARAGRAPH_LINE_HEIGHT,
              marginTop: index > 0 ? LIST_ITEM_GAP : 0,
            }}
          >
            <span
              className="shrink-0 text-muted-foreground"
              style={{ width: LIST_INDENT_PER_LEVEL }}
              aria-hidden="true"
            >
              {ordered ? `${index + 1}.` : bullet}
            </span>
            <span className="min-w-0 flex-1">
              <InlineContent content={content} />
            </span>
          </li>
        );
      })}
    </ListTag>
  );
});

ListBlock.displayName = "ListBlock";
