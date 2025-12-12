import { useCallback } from "react";
import { formatDate, formatDateToDayOfWeek } from "../../../../utils";
import { cn } from "../../../../lib/utils";
import type { DateCellProps } from "./cell-types";

export function DateCell({ entry, stateManager, onContextMenu, onEntryClick, className }: DateCellProps) {
  const isEntryModified = stateManager.actions.isEntryModified(entry.id);
  const dayOfWeek = formatDateToDayOfWeek(new Date(entry.date));
  const formattedDate = formatDate(entry.date);

  const handleContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (onContextMenu) {
        onContextMenu(event, entry);
      }
    },
    [onContextMenu, entry],
  );

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      if (onEntryClick) {
        onEntryClick(entry);
      }
    },
    [onEntryClick, entry],
  );

  return (
    <div
      className={cn(
        "relative flex flex-col items-start p-2 cursor-pointer transition-colors hover:bg-gray-50",
        isEntryModified && "bg-blue-50 border-l-2 border-blue-500",
        className,
      )}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      <div className="flex flex-col space-y-1">
        {/* Day of week */}
        <div className={cn("text-xs font-medium text-gray-600 uppercase", isEntryModified && "text-blue-700")}>{dayOfWeek}</div>

        {/* Date */}
        <div className={cn("text-sm font-medium text-gray-900", isEntryModified && "text-blue-800")}>{formattedDate}</div>

        {/* User name */}
        <div className={cn("text-xs text-gray-500 truncate max-w-[120px]", isEntryModified && "text-blue-600")} title={entry.user?.name || "N/A"}>
          {entry.user?.name || "N/A"}
        </div>

        {/* Source indicator */}
        {entry.source && (
          <div className="flex items-center gap-1">
            <div className={cn("w-2 h-2 rounded-full", entry.source === "ELECTRONIC" ? "bg-green-500" : "bg-gray-400")} />
            <span className={cn("text-xs text-gray-400", entry.source === "ELECTRONIC" && "text-green-600")}>{entry.source === "ELECTRONIC" ? "Eletrônico" : "Manual"}</span>
          </div>
        )}

        {/* Photo indicator */}
        {entry.hasPhoto && <div className="text-xs text-blue-600 font-medium">📷 Com foto</div>}
      </div>

      {/* Modified indicator */}
      {isEntryModified && <div className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full" />}

      {/* Context menu indicator */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="w-1 h-1 bg-gray-400 rounded-full" />
        <div className="w-1 h-1 bg-gray-400 rounded-full mt-0.5" />
        <div className="w-1 h-1 bg-gray-400 rounded-full mt-0.5" />
      </div>
    </div>
  );
}
