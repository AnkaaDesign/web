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
  TruckElement,
} from './garage-view';
import type {
  GarageTruck,
  PositionedTruck,
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
  trucks: GarageTruck[],
  newTruckLength: number,
  excludeTruckId?: string,
): { canFit: boolean; availableSpace: number; requiredSpace: number } {
  const config = GARAGE_CONFIGS[garageId];
  const laneLength = config.laneLength;
  const trucksInLane = trucks.filter((t) => {
    if (!t.spot || t.id === excludeTruckId) return false;
    const parsed = parseSpot(t.spot);
    return parsed.garage === garageId && parsed.lane === laneId;
  });
  const currentTruckLengths = trucksInLane.reduce((sum, t) => sum + t.length, 0);
  const margins = 2 * COMMON_CONFIG.TRUCK_MARGIN_TOP;
  const truckCount = trucksInLane.length;
  let gapsBetweenTrucks = 0;
  if (truckCount === 2) gapsBetweenTrucks = COMMON_CONFIG.TRUCK_MIN_SPACING;
  else if (truckCount >= 3) return { canFit: false, availableSpace: 0, requiredSpace: newTruckLength };
  const usedSpace = margins + currentTruckLengths + gapsBetweenTrucks;
  const availableSpace = laneLength - usedSpace;
  const totalRequiredSpace = margins + currentTruckLengths + gapsBetweenTrucks + newTruckLength + (truckCount > 0 ? COMMON_CONFIG.TRUCK_MIN_SPACING : 0);
  return { canFit: totalRequiredSpace <= laneLength && truckCount < 3, availableSpace, requiredSpace: newTruckLength };
}

// =====================
// Filter trucks for a specific date
// =====================

