// Garage visualization component with drag-and-drop support
// Displays trucks positioned in garage lanes with SVG rendering

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
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

// =====================
// Constants
// =====================

// Individual garage configurations with real measurements
// All garages standardized to 20m × 35m for consistency with minimal waste
// Lane lengths: B1=30m, B2=25m, B3=30m
const GARAGE_CONFIGS = {
  B1: {
    width: 20, // meters (standardized)
    length: 35, // meters (standardized)
    paddingTop: 3, // meters - back margin from top
    paddingBottom: 2, // meters - front margin from bottom (35 - 3 - 30 = 2)
    laneLength: 30, // meters
    laneWidth: 3, // meters
    laneSpacing: (20 - 9) / 4, // 2.75m - equal spacing between and around lanes
    lanePaddingX: (20 - 9) / 4, // 2.75m - padding on left/right
  },
  B2: {
    width: 20, // meters (standardized)
    length: 35, // meters (standardized)
    paddingTop: 3, // meters - back margin from top
    paddingBottom: 7, // meters - front margin from bottom (35 - 3 - 25 = 7)
    laneLength: 25, // meters
    laneWidth: 3, // meters
    laneSpacing: (20 - 9) / 4, // 2.75m - equal spacing between and around lanes
    lanePaddingX: (20 - 9) / 4, // 2.75m - padding on left/right
  },
  B3: {
    width: 20, // meters (standardized)
    length: 35, // meters (standardized)
    paddingTop: 3, // meters - back margin from top
    paddingBottom: 2, // meters - front margin from bottom (35 - 3 - 30 = 2)
    laneLength: 30, // meters
    laneWidth: 3, // meters
    laneSpacing: (20 - 9) / 4, // 2.75m - equal spacing between and around lanes
    lanePaddingX: (20 - 9) / 4, // 2.75m - padding on left/right
  },
} as const;

// Common configuration for all garages
const COMMON_CONFIG = {
  TRUCK_MIN_SPACING: 1, // meters minimum between trucks
  TRUCK_MARGIN_TOP: 0.2, // meters from lane top to first truck
  TRUCK_WIDTH_TOP_VIEW: 2.5,
  MAX_TRUCKS_PER_LANE: 3,
  MIN_TRUCK_LENGTH: 5,
} as const;

// Patio-specific configuration
const PATIO_CONFIG = {
  PADDING: 1.5, // meters outer padding
  LANE_SPACING: 1.5, // meters between lanes
  TRUCK_MARGIN: 0.5, // margin inside lanes (top and bottom)
  MIN_LANES: 5, // minimum number of lanes in patio
  MIN_LANE_LENGTH: 25, // minimum lane length in meters
} as const;

// Colors for the garage visualization
// Using semi-transparent colors that work in both light and dark modes
const COLORS = {
  LANE_FILL: 'rgba(251, 191, 36, 0.15)', // Amber with transparency
  LANE_STROKE: 'rgba(217, 119, 6, 0.6)', // Darker amber with transparency
  LANE_HOVER: 'rgba(251, 191, 36, 0.25)', // Hover amber with transparency
  GARAGE_FILL: 'rgba(120, 113, 108, 0.08)', // Very light stone with transparency
  GARAGE_STROKE: 'rgba(120, 113, 108, 0.3)', // Garage border with transparency
  PATIO_FILL: 'rgba(56, 189, 248, 0.12)', // Light blue with transparency
  PATIO_STROKE: 'rgba(2, 132, 199, 0.5)', // Blue border with transparency
} as const;

// All navigable areas: PATIO first, then B1, B2, B3
const AREAS = ['PATIO', 'B1', 'B2', 'B3'] as const;
const LANES = ['F1', 'F2', 'F3'] as const;

type AreaId = (typeof AREAS)[number];
type GarageId = 'B1' | 'B2' | 'B3';
type LaneId = (typeof LANES)[number];

// =====================
// Types
// =====================

export interface GarageTruck {
  id: string;
  truckId?: string;
  spot: string | null;
  taskName?: string;
  serialNumber?: string | null;
  paintHex?: string | null;
  length: number; // Total length (with cabin if applicable)
  originalLength?: number; // Original length without cabin (for display)
  entryDate?: string | null; // Task entry date
  term?: string | null; // Task deadline
  forecastDate?: string | null; // Forecast date - when truck is expected to arrive at company
  finishedAt?: string | null; // Task completion date - null if not complete
  layoutInfo?: string | null; // Layout description
  artworkInfo?: string | null; // Artwork description
}

interface PositionedTruck extends GarageTruck {
  yPosition: number;
  xPosition: number;
}

interface LaneLayout {
  id: LaneId;
  xPosition: number;
  trucks: PositionedTruck[];
}

interface AreaLayout {
  id: AreaId;
  isPatio: boolean;
  lanes: LaneLayout[];
  patioTrucks?: PositionedTruck[];
}

// =====================
// Utility Functions
// =====================

function parseSpot(spot: string): { garage: GarageId | null; lane: LaneId | null; spotNumber: number | null } {
  if (spot === 'PATIO') return { garage: null, lane: null, spotNumber: null };
  const match = spot.match(/^B(\d)_F(\d)_V(\d)$/);
  if (!match) return { garage: null, lane: null, spotNumber: null };
  return {
    garage: `B${match[1]}` as GarageId,
    lane: `F${match[2]}` as LaneId,
    spotNumber: parseInt(match[3], 10),
  };
}

function calculateLaneXPosition(laneIndex: number, garageId: GarageId): number {
  const config = GARAGE_CONFIGS[garageId];
  return config.lanePaddingX + laneIndex * (config.laneWidth + config.laneSpacing);
}

function calculateGarageWidth(garageId: GarageId): number {
  const config = GARAGE_CONFIGS[garageId];
  return config.width;
}

// Calculate if a truck can fit in a lane by SWAPPING with an existing truck
// This is used for visual preview during drag when hovering over occupied spots
function calculateSwapAvailability(
  garageId: GarageId,
  laneId: LaneId,
  trucks: GarageTruck[],
  draggedTruckLength: number,
  draggedTruckId: string,
  swapTargetTruckId: string
): boolean {
  const config = GARAGE_CONFIGS[garageId];
  const laneLength = config.laneLength;

  // Find all trucks in this lane EXCLUDING both the dragged truck AND the swap target
  const trucksInLaneAfterSwap = trucks.filter(t => {
    if (t.id === draggedTruckId || t.id === swapTargetTruckId) return false;
    if (!t.spot || t.spot === 'PATIO') return false;
    const parsed = parseSpot(t.spot);
    return parsed.garage === garageId && parsed.lane === laneId;
  });

  // Calculate space after swap (remaining trucks + dragged truck)
  const currentTruckLengths = trucksInLaneAfterSwap.reduce((sum, truck) => sum + truck.length, 0);
  const newTotalTruckLengths = currentTruckLengths + draggedTruckLength;
  const margins = 2 * COMMON_CONFIG.TRUCK_MARGIN_TOP;
  const newTruckCount = trucksInLaneAfterSwap.length + 1;

  let gapsBetweenTrucks = 0;
  if (newTruckCount === 3) {
    gapsBetweenTrucks = 2 * COMMON_CONFIG.TRUCK_MIN_SPACING;
  }

  const totalRequiredSpace = margins + newTotalTruckLengths + gapsBetweenTrucks;
  return totalRequiredSpace <= laneLength && trucksInLaneAfterSwap.length < 3;
}

// Calculate available space in a lane and whether a truck can fit
function calculateLaneAvailability(
  garageId: GarageId,
  laneId: LaneId,
  trucks: GarageTruck[],
  truckLength: number,
  excludeTruckId?: string
): { canFit: boolean; availableSpace: number; requiredSpace: number } {
  const config = GARAGE_CONFIGS[garageId];
  const laneLength = config.laneLength;

  // Find all trucks in this lane (excluding the truck being dragged)
  const trucksInLane = trucks.filter(t => {
    if (t.id === excludeTruckId) return false;
    if (!t.spot || t.spot === 'PATIO') return false;
    const parsed = parseSpot(t.spot);
    return parsed.garage === garageId && parsed.lane === laneId;
  });

  // Calculate what would be occupied if we add the new truck:
  // IMPORTANT: The gap logic depends on how many trucks we'll have:
  // - 0 trucks -> 1 truck: No gaps, just margins (top + bottom)
  // - 1 truck -> 2 trucks: No mandatory gaps! V1 goes to top, V2 goes to bottom with just margins
  // - 2 trucks -> 3 trucks: NOW we need gaps (V1 top, V2 middle, V3 bottom)
  //   - V2 in middle requires: 1m gap from V1, 1m gap from V3

  // Use full truck length (including cabin) for garage space calculation
  // The cabin is part of the truck and cannot be removed
  const currentTruckLengths = trucksInLane.reduce((sum, truck) => {
    return sum + truck.length;
  }, 0);
  const newTotalTruckLengths = currentTruckLengths + truckLength;
  const margins = 2 * COMMON_CONFIG.TRUCK_MARGIN_TOP; // 0.4m total (always constant)
  const newTruckCount = trucksInLane.length + 1;

  let gapsBetweenTrucks = 0;
  if (newTruckCount === 3) {
    // 3 trucks: V1-top, V2-middle, V3-bottom
    // Need 2 gaps: V1->V2 and V2->V3
    gapsBetweenTrucks = 2 * COMMON_CONFIG.TRUCK_MIN_SPACING; // 2m total
  } else if (newTruckCount === 2) {
    // 2 trucks: V1-top, V2-bottom
    // NO mandatory gap - they just need to not overlap
    gapsBetweenTrucks = 0;
  } else {
    // 1 truck: just margins
    gapsBetweenTrucks = 0;
  }

  const totalRequiredSpace = margins + newTotalTruckLengths + gapsBetweenTrucks;

  // Calculate how much space is currently available
  // CRITICAL: Current gaps must match the positioning logic
  // - 1 truck: 0 gaps (just V1 at top)
  // - 2 trucks: 0 gaps (V1 at top, V2 at bottom, no mandatory gap between)
  // - 3 trucks: 2m gaps (V1 top, V2 middle with 1m from V1 and 1m from V3, V3 bottom)
  let currentGaps = 0;
  if (trucksInLane.length === 3) {
    currentGaps = 2 * COMMON_CONFIG.TRUCK_MIN_SPACING; // 3 trucks = need gaps for middle truck
  } else {
    currentGaps = 0; // 1 or 2 trucks = no gaps
  }
  const currentOccupied = margins + currentTruckLengths + currentGaps;
  const availableSpace = Math.max(0, laneLength - currentOccupied);

  // Can fit if total required space fits in lane AND not at max capacity (3 trucks)
  const canFit = totalRequiredSpace <= laneLength && trucksInLane.length < 3;

  const requiredSpace = truckLength;

  // DETAILED DEBUG LOGGING

  return { canFit, availableSpace, requiredSpace };
}

