import * as React from "react";
import type { DividerBlock as DividerBlockType } from "./types";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface DividerBlockProps {
  block: DividerBlockType;
  className?: string;
}

/**
 * Renders a horizontal divider to separate content sections.
 * Uses semantic separator for accessibility.
 */
export const DividerBlock = React.memo<DividerBlockProps>(({ block, className }) => {
  const { id } = block;

  return (
    <div
      id={id}
      className={cn("my-6 first:mt-0 last:mb-0", className)}
    >
      <Separator
        decorative
        aria-hidden="true"
      />
    </div>
  );
});

DividerBlock.displayName = "DividerBlock";
