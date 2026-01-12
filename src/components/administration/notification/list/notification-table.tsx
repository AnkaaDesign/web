import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  IconChevronUp,
  IconChevronDown,
  IconSelector,
  IconEye,
  IconEdit,
  IconTrash,
  IconSend,
  IconAlertTriangle,
  IconBell,
  IconPlus,
} from "@tabler/icons-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Notification } from "@/types";
import type { NotificationGetManyFormData } from "@/schemas";
import { useNotifications, useNotificationMutations, useSendNotification } from "@/hooks";
import { useScrollbarWidth } from "@/hooks/use-scrollbar-width";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/use-table-state";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import {
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_IMPORTANCE_LABELS,
  NOTIFICATION_CHANNEL_LABELS,
  routes,
} from "@/constants";
import { cn } from "@/lib/utils";
import { NotificationTableSkeleton } from "./notification-table-skeleton";

interface NotificationTableProps {
  filters: Partial<NotificationGetManyFormData>;
  onDataChange?: (data: { items: Notification[]; totalRecords: number }) => void;
  className?: string;
}

interface NotificationColumn {
  key: string;
  header: string;
  sortable: boolean;
  className?: string;
  align?: "left" | "center" | "right";
  accessor: (notification: Notification) => React.ReactNode;
}

export function NotificationTable({
  filters,
  onDataChange,
  className,
}: NotificationTableProps) {
  const navigate = useNavigate();
  const { delete: deleteNotification } = useNotificationMutations();
  const sendNotification = useSendNotification();

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
    handleRowClick: handleRowClickSelection,
  } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    items: Notification[];
    isBulk: boolean;
  } | null>(null);

  // Memoize include configuration
  const includeConfig = useMemo(
    () => ({
      user: true,
      seenBy: {
        include: {
          user: true,
        },
      },
    }),
    []
  );

  // Memoize query parameters
  const queryParams = useMemo(() => {
    const params: any = {
      ...(showSelectedOnly ? {} : filters),
      page: page + 1,
      limit: pageSize,
      include: includeConfig,
      ...(sortConfigs.length > 0 && {
        orderBy: convertSortConfigsToOrderBy(sortConfigs),
      }),
      ...(showSelectedOnly &&
        selectedIds.length > 0 && {
          where: {
            id: { in: selectedIds },
          },
        }),
    };

    // Default sort by createdAt desc if no sort specified
    if (!params.orderBy) {
      params.orderBy = { createdAt: "desc" };
    }

    return params;
  }, [filters, page, pageSize, includeConfig, sortConfigs, showSelectedOnly, selectedIds]);

  // Fetch notifications
  const { data: response, isLoading, error } = useNotifications(queryParams);

  const notifications = response?.data || [];
  const totalPages = response?.meta ? Math.ceil(response.meta.totalRecords / pageSize) : 1;
  const totalRecords = response?.meta?.totalRecords || 0;

  // Notify parent component of data changes
  const lastNotifiedDataRef = React.useRef<string>("");

  React.useEffect(() => {
    if (onDataChange) {
      const dataKey = notifications.length > 0
        ? `${totalRecords}-${notifications.map((n) => n.id).join(",")}`
        : `empty-${totalRecords}`;

      if (dataKey !== lastNotifiedDataRef.current) {
        lastNotifiedDataRef.current = dataKey;
        onDataChange({ items: notifications, totalRecords });
      }
    }
  }, [notifications, totalRecords, onDataChange]);

  // Define columns
  const columns: NotificationColumn[] = [
    {
      key: "title",
      header: "TÍTULO",
      sortable: true,
      className: "w-64",
      align: "left",
      accessor: (notification) => (
        <div className="font-medium truncate">{notification.title}</div>
      ),
    },
    {
      key: "type",
      header: "TIPO",
      sortable: true,
      className: "w-36",
      align: "left",
      accessor: (notification) => (
        <Badge variant="outline" className="whitespace-nowrap">
          {NOTIFICATION_TYPE_LABELS[notification.type] || notification.type}
        </Badge>
      ),
    },
    {
      key: "importance",
      header: "IMPORTÂNCIA",
      sortable: true,
      className: "w-24",
      align: "left",
      accessor: (notification) => {
        const variant = notification.importance === "HIGH"
          ? "destructive"
          : notification.importance === "MEDIUM"
          ? "warning"
          : "secondary";
        return (
          <Badge variant={variant as any} className="whitespace-nowrap">
            {NOTIFICATION_IMPORTANCE_LABELS[notification.importance] || notification.importance}
          </Badge>
        );
      },
    },
    {
      key: "channel",
      header: "CANAIS",
      sortable: false,
      className: "w-auto",
      align: "left",
      accessor: (notification) => (
        <div className="flex flex-nowrap gap-1">
          {notification.channel?.map((ch: string) => (
            <Badge key={ch} variant="secondary" className="text-xs whitespace-nowrap">
              {NOTIFICATION_CHANNEL_LABELS[ch] || ch}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: "sentAt",
      header: "STATUS",
      sortable: true,
      className: "w-24",
      align: "left",
      accessor: (notification) => (
        notification.sentAt ? (
          <Badge variant="default" className="bg-green-600 whitespace-nowrap">Enviada</Badge>
        ) : (
          <Badge variant="secondary" className="whitespace-nowrap">Pendente</Badge>
        )
      ),
    },
    {
      key: "createdAt",
      header: "CRIADA EM",
      sortable: true,
      className: "w-40",
      align: "left",
      accessor: (notification) => (
        <div className="text-sm text-muted-foreground whitespace-nowrap">
          {notification.createdAt
            ? format(new Date(notification.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })
            : "-"}
        </div>
      ),
    },
  ];

  // Get current page notification IDs for selection
  const currentPageIds = useMemo(() => {
    return notifications.map((n) => n.id);
  }, [notifications]);

  // Selection handlers
  const allSelected = isAllSelected(currentPageIds);
  const partiallySelected = isPartiallySelected(currentPageIds);

  const handleSelectAll = () => {
    toggleSelectAll(currentPageIds);
  };

  const handleSelectItem = (id: string, event?: React.MouseEvent) => {
    handleRowClickSelection(id, currentPageIds, event?.shiftKey || false);
  };

  // Sort indicator
  const renderSortIndicator = (columnKey: string) => {
    const sortDirection = getSortDirection(columnKey);
    const sortOrder = getSortOrder(columnKey);

    return (
      <div className="inline-flex items-center ml-1">
        {sortDirection === null && <IconSelector className="h-4 w-4 text-muted-foreground" />}
        {sortDirection === "asc" && <IconChevronUp className="h-4 w-4 text-foreground" />}
        {sortDirection === "desc" && <IconChevronDown className="h-4 w-4 text-foreground" />}
        {sortOrder !== null && sortConfigs.length > 1 && (
          <span className="text-xs ml-0.5">{sortOrder + 1}</span>
        )}
      </div>
    );
  };

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent, notification: Notification) => {
    e.preventDefault();
    e.stopPropagation();

    const isItemSelected = isSelected(notification.id);
    const hasSelection = selectionCount > 0;

    if (hasSelection && isItemSelected) {
      const selectedItems = notifications.filter((n) => isSelected(n.id));
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        items: selectedItems,
        isBulk: true,
      });
    } else {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        items: [notification],
        isBulk: false,
      });
    }
  };

  const handleView = () => {
    if (contextMenu?.items[0]) {
      navigate(routes.administration.notifications.details(contextMenu.items[0].id));
      setContextMenu(null);
    }
  };

  const handleEdit = () => {
    if (contextMenu?.items[0]) {
      navigate(routes.administration.notifications.edit(contextMenu.items[0].id));
      setContextMenu(null);
    }
  };

  const handleSend = async () => {
    if (contextMenu?.items[0] && !contextMenu.items[0].sentAt) {
      if (confirm("Deseja enviar esta notificação agora?")) {
        await sendNotification.mutateAsync(contextMenu.items[0].id);
      }
      setContextMenu(null);
    }
  };

  const handleDelete = async () => {
    if (contextMenu) {
      const count = contextMenu.items.length;
      if (confirm(`Tem certeza que deseja excluir ${count > 1 ? `${count} notificações` : "esta notificação"}?`)) {
        for (const item of contextMenu.items) {
          await deleteNotification(item.id);
        }
      }
      setContextMenu(null);
    }
  };

  // Close context menu when clicking outside
  React.useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  if (isLoading) {
    return <NotificationTableSkeleton />;
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
                    aria-label="Select all notifications"
                    disabled={isLoading || notifications.length === 0}
                  />
                </div>
              </TableHead>

              {/* Data columns */}
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(
                    "whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0",
                    column.className
                  )}
                >
                  {column.sortable ? (
                    <button
                      onClick={() => toggleSort(column.key)}
                      className={cn(
                        "flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent",
                        column.align === "center" && "justify-center",
                        column.align === "right" && "justify-end",
                        !column.align && "justify-start"
                      )}
                      disabled={isLoading || notifications.length === 0}
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
                        !column.align && "justify-start text-left"
                      )}
                    >
                      <TruncatedTextWithTooltip text={column.header} />
                    </div>
                  )}
                </TableHead>
              ))}

              {/* Scrollbar spacer */}
              {!isOverlay && (
                <TableHead
                  style={{ width: `${scrollbarWidth}px`, minWidth: `${scrollbarWidth}px` }}
                  className="bg-muted p-0 border-0 !border-r-0 shrink-0"
                />
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
                    <div className="text-lg font-medium mb-2">Não foi possível carregar as notificações</div>
                    <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : notifications.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <IconBell className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="text-lg font-medium mb-2">Nenhuma notificação encontrada</div>
                    {filters && Object.keys(filters).length > 0 ? (
                      <div className="text-sm">Ajuste os filtros para ver mais resultados.</div>
                    ) : (
                      <>
                        <div className="text-sm mb-4">Comece criando sua primeira notificação.</div>
                        <Button onClick={() => navigate(routes.administration.notifications.create)} variant="outline">
                          <IconPlus className="h-4 w-4 mr-2" />
                          Nova Notificação
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              notifications.map((notification, index) => {
                const itemIsSelected = isSelected(notification.id);

                return (
                  <TableRow
                    key={notification.id}
                    data-state={itemIsSelected ? "selected" : undefined}
                    className={cn(
                      "cursor-pointer transition-colors border-b border-border",
                      index % 2 === 1 && "bg-muted/10",
                      "hover:bg-muted/20",
                      itemIsSelected && "bg-muted/30 hover:bg-muted/40"
                    )}
                    onClick={() => navigate(routes.administration.notifications.details(notification.id))}
                    onContextMenu={(e) => handleContextMenu(e, notification)}
                  >
                    {/* Selection checkbox */}
                    <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                      <div
                        className="flex items-center justify-center h-full w-full px-2 py-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectItem(notification.id, e);
                        }}
                      >
                        <Checkbox
                          checked={itemIsSelected}
                          aria-label={`Select ${notification.title}`}
                          data-checkbox
                        />
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
                          column.align === "left" && "text-left",
                          !column.align && "text-left"
                        )}
                      >
                        <div className="px-4 py-2">{column.accessor(notification)}</div>
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
          {contextMenu?.isBulk && (
            <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
              {contextMenu.items.length} notificações selecionadas
            </div>
          )}

          <DropdownMenuItem onClick={handleView}>
            <IconEye className="mr-2 h-4 w-4" />
            Visualizar
          </DropdownMenuItem>

          {contextMenu?.items.length === 1 && !contextMenu.items[0].sentAt && (
            <>
              <DropdownMenuItem onClick={handleEdit}>
                <IconEdit className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSend}>
                <IconSend className="mr-2 h-4 w-4" />
                Enviar
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={handleDelete} className="text-destructive">
            <IconTrash className="mr-2 h-4 w-4" />
            {contextMenu?.isBulk && contextMenu.items.length > 1
              ? "Excluir selecionadas"
              : "Excluir"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
