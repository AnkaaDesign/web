import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconLayout2 } from "@tabler/icons-react";
import type { GarageLane, ParkingSpot, Garage } from "../../../../types";

interface GarageLaneLayoutPreviewProps {
  garageLane: GarageLane & {
    parkingSpots?: ParkingSpot[];
    garage?: Garage;
  };
  className?: string;
}

interface DimensionLineProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  value: number;
  orientation: "horizontal" | "vertical";
  offset?: number;
}

const DimensionLine: React.FC<DimensionLineProps> = ({
  x1,
  y1,
  x2,
  y2,
  value,
  orientation,
  offset = 20,
}) => {
  const isHorizontal = orientation === "horizontal";

  // Calculate the dimension line position with offset
  const dimY = isHorizontal ? y1 - offset : y1;
  const dimX = isHorizontal ? x1 : x1 - offset;
  const dimX2 = isHorizontal ? x2 : x1 - offset;
  const dimY2 = isHorizontal ? y1 - offset : y2;

  // Calculate text position (center of the line)
  const textX = isHorizontal ? (dimX + dimX2) / 2 : dimX - 10;
  const textY = isHorizontal ? dimY - 5 : (dimY + dimY2) / 2;

  // Arrow size
  const arrowSize = 4;

  return (
    <g className="dimension-line" stroke="#0066cc" strokeWidth="1" fill="#0066cc">
      {/* Main dimension line */}
      <line x1={dimX} y1={dimY} x2={dimX2} y2={dimY2} />

      {/* Extension lines */}
      {isHorizontal ? (
        <>
          <line x1={x1} y1={y1} x2={x1} y2={dimY + 5} strokeDasharray="2,2" />
          <line x1={x2} y1={y2} x2={x2} y2={dimY + 5} strokeDasharray="2,2" />
        </>
      ) : (
        <>
          <line x1={x1} y1={y1} x2={dimX + 5} y2={y1} strokeDasharray="2,2" />
          <line x1={x2} y1={y2} x2={dimX + 5} y2={y2} strokeDasharray="2,2" />
        </>
      )}

      {/* Arrow at start */}
      {isHorizontal ? (
        <polygon
          points={`${dimX},${dimY} ${dimX + arrowSize},${dimY - arrowSize / 2} ${dimX + arrowSize},${dimY + arrowSize / 2}`}
        />
      ) : (
        <polygon
          points={`${dimX},${dimY} ${dimX - arrowSize / 2},${dimY + arrowSize} ${dimX + arrowSize / 2},${dimY + arrowSize}`}
        />
      )}

      {/* Arrow at end */}
      {isHorizontal ? (
        <polygon
          points={`${dimX2},${dimY2} ${dimX2 - arrowSize},${dimY2 - arrowSize / 2} ${dimX2 - arrowSize},${dimY2 + arrowSize / 2}`}
        />
      ) : (
        <polygon
          points={`${dimX2},${dimY2} ${dimX2 - arrowSize / 2},${dimY2 - arrowSize} ${dimX2 + arrowSize / 2},${dimY2 - arrowSize}`}
        />
      )}

      {/* Dimension text */}
      <text
        x={textX}
        y={textY}
        textAnchor="middle"
        dominantBaseline={isHorizontal ? "auto" : "middle"}
        className="fill-[#0066cc] text-xs font-medium"
        transform={isHorizontal ? undefined : `rotate(-90, ${textX}, ${textY})`}
      >
        {value.toFixed(1)}m
      </text>
    </g>
  );
};

