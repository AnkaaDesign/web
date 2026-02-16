import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-opacity duration-200 outline-none shrink-0 cursor-pointer focus-visible:ring-1 focus-visible:ring-ring/30 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:opacity-[var(--hover-opacity)]",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:opacity-[var(--hover-opacity)]",
        outline: "bg-transparent border border-border text-foreground hover:bg-muted/30",
        secondary: "bg-secondary text-secondary-foreground border border-border hover:opacity-[var(--hover-opacity)]",
        ghost: "bg-transparent text-foreground hover:bg-muted/30",
        link: "bg-transparent text-primary underline underline-offset-4 p-0 h-auto hover:opacity-[var(--hover-opacity)]",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 px-4 gap-1.5 text-xs",
        lg: "h-11 px-8 text-base",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, type = "button", ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} type={type} {...props} />;
});

Button.displayName = "Button";

export { Button, buttonVariants };
