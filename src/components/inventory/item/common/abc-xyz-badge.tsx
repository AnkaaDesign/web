import React from "react";
import type { Item } from "../../../../types";
import { ABC_CATEGORY, XYZ_CATEGORY, ABC_CATEGORY_LABELS, XYZ_CATEGORY_LABELS } from "../../../../constants";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface AbcXyzBadgeProps {
  item: Item;
  showBoth?: boolean;
  size?: "default" | "sm" | "lg";
  className?: string;
}

// Color schemes for badges
const ABC_BADGE_COLORS = {
  [ABC_CATEGORY.A]: "bg-red-100 text-red-700 hover:bg-red-200",
  [ABC_CATEGORY.B]: "bg-yellow-100 text-yellow-700 hover:bg-yellow-200",
  [ABC_CATEGORY.C]: "bg-green-100 text-green-700 hover:bg-green-200",
};

const XYZ_BADGE_COLORS = {
  [XYZ_CATEGORY.X]: "bg-blue-100 text-blue-700 hover:bg-blue-200",
  [XYZ_CATEGORY.Y]: "bg-purple-100 text-purple-700 hover:bg-purple-200",
  [XYZ_CATEGORY.Z]: "bg-orange-100 text-orange-700 hover:bg-orange-200",
};

const sizeClasses = {
  sm: "text-xs px-2 py-0.5",
  default: "text-sm px-2.5 py-0.5",
  lg: "text-base px-3 py-1",
};

export const AbcXyzBadge: React.FC<AbcXyzBadgeProps> = ({ item, showBoth = true, size = "default", className }) => {
  // Check if categories are valid enum values (not null and not placeholder text)
  const validAbcValues = Object.values(ABC_CATEGORY) as string[];
  const validXyzValues = Object.values(XYZ_CATEGORY) as string[];

  const hasAbcCategory = item.abcCategory !== null && validAbcValues.includes(item.abcCategory);
  const hasXyzCategory = item.xyzCategory !== null && validXyzValues.includes(item.xyzCategory);

  if (!hasAbcCategory && !hasXyzCategory) {
    return null;
  }

  // If showing both and both exist, show combined badge
  if (showBoth && hasAbcCategory && hasXyzCategory) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={cn("font-semibold border-2", sizeClasses[size], className)}>
              {item.abcCategory}
              {item.xyzCategory}
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="space-y-2">
              <div>
                <p className="font-semibold">{ABC_CATEGORY_LABELS[item.abcCategory!]}</p>
                <p className="text-xs">{getAbcDescription(item.abcCategory!)}</p>
              </div>
              <div>
                <p className="font-semibold">{XYZ_CATEGORY_LABELS[item.xyzCategory!]}</p>
                <p className="text-xs">{getXyzDescription(item.xyzCategory!)}</p>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Show individual badges
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {hasAbcCategory && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className={cn("font-semibold", ABC_BADGE_COLORS[item.abcCategory!], sizeClasses[size])}>
                {item.abcCategory}
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="font-semibold">{ABC_CATEGORY_LABELS[item.abcCategory!]}</p>
              <p className="text-xs mt-1">{getAbcDescription(item.abcCategory!)}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {hasXyzCategory && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className={cn("font-semibold", XYZ_BADGE_COLORS[item.xyzCategory!], sizeClasses[size])}>
                {item.xyzCategory}
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="font-semibold">{XYZ_CATEGORY_LABELS[item.xyzCategory!]}</p>
              <p className="text-xs mt-1">{getXyzDescription(item.xyzCategory!)}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
};

// Helper functions for descriptions
function getAbcDescription(category: ABC_CATEGORY): string {
  const descriptions = {
    [ABC_CATEGORY.A]: "Alto valor, requer controle rigoroso",
    [ABC_CATEGORY.B]: "Valor médio, controle moderado",
    [ABC_CATEGORY.C]: "Baixo valor, controle simplificado",
  };
  return descriptions[category];
}

function getXyzDescription(category: XYZ_CATEGORY): string {
  const descriptions = {
    [XYZ_CATEGORY.X]: "Demanda estável e previsível",
    [XYZ_CATEGORY.Y]: "Demanda variável mas previsível",
    [XYZ_CATEGORY.Z]: "Demanda irregular e imprevisível",
  };
  return descriptions[category];
}
