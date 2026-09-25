// Patio visualization component for implements without assigned spots
// Displays implements in a grid layout that have entered but not yet assigned to a garage

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { GarageImplement } from './garage-view';

// =====================
// Constants
// =====================

const PATIO_CONFIG = {
  IMPLEMENT_WIDTH: 2.8,
  IMPLEMENT_MIN_SPACING: 2,
  DEFAULT_IMPLEMENT_LENGTH: 12,
  TARGET_WIDTH: 25,
} as const;

// =====================
// Types
// =====================

interface PositionedImplement extends GarageImplement {
  xPosition: number;
  yPosition: number;
}

interface PatioLayout {
  implementList: PositionedImplement[];
  width: number;
  height: number;
  columns: number;
  rows: number;
}

// =====================
// Layout Calculation
// =====================

function calculatePatioLayout(implementList: GarageImplement[]): PatioLayout {
  if (implementList.length === 0) {
    return {
      implementList: [],
      width: 0,
      height: 0,
      columns: 0,
      rows: 0,
    };
  }

  const avgImplementLength =
    implementList.reduce((sum, t) => sum + t.length, 0) / implementList.length;
  const implementWidth = PATIO_CONFIG.IMPLEMENT_WIDTH;
  const spacing = PATIO_CONFIG.IMPLEMENT_MIN_SPACING;

  // Calculate columns to fit in a reasonable width
  const columns = Math.max(
    1,
    Math.floor(PATIO_CONFIG.TARGET_WIDTH / (implementWidth + spacing))
  );
  const rows = Math.ceil(implementList.length / columns);

  // Position implements in grid
  const positionedImplements: PositionedImplement[] = implementList.map((implement, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    return {
      ...implement,
      xPosition: col * (implementWidth + spacing) + spacing,
      yPosition: row * (avgImplementLength + spacing) + spacing,
    };
  });

  const totalWidth = columns * (implementWidth + spacing) + spacing;
  const totalHeight = rows * (avgImplementLength + spacing) + spacing;

  return {
    implementList: positionedImplements,
    width: totalWidth,
    height: totalHeight,
    columns,
    rows,
  };
}

// =====================
// Sub-components
// =====================

interface ImplementElementProps {
  implement: PositionedImplement;
  scale: number;
  avgLength: number;
}

function ImplementElement({ implement, scale, avgLength }: ImplementElementProps) {
  const width = PATIO_CONFIG.IMPLEMENT_WIDTH * scale;
  const height = avgLength * scale;
  const x = implement.xPosition * scale;
  const y = implement.yPosition * scale;
  const bgColor = implement.paintHex || '#ffffff';

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
      {/* Implement body */}
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
        {implement.taskName?.slice(0, 20) || 'N/A'}
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
        {implement.length.toFixed(1).replace('.', ',')}m
      </text>
      {/* Serial number at bottom */}
      {implement.serialNumber && (
        <text
          x={width / 2}
          y={height - 6}
          textAnchor="middle"
          fill={textColor}
          fontSize={8}
          style={{ pointerEvents: 'none' }}
        >
          {implement.serialNumber}
        </text>
      )}
    </g>
  );
}

// =====================
// Main Component
// =====================

interface PatioViewProps {
  implementList: GarageImplement[];
  onImplementSelect?: (implementId: string) => void;
  className?: string;
}

export function PatioView({ implementList, onImplementSelect, className }: PatioViewProps) {
  const patioLayout = useMemo(() => calculatePatioLayout(implementList), [implementList]);

  if (implementList.length === 0) {
    return (
      <div className={cn('flex flex-col items-center gap-4 p-8', className)}>
        <h2 className="text-xl font-bold">Pátio</h2>
        <p className="text-muted-foreground text-center">
          Nenhum implemento no pátio.
          <br />
          Implementos aparecem aqui quando entram mas ainda não têm vaga atribuída.
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
  const scale = Math.min(scaleX, scaleY, 15); // Cap scale to prevent too large implements

  const avgLength =
    implementList.reduce((sum, t) => sum + t.length, 0) / implementList.length;

  const svgWidth = patioLayout.width * scale + padding * 2;
  const svgHeight = patioLayout.height * scale + padding * 2;

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-bold">Pátio</h2>
        <span className="text-sm text-muted-foreground">
          ({implementList.length} implemento{implementList.length !== 1 ? 's' : ''})
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

            {/* Implements */}
            {patioLayout.implementList.map((implement) => (
              <g
                key={implement.id}
                onClick={() => onImplementSelect?.(implement.id)}
                style={{ cursor: onImplementSelect ? 'pointer' : 'default' }}
              >
                <ImplementElement implement={implement} scale={scale} avgLength={avgLength} />
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
              {patioLayout.columns} x {patioLayout.rows} ({implementList.length} total)
            </text>
          </g>
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>Clique em um implemento para atribuir uma vaga</span>
      </div>
    </div>
  );
}

export default PatioView;
