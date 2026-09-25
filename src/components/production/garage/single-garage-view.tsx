// Single Area View — shows one area (garage or yard) across 5 days (today + 4 business days)
// Today's column supports drag-and-drop; future days are read-only
// Reuses the same SVG rendering from the overview (garage-view.tsx)

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent, DragMoveEvent } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { getNextDaysForForecast } from '@/utils/business-days';
import {
  GARAGE_CONFIGS,
  COMMON_CONFIG,
  PATIO_CONFIG,
  COLORS,
  LANES,
  isYardArea,
  parseSpot,
  calculateAreaLayout,
  ImplementElement,
} from './garage-view';
import type {
  GarageImplement,
  PositionedImplement,
  AreaId,
  GarageId,
  LaneId,
} from './garage-view';

// =====================
// Constants
// =====================

const DAY_NAMES_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// =====================
// Utility functions
// =====================

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDayHeader(date: Date): string {
  const dayName = DAY_NAMES_SHORT[date.getDay()];
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${dayName} ${d}/${m}`;
}

function calculateLaneAvailability(
  garageId: GarageId,
  laneId: LaneId,
  implementList: GarageImplement[],
  newImplementLength: number,
  excludeImplementId?: string,
): { canFit: boolean; availableSpace: number; requiredSpace: number } {
  const config = GARAGE_CONFIGS[garageId];
  const laneLength = config.laneLength;
  const implementsInLane = implementList.filter((t) => {
    if (!t.spot || t.id === excludeImplementId) return false;
    const parsed = parseSpot(t.spot);
    return parsed.garage === garageId && parsed.lane === laneId;
  });
  const currentImplementLengths = implementsInLane.reduce((sum, t) => sum + t.length, 0);
  const margins = 2 * COMMON_CONFIG.IMPLEMENT_MARGIN_TOP;
  const implementCount = implementsInLane.length;
  let gapsBetweenImplements = 0;
  if (implementCount === 2) gapsBetweenImplements = COMMON_CONFIG.IMPLEMENT_MIN_SPACING;
  else if (implementCount >= 3) return { canFit: false, availableSpace: 0, requiredSpace: newImplementLength };
  const usedSpace = margins + currentImplementLengths + gapsBetweenImplements;
  const availableSpace = laneLength - usedSpace;
  const totalRequiredSpace = margins + currentImplementLengths + gapsBetweenImplements + newImplementLength + (implementCount > 0 ? COMMON_CONFIG.IMPLEMENT_MIN_SPACING : 0);
  return { canFit: totalRequiredSpace <= laneLength && implementCount < 3, availableSpace, requiredSpace: newImplementLength };
}

// =====================
// Filter trucks for a specific date
// =====================

function filterImplementsForDate(implementList: GarageImplement[], areaId: AreaId, date: Date): GarageImplement[] {
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isToday = checkDate.getTime() === today.getTime();

  const isYard = isYardArea(areaId);

  return implementList.filter((implement) => {
    if (!implement.spot) return false;

    // Match area
    if (isYard) {
      if (implement.spot !== areaId) return false;
    } else {
      const parsed = parseSpot(implement.spot);
      if (parsed.garage !== areaId) return false;
    }

    // YARD_EXIT trucks are physically in the exit yard — always show
    // (even when completed, until physically removed)
    if (areaId === 'YARD_EXIT') return true;

    // Garage trucks on TODAY are always shown (physically placed)
    // even if their term has passed
    if (!isYard && isToday) return true;

    // Term check: if term has passed, don't show
    // For future dates, this applies to ALL trucks (garage and yard)
    if (implement.term) {
      const term = new Date(implement.term);
      term.setHours(0, 0, 0, 0);
      if (checkDate > term) return false;
    }

    // Garage trucks on future dates pass term check, show them
    if (!isYard) return true;

    // --- Yard trucks (YARD_WAIT) below ---

    // Arrival date check: don't show before forecast/entry date
    // (trucks without explicit DB spots are defaulted to YARD_WAIT and
    // should only appear from their forecast/entry date onwards)
    const arrivalDateStr = implement.entryDate || implement.forecastDate;
    if (arrivalDateStr) {
      const arrivalDate = new Date(arrivalDateStr);
      arrivalDate.setHours(0, 0, 0, 0);
      if (checkDate < arrivalDate) return false;
    }

    // Completed check: if finished before this date, don't show
    if (implement.finishedAt) {
      const finished = new Date(implement.finishedAt);
      finished.setHours(0, 0, 0, 0);
      if (finished < checkDate) return false;
    }

    return true;
  });
}

// =====================
// Droppable Lane (for garage DnD on today's column)
// =====================

function DroppableLane({
  garageId,
  laneId,
  xPosition,
  scale,
  laneY,
  canFit,
  isDragging,
  children,
}: {
  garageId: GarageId;
  laneId: LaneId;
  xPosition: number;
  scale: number;
  laneY: number;
  canFit?: boolean;
  isDragging: boolean;
  children: React.ReactNode;
}) {
  const config = GARAGE_CONFIGS[garageId];
  const { setNodeRef, isOver } = useDroppable({
    id: `${garageId}_${laneId}`,
    data: { garageId, laneId },
  });

  const laneWidth = config.laneWidth * scale;
  const laneHeight = config.laneLength * scale;
  const x = xPosition * scale;
  const y = laneY * scale;

  let fill: string = COLORS.LANE_FILL;
  if (isDragging && isOver) {
    fill = canFit ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)';
  }

  return (
    <g ref={setNodeRef as any}>
      <rect x={x} y={y} width={laneWidth} height={laneHeight} fill={fill} stroke={COLORS.LANE_STROKE} strokeWidth={2} rx={2} />
      <g transform={`translate(0, ${y})`}>{children}</g>
    </g>
  );
}

// =====================
// Draggable truck wrapper for today's column
// =====================

function DraggableImplementWrapper({
  implement,
  scale,
  onClick,
}: {
  implement: PositionedImplement;
  scale: number;
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: implement.id,
    data: { implement },
  });

  return (
    <g
      ref={setNodeRef as any}
      {...listeners}
      {...attributes}
      style={{ cursor: 'grab', opacity: isDragging ? 0.3 : 1, touchAction: 'none' }}
    >
      <ImplementElement implement={implement} scale={scale} isDragging={isDragging} onClick={onClick} />
    </g>
  );
}

// =====================
// Day Column — renders one day's area (garage or yard) using same SVG as overview
// =====================

function DayColumn({
  areaId,
  date,
  implementList,
  patioColumns: patioColumnsProp,
  scale,
  svgWidth,
  svgHeight,
  isToday,
  enableDragDrop,
  onImplementClick,
  activeImplement,
  laneAvailability,
  dimmed,
}: {
  areaId: AreaId;
  date: Date;
  implementList: GarageImplement[];
  patioColumns?: number;
  scale: number;
  svgWidth: number;
  svgHeight: number;
  isToday: boolean;
  enableDragDrop: boolean;
  onImplementClick?: (taskId: string) => void;
  activeImplement: PositionedImplement | null;
  laneAvailability: Record<string, { canFit: boolean }> | null;
  dimmed: boolean;
}) {
  const isPatio = isYardArea(areaId);
  const patioColumns = patioColumnsProp || (isPatio
    ? Math.max(PATIO_CONFIG.MIN_LANES, Math.ceil(implementList.filter(t => t.spot === areaId).length / 3))
    : 0);
  const layout = useMemo(
    () => calculateAreaLayout(areaId, implementList, patioColumns),
    [areaId, implementList, patioColumns],
  );

  const implementCount = isPatio
    ? implementList.filter(t => t.spot === areaId).length
    : implementList.filter(t => { if (!t.spot) return false; const p = parseSpot(t.spot); return p.garage === areaId; }).length;

  return (
    <div className="flex flex-col items-center gap-2 shrink-0">
      {/* Day header */}
      <div className="flex flex-col items-center">
        <span className={cn(
          'text-sm font-semibold',
          isToday ? 'text-primary' : 'text-muted-foreground',
        )}>
          {isToday ? 'Hoje' : formatDayHeader(date)}
        </span>
        <span className={cn(
          'text-xs font-bold px-2 py-0.5 rounded-md mt-0.5',
          isToday
            ? 'bg-primary/10 text-primary'
            : isPatio
              ? 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-100'
              : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100',
        )}>
          {implementCount}
        </span>
      </div>

      {/* SVG area — same rendering as overview */}
      <div className={cn(
        'shadow-md border-2 rounded-lg bg-card p-1.5',
        isToday ? 'border-primary/50' : 'border-border',
        dimmed && 'opacity-60',
      )}>
        <svg width={svgWidth} height={svgHeight} className="rounded">
          {isPatio ? (
            // Patio rendering — blue background with truck columns
            <>
              {/* Patio background — inset by 1px so the 2px stroke isn't clipped by SVG viewport */}
              <rect
                x={1} y={1}
                width={svgWidth - 2} height={svgHeight - 2}
                fill={COLORS.PATIO_FILL}
                stroke={COLORS.PATIO_STROKE}
                strokeWidth={2}
                rx={3}
              />
              {/* Patio lanes (columns) — centered */}
              {(() => {
                const laneWidth = COMMON_CONFIG.IMPLEMENT_WIDTH_TOP_VIEW + 0.4;
                const laneSpacing = PATIO_CONFIG.LANE_SPACING;
                const padding = PATIO_CONFIG.PADDING;
                const cols = patioColumns;
                const totalLanesWidth = (cols * laneWidth + (cols - 1) * laneSpacing) * scale;
                const startX = (svgWidth - totalLanesWidth) / 2;
                return Array.from({ length: cols }).map((_, col) => {
                  const x = startX + col * (laneWidth + laneSpacing) * scale;
                  const y = padding * scale;
                  const w = laneWidth * scale;
                  const h = svgHeight - padding * 2 * scale;
                  return (
                    <rect
                      key={col}
                      x={x} y={y}
                      width={w} height={h}
                      fill={COLORS.PATIO_FILL}
                      stroke={COLORS.PATIO_STROKE}
                      strokeWidth={1}
                      rx={2}
                      strokeDasharray="4,4"
                      opacity={0.5}
                    />
                  );
                });
              })()}
              {/* Implements */}
              {layout.patioImplements?.map((implement) => (
                <ImplementElement
                  key={implement.id}
                  implement={implement}
                  scale={scale}
                  onClick={onImplementClick ? () => onImplementClick(implement.id) : undefined}
                />
              ))}
            </>
          ) : (
            // Garage rendering — same as overview
            <>
              <rect
                x={0} y={0}
                width={svgWidth} height={svgHeight}
                fill={COLORS.GARAGE_FILL}
                stroke={COLORS.GARAGE_STROKE}
                strokeWidth={2}
                rx={3}
              />
              {layout.lanes.map((lane) => {
                const config = GARAGE_CONFIGS[areaId as GarageId];
                const laneY = config.paddingTop;
                const laneKey = `${areaId}_${lane.id}`;
                const availability = laneAvailability?.[laneKey];
                const isDragging = !!activeImplement;

                if (isToday && enableDragDrop) {
                  return (
                    <g key={lane.id}>
                      <DroppableLane
                        garageId={areaId as GarageId}
                        laneId={lane.id}
                        xPosition={lane.xPosition}
                        scale={scale}
                        laneY={laneY}
                        canFit={availability?.canFit}
                        isDragging={isDragging}
                      >
                        {lane.implementList.map((implement) => (
                          <DraggableImplementWrapper
                            key={implement.id}
                            implement={implement}
                            scale={scale}
                            onClick={onImplementClick ? () => onImplementClick(implement.id) : undefined}
                          />
                        ))}
                      </DroppableLane>
                    </g>
                  );
                }

                return (
                  <g key={lane.id}>
                    <rect
                      x={lane.xPosition * scale}
                      y={laneY * scale}
                      width={config.laneWidth * scale}
                      height={config.laneLength * scale}
                      fill={COLORS.LANE_FILL}
                      stroke={COLORS.LANE_STROKE}
                      strokeWidth={2}
                      rx={2}
                    />
                    <g transform={`translate(0, ${laneY * scale})`}>
                      {lane.implementList.map((implement) => (
                        <ImplementElement
                          key={implement.id}
                          implement={implement}
                          scale={scale}
                          onClick={onImplementClick ? () => onImplementClick(implement.id) : undefined}
                        />
                      ))}
                    </g>
                  </g>
                );
              })}
            </>
          )}
        </svg>
      </div>
    </div>
  );
}

// =====================
// Main Component
// =====================

export interface SingleGarageViewProps {
  garageId: AreaId;
  implementList: GarageImplement[];
  onImplementMove?: (implementId: string, newSpot: string | null) => void;
  onImplementSwap?: (implement1Id: string, spot1: string, implement2Id: string, spot2: string | null) => void;
  onImplementClick?: (taskId: string) => void;
  readOnly?: boolean;
  className?: string;
}

export function SingleGarageView({
  garageId,
  implementList,
  onImplementMove,
  onImplementSwap,
  onImplementClick,
  readOnly = false,
  className,
}: SingleGarageViewProps) {
  const [containerSize, setContainerSize] = useState({ width: 800, height: 500 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeImplement, setActiveImplement] = useState<PositionedImplement | null>(null);
  const lastDragPositionRef = useRef<{ x: number; y: number } | null>(null);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const forecastDays = useMemo(() => getNextDaysForForecast(today, 5), [today]);

  const isYard = isYardArea(garageId as AreaId);
  const enableDragDrop = !readOnly && !!onImplementMove && !isYard;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Observe container size
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Filter trucks per day
  const implementsPerDay = useMemo(() => {
    return forecastDays.map((date) => ({
      date,
      implementList: filterImplementsForDate(implementList, garageId as AreaId, date),
      isToday: isSameDay(date, today),
    }));
  }, [forecastDays, implementList, garageId, today]);

  // Calculate area dimensions — optimized for single-garage view
  // Finds the column count that maximizes rendering scale by balancing
  // total width (5 day columns side-by-side) against height
  const areaDimensions = useMemo(() => {
    if (isYard) {
      const laneWidth = COMMON_CONFIG.IMPLEMENT_WIDTH_TOP_VIEW + 0.4;
      const laneSpacing = PATIO_CONFIG.LANE_SPACING;
      const padding = PATIO_CONFIG.PADDING;
      const implementMargin = PATIO_CONFIG.IMPLEMENT_MARGIN;

      // Sorted truck lists per day (for height calculation)
      const dayImplementLists = implementsPerDay.map(d =>
        d.implementList.filter(t => t.spot === garageId).sort((a, b) => b.length - a.length)
      );
      const maxImplements = Math.max(...dayImplementLists.map(d => d.length), 1);

      const calcWidth = (cols: number) =>
        padding * 2 + cols * laneWidth + (cols - 1) * laneSpacing;

      const calcHeight = (cols: number) => {
        let maxH = 0;
        for (const dayImplements of dayImplementLists) {
          if (dayImplements.length === 0) continue;
          const colHeights: number[] = Array(cols).fill(implementMargin);
          dayImplements.forEach((implement, i) => {
            colHeights[i % cols] += implement.length + COMMON_CONFIG.IMPLEMENT_MIN_SPACING;
          });
          const tallest = Math.max(...colHeights) - COMMON_CONFIG.IMPLEMENT_MIN_SPACING + implementMargin;
          if (tallest > maxH) maxH = tallest;
        }
        return Math.max(maxH, PATIO_CONFIG.MIN_LANE_LENGTH) + padding * 2;
      };

      // Find column count that maximizes scale = min(scaleX, scaleY)
      const OUTER_PADDING = 48;
      const GAP = 24;
      const COL_OVERHEAD = 16; // p-1.5 (12px) + border-2 (4px) per column
      const availW = Math.max(1, containerSize.width - OUTER_PADDING - 4 * GAP - 5 * COL_OVERHEAD);
      const availH = Math.max(1, containerSize.height - OUTER_PADDING - 60);

      let bestCols = Math.max(3, Math.ceil(maxImplements / 4));
      let bestScale = 0;
      const minCols = 2;
      const maxCols = Math.min(maxImplements, 12);
      for (let cols = minCols; cols <= maxCols; cols++) {
        const w = Math.max(calcWidth(cols), PATIO_CONFIG.MIN_WIDTH);
        const h = Math.max(calcHeight(cols), PATIO_CONFIG.MIN_HEIGHT);
        const sX = availW / (5 * w);
        const sY = availH / h;
        const s = Math.min(sX, sY);
        if (s > bestScale) {
          bestScale = s;
          bestCols = cols;
        }
      }

      const columns = bestCols;
      const width = calcWidth(columns);
      const contentHeight = calcHeight(columns);

      return {
        columns,
        width: Math.max(width, PATIO_CONFIG.MIN_WIDTH),
        height: Math.max(contentHeight, PATIO_CONFIG.MIN_HEIGHT),
      };
    } else {
      const config = GARAGE_CONFIGS[garageId as GarageId];
      return { columns: 0, width: config.width, height: config.length };
    }
  }, [isYard, garageId, implementsPerDay, containerSize.width, containerSize.height]);

  // Calculate scale to fit 5 areas horizontally
  // Account for: outer padding (p-6 = 24px each side), gaps (gap-6 = 24px × 4),
  // and per-column overhead (p-1.5 = 12px + border-2 = 4px = 16px each)
  const OUTER_PADDING = 48; // p-6 on both sides
  const GAP = 24;
  const COLUMN_OVERHEAD = 16; // p-1.5 (12px) + border-2 (4px) per column
  const totalGaps = 4 * GAP;
  const totalColumnOverhead = 5 * COLUMN_OVERHEAD;
  const availableWidth = Math.max(0, containerSize.width - OUTER_PADDING - totalGaps - totalColumnOverhead);
  const availableHeight = Math.max(0, containerSize.height - OUTER_PADDING - 60);
  const scaleX = availableWidth / (5 * areaDimensions.width);
  const scaleY = availableHeight / areaDimensions.height;
  const scale = Math.max(1, Math.min(scaleX, scaleY));

  const svgWidth = areaDimensions.width * scale;
  const svgHeight = areaDimensions.height * scale;

  // Lane availability for drag feedback (garage areas only)
  const laneAvailability = useMemo(() => {
    if (!activeImplement || !enableDragDrop || isYard) return null;
    const avail: Record<string, { canFit: boolean; availableSpace: number; requiredSpace: number }> = {};
    LANES.forEach((laneId) => {
      const key = `${garageId}_${laneId}`;
      const todayImplements = filterImplementsForDate(implementList, garageId as AreaId, today);
      avail[key] = calculateLaneAvailability(garageId as GarageId, laneId, todayImplements, activeImplement.length, activeImplement.id);
    });
    return avail;
  }, [activeImplement, enableDragDrop, isYard, garageId, implementList, today]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const implement = event.active.data.current?.implement as PositionedImplement;
    setActiveImplement(implement);
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveImplement(null);
    lastDragPositionRef.current = null;
  }, []);

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    const { activatorEvent, delta } = event;
    if (activatorEvent && 'clientY' in activatorEvent && delta) {
      const originalY = (activatorEvent as PointerEvent).clientY;
      const originalX = (activatorEvent as PointerEvent).clientX;
      lastDragPositionRef.current = {
        x: originalX + delta.x,
        y: originalY + delta.y,
      };
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      const lastPosition = lastDragPositionRef.current;
      setActiveImplement(null);
      lastDragPositionRef.current = null;

      if (!over || !onImplementMove) return;

      const implementId = active.id as string;
      const draggedImplement = implementList.find((t) => t.id === implementId);
      if (!draggedImplement) return;

      const dropData = over.data.current as { garageId?: GarageId; laneId?: LaneId } | undefined;
      if (!dropData?.garageId || !dropData?.laneId) return;

      const targetLaneId = dropData.laneId;

      let isDroppedInTopHalf = true;
      const activeRect = active.rect?.current?.translated;
      const overRect = over.rect;

      if (activeRect && overRect) {
        const implementCenterY = activeRect.top + activeRect.height / 2;
        const laneCenterY = overRect.top + overRect.height / 2;
        isDroppedInTopHalf = implementCenterY < laneCenterY;
      } else if (lastPosition && overRect) {
        const dropY = lastPosition.y;
        const laneCenterY = overRect.top + overRect.height / 2;
        isDroppedInTopHalf = dropY < laneCenterY;
      }

      let preferredSpotNum = isDroppedInTopHalf ? 1 : 2;

      const draggedImplementParsed = draggedImplement.spot ? parseSpot(draggedImplement.spot) : null;
      const draggedImplementCurrentSpot = draggedImplement.spot;

      const todayImplements = filterImplementsForDate(implementList, garageId as AreaId, today);
      const spotToImplement = new Map<number, GarageImplement>();
      todayImplements.forEach((t) => {
        if (!t.spot || t.id === implementId) return;
        const parsed = parseSpot(t.spot);
        if (parsed.garage === garageId && parsed.lane === targetLaneId && parsed.spotNumber) {
          spotToImplement.set(parsed.spotNumber, t);
        }
      });

      // V3 ADD: Use three-zone detection when room for 3 trucks
      const implementAtV1 = spotToImplement.get(1);
      const implementAtV2 = spotToImplement.get(2);
      const implementAtV3 = spotToImplement.get(3);

      // V1-only lane + room for V3: three-zone detection only for small trucks
      if (implementAtV1 && !implementAtV2 && !implementAtV3) {
        const singleConfig = GARAGE_CONFIGS[garageId as GarageId];
        const usedWithV2 = 2 * COMMON_CONFIG.IMPLEMENT_MARGIN_TOP + implementAtV1.length + draggedImplement.length + 2 * COMMON_CONFIG.IMPLEMENT_MIN_SPACING;
        if (usedWithV2 < singleConfig.laneLength) {
          // Check if both V2+V3 indicators fit (same condition as preview)
          const v1WithSpacing = COMMON_CONFIG.IMPLEMENT_MARGIN_TOP + implementAtV1.length + COMMON_CONFIG.IMPLEMENT_MIN_SPACING;
          const laneBottom = singleConfig.laneLength - COMMON_CONFIG.IMPLEMENT_MARGIN_TOP;
          const v3ZoneTop = laneBottom - draggedImplement.length;
          const canShowBothIndicators = (v3ZoneTop - v1WithSpacing) >= draggedImplement.length;

          if (canShowBothIndicators) {
            // Small truck: three-zone (V1 swap top, V2 middle, V3 bottom)
            let dropFraction = 0.5;
            if (activeRect && overRect) {
              const implementCenterY = activeRect.top + activeRect.height / 2;
              dropFraction = (implementCenterY - overRect.top) / overRect.height;
            } else if (lastPosition && overRect) {
              dropFraction = (lastPosition.y - overRect.top) / overRect.height;
            }

            if (dropFraction > 2 / 3) {
              // Bottom third → V3
              const isAlreadyAtV3 = draggedImplementParsed?.garage === garageId &&
                draggedImplementParsed?.lane === targetLaneId && draggedImplementParsed?.spotNumber === 3;
              if (isAlreadyAtV3) return;
              onImplementMove(implementId, `${garageId}_${targetLaneId}_V3`);
              return;
            }
            // Middle third → V2, Top third → V1 swap
            preferredSpotNum = dropFraction < 1 / 3 ? 1 : 2;
          }
          // Large truck: fall through to two-zone detection (top=V1 swap, bottom=V2)
        }
      }

      // V1+V3 occupied (V2 being dragged): allow V2↔V3 swap via bottom drop
      if (implementAtV1 && !implementAtV2 && implementAtV3) {
        let dropFraction = 0.5;
        if (activeRect && overRect) {
          const implementCenterY = activeRect.top + activeRect.height / 2;
          dropFraction = (implementCenterY - overRect.top) / overRect.height;
        } else if (lastPosition && overRect) {
          dropFraction = (lastPosition.y - overRect.top) / overRect.height;
        }

        if (dropFraction > 2 / 3) {
          // Bottom third → swap with V3
          preferredSpotNum = 3;
        } else if (dropFraction < 1 / 3) {
          // Top third → swap with V1
          preferredSpotNum = 1;
        }
        // Middle third → V2 (default from two-zone), falls through
      }

      // V1+V2 both occupied: three-zone detection
      if (implementAtV1 && implementAtV2 && !implementAtV3) {
        const todayImplementsForCheck = filterImplementsForDate(implementList, garageId as AreaId, today);
        const v3Availability = calculateLaneAvailability(
          garageId as GarageId, targetLaneId, todayImplementsForCheck, draggedImplement.length, implementId
        );
        if (v3Availability.canFit) {
          // V3 feasible: split lane into thirds (top=V1 swap, middle=V2 swap, bottom=V3 add)
          let dropFraction = 0.5;
          if (activeRect && overRect) {
            const implementCenterY = activeRect.top + activeRect.height / 2;
            dropFraction = (implementCenterY - overRect.top) / overRect.height;
          } else if (lastPosition && overRect) {
            dropFraction = (lastPosition.y - overRect.top) / overRect.height;
          }

          if (dropFraction > 2 / 3) {
            // Bottom third - add/stay at V3
            const isAlreadyAtV3 = draggedImplementParsed?.garage === garageId &&
              draggedImplementParsed?.lane === targetLaneId && draggedImplementParsed?.spotNumber === 3;
            if (isAlreadyAtV3) return;
            onImplementMove(implementId, `${garageId}_${targetLaneId}_V3`);
            return;
          } else if (dropFraction > 1 / 3) {
            // Middle third - push: dragged truck → V2, existing V2 → V3
            const newSpotForDragged = `${garageId}_${targetLaneId}_V2`;
            const newSpotForV2Implement = `${garageId}_${targetLaneId}_V3`;
            if (onImplementSwap) {
              onImplementSwap(implementId, newSpotForDragged, implementAtV2.id, newSpotForV2Implement);
            } else {
              onImplementMove(implementId, newSpotForDragged);
              onImplementMove(implementAtV2.id, newSpotForV2Implement);
            }
            return;
          }
          // Top third - swap with V1, fall through
          preferredSpotNum = 1;
        }
      }

      if (
        draggedImplementParsed?.garage === garageId &&
        draggedImplementParsed?.lane === targetLaneId &&
        draggedImplementParsed?.spotNumber === preferredSpotNum
      ) {
        return;
      }

      const implementAtPreferredSpot = spotToImplement.get(preferredSpotNum);

      if (implementAtPreferredSpot) {
        const newSpotForDragged = `${garageId}_${targetLaneId}_V${preferredSpotNum}`;
        const swapTargetSpot = draggedImplementCurrentSpot || null;

        const canSwap = calculateLaneAvailability(
          garageId as GarageId,
          targetLaneId,
          todayImplements.filter((t) => t.id !== implementId && t.id !== implementAtPreferredSpot.id),
          draggedImplement.length,
        );

        if (!canSwap.canFit) return;

        // Reverse validation: check if swapped truck fits in dragged truck's original lane
        if (draggedImplementParsed && (draggedImplementParsed.garage !== garageId || draggedImplementParsed.lane !== targetLaneId)) {
          const origConfig = GARAGE_CONFIGS[draggedImplementParsed.garage as keyof typeof GARAGE_CONFIGS];
          if (origConfig) {
            const reverseCheck = calculateLaneAvailability(
              draggedImplementParsed.garage as GarageId,
              draggedImplementParsed.lane as LaneId,
              todayImplements.filter((t) => t.id !== implementId && t.id !== implementAtPreferredSpot.id),
              implementAtPreferredSpot.length,
            );
            if (!reverseCheck.canFit) return;
          }
        }

        if (onImplementSwap) {
          onImplementSwap(implementId, newSpotForDragged, implementAtPreferredSpot.id, swapTargetSpot);
        } else {
          onImplementMove(implementId, newSpotForDragged);
          onImplementMove(implementAtPreferredSpot.id, swapTargetSpot);
        }
        return;
      }

      const availability = calculateLaneAvailability(garageId as GarageId, targetLaneId, todayImplements, draggedImplement.length, implementId);
      if (!availability.canFit) return;

      const newSpot = `${garageId}_${targetLaneId}_V${preferredSpotNum}`;
      onImplementMove(implementId, newSpot);
    },
    [implementList, garageId, today, onImplementMove, onImplementSwap],
  );

  const content = (
    <div className="flex items-start justify-center gap-6 p-6">
      {implementsPerDay.map(({ date, implementList: dayImplements, isToday: isDayToday }) => (
        <DayColumn
          key={date.toISOString()}
          areaId={garageId as AreaId}
          date={date}
          implementList={dayImplements}
          patioColumns={areaDimensions.columns}
          scale={scale}
          svgWidth={svgWidth}
          svgHeight={svgHeight}
          isToday={isDayToday}
          enableDragDrop={isDayToday && enableDragDrop}
          onImplementClick={onImplementClick}
          activeImplement={activeImplement}
          laneAvailability={isDayToday ? laneAvailability : null}
          dimmed={!isDayToday}
        />
      ))}
    </div>
  );

  if (enableDragDrop) {
    return (
      <div ref={containerRef} className={cn('flex flex-col h-full w-full', className)}>
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          {content}
          <DragOverlay>
            {activeImplement ? (
              <div style={{ opacity: 0.8, cursor: 'grabbing' }}>
                <svg
                  width={COMMON_CONFIG.IMPLEMENT_WIDTH_TOP_VIEW * scale}
                  height={activeImplement.length * scale}
                >
                  <ImplementElement implement={{ ...activeImplement, xPosition: 0, yPosition: 0 }} scale={scale} />
                </svg>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn('flex flex-col h-full w-full', className)}>
      {content}
    </div>
  );
}
