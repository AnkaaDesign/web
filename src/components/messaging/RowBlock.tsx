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
  const { blocks, columns: _columns, gap = 'md', verticalAlign = 'top', id } = block;

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
        "flex flex-wrap md:flex-nowrap", // Wrap on mobile, inline on desktop
        gapClasses[gap],
        alignClasses[verticalAlign],
        "[&>*]:m-0", // Remove margins from direct children
        className
      )}
    >
      {blocks.map((nestedBlock, index) => {
        // Icons and buttons should only take their natural width, other blocks should grow
        const isIconBlock = nestedBlock.type === 'icon';
        const isButtonBlock = nestedBlock.type === 'button';
        const flexClass = (isIconBlock || isButtonBlock) ? 'flex-none' : 'flex-1 min-w-0';
        // Icons need slight top margin to align with text baseline
        const iconAdjustment = isIconBlock ? 'mt-[0.2em]' : '';

        return (
          <div key={nestedBlock.id || `row-block-${index}`} className={`${flexClass} ${iconAdjustment} [&>*]:my-0 [&>*]:first:mt-0 [&>*]:last:mb-0`}>
            <MessageBlockRenderer blocks={[nestedBlock]} />
          </div>
        );
      })}
    </div>
  );
});

RowBlock.displayName = "RowBlock";
