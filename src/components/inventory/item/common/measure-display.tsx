import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { IconRuler, IconScale, IconBox, IconRuler2, IconChevronDown, IconChevronUp, IconCircle, IconBolt, IconHash, IconDimensions } from "@tabler/icons-react";
import type { Item, Measure } from "../../../../types";
import { MEASURE_UNIT_LABELS, MEASURE_TYPE_LABELS, MEASURE_UNIT, MEASURE_TYPE, MEASURE_TYPE_ORDER } from "../../../../constants";
import { measureUtils } from "../../../../utils";
import { cn } from "@/lib/utils";

interface MeasureDisplayProps {
  item: Item;
  showConversions?: boolean;
  compact?: boolean;
  showGrouped?: boolean;
  className?: string;
}

interface MeasureGroup {
  type: MEASURE_TYPE;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  measures: Measure[];
  primaryMeasure?: { value: number; unit: MEASURE_UNIT } | null;
}

const MEASURE_TYPE_ICONS = {
  [MEASURE_TYPE.WEIGHT]: IconScale,
  [MEASURE_TYPE.VOLUME]: IconBox,
  [MEASURE_TYPE.LENGTH]: IconRuler,
  [MEASURE_TYPE.AREA]: IconRuler2,
  [MEASURE_TYPE.COUNT]: IconHash,
  [MEASURE_TYPE.DIAMETER]: IconCircle,
  [MEASURE_TYPE.THREAD]: IconBolt,
  [MEASURE_TYPE.ELECTRICAL]: IconBolt,
  [MEASURE_TYPE.SIZE]: IconDimensions,
} as const;

/**
 * Sort measures by their type order (WEIGHT → VOLUME → LENGTH → AREA → COUNT → DIAMETER → THREAD → ELECTRICAL → SIZE)
 */
const sortMeasuresByType = (measures: Measure[]): Measure[] => {
  return [...measures].sort((a, b) => {
    const orderA = MEASURE_TYPE_ORDER[a.measureType] ?? 999;
    const orderB = MEASURE_TYPE_ORDER[b.measureType] ?? 999;
    return orderA - orderB;
  });
};

