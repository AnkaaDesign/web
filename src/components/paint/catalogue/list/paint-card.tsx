import React from "react";
import { useNavigate } from "react-router-dom";
import type { Paint } from "../../../../types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
import { formatHexColor, getContrastingTextColor } from "./color-utils";
import { routes, PAINT_FINISH_LABELS, TRUCK_MANUFACTURER_LABELS, PAINT_FINISH, TRUCK_MANUFACTURER } from "../../../../constants";
import { IconFlask, IconTag, IconTruckLoading, IconSparkles, IconEdit, IconTrash, IconCheck, IconX, IconGitMerge, IconEye } from "@tabler/icons-react";
import { usePaintMutations } from "../../../../hooks";
import type { PaintGetManyFormData } from "../../../../schemas";
import { CanvasNormalMapRenderer } from "../../effects/canvas-normal-map-renderer";
import { usePaintSelection } from "./paint-selection-context";
import { cn } from "@/lib/utils";

interface PaintCardProps {
  paint: Paint;
  onFilterChange?: (filters: Partial<PaintGetManyFormData>) => void;
  currentFilters?: Partial<PaintGetManyFormData>;
  showEffects?: boolean;
  onMerge?: () => void;
}

export function PaintCard({ paint, onFilterChange, currentFilters, showEffects = true, onMerge }: PaintCardProps) {
  const navigate = useNavigate();
  const { delete: deletePaint } = usePaintMutations();
  const { isSelected, toggleSelection, selectedCount } = usePaintSelection();
  const backgroundColor = formatHexColor(paint.hex);
  const textColor = getContrastingTextColor(paint.hex);
  const selected = isSelected(paint.id);

  // Context menu state
  const [contextMenu, setContextMenu] = React.useState<{
    x: number;
    y: number;
  } | null>(null);

  // Use viewport boundary checking hook
  
  // Get labels
  const paintTypeLabel = paint.paintType?.name || "";
  const finishLabel = PAINT_FINISH_LABELS[paint.finish] || paint.finish;
  const brandLabel = paint.paintBrand?.name || "";
  const manufacturerLabel = paint.manufacturer ? TRUCK_MANUFACTURER_LABELS[paint.manufacturer] || paint.manufacturer : null;

  // Handle edit action
  const handleEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigate(routes.painting.catalog.edit(paint.id));
    setContextMenu(null);
  };

  // Handle delete action
  const handleDelete = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setContextMenu(null);

    if (window.confirm(`Tem certeza que deseja excluir a tinta "${paint.name}"? Esta ação não pode ser desfeita.`)) {
      try {
        await deletePaint(paint.id);
      } catch (error) {
        // Error is handled by the API client
      }
    }
  };

  // Handle finish filter
  const handleFinishFilter = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onFilterChange && paint.finish) {
      const currentFinishes = currentFilters?.finishes || [];
      const newFinishes = currentFinishes.includes(paint.finish) ? currentFinishes.filter((f: PAINT_FINISH) => f !== paint.finish) : [...currentFinishes, paint.finish];

      onFilterChange({
        ...currentFilters,
        finishes: newFinishes,
      });
    }
  };

  // Handle paint brand filter
  const handlePaintBrandFilter = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onFilterChange && paint.paintBrand?.id) {
      const currentPaintBrandIds = currentFilters?.paintBrandIds || [];
      const newPaintBrandIds = currentPaintBrandIds.includes(paint.paintBrand.id)
        ? currentPaintBrandIds.filter((id: string) => id !== paint.paintBrand.id)
        : [...currentPaintBrandIds, paint.paintBrand.id];

      onFilterChange({
        ...currentFilters,
        paintBrandIds: newPaintBrandIds,
      });
    }
  };

  // Handle manufacturer filter
  const handleManufacturerFilter = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onFilterChange && paint.manufacturer) {
      const currentManufacturers = currentFilters?.manufacturers || [];
      const newManufacturers = currentManufacturers.includes(paint.manufacturer)
        ? currentManufacturers.filter((m: TRUCK_MANUFACTURER) => m !== paint.manufacturer)
        : [...currentManufacturers, paint.manufacturer];

      onFilterChange({
        ...currentFilters,
        manufacturers: newManufacturers,
      });
    }
  };

  // Handle tag search (keep as search since no dedicated filter)
  const handleTagSearch = (tag: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`${routes.painting.catalog.root}?search=${encodeURIComponent(tag)}`);
  };

  // Handle selection toggle
  const handleSelect = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    toggleSelection(paint.id);
    setContextMenu(null);
  };

  // Handle view details
  const handleViewDetails = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigate(routes.painting.catalog.details(paint.id));
    setContextMenu(null);
  };

  // Handle merge
  const handleMerge = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (onMerge) {
      onMerge();
    }
    setContextMenu(null);
  };

  // Handle context menu (right-click)
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
    });
  };

  // Close context menu when clicking outside
  React.useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return (
    <>
      <Card
        id={`paint-card-${paint.id}`}
        className={cn(
          "overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer h-full flex flex-col",
          selected && "border-2 border-primary shadow-xl"
        )}
        onClick={() => {
          // If in selection mode (any paints selected), toggle selection
          // Otherwise, navigate to details
          if (selectedCount > 0) {
            toggleSelection(paint.id);
          } else {
            navigate(routes.painting.catalog.details(paint.id));
          }
        }}
        onContextMenu={handleContextMenu}
      >
        {/* Color preview - either with effects or plain */}
        <div className="h-32 relative flex-shrink-0 overflow-hidden">
          {showEffects ? (
            /* Show canvas renderer with ALL effects only if showEffects is true */
            <div className="w-full h-full">
              <CanvasNormalMapRenderer
                baseColor={paint.hex}
                finish={paint.finish as PAINT_FINISH}
                width={400}
                height={128}
                quality="medium"
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            /* Plain color without any effects when showEffects is false */
            <div className="w-full h-full" style={{ backgroundColor }} />
          )}

          {/* Selection indicator */}
          {selected && (
            <div className="absolute top-2 left-2 animate-in fade-in duration-200">
              <Checkbox
                checked={true}
                className="h-5 w-5 bg-white/90 shadow-lg pointer-events-none"
              />
            </div>
          )}

          {/* Hex code overlay */}
          <div
            className="absolute bottom-2 right-2 text-xs font-mono px-2 py-1 rounded"
            style={{
              backgroundColor: textColor === "#FFFFFF" ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.9)",
              color: textColor,
            }}
          >
            {paint.hex}
          </div>
        </div>

        {/* Card content */}
        <div className="p-4 space-y-3 flex-1 flex flex-col">
          {/* Name and type - Always shown */}
          <div className="flex-1">
            <h3 className="font-semibold text-base line-clamp-2 mb-1">{paint.name}</h3>
            {paintTypeLabel && <p className="text-sm text-muted-foreground">{paintTypeLabel}</p>}
          </div>

          {/* Badges - Always shown */}
          <div className="flex flex-wrap gap-1">
            <Badge variant="secondary" className="text-xs cursor-pointer hover:bg-secondary/80 transition-colors" onClick={handleFinishFilter}>
              <IconSparkles className="h-3 w-3 mr-1" />
              {finishLabel}
            </Badge>

            {brandLabel && (
              <Badge variant="outline" className="text-xs cursor-pointer hover:bg-secondary/80 transition-colors" onClick={handlePaintBrandFilter}>
                {brandLabel}
              </Badge>
            )}

            {manufacturerLabel && (
              <Badge variant="outline" className="text-xs cursor-pointer hover:bg-secondary/80 transition-colors" onClick={handleManufacturerFilter}>
                <IconTruckLoading className="h-3 w-3 mr-1" />
                {manufacturerLabel}
              </Badge>
            )}
          </div>

          {/* Tags - Always shown when available */}
          {paint.tags && paint.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {paint.tags.slice(0, 3).map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-xs cursor-pointer hover:bg-secondary/80 transition-colors" onClick={handleTagSearch(tag)}>
                  <IconTag className="h-3 w-3 mr-1" />
                  {tag}
                </Badge>
              ))}
              {paint.tags.length > 3 && (
                <Badge
                  variant="secondary"
                  className="text-xs cursor-pointer hover:bg-secondary/80 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(routes.painting.catalog.details(paint.id));
                  }}
                >
                  +{paint.tags.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* Formula quantity with color indicator - Always shown */}
          <div className="flex items-center gap-2 text-sm">
            <IconFlask className={`h-4 w-4 ${paint.formulas && paint.formulas.length > 0 ? "text-green-600" : "text-red-600"}`} />
            <span className={paint.formulas && paint.formulas.length > 0 ? "text-foreground" : "text-muted-foreground"}>
              {paint.formulas?.length || 0} fórmula{(paint.formulas?.length || 0) !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </Card>

      {/* Context Menu */}
      <DropdownMenu open={!!contextMenu} onOpenChange={(open) => !open && setContextMenu(null)}>
        <PositionedDropdownMenuContent
        position={contextMenu}
        isOpen={!!contextMenu}
        className="w-56 ![position:fixed]"
        onClick={(e) => e.stopPropagation()}
        >
          {selectedCount >= 2 && selected && (
            <DropdownMenuItem onClick={handleMerge}>
              <IconGitMerge className="mr-2 h-4 w-4" />
              Mesclar Tintas
            </DropdownMenuItem>
          )}

          <DropdownMenuItem onClick={handleSelect}>
            {selected ? <IconX className="mr-2 h-4 w-4" /> : <IconCheck className="mr-2 h-4 w-4" />}
            {selected ? "Desselecionar" : "Selecionar"}
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleViewDetails}>
            <IconEye className="mr-2 h-4 w-4" />
            Detalhes
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleEdit}>
            <IconEdit className="mr-2 h-4 w-4" />
            Editar
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={handleDelete} className="text-destructive">
            <IconTrash className="mr-2 h-4 w-4" />
            Excluir
          </DropdownMenuItem>
        </PositionedDropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
