import React, { useMemo, useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { IconChevronUp, IconChevronDown, IconSelector, IconTrash, IconUser, IconWorld, IconClock, IconAlertTriangle, IconPackage } from "@tabler/icons-react";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/use-table-state";
import { cn } from "@/lib/utils";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { useScrollbarWidth } from "@/hooks/use-scrollbar-width";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import type { ThrottlerKey, BlockedKey } from "@/api-client/throttler";
import { TtlCountdown } from "./ttl-countdown";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { UserNameCell } from "./user-name-cell";

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
}

export function ThrottlerKeysTable({
  keys,
  isLoading,
  onClearKeys,
  filters = {},
  className,
}: ThrottlerKeysTableProps) {
  // Get scrollbar width info
  const { width: scrollbarWidth, isOverlay } = useScrollbarWidth();

  // Use URL state management for pagination and sorting
  const { page, pageSize, sortConfigs, setPage, setPageSize, toggleSort, getSortDirection, getSortOrder } = useTableState({
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


  // Get current page key IDs for selection
  const currentPageKeyIds = useMemo(() => {
    return paginatedKeys.map((key) => key.key);
  }, [paginatedKeys]);

  // Selection handlers
  const allSelected = selectedIds.size === paginatedKeys.length && paginatedKeys.length > 0;
  const partiallySelected = selectedIds.size > 0 && selectedIds.size < paginatedKeys.length;

  const handleSelectAll = () => {
    toggleSelectAll();
  };

  // Define table columns
  const columns = [
    {
      id: "select",
      header: "SELECT",
      sortable: false,
      cell: (key: ThrottlerKey | BlockedKey) => (
        <div className="flex items-center justify-center h-full w-full" onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={selectedIds.has(key.key)} onCheckedChange={() => toggleSelection(key.key)} aria-label={`Selecionar chave ${key.key}`} data-checkbox />
        </div>
      ),
      width: TABLE_LAYOUT.checkbox.className,
      align: "center" as const,
    },
    {
      id: "status",
      header: "STATUS",
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
      align: "left" as const,
    },
    {
      id: "user",
      header: "USUÁRIO",
      sortable: true,
      cell: (key: ThrottlerKey | BlockedKey) => {
        // Parse identifier format: user:{userId}-ip:{ipAddress}
        const identifier = key.identifier || "";

        // Extract user part - capture everything between "user:" and "-ip:"
        const userMatch = identifier.match(/user:(.+?)-ip:/);
        const userId = userMatch ? userMatch[1] : null;

        // Handle anonymous or missing user
        if (!userId || userId === "anonymous" || userId === "undefined" || userId === "null") {
          return <span className="text-muted-foreground">-</span>;
        }

        // Use the UserNameCell component to fetch and display user name
        return <UserNameCell userId={userId} />;
      },
      width: "w-64",
      align: "left" as const,
    },
    {
      id: "ip",
      header: "IP",
      sortable: true,
      cell: (key: ThrottlerKey | BlockedKey) => {
        // Parse identifier format: user:{userId}-ip:{ipAddress}
        const identifier = key.identifier || "";

        // Extract IP part
        const ipMatch = identifier.match(/ip:(.+?)(?:-|$)/);
        let ipAddress = ipMatch ? ipMatch[1] : null;

        // Handle undefined or empty IP
        if (!ipAddress || ipAddress === "undefined" || ipAddress === "null" || ipAddress === "unknown") {
          return <span className="text-muted-foreground">-</span>;
        }

        // Handle IPv6 localhost addresses
        if (ipAddress === "::1") {
          ipAddress = "localhost";
        }
        // Handle IPv4-mapped IPv6 addresses
        else if (ipAddress.startsWith("::ffff:")) {
          ipAddress = ipAddress.substring(7);
        }

        return (
          <div className="flex items-center gap-2">
            <IconWorld className="h-4 w-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
            <span className="font-mono text-sm truncate" title={identifier}>
              {ipAddress}
            </span>
          </div>
        );
      },
      width: "w-40",
      align: "left" as const,
    },
    {
      id: "controller",
      header: "ENDPOINT",
      sortable: true,
      cell: (key: ThrottlerKey | BlockedKey) => (
        <div className="font-mono text-sm truncate">
          {key.controller && key.method ? `${key.controller}.${key.method}` : "-"}
        </div>
      ),
      width: "min-w-0 flex-1",
      align: "left" as const,
    },
    {
      id: "throttlerName",
      header: "THROTTLER",
      sortable: false,
      cell: (key: ThrottlerKey | BlockedKey) => (
        <Badge variant="outline" className="font-mono text-xs">
          {key.throttlerName || "-"}
        </Badge>
      ),
      width: "w-32",
      align: "left" as const,
    },
    {
      id: "hits",
      header: "REQUISIÇÕES",
      sortable: false,
      cell: (key: ThrottlerKey | BlockedKey) => {
        const hits = "hits" in key ? key.hits : null;
        return hits !== null ? (
          <span className="font-medium">{hits}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
      width: "w-40",
      align: "left" as const,
    },
    {
      id: "ttl",
      header: "EXPIRA EM",
      sortable: true,
      cell: (key: ThrottlerKey | BlockedKey) => {
        if (!key.ttl || key.ttl <= 0) {
          return <span className="text-muted-foreground">-</span>;
        }
        return <TtlCountdown ttl={key.ttl} />;
      },
      width: "w-32",
      align: "left" as const,
    },
  ];

  // Render sort indicator
  const renderSortIndicator = (columnId: string) => {
    const sortDirection = getSortDirection(columnId);
    const sortOrder = getSortOrder(columnId);

    return (
      <div className="inline-flex items-center ml-1">
        {sortDirection === null && <IconSelector className="h-4 w-4 text-muted-foreground" />}
        {sortDirection === "asc" && <IconChevronUp className="h-4 w-4 text-foreground" />}
        {sortDirection === "desc" && <IconChevronDown className="h-4 w-4 text-foreground" />}
        {sortOrder !== null && sortConfigs.length > 1 && <span className="text-xs ml-0.5">{sortOrder + 1}</span>}
      </div>
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
    <div className={cn("rounded-lg flex flex-col overflow-hidden", className)}>
      {/* Fixed Header Table */}
      <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
            <TableRow className="bg-muted hover:bg-muted even:bg-muted">
              {/* Selection column */}
              <TableHead className={cn(TABLE_LAYOUT.checkbox.className, "whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0")}>
                <div className="flex items-center justify-center h-full w-full px-2">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={partiallySelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="Selecionar todos"
                    disabled={isLoading || paginatedKeys.length === 0}
                  />
                </div>
              </TableHead>

              {/* Data columns */}
              {columns.slice(1).map((column) => (
                <TableHead key={column.id} className={cn("whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0", column.width)}>
                  {column.sortable ? (
                    <button
                      onClick={() => toggleSort(column.id)}
                      className={cn(
                        "flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer border-0 bg-transparent",
                        column.align === "center" && "justify-center",
                        column.align === "right" && "justify-end",
                        !column.align && "justify-start",
                      )}
                      disabled={isLoading || paginatedKeys.length === 0}
                    >
                      <TruncatedTextWithTooltip text={column.header} />
                      {renderSortIndicator(column.id)}
                    </button>
                  ) : (
                    <div className={cn(
                      "flex items-center h-full min-h-[2.5rem] px-4 py-2",
                      column.align === "center" && "justify-center text-center",
                      column.align === "right" && "justify-end text-right",
                      !column.align && "justify-start text-left",
                    )}>
                      <TruncatedTextWithTooltip text={column.header} />
                    </div>
                  )}
                </TableHead>
              ))}

              {/* Scrollbar spacer - only show if not overlay scrollbar */}
              {!isOverlay && (
                <TableHead style={{ width: `${scrollbarWidth}px`, minWidth: `${scrollbarWidth}px` }} className="bg-muted p-0 border-0 !border-r-0 shrink-0"></TableHead>
              )}
            </TableRow>
          </TableHeader>
        </Table>
      </div>

      {/* Scrollable Body Table */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden border-l border-r border-border">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableBody>
            {sortedKeys.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <IconClock className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="text-lg font-medium mb-2">Nenhuma chave encontrada</div>
                    <div className="text-sm">
                      {keys.length === 0
                        ? "Não há chaves de throttler registradas no momento."
                        : "Nenhuma chave corresponde aos filtros aplicados."}
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedKeys.map((key, index) => {
                const keyIsSelected = selectedIds.has(key.key);

                return (
                  <TableRow
                    key={key.key}
                    data-state={keyIsSelected ? "selected" : undefined}
                    className={cn(
                      "cursor-pointer transition-colors border-b border-border",
                      // Alternating row colors
                      index % 2 === 1 && "bg-muted/10",
                      // Hover state that works with alternating colors
                      "hover:bg-muted/20",
                      // Selected state overrides alternating colors
                      keyIsSelected && "bg-muted/30 hover:bg-muted/40",
                    )}
                    onContextMenu={(e) => handleContextMenu(e, key)}
                    onClick={(e) => {
                      if (e.ctrlKey || e.metaKey) {
                        toggleSelection(key.key);
                      }
                    }}
                  >
                    {/* Selection checkbox */}
                    <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                      <div className="flex items-center justify-center h-full w-full px-2 py-2" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={keyIsSelected} onCheckedChange={() => toggleSelection(key.key)} aria-label={`Selecionar chave ${key.key}`} data-checkbox />
                      </div>
                    </TableCell>

                    {/* Data columns */}
                    {columns.slice(1).map((column) => (
                      <TableCell
                        key={column.id}
                        className={cn(
                          column.width,
                          "p-0 !border-r-0"
                        )}
                      >
                        <div className={cn(
                          "flex items-center px-4 py-2",
                          column.align === "center" && "justify-center",
                          column.align === "right" && "justify-end",
                          column.align === "left" && "justify-start",
                          !column.align && "justify-start",
                        )}>
                          {column.cell(key)}
                        </div>
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      <div className="px-4 border-l border-r border-b border-border rounded-b-lg bg-muted/50">
        <SimplePaginationAdvanced
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          pageSize={pageSize}
          totalItems={totalRecords}
          pageSizeOptions={[20, 40, 60, 100]}
          onPageSizeChange={setPageSize}
          showPageSizeSelector={true}
          showGoToPage={true}
          showPageInfo={true}
        />
      </div>

      {/* Context Menu */}
      <DropdownMenu open={!!contextMenu} onOpenChange={(open) => !open && setContextMenu(null)}>
        <DropdownMenuContent
          style={{
            position: "fixed",
            left: contextMenu?.x,
            top: contextMenu?.y,
          }}
          className="w-56"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {contextMenu?.isBulk && <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">{contextMenu.keys.length} chaves selecionadas</div>}

          <DropdownMenuItem onClick={() => {
            if (contextMenu) {
              onClearKeys?.(contextMenu.keys);
              setContextMenu(null);
            }
          }}>
            <IconTrash className="mr-2 h-4 w-4" />
            {contextMenu?.isBulk && contextMenu.keys.length > 1 ? `Limpar ${contextMenu.keys.length} chaves` : "Limpar chave"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
