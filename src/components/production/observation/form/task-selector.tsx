import React, { useState, useMemo, useRef, useEffect } from "react";
import { IconSearch, IconFilter } from "@tabler/icons-react";
import { useTasks, useCustomers, useUsers, useSectors } from "../../../../hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingSpinner } from "@/components/ui/loading";
import { Combobox } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { cn } from "@/lib/utils";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { convertSortConfigsToOrderBy } from "@/hooks/use-table-state";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { useScrollbarWidth } from "@/hooks/use-scrollbar-width";
import { useDebounce } from "@/hooks/use-debounce";
import { TASK_STATUS, TASK_STATUS_LABELS } from "../../../../constants";
import { formatDate } from "../../../../utils";
import type { Task } from "../../../../types";

interface TaskSelectorProps {
  selectedTasks: Set<string>;
  onSelectTask: (taskId: string) => void;
  onSelectAll: () => void;
  className?: string;
  isSelected?: (taskId: string) => boolean;
  // URL state props
  showSelectedOnly?: boolean;
  searchTerm?: string;
  statusIds?: string[];
  customerIds?: string[];
  userIds?: string[];
  sectorIds?: string[];
  onSearchTermChange?: (term: string) => void;
  onStatusIdsChange?: (ids: string[]) => void;
  onCustomerIdsChange?: (ids: string[]) => void;
  onUserIdsChange?: (ids: string[]) => void;
  onSectorIdsChange?: (ids: string[]) => void;
  onShowSelectedOnlyChange?: (value: boolean) => void;
  // Sorting props
  sortConfigs?: Array<{ column: string; direction: "asc" | "desc" }>;
  toggleSort?: (column: string) => void;
  getSortDirection?: (column: string) => "asc" | "desc" | null;
  getSortOrder?: (column: string) => number | null;
  // Pagination props
  page?: number; // 0-based from useTableState
  pageSize?: number;
  totalRecords?: number;
  onPageChange?: (page: number) => void; // Expects 0-based
  onPageSizeChange?: (pageSize: number) => void;
  onTotalRecordsChange?: (total: number) => void;
}

