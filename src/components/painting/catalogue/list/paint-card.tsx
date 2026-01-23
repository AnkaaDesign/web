import React from "react";
import { useNavigate } from "react-router-dom";
import type { Paint } from "../../../../types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
import { formatHexColor, getContrastingTextColor } from "./color-utils";
import { routes, PAINT_FINISH_LABELS, TRUCK_MANUFACTURER_LABELS, TRUCK_MANUFACTURER, PAINT_FINISH, SECTOR_PRIVILEGES } from "../../../../constants";
import { IconFlask, IconEdit, IconTrash, IconCheck, IconX, IconGitMerge, IconEye, IconClipboardList } from "@tabler/icons-react";
import { usePaintMutations } from "../../../../hooks";
import type { PaintGetManyFormData } from "../../../../schemas";
import { usePaintSelection } from "./paint-selection-context";
import { useAuth } from "../../../../contexts/auth-context";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

// Badge style - unified neutral, more subtle (for type, brand, finish, manufacturer)
const BADGE_STYLE = "border-0 bg-neutral-200/70 text-neutral-600 dark:bg-neutral-700/50 dark:text-neutral-300 hover:border-0 hover:bg-neutral-200/70 hover:text-neutral-600 dark:hover:bg-neutral-700/50 dark:hover:text-neutral-300";
// Tag badge style - inverted (dark in light mode, light in dark mode)
const TAG_BADGE_STYLE = "border-0 bg-neutral-700 text-neutral-100 dark:bg-neutral-300 dark:text-neutral-800 hover:border-0 hover:bg-neutral-700 hover:text-neutral-100 dark:hover:bg-neutral-300 dark:hover:text-neutral-800";

interface PaintCardProps {
  paint: Paint;
  onFilterChange?: (filters: Partial<PaintGetManyFormData>) => void;
  currentFilters?: Partial<PaintGetManyFormData>;
  onMerge?: () => void;
}

