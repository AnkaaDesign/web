import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "../../../../types";
import { routes, USER_STATUS } from "../../../../constants";
import { useAuth } from "../../../../hooks/useAuth";
import { canEditUsers, canDeleteUsers, shouldShowInteractiveElements } from "@/utils/permissions/entity-permissions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { IconChevronUp, IconChevronDown, IconEdit, IconTrash, IconSelector, IconEye, IconAlertTriangle, IconUsers, IconPlus, IconUserCheck, IconUserX, IconGitMerge } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
import { useUsers, useUserMutations, useUserBatchMutations } from "../../../../hooks";
import { toast } from "sonner";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import type { UserGetManyFormData } from "../../../../schemas";
import { useScrollbarWidth } from "@/hooks/use-scrollbar-width";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { createUserColumns } from "./user-table-columns";
import type { UserColumn } from "./types";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/use-table-state";
import { UserListSkeleton } from "./user-list-skeleton";

interface UserTableProps {
  visibleColumns: Set<string>;
  className?: string;
  onEdit?: (users: User[]) => void;
  onMarkAsContracted?: (users: User[]) => void;
  onMarkAsDismissed?: (users: User[]) => void;
  onDelete?: (users: User[]) => void;
  onMerge?: (users: User[]) => void;
  filters?: Partial<UserGetManyFormData>;
  onDataChange?: (data: { users: User[]; totalRecords: number }) => void;
}

