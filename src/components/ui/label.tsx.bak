import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

interface LabelProps extends React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> {
  disabled?: boolean;
  children?: React.ReactNode;
  className?: string;
  htmlFor?: string;
}

const Label = React.forwardRef<React.ElementRef<typeof LabelPrimitive.Root>, LabelProps>(({ className, disabled, children, ...props }, ref) => {
  return (
    <LabelPrimitive.Root
      ref={ref}
      data-slot="label"
      className={cn("flex items-center gap-2 text-sm font-medium leading-none select-none", disabled ? "text-muted-foreground" : "text-foreground", className)}
      {...props}
    >
      {children}
    </LabelPrimitive.Root>
  );
});
Label.displayName = "Label";

export { Label };
