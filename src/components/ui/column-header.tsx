import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  IconSelector,
  IconChevronUp,
  IconChevronDown,
  IconDots,
  IconFilter,
  IconFilterFilled,
  IconPinned,
  IconPin,
  IconEyeOff,
  IconArrowsHorizontal,
  IconSortAscending,
  IconSortDescending,
  IconX,
  IconSettings,
} from "@tabler/icons-react";
import { TableHead } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { cn } from "@/lib/utils";

export type SortDirection = "asc" | "desc" | null;

export interface FilterConfig {
  isActive: boolean;
  count?: number;
  label?: string;
}

export interface ColumnAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

export interface ColumnHeaderProps {
  children: React.ReactNode;

  // Sorting
  sortable?: boolean;
  sortDirection?: SortDirection;
  sortOrder?: number | null;
  onSort?: (event?: React.MouseEvent) => void;
  showMultipleSortOrder?: boolean;

  // Filtering
  filterable?: boolean;
  filterConfig?: FilterConfig;
  onFilter?: () => void;

  // Column menu and actions
  columnKey?: string;
  actions?: ColumnAction[];
  onHide?: () => void;
  onPin?: () => void;
  isPinned?: boolean;

  // Resizing
  resizable?: boolean;
  width?: number | string;
  minWidth?: number;
  maxWidth?: number;
  onResize?: (width: number) => void;

  // Styling and layout
  className?: string;
  align?: "left" | "center" | "right";
  tooltip?: string;

  // Accessibility
  ariaLabel?: string;
  ariaSort?: "ascending" | "descending" | "none";
}

/**
 * Enhanced column header component with comprehensive table functionality
 * Provides sorting, filtering, column menu, resizing, and accessibility features
 */