function calculateAreaLayout(areaId: AreaId, trucks: GarageTruck[], patioColumns: number): AreaLayout {
  const isPatio = areaId === 'PATIO';

  if (isPatio) {
    // Patio - show all trucks without a spot or with PATIO spot in a responsive grid
    const patioTrucksList = trucks
      .filter((t) => !t.spot || t.spot === 'PATIO')
      .sort((a, b) => b.length - a.length); // Sort by length descending (longest first)

    const cols = patioColumns;

    // Lane dimensions for patio - using PATIO_CONFIG for consistent spacing
    const laneWidth = COMMON_CONFIG.TRUCK_WIDTH_TOP_VIEW + 0.4;
    const laneSpacing = PATIO_CONFIG.LANE_SPACING;
    const padding = PATIO_CONFIG.PADDING;
    const truckMargin = PATIO_CONFIG.TRUCK_MARGIN;
    const minLaneLength = PATIO_CONFIG.MIN_LANE_LENGTH;
    const truckOffset = (laneWidth - COMMON_CONFIG.TRUCK_WIDTH_TOP_VIEW) / 2;

    // First pass: calculate content heights per column (trucks + margins)
    const columnContentHeights: number[] = Array(cols).fill(truckMargin);
    patioTrucksList.forEach((truck, index) => {
      const col = index % cols;
      columnContentHeights[col] += truck.length + COMMON_CONFIG.TRUCK_MIN_SPACING;
    });

    // Calculate actual content height (replace last spacing with bottom margin)
    const maxContentHeight = patioTrucksList.length > 0
      ? Math.max(...columnContentHeights) - COMMON_CONFIG.TRUCK_MIN_SPACING + truckMargin
      : truckMargin * 2;

    // Apply minimum lane length (25m)

    // Trucks positioned at top with just truckMargin, extra space goes to bottom
    const topOffset = 0;

    // Second pass: position trucks with centering offset
    const patioTrucks = patioTrucksList.map((truck, index) => {
      const col = index % cols;

      // Calculate cumulative Y position for this column
      let yPos = padding + truckMargin + topOffset;
      for (let i = col; i < index; i += cols) {
        yPos += patioTrucksList[i].length + COMMON_CONFIG.TRUCK_MIN_SPACING;
      }

      // X position centered in lane
      const laneX = padding + col * (laneWidth + laneSpacing);
      const xPos = laneX + truckOffset;


      if (index < 3 || index >= patioTrucksList.length - 3) {
        
      }

      return {
        ...truck,
        xPosition: xPos,
        yPosition: yPos,
      };
    });

    return {
      id: areaId,
      isPatio: true,
      lanes: [],
      patioTrucks,
    };
  }

  // Regular garage
  const garageId = areaId as GarageId;
  const config = GARAGE_CONFIGS[garageId];
  const garageTrucks = trucks.filter((t) => {
    if (!t.spot) return false;
    const parsed = parseSpot(t.spot);
    return parsed.garage === garageId;
  });

  const lanes: LaneLayout[] = LANES.map((laneId, index) => {
    const laneTrucks = garageTrucks
      .filter((t) => {
        const parsed = parseSpot(t.spot!);
        return parsed.lane === laneId;
      })
      .sort((a, b) => {
        const aSpot = parseSpot(a.spot!);
        const bSpot = parseSpot(b.spot!);
        return (aSpot.spotNumber || 0) - (bSpot.spotNumber || 0);
      });

    // Center truck horizontally in lane
    const truckOffset = (config.laneWidth - COMMON_CONFIG.TRUCK_WIDTH_TOP_VIEW) / 2;

    // Position trucks based on their SPOT NUMBER (V1, V2, V3)
    // V1: Always top aligned
    // V2: Bottom aligned when alone, middle when V3 exists
    // V3: Always bottom aligned
    const v1Truck = laneTrucks.find(t => parseSpot(t.spot!).spotNumber === 1);
    const v3Truck = laneTrucks.find(t => parseSpot(t.spot!).spotNumber === 3);

    const positionedTrucks: PositionedTruck[] = laneTrucks.map((truck) => {
      const parsed = parseSpot(truck.spot!);
      const spotNumber = parsed.spotNumber || 1;

      let yPosition: number;

      if (spotNumber === 1) {
        // V1: Always top aligned
        yPosition = COMMON_CONFIG.TRUCK_MARGIN_TOP;
      } else if (spotNumber === 3) {
        // V3: Always bottom aligned
        yPosition = config.laneLength - COMMON_CONFIG.TRUCK_MARGIN_TOP - truck.length;
      } else {
        // V2: Bottom aligned when alone, middle when V3 exists
        if (v3Truck) {
          // V2 with V3: position in the middle
          const v1Bottom = v1Truck
            ? COMMON_CONFIG.TRUCK_MARGIN_TOP + v1Truck.length + COMMON_CONFIG.TRUCK_MIN_SPACING
            : COMMON_CONFIG.TRUCK_MARGIN_TOP;
          const v3Top = config.laneLength - COMMON_CONFIG.TRUCK_MARGIN_TOP - v3Truck.length - COMMON_CONFIG.TRUCK_MIN_SPACING;
          // Center V2 between V1's bottom and V3's top
          yPosition = v1Bottom + (v3Top - v1Bottom - truck.length) / 2;
        } else {
          // V2 alone: bottom aligned (same logic as V3)
          yPosition = config.laneLength - COMMON_CONFIG.TRUCK_MARGIN_TOP - truck.length;
        }
      }

      return {
        ...truck,
        yPosition,
        xPosition: calculateLaneXPosition(index, garageId) + truckOffset,
      };
    });

    return {
      id: laneId,
      xPosition: calculateLaneXPosition(index, garageId),
      trucks: positionedTrucks,
    };
  });

  return { id: areaId, isPatio: false, lanes };
}

// =====================
// Sub-components
// =====================

interface TruckElementProps {
  truck: PositionedTruck;
  scale: number;
  isDragging?: boolean;
  onClick?: () => void;
}

function TruckElement({ truck, scale, isDragging, onClick }: TruckElementProps) {
  const width = COMMON_CONFIG.TRUCK_WIDTH_TOP_VIEW * scale;
  const height = truck.length * scale;
  const x = truck.xPosition * scale;
  const y = truck.yPosition * scale;
  const bgColor = truck.paintHex || '#ffffff';

  // Generate unique ID for clip path
  const clipId = `truck-clip-${truck.id}`;

  // Determine text color based on background brightness
  const getBrightness = (hex: string) => {
    const rgb = parseInt(hex.slice(1), 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = rgb & 0xff;
    return (r * 299 + g * 587 + b * 114) / 1000;
  };
  const textColor = getBrightness(bgColor) > 128 ? '#000000' : '#ffffff';

  // Truncate task name to fit within truck height (accounting for rotation)
  // The rotated text width becomes the height constraint
  const maxChars = Math.max(3, Math.floor((height - 24) / 7)); // Leave space for top/bottom labels
  const displayName = truck.taskName
    ? truck.taskName.length > maxChars
      ? truck.taskName.slice(0, maxChars - 2) + '..'
      : truck.taskName
    : 'N/A';

  // Display original length (without cabin) if available
  const displayLength = truck.originalLength ?? truck.length;

  // Only show serial number if there's enough height
  const showSerialNumber = height > 50 && truck.serialNumber;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      className={onClick ? 'cursor-pointer' : 'cursor-grab'}
      style={{ opacity: isDragging ? 0 : 1 }}
      onClick={onClick}
    >
      {/* Define clip path to prevent text overflow */}
      <defs>
        <clipPath id={clipId}>
          <rect width={width} height={height} rx={3} />
        </clipPath>
      </defs>

      {/* Truck body */}
      <rect
        width={width}
        height={height}
        fill={bgColor}
        stroke="#333"
        strokeWidth={1.5}
        rx={3}
      />

      {/* Content group with clipping */}
      <g clipPath={`url(#${clipId})`}>
        {/* Task name (rotated 90deg) */}
        <text
          x={width / 2}
          y={height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={textColor}
          fontSize={10}
          fontWeight="bold"
          transform={`rotate(-90, ${width / 2}, ${height / 2})`}
          style={{ pointerEvents: 'none' }}
        >
          {displayName}
        </text>
        {/* Length label at top - show original length */}
        <text
          x={width / 2}
          y={12}
          textAnchor="middle"
          fill={textColor}
          fontSize={8}
          style={{ pointerEvents: 'none' }}
        >
          {displayLength.toFixed(1).replace('.', ',')}m
        </text>
        {/* Serial number label at bottom - only if enough space */}
        {showSerialNumber && (
          <text
            x={width / 2}
            y={height - 6}
            textAnchor="middle"
            fill={textColor}
            fontSize={8}
            style={{ pointerEvents: 'none' }}
          >
            {truck.serialNumber}
          </text>
        )}
      </g>
    </g>
  );
}

interface DraggableTruckProps {
  truck: PositionedTruck;
  scale: number;
  disabled?: boolean;
  onClick?: () => void;
}

function DraggableTruck({ truck, scale, disabled = false, onClick }: DraggableTruckProps) {
  const [isHovering, setIsHovering] = useState(false);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: truck.id,
    data: { truck },
    disabled,
  });

  // Store hover state globally so we can render tooltips in a separate layer
  useEffect(() => {
    if (isHovering && !isDragging) {
      // Dispatch custom event with truck info for tooltip rendering
      const event = new CustomEvent('truck-hover', { detail: { truck, scale } });
      window.dispatchEvent(event);
    } else {
      const event = new CustomEvent('truck-hover', { detail: null });
      window.dispatchEvent(event);
    }
  }, [isHovering, isDragging, truck, scale]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    // Only trigger click if not currently dragging
    if (!isDragging && onClick) {
      e.stopPropagation();
      onClick();
    }
  }, [isDragging, onClick]);

  return (
    <g
      ref={setNodeRef}
      {...(disabled ? {} : listeners)}
      {...attributes}
      style={{ cursor: disabled ? 'default' : onClick ? 'pointer' : 'grab' }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onClick={handleClick}
    >
      <TruckElement truck={truck} scale={scale} isDragging={isDragging} />
      {/* Invisible larger hitbox for better tooltip activation */}
      <rect
        x={truck.xPosition * scale - 5}
        y={truck.yPosition * scale - 5}
        width={COMMON_CONFIG.TRUCK_WIDTH_TOP_VIEW * scale + 10}
        height={truck.length * scale + 10}
        fill="transparent"
        style={{ pointerEvents: 'all' }}
      />
    </g>
  );
}

