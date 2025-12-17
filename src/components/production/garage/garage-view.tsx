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
import { Button } from '@/components/ui/button';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

// =====================
// Constants
// =====================

// Individual garage configurations with real measurements
const GARAGE_CONFIGS = {
  B1: {
    width: 20, // meters
    length: 30, // meters
    paddingTop: 2.2, // meters - back margin from top
    paddingBottom: 3.2, // meters - front margin from bottom
    laneLength: 24.6, // meters
    laneWidth: 3, // meters
    laneSpacing: (20 - 9) / 4, // 2.75m - equal spacing between and around lanes
    lanePaddingX: (20 - 9) / 4, // 2.75m - padding on left/right
  },
  B2: {
    width: 18.5, // meters
    length: 30.5, // meters
    paddingTop: 3.5, // meters - back margin from top
    paddingBottom: 2.5, // meters - front margin from bottom
    laneLength: 24.5, // meters
    laneWidth: 3, // meters
    laneSpacing: (18.5 - 9) / 4, // 2.375m - equal spacing between and around lanes
    lanePaddingX: (18.5 - 9) / 4, // 2.375m - padding on left/right
  },
  B3: {
    width: 20, // meters
    length: 40, // meters
    paddingTop: 3, // meters - back margin from top
    paddingBottom: 7, // meters - front margin from bottom
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
const COLORS = {
  LANE_FILL: '#FEF3C7', // Light yellow (amber-100)
  LANE_STROKE: '#D97706', // Darker yellow/amber (amber-600)
  LANE_HOVER: '#FDE68A', // Hover yellow (amber-200)
  GARAGE_FILL: '#F5F5F4', // Light stone (stone-100)
  GARAGE_STROKE: '#78716C', // Garage border (stone-500)
  PATIO_FILL: '#E0F2FE', // Light blue for patio (sky-100)
  PATIO_STROKE: '#0284C7', // Blue border for patio (sky-600)
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
    const actualLaneLength = Math.max(maxContentHeight, minLaneLength);

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
    const availableLength = config.laneLength - COMMON_CONFIG.TRUCK_MARGIN_TOP * 2;

    // Position trucks based on their SPOT NUMBER (V1, V2, V3)
    // V1: Always top aligned
    // V2: Bottom aligned when alone, middle when V3 exists
    // V3: Always bottom aligned
    const v1Truck = laneTrucks.find(t => parseSpot(t.spot!).spotNumber === 1);
    const v2Truck = laneTrucks.find(t => parseSpot(t.spot!).spotNumber === 2);
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
}

function TruckElement({ truck, scale, isDragging }: TruckElementProps) {
  const width = COMMON_CONFIG.TRUCK_WIDTH_TOP_VIEW * scale;
  const height = truck.length * scale;
  const x = truck.xPosition * scale;
  const y = truck.yPosition * scale;
  const bgColor = truck.paintHex || '#ffffff';

  // Determine text color based on background brightness
  const getBrightness = (hex: string) => {
    const rgb = parseInt(hex.slice(1), 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = rgb & 0xff;
    return (r * 299 + g * 587 + b * 114) / 1000;
  };
  const textColor = getBrightness(bgColor) > 128 ? '#000000' : '#ffffff';

  // Truncate task name to fit
  const maxChars = Math.floor(height / 8);
  const displayName = truck.taskName
    ? truck.taskName.length > maxChars
      ? truck.taskName.slice(0, maxChars - 2) + '..'
      : truck.taskName
    : 'N/A';

  // Display original length (without cabin) if available
  const displayLength = truck.originalLength ?? truck.length;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      className={cn('cursor-grab', isDragging && 'opacity-50')}
    >
      {/* Truck body */}
      <rect
        width={width}
        height={height}
        fill={bgColor}
        stroke="#333"
        strokeWidth={1.5}
        rx={3}
      />
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
        y={10}
        textAnchor="middle"
        fill={textColor}
        fontSize={8}
        style={{ pointerEvents: 'none' }}
      >
        {displayLength.toFixed(1).replace('.', ',')}m
      </text>
      {/* Serial number label at bottom */}
      {truck.serialNumber && (
        <text
          x={width / 2}
          y={height - 4}
          textAnchor="middle"
          fill={textColor}
          fontSize={8}
          style={{ pointerEvents: 'none' }}
        >
          {truck.serialNumber}
        </text>
      )}
    </g>
  );
}

interface DraggableTruckProps {
  truck: PositionedTruck;
  scale: number;
  disabled?: boolean;
}

function DraggableTruck({ truck, scale, disabled = false }: DraggableTruckProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: truck.id,
    data: { truck },
    disabled,
  });

  return (
    <g ref={setNodeRef} {...(disabled ? {} : listeners)} {...attributes} style={{ cursor: disabled ? 'default' : 'grab' }}>
      <TruckElement truck={truck} scale={scale} isDragging={isDragging} />
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
  children: React.ReactNode;
}

function DroppableLane({ garageId, laneId, xPosition, scale, laneY, showLabel = true, children }: DroppableLaneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${garageId}_${laneId}`,
    data: { garageId, laneId },
  });

  const config = GARAGE_CONFIGS[garageId];
  const x = xPosition * scale;
  const y = laneY * scale;
  const width = config.laneWidth * scale;
  const height = config.laneLength * scale;

  return (
    <g ref={setNodeRef}>
      {/* Lane background with yellow colors */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={isOver ? COLORS.LANE_HOVER : COLORS.LANE_FILL}
        stroke={COLORS.LANE_STROKE}
        strokeWidth={2}
        rx={3}
      />
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
// Main Component
// =====================

interface GarageViewProps {
  trucks: GarageTruck[];
  onTruckMove?: (truckId: string, newSpot: string) => void;
  onTruckSwap?: (truck1Id: string, spot1: string, truck2Id: string, spot2: string) => void;
  className?: string;
  readOnly?: boolean;
}

export function GarageView({ trucks, onTruckMove, onTruckSwap, className, readOnly = false }: GarageViewProps) {
  const [currentAreaIndex, setCurrentAreaIndex] = useState(0);
  const [activeTruck, setActiveTruck] = useState<PositionedTruck | null>(null);
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
    const trucksChanged = trucks.some((t, i) => {
      const prev = prevTrucks.find((p) => p.id === t.id);
      return !prev || prev.spot !== t.spot;
    });

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
  const areaLayout = useMemo(() => {
    if (movedTruckIds.size === 0) return originalAreaLayout;

    if (originalAreaLayout.isPatio) {
      // Patio: Use fully recalculated layout when trucks change
      // This ensures proper reallocation of all trucks when new ones are added
      // because patio layout is based on sorting by length and filling columns
      return currentAreaLayout;
    } else {
      // Garage: merge each lane - trucks have fixed spot positions (V1, V2, V3)
      const mergedLanes = originalAreaLayout.lanes.map((originalLane, laneIndex) => {
        const trucksFromOriginal = originalLane.trucks.filter(t => !movedTruckIds.has(t.id));
        const currentLane = currentAreaLayout.lanes[laneIndex];
        const trucksMovedToLane = currentLane.trucks.filter(t => movedTruckIds.has(t.id));
        return {
          ...originalLane,
          trucks: [...trucksFromOriginal, ...trucksMovedToLane],
        };
      });
      return {
        ...originalAreaLayout,
        lanes: mergedLanes,
      };
    }
  }, [originalAreaLayout, currentAreaLayout, movedTruckIds]);

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

  const svgWidth = contentWidth * scale + 40 + rulerOffset;
  const svgHeight = contentHeight * scale + bottomRulerOffset + 15;

  // Offset to center the garage (not the ruler+garage group)
  const centeringOffset = -rulerOffset / 2;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const truck = active.data.current?.truck as PositionedTruck;
    setActiveTruck(truck);
  }, []);

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
        console.log(`[GarageView] Navigated ${direction} to PATIO, moved truck ${truckId} to PATIO`);
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
        console.log(`[GarageView] No available spot in ${targetGarageId}, moving truck ${truckId} to PATIO`);
      } else {
        console.log(`[GarageView] Navigated ${direction} to ${targetGarageId}, moved truck ${truckId} to ${newSpot}`);
      }

      // Move the truck
      setMovedTruckIds(prev => new Set(prev).add(truckId));
      onTruckMove(truckId, newSpot);

      // Navigate to new area
      setCurrentAreaIndex(newIndex);
    },
    [activeTruck, currentAreaIndex, trucks, onTruckMove]
  );

  const handleDragMove = useCallback((event: DragMoveEvent) => {
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

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      const dropY = lastDragYRef.current;
      setActiveTruck(null);
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
        // SWAP: Preferred spot is occupied - swap the two trucks
        const newSpotForDragged = `${targetGarageId}_${targetLaneId}_V${preferredSpotNum}`;
        const swapTargetSpot = draggedTruckCurrentSpot && draggedTruckCurrentSpot !== 'PATIO'
          ? draggedTruckCurrentSpot
          : 'PATIO';

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

      // Preferred spot is empty - move there
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

  const handlePrevArea = useCallback(() => {
    setCurrentAreaIndex((prev) => (prev > 0 ? prev - 1 : AREAS.length - 1));
  }, []);

  const handleNextArea = useCallback(() => {
    setCurrentAreaIndex((prev) => (prev < AREAS.length - 1 ? prev + 1 : 0));
  }, []);

  const getAreaTitle = (areaId: AreaId) => {
    if (areaId === 'PATIO') return 'Pátio';
    return `Barracão ${areaId.slice(1)}`;
  };

  // Count trucks per garage
  const garageCounts = useMemo(() => {
    const counts: Record<string, number> = { B1: 0, B2: 0, B3: 0, PATIO: 0 };
    trucks.forEach((t) => {
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
  }, [trucks]);

  const inGarages = garageCounts.B1 + garageCounts.B2 + garageCounts.B3;
  const inPatio = garageCounts.PATIO;

  return (
    <div className={cn('flex flex-col h-full w-full', className)}>
      {/* Header with title */}
      <div className="flex flex-col items-center justify-center py-1">
        <span className="text-lg font-semibold text-stone-700">
          {getAreaTitle(currentAreaId)}
        </span>
        {/* Navigation dots below title */}
        <div className="flex gap-1.5 mt-1">
          {AREAS.map((area, index) => (
            <button
              key={area}
              onClick={() => setCurrentAreaIndex(index)}
              className={cn(
                'w-2.5 h-2.5 rounded-full transition-colors',
                index === currentAreaIndex
                  ? area === 'PATIO' ? 'bg-sky-500' : 'bg-amber-500'
                  : 'bg-gray-300 hover:bg-gray-400'
              )}
              title={getAreaTitle(area)}
            />
          ))}
        </div>
      </div>

      {/* Main container - fills available space */}
      <div
        ref={containerRef}
        className="flex-1 relative flex items-center justify-center min-h-0"
      >
        {/* Left navigation button - centered with tall height */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePrevArea}
          className={cn(
            'absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-48 rounded hover:bg-amber-100/50 transition-colors',
            dragOverEdge === 'left' && 'bg-amber-200/70'
          )}
        >
          <IconChevronLeft className={cn('h-6 w-6', dragOverEdge === 'left' && 'animate-pulse')} />
        </Button>

        {/* Garage/Patio SVG */}
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
        >
          <div className="flex justify-center px-10">
            <svg width={svgWidth} height={svgHeight} style={{ marginLeft: centeringOffset }}>
              <g transform={`translate(${20 + rulerOffset}, 5)`}>
                {areaLayout.isPatio ? (
                  // Patio view with visual lanes and rulers
                  <>
                    {/* Left ruler (vertical - patio height) */}
                    <g transform={`translate(-${rulerOffset}, 0)`}>
                      {/* Main ruler line */}
                      <line
                        x1={rulerOffset - 5}
                        y1={0}
                        x2={rulerOffset - 5}
                        y2={patioHeight * scale}
                        stroke="#78716C"
                        strokeWidth={1}
                      />
                      {/* Tick marks every 1m (small) and every 5m (large with label) */}
                      {Array.from({ length: Math.ceil(patioHeight) + 1 }, (_, i) => {
                        const y = i * scale;
                        const is5m = i % 5 === 0;
                        const tickSize = is5m ? 8 : 4;
                        return (
                          <g key={`patio-vtick-${i}`}>
                            <line
                              x1={rulerOffset - 5 - tickSize}
                              y1={y}
                              x2={rulerOffset - 5}
                              y2={y}
                              stroke="#78716C"
                              strokeWidth={is5m ? 1.5 : 0.5}
                            />
                            {is5m && (
                              <text
                                x={rulerOffset - 5 - tickSize - 3}
                                y={y + 3}
                                textAnchor="end"
                                fontSize={8}
                                fill="#78716C"
                              >
                                {i}m
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </g>

                    <DroppablePatio scale={scale} width={patioWidth} height={patioHeight} columns={patioColumns}>
                      {areaLayout.patioTrucks?.map((truck) => (
                        <DraggableTruck key={truck.id} truck={truck} scale={scale} disabled={readOnly} />
                      ))}
                    </DroppablePatio>

                    {/* Bottom ruler (horizontal - patio width) */}
                    <g transform={`translate(0, ${patioHeight * scale + 5})`}>
                      {/* Main ruler line */}
                      <line
                        x1={0}
                        y1={0}
                        x2={patioWidth * scale}
                        y2={0}
                        stroke="#78716C"
                        strokeWidth={1}
                      />
                      {/* Tick marks every 1m (small) and every 5m (large with label) */}
                      {Array.from({ length: Math.ceil(patioWidth) + 1 }, (_, i) => {
                        const x = i * scale;
                        const is5m = i % 5 === 0;
                        const tickSize = is5m ? 8 : 4;
                        return (
                          <g key={`patio-htick-${i}`}>
                            <line
                              x1={x}
                              y1={0}
                              x2={x}
                              y2={tickSize}
                              stroke="#78716C"
                              strokeWidth={is5m ? 1.5 : 0.5}
                            />
                            {is5m && (
                              <text
                                x={x}
                                y={tickSize + 10}
                                textAnchor="middle"
                                fontSize={8}
                                fill="#78716C"
                              >
                                {i}m
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </g>
                  </>
                ) : (
                  // Garage view with border and rulers
                  <>
                    {/* Left ruler (vertical - garage length) with tick marks */}
                    <g transform={`translate(-${rulerOffset}, 0)`}>
                      {/* Main ruler line */}
                      <line
                        x1={rulerOffset - 5}
                        y1={0}
                        x2={rulerOffset - 5}
                        y2={garageHeight * scale}
                        stroke="#78716C"
                        strokeWidth={1}
                      />
                      {/* Tick marks every 1m (small) and every 5m (large with label) */}
                      {Array.from({ length: garageHeight + 1 }, (_, i) => {
                        const y = i * scale;
                        const is5m = i % 5 === 0;
                        const tickSize = is5m ? 8 : 4;
                        return (
                          <g key={`vtick-${i}`}>
                            <line
                              x1={rulerOffset - 5 - tickSize}
                              y1={y}
                              x2={rulerOffset - 5}
                              y2={y}
                              stroke="#78716C"
                              strokeWidth={is5m ? 1.5 : 0.5}
                            />
                            {is5m && (
                              <text
                                x={rulerOffset - 5 - tickSize - 3}
                                y={y + 3}
                                textAnchor="end"
                                fontSize={8}
                                fill="#78716C"
                              >
                                {i}m
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </g>

                    {/* Garage border */}
                    <rect
                      x={0}
                      y={0}
                      width={garageWidth * scale}
                      height={garageHeight * scale}
                      fill={COLORS.GARAGE_FILL}
                      stroke={COLORS.GARAGE_STROKE}
                      strokeWidth={2}
                      rx={4}
                    />

                    {/* Lanes with trucks - positioned with padding from garage top */}
                    {areaLayout.lanes.map((lane, index) => {
                      const config = GARAGE_CONFIGS[currentAreaId as GarageId];
                      const laneX = config.lanePaddingX + index * (config.laneWidth + config.laneSpacing);
                      const laneY = config.paddingTop;
                      return (
                        <g key={lane.id}>
                          <DroppableLane
                            garageId={currentAreaId as GarageId}
                            laneId={lane.id}
                            xPosition={lane.xPosition}
                            laneY={laneY}
                            scale={scale}
                            showLabel={false}
                          >
                            {lane.trucks.map((truck) => (
                              <DraggableTruck key={truck.id} truck={truck} scale={scale} disabled={readOnly} />
                            ))}
                          </DroppableLane>
                          {/* Lane label just below the lane */}
                          <text
                            x={(laneX + config.laneWidth / 2) * scale}
                            y={(laneY + config.laneLength + 1) * scale}
                            textAnchor="middle"
                            fontSize={10}
                            fontWeight="bold"
                            fill="#78716C"
                          >
                            {lane.id}
                          </text>
                        </g>
                      );
                    })}

                    {/* Bottom ruler (horizontal - garage width) with tick marks and lane labels */}
                    <g transform={`translate(0, ${garageHeight * scale + 5})`}>
                      {/* Main ruler line */}
                      <line
                        x1={0}
                        y1={0}
                        x2={garageWidth * scale}
                        y2={0}
                        stroke="#78716C"
                        strokeWidth={1}
                      />
                      {/* Tick marks every 1m (small) and every 5m (large with label) */}
                      {Array.from({ length: Math.ceil(garageWidth) + 1 }, (_, i) => {
                        const x = i * scale;
                        const is5m = i % 5 === 0;
                        const tickSize = is5m ? 8 : 4;
                        return (
                          <g key={`htick-${i}`}>
                            <line
                              x1={x}
                              y1={0}
                              x2={x}
                              y2={tickSize}
                              stroke="#78716C"
                              strokeWidth={is5m ? 1.5 : 0.5}
                            />
                            {is5m && (
                              <text
                                x={x}
                                y={tickSize + 10}
                                textAnchor="middle"
                                fontSize={8}
                                fill="#78716C"
                              >
                                {i}m
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </g>
                  </>
                )}
              </g>
            </svg>
          </div>

          {/* Drag overlay */}
          <DragOverlay>
            {activeTruck && (
              <svg width={COMMON_CONFIG.TRUCK_WIDTH_TOP_VIEW * scale + 10} height={activeTruck.length * scale + 10}>
                <g transform="translate(5, 5)">
                  <TruckElement
                    truck={{ ...activeTruck, xPosition: 0, yPosition: 0 }}
                    scale={scale}
                  />
                </g>
              </svg>
            )}
          </DragOverlay>
        </DndContext>

        {/* Right navigation button - centered with tall height */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNextArea}
          className={cn(
            'absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-48 rounded hover:bg-amber-100/50 transition-colors',
            dragOverEdge === 'right' && 'bg-amber-200/70'
          )}
        >
          <IconChevronRight className={cn('h-6 w-6', dragOverEdge === 'right' && 'animate-pulse')} />
        </Button>
      </div>

      {/* Footer counts - per-garage breakdown with rounded squares */}
      <div className="flex flex-col items-center gap-1 py-2 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center justify-center gap-4">
          <span className="flex items-center gap-1.5 font-semibold">
            <span className="w-3 h-3 rounded-sm bg-amber-500" />
            Barracão 1: {garageCounts.B1}
          </span>
          <span className="flex items-center gap-1.5 font-semibold">
            <span className="w-3 h-3 rounded-sm bg-amber-500" />
            Barracão 2: {garageCounts.B2}
          </span>
          <span className="flex items-center gap-1.5 font-semibold">
            <span className="w-3 h-3 rounded-sm bg-amber-500" />
            Barracão 3: {garageCounts.B3}
          </span>
          <span className="flex items-center gap-1.5 font-semibold">
            <span className="w-3 h-3 rounded-sm bg-sky-500" />
            Pátio: {inPatio}
          </span>
          <span className="flex items-center gap-1.5 font-semibold">
            <span className="w-3 h-3 rounded-sm bg-gray-500" />
            Total: {trucks.length}
          </span>
        </div>
      </div>
    </div>
  );
}

export default GarageView;