export function PaintCard({ paint, onFilterChange, currentFilters, onMerge }: PaintCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { delete: deletePaint } = usePaintMutations();
  const { isSelected, toggleSelection, selectedCount } = usePaintSelection();
  const backgroundColor = formatHexColor(paint.hex);
  const textColor = getContrastingTextColor(paint.hex);
  const selected = isSelected(paint.id);

  // Check if user can navigate to paint catalogue detail page
  // Allowed roles: ADMIN, LOGISTIC, COMMERCIAL, FINANCIAL, WAREHOUSE, and PRODUCTION team leaders
  const isTeamLeader = Boolean(user?.managedSector?.id);
  const userPrivilege = user?.sector?.privileges;
  const canViewPaintDetails = userPrivilege === SECTOR_PRIVILEGES.ADMIN ||
    userPrivilege === SECTOR_PRIVILEGES.LOGISTIC ||
    userPrivilege === SECTOR_PRIVILEGES.COMMERCIAL ||
    userPrivilege === SECTOR_PRIVILEGES.FINANCIAL ||
    userPrivilege === SECTOR_PRIVILEGES.WAREHOUSE ||
    (userPrivilege === SECTOR_PRIVILEGES.PRODUCTION && isTeamLeader);

  // Context menu state
  const [contextMenu, setContextMenu] = React.useState<{
    x: number;
    y: number;
  } | null>(null);

  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Get labels
  const paintTypeLabel = paint.paintType?.name || "";
  const finishLabel = PAINT_FINISH_LABELS[paint.finish] || paint.finish;
  const brandLabel = paint.paintBrand?.name || "";
  const manufacturerLabel = paint.manufacturer ? TRUCK_MANUFACTURER_LABELS[paint.manufacturer] || paint.manufacturer : null;

  // Get adaptive background for paint code overlay
  // Dark colors need light background, light colors need dark background
  const getCodeOverlayStyle = () => {
    // If text should be white (dark paint), use white bg with black text
    // If text should be black (light paint), use black bg with white text
    if (textColor === "#FFFFFF") {
      // Dark paint - use white/light background
      return { backgroundColor: "rgba(255,255,255,0.9)", color: "#000000" };
    } else {
      // Light paint - use dark background
      return { backgroundColor: "rgba(0,0,0,0.75)", color: "#FFFFFF" };
    }
  };
  const codeOverlayStyle = getCodeOverlayStyle();

  // Formula and task counts
  const formulaCount = paint.formulas?.length || 0;
  const taskCount = (paint._count?.logoTasks || 0) + (paint._count?.generalPaintings || 0);

  // Handle edit action
  const handleEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigate(routes.painting.catalog.edit(paint.id));
    setContextMenu(null);
  };

  // Handle delete action - open dialog
  const handleDeleteClick = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setContextMenu(null);
    setShowDeleteDialog(true);
  };

  // Confirm delete action
  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await deletePaint(paint.id);
    } catch (error) {
      // Error is handled by the API client
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
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
    if (canViewPaintDetails) {
      navigate(routes.painting.catalog.details(paint.id));
    }
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
          "overflow-hidden hover:shadow-sm transition-all duration-200 h-full flex flex-col",
          canViewPaintDetails || selectedCount > 0 ? "cursor-pointer" : "cursor-default",
          selected && "border-2 border-primary shadow-sm"
        )}
        onClick={() => {
          // If in selection mode (any paints selected), toggle selection
          // Otherwise, navigate to details only if user has permission
          if (selectedCount > 0) {
            toggleSelection(paint.id);
          } else if (canViewPaintDetails) {
            navigate(routes.painting.catalog.details(paint.id));
          }
          // If user doesn't have permission, clicking does nothing (they can still view the card info)
        }}
        onContextMenu={handleContextMenu}
      >
        {/* Color preview - use colorPreview image if available, otherwise hex fallback */}
        <div className="h-28 relative flex-shrink-0 overflow-hidden">
          {paint.colorPreview ? (
            /* Show stored preview image if available */
            <img
              src={paint.colorPreview}
              alt={paint.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            /* Fallback to hex color when no preview image */
            <div className="w-full h-full" style={{ backgroundColor }} />
          )}

          {/* Selection indicator */}
          {selected && (
            <div className="absolute top-2 left-2 animate-in fade-in duration-200">
              <Checkbox
                checked={true}
                className="h-5 w-5 bg-white/90 shadow-sm pointer-events-none"
              />
            </div>
          )}

          {/* Paint code overlay - only shown if code exists */}
          {paint.code && (
            <div
              className="absolute bottom-2 right-2 text-xs font-mono px-2 py-1 rounded"
              style={codeOverlayStyle}
            >
              {paint.code}
            </div>
          )}
        </div>

        {/* Card content */}
        <div className="p-3 flex-1 flex flex-col">
          {/* Name */}
          <h3 className="font-semibold text-base line-clamp-2">{paint.name}</h3>

          {/* Badges - unified neutral style, no wrap for consistent card height */}
          <div className="flex flex-nowrap gap-1 overflow-hidden mt-2">
            {paintTypeLabel && (
              <Badge className={cn("text-xs border-0 flex-shrink-0", BADGE_STYLE)}>
                {paintTypeLabel}
              </Badge>
            )}

            <Badge
              className={cn("text-xs border-0 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity", BADGE_STYLE)}
              onClick={handleFinishFilter}
            >
              {finishLabel}
            </Badge>

            {brandLabel && (
              <Badge
                className={cn("text-xs border-0 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity", BADGE_STYLE)}
                onClick={handlePaintBrandFilter}
              >
                {brandLabel}
              </Badge>
            )}

            {manufacturerLabel && (
              <Badge
                className={cn("text-xs border-0 flex-shrink cursor-pointer hover:opacity-80 transition-opacity max-w-[100px] truncate", BADGE_STYLE)}
                onClick={handleManufacturerFilter}
                title={manufacturerLabel}
              >
                {manufacturerLabel}
              </Badge>
            )}
          </div>

          {/* Tags section - always takes remaining space, pushes formula/tasks to bottom */}
          <div className="flex-1 flex flex-col justify-end mt-2">
            {/* Tags - horizontal scroller (only if tags exist) */}
            {paint.tags && paint.tags.length > 0 && (
              <div className="w-full overflow-x-auto mb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <div className="flex gap-1 whitespace-nowrap">
                  {paint.tags.map((tag, index) => (
                    <Badge
                      key={index}
                      className={cn("text-xs cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0", TAG_BADGE_STYLE)}
                      onClick={handleTagSearch(tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Formula and Task counts in a row - justify between */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5">
              <IconFlask className={cn("h-3.5 w-3.5", formulaCount > 0 ? "text-green-600" : "text-red-500")} />
              <span className={cn("text-xs font-medium", formulaCount > 0 ? "text-foreground" : "text-muted-foreground")}>
                {formulaCount} fórmula{formulaCount !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <IconClipboardList className={cn("h-3.5 w-3.5", taskCount > 0 ? "text-blue-600" : "text-muted-foreground")} />
              <span className={cn("text-xs font-medium", taskCount > 0 ? "text-foreground" : "text-muted-foreground")}>
                {taskCount} tarefa{taskCount !== 1 ? "s" : ""}
              </span>
            </div>
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

          {canViewPaintDetails && (
            <DropdownMenuItem onClick={handleViewDetails}>
              <IconEye className="mr-2 h-4 w-4" />
              Detalhes
            </DropdownMenuItem>
          )}

          <DropdownMenuItem onClick={handleEdit}>
            <IconEdit className="mr-2 h-4 w-4" />
            Editar
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={handleDeleteClick} className="text-destructive">
            <IconTrash className="mr-2 h-4 w-4" />
            Excluir
          </DropdownMenuItem>
        </PositionedDropdownMenuContent>
      </DropdownMenu>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Tinta</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a tinta "{paint.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
