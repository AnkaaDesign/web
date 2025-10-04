import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconLayout2 } from "@tabler/icons-react";
import type { Garage, GarageLane, ParkingSpot } from "../../../../types";

interface GarageLayoutPreviewProps {
  garage: Garage & {
    lanes?: (GarageLane & {
      parkingSpots?: ParkingSpot[];
    })[];
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

export const GarageLayoutPreview: React.FC<GarageLayoutPreviewProps> = ({
  garage,
  className,
}) => {
  const layout = useMemo(() => {
    if (!garage) return null;

    // Calculate scale to fit the layout in a reasonable viewport
    const maxWidth = 400;
    const maxHeight = 300;
    const scale = Math.min(maxWidth / garage.width, maxHeight / garage.length);

    // Add margin for dimensions
    const margin = 40;
    const viewBoxWidth = maxWidth + 2 * margin;
    const viewBoxHeight = maxHeight + 2 * margin;

    // Scale dimensions
    const scaledWidth = garage.width * scale;
    const scaledLength = garage.length * scale;

    // Position the garage in the center of the viewbox
    const garageX = margin;
    const garageY = margin;

    return {
      scale,
      viewBoxWidth,
      viewBoxHeight,
      garageX,
      garageY,
      scaledWidth,
      scaledLength,
      margin,
    };
  }, [garage]);

  if (!layout) return null;

  const { scale, viewBoxWidth, viewBoxHeight, garageX, garageY, scaledWidth, scaledLength, margin } = layout;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-xl">
          <div className="p-2 rounded-lg bg-primary/10">
            <IconLayout2 className="h-5 w-5 text-primary" />
          </div>
          Layout da Garagem
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
            {/* Garage outline */}
            <rect
              x={garageX}
              y={garageY}
              width={scaledWidth}
              height={scaledLength}
              fill="none"
              stroke="#333"
              strokeWidth="2"
              className="stroke-foreground"
            />

            {/* Garage fill */}
            <rect
              x={garageX}
              y={garageY}
              width={scaledWidth}
              height={scaledLength}
              fill="#f8f9fa"
              className="fill-muted/30"
            />

            {/* Lanes */}
            {garage.lanes?.map((lane, index) => {
              const laneX = garageX + (lane.xPosition * scale);
              const laneY = garageY + (lane.yPosition * scale);
              const laneWidth = lane.width * scale;
              const laneLength = lane.length * scale;

              return (
                <g key={lane.id}>
                  {/* Lane rectangle */}
                  <rect
                    x={laneX}
                    y={laneY}
                    width={laneWidth}
                    height={laneLength}
                    fill="#e3f2fd"
                    stroke="#1976d2"
                    strokeWidth="1"
                    className="fill-blue-50 stroke-blue-600 dark:fill-blue-900/20 dark:stroke-blue-400"
                  />

                  {/* Lane label */}
                  <text
                    x={laneX + laneWidth / 2}
                    y={laneY + laneLength / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-blue-700 dark:fill-blue-300 text-xs font-medium"
                  >
                    Faixa {index + 1}
                  </text>

                  {/* Parking spots */}
                  {lane.parkingSpots?.map((spot, spotIndex) => {
                    // Calculate spot position within the lane
                    // Assume spots are arranged in a grid within the lane
                    const spotsPerRow = Math.floor(laneWidth / 30); // Assume 30px per spot
                    const rowIndex = Math.floor(spotIndex / spotsPerRow);
                    const colIndex = spotIndex % spotsPerRow;

                    const spotSize = Math.min(25, laneWidth / spotsPerRow - 2);
                    const spotX = laneX + (colIndex * (spotSize + 2)) + 1;
                    const spotY = laneY + (rowIndex * (spotSize + 2)) + 1;

                    // Only draw spot if it fits within the lane
                    if (spotX + spotSize <= laneX + laneWidth && spotY + spotSize <= laneY + laneLength) {
                      return (
                        <rect
                          key={spot.id}
                          x={spotX}
                          y={spotY}
                          width={spotSize}
                          height={spotSize}
                          fill="#c8e6c9"
                          stroke="#4caf50"
                          strokeWidth="1"
                          className="fill-green-100 stroke-green-500 dark:fill-green-900/30 dark:stroke-green-400"
                        />
                      );
                    }
                    return null;
                  })}
                </g>
              );
            })}

            {/* Main garage dimensions */}
            <DimensionLine
              x1={garageX}
              y1={garageY + scaledLength}
              x2={garageX + scaledWidth}
              y2={garageY + scaledLength}
              value={garage.width}
              orientation="horizontal"
              offset={15}
            />

            <DimensionLine
              x1={garageX}
              y1={garageY}
              x2={garageX}
              y2={garageY + scaledLength}
              value={garage.length}
              orientation="vertical"
              offset={15}
            />

            {/* Lane dimensions (for the first lane as example) */}
            {garage.lanes && garage.lanes.length > 0 && garage.lanes[0] && (
              <>
                <DimensionLine
                  x1={garageX + (garage.lanes[0].xPosition * scale)}
                  y1={garageY + (garage.lanes[0].yPosition * scale)}
                  x2={garageX + (garage.lanes[0].xPosition * scale) + (garage.lanes[0].width * scale)}
                  y2={garageY + (garage.lanes[0].yPosition * scale)}
                  value={garage.lanes[0].width}
                  orientation="horizontal"
                  offset={-10}
                />
              </>
            )}
          </svg>
        </div>

        {/* Legend */}
        <div className="mt-4 flex justify-center">
          <div className="flex gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-50 border border-blue-600 rounded dark:bg-blue-900/20 dark:border-blue-400"></div>
              <span className="text-muted-foreground">Faixas</span>
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
      </CardContent>
    </Card>
  );
};