export function MeasureDisplay({ item, showConversions = false, compact = false, showGrouped = true, className }: MeasureDisplayProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<MEASURE_TYPE>>(new Set());
  const [conversionPopoverOpen, setConversionPopoverOpen] = useState<string | null>(null);

  // Get all measures from relations and sort by type order
  const allMeasures = sortMeasuresByType(item.measures || []);

  // Check if we have any measure data
  const hasAnyMeasures = allMeasures.length > 0;

  if (!hasAnyMeasures) {
    return <div className={cn("text-muted-foreground text-sm", className)}>Nenhuma medida definida</div>;
  }

  // Group measures by type (already sorted)
  const measureGroups: MeasureGroup[] = Object.values(MEASURE_TYPE)
    .map((type) => {
      const typeMeasures = allMeasures.filter((m) => m.measureType === type);
      const Icon = MEASURE_TYPE_ICONS[type as keyof typeof MEASURE_TYPE_ICONS] || IconHash; // Fallback to IconHash if not found

      return {
        type,
        label: MEASURE_TYPE_LABELS[type as keyof typeof MEASURE_TYPE_LABELS],
        icon: Icon,
        measures: typeMeasures,
        primaryMeasure: null,
      };
    })
    .filter((group) => group.measures.length > 0);

  const toggleGroupExpansion = (type: MEASURE_TYPE) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(type)) {
      newExpanded.delete(type);
    } else {
      newExpanded.add(type);
    }
    setExpandedGroups(newExpanded);
  };

  const renderMeasureValue = (value: number | null, unit: MEASURE_UNIT | null, measureId?: string, measureType?: MEASURE_TYPE) => {
    // Handle PPE sizes that only have unit (letter sizes) or value (numeric sizes)
    let formatted: string;
    if (value !== null && unit !== null) {
      const measure = { value, unit };
      formatted = measureUtils.formatMeasure(measure, true, 2, measureType);
    } else if (unit !== null) {
      // For PPE sizes that only have unit (like P, M, G)
      formatted = MEASURE_UNIT_LABELS[unit] || unit;
    } else if (value !== null) {
      // For numeric values without unit
      formatted = value.toString();
    } else {
      formatted = "-";
    }

    if (!showConversions) {
      return <span className="font-medium">{formatted}</span>;
    }

    const conversionKey = measureId || `${value}-${unit}`;

    // Only show conversions if both value and unit are present
    if (value === null || unit === null) {
      return <span className="font-medium">{formatted}</span>;
    }

    const compatibleUnits = Object.values(MEASURE_UNIT).filter((u) => measureUtils.areUnitsCompatible(unit, u) && u !== unit);

    if (compatibleUnits.length === 0) {
      return <span className="font-medium">{formatted}</span>;
    }

    return (
      <Popover open={conversionPopoverOpen === conversionKey} onOpenChange={(open) => setConversionPopoverOpen(open ? conversionKey : null)}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-auto p-1 font-medium text-foreground hover:bg-muted/50">
            {formatted}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64" side="top">
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Conversões</h4>
            <Separator />
            <div className="space-y-1">
              {compatibleUnits.map((toUnit) => {
                const conversion = measureUtils.convertUnits(value, unit, toUnit);
                if (!conversion.success) return null;

                const convertedMeasure = { value: conversion.value, unit: toUnit };
                return (
                  <div key={toUnit} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{MEASURE_UNIT_LABELS[toUnit]}</span>
                    <span className="font-medium">{measureUtils.formatMeasure(convertedMeasure)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  if (compact) {
    // Compact display shows first measure (already sorted by type) and count of additional measures
    const firstMeasure = allMeasures[0];
    const additionalCount = allMeasures.length - 1;

    return (
      <div className={cn("flex items-center gap-2", className)}>
        {firstMeasure && (
          <div className="flex items-center gap-1">
            <IconRuler className="h-3 w-3 text-muted-foreground" />
            {renderMeasureValue(firstMeasure.value, firstMeasure.unit, firstMeasure.id, firstMeasure.measureType)}
          </div>
        )}
        {additionalCount > 0 && (
          <Badge variant="outline" className="text-xs">
            +{additionalCount} medidas
          </Badge>
        )}
      </div>
    );
  }

  if (!showGrouped) {
    // Simple list display (measures already sorted by type)
    return (
      <div className={cn("space-y-2", className)}>
        {allMeasures.map((measure) => (
          <div key={measure.id} className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {MEASURE_TYPE_LABELS[measure.measureType]}
            </Badge>
            {renderMeasureValue(measure.value, measure.unit, measure.id, measure.measureType)}
          </div>
        ))}
      </div>
    );
  }

  // Grouped display by measure type
  return (
    <div className={cn("space-y-3", className)}>
      {measureGroups.map((group) => {
        const Icon = MEASURE_TYPE_ICONS[group.type as keyof typeof MEASURE_TYPE_ICONS];
        const isExpanded = expandedGroups.has(group.type);
        const hasMultipleMeasures = group.measures.length > 1;

        return (
          <div key={group.type} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                <span className="text-sm font-medium text-muted-foreground">{group.label}</span>
                <Badge variant="secondary" className="text-xs">
                  {group.measures.length}
                </Badge>
              </div>
              {hasMultipleMeasures && (
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => toggleGroupExpansion(group.type)}>
                  {isExpanded ? <IconChevronUp className="h-3 w-3" /> : <IconChevronDown className="h-3 w-3" />}
                </Button>
              )}
            </div>

            <div className="ml-6 space-y-1">
              {/* Show first measure or all if expanded */}
              {group.measures.length > 0 && (
                <>
                  {isExpanded ? (
                    group.measures.map((measure) => (
                      <div key={measure.id} className="flex items-center gap-2">
                        {renderMeasureValue(measure.value, measure.unit, measure.id, measure.measureType)}
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center gap-2">
                      {renderMeasureValue(group.measures[0].value, group.measures[0].unit, group.measures[0].id, group.measures[0].measureType)}
                      {group.measures.length > 1 && <span className="text-xs text-muted-foreground">+{group.measures.length - 1} mais</span>}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Simplified version for table cells
export function MeasureDisplayCompact({ item, className }: { item: Item; className?: string }) {
  // Get all measures from item
  const allMeasures = item.measures || [];

  // If no measures at all
  if (allMeasures.length === 0) {
    return <div className="text-muted-foreground text-sm">-</div>;
  }

  // Sort measures by type order before displaying
  const sortedMeasures = sortMeasuresByType(allMeasures);

  // Format all measures into a compact string
  const measureStrings: string[] = [];

  // Add all measures (now sorted)
  sortedMeasures.forEach((measure) => {
    // Only format if both value and unit are present
    if (measure.value !== null && measure.unit !== null) {
      measureStrings.push(
        measureUtils.formatMeasure(
          {
            value: measure.value,
            unit: measure.unit,
          },
          true,
          2,
          measure.measureType,
        ),
      );
    } else if (measure.unit !== null) {
      // For PPE sizes that only have unit (like P, M, G)
      measureStrings.push(MEASURE_UNIT_LABELS[measure.unit] || measure.unit);
    } else if (measure.value !== null) {
      // For numeric values without unit
      measureStrings.push(measure.value.toString());
    }
  });

  // Join all measures with dash
  return (
    <div className={cn("text-sm", className)}>
      {measureStrings.length > 2 ? (
        <span title={measureStrings.join(" - ")}>
          {measureStrings.slice(0, 2).join(" - ")} <span className="text-muted-foreground">+{measureStrings.length - 2}</span>
        </span>
      ) : (
        measureStrings.join(" - ")
      )}
    </div>
  );
}

// Full version for detail cards
export function MeasureDisplayFull({ item, className }: { item: Item; className?: string }) {
  return <MeasureDisplay item={item} compact={false} showConversions={true} showGrouped={true} className={className} />;
}
