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
  IconArchive,
  IconCheck,
  IconMessageCircle,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Message } from "@/types/message";
import type { MessageGetManyFormData } from "@/schemas/message";
import { useMessages, useMessageMutations } from "@/hooks/useMessage";
import { useScrollbarWidth } from "@/hooks/use-scrollbar-width";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/use-table-state";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { routes } from "@/constants";
import { cn } from "@/lib/utils";
import { MessageTableSkeleton } from "./message-table-skeleton";

interface MessageTableProps {
  filters: Partial<MessageGetManyFormData>;
  onDataChange?: (data: { items: Message[]; totalRecords: number }) => void;
  className?: string;
}

interface MessageColumn {
  key: string;
  header: string;
  sortable: boolean;
  className?: string;
  align?: "left" | "center" | "right";
  accessor: (message: Message) => React.ReactNode;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Agendada",
  ACTIVE: "Ativa",
  EXPIRED: "Expirada",
  ARCHIVED: "Arquivada",
};

const STATUS_VARIANTS: Record<string, "secondary" | "default" | "outline" | "destructive"> = {
  DRAFT: "secondary",
  SCHEDULED: "outline",
  ACTIVE: "default",
  EXPIRED: "destructive",
  ARCHIVED: "outline",
};

export function MessageTable({
  filters,
  onDataChange,
  className,
}: MessageTableProps) {
  const navigate = useNavigate();
  const { delete: deleteMessage, archive: archiveMessage, activate: activateMessage } = useMessageMutations();

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
    items: Message[];
    isBulk: boolean;
  } | null>(null);

  // Memoize query parameters
  const queryParams = useMemo(() => {
    const params: any = {
      ...(showSelectedOnly ? {} : filters),
      page: page + 1,
      limit: pageSize,
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
  }, [filters, page, pageSize, sortConfigs, showSelectedOnly, selectedIds]);

  // Fetch messages
  const { data: response, isLoading, error } = useMessages(queryParams);

  const messages = response?.data || [];
  const totalRecords = response?.meta?.totalRecords || 0;
  const totalPages = totalRecords > 0 ? Math.ceil(totalRecords / pageSize) : 1;

  // Notify parent component of data changes
  const lastNotifiedDataRef = React.useRef<string>("");

  React.useEffect(() => {
    if (onDataChange) {
      const dataKey = messages.length > 0
        ? `${totalRecords}-${messages.map((m) => m.id).join(",")}`
        : `empty-${totalRecords}`;

      if (dataKey !== lastNotifiedDataRef.current) {
        lastNotifiedDataRef.current = dataKey;
        onDataChange({ items: messages, totalRecords });
      }
    }
  }, [messages, totalRecords, onDataChange]);

  // Define columns
  const columns: MessageColumn[] = [
    {
      key: "title",
      header: "Título",
      sortable: true,
      className: "w-64",
      align: "left",
      accessor: (message) => (
        <div className="font-medium truncate">{message.title}</div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      className: "w-28",
      align: "left",
      accessor: (message) => (
        <Badge variant={STATUS_VARIANTS[message.status] || "outline"}>
          {STATUS_LABELS[message.status] || message.status}
        </Badge>
      ),
    },
    {
      key: "stats",
      header: "Visualizações",
      sortable: false,
      className: "w-32",
      align: "center",
      accessor: (message) => (
        <div className="text-sm">
          {message.stats ? `${message.stats.views} / ${message.stats.targetUsers}` : "-"}
        </div>
      ),
    },
    {
      key: "createdAt",
      header: "Criada em",
      sortable: true,
      className: "w-32",
      align: "left",
      accessor: (message) => (
        <div className="text-sm text-muted-foreground">
          {message.createdAt
            ? format(new Date(message.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })
            : "-"}
        </div>
      ),
    },
  ];

  // Get current page message IDs for selection
  const currentPageIds = useMemo(() => {
    return messages.map((m) => m.id);
  }, [messages]);

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
  const handleContextMenu = (e: React.MouseEvent, message: Message) => {
    e.preventDefault();
    e.stopPropagation();

    const isItemSelected = isSelected(message.id);
    const hasSelection = selectionCount > 0;

    if (hasSelection && isItemSelected) {
      const selectedItems = messages.filter((m) => isSelected(m.id));
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
        items: [message],
        isBulk: false,
      });
    }
  };

  const handleView = () => {
    if (contextMenu?.items[0]) {
      navigate(routes.administration.messages?.details?.(contextMenu.items[0].id) || `/administracao/mensagens/${contextMenu.items[0].id}`);
      setContextMenu(null);
    }
  };

  const handleEdit = () => {
    if (contextMenu?.items[0]) {
      navigate(routes.administration.messages?.edit?.(contextMenu.items[0].id) || `/administracao/mensagens/${contextMenu.items[0].id}/editar`);
      setContextMenu(null);
    }
  };

  const handleArchive = async () => {
    if (contextMenu?.items[0]) {
      if (confirm("Deseja arquivar esta mensagem?")) {
        await archiveMessage.mutateAsync(contextMenu.items[0].id);
      }
      setContextMenu(null);
    }
  };

  const handleActivate = async () => {
    if (contextMenu?.items[0]) {
      if (confirm("Deseja ativar esta mensagem?")) {
        await activateMessage.mutateAsync(contextMenu.items[0].id);
      }
      setContextMenu(null);
    }
  };

  const handleDelete = async () => {
    if (contextMenu) {
      const count = contextMenu.items.length;
      if (confirm(`Tem certeza que deseja excluir ${count > 1 ? `${count} mensagens` : "esta mensagem"}?`)) {
        for (const item of contextMenu.items) {
          await deleteMessage.mutate(item.id);
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
    return <MessageTableSkeleton />;
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
                    aria-label="Select all messages"
                    disabled={isLoading || messages.length === 0}
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
                      disabled={isLoading || messages.length === 0}
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
                    <div className="text-lg font-medium mb-2">Não foi possível carregar as mensagens</div>
                    <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : messages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <IconMessageCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="text-lg font-medium mb-2">Nenhuma mensagem encontrada</div>
                    {filters && Object.keys(filters).length > 0 ? (
                      <div className="text-sm">Ajuste os filtros para ver mais resultados.</div>
                    ) : (
                      <div className="text-sm">Comece criando sua primeira mensagem.</div>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              messages.map((message, index) => {
                const itemIsSelected = isSelected(message.id);

                return (
                  <TableRow
                    key={message.id}
                    data-state={itemIsSelected ? "selected" : undefined}
                    className={cn(
                      "cursor-pointer transition-colors border-b border-border",
                      index % 2 === 1 && "bg-muted/10",
                      "hover:bg-muted/20",
                      itemIsSelected && "bg-muted/30 hover:bg-muted/40"
                    )}
                    onClick={() => navigate(routes.administration.messages?.details?.(message.id) || `/administracao/mensagens/${message.id}`)}
                    onContextMenu={(e) => handleContextMenu(e, message)}
                  >
                    {/* Selection checkbox */}
                    <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                      <div
                        className="flex items-center justify-center h-full w-full px-2 py-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectItem(message.id, e);
                        }}
                      >
                        <Checkbox
                          checked={itemIsSelected}
                          aria-label={`Select ${message.title}`}
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
                        <div className="px-4 py-2">{column.accessor(message)}</div>
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
              {contextMenu.items.length} mensagens selecionadas
            </div>
          )}

          <DropdownMenuItem onClick={handleView}>
            <IconEye className="mr-2 h-4 w-4" />
            Visualizar
          </DropdownMenuItem>

          {contextMenu?.items.length === 1 && contextMenu.items[0].status !== 'archived' && (
            <DropdownMenuItem onClick={handleEdit}>
              <IconEdit className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
          )}

          {contextMenu?.items.length === 1 && contextMenu.items[0].status !== 'active' && (
            <DropdownMenuItem onClick={handleActivate}>
              <IconCheck className="mr-2 h-4 w-4" />
              Ativar
            </DropdownMenuItem>
          )}

          {contextMenu?.items.length === 1 && contextMenu.items[0].status === 'active' && (
            <DropdownMenuItem onClick={handleArchive}>
              <IconArchive className="mr-2 h-4 w-4" />
              Arquivar
            </DropdownMenuItem>
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
