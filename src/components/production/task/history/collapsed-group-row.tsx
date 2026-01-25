import React, { useState, useEffect } from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { Task } from "../../../../types";

interface CollapsedGroupRowProps {
  groupId: string;
  collapsedTasks: Task[];
  totalCount: number;
  isExpanded: boolean;
  onToggle: () => void;
  isSelected: boolean;
  onSelectAll: () => void;
  canEdit: boolean;
  columnCount: number;
  selectedCount: number;
}

export function CollapsedGroupRow({
  groupId,
  collapsedTasks,
  totalCount,
  isExpanded,
  onToggle,
  isSelected,
  onSelectAll,
  canEdit,
  columnCount,
  selectedCount,
}: CollapsedGroupRowProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(!isExpanded);

  // Handle smooth transitions
  useEffect(() => {
    if (isExpanded) {
      // Start fade out animation
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsAnimating(false);
      }, 200); // Match transition duration
      return () => clearTimeout(timer);
    } else {
      // Show immediately when collapsing
      setShouldRender(true);
      setIsAnimating(false);
    }
  }, [isExpanded]);

  // Don't render if expanded and animation complete
  if (!shouldRender) {
    return null;
  }

  const handleRowClick = (e: React.MouseEvent) => {
    // Don't toggle if clicking checkbox
    if ((e.target as HTMLElement).closest("[data-checkbox]")) {
      return;
    }
    onToggle();
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleCheckboxChange = () => {
    onSelectAll();
  };

  const middleTaskCount = collapsedTasks.length;
  const hasPartialSelection = selectedCount > 0 && selectedCount < collapsedTasks.length;

  return (
    <TableRow
      className={cn(
        "cursor-pointer border-b border-border",
        "bg-muted/30 hover:bg-muted/50",
        "group",
        "transition-all duration-200 ease-in-out",
        isAnimating && "opacity-0 scale-y-0",
        !isAnimating && "opacity-100 scale-y-100"
      )}
      onClick={handleRowClick}
    >
      {/* Checkbox column */}
      {canEdit && (
        <TableCell className="p-0 !border-r-0 w-[60px]" onClick={handleCheckboxClick}>
          <div className="flex items-center justify-center h-full w-full px-2 py-2">
            <Checkbox
              checked={isSelected}
              indeterminate={hasPartialSelection}
              onCheckedChange={handleCheckboxChange}
              aria-label={`Select ${middleTaskCount} collapsed tasks`}
              data-checkbox
            />
          </div>
        </TableCell>
      )}

      {/* Content spanning all columns */}
      <TableCell
        colSpan={columnCount}
        className="p-0 !border-r-0"
      >
        <div className="flex items-center gap-3 px-4 py-2">
          {/* Expand/collapse icon */}
          <div className="flex-shrink-0">
            <IconChevronRight
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-200",
                isExpanded && "rotate-90"
              )}
            />
          </div>

          {/* Group info text */}
          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm text-muted-foreground font-medium">
              {middleTaskCount} {middleTaskCount === 1 ? 'tarefa oculta' : 'tarefas ocultas'}
            </span>

            {/* Selection badge */}
            {selectedCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {selectedCount} selecionada{selectedCount !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>

          {/* Expand hint */}
          <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
            Clique para expandir
          </span>
        </div>
      </TableCell>
    </TableRow>
  );
}
