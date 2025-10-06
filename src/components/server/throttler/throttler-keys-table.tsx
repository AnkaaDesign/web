import React, { useMemo, useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { IconChevronUp, IconChevronDown, IconSelector, IconTrash, IconUser, IconWorld, IconClock } from "@tabler/icons-react";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/use-table-state";
import { cn } from "@/lib/utils";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { useScrollbarWidth } from "@/hooks/use-scrollbar-width";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { ThrottlerKey, BlockedKey } from "@/api-client/throttler";
import { TtlCountdown } from "./ttl-countdown";

interface ThrottlerKeysTableProps {
  keys: (ThrottlerKey | BlockedKey)[];
  isLoading: boolean;
  onClearKeys?: (keys: (ThrottlerKey | BlockedKey)[]) => void;
  filters?: {
    searchingFor?: string;
    showBlockedOnly?: boolean;
    controllers?: string[];
    identifiers?: string[];
    throttlerNames?: string[];
  };
  className?: string;
  onDataChange?: (data: { items: (ThrottlerKey | BlockedKey)[]; totalRecords: number }) => void;
}

export function ThrottlerKeysTable({
  keys,
  isLoading,
  onClearKeys,
  filters = {},
  className,
  onDataChange
}: ThrottlerKeysTableProps) {
  // Get scrollbar width info
  const { width: scrollbarWidth, isOverlay } = useScrollbarWidth();

  // Use URL state management for pagination and sorting
  const { page, pageSize, sortConfigs, setPage, setPageSize, toggleSort, getSortDirection } = useTableState({
    defaultPageSize: 40,
    defaultSort: [{ column: "status", direction: "desc" }], // Blocked first
    resetSelectionOnPageChange: false,
  });

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    keys: (ThrottlerKey | BlockedKey)[];
    isBulk: boolean;
  } | null>(null);

  // Filter and sort keys locally
  const filteredKeys = useMemo(() => {
    let result = [...keys];

    // Apply search filter
    if (filters.searchingFor) {
      const search = filters.searchingFor.toLowerCase();
      result = result.filter((key) => {
        const controller = key.controller?.toLowerCase() || "";
        const method = key.method?.toLowerCase() || "";
        const identifier = key.identifier?.toLowerCase() || "";
        const throttlerName = key.throttlerName?.toLowerCase() || "";

        return (
          controller.includes(search) ||
          method.includes(search) ||
          identifier.includes(search) ||
          throttlerName.includes(search)
        );
      });
    }

    // Apply blocked filter
    if (filters.showBlockedOnly) {
      result = result.filter((key) => "isBlocked" in key ? key.isBlocked : true);
    }

    // Apply advanced filters
    if (filters.controllers && filters.controllers.length > 0) {
      result = result.filter((key) => key.controller && filters.controllers!.includes(key.controller));
    }

    if (filters.identifiers && filters.identifiers.length > 0) {
      result = result.filter((key) => key.identifier && filters.identifiers!.includes(key.identifier));
    }

    if (filters.throttlerNames && filters.throttlerNames.length > 0) {
      result = result.filter((key) => key.throttlerName && filters.throttlerNames!.includes(key.throttlerName));
    }

    return result;
  }, [keys, filters]);

  // Sort keys
  const sortedKeys = useMemo(() => {
    let result = [...filteredKeys];

    sortConfigs.forEach((sortConfig) => {
      result.sort((a, b) => {
        let aVal: any;
        let bVal: any;

        switch (sortConfig.column) {
          case "status":
            aVal = "isBlocked" in a ? (a.isBlocked ? 1 : 0) : 1;
            bVal = "isBlocked" in b ? (b.isBlocked ? 1 : 0) : 1;
            break;
          case "controller":
            aVal = a.controller || "";
            bVal = b.controller || "";
            break;
          case "method":
            aVal = a.method || "";
            bVal = b.method || "";
            break;
          case "identifier":
            aVal = a.identifier || "";
            bVal = b.identifier || "";
            break;
          case "ttl":
            aVal = a.ttl || 0;
            bVal = b.ttl || 0;
            break;
          default:
            return 0;
        }

        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    });

    return result;
  }, [filteredKeys, sortConfigs]);

  // Paginate keys (page is 0-based from useTableState)
  const paginatedKeys = useMemo(() => {
    const start = page * pageSize;
    const end = start + pageSize;
    return sortedKeys.slice(start, end);
  }, [sortedKeys, page, pageSize]);

  const totalPages = Math.ceil(sortedKeys.length / pageSize);
  const totalRecords = sortedKeys.length;

  const toggleSelection = (keyString: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(keyString)) {
      newSelection.delete(keyString);
    } else {
      newSelection.add(keyString);
    }
    setSelectedIds(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedKeys.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedKeys.map((item) => item.key)));
    }
  };

  // Handle context menu
  const handleContextMenu = (e: React.MouseEvent, key: ThrottlerKey | BlockedKey) => {
    e.preventDefault();
    const isBulk = selectedIds.size > 1 && selectedIds.has(key.key);
    const keysToAction = isBulk ? paginatedKeys.filter((item) => selectedIds.has(item.key)) : [key];

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      keys: keysToAction,
      isBulk,
    });
  };

  const closeContextMenu = () => setContextMenu(null);

  // Update parent with data changes
  useEffect(() => {
    onDataChange?.({ items: paginatedKeys, totalRecords });
  }, [paginatedKeys, totalRecords, onDataChange]);

  // Close context menu on outside click
  useEffect(() => {
    if (contextMenu) {
      const handleClick = () => closeContextMenu();
      document.addEventListener("click", handleClick);
      return () => document.removeEventListener("click", handleClick);
    }
  }, [contextMenu]);

  // Define table columns
  const columns = [
    {
      id: "select",
      header: () => (
        <div className="flex items-center justify-center h-full w-full">
          <Checkbox checked={selectedIds.size === paginatedKeys.length && paginatedKeys.length > 0} onCheckedChange={toggleSelectAll} aria-label="Selecionar todos" data-checkbox />
        </div>
      ),
      cell: (key: ThrottlerKey | BlockedKey) => (
        <div className="flex items-center justify-center h-full w-full" onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={selectedIds.has(key.key)} onCheckedChange={() => toggleSelection(key.key)} aria-label={`Selecionar chave ${key.key}`} data-checkbox />
        </div>
      ),
      width: TABLE_LAYOUT.checkbox.className,
    },
    {
      id: "status",
      header: "Status",
      sortable: true,
      cell: (key: ThrottlerKey | BlockedKey) => {
        const isBlocked = "isBlocked" in key ? key.isBlocked : true;
        return isBlocked ? (
          <Badge variant="destructive">Bloqueado</Badge>
        ) : (
          <Badge variant="success">Ativo</Badge>
        );
      },
      width: "w-28",
    },
    {
      id: "identifier",
      header: "Usuário/IP",
      sortable: true,
      cell: (key: ThrottlerKey | BlockedKey) => {
        const identifierType = "identifierType" in key ? key.identifierType : (key.identifier?.includes("user:") ? "user" : "ip");
        const isUser = identifierType === "user";

        // Format identifier for display
        let displayValue = key.identifier || "-";

        // Remove 'ip::' prefix if present
        if (displayValue.startsWith("ip::")) {
          displayValue = displayValue.substring(4);
        }

        // Remove 'user:' prefix if present
        if (displayValue.startsWith("user:")) {
          displayValue = displayValue.substring(5);
        }

        // Format IPv6 addresses (remove extra colons)
        if (!isUser && displayValue.includes(":")) {
          // IPv6 addresses like ::1 or ::ffff:127.0.0.1
          if (displayValue.startsWith("::ffff:")) {
            displayValue = displayValue.substring(7); // Remove IPv6-to-IPv4 prefix
          } else if (displayValue === "::1") {
            displayValue = "localhost (::1)";
          }
        }

        return (
          <div className="flex items-center gap-2">
            {isUser ? (
              <IconUser className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            ) : (
              <IconWorld className="h-4 w-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
            )}
            <span className="font-mono text-sm truncate">{displayValue}</span>
          </div>
        );
      },
      width: "w-48",
    },
    {
      id: "controller",
      header: "Endpoint",
      sortable: true,
      cell: (key: ThrottlerKey | BlockedKey) => (
        <div className="font-mono text-sm truncate">
          {key.controller && key.method ? `${key.controller}.${key.method}` : "-"}
        </div>
      ),
      width: "min-w-0 flex-1",
    },
    {
      id: "throttlerName",
      header: "Throttler",
      cell: (key: ThrottlerKey | BlockedKey) => (
        <Badge variant="outline" className="font-mono text-xs">
          {key.throttlerName || "-"}
        </Badge>
      ),
      width: "w-32",
    },
    {
      id: "hits",
      header: "Requisições",
      cell: (key: ThrottlerKey | BlockedKey) => {
        const hits = "hits" in key ? key.hits : null;
        return hits !== null ? (
          <span className="font-medium">{hits}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
      width: "w-28 text-right",
    },
    {
      id: "ttl",
      header: "Expira em",
      sortable: true,
      cell: (key: ThrottlerKey | BlockedKey) => (
        <TtlCountdown ttl={key.ttl} />
      ),
      width: "w-32",
    },
  ];

  // Render sortable header
  const renderSortableHeader = (column: { id: string; header: string; sortable?: boolean }) => {
    if (!column.sortable) {
      return <span className="text-xs font-semibold uppercase tracking-wider">{column.header}</span>;
    }

    const direction = getSortDirection(column.id);
    return (
      <button
        onClick={() => toggleSort(column.id)}
        className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider hover:text-foreground transition-colors"
      >
        <span>{column.header}</span>
        {direction === "asc" && <IconChevronUp className="h-3 w-3" />}
        {direction === "desc" && <IconChevronDown className="h-3 w-3" />}
        {!direction && <IconSelector className="h-3 w-3 opacity-50" />}
      </button>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="flex-1 flex flex-col min-h-0 border rounded-lg overflow-hidden">
        {sortedKeys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <IconClock className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma chave encontrada</h3>
            <p className="text-sm text-muted-foreground">
              {keys.length === 0
                ? "Não há chaves de throttler registradas no momento."
                : "Nenhuma chave corresponde aos filtros aplicados."}
            </p>
          </div>
        ) : (
          <>
            <div className="border-b bg-background">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {columns.map((column) => (
                      <TableHead
                        key={column.id}
                        className={cn(
                          TABLE_LAYOUT.CELL_PADDING,
                          TABLE_LAYOUT.MIN_HEIGHT,
                          column.width,
                          "text-muted-foreground"
                        )}
                        style={
                          column.id === columns[columns.length - 1].id && !isOverlay
                            ? { paddingRight: `calc(${TABLE_LAYOUT.CELL_PADDING_X} + ${scrollbarWidth}px)` }
                            : undefined
                        }
                      >
                        {typeof column.header === "function" ? column.header() : renderSortableHeader(column as any)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
              </Table>
            </div>
            <div className="flex-1 overflow-auto">
              <Table>
                <TableBody>
                  {paginatedKeys.map((key) => {
                    const isSelected = selectedIds.has(key.key);
                    return (
                      <TableRow
                        key={key.key}
                        className={cn(
                          "cursor-pointer hover:bg-muted/50 transition-colors",
                          isSelected && "bg-muted"
                        )}
                        onContextMenu={(e) => handleContextMenu(e, key)}
                        onClick={(e) => {
                          if (e.ctrlKey || e.metaKey) {
                            toggleSelection(key.key);
                          }
                        }}
                      >
                        {columns.map((column) => (
                          <TableCell
                            key={column.id}
                            className={cn(
                              column.id === "select" ? "p-0 !border-r-0" : TABLE_LAYOUT.CELL_PADDING,
                              TABLE_LAYOUT.MIN_HEIGHT,
                              column.width
                            )}
                          >
                            {column.cell(key)}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {sortedKeys.length > 0 && (
      <div className="mt-4">
        <SimplePaginationAdvanced
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          totalRecords={totalRecords}
        />
      </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-[200px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
            onClick={() => {
              onClearKeys?.(contextMenu.keys);
              closeContextMenu();
            }}
          >
            <IconTrash className="h-4 w-4" />
            <span>Limpar {contextMenu.isBulk ? `${contextMenu.keys.length} chaves` : "chave"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
