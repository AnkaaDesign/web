// Patio visualization component for trucks without assigned spots
// Displays trucks in a grid layout that have entered but not yet assigned to a garage

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { GarageTruck } from './garage-view';

// =====================
// Constants
// =====================

const PATIO_CONFIG = {
  TRUCK_WIDTH: 2.8,
  TRUCK_MIN_SPACING: 2,
  DEFAULT_TRUCK_LENGTH: 12,
  TARGET_WIDTH: 25,
} as const;

// =====================
// Types
// =====================

interface PositionedTruck extends GarageTruck {
  xPosition: number;
  yPosition: number;
}

interface PatioLayout {
  trucks: PositionedTruck[];
  width: number;
  height: number;
  columns: number;
  rows: number;
}

// =====================
// Layout Calculation
// =====================

function calculatePatioLayout(trucks: GarageTruck[]): PatioLayout {
  if (trucks.length === 0) {
    return {
      trucks: [],
      width: 0,
      height: 0,
      columns: 0,
      rows: 0,
    };
  }

  const avgTruckLength =
    trucks.reduce((sum, t) => sum + t.length, 0) / trucks.length;
  const truckWidth = PATIO_CONFIG.TRUCK_WIDTH;
  const spacing = PATIO_CONFIG.TRUCK_MIN_SPACING;

  // Calculate columns to fit in a reasonable width
  const columns = Math.max(
    1,
    Math.floor(PATIO_CONFIG.TARGET_WIDTH / (truckWidth + spacing))
  );
  const rows = Math.ceil(trucks.length / columns);

  // Position trucks in grid
  const positionedTrucks: PositionedTruck[] = trucks.map((truck, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    return {
      ...truck,
      xPosition: col * (truckWidth + spacing) + spacing,
      yPosition: row * (avgTruckLength + spacing) + spacing,
    };
  });

  const totalWidth = columns * (truckWidth + spacing) + spacing;
  const totalHeight = rows * (avgTruckLength + spacing) + spacing;

  return {
    trucks: positionedTrucks,
    width: totalWidth,
    height: totalHeight,
    columns,
    rows,
  };
}

// =====================
// Sub-components
// =====================

interface TruckElementProps {
  truck: PositionedTruck;
  scale: number;
  avgLength: number;
}

function TruckElement({ truck, scale, avgLength }: TruckElementProps) {
  const width = PATIO_CONFIG.TRUCK_WIDTH * scale;
  const height = avgLength * scale;
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

  return (
    <g transform={`translate(${x}, ${y})`} className="cursor-pointer">
      {/* Truck body */}
      <rect
        width={width}
        height={height}
        fill={bgColor}
        stroke="#333"
        strokeWidth={2}
        rx={4}
      />
      {/* Task name (rotated 90deg) */}
      <text
        x={width / 2}
        y={height / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={textColor}
        fontSize={Math.min(12, width * 0.8)}
        fontWeight="bold"
        transform={`rotate(-90, ${width / 2}, ${height / 2})`}
        style={{ pointerEvents: 'none' }}
      >
        {truck.taskName?.slice(0, 20) || 'N/A'}
      </text>
      {/* Length label at top */}
      <text
        x={width / 2}
        y={12}
        textAnchor="middle"
        fill={textColor}
        fontSize={10}
        style={{ pointerEvents: 'none' }}
      >
        {truck.length.toFixed(1).replace('.', ',')}m
      </text>
      {/* Serial number at bottom */}
      {truck.serialNumber && (
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
  );
}

// =====================
// Main Component
// =====================

interface PatioViewProps {
  trucks: GarageTruck[];
  onTruckSelect?: (truckId: string) => void;
  className?: string;
}

export function PatioView({ trucks, onTruckSelect, className }: PatioViewProps) {
  const patioLayout = useMemo(() => calculatePatioLayout(trucks), [trucks]);

  if (trucks.length === 0) {
    return (
      <div className={cn('flex flex-col items-center gap-4 p-8', className)}>
        <h2 className="text-xl font-bold">Pátio</h2>
        <p className="text-muted-foreground text-center">
          Nenhum caminhão no pátio.
          <br />
          Caminhões aparecem aqui quando entram mas ainda não têm vaga atribuída.
        </p>
      </div>
    );
  }

  // Calculate scale to fit container
  const containerWidth = 600;
  const containerHeight = 500;
  const padding = 40;
  const scaleX = (containerWidth - padding * 2) / patioLayout.width;
  const scaleY = (containerHeight - padding * 2) / patioLayout.height;
  const scale = Math.min(scaleX, scaleY, 15); // Cap scale to prevent too large trucks

  const avgLength =
    trucks.reduce((sum, t) => sum + t.length, 0) / trucks.length;

  const svgWidth = patioLayout.width * scale + padding * 2;
  const svgHeight = patioLayout.height * scale + padding * 2;

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-bold">Pátio</h2>
        <span className="text-sm text-muted-foreground">
          ({trucks.length} caminhão{trucks.length !== 1 ? 'ões' : ''})
        </span>
      </div>

      {/* Patio SVG */}
      <div className="border rounded-lg bg-muted/20 p-4 overflow-auto">
        <svg width={Math.min(svgWidth, containerWidth)} height={Math.min(svgHeight, containerHeight)}>
          <g transform={`translate(${padding}, ${padding})`}>
            {/* Patio boundary */}
            <rect
              x={0}
              y={0}
              width={patioLayout.width * scale}
              height={patioLayout.height * scale}
              fill="none"
              stroke="#94a3b8"
              strokeWidth={2}
              strokeDasharray="8"
            />

            {/* Trucks */}
            {patioLayout.trucks.map((truck) => (
              <g
                key={truck.id}
                onClick={() => onTruckSelect?.(truck.id)}
                style={{ cursor: onTruckSelect ? 'pointer' : 'default' }}
              >
                <TruckElement truck={truck} scale={scale} avgLength={avgLength} />
              </g>
            ))}

            {/* Grid info */}
            <text
              x={patioLayout.width * scale / 2}
              y={-10}
              textAnchor="middle"
              fontSize={10}
              fill="#666"
            >
              {patioLayout.columns} x {patioLayout.rows} ({trucks.length} total)
            </text>
          </g>
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>Clique em um caminhão para atribuir uma vaga</span>
      </div>
    </div>
  );
}

export default PatioView;
