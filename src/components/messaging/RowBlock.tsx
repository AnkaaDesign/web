import * as React from "react";
import type { RowBlock as RowBlockType } from "./types";
import { MessageBlockRenderer } from "./MessageBlockRenderer";
import { cn } from "@/lib/utils";

interface RowBlockProps {
  block: RowBlockType;
  className?: string;
}

/**
 * Renders a row of blocks side-by-side
 * Responsive: stacks vertically on mobile, horizontal on larger screens
 */
export const RowBlock = React.memo<RowBlockProps>(({ block, className }) => {
  console.log('[RowBlock] Rendering row block:', block);
  const { blocks, columns, gap = 'md', verticalAlign = 'top', id } = block;
  console.log('[RowBlock] Blocks to render:', blocks, 'Count:', blocks?.length || 0);

  const gapClasses = {
    none: 'gap-0',
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
  };

  const alignClasses = {
    top: 'items-start',
    center: 'items-center',
    bottom: 'items-end',
  };

  return (
    <div
      id={id}
      className={cn(
        "my-4 first:mt-0 last:mb-0",
        "flex flex-wrap", // Use flexbox for inline behavior
        gapClasses[gap],
        alignClasses[verticalAlign],
        className
      )}
    >
      {blocks.map((nestedBlock, index) => (
        <div key={nestedBlock.id || `row-block-${index}`} className="inline-flex">
          <MessageBlockRenderer blocks={[nestedBlock]} />
        </div>
      ))}
    </div>
  );
});

RowBlock.displayName = "RowBlock";
