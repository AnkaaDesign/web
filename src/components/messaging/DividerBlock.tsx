import * as React from "react";
import type { DividerBlock as DividerBlockType } from "./types";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { DIVIDER_MARGIN_Y } from "./render-constants";

interface DividerBlockProps {
  block: DividerBlockType;
  className?: string;
}

/**
 * Renders a horizontal divider (Message Rendering Spec §7):
 * 1px hairline, 8px vertical margin.
 */
export const DividerBlock = React.memo<DividerBlockProps>(({ block, className }) => {
  const { id } = block;

  return (
    <div
      id={id}
      style={{ marginTop: DIVIDER_MARGIN_Y, marginBottom: DIVIDER_MARGIN_Y }}
      className={cn(className)}
    >
      <Separator decorative aria-hidden="true" />
    </div>
  );
});

DividerBlock.displayName = "DividerBlock";
