/**
 * Notification Configuration List Page
 *
 * Admin page for managing notification configurations with:
 * - Right-click context menu for actions
 * - Searchable table with sorting
 * - Filter sheet with filter indicators
 * - Proper dark mode support
 */

import React, { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  IconPlus,
  IconFilter,
  IconSettings,
  IconEye,
  IconEdit,
  IconTrash,
  IconTestPipe,
  IconBell,
  IconDeviceMobile,
  IconMail,
  IconBrandWhatsapp,
  IconChevronUp,
  IconChevronDown,
  IconSelector,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page-header";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
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
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { FilterIndicators } from "@/components/ui/filter-indicator";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { routes, SECTOR_PRIVILEGES } from "@/constants";
import { cn } from "@/lib/utils";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { useScrollbarWidth } from "@/hooks/use-scrollbar-width";
import { useTableState } from "@/hooks/use-table-state";
import { useTableFilters } from "@/hooks/use-table-filters";
import {
  useNotificationConfigurations,
  useNotificationConfigurationMutations,
} from "@/hooks/use-notification-configuration";
import type { NotificationConfiguration, NotificationConfigurationQueryParams } from "@/types/notification-configuration";
import { NotificationConfigurationFilters } from "./components/configuration-filters";

// =====================
// Constants
// =====================

const IMPORTANCE_VARIANTS: Record<string, { label: string; variant: string }> = {
  LOW: { label: "Baixa", variant: "gray" },
  NORMAL: { label: "Normal", variant: "blue" },
  HIGH: { label: "Alta", variant: "orange" },
  URGENT: { label: "Urgente", variant: "red" },
};

const TYPE_LABELS: Record<string, string> = {
  SYSTEM: "Sistema",
  PRODUCTION: "Produção",
  STOCK: "Estoque",
  USER: "Usuário",
  GENERAL: "Geral",
};

const CHANNEL_CONFIG: Record<string, { icon: typeof IconBell; color: string; borderColor: string; bgColor: string; label: string }> = {
  IN_APP: {
    icon: IconBell,
    color: "text-orange-600 dark:text-orange-400",
    borderColor: "border-orange-200 dark:border-orange-800",
    bgColor: "bg-orange-50 dark:bg-orange-950",
    label: "No App",
  },
  PUSH: {
    icon: IconDeviceMobile,
    color: "text-blue-600 dark:text-blue-400",
    borderColor: "border-blue-200 dark:border-blue-800",
    bgColor: "bg-blue-50 dark:bg-blue-950",
    label: "Push",
  },
  EMAIL: {
    icon: IconMail,
    color: "text-purple-600 dark:text-purple-400",
    borderColor: "border-purple-200 dark:border-purple-800",
    bgColor: "bg-purple-50 dark:bg-purple-950",
    label: "E-mail",
  },
  WHATSAPP: {
    icon: IconBrandWhatsapp,
    color: "text-green-600 dark:text-green-400",
    borderColor: "border-green-200 dark:border-green-800",
    bgColor: "bg-green-50 dark:bg-green-950",
    label: "WhatsApp",
  },
};

const DEFAULT_PAGE_SIZE = 20;

// =====================
// Column Definitions
// =====================

interface ConfigurationColumn {
  key: string;
  header: string;
  sortable: boolean;
  className?: string;
  align?: "left" | "center" | "right";
  accessor: (config: NotificationConfiguration) => React.ReactNode;
}

function createConfigurationColumns(): ConfigurationColumn[] {
  return [
    {
      key: "name",
      header: "Nome",
      sortable: true,
      className: "w-[280px] min-w-[280px]",
      accessor: (config) => (
        <span className="text-sm font-medium">{config.name || config.key}</span>
      ),
    },
    {
      key: "description",
      header: "Descrição",
      sortable: false,
      className: "min-w-[200px]",
      accessor: (config) => (
        <TruncatedTextWithTooltip text={config.description || "-"} maxLength={50} />
      ),
    },
    {
      key: "notificationType",
      header: "Tipo",
      sortable: true,
      className: "w-[180px] min-w-[180px]",
      accessor: (config) => {
        const label = TYPE_LABELS[config.notificationType] || config.notificationType;
        return <Badge variant="outline">{label}</Badge>;
      },
    },
    {
      key: "importance",
      header: "Importância",
      sortable: true,
      className: "w-[140px] min-w-[140px]",
      accessor: (config) => {
        const importanceConfig = IMPORTANCE_VARIANTS[config.importance] || IMPORTANCE_VARIANTS.NORMAL;
        return (
          <Badge variant={importanceConfig.variant as any}>
            {importanceConfig.label}
          </Badge>
        );
      },
    },
    {
      key: "channels",
      header: "Canais",
      sortable: false,
      className: "w-[200px] min-w-[200px]",
      accessor: (config) => {
        const allChannels = ["IN_APP", "PUSH", "EMAIL", "WHATSAPP"];
        return (
          <div className="flex items-center gap-1.5">
            {allChannels.map((channelKey) => {
              const channelConfig = CHANNEL_CONFIG[channelKey];
              if (!channelConfig) return null;
              const Icon = channelConfig.icon;
              const channelData = config.channelConfigs?.find((c) => c.channel === channelKey);
              const isEnabled = channelData?.enabled ?? false;
              const isMandatory = channelData?.mandatory ?? false;
              return (
                <div
                  key={channelKey}
                  className={cn(
                    "p-2 rounded-lg border-2 transition-all flex items-center justify-center",
                    isEnabled
                      ? channelConfig.borderColor
                      : "border-muted bg-muted/50 opacity-50",
                    isMandatory && isEnabled && channelConfig.bgColor
                  )}
                  title={`${channelConfig.label}${isMandatory ? " (Obrigatório)" : ""}${!isEnabled ? " (Desativado)" : ""}`}
                >
                  <Icon className={cn("h-4 w-4", isEnabled ? channelConfig.color : "text-muted-foreground")} />
                </div>
              );
            })}
          </div>
        );
      },
    },
    {
      key: "enabled",
      header: "Status",
      sortable: true,
      className: "w-[100px] min-w-[100px]",
      align: "center",
      accessor: (config) => (
        config.enabled ? (
          <Badge variant="active">Ativo</Badge>
        ) : (
          <Badge variant="inactive">Inativo</Badge>
        )
      ),
    },
  ];
}

// =====================
// Main Component
// =====================

export function NotificationConfigurationListPage() {
  const navigate = useNavigate();
  const { width: scrollbarWidth, isOverlay } = useScrollbarWidth();

  // Filter modal state
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ config: NotificationConfiguration } | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    configs: NotificationConfiguration[];
    isBulk: boolean;
  } | null>(null);

  // Mutations
  const { delete: deleteMutation } = useNotificationConfigurationMutations();

  // URL state management for pagination, selection, and sorting
  const {
    page,
    pageSize,
    selectedIds,
    sortConfigs,
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
    handleRowClick: handleRowClickSelection,
  } = useTableState({
    defaultPageSize: DEFAULT_PAGE_SIZE,
    resetSelectionOnPageChange: false,
    defaultSort: [{ column: "name", direction: "asc" }],
  });

  // Filter serialization
  const serializeFilters = useCallback((filters: Partial<NotificationConfigurationQueryParams>): Record<string, string> => {
    const params: Record<string, string> = {};
    if (filters.notificationType) params.type = filters.notificationType;
    if (filters.importance) params.importance = filters.importance;
    if (typeof filters.enabled === "boolean") params.enabled = String(filters.enabled);
    return params;
  }, []);

  const deserializeFilters = useCallback((params: URLSearchParams): Partial<NotificationConfigurationQueryParams> => {
    const filters: Partial<NotificationConfigurationQueryParams> = {};
    const type = params.get("type");
    const importance = params.get("importance");
    const enabled = params.get("enabled");
    if (type) filters.notificationType = type as any;
    if (importance) filters.importance = importance as any;
    if (enabled !== null) filters.enabled = enabled === "true";
    return filters;
  }, []);

  // Use unified table filters hook
  const {
    filters,
    setFilters,
    searchingFor,
    displaySearchText,
    setSearch,
    clearAllFilters,
    queryFilters: baseQueryFilters,
    hasActiveFilters,
  } = useTableFilters<NotificationConfigurationQueryParams>({
    defaultFilters: {},
    searchDebounceMs: 300,
    searchParamName: "search",
    serializeToUrl: serializeFilters,
    deserializeFromUrl: deserializeFilters,
    excludeFromUrl: ["page", "limit"],
  });

  // Build query params
  const queryParams = useMemo(() => ({
    ...baseQueryFilters,
    search: baseQueryFilters.searchingFor,
    page: page + 1,
    limit: pageSize,
    ...(sortConfigs.length > 0 && sortConfigs[0]?.column && {
      sortBy: sortConfigs[0].column,
      sortOrder: sortConfigs[0].direction,
    }),
  }), [baseQueryFilters, page, pageSize, sortConfigs]);

  // Fetch data
  const { data: response, isLoading, error } = useNotificationConfigurations(queryParams);

  const configurations = response?.data || [];
  const totalRecords = response?.meta?.total || 0;
  const totalPages = Math.ceil(totalRecords / pageSize);

  // Get all columns
  const columns = useMemo(() => createConfigurationColumns(), []);

  // Current page IDs for selection
  const currentPageIds = useMemo(() => configurations.map((c) => c.id), [configurations]);

  // Selection state
  const allSelected = isAllSelected(currentPageIds);
  const partiallySelected = isPartiallySelected(currentPageIds);

  // Handlers
  const handleSelectAll = () => {
    toggleSelectAll(currentPageIds);
  };

  const handleSelectConfig = (configId: string, event?: React.MouseEvent) => {
    handleRowClickSelection(configId, currentPageIds, event?.shiftKey || false);
  };

  const handleContextMenu = (e: React.MouseEvent, config: NotificationConfiguration) => {
    e.preventDefault();
    e.stopPropagation();

    const isConfigSelected = isSelected(config.id);
    const hasSelection = selectionCount > 0;

    if (hasSelection && isConfigSelected) {
      const selectedConfigs = configurations.filter((c) => isSelected(c.id));
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        configs: selectedConfigs,
        isBulk: true,
      });
    } else {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        configs: [config],
        isBulk: false,
      });
    }
  };

  const handleViewDetails = () => {
    if (contextMenu && !contextMenu.isBulk) {
      navigate(routes.administration.notifications.configurations.details(contextMenu.configs[0].key));
      setContextMenu(null);
    }
  };

  const handleEdit = () => {
    if (contextMenu && !contextMenu.isBulk) {
      navigate(routes.administration.notifications.configurations.edit(contextMenu.configs[0].key));
      setContextMenu(null);
    }
  };

  const handleTest = () => {
    if (contextMenu && !contextMenu.isBulk) {
      navigate(routes.administration.notifications.configurations.test(contextMenu.configs[0].key));
      setContextMenu(null);
    }
  };

  const handleDeleteClick = () => {
    if (contextMenu && !contextMenu.isBulk) {
      setDeleteDialog({ config: contextMenu.configs[0] });
      setContextMenu(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog) return;
    try {
      await deleteMutation.mutateAsync(deleteDialog.config.id);
      setDeleteDialog(null);
    } catch {
      // Error handled by mutation
    }
  };

  // Filter handlers
  const handleFilterChange = useCallback((newFilters: Partial<NotificationConfigurationQueryParams>) => {
    setFilters(newFilters);
  }, [setFilters]);

  const onRemoveFilter = useCallback((key: string) => {
    if (key === "searchingFor") {
      setSearch("");
    } else {
      setFilters((prev) => {
        const next = { ...prev };
        delete next[key as keyof NotificationConfigurationQueryParams];
        return next;
      });
    }
  }, [setFilters, setSearch]);

  // Extract active filters for display
  const activeFilters = useMemo(() => {
    const result: Array<{ key: string; label: string; value: string; onRemove: () => void }> = [];

    if (searchingFor) {
      result.push({
        key: "searchingFor",
        label: "Busca",
        value: searchingFor,
        onRemove: () => onRemoveFilter("searchingFor"),
      });
    }

    if (filters.notificationType) {
      result.push({
        key: "notificationType",
        label: "Tipo",
        value: TYPE_LABELS[filters.notificationType] || filters.notificationType,
        onRemove: () => onRemoveFilter("notificationType"),
      });
    }

    if (filters.importance) {
      result.push({
        key: "importance",
        label: "Importância",
        value: IMPORTANCE_VARIANTS[filters.importance]?.label || filters.importance,
        onRemove: () => onRemoveFilter("importance"),
      });
    }

    if (typeof filters.enabled === "boolean") {
      result.push({
        key: "enabled",
        label: "Status",
        value: filters.enabled ? "Ativo" : "Inativo",
        onRemove: () => onRemoveFilter("enabled"),
      });
    }

    return result;
  }, [filters, searchingFor, onRemoveFilter]);

  // Sort indicator renderer
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

  // Close context menu on click outside
  React.useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Configurações de Notificação"
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Administração", href: "/administracao" },
            { label: "Notificações", href: routes.administration.notifications.root },
            { label: "Configurações" },
          ]}
          className="flex-shrink-0"
          actions={[
            {
              key: "create",
              label: "Nova Configuração",
              icon: IconPlus,
              onClick: () => navigate(routes.administration.notifications.configurations.create),
              variant: "default",
            },
          ]}
        />

        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <Card className="flex-1 min-h-0 flex flex-col shadow-sm border border-border">
            <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
              {/* Search and controls */}
              <div className="flex flex-col gap-3 sm:flex-row">
                <TableSearchInput
                  value={displaySearchText}
                  onChange={setSearch}
                  placeholder="Buscar por nome, descrição..."
                  isPending={displaySearchText !== searchingFor}
                  className="flex-1"
                />
                <div className="flex gap-2">
                  <Button
                    variant={hasActiveFilters ? "default" : "outline"}
                    size="default"
                    onClick={() => setShowFilterModal(true)}
                  >
                    <IconFilter className="h-4 w-4" />
                    <span>
                      Filtros
                      {hasActiveFilters ? ` (${activeFilters.length})` : ""}
                    </span>
                  </Button>
                </div>
              </div>

              {/* Active Filter Indicators */}
              {activeFilters.length > 0 && (
                <FilterIndicators filters={activeFilters} onClearAll={clearAllFilters} className="px-1 py-1" />
              )}

              {/* Table Container */}
              <div className="flex-1 min-h-0 overflow-hidden rounded-lg flex flex-col">
                {isLoading ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : error ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center text-destructive">
                    <IconAlertTriangle className="h-8 w-8 mb-4" />
                    <div className="text-lg font-medium mb-2">Erro ao carregar configurações</div>
                    <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
                      Tentar novamente
                    </Button>
                  </div>
                ) : (
                  <>
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
                                  onCheckedChange={handleSelectAll}
                                  aria-label="Selecionar todos"
                                  disabled={isLoading || configurations.length === 0}
                                  indeterminate={partiallySelected}
                                />
                              </div>
                            </TableHead>

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
                                    )}
                                    disabled={isLoading || configurations.length === 0}
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
                                    )}
                                  >
                                    <TruncatedTextWithTooltip text={column.header} />
                                  </div>
                                )}
                              </TableHead>
                            ))}

                            {/* Scrollbar spacer */}
                            {!isOverlay && (
                              <TableHead style={{ width: `${scrollbarWidth}px`, minWidth: `${scrollbarWidth}px` }} className="bg-muted p-0 border-0 !border-r-0 shrink-0" />
                            )}
                          </TableRow>
                        </TableHeader>
                      </Table>
                    </div>

                    {/* Scrollable Body Table */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden border-l border-r border-border">
                      <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
                        <TableBody>
                          {configurations.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={columns.length + 1} className="p-0">
                                <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                                  <IconSettings className="h-12 w-12 text-muted-foreground/50 mb-4" />
                                  <div className="text-lg font-medium mb-2">Nenhuma configuração encontrada</div>
                                  {hasActiveFilters ? (
                                    <Button variant="outline" className="mt-4" onClick={clearAllFilters}>
                                      Limpar filtros
                                    </Button>
                                  ) : (
                                    <>
                                      <div className="text-sm mb-4">Comece criando a primeira configuração.</div>
                                      <Button onClick={() => navigate(routes.administration.notifications.configurations.create)} variant="outline">
                                        <IconPlus className="h-4 w-4 mr-2" />
                                        Nova Configuração
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : (
                            configurations.map((config, index) => {
                              const configIsSelected = isSelected(config.id);

                              return (
                                <TableRow
                                  key={config.id}
                                  data-state={configIsSelected ? "selected" : undefined}
                                  className={cn(
                                    "cursor-pointer transition-colors border-b border-border",
                                    index % 2 === 1 && "bg-muted/10",
                                    "hover:bg-muted/20",
                                    configIsSelected && "bg-muted/30 hover:bg-muted/40",
                                  )}
                                  onClick={() => navigate(routes.administration.notifications.configurations.details(config.key))}
                                  onContextMenu={(e) => handleContextMenu(e, config)}
                                >
                                  {/* Selection checkbox */}
                                  <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                                    <div
                                      className="flex items-center justify-center h-full w-full px-2 py-2"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSelectConfig(config.id, e);
                                      }}
                                    >
                                      <Checkbox checked={configIsSelected} aria-label={`Selecionar ${config.key}`} data-checkbox />
                                    </div>
                                  </TableCell>

                                  {/* Data columns */}
                                  {columns.map((column) => (
                                    <TableCell
                                      key={column.key}
                                      className={cn(
                                        column.className,
                                        "p-0 !border-r-0",
                                        column.align === "center" && "text-center",
                                        column.align === "right" && "text-right",
                                      )}
                                    >
                                      <div className="px-4 py-2">{column.accessor(config)}</div>
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
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Context Menu */}
      <DropdownMenu open={!!contextMenu} onOpenChange={(open) => !open && setContextMenu(null)}>
        <PositionedDropdownMenuContent
          position={contextMenu}
          isOpen={!!contextMenu}
          className="w-56 ![position:fixed]"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {contextMenu?.isBulk && (
            <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
              {contextMenu.configs.length} configurações selecionadas
            </div>
          )}

          {!contextMenu?.isBulk && (
            <>
              <DropdownMenuItem onClick={handleViewDetails}>
                <IconEye className="mr-2 h-4 w-4" />
                Ver Detalhes
              </DropdownMenuItem>

              <DropdownMenuItem onClick={handleEdit}>
                <IconEdit className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>

              <DropdownMenuItem onClick={handleTest}>
                <IconTestPipe className="mr-2 h-4 w-4" />
                Testar
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={handleDeleteClick} className="text-destructive focus:text-destructive">
                <IconTrash className="mr-2 h-4 w-4" />
                Excluir
              </DropdownMenuItem>
            </>
          )}
        </PositionedDropdownMenuContent>
      </DropdownMenu>

      {/* Filter Sheet */}
      <NotificationConfigurationFilters
        open={showFilterModal}
        onOpenChange={setShowFilterModal}
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir configuração</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a configuração &ldquo;{deleteDialog?.config.key}&rdquo;? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PrivilegeRoute>
  );
}

export default NotificationConfigurationListPage;