export function UserTable({ visibleColumns, className, onEdit, onMarkAsContracted, onMarkAsDismissed, onDelete, onMerge, filters = {}, onDataChange }: UserTableProps) {
  const navigate = useNavigate();
  const { delete: deleteUser, updateAsync: updateUser } = useUserMutations();
  const { batchDelete, batchUpdateAsync: batchUpdate } = useUserBatchMutations();

  // Permission checks
  const { user, isLoading: isAuthLoading } = useAuth();
  const canEdit = user ? canEditUsers(user) : false;
  const canDelete = user ? canDeleteUsers(user) : false;
  const showInteractive = user ? shouldShowInteractiveElements(user, 'user') : false;

  // Get scrollbar width info
  const { width: scrollbarWidth, isOverlay } = useScrollbarWidth();

  // Use URL state management for pagination and selection
  const {
    page,
    pageSize,
    selectedIds,
    sortConfigs,
    showSelectedOnly,
    setPage,
    setPageSize,
    toggleSelection,
    toggleSelectAll,
    toggleSort,
    getSortDirection,
    getSortOrder,
    isSelected,
    isAllSelected,
    isPartiallySelected,
    selectionCount,
    removeFromSelection,
  } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
    defaultSort: [{ key: 'name', direction: 'asc' }],
  });

  // Memoize include configuration to prevent re-renders
  const includeConfig = React.useMemo(
    () => ({
      position: true,
      sector: true,
      managedSector: true,
      _count: {
        select: {
          createdTasks: true,
          vacations: true,
        },
      },
    }),
    [],
  );

  // Memoize query parameters to prevent infinite re-renders
  const queryParams = React.useMemo(() => {
    const params = {
      // When showSelectedOnly is true, don't apply filters
      ...(showSelectedOnly ? {} : filters),
      page: page + 1, // Convert 0-based to 1-based for API
      limit: pageSize,
      include: includeConfig,
      // Convert sortConfigs to orderBy format for API
      ...(sortConfigs.length > 0 && {
        orderBy: convertSortConfigsToOrderBy(sortConfigs),
      }),
      // Filter by selected IDs when showSelectedOnly is true
      ...(showSelectedOnly &&
        selectedIds.length > 0 && {
          where: {
            id: { in: selectedIds },
          },
        }),
    };

    return params;
  }, [filters, page, pageSize, includeConfig, sortConfigs, showSelectedOnly, selectedIds]);

  // Use the users hook with memoized parameters
  const { data: response, isLoading, error } = useUsers(queryParams);

  const users = response?.data || [];
  const totalRecords = response?.meta?.totalRecords || 0;
  const totalPages = Math.ceil(totalRecords / pageSize);

  // Notify parent component of data changes
  // Use a ref to track if we've already notified for this exact data
  const lastNotifiedDataRef = React.useRef<string>("");
  const isMountedRef = React.useRef(true);

  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    if (onDataChange && isMountedRef.current) {
      // Create a unique key for the current data to detect real changes
      const dataKey = users.length > 0 ? `${totalRecords}-${users.map((user) => user.id).join(",")}` : `empty-${totalRecords}`;

      // Only notify if this exact data hasn't been notified yet
      if (dataKey !== lastNotifiedDataRef.current) {
        lastNotifiedDataRef.current = dataKey;
        onDataChange({ users, totalRecords });
      }
    }
  }, [users, totalRecords, onDataChange]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    users: User[];
    isBulk: boolean;
  } | null>(null);

  // Use viewport boundary checking hook
  
  // Define all available columns
  const allColumns: UserColumn[] = createUserColumns();

  // Filter columns based on visibility
  const columns = allColumns.filter((col) => visibleColumns.has(col.key));

  // Get current page user IDs for selection
  const currentPageUserIds = React.useMemo(() => {
    return users.map((user) => user.id);
  }, [users]);

  // Selection handlers
  const allSelected = isAllSelected(currentPageUserIds);
  const partiallySelected = isPartiallySelected(currentPageUserIds);

  const handleSelectAll = () => {
    toggleSelectAll(currentPageUserIds);
  };

  const handleSelectUser = (userId: string) => {
    toggleSelection(userId);
  };

  const renderSortIndicator = (columnKey: string) => {
    const sortDirection = getSortDirection(columnKey);
    const sortOrder = getSortOrder(columnKey);

    return (
      <div className="inline-flex items-center ml-1">
        {sortDirection === null && <IconSelector className="h-4 w-4 text-muted-foreground" />}
        {sortDirection === "asc" && <IconChevronUp className="h-4 w-4 text-foreground" />}
        {sortDirection === "desc" && <IconChevronDown className="h-4 w-4 text-foreground" />}
        {sortOrder !== null && sortConfigs.length > 1 && <span className="text-xs ml-0.5">{sortOrder + 1}</span>}
      </div>
    );
  };

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent, user: User) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if clicked user is part of selection
    const isUserSelected = isSelected(user.id);
    const hasSelection = selectionCount > 0;

    if (hasSelection && isUserSelected) {
      // Show bulk actions for all selected users
      const selectedUsersList = users.filter((u) => isSelected(u.id));
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        users: selectedUsersList,
        isBulk: true,
      });
    } else {
      // Show actions for just the clicked user
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        users: [user],
        isBulk: false,
      });
    }
  };

  const handleViewDetails = () => {
    if (contextMenu && !contextMenu.isBulk) {
      navigate(routes.administration.collaborators.details(contextMenu.users[0].id));
      setContextMenu(null);
    }
  };

  const handleEdit = () => {
    if (contextMenu) {
      if (contextMenu.isBulk && contextMenu.users.length > 1) {
        // Bulk edit
        if (onEdit) {
          onEdit(contextMenu.users);
        } else {
          toast.error("Edição em lote não implementada");
        }
      } else {
        // Single edit
        navigate(routes.administration.collaborators.edit(contextMenu.users[0].id));
      }
      setContextMenu(null);
    }
  };

  const handleMarkAsContracted = async () => {
    if (contextMenu) {
      try {
        if (onMarkAsContracted) {
          onMarkAsContracted(contextMenu.users);
        } else {
          // Fallback to direct API calls
          if (contextMenu.isBulk && contextMenu.users.length > 1) {
            // Bulk mark as effected
            const users = contextMenu.users.map((user) => ({
              id: user.id,
              data: { status: USER_STATUS.EFFECTED },
            }));
            await batchUpdate({ users });
          } else {
            // Single mark as effected
            await updateUser({
              id: contextMenu.users[0].id,
              data: { status: USER_STATUS.EFFECTED },
            });
          }
        }
        setContextMenu(null);
      } catch (error) {
        console.error("Error marking user(s) as effected:", error);
      }
    }
  };

  const handleMarkAsDismissed = async () => {
    if (contextMenu) {
      try {
        if (onMarkAsDismissed) {
          onMarkAsDismissed(contextMenu.users);
        } else {
          // Fallback to direct API calls
          if (contextMenu.isBulk && contextMenu.users.length > 1) {
            // Bulk mark as dismissed
            const users = contextMenu.users.map((user) => ({
              id: user.id,
              data: { status: USER_STATUS.DISMISSED, dismissedAt: new Date() },
            }));
            await batchUpdate({ users });
          } else {
            // Single mark as dismissed
            await updateUser({
              id: contextMenu.users[0].id,
              data: { status: USER_STATUS.DISMISSED, dismissedAt: new Date() },
            });
          }
        }
        setContextMenu(null);
      } catch (error) {
        console.error("Error marking user(s) as dismissed:", error);
      }
    }
  };

  const handleDelete = async () => {
    if (contextMenu) {
      try {
        if (contextMenu.isBulk && contextMenu.users.length > 1) {
          // Bulk delete
          if (onDelete) {
            onDelete(contextMenu.users);
            // Remove deleted IDs from selection
            const deletedIds = contextMenu.users.map((user) => user.id);
            removeFromSelection(deletedIds);
          } else {
            // Fallback to batch API
            const ids = contextMenu.users.map((user) => user.id);
            await batchDelete({ userIds: ids });
            // Remove deleted IDs from selection
            removeFromSelection(ids);
          }
        } else {
          // Single delete
          if (onDelete) {
            onDelete(contextMenu.users);
            // Remove deleted ID from selection
            removeFromSelection([contextMenu.users[0].id]);
          } else {
            await deleteUser(contextMenu.users[0].id);
            // Remove deleted ID from selection
            removeFromSelection([contextMenu.users[0].id]);
          }
        }
        setContextMenu(null);
      } catch (error) {
        // Error is handled by the API client with detailed message
        console.error("Error deleting user(s):", error);
      }
    }
  };

  // Close context menu when clicking outside
  React.useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  if (isLoading) {
    return <UserListSkeleton />;
  }

  return (
    <div className={cn("rounded-lg flex flex-col overflow-hidden", className)}>
      {/* Fixed Header Table */}
      <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
            <TableRow className="bg-muted hover:bg-muted even:bg-muted">
              {/* Selection column */}
              {showInteractive && (
                <TableHead className={cn(TABLE_LAYOUT.checkbox.className, "whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0")}>
                  <div className="flex items-center justify-center h-full w-full px-2">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all users"
                      disabled={isLoading || users.length === 0}
                      indeterminate={partiallySelected}
                    />
                  </div>
                </TableHead>
              )}

              {/* Data columns */}
              {columns.map((column) => (
                <TableHead key={column.key} className={cn("whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0", column.className)}>
                  {column.sortable ? (
                    <button
                      onClick={() => toggleSort(column.key)}
                      className={cn(
                        "flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent",
                        column.align === "center" && "justify-center",
                        column.align === "right" && "justify-end",
                        !column.align && "justify-start",
                      )}
                      disabled={isLoading || users.length === 0}
                    >
                      <TruncatedTextWithTooltip text={column.header} />
                      {renderSortIndicator(column.key)}
                    </button>
                  ) : (
                    <div
                      className={cn(
                        "flex items-center h-full min-h-[2.5rem] px-4 py-2",
                        column.align === "center" && "justify-center text-center",
                        column.align === "right" && "justify-end text-right",
                        !column.align && "justify-start text-left",
                      )}
                    >
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
            {error ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-destructive">
                    <IconAlertTriangle className="h-8 w-8 mb-4" />
                    <div className="text-lg font-medium mb-2">Não foi possível carregar os usuários</div>
                    <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <IconUsers className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="text-lg font-medium mb-2">Nenhum usuário encontrado</div>
                    {filters && Object.keys(filters).length > 1 ? (
                      <div className="text-sm">Ajuste os filtros para ver mais resultados.</div>
                    ) : (
                      <>
                        <div className="text-sm mb-4">Comece cadastrando o primeiro usuário.</div>
                        <Button onClick={() => navigate(routes.administration.collaborators.create)} variant="outline">
                          <IconPlus className="h-4 w-4 mr-2" />
                          Cadastrar Usuário
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              users.map((user, index) => {
                const userIsSelected = isSelected(user.id);

                return (
                  <TableRow
                    key={user.id}
                    data-state={userIsSelected ? "selected" : undefined}
                    className={cn(
                      "cursor-pointer transition-colors border-b border-border",
                      // Alternating row colors
                      index % 2 === 1 && "bg-muted/10",
                      // Hover state that works with alternating colors
                      "hover:bg-muted/20",
                      // Selected state overrides alternating colors
                      userIsSelected && "bg-muted/30 hover:bg-muted/40",
                    )}
                    onClick={() => navigate(routes.administration.collaborators.details(user.id))}
                    onContextMenu={(e) => handleContextMenu(e, user)}
                  >
                    {/* Selection checkbox */}
                    {showInteractive && (
                      <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                        <div className="flex items-center justify-center h-full w-full px-2 py-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={userIsSelected} onCheckedChange={() => handleSelectUser(user.id)} aria-label={`Select ${user.name}`} data-checkbox />
                        </div>
                      </TableCell>
                    )}

                    {/* Data columns */}
                    {columns.map((column) => (
                      <TableCell
                        key={column.key}
                        className={cn(
                          column.className,
                          "p-0 !border-r-0",
                          column.align === "center" && "text-center",
                          column.align === "right" && "text-right",
                          column.align === "left" && "text-left",
                          !column.align && "text-left",
                        )}
                      >
                        <div className="px-4 py-2">{column.accessor(user)}</div>
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
        <PositionedDropdownMenuContent
        position={contextMenu}
        isOpen={!!contextMenu}
        className="w-56 ![position:fixed]"
        onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {contextMenu?.isBulk && <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">{contextMenu.users.length} usuários selecionados</div>}

          {!contextMenu?.isBulk && (
            <DropdownMenuItem onClick={handleViewDetails}>
              <IconEye className="mr-2 h-4 w-4" />
              Ver Detalhes
            </DropdownMenuItem>
          )}

          {canEdit && (
            <DropdownMenuItem onClick={handleEdit}>
              <IconEdit className="mr-2 h-4 w-4" />
              {contextMenu?.isBulk && contextMenu.users.length > 1 ? "Editar em lote" : "Editar"}
            </DropdownMenuItem>
          )}

          {canEdit && contextMenu?.isBulk && contextMenu.users.length > 1 && onMerge && (
            <DropdownMenuItem onClick={() => {
              if (contextMenu) {
                onMerge(contextMenu.users);
                setContextMenu(null);
              }
            }}>
              <IconGitMerge className="mr-2 h-4 w-4" />
              Mesclar usuários
            </DropdownMenuItem>
          )}

          {canEdit && (
            <>
              <DropdownMenuSeparator />

              {/* Show efetivar option if any user is in experience period */}
              {contextMenu?.users.some((user) => user.status === USER_STATUS.EXPERIENCE_PERIOD_1 || user.status === USER_STATUS.EXPERIENCE_PERIOD_2) && (
                <DropdownMenuItem onClick={handleMarkAsContracted}>
                  <IconUserCheck className="mr-2 h-4 w-4" />
                  {contextMenu?.isBulk && contextMenu.users.length > 1 ? "Efetivar selecionados" : "Efetivar"}
                </DropdownMenuItem>
              )}

              {/* Show dismiss option if any user is not dismissed */}
              {contextMenu?.users.some((user) => user.status !== USER_STATUS.DISMISSED) && (
                <DropdownMenuItem onClick={handleMarkAsDismissed}>
                  <IconUserX className="mr-2 h-4 w-4" />
                  {contextMenu?.isBulk && contextMenu.users.length > 1 ? "Demitir selecionados" : "Demitir"}
                </DropdownMenuItem>
              )}
            </>
          )}

          {(canEdit || canDelete) && <DropdownMenuSeparator />}

          {canDelete && (
            <DropdownMenuItem onClick={handleDelete} className="text-destructive">
              <IconTrash className="mr-2 h-4 w-4" />
              {contextMenu?.isBulk && contextMenu.users.length > 1 ? "Deletar selecionados" : "Deletar"}
            </DropdownMenuItem>
          )}
        </PositionedDropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
