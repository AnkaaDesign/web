import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, error, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        // Base styles
        "flex min-h-[80px] w-full rounded-md border border-border bg-transparent px-3 py-2 text-base text-foreground",
        "shadow-sm transition-all duration-200",
        "resize-vertical",
        "placeholder:text-muted-foreground",

        // Focus styles
        "focus-visible:outline-none",

        // Selection styles
        "selection:bg-primary/30 selection:text-foreground",

        // Disabled styles
        "disabled:cursor-not-allowed disabled:opacity-[var(--disabled-opacity)]",

        // Error styles
        error && "border-destructive/50",
        props["aria-invalid"] === true && "border-destructive/50",
        props["aria-invalid"] === "true" && "border-destructive/50",

        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
