import * as React from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";

interface SeparatorProps extends React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root> {
  className?: string;
  orientation?: "horizontal" | "vertical";
  decorative?: boolean;
  style?: React.CSSProperties;
}

const Separator = React.forwardRef<React.ElementRef<typeof SeparatorPrimitive.Root>, SeparatorProps>(
  ({ className, orientation = "horizontal", decorative = true, style, ...props }, ref) => (
    <SeparatorPrimitive.Root
      ref={ref}
      decorative={decorative}
      orientation={orientation}
      className={className}
      style={{
        flexShrink: 0,
        backgroundColor: "hsl(var(--border))",
        ...(orientation === "horizontal"
          ? {
              height: "1px",
              width: "100%",
            }
          : {
              height: "100%",
              width: "1px",
            }),
        ...style,
      }}
      {...props}
    />
  ),
);
Separator.displayName = SeparatorPrimitive.Root.displayName;

export { Separator };
