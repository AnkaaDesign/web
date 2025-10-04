import { useState, useEffect, useRef, useCallback } from "react";

interface UseDynamicGridProps {
  itemCount: number;
  gap?: number; // Gap between items in pixels
  minSize?: number; // Minimum item size (width or height)
  maxSize?: number; // Maximum item size (width or height)
  minAspectRatio?: number; // Minimum aspect ratio (width/height), default 0.5
  maxAspectRatio?: number; // Maximum aspect ratio (width/height), default 2.0
  fillMode?: "center" | "fill"; // "center" for centered grid, "fill" for space-filling
}

interface GridDimensions {
  columns: number;
  rows: number;
  itemWidth: number;
  itemHeight: number;
  containerWidth: number;
  containerHeight: number;
  rowHeights?: number[]; // Variable row heights for space-filling
}

export function useDynamicGrid({ itemCount, gap = 8, minSize = 40, maxSize = 200, minAspectRatio = 0.5, maxAspectRatio = 2.0, fillMode = "fill" }: UseDynamicGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<GridDimensions>({
    columns: 1,
    rows: 1,
    itemWidth: minSize,
    itemHeight: minSize,
    containerWidth: 0,
    containerHeight: 0,
    rowHeights: [],
  });

  const calculateOptimalGrid = useCallback(
    (containerWidth: number, containerHeight: number): GridDimensions => {
      // Debug logging
      if (process.env.NODE_ENV === "development") {
      }

      if (!containerWidth || !containerHeight || itemCount === 0) {
        return {
          columns: 1,
          rows: 1,
          itemWidth: minSize,
          itemHeight: minSize,
          containerWidth,
          containerHeight,
          rowHeights: [],
        };
      }

      // Special case for squares (aspect ratio 1:1)
      if (minAspectRatio === 1 && maxAspectRatio === 1) {
        // For squares, we can use a simpler calculation
        const possibleItemSize = Math.min(maxSize, Math.max(minSize, 80)); // Default to 80px if possible

        // Calculate how many columns we can fit
        const maxPossibleCols = Math.floor((containerWidth + gap) / (possibleItemSize + gap));
        const minPossibleCols = Math.max(1, Math.floor((containerWidth + gap) / (maxSize + gap)));

        let bestConfig = {
          columns: 1,
          rows: itemCount,
          itemSize: minSize,
          score: -Infinity,
        };

        // Try different column counts
        for (let cols = Math.max(1, minPossibleCols); cols <= Math.min(itemCount, maxPossibleCols); cols++) {
          const rows = Math.ceil(itemCount / cols);

          // Calculate the size that would fit exactly in width
          const widthBasedSize = (containerWidth - gap * (cols - 1)) / cols;

          // Calculate the size that would fit exactly in height
          const heightBasedSize = (containerHeight - gap * (rows - 1)) / rows;

          // Use the smaller to ensure it fits
          let itemSize = Math.min(widthBasedSize, heightBasedSize);

          // Apply constraints
          itemSize = Math.max(minSize, Math.min(maxSize, itemSize));

          // Check if this configuration actually fits
          const totalWidth = cols * itemSize + gap * (cols - 1);
          const totalHeight = rows * itemSize + gap * (rows - 1);

          if (totalWidth <= containerWidth && totalHeight <= containerHeight) {
            // Calculate score based on space utilization
            const widthUtilization = totalWidth / containerWidth;
            const heightUtilization = totalHeight / containerHeight;
            const score = widthUtilization * heightUtilization;

            if (score > bestConfig.score) {
              bestConfig = {
                columns: cols,
                rows: rows,
                itemSize: itemSize,
                score: score,
              };
            }
          }
        }

        // Debug logging
        if (process.env.NODE_ENV === "development") {
        }

        return {
          columns: bestConfig.columns,
          rows: bestConfig.rows,
          itemWidth: bestConfig.itemSize,
          itemHeight: bestConfig.itemSize,
          containerWidth,
          containerHeight,
          rowHeights: new Array(bestConfig.rows).fill(bestConfig.itemSize),
        };
      }

      if (fillMode === "center") {
        // Original centered algorithm
        let bestFit = {
          columns: 1,
          rows: itemCount,
          itemWidth: minSize,
          itemHeight: minSize,
          wasted: Infinity,
        };

        for (let cols = 1; cols <= itemCount; cols++) {
          const rows = Math.ceil(itemCount / cols);
          const availableWidth = (containerWidth - gap * (cols - 1)) / cols;
          const availableHeight = (containerHeight - gap * (rows - 1)) / rows;

          let itemWidth: number;
          let itemHeight: number;
          const currentAspectRatio = availableWidth / availableHeight;

          if (currentAspectRatio > maxAspectRatio) {
            itemHeight = availableHeight;
            itemWidth = itemHeight * maxAspectRatio;
          } else if (currentAspectRatio < minAspectRatio) {
            itemWidth = availableWidth;
            itemHeight = itemWidth / minAspectRatio;
          } else {
            itemWidth = availableWidth;
            itemHeight = availableHeight;
          }

          const constrainedSize = Math.min(itemWidth, itemHeight);
          if (constrainedSize < minSize) {
            const scale = minSize / constrainedSize;
            itemWidth *= scale;
            itemHeight *= scale;
          } else if (constrainedSize > maxSize) {
            const scale = maxSize / constrainedSize;
            itemWidth *= scale;
            itemHeight *= scale;
          }

          const totalWidth = cols * itemWidth + (cols - 1) * gap;
          const totalHeight = rows * itemHeight + (rows - 1) * gap;

          if (totalWidth > containerWidth || totalHeight > containerHeight) {
            const scaleX = containerWidth / totalWidth;
            const scaleY = containerHeight / totalHeight;
            const scale = Math.min(scaleX, scaleY);
            itemWidth *= scale;
            itemHeight *= scale;
          }

          const usedWidth = cols * itemWidth + (cols - 1) * gap;
          const usedHeight = rows * itemHeight + (rows - 1) * gap;
          const wastedWidth = containerWidth - usedWidth;
          const wastedHeight = containerHeight - usedHeight;
          const totalWasted = Math.abs(wastedWidth) + Math.abs(wastedHeight);
          const aspectRatioDeviation = Math.abs(1 - itemWidth / itemHeight) * 100;
          const adjustedWaste = totalWasted + aspectRatioDeviation * 0.1;

          if (adjustedWaste < bestFit.wasted) {
            bestFit = {
              columns: cols,
              rows: rows,
              itemWidth: itemWidth,
              itemHeight: itemHeight,
              wasted: adjustedWaste,
            };
          }
        }

        return {
          columns: bestFit.columns,
          rows: bestFit.rows,
          itemWidth: bestFit.itemWidth,
          itemHeight: bestFit.itemHeight,
          containerWidth,
          containerHeight,
        };
      }

      // Perfect vertical filling algorithm - ensures ZERO wasted space
      let bestConfiguration = {
        columns: 1,
        rows: itemCount,
        itemWidth: minSize,
        itemHeight: minSize,
        rowHeights: [] as number[],
        score: -Infinity,
      };

      // Calculate column constraints based on width
      const minCols = Math.max(1, Math.floor((containerWidth + gap) / (maxSize + gap)));
      const maxCols = Math.min(itemCount, Math.floor((containerWidth + gap) / (minSize + gap)));

      // Helper function to calculate perfect vertical distribution
      const calculatePerfectVerticalFill = (cols: number) => {
        const rows = Math.ceil(itemCount / cols);

        // Calculate exact item width to fill horizontal space
        const totalGapWidth = gap * (cols - 1);
        const availableWidth = containerWidth - totalGapWidth;
        const itemWidth = availableWidth / cols;

        // Check width constraints
        if (itemWidth < minSize || itemWidth > maxSize) {
          return null;
        }

        // Calculate total available height for items
        const totalGapHeight = gap * (rows - 1);
        const totalAvailableHeight = containerHeight - totalGapHeight;

        // Check if we can fit with minimum height
        if (totalAvailableHeight < rows * minSize) {
          return null;
        }

        // Calculate exact row height to fill ALL vertical space
        const baseRowHeight = totalAvailableHeight / rows;

        // Check height constraints based on aspect ratio
        const minHeightForAspect = itemWidth / maxAspectRatio;
        const maxHeightForAspect = itemWidth / minAspectRatio;

        // Apply all constraints - but prioritize filling space
        let constrainedHeight = baseRowHeight;

        // Only apply constraints if they don't prevent us from filling the space
        if (baseRowHeight < minSize || baseRowHeight < minHeightForAspect) {
          // Can't meet minimum constraints
          return null;
        }

        if (baseRowHeight > maxSize || baseRowHeight > maxHeightForAspect) {
          // Need to constrain, but still try to fill as much as possible
          constrainedHeight = Math.min(maxSize, maxHeightForAspect);

          // Check if we can still reasonably fill the space
          const totalUsedHeight = constrainedHeight * rows + (rows - 1) * gap;
          const unusedHeight = containerHeight - totalUsedHeight;
          const unusedPercent = unusedHeight / containerHeight;

          // If we're leaving more than 10% unused, this configuration isn't good
          if (unusedPercent > 0.1) {
            return null;
          }
        }

        // Use the base row height for perfect fill, or constrained height if needed
        const finalHeight = constrainedHeight;

        // Create row heights array
        const rowHeights = new Array(rows).fill(finalHeight);

        // If we're using baseRowHeight (perfect fill), distribute any rounding errors
        if (Math.abs(constrainedHeight - baseRowHeight) < 0.01) {
          const totalHeight = finalHeight * rows;
          const remainder = totalAvailableHeight - totalHeight;

          // Distribute remainder across rows (usually just fractions of pixels)
          if (Math.abs(remainder) > 0.001) {
            const extraPerRow = remainder / rows;
            for (let i = 0; i < rows; i++) {
              rowHeights[i] += extraPerRow;
            }
          }
        }

        // Calculate score based on how well this fills the space
        const aspectRatio = itemWidth / finalHeight;
        const aspectScore = 1 - Math.abs(1 - aspectRatio) / Math.max(maxAspectRatio - 1, 1 - minAspectRatio);

        // Calculate fill efficiency
        const totalUsedHeight = rowHeights.reduce((sum, h) => sum + h, 0) + (rows - 1) * gap;
        const fillEfficiency = totalUsedHeight / containerHeight;

        // Higher bonus for better vertical fill
        const fillBonus = fillEfficiency * 2.0;

        // Penalize incomplete last rows
        const lastRowItems = itemCount % cols || cols;
        const lastRowFullness = lastRowItems / cols;
        const lastRowPenalty = (1 - lastRowFullness) * 0.3;

        const score = aspectScore + fillBonus - lastRowPenalty;

        return {
          columns: cols,
          rows: rows,
          itemWidth: itemWidth,
          itemHeight: finalHeight,
          rowHeights: rowHeights,
          score: score,
        };
      };

      // Search for the best configuration
      for (let cols = minCols; cols <= maxCols; cols++) {
        const config = calculatePerfectVerticalFill(cols);
        if (config && config.score > bestConfiguration.score) {
          bestConfiguration = config;
        }
      }

      // If no perfect fill found, use a fallback that fills as much as possible
      if (bestConfiguration.score === -Infinity) {
        // Fallback: Find configuration that maximizes space usage
        for (let cols = minCols; cols <= maxCols; cols++) {
          const rows = Math.ceil(itemCount / cols);

          // Calculate item dimensions
          const totalGapWidth = gap * (cols - 1);
          const availableWidth = containerWidth - totalGapWidth;
          let itemWidth = availableWidth / cols;

          // Apply width constraints
          itemWidth = Math.max(minSize, Math.min(maxSize, itemWidth));

          // Check if it fits horizontally
          if (cols * itemWidth + totalGapWidth > containerWidth) {
            continue;
          }

          // Calculate height to fill vertical space exactly
          const totalGapHeight = gap * (rows - 1);
          const totalAvailableHeight = containerHeight - totalGapHeight;
          let rowHeight = totalAvailableHeight / rows;

          // Apply height constraints
          const minHeightForAspect = itemWidth / maxAspectRatio;
          const maxHeightForAspect = itemWidth / minAspectRatio;
          rowHeight = Math.max(minSize, minHeightForAspect, Math.min(maxSize, maxHeightForAspect, rowHeight));

          // Create row heights - exact distribution
          const rowHeights = new Array(rows).fill(rowHeight);

          // ALWAYS try to use ALL available height
          const currentTotalHeight = rowHeight * rows + totalGapHeight;
          if (currentTotalHeight < containerHeight) {
            // Distribute remaining height
            const remaining = containerHeight - currentTotalHeight;
            const extraPerRow = remaining / rows;

            // Add the extra height even if it slightly violates constraints
            // Better to fill the space than to leave gaps
            const newHeight = rowHeight + extraPerRow;

            // Only reject if it severely violates constraints (more than 20% over max)
            if (newHeight <= maxSize * 1.2 && newHeight <= maxHeightForAspect * 1.2) {
              rowHeights.fill(newHeight);
            } else {
              // If we can't add to all rows, at least use what we can
              rowHeights.fill(Math.min(newHeight, maxSize, maxHeightForAspect));
            }
          }

          // Calculate score - heavily prioritize vertical fill
          const aspectRatio = itemWidth / rowHeights[0];
          const aspectScore = 1 - Math.abs(1 - aspectRatio) / Math.max(maxAspectRatio - 1, 1 - minAspectRatio);

          const lastRowItems = itemCount % cols || cols;
          const lastRowFullness = lastRowItems / cols;

          // Calculate actual height utilization
          const actualTotalHeight = rowHeights[0] * rows + totalGapHeight;
          const heightUtilization = Math.min(1, actualTotalHeight / containerHeight);
          const widthUtilization = (cols * itemWidth + totalGapWidth) / containerWidth;

          // Heavily weight height utilization (70%) since we want to fill vertically
          const score = heightUtilization * 0.7 + widthUtilization * 0.15 + aspectScore * 0.1 + lastRowFullness * 0.05;

          if (score > bestConfiguration.score) {
            bestConfiguration = {
              columns: cols,
              rows: rows,
              itemWidth: itemWidth,
              itemHeight: rowHeights[0],
              rowHeights: rowHeights,
              score: score,
            };
          }
        }
      }

      // Final adjustment: ensure we use EXACTLY the container height
      if (bestConfiguration.rowHeights && bestConfiguration.rowHeights.length > 0) {
        const totalGaps = (bestConfiguration.rows - 1) * gap;
        const availableForItems = containerHeight - totalGaps;
        const currentItemsHeight = bestConfiguration.rowHeights.reduce((sum, h) => sum + h, 0);

        if (Math.abs(currentItemsHeight - availableForItems) > 0.1) {
          // Redistribute to use exact height
          const adjustment = (availableForItems - currentItemsHeight) / bestConfiguration.rows;
          bestConfiguration.rowHeights = bestConfiguration.rowHeights.map((h) => h + adjustment);
          bestConfiguration.itemHeight = bestConfiguration.rowHeights[0];
        }
      }

      return {
        columns: bestConfiguration.columns,
        rows: bestConfiguration.rows,
        itemWidth: bestConfiguration.itemWidth,
        itemHeight: bestConfiguration.itemHeight,
        containerWidth,
        containerHeight,
        rowHeights: bestConfiguration.rowHeights,
      };
    },
    [itemCount, gap, minSize, maxSize, minAspectRatio, maxAspectRatio, fillMode],
  );

  const updateDimensions = useCallback(() => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(containerRef.current);
    const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
    const paddingRight = parseFloat(computedStyle.paddingRight) || 0;
    const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
    const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0;

    const clientWidth = containerRef.current.clientWidth - paddingLeft - paddingRight;
    const clientHeight = containerRef.current.clientHeight - paddingTop - paddingBottom;

    const newDimensions = calculateOptimalGrid(clientWidth, clientHeight);

    // Debug logging
    if (process.env.NODE_ENV === "development") {
    }

    setDimensions(newDimensions);
  }, [calculateOptimalGrid, gap, fillMode]);

  // Update dimensions on mount and resize
  useEffect(() => {
    updateDimensions();

    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [updateDimensions]);

  // Update when item count changes
  useEffect(() => {
    updateDimensions();
  }, [itemCount, updateDimensions]);

  // Generate grid template rows based on row heights
  const gridTemplateRows =
    dimensions.rowHeights && dimensions.rowHeights.length > 0
      ? dimensions.rowHeights.map((height) => `${height}px`).join(" ")
      : `repeat(${dimensions.rows}, ${dimensions.itemHeight}px)`;

  return {
    containerRef,
    dimensions,
    gridStyle: {
      display: "grid",
      gridTemplateColumns:
        fillMode === "fill"
          ? `repeat(${dimensions.columns}, 1fr)` // Use fractional units to fill space
          : `repeat(${dimensions.columns}, ${dimensions.itemWidth}px)`,
      gridTemplateRows: gridTemplateRows,
      gap: `${gap}px`,
      justifyContent: fillMode === "center" ? "center" : "stretch",
      alignContent: fillMode === "center" ? "center" : "stretch",
      width: "100%",
      height: "100%",
      overflow: "visible", // Allow items to be visible for hover effects
      margin: 0,
      padding: 0,
    },
    itemStyle: {
      width: fillMode === "fill" ? "100%" : `${dimensions.itemWidth}px`,
      height: `${dimensions.itemHeight}px`,
    },
    getItemStyle: (index: number) => {
      // For variable height rows, calculate the specific height for this item
      if (dimensions.rowHeights && dimensions.rowHeights.length > 0) {
        const row = Math.floor(index / dimensions.columns);
        const height = dimensions.rowHeights[row] || dimensions.itemHeight;
        return {
          width: fillMode === "fill" ? "100%" : `${dimensions.itemWidth}px`,
          height: `${height}px`,
        };
      }
      return {
        width: fillMode === "fill" ? "100%" : `${dimensions.itemWidth}px`,
        height: `${dimensions.itemHeight}px`,
      };
    },
  };
}