export function ColumnHeader({
  children,

  // Sorting props
  sortable = false,
  sortDirection = null,
  sortOrder = null,
  onSort,
  showMultipleSortOrder = false,

  // Filtering props
  filterable = false,
  filterConfig,
  onFilter,

  // Column menu props
  columnKey,
  actions = [],
  onHide,
  onPin,
  isPinned = false,

  // Resizing props
  resizable = false,
  width,
  minWidth = 100,
  maxWidth = 500,
  onResize,

  // Styling props
  className,
  align = "left",
  tooltip,

  // Accessibility props
  ariaLabel,
  ariaSort,
}: ColumnHeaderProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // Use refs for resize state to avoid stale closure issues with document event listeners
  const isResizingRef = useRef(false);
  const startXRef = useRef(0); // Cursor X position when drag started
  const startWidthRef = useRef(0); // Column width when drag started
  const onResizeRef = useRef(onResize);

  // Keep onResize ref up to date
  useEffect(() => {
    onResizeRef.current = onResize;
  }, [onResize]);

  const headerRef = useRef<HTMLTableCellElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);

  // Check if children is a string or a React element
  const isStringChildren = typeof children === "string";
  const headerText = isStringChildren ? children : "";
  const displayTooltip = tooltip || (isStringChildren ? headerText : "");

  const isActive = sortDirection !== null;
  const hasFilter = filterConfig?.isActive;
  const hasActions = actions.length > 0 || onHide || onPin;

  // Alignment classes
  const alignmentClasses = {
    left: "justify-start text-left",
    center: "justify-center text-center",
    right: "justify-end text-right",
  };

  // Generate accessibility attributes
  const getAriaSort = (): "ascending" | "descending" | "none" => {
    if (ariaSort) return ariaSort;
    if (!sortable) return "none";
    if (sortDirection === "asc") return "ascending";
    if (sortDirection === "desc") return "descending";
    return "none";
  };

  const getAriaLabel = (): string => {
    if (ariaLabel) return ariaLabel;

    let label = isStringChildren ? headerText : "Coluna";

    if (sortable) {
      label += sortDirection ? `, ordenado ${sortDirection === "asc" ? "crescente" : "decrescente"}` : ", ordenável";
    }

    if (hasFilter) {
      label += ", filtrado";
    }

    if (isPinned) {
      label += ", fixado";
    }

    return label;
  };

  // Resizing functionality - using refs to avoid stale closure issues
  // Key insight: Track the DIFFERENCE from starting position, not absolute position
  // This ensures the divider moves exactly with the cursor, no matter where you grab it
  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current) return;

    // Calculate how far the cursor has moved from the starting position
    const diff = e.clientX - startXRef.current;
    // New width = initial width + cursor movement
    const newWidth = startWidthRef.current + diff;
    const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

    if (onResizeRef.current) {
      onResizeRef.current(clampedWidth);
    }
  }, [minWidth, maxWidth]);

  const handleResizeEnd = useCallback(() => {
    isResizingRef.current = false;
    setIsResizing(false);
    document.removeEventListener("mousemove", handleResizeMove);
    document.removeEventListener("mouseup", handleResizeEnd);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, [handleResizeMove]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    if (!resizable || !onResizeRef.current) return;

    e.preventDefault();
    e.stopPropagation();

    // Store initial cursor position and column width
    // This allows us to calculate relative movement, keeping cursor aligned with divider
    startXRef.current = e.clientX;
    startWidthRef.current = headerRef.current?.offsetWidth || 0;

    isResizingRef.current = true;
    setIsResizing(true);

    document.addEventListener("mousemove", handleResizeMove);
    document.addEventListener("mouseup", handleResizeEnd);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [resizable, handleResizeMove, handleResizeEnd]);

  // Cleanup event listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", handleResizeMove);
      document.removeEventListener("mouseup", handleResizeEnd);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [handleResizeMove, handleResizeEnd]);

  // Sort icon component
  const SortIcon = () => {
    if (!sortable) return null;

    const iconClass = cn("h-4 w-4 transition-colors duration-150", {
      "text-primary": isActive,
      "text-muted-foreground": !isActive && !isHovering,
      "text-foreground/70": !isActive && isHovering,
    });

    return (
      <div className="inline-flex items-center ml-1">
        {sortDirection === "asc" && <IconChevronUp className={iconClass} />}
        {sortDirection === "desc" && <IconChevronDown className={iconClass} />}
        {sortDirection === null && <IconSelector className={iconClass} />}

        {/* Sort order indicator for multi-column sorting */}
        {showMultipleSortOrder && sortOrder !== null && (
          <span
            className={cn("text-xs ml-0.5 transition-colors duration-150", {
              "text-primary font-medium": isActive,
              "text-muted-foreground": !isActive,
            })}
          >
            {sortOrder + 1}
          </span>
        )}
      </div>
    );
  };

  // Filter indicator component
  const FilterIndicator = () => {
    if (!filterable) return null;

    return (
      <div className="inline-flex items-center ml-1">
        {hasFilter ? (
          <div className="relative">
            <IconFilterFilled className="h-4 w-4 text-primary" />
            {filterConfig?.count && filterConfig.count > 0 && (
              <Badge variant="primary" size="sm" className="absolute -top-1 -right-1 h-4 w-4 p-0 text-[10px] flex items-center justify-center">
                {filterConfig.count > 99 ? "99+" : filterConfig.count}
              </Badge>
            )}
          </div>
        ) : (
          <IconFilter className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
    );
  };

  // Column menu component
  const ColumnMenu = () => {
    if (!hasActions) return null;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-6 w-6 p-0 ml-1 opacity-0 group-hover:opacity-100 transition-opacity", "hover:bg-muted/50 focus:opacity-100")}
            aria-label={`Opções da coluna ${headerText}`}
          >
            <IconDots className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Opções da Coluna</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* Sorting actions */}
          {sortable && (
            <>
              <DropdownMenuItem onClick={() => onSort?.()} disabled={sortDirection === "asc"}>
                <IconSortAscending className="h-4 w-4 mr-2" />
                Ordenar Crescente
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSort?.()} disabled={sortDirection === "desc"}>
                <IconSortDescending className="h-4 w-4 mr-2" />
                Ordenar Decrescente
              </DropdownMenuItem>
              {sortDirection && (
                <DropdownMenuItem onClick={() => onSort?.()}>
                  <IconX className="h-4 w-4 mr-2" />
                  Remover Ordenação
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
            </>
          )}

          {/* Filter actions */}
          {filterable && (
            <>
              <DropdownMenuItem onClick={onFilter}>
                <IconFilter className="h-4 w-4 mr-2" />
                {hasFilter ? "Editar Filtro" : "Adicionar Filtro"}
              </DropdownMenuItem>
              {hasFilter && (
                <DropdownMenuItem onClick={onFilter}>
                  <IconX className="h-4 w-4 mr-2" />
                  Remover Filtro
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
            </>
          )}

          {/* Pin/Unpin */}
          {onPin && (
            <DropdownMenuItem onClick={onPin}>
              {isPinned ? (
                <>
                  <IconPin className="h-4 w-4 mr-2" />
                  Desfixar Coluna
                </>
              ) : (
                <>
                  <IconPinned className="h-4 w-4 mr-2" />
                  Fixar Coluna
                </>
              )}
            </DropdownMenuItem>
          )}

          {/* Custom actions */}
          {actions.map((action) => (
            <DropdownMenuItem key={action.id} onClick={action.onClick} disabled={action.disabled} className={action.destructive ? "text-destructive focus:text-destructive" : ""}>
              {action.icon && <span className="mr-2">{action.icon}</span>}
              {action.label}
            </DropdownMenuItem>
          ))}

          {/* Hide column */}
          {onHide && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onHide} className="text-destructive focus:text-destructive">
                <IconEyeOff className="h-4 w-4 mr-2" />
                Ocultar Coluna
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  // Resize handle component - wider hit area for easier grabbing
  const ResizeHandle = () => {
    if (!resizable) return null;

    return (
      <div
        ref={resizeHandleRef}
        className={cn(
          "absolute right-0 top-0 h-full w-3 cursor-col-resize group/resize z-10",
          "hover:bg-primary/30 active:bg-primary/50",
          "transition-colors duration-100",
          // Shift left by half width so it straddles the column divider
          "-translate-x-1/2",
          {
            "bg-primary/50": isResizing,
          }
        )}
        onMouseDown={handleResizeStart}
        aria-label={`Redimensionar coluna${isStringChildren ? ` ${headerText}` : ""}`}
        role="separator"
        aria-orientation="vertical"
      >
        {/* Visual indicator centered in the resize handle */}
        <div className={cn(
          "absolute inset-0 flex items-center justify-center",
          "opacity-0 group-hover/resize:opacity-100 transition-opacity",
          { "opacity-100": isResizing }
        )}>
          <IconArrowsHorizontal className="h-3 w-3 text-primary" />
        </div>
      </div>
    );
  };

  // Main content container
  const ContentContainer = ({ children: content }: { children: React.ReactNode }) => {
    if (sortable) {
      return (
        <button
          onClick={onSort}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          className={cn(
            "flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 transition-all duration-150 group",
            "hover:bg-muted/80 focus:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-primary/20",
            "cursor-pointer border-0 bg-transparent",
            alignmentClasses[align],
            {
              "bg-primary/5": isActive,
            },
          )}
          aria-label={getAriaLabel()}
          aria-sort={getAriaSort()}
          title={`${displayTooltip}${isActive ? ` (ordenado)` : ""} - Clique para ordenar${showMultipleSortOrder ? ", Ctrl+Click para multi-ordenação" : ""}`}
        >
          {content}
        </button>
      );
    }

    return (
      <div
        className={cn("flex items-center h-full min-h-[2.5rem] px-4 py-2 group", alignmentClasses[align])}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        title={displayTooltip}
        aria-label={getAriaLabel()}
      >
        {content}
      </div>
    );
  };

  return (
    <TableHead
      ref={headerRef}
      className={cn(
        "relative whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0",
        {
          "border-l-2 border-l-primary": isPinned,
        },
        className,
      )}
      style={{
        width: width,
        minWidth: minWidth,
        maxWidth: maxWidth,
      }}
    >
      <ContentContainer>
        {/* Column header content - handle both string and React element children */}
        {isStringChildren ? (
          <TruncatedTextWithTooltip
            text={headerText.toUpperCase()}
            className={cn("transition-colors duration-150", {
              "text-primary": isActive,
              "group-hover:text-foreground": !isActive && sortable,
            })}
          />
        ) : (
          <span className={cn("transition-colors duration-150 truncate", {
            "text-primary": isActive,
            "group-hover:text-foreground": !isActive && sortable,
          })}>
            {children}
          </span>
        )}

        {/* Pin indicator */}
        {isPinned && !sortable && <IconPinned className="h-3 w-3 ml-1 text-primary" />}

        {/* Sort indicator */}
        <SortIcon />

        {/* Filter indicator */}
        <FilterIndicator />

        {/* Column menu */}
        <ColumnMenu />
      </ContentContainer>

      {/* Resize handle */}
      <ResizeHandle />
    </TableHead>
  );
}

// Export types for external use
export type { ColumnAction, FilterConfig };