function filterTrucksForDate(trucks: GarageTruck[], areaId: AreaId, date: Date): GarageTruck[] {
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);

  const isYard = isYardArea(areaId);

  return trucks.filter((truck) => {
    if (!truck.spot) return false;

    // Match area
    if (isYard) {
      if (truck.spot !== areaId) return false;
    } else {
      const parsed = parseSpot(truck.spot);
      if (parsed.garage !== areaId) return false;
    }

    // YARD_EXIT trucks are physically in the exit yard — always show
    // (even when completed, until physically removed)
    if (areaId === 'YARD_EXIT') return true;

    // Term check: if term has passed, don't show
    if (truck.term) {
      const term = new Date(truck.term);
      term.setHours(0, 0, 0, 0);
      if (checkDate > term) return false;
    }

    // Garage trucks are physically placed — always show (after term check)
    if (!isYard) return true;

    // --- Yard trucks (YARD_WAIT) below ---

    // Arrival date check: don't show before forecast/entry date
    // (trucks without explicit DB spots are defaulted to YARD_WAIT and
    // should only appear from their forecast/entry date onwards)
    const arrivalDateStr = truck.entryDate || truck.forecastDate;
    if (arrivalDateStr) {
      const arrivalDate = new Date(arrivalDateStr);
      arrivalDate.setHours(0, 0, 0, 0);
      if (checkDate < arrivalDate) return false;
    }

    // Completed check: if finished before this date, don't show
    if (truck.finishedAt) {
      const finished = new Date(truck.finishedAt);
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

function DraggableTruckWrapper({
  truck,
  scale,
  onClick,
}: {
  truck: PositionedTruck;
  scale: number;
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: truck.id,
    data: { truck },
  });

  return (
    <g
      ref={setNodeRef as any}
      {...listeners}
      {...attributes}
      style={{ cursor: 'grab', opacity: isDragging ? 0.3 : 1, touchAction: 'none' }}
    >
      <TruckElement truck={truck} scale={scale} isDragging={isDragging} onClick={onClick} />
    </g>
  );
}

// =====================
// Day Column — renders one day's area (garage or yard) using same SVG as overview
// =====================

function DayColumn({
  areaId,
  date,
  trucks,
  patioColumns: patioColumnsProp,
  scale,
  svgWidth,
  svgHeight,
  isToday,
  enableDragDrop,
  onTruckClick,
  activeTruck,
  laneAvailability,
  dimmed,
}: {
  areaId: AreaId;
  date: Date;
  trucks: GarageTruck[];
  patioColumns?: number;
  scale: number;
  svgWidth: number;
  svgHeight: number;
  isToday: boolean;
  enableDragDrop: boolean;
  onTruckClick?: (taskId: string) => void;
  activeTruck: PositionedTruck | null;
  laneAvailability: Record<string, { canFit: boolean }> | null;
  dimmed: boolean;
}) {
  const isPatio = isYardArea(areaId);
  const patioColumns = patioColumnsProp || (isPatio
    ? Math.max(PATIO_CONFIG.MIN_LANES, Math.ceil(trucks.filter(t => t.spot === areaId).length / 3))
    : 0);
  const layout = useMemo(
    () => calculateAreaLayout(areaId, trucks, patioColumns),
    [areaId, trucks, patioColumns],
  );

  const truckCount = isPatio
    ? trucks.filter(t => t.spot === areaId).length
    : trucks.filter(t => { if (!t.spot) return false; const p = parseSpot(t.spot); return p.garage === areaId; }).length;

  return (
    <div className="flex flex-col items-center gap-2">
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
          {truckCount}
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
              <rect
                x={0} y={0}
                width={svgWidth} height={svgHeight}
                fill={COLORS.PATIO_FILL}
                stroke={COLORS.PATIO_STROKE}
                strokeWidth={2}
                rx={3}
              />
              {/* Patio lanes (columns) */}
              {(() => {
                const laneWidth = COMMON_CONFIG.TRUCK_WIDTH_TOP_VIEW + 0.4;
                const laneSpacing = PATIO_CONFIG.LANE_SPACING;
                const padding = PATIO_CONFIG.PADDING;
                const cols = patioColumns;
                return Array.from({ length: cols }).map((_, col) => {
                  const x = (padding + col * (laneWidth + laneSpacing)) * scale;
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
              {/* Trucks */}
              {layout.patioTrucks?.map((truck) => (
                <TruckElement
                  key={truck.id}
                  truck={truck}
                  scale={scale}
                  onClick={onTruckClick ? () => onTruckClick(truck.id) : undefined}
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
                const isDragging = !!activeTruck;

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
                        {lane.trucks.map((truck) => (
                          <DraggableTruckWrapper
                            key={truck.id}
                            truck={truck}
                            scale={scale}
                            onClick={onTruckClick ? () => onTruckClick(truck.id) : undefined}
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
                      {lane.trucks.map((truck) => (
                        <TruckElement
                          key={truck.id}
                          truck={truck}
                          scale={scale}
                          onClick={onTruckClick ? () => onTruckClick(truck.id) : undefined}
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
  trucks: GarageTruck[];
  onTruckMove?: (truckId: string, newSpot: string | null) => void;
  onTruckSwap?: (truck1Id: string, spot1: string, truck2Id: string, spot2: string | null) => void;
  onTruckClick?: (taskId: string) => void;
  readOnly?: boolean;
  className?: string;
}

export function SingleGarageView({
  garageId,
  trucks,
  onTruckMove,
  onTruckSwap,
  onTruckClick,
  readOnly = false,
  className,
}: SingleGarageViewProps) {
  const [containerSize, setContainerSize] = useState({ width: 800, height: 500 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTruck, setActiveTruck] = useState<PositionedTruck | null>(null);
  const lastDragPositionRef = useRef<{ x: number; y: number } | null>(null);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const forecastDays = useMemo(() => getNextDaysForForecast(today, 5), [today]);

  const isYard = isYardArea(garageId as AreaId);
  const enableDragDrop = !readOnly && !!onTruckMove && !isYard;

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
  const trucksPerDay = useMemo(() => {
    return forecastDays.map((date) => ({
      date,
      trucks: filterTrucksForDate(trucks, garageId as AreaId, date),
      isToday: isSameDay(date, today),
    }));
  }, [forecastDays, trucks, garageId, today]);

  // Calculate area dimensions — optimized for single-garage view
  // Finds the column count that maximizes rendering scale by balancing
  // total width (5 day columns side-by-side) against height
  const areaDimensions = useMemo(() => {
    if (isYard) {
      const laneWidth = COMMON_CONFIG.TRUCK_WIDTH_TOP_VIEW + 0.4;
      const laneSpacing = PATIO_CONFIG.LANE_SPACING;
      const padding = PATIO_CONFIG.PADDING;
      const truckMargin = PATIO_CONFIG.TRUCK_MARGIN;

      // Sorted truck lists per day (for height calculation)
      const dayTruckLists = trucksPerDay.map(d =>
        d.trucks.filter(t => t.spot === garageId).sort((a, b) => b.length - a.length)
      );
      const maxTrucks = Math.max(...dayTruckLists.map(d => d.length), 1);

      const calcWidth = (cols: number) =>
        padding * 2 + cols * laneWidth + (cols - 1) * laneSpacing;

      const calcHeight = (cols: number) => {
        let maxH = 0;
        for (const dayTrucks of dayTruckLists) {
          if (dayTrucks.length === 0) continue;
          const colHeights: number[] = Array(cols).fill(truckMargin);
          dayTrucks.forEach((truck, i) => {
            colHeights[i % cols] += truck.length + COMMON_CONFIG.TRUCK_MIN_SPACING;
          });
          const tallest = Math.max(...colHeights) - COMMON_CONFIG.TRUCK_MIN_SPACING + truckMargin;
          if (tallest > maxH) maxH = tallest;
        }
        return Math.max(maxH, PATIO_CONFIG.MIN_LANE_LENGTH) + padding * 2;
      };

      // Find column count that maximizes scale = min(scaleX, scaleY)
      const OUTER_PADDING = 48;
      const GAP = 24;
      const availW = Math.max(1, containerSize.width - OUTER_PADDING - 4 * GAP);
      const availH = Math.max(1, containerSize.height - OUTER_PADDING - 60);

      let bestCols = Math.max(3, Math.ceil(maxTrucks / 4));
      let bestScale = 0;
      const minCols = 2;
      const maxCols = Math.min(maxTrucks, 12);
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
  }, [isYard, garageId, trucksPerDay, containerSize.width, containerSize.height]);

  // Calculate scale to fit 5 areas horizontally
  const PADDING = 48;
  const GAP = 24;
  const totalGaps = 4 * GAP;
  const availableWidth = Math.max(0, containerSize.width - PADDING - totalGaps);
  const availableHeight = Math.max(0, containerSize.height - PADDING - 60);
  const scaleX = availableWidth / (5 * areaDimensions.width);
  const scaleY = availableHeight / areaDimensions.height;
  const scale = Math.max(1, Math.min(scaleX, scaleY));

  const svgWidth = areaDimensions.width * scale;
  const svgHeight = areaDimensions.height * scale;

  // Lane availability for drag feedback (garage areas only)
  const laneAvailability = useMemo(() => {
    if (!activeTruck || !enableDragDrop || isYard) return null;
    const avail: Record<string, { canFit: boolean; availableSpace: number; requiredSpace: number }> = {};
    LANES.forEach((laneId) => {
      const key = `${garageId}_${laneId}`;
      const todayTrucks = filterTrucksForDate(trucks, garageId as AreaId, today);
      avail[key] = calculateLaneAvailability(garageId as GarageId, laneId, todayTrucks, activeTruck.length, activeTruck.id);
    });
    return avail;
  }, [activeTruck, enableDragDrop, isYard, garageId, trucks, today]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const truck = event.active.data.current?.truck as PositionedTruck;
    setActiveTruck(truck);
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveTruck(null);
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
      setActiveTruck(null);
      lastDragPositionRef.current = null;

      if (!over || !onTruckMove) return;

      const truckId = active.id as string;
      const draggedTruck = trucks.find((t) => t.id === truckId);
      if (!draggedTruck) return;

      const dropData = over.data.current as { garageId?: GarageId; laneId?: LaneId } | undefined;
      if (!dropData?.garageId || !dropData?.laneId) return;

      const targetLaneId = dropData.laneId;

      let isDroppedInTopHalf = true;
      const activeRect = active.rect?.current?.translated;
      const overRect = over.rect;

      if (activeRect && overRect) {
        const truckCenterY = activeRect.top + activeRect.height / 2;
        const laneCenterY = overRect.top + overRect.height / 2;
        isDroppedInTopHalf = truckCenterY < laneCenterY;
      } else if (lastPosition && overRect) {
        const dropY = lastPosition.y;
        const laneCenterY = overRect.top + overRect.height / 2;
        isDroppedInTopHalf = dropY < laneCenterY;
      }

      const preferredSpotNum = isDroppedInTopHalf ? 1 : 2;

      const draggedTruckParsed = draggedTruck.spot ? parseSpot(draggedTruck.spot) : null;
      const draggedTruckCurrentSpot = draggedTruck.spot;

      if (
        draggedTruckParsed?.garage === garageId &&
        draggedTruckParsed?.lane === targetLaneId &&
        draggedTruckParsed?.spotNumber === preferredSpotNum
      ) {
        return;
      }

      const todayTrucks = filterTrucksForDate(trucks, garageId as AreaId, today);
      const spotToTruck = new Map<number, GarageTruck>();
      todayTrucks.forEach((t) => {
        if (!t.spot || t.id === truckId) return;
        const parsed = parseSpot(t.spot);
        if (parsed.garage === garageId && parsed.lane === targetLaneId && parsed.spotNumber) {
          spotToTruck.set(parsed.spotNumber, t);
        }
      });

      const truckAtPreferredSpot = spotToTruck.get(preferredSpotNum);

      if (truckAtPreferredSpot) {
        const newSpotForDragged = `${garageId}_${targetLaneId}_V${preferredSpotNum}`;
        const swapTargetSpot = draggedTruckCurrentSpot || null;

        const canSwap = calculateLaneAvailability(
          garageId as GarageId,
          targetLaneId,
          todayTrucks.filter((t) => t.id !== truckId && t.id !== truckAtPreferredSpot.id),
          draggedTruck.length,
        );

        if (!canSwap.canFit) return;

        if (onTruckSwap) {
          onTruckSwap(truckId, newSpotForDragged, truckAtPreferredSpot.id, swapTargetSpot);
        } else {
          onTruckMove(truckId, newSpotForDragged);
          onTruckMove(truckAtPreferredSpot.id, swapTargetSpot);
        }
        return;
      }

      const availability = calculateLaneAvailability(garageId as GarageId, targetLaneId, todayTrucks, draggedTruck.length, truckId);
      if (!availability.canFit) return;

      const newSpot = `${garageId}_${targetLaneId}_V${preferredSpotNum}`;
      onTruckMove(truckId, newSpot);
    },
    [trucks, garageId, today, onTruckMove, onTruckSwap],
  );

  const content = (
    <div className="w-full h-full overflow-auto p-6">
      {/* 5 day columns */}
      <div className="flex items-start justify-center gap-6">
        {trucksPerDay.map(({ date, trucks: dayTrucks, isToday: isDayToday }) => (
          <DayColumn
            key={date.toISOString()}
            areaId={garageId as AreaId}
            date={date}
            trucks={dayTrucks}
            patioColumns={areaDimensions.columns}
            scale={scale}
            svgWidth={svgWidth}
            svgHeight={svgHeight}
            isToday={isDayToday}
            enableDragDrop={isDayToday && enableDragDrop}
            onTruckClick={onTruckClick}
            activeTruck={activeTruck}
            laneAvailability={isDayToday ? laneAvailability : null}
            dimmed={!isDayToday}
          />
        ))}
      </div>
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
            {activeTruck ? (
              <div style={{ opacity: 0.8, cursor: 'grabbing' }}>
                <svg
                  width={COMMON_CONFIG.TRUCK_WIDTH_TOP_VIEW * scale}
                  height={activeTruck.length * scale}
                >
                  <TruckElement truck={{ ...activeTruck, xPosition: 0, yPosition: 0 }} scale={scale} />
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