export const GarageLaneLayoutPreview: React.FC<GarageLaneLayoutPreviewProps> = ({
  garageLane,
  className,
}) => {
  const layout = useMemo(() => {
    if (!garageLane) return null;

    // Calculate scale to fit the layout in a reasonable viewport
    const maxWidth = 400;
    const maxHeight = 200;
    const scale = Math.min(maxWidth / garageLane.width, maxHeight / garageLane.length);

    // Add margin for dimensions
    const margin = 40;
    const viewBoxWidth = maxWidth + 2 * margin;
    const viewBoxHeight = maxHeight + 2 * margin;

    // Scale dimensions
    const scaledWidth = garageLane.width * scale;
    const scaledLength = garageLane.length * scale;

    // Position the lane in the center of the viewbox
    const laneX = margin;
    const laneY = margin;

    return {
      scale,
      viewBoxWidth,
      viewBoxHeight,
      laneX,
      laneY,
      scaledWidth,
      scaledLength,
      margin,
    };
  }, [garageLane]);

  if (!layout) return null;

  const { scale, viewBoxWidth, viewBoxHeight, laneX, laneY, scaledWidth, scaledLength, margin } = layout;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-xl">
          <div className="p-2 rounded-lg bg-primary/10">
            <IconLayout2 className="h-5 w-5 text-primary" />
          </div>
          Layout da Faixa
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <svg
            width={viewBoxWidth}
            height={viewBoxHeight}
            viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
            className="border border-border rounded-lg bg-background"
          >
            {/* Lane outline */}
            <rect
              x={laneX}
              y={laneY}
              width={scaledWidth}
              height={scaledLength}
              fill="#e3f2fd"
              stroke="#1976d2"
              strokeWidth="2"
              className="fill-blue-50 stroke-blue-600 dark:fill-blue-900/20 dark:stroke-blue-400"
            />

            {/* Lane label */}
            <text
              x={laneX + scaledWidth / 2}
              y={laneY + scaledLength / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-blue-700 dark:fill-blue-300 text-sm font-medium"
            >
              Faixa
            </text>

            {/* Parking spots */}
            {garageLane.parkingSpots?.map((spot, spotIndex) => {
              // Calculate spot position within the lane
              // Arrange spots in a grid within the lane
              const spotsPerRow = Math.floor(scaledWidth / 35); // 35px per spot for better visibility
              const spotsPerColumn = Math.floor(scaledLength / 35);
              const maxSpots = spotsPerRow * spotsPerColumn;

              // Only show spots that fit
              if (spotIndex >= maxSpots) return null;

              const rowIndex = Math.floor(spotIndex / spotsPerRow);
              const colIndex = spotIndex % spotsPerRow;

              const spotSize = Math.min(30, Math.min(scaledWidth / spotsPerRow - 3, scaledLength / spotsPerColumn - 3));
              const spotX = laneX + (colIndex * (spotSize + 3)) + 3;
              const spotY = laneY + (rowIndex * (spotSize + 3)) + 3;

              return (
                <g key={spot.id}>
                  <rect
                    x={spotX}
                    y={spotY}
                    width={spotSize}
                    height={spotSize}
                    fill="#c8e6c9"
                    stroke="#4caf50"
                    strokeWidth="1"
                    className="fill-green-100 stroke-green-500 dark:fill-green-900/30 dark:stroke-green-400"
                  />

                  {/* Spot name if space allows */}
                  {spotSize > 20 && (
                    <text
                      x={spotX + spotSize / 2}
                      y={spotY + spotSize / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-green-700 dark:fill-green-300 text-xs font-medium"
                    >
                      {spot.name.slice(-2)} {/* Show last 2 characters of name */}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Dimensions */}
            <DimensionLine
              x1={laneX}
              y1={laneY + scaledLength}
              x2={laneX + scaledWidth}
              y2={laneY + scaledLength}
              value={garageLane.width}
              orientation="horizontal"
              offset={15}
            />

            <DimensionLine
              x1={laneX}
              y1={laneY}
              x2={laneX}
              y2={laneY + scaledLength}
              value={garageLane.length}
              orientation="vertical"
              offset={15}
            />

            {/* Position indicators if we have garage context */}
            {garageLane.garage && (
              <>
                {/* Position text */}
                <text
                  x={laneX + scaledWidth + 10}
                  y={laneY + 10}
                  className="fill-muted-foreground text-xs"
                >
                  Pos: ({garageLane.xPosition}, {garageLane.yPosition})
                </text>
              </>
            )}
          </svg>
        </div>

        {/* Legend */}
        <div className="mt-4 flex justify-center">
          <div className="flex gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-50 border border-blue-600 rounded dark:bg-blue-900/20 dark:border-blue-400"></div>
              <span className="text-muted-foreground">Faixa</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 border border-green-500 rounded dark:bg-green-900/30 dark:border-green-400"></div>
              <span className="text-muted-foreground">Vagas</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-[#0066cc] rounded"></div>
              <span className="text-muted-foreground">Dimensões</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 grid grid-cols-3 gap-4 text-center text-sm">
          <div>
            <p className="font-semibold text-lg">{garageLane.parkingSpots?.length || 0}</p>
            <p className="text-muted-foreground">Vagas</p>
          </div>
          <div>
            <p className="font-semibold text-lg">{(garageLane.width * garageLane.length).toFixed(1)}</p>
            <p className="text-muted-foreground">m² área</p>
          </div>
          <div>
            <p className="font-semibold text-lg">
              {garageLane.parkingSpots && garageLane.parkingSpots.length > 0
                ? (garageLane.width * garageLane.length / garageLane.parkingSpots.length).toFixed(1)
                : '0'
              }
            </p>
            <p className="text-muted-foreground">m²/vaga</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};