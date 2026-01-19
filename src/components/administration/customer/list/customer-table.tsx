import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Customer } from "../../../../types";
import { routes } from "../../../../constants";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { IconChevronUp, IconChevronDown, IconEdit, IconTrash, IconSelector, IconEye, IconAlertTriangle, IconUsers, IconPlus, IconGitMerge } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
import { useCustomers, useCustomerMutations, useCustomerBatchMutations } from "../../../../hooks";
import { toast } from "sonner";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import type { CustomerGetManyFormData } from "../../../../schemas";
import { useScrollbarWidth } from "@/hooks/use-scrollbar-width";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { createCustomerColumns } from "./customer-table-columns";
import type { CustomerColumn } from "./customer-table-columns";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/use-table-state";
import { CustomerListSkeleton } from "./customer-list-skeleton";
import { useAuth } from "@/contexts/auth-context";
import { canEditCustomers, canDeleteCustomers, shouldShowInteractiveElements } from "@/utils/permissions/entity-permissions";
import { getCustomerDetailRoute, getCustomerEditRoute } from "@/utils/sector-routes";

interface CustomerTableProps {
  visibleColumns: Set<string>;
  className?: string;
  onEdit?: (customers: Customer[]) => void;
  onDelete?: (customers: Customer[]) => void;
  onMerge?: (customers: Customer[]) => void;
  filters?: Partial<CustomerGetManyFormData>;
  onDataChange?: (data: { customers: Customer[]; totalRecords: number }) => void;
}

