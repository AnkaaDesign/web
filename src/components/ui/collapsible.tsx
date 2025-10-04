import * as React from "react";
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";

const Collapsible = React.forwardRef<React.ElementRef<typeof CollapsiblePrimitive.Root>, React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Root>>(
  ({ children, ...props }, ref) => (
    <CollapsiblePrimitive.Root ref={ref} {...props}>
      {children}
    </CollapsiblePrimitive.Root>
  ),
);
Collapsible.displayName = "Collapsible";

const CollapsibleTrigger = React.forwardRef<React.ElementRef<typeof CollapsiblePrimitive.Trigger>, React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Trigger>>(
  ({ children, ...props }, ref) => (
    <CollapsiblePrimitive.Trigger ref={ref} {...props}>
      {children}
    </CollapsiblePrimitive.Trigger>
  ),
);
CollapsibleTrigger.displayName = "CollapsibleTrigger";

const CollapsibleContent = React.forwardRef<React.ElementRef<typeof CollapsiblePrimitive.Content>, React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Content>>(
  ({ children, ...props }, ref) => (
    <CollapsiblePrimitive.Content ref={ref} {...props}>
      {children}
    </CollapsiblePrimitive.Content>
  ),
);
CollapsibleContent.displayName = "CollapsibleContent";

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
