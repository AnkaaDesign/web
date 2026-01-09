import * as React from "react";
import type { ButtonBlock as ButtonBlockType } from "./types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ButtonBlockProps {
  block: ButtonBlockType;
  className?: string;
}

/**
 * Renders an interactive button block with support for links and click handlers.
 * Uses the design system's Button component for consistency.
 */
export const ButtonBlock = React.memo<ButtonBlockProps>(({ block, className }) => {
  const { text, url, onClick, variant = 'default', disabled, id } = block;

  const handleClick = React.useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (onClick) {
      e.preventDefault();
      onClick();
    }
  }, [onClick]);

  // If URL is provided, render as a link
  if (url && !onClick) {
    return (
      <Button
        id={id}
        variant={variant}
        disabled={disabled}
        asChild
        className={cn("my-2", className)}
      >
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={text}
        >
          {text}
        </a>
      </Button>
    );
  }

  // Otherwise render as a button
  return (
    <Button
      id={id}
      variant={variant}
      disabled={disabled}
      onClick={handleClick}
      type="button"
      className={cn("my-2", className)}
    >
      {text}
    </Button>
  );
});

ButtonBlock.displayName = "ButtonBlock";