interface DroppableLaneProps {
  garageId: GarageId;
  laneId: LaneId;
  xPosition: number;
  scale: number;
  laneY: number;
  showLabel?: boolean;
  canFit?: boolean;
  availableSpace?: number;
  requiredSpace?: number;
  isDragging?: boolean;
  draggedTruckLength?: number;
  draggedTruckId?: string;
  trucks?: GarageTruck[];
  children: React.ReactNode;
}

function DroppableLane({ garageId, laneId, xPosition, scale, laneY, showLabel = true, canFit, availableSpace, requiredSpace: _requiredSpace, isDragging = false, draggedTruckLength, draggedTruckId, trucks, children }: DroppableLaneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${garageId}_${laneId}`,
    data: { garageId, laneId },
  });

  const config = GARAGE_CONFIGS[garageId];
  const x = xPosition * scale;
  const y = laneY * scale;
  const width = config.laneWidth * scale;
  const height = config.laneLength * scale;

  // Calculate where the dragged truck would be placed in this lane
  // Support multiple previews for small trucks and swap indicators for occupied spots
  let previews: Array<{ y: number; height: number; color: 'green' | 'red' }> = [];

  if (isDragging && draggedTruckLength && trucks && draggedTruckId) {
    // Get trucks currently in this lane (excluding the dragged truck)
    const trucksInLane = trucks.filter((t) => {
      if (t.id === draggedTruckId) return false;
      if (!t.spot || t.spot === 'PATIO') return false;
      const parsed = parseSpot(t.spot);
      return parsed.garage === garageId && parsed.lane === laneId;
    });

    const laneLength = config.laneLength;
    const spotNumbers = trucksInLane.map(t => parseSpot(t.spot!).spotNumber!).filter(Boolean).sort();
    const isLargeTruck = draggedTruckLength > laneLength * 0.5;

    // Determine color for adding (not swapping) based on canFit
    const addPreviewColor: 'green' | 'red' = canFit === false ? 'red' : 'green';

    // Helper to calculate swap color for a specific truck
    const getSwapColor = (swapTargetTruck: GarageTruck): 'green' | 'red' => {
      const canSwap = calculateSwapAvailability(
        garageId,
        laneId,
        trucks,
        draggedTruckLength,
        draggedTruckId,
        swapTargetTruck.id
      );
      return canSwap ? 'green' : 'red';
    };

    // Case 1: Large truck (>50% lane) - show indicators on occupied spots (swap) or entire lane (add)
    if (isLargeTruck) {
      if (trucksInLane.length > 0) {
        // Lane has trucks - show swap indicators on EACH existing truck position
        // Preview shows the DRAGGED truck's size at the target position
        trucksInLane.forEach(existingTruck => {
          const parsed = parseSpot(existingTruck.spot!);
          const swapColor = getSwapColor(existingTruck);

          // Show preview of dragged truck at the spot position
          if (parsed.spotNumber === 1) {
            // V1 - at top - show dragged truck preview
            previews.push({
              y: COMMON_CONFIG.TRUCK_MARGIN_TOP,
              height: draggedTruckLength,
              color: swapColor,
            });
          } else if (parsed.spotNumber === 2) {
            // V2 - at bottom - show dragged truck preview
            previews.push({
              y: laneLength - COMMON_CONFIG.TRUCK_MARGIN_TOP - draggedTruckLength,
              height: draggedTruckLength,
              color: swapColor,
            });
          } else if (parsed.spotNumber === 3) {
            // V3 - in middle (between V1 and V2)
            const v1Truck = trucksInLane.find(t => parseSpot(t.spot!).spotNumber === 1);
            const v2Truck = trucksInLane.find(t => parseSpot(t.spot!).spotNumber === 2);
            if (v1Truck && v2Truck) {
              const v1Bottom = COMMON_CONFIG.TRUCK_MARGIN_TOP + v1Truck.length + COMMON_CONFIG.TRUCK_MIN_SPACING;
              const v2Top = laneLength - COMMON_CONFIG.TRUCK_MARGIN_TOP - v2Truck.length - COMMON_CONFIG.TRUCK_MIN_SPACING;
              previews.push({
                y: v1Bottom + (v2Top - v1Bottom - draggedTruckLength) / 2,
                height: draggedTruckLength,
                color: swapColor,
              });
            }
          }
        });

        // Also show indicator for empty spots if any
        if (trucksInLane.length < 2) {
          // Can still add to lane - show empty spot preview
          if (!spotNumbers.includes(1)) {
            // V1 is empty
            previews.push({
              y: COMMON_CONFIG.TRUCK_MARGIN_TOP,
              height: draggedTruckLength,
              color: addPreviewColor,
            });
          } else if (!spotNumbers.includes(2)) {
            // V2 is empty
            previews.push({
              y: laneLength - COMMON_CONFIG.TRUCK_MARGIN_TOP - draggedTruckLength,
              height: draggedTruckLength,
              color: addPreviewColor,
            });
          }
        }
      } else {
        // Empty lane - show entire lane preview
        previews.push({
          y: 0,
          height: laneLength,
          color: addPreviewColor,
        });
      }
    }
    // Case 2: Small truck (<= 50% lane)
    else if (!isLargeTruck) {
      // Empty lane - show TWO possible spots (V1 and V2)
      if (spotNumbers.length === 0) {
        // Show V1 (top) and V2 (bottom) previews
        previews.push(
          {
            y: COMMON_CONFIG.TRUCK_MARGIN_TOP,
            height: draggedTruckLength,
            color: addPreviewColor,
          },
          {
            y: laneLength - COMMON_CONFIG.TRUCK_MARGIN_TOP - draggedTruckLength,
            height: draggedTruckLength,
            color: addPreviewColor,
          }
        );
      } else if (spotNumbers.length === 1) {
        // One truck exists - show available spot AND swap indicator on occupied spot
        const existingTruck = trucksInLane[0];
        const swapColor = getSwapColor(existingTruck);

        if (spotNumbers[0] === 1) {
          // V1 exists - show swap indicator on V1 (with dragged truck size) and add indicator on V2
          previews.push({
            y: COMMON_CONFIG.TRUCK_MARGIN_TOP,
            height: draggedTruckLength,
            color: swapColor,
          });
          previews.push({
            y: laneLength - COMMON_CONFIG.TRUCK_MARGIN_TOP - draggedTruckLength,
            height: draggedTruckLength,
            color: addPreviewColor,
          });
        } else {
          // V2 or V3 exists - show add indicator on V1 and swap indicator on occupied spot
          previews.push({
            y: COMMON_CONFIG.TRUCK_MARGIN_TOP,
            height: draggedTruckLength,
            color: addPreviewColor,
          });
          previews.push({
            y: laneLength - COMMON_CONFIG.TRUCK_MARGIN_TOP - draggedTruckLength,
            height: draggedTruckLength,
            color: swapColor,
          });
        }
      } else if (spotNumbers.length === 2) {
        // 2 trucks exist - show swap indicators on occupied spots and add indicator on empty spot
        const v1Truck = trucksInLane.find(t => parseSpot(t.spot!).spotNumber === 1);
        const v2Truck = trucksInLane.find(t => parseSpot(t.spot!).spotNumber === 2);
        const v3Truck = trucksInLane.find(t => parseSpot(t.spot!).spotNumber === 3);

        // Determine positions based on which trucks exist
        // V1 always at top, V3 always at bottom, V2 at bottom (if no V3) or middle (if V3 exists)

        // V1 swap indicator (always at top)
        if (v1Truck) {
          previews.push({
            y: COMMON_CONFIG.TRUCK_MARGIN_TOP,
            height: draggedTruckLength,
            color: getSwapColor(v1Truck),
          });
        }

        // V2 swap indicator - position depends on whether V3 exists
        if (v2Truck) {
          if (v3Truck) {
            // V2 is in MIDDLE when V3 exists
            const v1Bottom = v1Truck
              ? COMMON_CONFIG.TRUCK_MARGIN_TOP + v1Truck.length + COMMON_CONFIG.TRUCK_MIN_SPACING
              : COMMON_CONFIG.TRUCK_MARGIN_TOP;
            const v3Top = laneLength - COMMON_CONFIG.TRUCK_MARGIN_TOP - v3Truck.length - COMMON_CONFIG.TRUCK_MIN_SPACING;
            previews.push({
              y: v1Bottom + (v3Top - v1Bottom - draggedTruckLength) / 2,
              height: draggedTruckLength,
              color: getSwapColor(v2Truck),
            });
          } else {
            // V2 is at BOTTOM when no V3
            previews.push({
              y: laneLength - COMMON_CONFIG.TRUCK_MARGIN_TOP - draggedTruckLength,
              height: draggedTruckLength,
              color: getSwapColor(v2Truck),
            });
          }
        }

        // V3 swap indicator (always at bottom)
        if (v3Truck) {
          previews.push({
            y: laneLength - COMMON_CONFIG.TRUCK_MARGIN_TOP - draggedTruckLength,
            height: draggedTruckLength,
            color: getSwapColor(v3Truck),
          });
        }

        // Show add indicator for empty spot
        if (!spotNumbers.includes(1)) {
          // V1 is empty - show at top
          previews.push({
            y: COMMON_CONFIG.TRUCK_MARGIN_TOP,
            height: draggedTruckLength,
            color: addPreviewColor,
          });
        } else if (!spotNumbers.includes(2)) {
          // V2 is free - position depends on whether V1 and V3 exist
          if (v1Truck && v3Truck) {
            // V2 goes in middle between V1 and V3
            const v1Bottom = COMMON_CONFIG.TRUCK_MARGIN_TOP + v1Truck.length + COMMON_CONFIG.TRUCK_MIN_SPACING;
            const v3Top = laneLength - COMMON_CONFIG.TRUCK_MARGIN_TOP - v3Truck.length - COMMON_CONFIG.TRUCK_MIN_SPACING;
            previews.push({
              y: v1Bottom + (v3Top - v1Bottom - draggedTruckLength) / 2,
              height: draggedTruckLength,
              color: addPreviewColor,
            });
          }
        }
        // NOTE: V3 add indicator is intentionally NOT shown when V1+V2 are occupied.
        // V2 is at the bottom (same position as V3 would be), so the V3 add indicator
        // would overlap the V2 swap indicator, hiding its green/red color.
      }
    }
  }

  return (
    <g ref={setNodeRef}>
      {/* Lane background - always neutral color */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={isOver && isDragging ? COLORS.LANE_HOVER : COLORS.LANE_FILL}
        stroke={COLORS.LANE_STROKE}
        strokeWidth={2}
        rx={3}
      />

      {/* Preview rectangles - shows where truck will be placed */}
      {previews.map((preview, index) => {
        const isGreen = preview.color === 'green';
        // If multiple previews, show truck length on each
        // If single preview, show available space
        const displayText = previews.length > 1
          ? (draggedTruckLength ? draggedTruckLength.toFixed(1).replace('.', ',') + 'm' : '')
          : (availableSpace !== undefined ? availableSpace.toFixed(1).replace('.', ',') + 'm' : '');

        return (
          <g key={index}>
            <rect
              x={x}
              y={y + preview.y * scale}
              width={width}
              height={preview.height * scale}
              fill={isGreen ? '#86efac' : '#fca5a5'} // green-300 : red-300
              fillOpacity={isOver ? 0.7 : 0.4}
              stroke={isGreen ? '#10b981' : '#ef4444'} // green-500 : red-500
              strokeWidth={2}
              rx={2}
            />
            {/* Show text */}
            {displayText && (
              <text
                x={x + width / 2}
                y={y + preview.y * scale + (preview.height * scale / 2)}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={10}
                fontWeight="600"
                fill={isGreen ? '#15803d' : '#b91c1c'}
              >
                {displayText}
              </text>
            )}
          </g>
        );
      })}

      {/* Lane label - only show if showLabel is true */}
      {showLabel && (
        <text
          x={x + width / 2}
          y={config.length * scale + 14}
          textAnchor="middle"
          fontSize={10}
          fontWeight="bold"
          fill="#78716C"
        >
          {laneId}
        </text>
      )}
      {/* Trucks positioned relative to lane top */}
      <g transform={`translate(0, ${y})`}>
        {children}
      </g>
    </g>
  );
}

interface DroppablePatioProps {
  scale: number;
  width: number;
  height: number;
  columns: number;
  children: React.ReactNode;
}

function DroppablePatio({ scale, width, height, columns, children }: DroppablePatioProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'PATIO',
    data: { isPatio: true },
  });

  const laneWidth = COMMON_CONFIG.TRUCK_WIDTH_TOP_VIEW + 0.4;
  const laneSpacing = PATIO_CONFIG.LANE_SPACING;
  const padding = PATIO_CONFIG.PADDING;

  return (
    <g ref={setNodeRef}>
      {/* Patio background */}
      <rect
        x={0}
        y={0}
        width={width * scale}
        height={height * scale}
        fill={isOver ? COLORS.LANE_HOVER : COLORS.GARAGE_FILL}
        stroke={COLORS.PATIO_STROKE}
        strokeWidth={2}
        rx={4}
      />
      {/* Visual lane columns - yellow like garage lanes */}
      {Array.from({ length: columns }).map((_, i) => {
        const laneX = padding + i * (laneWidth + laneSpacing);
        return (
          <rect
            key={i}
            x={laneX * scale}
            y={padding * scale}
            width={laneWidth * scale}
            height={(height - padding * 2) * scale}
            fill={COLORS.LANE_FILL}
            stroke={COLORS.LANE_STROKE}
            strokeWidth={1.5}
            rx={3}
          />
        );
      })}
      {children}
    </g>
  );
}

// =====================
// Week View Component (Timeline/Gantt Style)
// =====================

// =====================
// Tooltip Layer Component (renders on top)
// =====================

// =====================
// Utility Functions
// =====================

function getAreaTitle(areaId: AreaId) {
  if (areaId === 'PATIO') return 'Pátio';
  return `Barracão ${areaId.slice(1)}`;
}

// =====================
// All Garages View Component
// =====================

interface AllGaragesViewProps {
  trucks: GarageTruck[];
  containerWidth: number;
  containerHeight: number;
  garageCounts: Record<AreaId, number>;
  viewMode?: 'all' | 'week';
  onTruckMove?: (truckId: string, newSpot: string) => void;
  onTruckSwap?: (truck1Id: string, spot1: string, truck2Id: string, spot2: string) => void;
  onTruckClick?: (taskId: string) => void;
  readOnly?: boolean;
}

function AllGaragesView({ trucks, containerWidth, containerHeight, garageCounts, viewMode = 'all', onTruckMove, onTruckSwap, onTruckClick, readOnly = false }: AllGaragesViewProps) {
  // Show all 4 areas (including PATIO/yard) in both Grade and Calendar views
  const areasToShow = AREAS;

  // Calculate patio columns dynamically based on truck count (same logic as dimensions calculation)
  // Target: ~3-4 trucks per column for optimal layout
  const patioTrucks = trucks.filter(t => !t.spot || t.spot === 'PATIO');
  const patioColumns = Math.max(5, Math.ceil(patioTrucks.length / 3));

  // Drag-and-drop state
  const [activeTruck, setActiveTruck] = useState<PositionedTruck | null>(null);
  const [_activeDropTarget, setActiveDropTarget] = useState<{ garageId: GarageId; laneId: LaneId } | null>(null);
  const lastDragPositionRef = useRef<{ x: number; y: number } | null>(null);

  // Enable drag-and-drop only when viewMode === 'all' and onTruckMove is provided
  const enableDragDrop = viewMode === 'all' && !readOnly && !!onTruckMove;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const allAreaLayouts = useMemo(() => {
    return areasToShow.map(areaId => ({
      areaId,
      layout: calculateAreaLayout(areaId, trucks, patioColumns)
    }));
  }, [trucks, areasToShow]);

  // Calculate dimensions for each area
  const areaDimensions = useMemo(() => {
    return allAreaLayouts.map(({ areaId, layout }) => {
      if (layout.isPatio) {
        const patioTrucks = trucks.filter(t => !t.spot || t.spot === 'PATIO');
        const patioTrucksSorted = [...patioTrucks].sort((a, b) => b.length - a.length);
        const columns = Math.max(5, Math.ceil(patioTrucks.length / 3));

        // CORRECT PATIO WIDTH CALCULATION - must include lane spacing between columns!
        const laneWidth = COMMON_CONFIG.TRUCK_WIDTH_TOP_VIEW + 0.4;
        const laneSpacing = PATIO_CONFIG.LANE_SPACING;
        const padding = PATIO_CONFIG.PADDING;
        const width = padding * 2 + columns * laneWidth + (columns - 1) * laneSpacing;

        // CORRECT PATIO HEIGHT CALCULATION - calculate actual column heights!
        // Trucks are distributed across columns and stacked vertically
        const truckMargin = PATIO_CONFIG.TRUCK_MARGIN;
        const minLaneLength = PATIO_CONFIG.MIN_LANE_LENGTH;

        // Calculate content height for each column
        const columnContentHeights: number[] = Array(columns).fill(truckMargin);
        patioTrucksSorted.forEach((truck, index) => {
          const col = index % columns;
          columnContentHeights[col] += truck.length + COMMON_CONFIG.TRUCK_MIN_SPACING;
        });

        // Get max column height (replace last spacing with bottom margin)
        const maxContentHeight = patioTrucks.length > 0
          ? Math.max(...columnContentHeights) - COMMON_CONFIG.TRUCK_MIN_SPACING + truckMargin
          : truckMargin * 2;

        // Apply minimum lane length and add padding
        const height = Math.max(maxContentHeight, minLaneLength) + padding * 2;

        return { areaId, width, height };
      } else {
        const config = GARAGE_CONFIGS[areaId as GarageId];
        return { areaId, width: config.width, height: config.length };
      }
    });
  }, [allAreaLayouts, trucks]);

  // Calculate uniform scale for all areas
  // The AllGaragesView container has:
  // - Outer div: p-6 (24px padding on all sides)
  // - Inner div: gap-10 (40px gap between garages)
  // - Each SVG: +10px extra space (+5px on each side from translate)

  const SVG_EXTRA_SPACE = 10; // Extra 10px per SVG (5px padding on each side)
  const CONTAINER_PADDING = 48; // p-6 = 24px on each side = 48px total horizontal
  const GAP_BETWEEN_GARAGES = 40; // gap-10 = 40px

  const totalGaps = (areasToShow.length - 1) * GAP_BETWEEN_GARAGES;
  const totalSvgExtras = areasToShow.length * SVG_EXTRA_SPACE;

  // Available space calculation
  const availableWidth = Math.max(0, containerWidth - CONTAINER_PADDING - totalGaps - totalSvgExtras);
  const availableHeight = Math.max(0, containerHeight - CONTAINER_PADDING - 80); // Extra vertical space for titles

  // Calculate total natural width and max height
  const totalNaturalWidth = areaDimensions.reduce((sum, dim) => sum + dim.width, 0);
  const maxHeight = Math.max(...areaDimensions.map((dim) => dim.height));

  // Calculate uniform scale - ensure it fits both width and height
  // Remove restrictive cap to allow garages to use available space
  const scaleX = totalNaturalWidth > 0 ? availableWidth / totalNaturalWidth : 1;
  const scaleY = maxHeight > 0 ? availableHeight / maxHeight : 1;
  const uniformScale = Math.max(1, Math.min(scaleX, scaleY)); // Minimum scale of 1, no upper cap


  // Calculate lane availability for visual feedback during drag
  const laneAvailabilityByGarage = useMemo(() => {
    if (!activeTruck || !enableDragDrop) return null;

    const availability: Record<string, { canFit: boolean; availableSpace: number; requiredSpace: number }> = {};
    const truckGarageLength = activeTruck.length;

    (['B1', 'B2', 'B3'] as GarageId[]).forEach(garageId => {
      LANES.forEach(laneId => {
        const key = `${garageId}_${laneId}`;
        availability[key] = calculateLaneAvailability(
          garageId,
          laneId,
          trucks,
          truckGarageLength,
          activeTruck.id
        );
      });
    });

    return availability;
  }, [activeTruck, enableDragDrop, trucks]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const truck = active.data.current?.truck as PositionedTruck;
    setActiveTruck(truck);
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveTruck(null);
    setActiveDropTarget(null);
    lastDragPositionRef.current = null;
  }, []);

  // Track drag position for determining drop location within lane
  const handleDragMove = useCallback((event: DragMoveEvent) => {
    const { over, activatorEvent, delta } = event;

    // Calculate CURRENT mouse position: original position + delta
    // activatorEvent gives the original position, delta gives how much we've moved
    if (activatorEvent && 'clientY' in activatorEvent && delta) {
      const originalY = (activatorEvent as PointerEvent).clientY;
      const originalX = (activatorEvent as PointerEvent).clientX;
      lastDragPositionRef.current = {
        x: originalX + delta.x,
        y: originalY + delta.y,
      };
    }

    // Track current drop target
    if (over) {
      const dropData = over.data.current as { garageId?: GarageId; laneId?: LaneId; isPatio?: boolean } | undefined;
      if (dropData?.garageId && dropData?.laneId) {
        setActiveDropTarget({ garageId: dropData.garageId, laneId: dropData.laneId });
      } else {
        setActiveDropTarget(null);
      }
    } else {
      setActiveDropTarget(null);
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      const lastPosition = lastDragPositionRef.current;
      setActiveTruck(null);
      setActiveDropTarget(null);
      lastDragPositionRef.current = null;

      if (!over || !onTruckMove) return;

      const truckId = active.id as string;
      const draggedTruck = trucks.find((t) => t.id === truckId);
      if (!draggedTruck) return;

      const dropData = over.data.current as { garageId?: GarageId; laneId?: LaneId; isPatio?: boolean } | undefined;

      // Drop on patio
      if (dropData?.isPatio) {
        onTruckMove(truckId, 'PATIO');
        return;
      }

      // Drop on garage lane
      if (!dropData?.garageId || !dropData?.laneId) return;

      const targetGarageId = dropData.garageId;
      const targetLaneId = dropData.laneId;
      const config = GARAGE_CONFIGS[targetGarageId];

      // Get dragged truck's current spot info
      const draggedTruckParsed = draggedTruck.spot ? parseSpot(draggedTruck.spot) : null;
      const draggedTruckCurrentSpot = draggedTruck.spot;

      // Build map of spot -> truck for target lane (excluding dragged truck)
      const spotToTruck = new Map<number, typeof trucks[0]>();
      trucks.forEach((t) => {
        if (!t.spot || t.id === truckId) return;
        const parsed = parseSpot(t.spot);
        if (parsed.garage === targetGarageId && parsed.lane === targetLaneId && parsed.spotNumber) {
          spotToTruck.set(parsed.spotNumber, t);
        }
      });

      // Determine preferred spot based on DROP POSITION within the lane
      // Use the dragged element's translated position to determine where user wants to drop

      // Calculate drop position relative to lane
      // Use active.rect.current.translated for the dragged truck's current position
      // Use over.rect for the lane's position
      let isDroppedInTopHalf = true; // Default to top (V1)

      const activeRect = active.rect?.current?.translated;
      const overRect = over.rect;

      if (activeRect && overRect) {
        // Calculate where the CENTER of the dragged truck is relative to the lane
        const truckCenterY = activeRect.top + activeRect.height / 2;
        const laneCenterY = overRect.top + overRect.height / 2;
        isDroppedInTopHalf = truckCenterY < laneCenterY;
      } else if (lastPosition && overRect) {
        // Fallback: use tracked mouse position
        const dropY = lastPosition.y;
        const laneCenterY = overRect.top + overRect.height / 2;
        isDroppedInTopHalf = dropY < laneCenterY;
      }

      // Determine preferred spot based on drop position
      // V1 = top, V2 = bottom - user's drop position determines their intent
      // If the spot is occupied, we'll handle swapping later (don't auto-fallback here!)
      const preferredSpotNum = isDroppedInTopHalf ? 1 : 2;

      // Check if dragged truck is already at the target lane
      const isAlreadyInTargetLane =
        draggedTruckParsed?.garage === targetGarageId &&
        draggedTruckParsed?.lane === targetLaneId;

      // If already in target lane at preferred spot, no action needed
      if (isAlreadyInTargetLane && draggedTruckParsed?.spotNumber === preferredSpotNum) {
        return;
      }

      // Check if preferred spot is occupied by another truck
      const truckAtPreferredSpot = spotToTruck.get(preferredSpotNum);

      if (truckAtPreferredSpot && truckAtPreferredSpot.id !== truckId) {
        // SWAP: Preferred spot is occupied - validate if swap would work
        const newSpotForDragged = `${targetGarageId}_${targetLaneId}_V${preferredSpotNum}`;
        const swapTargetSpot = draggedTruckCurrentSpot && draggedTruckCurrentSpot !== 'PATIO'
          ? draggedTruckCurrentSpot
          : 'PATIO';

        // Validate the swap: Check if dragged truck fits in target lane after swap
        const trucksInTargetLane = trucks.filter(t => {
          if (t.id === truckId || t.id === truckAtPreferredSpot.id) return false;
          if (!t.spot || t.spot === 'PATIO') return false;
          const parsed = parseSpot(t.spot);
          return parsed.garage === targetGarageId && parsed.lane === targetLaneId;
        });

        const currentTruckLengths = trucksInTargetLane.reduce((sum, truck) => {
          return sum + truck.length;
        }, 0);
        const draggedTruckGarageLength = draggedTruck.length;
        const newTotalTruckLengths = currentTruckLengths + draggedTruckGarageLength;
        const margins = 2 * COMMON_CONFIG.TRUCK_MARGIN_TOP;
        const newTruckCount = trucksInTargetLane.length + 1;

        let gapsBetweenTrucks = 0;
        if (newTruckCount === 3) {
          gapsBetweenTrucks = 2 * COMMON_CONFIG.TRUCK_MIN_SPACING;
        }

        const totalRequiredSpace = margins + newTotalTruckLengths + gapsBetweenTrucks;
        const canFitInTargetLane = totalRequiredSpace <= config.laneLength && trucksInTargetLane.length < 3;

        if (!canFitInTargetLane) {
          
          return;
        }

        // Swap is valid
        if (onTruckSwap) {
          onTruckSwap(truckId, newSpotForDragged, truckAtPreferredSpot.id, swapTargetSpot);
        } else {
          onTruckMove(truckId, newSpotForDragged);
          onTruckMove(truckAtPreferredSpot.id, swapTargetSpot);
        }
        return;
      }

      // Preferred spot is empty - validate if truck fits
      const draggedTruckGarageLength = draggedTruck.length;
      const availability = calculateLaneAvailability(
        targetGarageId,
        targetLaneId,
        trucks,
        draggedTruckGarageLength,
        truckId
      );

      if (!availability.canFit) {
        
        return;
      }

      // Move to preferred spot
      const newSpot = `${targetGarageId}_${targetLaneId}_V${preferredSpotNum}`;
      onTruckMove(truckId, newSpot);
    },
    [trucks, onTruckMove, onTruckSwap]
  );

  const content = (
    <div className="w-full h-full overflow-auto p-6">
      <div className="min-w-max min-h-max flex items-center justify-center gap-10">
        {allAreaLayouts.map(({ areaId, layout }, index) => {
        const dim = areaDimensions[index];
        const count = garageCounts[areaId];
        const isPatio = layout.isPatio;

        return (
          <div key={areaId} className="flex flex-col items-center gap-3">
            {/* Area title with truck count */}
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-foreground">
                {getAreaTitle(areaId)}
              </span>
              <span className={cn(
                "text-sm font-bold px-3 py-1.5 rounded-full",
                isPatio ? "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-100" : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100"
              )}>
                {count}
              </span>
            </div>

            {/* SVG Rendering with uniform scale */}
            <div className="drop-shadow-md border-2 border-border rounded-lg bg-card p-1.5">
              <svg
                width={dim.width * uniformScale}
                height={dim.height * uniformScale}
                className="rounded"
              >
                <g>
                {isPatio ? (
                  // Patio rendering
                  <DroppablePatio
                    scale={uniformScale}
                    width={dim.width}
                    height={dim.height}
                    columns={patioColumns}
                  >
                    {layout.patioTrucks?.map((truck) => (
                      enableDragDrop ? (
                        <DraggableTruck
                          key={truck.id}
                          truck={truck}
                          scale={uniformScale}
                          disabled={false}
                          onClick={onTruckClick ? () => onTruckClick(truck.id) : undefined}
                        />
                      ) : (
                        <TruckElement
                          key={truck.id}
                          truck={truck}
                          scale={uniformScale}
                          onClick={onTruckClick ? () => onTruckClick(truck.id) : undefined}
                        />
                      )
                    ))}
                  </DroppablePatio>
                ) : (
                  // Garage rendering
                  <>
                    <rect
                      x={0}
                      y={0}
                      width={dim.width * uniformScale}
                      height={dim.height * uniformScale}
                      fill={COLORS.GARAGE_FILL}
                      stroke={COLORS.GARAGE_STROKE}
                      strokeWidth={2}
                      rx={3}
                    />
                    {/* Lanes */}
                    {layout.lanes.map((lane) => {
                      const config = GARAGE_CONFIGS[areaId as GarageId];
                      const laneY = config.paddingTop;
                      const laneKey = `${areaId}_${lane.id}`;
                      const availability = laneAvailabilityByGarage?.[laneKey];

                      return (
                        <g key={lane.id}>
                          {enableDragDrop ? (
                            <DroppableLane
                              garageId={areaId as GarageId}
                              laneId={lane.id}
                              xPosition={lane.xPosition}
                              scale={uniformScale}
                              laneY={laneY}
                              showLabel={false}
                              canFit={availability?.canFit}
                              availableSpace={availability?.availableSpace}
                              requiredSpace={availability?.requiredSpace}
                              isDragging={!!activeTruck}
                              draggedTruckLength={activeTruck?.length}
                              draggedTruckId={activeTruck?.id}
                              trucks={trucks}
                            >
                              {lane.trucks.map((truck) => (
                                <DraggableTruck
                                  key={truck.id}
                                  truck={truck}
                                  scale={uniformScale}
                                  disabled={false}
                                  onClick={onTruckClick ? () => onTruckClick(truck.id) : undefined}
                                />
                              ))}
                            </DroppableLane>
                          ) : (
                            <>
                              {/* Lane background */}
                              <rect
                                x={lane.xPosition * uniformScale}
                                y={laneY * uniformScale}
                                width={config.laneWidth * uniformScale}
                                height={config.laneLength * uniformScale}
                                fill={COLORS.LANE_FILL}
                                stroke={COLORS.LANE_STROKE}
                                strokeWidth={2}
                                rx={2}
                              />
                              {/* Trucks in lane */}
                              <g transform={`translate(0, ${laneY * uniformScale})`}>
                                {lane.trucks.map((truck) => (
                                  <TruckElement
                                    key={truck.id}
                                    truck={truck}
                                    scale={uniformScale}
                                    onClick={onTruckClick ? () => onTruckClick(truck.id) : undefined}
                                  />
                                ))}
                              </g>
                            </>
                          )}
                        </g>
                      );
                    })}
                  </>
                )}
              </g>
            </svg>
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );

  // Wrap in DndContext only if drag-and-drop is enabled
  if (enableDragDrop) {
    return (
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
                width={COMMON_CONFIG.TRUCK_WIDTH_TOP_VIEW * uniformScale}
                height={activeTruck.length * uniformScale}
              >
                <TruckElement truck={{ ...activeTruck, xPosition: 0, yPosition: 0 }} scale={uniformScale} />
              </svg>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    );
  }

  return content;
}

// =====================
// Main Component
// =====================

interface GarageViewProps {
  trucks: GarageTruck[];
  onTruckMove?: (truckId: string, newSpot: string) => void;
  onTruckSwap?: (truck1Id: string, spot1: string, truck2Id: string, spot2: string) => void;
  onTruckClick?: (taskId: string) => void;
  className?: string;
  readOnly?: boolean;
  viewMode?: 'all' | 'week';
  selectedDate?: Date; // For week view - filter trucks by this date
}

export function GarageView({ trucks, onTruckMove, onTruckSwap, onTruckClick, className, readOnly = false, viewMode = 'all', selectedDate }: GarageViewProps) {
  const [currentAreaIndex, setCurrentAreaIndex] = useState(0);
  const [activeTruck, setActiveTruck] = useState<PositionedTruck | null>(null);
  const [_activeTruckSourceArea, setActiveTruckSourceArea] = useState<AreaId | null>(null);
  const [dragOverEdge, setDragOverEdge] = useState<'left' | 'right' | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 400, height: 500 });
  const [movedTruckIds, setMovedTruckIds] = useState<Set<string>>(new Set());
  // Track current truck positions locally (for trucks that have been moved but not saved)
  const [localTruckPositions, setLocalTruckPositions] = useState<Map<string, string>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const switchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastDragYRef = useRef<number | null>(null); // Track drop Y position for snap decision

  // Store original trucks (before any moves) to keep non-moved trucks in place
  const [originalTrucks, setOriginalTrucks] = useState<GarageTruck[]>(trucks);
  const prevTrucksRef = useRef<GarageTruck[]>(trucks);

  // Compute trucks with local position changes applied
  const trucksWithLocalPositions = useMemo(() => {
    if (localTruckPositions.size === 0) return trucks;
    return trucks.map(t => {
      const localPos = localTruckPositions.get(t.id);
      if (localPos !== undefined) {
        return { ...t, spot: localPos };
      }
      return t;
    });
  }, [trucks, localTruckPositions]);

  // Detect save/restore and reset tracking
  useEffect(() => {
    const prevTrucks = prevTrucksRef.current;
    prevTrucksRef.current = trucks;

    // If movedTruckIds is empty, just update original trucks
    if (movedTruckIds.size === 0) {
      setOriginalTrucks(trucks);
      setLocalTruckPositions(new Map());
      return;
    }

    // Check if this is a restore (trucks match original)
    const isRestore = trucks.every((t) => {
      const original = originalTrucks.find((o) => o.id === t.id);
      return original && original.spot === t.spot;
    });

    if (isRestore) {
      // Restore detected - clear moved trucks and local positions
      setMovedTruckIds(new Set());
      setLocalTruckPositions(new Map());
      return;
    }

    // Check if this is a save (trucks changed but moved trucks still have their new positions)
    // This happens when the parent saves and refreshes from API

    // If a non-moved truck changed position, it's an external update - reset
    const nonMovedTruckChanged = trucks.some((t) => {
      if (movedTruckIds.has(t.id)) return false;
      const original = originalTrucks.find((o) => o.id === t.id);
      return original && original.spot !== t.spot;
    });

    if (nonMovedTruckChanged) {
      // External change detected - reset everything
      setMovedTruckIds(new Set());
      setLocalTruckPositions(new Map());
      setOriginalTrucks(trucks);
    }
  }, [trucks, movedTruckIds, originalTrucks]);

  // Observe container size for responsive scaling
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

  const currentAreaId = AREAS[currentAreaIndex];
  const isPatio = currentAreaId === 'PATIO';

  // Calculate patio columns based on container width (minimum 5 lanes)
  const patioColumns = useMemo(() => {
    const minLanes = PATIO_CONFIG.MIN_LANES;
    if (containerSize.width < 400) return minLanes;
    if (containerSize.width < 600) return minLanes;
    return Math.max(minLanes, 5);
  }, [containerSize.width]);

  // Calculate ORIGINAL layout (stable positions for non-moved trucks)
  const originalAreaLayout = useMemo(
    () => calculateAreaLayout(currentAreaId, originalTrucks, patioColumns),
    [currentAreaId, originalTrucks, patioColumns]
  );

  // Calculate layout with LOCAL positions applied (for moved truck positions)
  // Must use trucksWithLocalPositions so visual positions match logical state
  const currentAreaLayout = useMemo(
    () => calculateAreaLayout(currentAreaId, trucksWithLocalPositions, patioColumns),
    [currentAreaId, trucksWithLocalPositions, patioColumns]
  );

  // Merge layouts: original positions for non-moved, current positions for moved
  // EXCEPTION: For patio, when trucks are added/removed, we must recalculate ALL positions
  // because patio uses dynamic column layout that depends on total truck count and sizes

  // Calculate dimensions based on content
  const garageWidth = isPatio ? 0 : calculateGarageWidth(currentAreaId as GarageId);
  const garageHeight = isPatio ? 0 : GARAGE_CONFIGS[currentAreaId as GarageId].length;

  // Calculate patio dimensions dynamically using PATIO_CONFIG
  const patioTrucksList = trucks
    .filter((t) => !t.spot || t.spot === 'PATIO')
    .sort((a, b) => b.length - a.length); // Same sort as layout
  const patioLaneWidth = COMMON_CONFIG.TRUCK_WIDTH_TOP_VIEW + 0.4;
  const patioPadding = PATIO_CONFIG.PADDING;
  const patioLaneSpacing = PATIO_CONFIG.LANE_SPACING;
  const patioTruckMargin = PATIO_CONFIG.TRUCK_MARGIN;
  const patioMinLaneLength = PATIO_CONFIG.MIN_LANE_LENGTH;
  const patioWidth = patioPadding * 2 + patioColumns * patioLaneWidth + (patioColumns - 1) * patioLaneSpacing;

  // Calculate patio height with minimum lane length of 25m
  const getPatioHeight = () => {
    // First pass: calculate content heights per column
    const columnContentHeights: number[] = Array(patioColumns).fill(patioTruckMargin);
    patioTrucksList.forEach((truck, index) => {
      const col = index % patioColumns;
      columnContentHeights[col] += truck.length + COMMON_CONFIG.TRUCK_MIN_SPACING;
    });

    // Calculate actual content height
    const maxContentHeight = patioTrucksList.length > 0
      ? Math.max(...columnContentHeights) - COMMON_CONFIG.TRUCK_MIN_SPACING + patioTruckMargin
      : patioTruckMargin * 2;

    // Apply minimum lane length (25m)
    const actualLaneLength = Math.max(maxContentHeight, patioMinLaneLength);
    return actualLaneLength + patioPadding * 2;
  };
  const patioHeight = getPatioHeight();

  const contentWidth = isPatio ? patioWidth : garageWidth;
  const contentHeight = isPatio ? patioHeight : garageHeight;

  // Ruler dimensions - apply to both garage and patio
  const rulerOffset = 35; // Space for left ruler
  const bottomRulerOffset = 25; // Space for bottom ruler

  // Calculate scale based on available container space (fill available height)
  const availableWidth = containerSize.width - 80 - rulerOffset; // Nav buttons + ruler
  const availableHeight = containerSize.height - 80 - bottomRulerOffset; // Header + footer + ruler
  const scaleX = availableWidth / contentWidth;
  const scaleY = availableHeight / contentHeight;
  const scale = Math.min(scaleX, scaleY, 15); // Cap at scale 15 (increased)

  // Offset to center the garage (not the ruler+garage group)
  const _centeringOffset = -rulerOffset / 2;

  const _sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const _handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const truck = active.data.current?.truck as PositionedTruck;
    setActiveTruck(truck);
    setActiveTruckSourceArea(currentAreaId);
  }, [currentAreaId]);

  const _handleDragCancel = useCallback(() => {
    setActiveTruck(null);
    setActiveTruckSourceArea(null);
  }, []);

  // Calculate lane availability for visual feedback during drag
  const _laneAvailability = useMemo(() => {
    if (!activeTruck || isPatio) return null;

    const garageId = currentAreaId as GarageId;
    const availability: Record<LaneId, { canFit: boolean; availableSpace: number; requiredSpace: number }> = {} as any;

    // Use full truck length (including cabin) for garage space calculation
    const truckGarageLength = activeTruck.length;

    LANES.forEach(laneId => {
      availability[laneId] = calculateLaneAvailability(
        garageId,
        laneId,
        trucksWithLocalPositions,
        truckGarageLength,
        activeTruck.id
      );
    });

    return availability;
  }, [activeTruck, isPatio, currentAreaId, trucksWithLocalPositions]);

  // Handle navigation WITH truck - move truck to target garage
  const handleNavigateWithTruck = useCallback(
    (direction: 'prev' | 'next') => {
      if (!activeTruck || !onTruckMove) return;

      const newIndex = direction === 'prev'
        ? (currentAreaIndex > 0 ? currentAreaIndex - 1 : AREAS.length - 1)
        : (currentAreaIndex < AREAS.length - 1 ? currentAreaIndex + 1 : 0);

      const newAreaId = AREAS[newIndex];
      const truckId = activeTruck.id;

      // If navigating to PATIO, move truck to PATIO
      if (newAreaId === 'PATIO') {
        setMovedTruckIds(prev => new Set(prev).add(truckId));
        onTruckMove(truckId, 'PATIO');
        setCurrentAreaIndex(newIndex);
        
        return;
      }

      // If navigating to a garage, try to find an available spot
      const targetGarageId = newAreaId as GarageId;

      // Get all trucks in target garage
      const trucksInTargetGarage = trucks.filter((t) => {
        if (!t.spot || t.id === truckId) return false;
        const parsed = parseSpot(t.spot);
        return parsed.garage === targetGarageId;
      });

      // Find first available spot in target garage (V1 and V2 only - typical usage)
      let newSpot: string | null = null;
      for (const laneId of LANES) {
        const trucksInLane = trucksInTargetGarage.filter((t) => {
          const parsed = parseSpot(t.spot!);
          return parsed.lane === laneId;
        });
        const occupiedSpots = new Set(trucksInLane.map((t) => parseSpot(t.spot!).spotNumber));

        // Only use V1 and V2 (typical lane capacity is 2 trucks)
        for (let spotNum = 1; spotNum <= 2; spotNum++) {
          if (!occupiedSpots.has(spotNum)) {
            newSpot = `${targetGarageId}_${laneId}_V${spotNum}`;
            break;
          }
        }
        if (newSpot) break;
      }

      // If no spot found, move to PATIO instead
      if (!newSpot) {
        newSpot = 'PATIO';
        
      } else {
        
      }

      // Move the truck
      setMovedTruckIds(prev => new Set(prev).add(truckId));
      onTruckMove(truckId, newSpot);

      // Navigate to new area
      setCurrentAreaIndex(newIndex);
    },
    [activeTruck, currentAreaIndex, trucks, onTruckMove]
  );

  const _handleDragMove = useCallback((event: DragMoveEvent) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = event.activatorEvent instanceof MouseEvent
      ? event.activatorEvent.clientX + (event.delta?.x || 0)
      : 0;
    const y = event.activatorEvent instanceof MouseEvent
      ? event.activatorEvent.clientY + (event.delta?.y || 0)
      : 0;

    // Store Y position for snap decision on drop
    lastDragYRef.current = y - rect.top;

    const edgeThreshold = 60;

    if (x < rect.left + edgeThreshold) {
      if (dragOverEdge !== 'left') {
        setDragOverEdge('left');
        if (switchTimeoutRef.current) clearTimeout(switchTimeoutRef.current);
        switchTimeoutRef.current = setTimeout(() => {
          handleNavigateWithTruck('prev');
        }, 500);
      }
    } else if (x > rect.right - edgeThreshold) {
      if (dragOverEdge !== 'right') {
        setDragOverEdge('right');
        if (switchTimeoutRef.current) clearTimeout(switchTimeoutRef.current);
        switchTimeoutRef.current = setTimeout(() => {
          handleNavigateWithTruck('next');
        }, 500);
      }
    } else {
      if (dragOverEdge !== null) {
        setDragOverEdge(null);
        if (switchTimeoutRef.current) clearTimeout(switchTimeoutRef.current);
      }
    }
  }, [dragOverEdge, handleNavigateWithTruck]);

  const _handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      const dropY = lastDragYRef.current;
      setActiveTruck(null);
      setActiveTruckSourceArea(null); // Clear source area tracking
      setDragOverEdge(null);
      lastDragYRef.current = null;
      if (switchTimeoutRef.current) clearTimeout(switchTimeoutRef.current);

      if (!over || !onTruckMove) return;

      const truckId = active.id as string;
      // Use trucksWithLocalPositions to get the CURRENT position (including unsaved moves)
      const draggedTruck = trucksWithLocalPositions.find((t) => t.id === truckId);
      if (!draggedTruck) return;

      const dropData = over.data.current as { garageId?: GarageId; laneId?: LaneId; isPatio?: boolean } | undefined;

      if (dropData?.isPatio) {
        setMovedTruckIds(prev => new Set(prev).add(truckId));
        setLocalTruckPositions(prev => new Map(prev).set(truckId, 'PATIO'));
        onTruckMove(truckId, 'PATIO');
        return;
      }

      if (!dropData?.garageId || !dropData?.laneId) return;

      const targetGarageId = dropData.garageId;
      const targetLaneId = dropData.laneId;
      const config = GARAGE_CONFIGS[targetGarageId];

      // Get dragged truck's CURRENT spot info (from local positions if moved, otherwise from original)
      const draggedTruckParsed = draggedTruck.spot ? parseSpot(draggedTruck.spot) : null;
      const draggedTruckCurrentSpot = draggedTruck.spot;

      // Build map of spot -> truck for target lane (excluding dragged truck)
      // Use trucksWithLocalPositions to get current positions
      // Also build a map of truck Y positions for direct hit detection
      const spotToTruck = new Map<number, typeof trucksWithLocalPositions[0]>();
      const truckYPositions: Array<{ truck: typeof trucksWithLocalPositions[0]; spotNumber: number; yStart: number; yEnd: number }> = [];

      trucksWithLocalPositions.forEach((t) => {
        if (!t.spot || t.id === truckId) return;
        const parsed = parseSpot(t.spot);
        if (parsed.garage === targetGarageId && parsed.lane === targetLaneId && parsed.spotNumber) {
          spotToTruck.set(parsed.spotNumber, t);

          // Calculate Y position for this truck (same logic as calculateAreaLayout)
          let yPosition: number;
          const v1Truck = parsed.spotNumber === 1 ? t : trucksWithLocalPositions.find(tr => tr.spot && parseSpot(tr.spot).garage === targetGarageId && parseSpot(tr.spot).lane === targetLaneId && parseSpot(tr.spot).spotNumber === 1);
          const v3Truck = trucksWithLocalPositions.find(tr => tr.spot && parseSpot(tr.spot).garage === targetGarageId && parseSpot(tr.spot).lane === targetLaneId && parseSpot(tr.spot).spotNumber === 3);

          if (parsed.spotNumber === 1) {
            yPosition = COMMON_CONFIG.TRUCK_MARGIN_TOP;
          } else if (parsed.spotNumber === 3) {
            yPosition = config.laneLength - COMMON_CONFIG.TRUCK_MARGIN_TOP - t.length;
          } else {
            // V2: Bottom aligned when alone, middle when V3 exists
            if (v3Truck) {
              const v1Bottom = v1Truck
                ? COMMON_CONFIG.TRUCK_MARGIN_TOP + v1Truck.length + COMMON_CONFIG.TRUCK_MIN_SPACING
                : COMMON_CONFIG.TRUCK_MARGIN_TOP;
              const v3Top = config.laneLength - COMMON_CONFIG.TRUCK_MARGIN_TOP - v3Truck.length - COMMON_CONFIG.TRUCK_MIN_SPACING;
              yPosition = v1Bottom + (v3Top - v1Bottom - t.length) / 2;
            } else {
              yPosition = config.laneLength - COMMON_CONFIG.TRUCK_MARGIN_TOP - t.length;
            }
          }

          truckYPositions.push({
            truck: t,
            spotNumber: parsed.spotNumber,
            yStart: yPosition,
            yEnd: yPosition + t.length,
          });
        }
      });

      // Convert dropY from container coords to lane-relative coords
      // dropY is relative to container top, we need it relative to lane top
      // Lane starts at: (header ~40px) + (padding/2 + rulerOffset ~55px) + (config.paddingTop * scale)
      const headerOffset = 40; // Approximate header height
      const svgOffset = 20 + rulerOffset + 5; // translate(20 + rulerOffset, 5)
      const laneTopInContainer = headerOffset + svgOffset + (config.paddingTop * scale);
      const laneRelativeDropY = dropY !== null ? (dropY - laneTopInContainer) / scale : null;

      // PRIORITY 1: Check for direct hit on any truck in the lane
      // If dropping directly on a truck, swap with that specific truck regardless of snap preference
      let directHitTruck: { truck: typeof trucks[0]; spotNumber: number } | null = null;
      const TOLERANCE = 0.5; // meters tolerance for hit detection

      if (laneRelativeDropY !== null) {
        for (const tp of truckYPositions) {
          if (laneRelativeDropY >= tp.yStart - TOLERANCE && laneRelativeDropY <= tp.yEnd + TOLERANCE) {
            directHitTruck = { truck: tp.truck, spotNumber: tp.spotNumber };
            break;
          }
        }
      }

      // If direct hit on another truck, swap with that truck
      if (directHitTruck) {
        const targetTruckSpot = directHitTruck.truck.spot!;
        const swapTargetSpot = draggedTruckCurrentSpot && draggedTruckCurrentSpot !== 'PATIO'
          ? draggedTruckCurrentSpot
          : 'PATIO';

        // Don't swap if it's the same truck (shouldn't happen but safety check)
        if (directHitTruck.truck.id === truckId) return;

        // Validate the swap: Check if dragged truck fits in target lane after swap
        // Exclude both trucks from the lane and check if draggedTruck fits
        const trucksInTargetLane = trucksWithLocalPositions.filter(t => {
          if (t.id === truckId || t.id === directHitTruck!.truck.id) return false;
          if (!t.spot || t.spot === 'PATIO') return false;
          const parsed = parseSpot(t.spot);
          return parsed.garage === targetGarageId && parsed.lane === targetLaneId;
        });

        const currentTruckLengths = trucksInTargetLane.reduce((sum, truck) => {
          return sum + truck.length;
        }, 0);
        const draggedTruckGarageLength = draggedTruck.length;
        const newTotalTruckLengths = currentTruckLengths + draggedTruckGarageLength;
        const margins = 2 * COMMON_CONFIG.TRUCK_MARGIN_TOP;
        const newTruckCount = trucksInTargetLane.length + 1;

        // Use correct gap logic: 0 for 1-2 trucks, 2m for 3 trucks
        let gapsBetweenTrucks = 0;
        if (newTruckCount === 3) {
          gapsBetweenTrucks = 2 * COMMON_CONFIG.TRUCK_MIN_SPACING;
        }

        const totalRequiredSpace = margins + newTotalTruckLengths + gapsBetweenTrucks;
        const canFitInTargetLane = totalRequiredSpace <= config.laneLength && trucksInTargetLane.length < 3;

        if (!canFitInTargetLane) {
          
          return;
        }

        // Swap is valid - proceed
        setMovedTruckIds(prev => {
          const next = new Set(prev);
          next.add(truckId);
          next.add(directHitTruck!.truck.id);
          return next;
        });

        // Track local positions for both trucks
        setLocalTruckPositions(prev => {
          const next = new Map(prev);
          next.set(truckId, targetTruckSpot);
          next.set(directHitTruck!.truck.id, swapTargetSpot);
          return next;
        });

        if (onTruckSwap) {
          onTruckSwap(truckId, targetTruckSpot, directHitTruck.truck.id, swapTargetSpot);
        } else {
          onTruckMove(truckId, targetTruckSpot);
          onTruckMove(directHitTruck.truck.id, swapTargetSpot);
        }
        return;
      }

      // PRIORITY 2: No direct hit - use snap-to-lane logic based on lane position
      // Use lane-relative coordinates for proper top/bottom detection
      const laneLength = config.laneLength;
      const isDroppedInTopHalf = laneRelativeDropY !== null && laneRelativeDropY < laneLength / 2;
      const preferredSpotNum = isDroppedInTopHalf ? 1 : 2;

      // Check if dragged truck is already in the target lane at the preferred spot
      const isAlreadyAtPreferredSpot =
        draggedTruckParsed?.garage === targetGarageId &&
        draggedTruckParsed?.lane === targetLaneId &&
        draggedTruckParsed?.spotNumber === preferredSpotNum;

      if (isAlreadyAtPreferredSpot) {
        // Truck is being dropped at its own position - no change needed
        return;
      }

      // Check if preferred spot is occupied by another truck
      const truckAtPreferredSpot = spotToTruck.get(preferredSpotNum);

      if (truckAtPreferredSpot) {
        // SWAP: Preferred spot is occupied - validate if swap would work
        const newSpotForDragged = `${targetGarageId}_${targetLaneId}_V${preferredSpotNum}`;
        const swapTargetSpot = draggedTruckCurrentSpot && draggedTruckCurrentSpot !== 'PATIO'
          ? draggedTruckCurrentSpot
          : 'PATIO';

        // Validate the swap: Check if dragged truck fits in target lane after swap
        // The swap removes truckAtPreferredSpot and adds draggedTruck
        // We need to check if the lane can accommodate this
        const _availability = calculateLaneAvailability(
          targetGarageId,
          targetLaneId,
          trucksWithLocalPositions,
          draggedTruck.length,
          truckId // Exclude dragged truck from current count
        );

        // For swap, we also need to exclude the truck being swapped out
        // Recalculate considering both trucks are removed, then draggedTruck is added
        const trucksInTargetLane = trucksWithLocalPositions.filter(t => {
          if (t.id === truckId || t.id === truckAtPreferredSpot.id) return false;
          if (!t.spot || t.spot === 'PATIO') return false;
          const parsed = parseSpot(t.spot);
          return parsed.garage === targetGarageId && parsed.lane === targetLaneId;
        });

        const currentTruckLengths = trucksInTargetLane.reduce((sum, truck) => {
          return sum + truck.length;
        }, 0);
        const draggedTruckGarageLength = draggedTruck.length;
        const newTotalTruckLengths = currentTruckLengths + draggedTruckGarageLength;
        const margins = 2 * COMMON_CONFIG.TRUCK_MARGIN_TOP;
        const newTruckCount = trucksInTargetLane.length + 1;

        // Use correct gap logic: 0 for 1-2 trucks, 2m for 3 trucks
        let gapsBetweenTrucks = 0;
        if (newTruckCount === 3) {
          gapsBetweenTrucks = 2 * COMMON_CONFIG.TRUCK_MIN_SPACING;
        }

        const totalRequiredSpace = margins + newTotalTruckLengths + gapsBetweenTrucks;
        const canFitInTargetLane = totalRequiredSpace <= config.laneLength && trucksInTargetLane.length < 3;

        if (!canFitInTargetLane) {
          
          return;
        }

        // Swap is valid - proceed
        setMovedTruckIds(prev => {
          const next = new Set(prev);
          next.add(truckId);
          next.add(truckAtPreferredSpot.id);
          return next;
        });

        // Track local positions for both trucks
        setLocalTruckPositions(prev => {
          const next = new Map(prev);
          next.set(truckId, newSpotForDragged);
          next.set(truckAtPreferredSpot.id, swapTargetSpot);
          return next;
        });

        if (onTruckSwap) {
          onTruckSwap(truckId, newSpotForDragged, truckAtPreferredSpot.id, swapTargetSpot);
        } else {
          onTruckMove(truckId, newSpotForDragged);
          onTruckMove(truckAtPreferredSpot.id, swapTargetSpot);
        }
        return;
      }

      // Preferred spot is empty - check if truck fits before moving
      // Calculate if the truck actually fits in this lane
      const draggedTruckGarageLength = draggedTruck.length;
      const availability = calculateLaneAvailability(
        targetGarageId,
        targetLaneId,
        trucksWithLocalPositions,
        draggedTruckGarageLength,
        truckId
      );

      if (!availability.canFit) {
        // Truck doesn't fit - reject the drop (do nothing, truck stays in original position)
        
        return;
      }

      // Truck fits - move there
      const newSpot = `${targetGarageId}_${targetLaneId}_V${preferredSpotNum}`;
      setMovedTruckIds(prev => new Set(prev).add(truckId));
      setLocalTruckPositions(prev => new Map(prev).set(truckId, newSpot));
      onTruckMove(truckId, newSpot);
    },
    [trucksWithLocalPositions, onTruckMove, onTruckSwap, scale, rulerOffset]
  );

  useEffect(() => {
    return () => {
      if (switchTimeoutRef.current) clearTimeout(switchTimeoutRef.current);
    };
  }, []);

  const _handlePrevArea = useCallback(() => {
    setCurrentAreaIndex((prev) => (prev > 0 ? prev - 1 : AREAS.length - 1));
  }, []);

  const _handleNextArea = useCallback(() => {
    setCurrentAreaIndex((prev) => (prev < AREAS.length - 1 ? prev + 1 : 0));
  }, []);

  // Display logic is handled by the parent component (barracoes/index.tsx):
  // - Has spot → display in that spot (garage)
  // - No spot AND forecastDate <= today → display in patio
  // - Must have a layout defined
  //
  // For Calendar view, we add additional filtering based on selectedDate
  const filteredTrucks = useMemo(() => {
    if (viewMode === 'week' && selectedDate) {
      // Calendar view: Filter trucks that should be visible on the selected date
      const checkDate = new Date(selectedDate);
      checkDate.setHours(0, 0, 0, 0);

      return trucksWithLocalPositions.filter(truck => {
        // For calendar view, check if truck is within forecastDate to term range
        if (truck.forecastDate) {
          const forecastDate = new Date(truck.forecastDate);
          forecastDate.setHours(0, 0, 0, 0);

          // Truck must have arrived by the selected date
          if (checkDate < forecastDate) return false;

          // If term exists, selected date must be before or on the term
          if (truck.term) {
            const term = new Date(truck.term);
            term.setHours(0, 0, 0, 0);
            if (checkDate > term) return false;
          }
        }
        return true;
      });
    }

    // Grade view: Show all trucks passed from parent (already filtered)
    return trucksWithLocalPositions;
  }, [viewMode, selectedDate, trucksWithLocalPositions]);

  const displayTrucks = filteredTrucks;

  // Count trucks per garage based on displayed trucks (ensures counts match rendered trucks)
  const garageCounts = useMemo(() => {
    const counts: Record<string, number> = { B1: 0, B2: 0, B3: 0, PATIO: 0 };
    displayTrucks.forEach((t) => {
      if (!t.spot || t.spot === 'PATIO') {
        counts.PATIO++;
      } else {
        const parsed = parseSpot(t.spot);
        if (parsed.garage) {
          counts[parsed.garage]++;
        }
      }
    });
    return counts;
  }, [displayTrucks]);

  return (
    <div className={cn('flex flex-col h-full w-full', className)}>

      {/* Main container - fills available space */}
      <div
        ref={containerRef}
        className="flex-1 relative flex items-center justify-center min-h-0"
      >
        <AllGaragesView
          trucks={displayTrucks}
          containerWidth={containerSize.width}
          containerHeight={containerSize.height}
          garageCounts={garageCounts}
          viewMode={viewMode}
          onTruckMove={onTruckMove}
          onTruckSwap={onTruckSwap}
          onTruckClick={onTruckClick}
          readOnly={readOnly}
        />
      </div>

    </div>
  );
}

export default GarageView;
