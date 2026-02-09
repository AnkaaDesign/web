import React from "react";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { IconChevronUp, IconChevronDown, IconSelector } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { formatDate } from "../../../../utils";
import { MAINTENANCE_STATUS, MAINTENANCE_STATUS_LABELS, routes } from "../../../../constants";
import { ENTITY_BADGE_CONFIG } from "../../../../constants";
import { useScrollbarWidth } from "@/hooks/common/use-scrollbar-width";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { TableSearchInput } from "@/components/ui/table-search-input";

interface MaintenanceHistoryTableProps {
  maintenances: any[];
  className?: string;
}

type SortConfig = { column: string; direction: "asc" | "desc" } | null;

export function MaintenanceHistoryTable({ maintenances, className }: MaintenanceHistoryTableProps) {
  const navigate = useNavigate();
  const { width: scrollbarWidth, isOverlay } = useScrollbarWidth();
  const [sortConfig, setSortConfig] = React.useState<SortConfig>({ column: "scheduledFor", direction: "desc" });
  const [searchText, setSearchText] = React.useState("");

  // Filter maintenances based on search
  const filteredMaintenances = React.useMemo(() => {
    if (!searchText) return maintenances;

    const searchLower = searchText.toLowerCase();
    return maintenances.filter((maintenance: any) => {
      const nameMatch = maintenance.name?.toLowerCase().includes(searchLower);
      const itemMatch = maintenance.item?.name?.toLowerCase().includes(searchLower);
      const statusMatch = MAINTENANCE_STATUS_LABELS[maintenance.status as MAINTENANCE_STATUS]?.toLowerCase().includes(searchLower);

      return nameMatch || itemMatch || statusMatch;
    });
  }, [maintenances, searchText]);

  // Sort maintenances
  const sortedMaintenances = React.useMemo(() => {
    return [...filteredMaintenances].sort((a, b) => {
      // Default sort: status priority, then by date (newest first)
      if (!sortConfig || sortConfig.column === "scheduledFor") {
        // Define status priority order (pending first, then in_progress, then completed)
        const statusPriority: Record<string, number> = {
          [MAINTENANCE_STATUS.PENDING]: 1,
          [MAINTENANCE_STATUS.IN_PROGRESS]: 2,
          [MAINTENANCE_STATUS.COMPLETED]: 3,
          [MAINTENANCE_STATUS.CANCELLED]: 4,
        };

        const aStatusPriority = statusPriority[a.status] || 999;
        const bStatusPriority = statusPriority[b.status] || 999;

        // Sort by status first
        if (aStatusPriority !== bStatusPriority) {
          return aStatusPriority - bStatusPriority;
        }

        // Then by date - newest first (larger timestamps first)
        const aDate = a.scheduledFor ? new Date(a.scheduledFor).getTime() : 0;
        const bDate = b.scheduledFor ? new Date(b.scheduledFor).getTime() : 0;

        // Newest first: if a is newer (larger), it should come first (return negative)
        return bDate - aDate;
      }

      // Custom column sort
      let aValue: any;
      let bValue: any;

      switch (sortConfig.column) {
        case "name":
          aValue = a.name;
          bValue = b.name;
          break;
        case "item":
          aValue = a.item?.name || "";
          bValue = b.item?.name || "";
          break;
        case "status":
          aValue = a.status;
          bValue = b.status;
          break;
        case "timeTaken":
          aValue = a.timeTaken || 0;
          bValue = b.timeTaken || 0;
          break;
        default:
          return 0;
      }

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortConfig.direction === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }

      return sortConfig.direction === "asc" ? aValue - bValue : bValue - aValue;
    });
  }, [filteredMaintenances, sortConfig]);

  const toggleSort = (column: string) => {
    setSortConfig((prev) => {
      if (!prev || prev.column !== column) {
        return { column, direction: "asc" };
      }
      if (prev.direction === "asc") {
        return { column, direction: "desc" };
      }
      return null;
    });
  };

  const renderSortIndicator = (column: string) => {
    if (!sortConfig || sortConfig.column !== column) {
      return <IconSelector className="h-4 w-4 text-muted-foreground" />;
    }
    if (sortConfig.direction === "asc") {
      return <IconChevronUp className="h-4 w-4 text-foreground" />;
    }
    return <IconChevronDown className="h-4 w-4 text-foreground" />;
  };

  const columns = [
    { key: "name", header: "NOME", sortable: true, className: "w-80 min-w-80 max-w-80" },
    { key: "item", header: "ITEM", sortable: true, className: "w-64 min-w-64 max-w-64" },
    { key: "status", header: "STATUS", sortable: true, className: "w-40 min-w-40 max-w-40" },
    { key: "scheduledFor", header: "DATA AGENDADA", sortable: true, className: "w-40 min-w-40 max-w-40" },
    { key: "timeTaken", header: "TEMPO GASTO", sortable: true, className: "w-40 min-w-40 max-w-40 text-center" },
  ];

  return (
    <div className={cn("space-y-3", className)}>
      {/* Search Input */}
      <TableSearchInput
        value={searchText}
        onChange={setSearchText}
        placeholder="Buscar por nome, item, status..."
        isPending={false}
      />

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="border-b border-border">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableHeader className="[&_tr]:border-b-0">
            <TableRow className="bg-muted hover:bg-muted">
              {columns.map((column) => (
                <TableHead key={column.key} className={cn("whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0", column.className)}>
                  {column.sortable ? (
                    <button onClick={() => toggleSort(column.key)} className="flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent">
                      <TruncatedTextWithTooltip text={column.header} />
                      {renderSortIndicator(column.key)}
                    </button>
                  ) : (
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <TruncatedTextWithTooltip text={column.header} />
                    </div>
                  )}
                </TableHead>
              ))}
              {!isOverlay && <TableHead style={{ width: `${scrollbarWidth}px`, minWidth: `${scrollbarWidth}px` }} className="bg-muted p-0 border-0 !border-r-0 shrink-0"></TableHead>}
            </TableRow>
          </TableHeader>
        </Table>
      </div>

      {/* Body */}
      <div className="max-h-[400px] overflow-y-auto">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableBody>
            {sortedMaintenances.map((maintenance, index) => {
              const now = new Date();
              const scheduledDate = maintenance.scheduledFor ? new Date(maintenance.scheduledFor) : null;
              const isOverdue = scheduledDate && scheduledDate < now && maintenance.status === MAINTENANCE_STATUS.PENDING;
              const isDueSoon = scheduledDate && scheduledDate <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) && maintenance.status === MAINTENANCE_STATUS.PENDING;

              let dateClassName = "truncate";
              if (isOverdue || isDueSoon) {
                dateClassName += " text-orange-600 font-medium";
              }

              return (
                <TableRow
                  key={maintenance.id}
                  className={cn("cursor-pointer border-b border-border", index % 2 === 1 && "bg-muted/10", "hover:bg-muted/20")}
                  onClick={() => navigate(routes.inventory.maintenance.details(maintenance.id))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(routes.inventory.maintenance.details(maintenance.id));
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Ver detalhes da manutenção ${maintenance.name || maintenance.id}`}
                >
                  <TableCell className="w-80 min-w-80 max-w-80 p-0 !border-r-0">
                    <div className="px-4 py-2">
                      <div className="font-medium truncate">{maintenance.name}</div>
                    </div>
                  </TableCell>
                  <TableCell className="w-64 min-w-64 max-w-64 p-0 !border-r-0">
                    <div className="px-4 py-2">
                      <div className="truncate">{maintenance.item?.name || "-"}</div>
                    </div>
                  </TableCell>
                  <TableCell className="w-40 min-w-40 max-w-40 p-0 !border-r-0">
                    <div className="px-4 py-2">
                      <Badge variant={ENTITY_BADGE_CONFIG.MAINTENANCE?.[maintenance.status] || "default"} className="text-xs whitespace-nowrap">
                        {MAINTENANCE_STATUS_LABELS[maintenance.status as MAINTENANCE_STATUS] || maintenance.status}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="w-40 min-w-40 max-w-40 p-0 !border-r-0">
                    <div className="px-4 py-2">
                      <div className={dateClassName}>{scheduledDate ? formatDate(scheduledDate) : "-"}</div>
                    </div>
                  </TableCell>
                  <TableCell className="w-40 min-w-40 max-w-40 text-center p-0 !border-r-0">
                    <div className="px-4 py-2">
                      <div className="truncate text-sm tabular-nums">
                        {(() => {
                          // Calculate time taken from startedAt and finishedAt if available
                          if (maintenance.startedAt && maintenance.finishedAt) {
                            const started = new Date(maintenance.startedAt);
                            const finished = new Date(maintenance.finishedAt);
                            const diffMs = finished.getTime() - started.getTime();
                            const diffSeconds = Math.floor(diffMs / 1000);
                            const hours = Math.floor(diffSeconds / 3600);
                            const minutes = Math.floor((diffSeconds % 3600) / 60);
                            return <span className="text-green-700 font-medium">{String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}</span>;
                          }
                          // Fallback to timeTaken field if available
                          if (maintenance.timeTaken) {
                            const hours = Math.floor(maintenance.timeTaken / 3600);
                            const minutes = Math.floor((maintenance.timeTaken % 3600) / 60);
                            return <span className="text-green-700 font-medium">{String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}</span>;
                          }
                          return <span className="text-muted-foreground">-</span>;
                        })()}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      </div>
    </div>
  );
}