export const TaskSelector = ({
  selectedTasks,
  onSelectTask,
  onSelectAll: _onSelectAll,
  className,
  isSelected = (taskId: string) => selectedTasks.has(taskId),
  // URL state props
  showSelectedOnly: showSelectedOnlyProp,
  searchTerm: searchTermProp,
  statusIds: statusIdsProp,
  customerIds: customerIdsProp,
  userIds: userIdsProp,
  sectorIds: sectorIdsProp,
  onSearchTermChange,
  onStatusIdsChange,
  onCustomerIdsChange,
  onUserIdsChange,
  onSectorIdsChange,
  // Sorting props
  sortConfigs: sortConfigsProp,
  getSortDirection: _getSortDirectionProp,
  getSortOrder: _getSortOrderProp,
  // Pagination props
  page: pageProp,
  pageSize: pageSizeProp,
  totalRecords: _totalRecordsProp,
  onPageChange,
  onPageSizeChange,
  onTotalRecordsChange,
}: TaskSelectorProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Get scrollbar width info
  const { width: scrollbarWidth, isOverlay } = useScrollbarWidth();

  // Form state - always use local state for immediate UI updates
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTermProp || "");
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Local filter state for modal (only applied when "Apply" is clicked)
  const [tempStatusIds, setTempStatusIds] = useState<string[]>([]);
  const [tempCustomerIds, setTempCustomerIds] = useState<string[]>([]);
  const [tempUserIds, setTempUserIds] = useState<string[]>([]);
  const [tempSectorIds, setTempSectorIds] = useState<string[]>([]);

  // Sync prop changes to local state
  useEffect(() => {
    if (searchTermProp !== undefined) {
      setLocalSearchTerm(searchTermProp);
    }
  }, [searchTermProp]);

  // Always use local state for immediate UI feedback
  const searchTerm = localSearchTerm;
  const statusIds = statusIdsProp || [];
  const customerIds = customerIdsProp || [];
  const userIds = userIdsProp || [];
  const sectorIds = sectorIdsProp || [];

  // Initialize temp state from URL state ONLY when modal opens
  useEffect(() => {
    if (isFilterModalOpen) {
      setTempStatusIds(statusIdsProp || []);
      setTempCustomerIds(customerIdsProp || []);
      setTempUserIds(userIdsProp || []);
      setTempSectorIds(sectorIdsProp || []);
    }
  }, [isFilterModalOpen]); // Only depend on modal open state

  // Get page size - use prop or default to 20
  const currentPageSize = pageSizeProp || 20;

  // Use props directly for pagination and sorting
  // pageProp is 0-based from useTableState, convert to 1-based for internal use
  const page = pageProp !== undefined ? pageProp + 1 : 1;
  const sortConfigs = sortConfigsProp || [{ column: "name", direction: "asc" as const }];

  // Debounce search term with longer delay
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Build query parameters for tasks - only show finished tasks
  const taskQuery = useMemo(() => {
    const query: any = {
      searchingFor: debouncedSearchTerm || undefined,
      page: page - 1, // Convert from 1-based (UI) to 0-based (API)
      limit: currentPageSize,
      status: [TASK_STATUS.COMPLETED], // Only show completed tasks
      include: {
        sector: true,
        customer: true,
        createdBy: true,
        services: true,
        files: true,
        observation: true,
        commissions: true,
      },
    };

    // Add filters - override status if provided
    if (statusIds.length > 0) {
      query.status = statusIds;
    }
    if (customerIds.length > 0) {
      query.customerIds = customerIds;
    }
    if (userIds.length > 0) {
      query.createdByIds = userIds;
    }
    if (sectorIds.length > 0) {
      query.sectorIds = sectorIds;
    }

    // Add sorting
    if (sortConfigs.length > 0) {
      query.orderBy = convertSortConfigsToOrderBy(sortConfigs);
    } else {
      query.orderBy = { name: "asc" };
    }

    return query;
  }, [debouncedSearchTerm, page, currentPageSize, statusIds, customerIds, userIds, sectorIds, sortConfigs]);

  // Fetch tasks
  const { data: taskResponse, isLoading } = useTasks(taskQuery);
  const tasks = taskResponse?.data || [];
  const totalRecords = taskResponse?.meta?.totalRecords || 0;

  // Update total records when data changes
  useEffect(() => {
    if (onTotalRecordsChange && taskResponse?.meta?.totalRecords !== undefined) {
      onTotalRecordsChange(taskResponse.meta.totalRecords);
    }
  }, [taskResponse?.meta?.totalRecords, onTotalRecordsChange]);

  // Fetch filter data (API has max limit of 100)
  const { data: customersResponse } = useCustomers({ limit: 100, orderBy: { fantasyName: "asc" } });
  const { data: usersResponse } = useUsers({ limit: 100, orderBy: { name: "asc" } });
  const { data: sectorsResponse } = useSectors({ limit: 100, orderBy: { name: "asc" } });

  const customers = customersResponse?.data || [];
  const users = usersResponse?.data || [];
  const sectors = sectorsResponse?.data || [];

  // Filter displayed tasks if showing selected only
  const displayedTasks = useMemo(() => {
    if (showSelectedOnlyProp && selectedTasks.size > 0) {
      return tasks.filter((task) => selectedTasks.has(task.id));
    }
    return tasks;
  }, [tasks, showSelectedOnlyProp, selectedTasks]);

  // Handle search input change
  const handleSearchChange = (value: string) => {
    setLocalSearchTerm(value);
    if (onSearchTermChange) {
      onSearchTermChange(value);
    }
  };

  // Handle filter modal apply
  const handleApplyFilters = () => {
    if (onStatusIdsChange) onStatusIdsChange(tempStatusIds);
    if (onCustomerIdsChange) onCustomerIdsChange(tempCustomerIds);
    if (onUserIdsChange) onUserIdsChange(tempUserIds);
    if (onSectorIdsChange) onSectorIdsChange(tempSectorIds);
    setIsFilterModalOpen(false);
  };

  // Handle clear all filters
  const handleClearAllFilters = () => {
    setTempStatusIds([]);
    setTempCustomerIds([]);
    setTempUserIds([]);
    setTempSectorIds([]);
    if (onStatusIdsChange) onStatusIdsChange([]);
    if (onCustomerIdsChange) onCustomerIdsChange([]);
    if (onUserIdsChange) onUserIdsChange([]);
    if (onSectorIdsChange) onSectorIdsChange([]);
  };

  // Get status badge (function not used but kept for potential future use)
  // const getStatusBadge = (status: string) => {
  //   const label = TASK_STATUS_LABELS[status as keyof typeof TASK_STATUS_LABELS] || status;
  //   let icon = null;
  //   let variant: "default" | "secondary" | "destructive" | "outline" = "default";

  //   switch (status) {
  //     case TASK_STATUS.COMPLETED:
  //       icon = <IconCheck className="h-3 w-3" />;
  //       variant = "default";
  //       break;
  //     case TASK_STATUS.CANCELLED:
  //       icon = <IconX className="h-3 w-3" />;
  //       variant = "destructive";
  //       break;
  //     case TASK_STATUS.IN_PRODUCTION:
  //       icon = <IconClock className="h-3 w-3" />;
  //       variant = "secondary";
  //       break;
  //     case TASK_STATUS.ON_HOLD:
  //       icon = <IconAlertCircle className="h-3 w-3" />;
  //       variant = "outline";
  //       break;
  //     default:
  //       variant = "outline";
  //   }

  //   return (
  //     <Badge variant={variant} className="gap-1 whitespace-nowrap">
  //       {icon}
  //       {label}
  //     </Badge>
  //   );
  // };

  // Handle row click
  const handleRowClick = (task: Task, event: React.MouseEvent) => {
    // Don't handle clicks on interactive elements
    const target = event.target as HTMLElement;
    if (target.closest('input[type="checkbox"]') || target.closest("button")) {
      return;
    }
    onSelectTask(task.id);
  };

  // Get active filter count
  const activeFilterCount = statusIds.length + customerIds.length + userIds.length + sectorIds.length;

  return (
    <div className={cn("flex flex-col h-full space-y-4", className)}>
      {/* Search and Controls */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1 relative">
          <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar tarefas..." value={searchTerm} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearchChange(e.target.value)} className="pl-10" />
        </div>
        <div className="flex gap-2">
          <Dialog open={isFilterModalOpen} onOpenChange={setIsFilterModalOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="relative">
                <IconFilter className="h-4 w-4 mr-2" />
                Filtros
                {activeFilterCount > 0 && (
                  <Badge className="ml-2 h-5 w-5 p-0 text-xs" variant="destructive">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Filtros de Tarefas</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Combobox
                    options={Object.entries(TASK_STATUS_LABELS).map(([value, label]) => ({
                      value,
                      label,
                    }))}
                    mode="multiple"
                    value={tempStatusIds}
                    onValueChange={setTempStatusIds}
                    placeholder="Selecionar status..."
                    searchPlaceholder="Buscar status..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Clientes</Label>
                  <Combobox
                    options={customers.map((customer) => ({
                      value: customer.id,
                      label: customer.fantasyName,
                    }))}
                    mode="multiple"
                    value={tempCustomerIds}
                    onValueChange={setTempCustomerIds}
                    placeholder="Selecionar clientes..."
                    searchPlaceholder="Buscar clientes..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Usuários</Label>
                  <Combobox
                    options={users.map((user) => ({
                      value: user.id,
                      label: user.name,
                    }))}
                    mode="multiple"
                    value={tempUserIds}
                    onValueChange={setTempUserIds}
                    placeholder="Selecionar usuários..."
                    searchPlaceholder="Buscar usuários..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Setores</Label>
                  <Combobox
                    options={sectors.map((sector) => ({
                      value: sector.id,
                      label: sector.name,
                    }))}
                    mode="multiple"
                    value={tempSectorIds}
                    onValueChange={setTempSectorIds}
                    placeholder="Selecionar setores..."
                    searchPlaceholder="Buscar setores..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleClearAllFilters}>
                  Limpar todos
                </Button>
                <Button onClick={handleApplyFilters}>Aplicar filtros</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 min-h-0">
        <div className={cn("rounded-lg flex flex-col overflow-hidden h-full")}>
          {/* Fixed Header Table */}
          <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
            <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
              <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
                <TableRow className="bg-muted hover:bg-muted even:bg-muted">
                  <TableHead className={cn(TABLE_LAYOUT.checkbox.className, "whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0")}>
                    <div className="flex items-center justify-center h-full w-full px-2">{/* Empty header for single selection */}</div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">Nome</div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">Cliente</div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">N° Série</div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">Setor</div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0">
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">Finalizado em</div>
                  </TableHead>
                  {/* Scrollbar spacer - only show if not overlay scrollbar */}
                  {!isOverlay && (
                    <TableHead style={{ width: `${scrollbarWidth}px`, minWidth: `${scrollbarWidth}px` }} className="bg-muted p-0 border-0 !border-r-0 shrink-0"></TableHead>
                  )}
                </TableRow>
              </TableHeader>
            </Table>
          </div>

          {/* Scrollable Body Container */}
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden border-l border-r border-border">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : displayedTasks.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="text-lg font-medium mb-2">Nenhuma tarefa finalizada encontrada</div>
                  <div className="text-sm text-muted-foreground">{searchTerm ? "Ajuste os filtros para ver mais resultados." : "Nenhuma tarefa finalizada disponível"}</div>
                </div>
              </div>
            ) : (
              <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
                <TableBody>
                  {displayedTasks.map((task, index) => (
                    <TableRow
                      key={task.id}
                      className={cn(
                        "cursor-pointer transition-colors border-b border-border",
                        index % 2 === 1 && "bg-muted/10",
                        "hover:bg-muted/20",
                        isSelected(task.id) && "bg-muted/30 hover:bg-muted/40",
                      )}
                      onClick={(e) => handleRowClick(task, e)}
                    >
                      <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                        <div className="flex items-center justify-center h-full w-full px-2 py-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={isSelected(task.id)} onCheckedChange={() => onSelectTask(task.id)} aria-label={`Select ${task.name}`} className="h-4 w-4" />
                        </div>
                      </TableCell>
                      <TableCell className="p-0 !border-r-0">
                        <div className="px-4 py-2">
                          <TruncatedTextWithTooltip text={task.name} className="font-medium" />
                        </div>
                      </TableCell>
                      <TableCell className="p-0 !border-r-0">
                        <div className="px-4 py-2">
                          {task.customer?.fantasyName ? <TruncatedTextWithTooltip text={task.customer.fantasyName} /> : <span className="text-muted-foreground">-</span>}
                        </div>
                      </TableCell>
                      <TableCell className="p-0 !border-r-0">
                        <div className="px-4 py-2">{task.serialNumber || <span className="text-muted-foreground">-</span>}</div>
                      </TableCell>
                      <TableCell className="p-0 !border-r-0">
                        <div className="px-4 py-2">
                          {task.sector?.name ? <Badge variant="outline">{task.sector.name}</Badge> : <span className="text-muted-foreground">-</span>}
                        </div>
                      </TableCell>
                      <TableCell className="p-0 !border-r-0">
                        <div className="px-4 py-2">
                          {task.finishedAt ? <span className="text-sm">{formatDate(task.finishedAt)}</span> : <span className="text-muted-foreground">-</span>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Pagination Footer */}
          <div className="px-4 border-l border-r border-b border-border rounded-b-lg bg-muted/50">
            <SimplePaginationAdvanced
              currentPage={page - 1} // SimplePaginationAdvanced expects 0-based, convert from internal 1-based
              totalPages={Math.ceil(totalRecords / currentPageSize)}
              onPageChange={(newPage) => {
                // SimplePaginationAdvanced provides 0-based, onPageChange expects 0-based (useTableState.setPage)
                if (onPageChange) {
                  onPageChange(newPage);
                }
              }}
              pageSize={currentPageSize}
              totalItems={totalRecords}
              pageSizeOptions={[20, 40, 60, 100]}
              onPageSizeChange={onPageSizeChange || (() => {})}
              showPageSizeSelector={true}
              showGoToPage={true}
              showPageInfo={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
