import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface TruncatedTextWithTooltipProps {
  text: string;
  className?: string;
  tooltipClassName?: string;
  tooltipText?: string;
  children?: React.ReactNode;
}

export function TruncatedTextWithTooltip({ text, className, tooltipClassName, tooltipText, children }: TruncatedTextWithTooltipProps) {
  const textRef = React.useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = React.useState(false);

  React.useEffect(() => {
    const checkTruncation = () => {
      const element = textRef.current;
      if (element) {
        setIsTruncated(element.scrollWidth > element.clientWidth);
      }
    };

    checkTruncation();

    // Check on resize
    const resizeObserver = new ResizeObserver(checkTruncation);
    if (textRef.current) {
      resizeObserver.observe(textRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [text]);

  const content = (
    <span ref={textRef} className={cn("truncate block", className)}>
      {children || text}
    </span>
  );

  if (!isTruncated && !tooltipText) {
    return content;
  }

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent className={tooltipClassName}>
        <p className="max-w-xs">{tooltipText || text}</p>
      </TooltipContent>
    </Tooltip>
  );
}
