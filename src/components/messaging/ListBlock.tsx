import * as React from "react";
import type { ListBlock as ListBlockType } from "./types";
import { InlineContent } from "./InlineContent";
import { cn } from "@/lib/utils";

interface ListBlockProps {
  block: ListBlockType;
  className?: string;
}

/**
 * Renders ordered or unordered lists with inline formatting support.
 * Provides proper semantic HTML and accessible markup.
 */
export const ListBlock = React.memo<ListBlockProps>(({ block, className }) => {
  const { ordered, items, id } = block;

  // Don't render empty lists
  if (!items || items.length === 0) {
    return null;
  }

  const ListTag = ordered ? 'ol' : 'ul';

  const listStyles = cn(
    "mb-4 last:mb-0 space-y-1.5",
    ordered
      ? "list-decimal list-inside marker:text-muted-foreground marker:font-medium"
      : "list-disc list-inside marker:text-muted-foreground",
    className
  );

  return (
    <ListTag
      id={id}
      className={listStyles}
      role={ordered ? "list" : undefined}
    >
      {items.map((item, index) => {
        // Convert string to InlineFormat array if needed
        const content = typeof item === 'string' ? [{ type: 'text' as const, content: item }] : item;

        return (
          <li
            key={`list-item-${index}`}
            className="text-base leading-relaxed text-foreground pl-1 break-words"
          >
            <span className="ml-2">
              <InlineContent content={content} />
            </span>
          </li>
        );
      })}
    </ListTag>
  );
});

ListBlock.displayName = "ListBlock";
