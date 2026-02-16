import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { toggleVariants } from "@/components/ui/toggle";

const ToggleGroupContext = React.createContext<VariantProps<typeof toggleVariants>>({
  size: "default",
  variant: "default",
});

type ToggleGroupProps = Omit<React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root>, 'type' | 'value' | 'onValueChange'> & VariantProps<typeof toggleVariants> & {
  className?: string;
  children?: React.ReactNode;
  type?: "single" | "multiple";
  value?: string | string[];
  onValueChange?: (value: string | string[]) => void;
}

const ToggleGroup = React.forwardRef<React.ElementRef<typeof ToggleGroupPrimitive.Root>, ToggleGroupProps>(
  ({ className, variant, size, children, type = "single", value, onValueChange, ...props }, ref) => (
    <ToggleGroupPrimitive.Root ref={ref} className={cn("flex items-center justify-center gap-1", className)} type={type} value={value} onValueChange={onValueChange as any} {...(props as any)}>
      <ToggleGroupContext.Provider value={{ variant, size }}>{children}</ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  ),
);

ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName;

type ToggleGroupItemProps = React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> & VariantProps<typeof toggleVariants> & {
  className?: string;
  children?: React.ReactNode;
}

const ToggleGroupItem = React.forwardRef<React.ElementRef<typeof ToggleGroupPrimitive.Item>, ToggleGroupItemProps>(({ className, children, variant, size, ...props }, ref) => {
  const context = React.useContext(ToggleGroupContext);

  return (
    <ToggleGroupPrimitive.Item
      ref={ref}
      className={cn(
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        className,
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  );
});

ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName;

export { ToggleGroup, ToggleGroupItem };
