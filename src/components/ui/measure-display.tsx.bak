import { cn } from "@/lib/utils";
import { MEASURE_UNIT, MEASURE_UNIT_LABELS, MEASURE_TYPE, MEASURE_TYPE_LABELS } from "../../constants";
import { formatNumber, roundToDecimals } from "../../utils";
import { canConvertUnits, convertValue, getMeasureUnitCategory } from "../../types";
import { Badge } from "./badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";
import { IconScale, IconRuler2, IconDroplet, IconHash, IconSquare } from "@tabler/icons-react";

interface MeasureDisplayProps {
  value?: number | null;
  unit?: MEASURE_UNIT | null;
  measureType?: MEASURE_TYPE;
  className?: string;
  showUnit?: boolean;
  showMeasureType?: boolean;
  showIcon?: boolean;
  showConversions?: boolean;
  conversionsTo?: MEASURE_UNIT[];
  format?: "short" | "long" | "verbose";
  decimals?: number;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "secondary" | "outline" | "badge";
  showTooltip?: boolean;
  tooltipContent?: string;
  prefix?: string;
  suffix?: string;
}

export function MeasureDisplay({
  value,
  unit,
  measureType,
  className,
  showUnit = true,
  showMeasureType = false,
  showIcon = false,
  showConversions = false,
  conversionsTo = [],
  format = "short",
  decimals = 2,
  size = "md",
  variant = "default",
  showTooltip = false,
  tooltipContent,
  prefix,
  suffix,
}: MeasureDisplayProps) {
  // Handle null/undefined values - display fallback or nothing
  if ((value === null || value === undefined) && (!unit || unit === null)) {
    return <span className={cn("text-muted-foreground text-sm", className)}>-</span>;
  }

  // Format the main value
  const formatValue = (val: number, precision: number = decimals) => {
    return formatNumber(roundToDecimals(val, precision));
  };

  // Get the appropriate icon for the measure type
  const getMeasureIcon = (type: MEASURE_TYPE) => {
    const iconProps = { className: "h-4 w-4" };
    switch (type) {
      case MEASURE_TYPE.WEIGHT:
        return <IconScale {...iconProps} />;
      case MEASURE_TYPE.LENGTH:
        return <IconRuler2 {...iconProps} />;
      case MEASURE_TYPE.VOLUME:
        return <IconDroplet {...iconProps} />;
      case MEASURE_TYPE.COUNT:
        return <IconHash {...iconProps} />;
      case MEASURE_TYPE.AREA:
        return <IconSquare {...iconProps} />;
      default:
        return <IconHash {...iconProps} />;
    }
  };

  // Get measure type from unit if not provided
  const effectiveMeasureType = measureType || (unit ? getMeasureTypeFromUnit(unit) : MEASURE_TYPE.COUNT);

  // Format unit label based on format type
  const getUnitLabel = () => {
    if (!unit) return "";

    const baseLabel = MEASURE_UNIT_LABELS[unit];

    switch (format) {
      case "long":
        return getVerboseUnitName(unit, value || 1);
      case "verbose":
        return `${getVerboseUnitName(unit, value || 1)} (${baseLabel})`;
      default:
        return baseLabel;
    }
  };

  // Get verbose unit names in Portuguese
  const getVerboseUnitName = (unit: MEASURE_UNIT, value: number) => {
    const isPlural = value !== 1;
    switch (unit) {
      case MEASURE_UNIT.GRAM:
        return isPlural ? "gramas" : "grama";
      case MEASURE_UNIT.KILOGRAM:
        return isPlural ? "quilogramas" : "quilograma";
      case MEASURE_UNIT.MILLILITER:
        return isPlural ? "mililitros" : "mililitro";
      case MEASURE_UNIT.LITER:
        return isPlural ? "litros" : "litro";
      case MEASURE_UNIT.MILLIMETER:
        return isPlural ? "milímetros" : "milímetro";
      case MEASURE_UNIT.CENTIMETER:
        return isPlural ? "centímetros" : "centímetro";
      case MEASURE_UNIT.METER:
        return isPlural ? "metros" : "metro";
      case MEASURE_UNIT.INCHES:
        return isPlural ? "polegadas" : "polegada";
      case MEASURE_UNIT.UNIT:
        return isPlural ? "unidades" : "unidade";
      case MEASURE_UNIT.PAIR:
        return isPlural ? "pares" : "par";
      case MEASURE_UNIT.DOZEN:
        return isPlural ? "dúzias" : "dúzia";
      case MEASURE_UNIT.HUNDRED:
        return isPlural ? "centenas" : "centena";
      case MEASURE_UNIT.THOUSAND:
        return isPlural ? "milhares" : "milhar";
      case MEASURE_UNIT.PACKAGE:
        return isPlural ? "pacotes" : "pacote";
      case MEASURE_UNIT.BOX:
        return isPlural ? "caixas" : "caixa";
      case MEASURE_UNIT.ROLL:
        return isPlural ? "rolos" : "rolo";
      case MEASURE_UNIT.SHEET:
        return isPlural ? "folhas" : "folha";
      case MEASURE_UNIT.SET:
        return isPlural ? "conjuntos" : "conjunto";
      default:
        return MEASURE_UNIT_LABELS[unit];
    }
  };

  // Calculate conversions
  const getConversions = () => {
    if (!showConversions || conversionsTo.length === 0 || !value || !unit) return [];

    return conversionsTo
      .filter((toUnit) => toUnit !== unit && canConvertUnits(unit, toUnit))
      .map((toUnit) => {
        const convertedValue = convertValue(value, unit, toUnit);
        if (convertedValue === null) return null;

        return {
          value: convertedValue,
          unit: toUnit,
          label: MEASURE_UNIT_LABELS[toUnit],
        };
      })
      .filter(Boolean);
  };

  // Build the display text
  const buildDisplayText = () => {
    const parts = [];

    if (prefix) parts.push(prefix);

    // For SIZE measures (PPE), show either value or unit
    if (measureType === MEASURE_TYPE.SIZE) {
      if (unit) {
        // Letter sizes (P, M, G, GG, etc.)
        parts.push(getUnitLabel());
      } else if (value !== null && value !== undefined) {
        // Numeric sizes (36, 38, 40, etc.)
        parts.push(formatValue(value));
      }
    } else {
      // For other measure types, show value and unit if available
      if (value !== null && value !== undefined) {
        parts.push(formatValue(value));
      }
      if (showUnit && unit) {
        parts.push(getUnitLabel());
      }
    }

    if (suffix) parts.push(suffix);

    return parts.join(" ");
  };

  const displayText = buildDisplayText();
  const conversions = getConversions();

  // Size-based styles
  const sizeStyles = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  // Variant-based rendering
  const renderContent = () => {
    const content = (
      <div className={cn("flex items-center gap-2", sizeStyles[size], className)}>
        {showIcon && getMeasureIcon(effectiveMeasureType)}

        <span className="font-medium">{displayText}</span>

        {showMeasureType && (
          <Badge variant="secondary" className="text-xs">
            {MEASURE_TYPE_LABELS[effectiveMeasureType]}
          </Badge>
        )}
      </div>
    );

    if (variant === "badge") {
      return (
        <Badge variant="outline" className={cn("gap-2", className)}>
          {showIcon && getMeasureIcon(effectiveMeasureType)}
          {displayText}
        </Badge>
      );
    }

    return content;
  };

  // Tooltip content
  const getTooltipContent = () => {
    if (tooltipContent) return tooltipContent;

    const parts = [];

    if (value !== null && value !== undefined) {
      parts.push(`Valor: ${formatValue(value, 4)}`);
    }

    if (unit) {
      parts.push(`Unidade: ${getVerboseUnitName(unit, value || 1)}`);
    }

    parts.push(`Tipo: ${MEASURE_TYPE_LABELS[effectiveMeasureType]}`);

    if (conversions.length > 0) {
      parts.push("Conversões:");
      conversions.forEach((conv) => {
        if (conv) {
          parts.push(`• ${formatValue(conv.value, 4)} ${conv.label}`);
        }
      });
    }

    return parts.join("\n");
  };

  const mainContent = renderContent();

  // Wrap with tooltip if needed
  if (showTooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="cursor-help">{mainContent}</div>
          </TooltipTrigger>
          <TooltipContent>
            <pre className="text-xs whitespace-pre-line">{getTooltipContent()}</pre>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Show conversions inline if requested
  if (showConversions && conversions.length > 0) {
    return (
      <div className="space-y-1">
        {mainContent}
        <div className="text-xs text-muted-foreground space-y-1">
          {conversions.map(
            (conv, index) =>
              conv && (
                <div key={index} className="flex items-center gap-1">
                  <span>≈</span>
                  <span>
                    {formatValue(conv.value)} {conv.label}
                  </span>
                </div>
              ),
          )}
        </div>
      </div>
    );
  }

  return mainContent;
}

// Helper function to determine measure type from unit
function getMeasureTypeFromUnit(unit: MEASURE_UNIT): MEASURE_TYPE {
  const category = getMeasureUnitCategory(unit);
  switch (category) {
    case "Peso":
      return MEASURE_TYPE.WEIGHT;
    case "Volume":
      return MEASURE_TYPE.VOLUME;
    case "Comprimento":
      return MEASURE_TYPE.LENGTH;
    case "Contagem":
      return MEASURE_TYPE.COUNT;
    case "Embalagem":
      return MEASURE_TYPE.COUNT;
    default:
      return MEASURE_TYPE.COUNT;
  }
}

// Preset configurations for common display scenarios
export const MEASURE_DISPLAY_PRESETS = {
  // Weight displays
  weightBadge: {
    showIcon: true,
    variant: "badge" as const,
    showTooltip: true,
    showConversions: true,
    conversionsTo: [MEASURE_UNIT.GRAM, MEASURE_UNIT.KILOGRAM],
  },

  // Volume displays
  volumeDetailed: {
    format: "verbose" as const,
    showIcon: true,
    showConversions: true,
    conversionsTo: [MEASURE_UNIT.MILLILITER, MEASURE_UNIT.LITER],
    showTooltip: true,
  },

  // Length displays
  lengthCompact: {
    format: "short" as const,
    size: "sm" as const,
    showConversions: true,
    conversionsTo: [MEASURE_UNIT.MILLIMETER, MEASURE_UNIT.CENTIMETER, MEASURE_UNIT.METER],
  },

  // Count displays
  countSimple: {
    format: "short" as const,
    decimals: 0,
    showIcon: false,
  },

  // Table cell displays
  tableCell: {
    size: "sm" as const,
    format: "short" as const,
    showTooltip: true,
    className: "justify-end",
  },

  // Card displays
  cardHeader: {
    size: "lg" as const,
    format: "long" as const,
    showIcon: true,
    showMeasureType: true,
  },
} as const;
