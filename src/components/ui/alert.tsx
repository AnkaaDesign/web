import * as React from "react";
import { cn } from "@/lib/utils";
import { IconInfoSquare, IconAlertTriangle, IconCircleCheck, IconXboxX } from "@tabler/icons-react";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "destructive" | "warning" | "success";
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(({ className, variant = "default", children, ...props }, ref) => {
  const alertVariants = {
    default: {
      container: "bg-background border-border text-foreground",
      icon: <IconInfoSquare className="h-4 w-4" />,
      iconClass: "text-foreground",
    },
    destructive: {
      container: "bg-destructive/10 border-destructive text-destructive",
      icon: <IconXboxX className="h-4 w-4" />,
      iconClass: "text-destructive",
    },
    warning: {
      container: "bg-[hsl(var(--warning))]/10 border-[hsl(var(--warning))]/20 text-[hsl(var(--warning))]",
      icon: <IconAlertTriangle className="h-4 w-4" />,
      iconClass: "text-[hsl(var(--warning))]",
    },
    success: {
      container: "bg-primary/10 border-primary text-primary",
      icon: <IconCircleCheck className="h-4 w-4" />,
      iconClass: "text-primary",
    },
  };

  const variantConfig = alertVariants[variant];

  return (
    <div ref={ref} role="alert" className={cn("relative w-full rounded-lg border p-4", "flex gap-3", variantConfig.container, className)} {...props}>
      {variantConfig.icon && <div className={cn("flex-shrink-0 mt-0.5", variantConfig.iconClass)}>{variantConfig.icon}</div>}
      <div className="flex-1 space-y-1">{children}</div>
    </div>
  );
});
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (
  <h5 ref={ref} className={cn("font-medium leading-none tracking-tight", className)} {...props} />
));
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("text-sm leading-relaxed", "[&:not(:first-child)]:mt-1", className)} {...props} />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
