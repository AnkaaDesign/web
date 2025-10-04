import * as React from "react";
import { cn } from "@/lib/utils";
import { getCardLevel } from "@/lib/colors";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  nested?: boolean;
  level?: number;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className, nested, level, ...props }, ref) => {
  // For backward compatibility, nested=true means level 2
  const cardLevel = level !== undefined ? level : nested ? 2 : 1;

  return <div ref={ref} className={cn("text-card-foreground rounded-xl shadow-sm border border-border/50 transition-colors", getCardLevel(cardLevel), className)} {...props} />;
});
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col space-y-3 p-8 pb-6", className)} {...props} />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cn("text-xl font-semibold leading-tight tracking-tight text-foreground", className)} {...props} />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("px-8 py-6", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center px-8 py-6 border-t border-border/50", className)} {...props} />
));
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
