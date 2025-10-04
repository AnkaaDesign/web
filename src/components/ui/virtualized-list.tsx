import React, { useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";

interface VirtualizedListProps<T> {
  data: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  getItemKey: (item: T, index: number) => string | number;
  itemHeight?: number | ((index: number) => number);
  overscan?: number;
  horizontal?: boolean;
  className?: string;
  containerClassName?: string;
  gap?: number;
  columns?: number;
  isLoading?: boolean;
  loadingComponent?: React.ReactNode;
  emptyComponent?: React.ReactNode;
  onEndReached?: () => void;
  endReachedThreshold?: number;
}

export function VirtualizedList<T>({
  data,
  renderItem,
  getItemKey,
  itemHeight = 100,
  overscan = 5,
  horizontal = false,
  className,
  containerClassName,
  gap = 0,
  columns = 1,
  isLoading,
  loadingComponent,
  emptyComponent,
  onEndReached,
  endReachedThreshold = 0.8,
}: VirtualizedListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const prevScrollTop = useRef(0);

  // Calculate item size
  const getItemSize = useCallback(
    (index: number) => {
      if (typeof itemHeight === "function") {
        return itemHeight(index);
      }
      return itemHeight;
    },
    [itemHeight],
  );

  // Create virtualizer
  const virtualizer = useVirtualizer({
    count: Math.ceil(data.length / columns),
    getScrollElement: () => parentRef.current,
    estimateSize: getItemSize,
    overscan,
    horizontal,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  // Handle scroll for infinite loading
  const handleScroll = useCallback(() => {
    if (!parentRef.current || !onEndReached) return;

    const { scrollTop, scrollHeight, clientHeight } = parentRef.current;

    // Only trigger if scrolling down
    if (scrollTop > prevScrollTop.current) {
      const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

      if (scrollPercentage > endReachedThreshold) {
        onEndReached();
      }
    }

    prevScrollTop.current = scrollTop;
  }, [onEndReached, endReachedThreshold]);

  if (isLoading && loadingComponent) {
    return <>{loadingComponent}</>;
  }

  if (!isLoading && data.length === 0 && emptyComponent) {
    return <>{emptyComponent}</>;
  }

  const containerStyle = horizontal
    ? {
        width: totalSize,
        height: "100%",
        position: "relative" as const,
      }
    : {
        height: totalSize,
        width: "100%",
        position: "relative" as const,
      };

  const itemStyle = (virtualItem: any) => {
    if (horizontal) {
      return {
        position: "absolute" as const,
        top: 0,
        left: 0,
        width: `${virtualItem.size}px`,
        transform: `translateX(${virtualItem.start}px)`,
      };
    }

    return {
      position: "absolute" as const,
      top: 0,
      left: 0,
      width: "100%",
      transform: `translateY(${virtualItem.start}px)`,
    };
  };

  return (
    <div
      ref={parentRef}
      className={cn("overflow-auto", horizontal ? "overflow-x-auto overflow-y-hidden" : "overflow-y-auto overflow-x-hidden", className)}
      onScroll={handleScroll}
      style={{ contain: "strict" }}
    >
      <div style={containerStyle} className={containerClassName}>
        {virtualItems.map((virtualRow) => {
          const startIndex = virtualRow.index * columns;
          const endIndex = Math.min(startIndex + columns, data.length);
          const rowItems = data.slice(startIndex, endIndex);

          if (columns > 1) {
            return (
              <div key={virtualRow.key} data-index={virtualRow.index} style={itemStyle(virtualRow)} className={cn("grid", `grid-cols-${columns}`, gap && `gap-${gap}`)}>
                {rowItems.map((item, itemIndex) => {
                  const actualIndex = startIndex + itemIndex;
                  return <div key={getItemKey(item, actualIndex)}>{renderItem(item, actualIndex)}</div>;
                })}
              </div>
            );
          }

          // Single column layout
          const item = data[virtualRow.index];
          return (
            <div key={virtualRow.key} data-index={virtualRow.index} style={itemStyle(virtualRow)}>
              {renderItem(item, virtualRow.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Hook for infinite scrolling with virtualized list
export function useVirtualizedInfiniteList(fetchNextPage: () => void, hasNextPage: boolean, isFetchingNextPage: boolean) {
  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return { onEndReached };
}