export function CustomerTable({ visibleColumns, className, onEdit, onDelete, onMerge, filters = {}, onDataChange }: CustomerTableProps) {
  const navigate = useNavigate();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { delete: deleteCustomer } = useCustomerMutations();
  const { batchDelete } = useCustomerBatchMutations();

  // Permission checks - wait for auth to load
  const canEdit = user ? canEditCustomers(user) : false;
  const canDelete = user ? canDeleteCustomers(user) : false;
  const showInteractive = user ? shouldShowInteractiveElements(user, 'customer') : false;

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
    handleRowClick: handleRowClickSelection,
  } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Memoize include configuration to prevent re-renders
  const includeConfig = React.useMemo(
    () => ({
      logo: true,
      _count: {
        tasks: true,
        serviceOrders: true,
      },
    }),
    [],
  );

  // Memoize query parameters to prevent infinite re-renders
  const queryParams = React.useMemo(() => {
    const params = {
      // Always apply base filters to prevent showing unintended records
      ...filters,
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

  // Use the customers hook with memoized parameters
  const { data: response, isLoading: isLoadingCustomers, error } = useCustomers(queryParams);

  const customers = response?.data || [];
  const totalRecords = response?.meta?.totalRecords || 0;
  const totalPages = Math.ceil(totalRecords / pageSize);

  // Notify parent component of data changes
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
      const dataKey = customers.length > 0 ? `${totalRecords}-${customers.map((customer) => customer.id).join(",")}` : `empty-${totalRecords}`;

      // Only notify if this exact data hasn't been notified yet
      if (dataKey !== lastNotifiedDataRef.current) {
        lastNotifiedDataRef.current = dataKey;
        onDataChange({ customers, totalRecords });
      }
    }
  }, [customers, totalRecords, onDataChange]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    customers: Customer[];
    isBulk: boolean;
  } | null>(null);

  // Use viewport boundary checking hook
  
  // Define all available columns
  const allColumns: CustomerColumn[] = createCustomerColumns();

  // Filter columns based on visibility
  const columns = allColumns.filter((col) => visibleColumns.has(col.key));

  // Get current page customer IDs for selection
  const currentPageCustomerIds = React.useMemo(() => {
    return customers.map((customer) => customer.id);
  }, [customers]);

  // Selection handlers
  const allSelected = isAllSelected(currentPageCustomerIds);
  const partiallySelected = isPartiallySelected(currentPageCustomerIds);

  const handleSelectAll = () => {
    toggleSelectAll(currentPageCustomerIds);
  };

  const handleSelectCustomer = (customerId: string, event?: React.MouseEvent) => {
    handleRowClickSelection(customerId, currentPageCustomerIds, event?.shiftKey || false);
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
  const handleContextMenu = (e: React.MouseEvent, customer: Customer) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if clicked customer is part of selection
    const isCustomerSelected = isSelected(customer.id);
    const hasSelection = selectionCount > 0;

    if (hasSelection && isCustomerSelected) {
      // Show bulk actions for all selected customers
      const selectedCustomersList = customers.filter((c) => isSelected(c.id));
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        customers: selectedCustomersList,
        isBulk: true,
      });
    } else {
      // Show actions for just the clicked customer
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        customers: [customer],
        isBulk: false,
      });
    }
  };

  const handleViewDetails = () => {
    if (contextMenu && !contextMenu.isBulk) {
      navigate(getCustomerDetailRoute(contextMenu.customers[0].id, user));
      setContextMenu(null);
    }
  };

  const handleEdit = () => {
    if (contextMenu) {
      if (contextMenu.isBulk && contextMenu.customers.length > 1) {
        // Bulk edit
        if (onEdit) {
          onEdit(contextMenu.customers);
        } else {
          toast.error("Edição em lote não implementada");
        }
      } else {
        // Single edit
        navigate(getCustomerEditRoute(contextMenu.customers[0].id, user));
      }
      setContextMenu(null);
    }
  };

  const handleDelete = async () => {
    if (contextMenu) {
      try {
        if (contextMenu.isBulk && contextMenu.customers.length > 1) {
          // Bulk delete
          if (onDelete) {
            onDelete(contextMenu.customers);
            // Remove deleted IDs from selection
            const deletedIds = contextMenu.customers.map((customer) => customer.id);
            removeFromSelection(deletedIds);
          } else {
            // Fallback to batch API
            const ids = contextMenu.customers.map((customer) => customer.id);
            await batchDelete({ customerIds: ids });
            // Remove deleted IDs from selection
            removeFromSelection(ids);
          }
        } else {
          // Single delete
          if (onDelete) {
            onDelete(contextMenu.customers);
            // Remove deleted ID from selection
            removeFromSelection([contextMenu.customers[0].id]);
          } else {
            await deleteCustomer(contextMenu.customers[0].id);
            // Remove deleted ID from selection
            removeFromSelection([contextMenu.customers[0].id]);
          }
        }
        setContextMenu(null);
      } catch (error) {
        // Error is handled by the API client with detailed message
        if (process.env.NODE_ENV !== 'production') {
          console.error("Error deleting customer(s):", error);
        }
      }
    }
  };

  // Close context menu when clicking outside
  React.useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  if (isLoadingCustomers) {
    return <CustomerListSkeleton />;
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
                  <div className="flex items-center justify-center h-full w-full px-2 min-h-[2.5rem]">
                    <Checkbox
                      checked={allSelected}
                      indeterminate={partiallySelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all customers"
                      disabled={isLoadingCustomers || customers.length === 0}
                      data-checkbox
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
              {!isOverlay && <TableHead style={{ width: `${scrollbarWidth}px`, minWidth: `${scrollbarWidth}px` }} className="bg-muted p-0 border-0 !border-r-0 shrink-0" />}
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
                    <div className="text-lg font-medium mb-2">Não foi possível carregar os clientes</div>
                    <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <IconUsers className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="text-lg font-medium mb-2">Nenhum cliente encontrado</div>
                    {filters && Object.keys(filters).length > 1 ? (
                      <div className="text-sm">Ajuste os filtros para ver mais resultados.</div>
                    ) : (
                      <>
                        <div className="text-sm mb-4">Comece cadastrando o primeiro cliente.</div>
                        <Button onClick={() => navigate(routes.administration.customers.create)} variant="outline">
                          <IconPlus className="h-4 w-4 mr-2" />
                          Cadastrar Cliente
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer, index) => {
                const customerIsSelected = isSelected(customer.id);

                return (
                  <TableRow
                    key={customer.id}
                    data-state={customerIsSelected ? "selected" : undefined}
                    className={cn(
                      "cursor-pointer transition-colors border-b border-border",
                      // Alternating row colors
                      index % 2 === 1 && "bg-muted/10",
                      // Hover state that works with alternating colors
                      "hover:bg-muted/20",
                      // Selected state overrides alternating colors
                      customerIsSelected && "bg-muted/30 hover:bg-muted/40",
                    )}
                    onClick={() => navigate(getCustomerDetailRoute(customer.id, user))}
                    onContextMenu={(e) => handleContextMenu(e, customer)}
                  >
                    {/* Selection checkbox */}
                    {showInteractive && (
                      <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                        <div
                          className="flex items-center justify-center h-full w-full px-2 py-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectCustomer(customer.id, e);
                          }}
                        >
                          <Checkbox
                            checked={customerIsSelected}
                            aria-label={`Select ${customer.fantasyName}`}
                            data-checkbox
                          />
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
                        <div className="px-4 py-2">{column.accessor(customer)}</div>
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
          {contextMenu?.isBulk && <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">{contextMenu.customers.length} clientes selecionados</div>}

          {!contextMenu?.isBulk && (
            <DropdownMenuItem onClick={handleViewDetails}>
              <IconEye className="mr-2 h-4 w-4" />
              Ver Detalhes
            </DropdownMenuItem>
          )}

          {canEdit && (
            <DropdownMenuItem onClick={handleEdit}>
              <IconEdit className="mr-2 h-4 w-4" />
              {contextMenu?.isBulk && contextMenu.customers.length > 1 ? "Editar em lote" : "Editar"}
            </DropdownMenuItem>
          )}

          {canEdit && contextMenu?.isBulk && contextMenu.customers.length > 1 && onMerge && (
            <DropdownMenuItem onClick={() => {
              if (contextMenu) {
                onMerge(contextMenu.customers);
                setContextMenu(null);
              }
            }}>
              <IconGitMerge className="mr-2 h-4 w-4" />
              Mesclar clientes
            </DropdownMenuItem>
          )}

          {(canEdit || canDelete) && <DropdownMenuSeparator />}

          {canDelete && (
            <DropdownMenuItem onClick={handleDelete} className="text-destructive">
              <IconTrash className="mr-2 h-4 w-4" />
              {contextMenu?.isBulk && contextMenu.customers.length > 1 ? "Deletar selecionados" : "Deletar"}
            </DropdownMenuItem>
          )}
        </PositionedDropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
