import * as React from "react";
import type { ImageBlock as ImageBlockType } from "./types";
import { cn } from "@/lib/utils";

interface ImageBlockProps {
  block: ImageBlockType;
  className?: string;
}

/**
 * Renders an accessible image block with optional caption.
 * Responsive and optimized for various screen sizes.
 */
export const ImageBlock = React.memo<ImageBlockProps>(({ block, className }) => {
  const { src, alt, caption, width, height, id } = block;
  const [isLoading, setIsLoading] = React.useState(true);
  const [hasError, setHasError] = React.useState(false);

  const handleLoad = React.useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleError = React.useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  return (
    <figure
      id={id}
      className={cn("my-6 first:mt-0 last:mb-0", className)}
    >
      <div className="relative overflow-hidden rounded-lg border border-border/50 bg-muted/30">
        {isLoading && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}

        {hasError ? (
          <div className="flex min-h-[200px] items-center justify-center bg-muted/50 p-8">
            <div className="text-center">
              <svg
                className="mx-auto h-12 w-12 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="mt-2 text-sm text-muted-foreground">
                Failed to load image
              </p>
            </div>
          </div>
        ) : (
          <img
            src={src}
            alt={alt}
            width={width}
            height={height}
            onLoad={handleLoad}
            onError={handleError}
            className={cn(
              "w-full h-auto object-cover transition-opacity duration-300",
              isLoading ? "opacity-0" : "opacity-100"
            )}
            loading="lazy"
          />
        )}
      </div>

      {caption && (
        <figcaption className="mt-2 text-center text-sm text-muted-foreground">
          {caption}
        </figcaption>
      )}
    </figure>
  );
});

ImageBlock.displayName = "ImageBlock";
