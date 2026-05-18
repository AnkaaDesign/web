import React, { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  IconChevronDown,
  IconChevronUp,
  IconSelector,
  IconEdit,
  IconTrash,
  IconEye,
  IconClipboardList,
  IconAlertTriangle,
  IconPlus,
} from "@tabler/icons-react";

import type { Topic, TopicGetManyFormData, TopicOrderBy } from "../../../../types";
import { routes } from "../../../../constants";
import { useAuth } from "../../../../hooks/common/use-auth";
import {
  canEditHrEntities,
  canDeleteHrEntities,
  shouldShowInteractiveElements,
} from "@/utils/permissions/entity-permissions";
import { useTopics, useTopicMutations } from "../../../../hooks";

import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { useScrollbarWidth } from "@/hooks/common/use-scrollbar-width";
import { TopicListSkeleton } from "./topic-list-skeleton";
import { useTableState } from "@/hooks/common/use-table-state";
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

interface TopicTableProps {
  filters: Partial<TopicGetManyFormData>;
  onDataChange?: (data: { topics: Topic[]; totalRecords: number }) => void;
  className?: string;
}

function convertSortConfigsToTopicOrderBy(
  sortConfigs: Array<{ column: string; direction: "asc" | "desc" }>,
): TopicOrderBy | TopicOrderBy[] | undefined {
  if (sortConfigs.length === 0) return undefined;
  const orderBy: TopicOrderBy = {};
  for (const config of sortConfigs) {
    const field = config.column as keyof TopicOrderBy;
    if (
      field === "id" ||
      field === "title" ||
      field === "order" ||
      field === "skillId" ||
      field === "createdAt" ||
      field === "updatedAt"
    ) {
      orderBy[field] = config.direction;
    }
  }
  return Object.keys(orderBy).length > 0 ? orderBy : undefined;
}

export function TopicTable({ filters, onDataChange, className }: TopicTableProps) {
  const navigate = useNavigate();
  const { delete: deleteTopic } = useTopicMutations();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { user } = useAuth();
  const canEdit = user ? canEditHrEntities(user) : false;
  const canDelete = user ? canDeleteHrEntities(user) : false;
  const showInteractive = user ? shouldShowInteractiveElements(user, "hr") : false;

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    topics: Topic[];
    isBulk: boolean;
  } | null>(null);

  const [deleteDialog, setDeleteDialog] = useState<{ items: Topic[]; isBulk: boolean } | null>(null);

  const {
    page,
    pageSize,
    selectedIds,
    sortConfigs,
    showSelectedOnly,
    setPage,
    setPageSize,
    toggleSelectAll,
    toggleSort,
    getSortDirection,
    getSortOrder,
    isSelected,
    isAllSelected,
    isPartiallySelected,
    selectionCount,
    resetSelection,
    handleRowClick: handleRowClickSelection,
  } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  const queryParams = React.useMemo(
    () => ({
      ...filters,
      page: page + 1,
      limit: pageSize,
      include: {
        skill: true,
        _count: { select: { levels: true } },
      },
      ...(sortConfigs.length > 0
        ? { orderBy: convertSortConfigsToTopicOrderBy(sortConfigs) }
        : { orderBy: [{ skillId: "asc" as const }, { order: "asc" as const }] }),
      ...(showSelectedOnly &&
        selectedIds.length > 0 && {
          where: { id: { in: selectedIds } },
        }),
    }),
    [filters, page, pageSize, sortConfigs, showSelectedOnly, selectedIds],
  );

  const { data: response, isLoading, error, refetch } = useTopics(queryParams);

  const topics = response?.data || [];
  const totalRecords = response?.meta?.totalRecords || 0;
  const totalPages = response?.meta ? Math.ceil(response.meta.totalRecords / pageSize) : 1;

  const lastNotifiedDataRef = React.useRef<string>("");
  const isMountedRef = React.useRef(true);

  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    if (onDataChange && isMountedRef.current) {
      const dataKey =
        topics.length > 0 ? `${totalRecords}-${topics.map((t) => t.id).join(",")}` : `empty-${totalRecords}`;
      if (dataKey !== lastNotifiedDataRef.current) {
        lastNotifiedDataRef.current = dataKey;
        onDataChange({ topics, totalRecords });
      }
    }
  }, [topics, totalRecords, onDataChange]);

  const { width: scrollbarWidth, isOverlay } = useScrollbarWidth();

  const currentPageTopicIds = React.useMemo(() => topics.map((t) => t.id), [topics]);

  const handleSelectAll = useCallback(() => {
    toggleSelectAll(currentPageTopicIds);
  }, [toggleSelectAll, currentPageTopicIds]);

  const handleSelectTopic = useCallback(
    (topicId: string, event?: React.MouseEvent) => {
      if (event) event.stopPropagation();
      handleRowClickSelection(topicId, currentPageTopicIds, event?.shiftKey || false);
    },
    [handleRowClickSelection, currentPageTopicIds],
  );

  const handleRowClick = useCallback(
    (topic: Topic, event: React.MouseEvent) => {
      if (
        (event.target as HTMLElement).closest('[role="checkbox"]') ||
        (event.target as HTMLElement).closest('[role="menu"]')
      ) {
        return;
      }
      navigate(routes.administration.topic.details(topic.id));
    },
    [navigate],
  );

  const handleViewDetails = useCallback(() => {
    if (contextMenu && !contextMenu.isBulk) {
      navigate(routes.administration.topic.details(contextMenu.topics[0].id));
      setContextMenu(null);
    }
  }, [contextMenu, navigate]);

  const handleEdit = useCallback(() => {
    if (contextMenu) {
      if (contextMenu.isBulk && contextMenu.topics.length > 1) {
        const ids = contextMenu.topics.map((t) => t.id).join(",");
        navigate(`${routes.administration.topic.batchEdit}?ids=${ids}`);
      } else {
        navigate(routes.administration.topic.edit(contextMenu.topics[0].id));
      }
      setContextMenu(null);
    }
  }, [contextMenu, navigate]);

  const handleDelete = useCallback(() => {
    if (contextMenu) {
      setDeleteDialog({ items: contextMenu.topics, isBulk: contextMenu.topics.length > 1 });
      setContextMenu(null);
    }
  }, [contextMenu]);

  const confirmDelete = async () => {
    if (!deleteDialog) return;
    try {
      if (deleteDialog.isBulk) {
        await Promise.all(deleteDialog.items.map((t) => deleteTopic(t.id)));
        resetSelection();
      } else {
        await deleteTopic(deleteDialog.items[0].id);
      }
      refetch();
      setDeleteDialog(null);
    } catch {
      // handled by mutation
    }
  };

  const handleContextMenu = useCallback(
    (event: React.MouseEvent, topic: Topic) => {
      event.preventDefault();
      event.stopPropagation();

      const isTopicSelected = isSelected(topic.id);
      const hasSelection = selectionCount > 0;

      if (hasSelection && isTopicSelected) {
        const selectedList = topics.filter((t) => isSelected(t.id));
        setContextMenu({
          x: event.clientX,
          y: event.clientY,
          topics: selectedList,
          isBulk: true,
        });
      } else {
        setContextMenu({
          x: event.clientX,
          y: event.clientY,
          topics: [topic],
          isBulk: false,
        });
      }
    },
    [topics, isSelected, selectionCount],
  );

  React.useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const columns = useMemo(
    () => [
      {
        key: "order",
        header: "ORDEM",
        sortable: true,
        // Tight order column — short numeric value.
        className: "w-20 min-w-[60px] max-w-[80px]",
        align: "left" as const,
        accessor: (t: Topic) => (
          <span className="font-mono text-sm text-muted-foreground">{t.order}</span>
        ),
      },
      {
        key: "title",
        header: "TÍTULO",
        sortable: true,
        className: "min-w-[200px] max-w-[260px]",
        align: "left" as const,
        accessor: (t: Topic) => (
          <span className="font-medium truncate block" title={t.title}>
            {t.title}
          </span>
        ),
      },
      {
        key: "description",
        header: "DESCRIÇÃO",
        sortable: false,
        // Fluid column — fills remaining space, truncates with tooltip on hover.
        className: "w-auto",
        align: "left" as const,
        accessor: (t: Topic) =>
          t.description ? (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="block whitespace-nowrap overflow-hidden text-ellipsis text-sm text-muted-foreground">
                    {t.description}
                  </span>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  align="start"
                  className="max-w-md whitespace-pre-wrap"
                >
                  {t.description}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <span className="text-sm text-muted-foreground/60">—</span>
          ),
      },
      {
        key: "skillId",
        header: "COMPETÊNCIA",
        sortable: true,
        className: "w-44 min-w-44 max-w-[180px]",
        align: "left" as const,
        accessor: (t: Topic) =>
          t.skill ? (
            <Badge variant="default" className="font-normal">
              {t.skill.name}
            </Badge>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          ),
      },
      {
        key: "_count.levels",
        header: "NÍVEIS",
        sortable: false,
        className: "w-24 min-w-24 max-w-24",
        align: "center" as const,
        accessor: (t: Topic) => {
          const count = t._count?.levels ?? 0;
          return (
            <Badge variant={count === 6 ? "green" : "gray"} className="font-normal">
              {count} / 6
            </Badge>
          );
        },
      },
      {
        key: "isActive",
        header: "STATUS",
        sortable: false,
        className: "w-28 min-w-28 max-w-28",
        align: "center" as const,
        accessor: (t: Topic) =>
          t.isActive ? (
            <Badge variant="green" className="font-normal">
              Ativo
            </Badge>
          ) : (
            <Badge variant="gray" className="font-normal">
              Inativo
            </Badge>
          ),
      },
    ],
    [],
  );

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

  if (isLoading) {
    return <TopicListSkeleton />;
  }

  const allSelected = isAllSelected(currentPageTopicIds);
  const someSelected = isPartiallySelected(currentPageTopicIds);

  return (
    <div className={cn("rounded-lg flex flex-col overflow-hidden", className)}>
      <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
            <TableRow className="bg-muted hover:bg-muted even:bg-muted">
              {showInteractive && (
                <TableHead
                  className={cn(
                    TABLE_LAYOUT.checkbox.className,
                    "whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0",
                  )}
                >
                  <div className="flex items-center justify-center h-full w-full px-2">
                    <Checkbox
                      checked={allSelected}
                      indeterminate={someSelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="Selecionar todos"
                      disabled={isLoading || topics.length === 0}
                      data-checkbox
                    />
                  </div>
                </TableHead>
              )}
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(
                    "whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0",
                    column.className,
                    "border-r border-border last:border-r-0",
                  )}
                >
                  {column.sortable ? (
                    <button
                      onClick={() => toggleSort(column.key)}
                      className={cn(
                        "flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer border-0 bg-transparent",
                        column.align === "center"
                          ? "justify-center"
                          : column.align === "left"
                            ? "justify-start text-left"
                            : "justify-start",
                      )}
                      disabled={isLoading || topics.length === 0}
                    >
                      <span className="truncate">{column.header}</span>
                      {renderSortIndicator(column.key)}
                    </button>
                  ) : (
                    <div
                      className={cn(
                        "flex items-center h-full min-h-[2.5rem] px-4 py-2",
                        column.align === "center" ? "justify-center" : "justify-start",
                      )}
                    >
                      <span className="truncate">{column.header}</span>
                    </div>
                  )}
                </TableHead>
              ))}
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

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden border-l border-r border-border"
      >
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableBody>
            {error ? (
              <TableRow>
                <TableCell colSpan={columns.length + (showInteractive ? 1 : 0)} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-destructive">
                    <IconAlertTriangle className="h-8 w-8 mb-4" />
                    <div className="text-lg font-medium mb-2">Não foi possível carregar os tópicos</div>
                    <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : topics.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (showInteractive ? 1 : 0)} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <IconClipboardList className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="text-lg font-medium mb-2">Nenhum tópico encontrado</div>
                    {filters && Object.keys(filters).length > 1 ? (
                      <div className="text-sm">Ajuste os filtros para ver mais resultados.</div>
                    ) : (
                      <>
                        <div className="text-sm mb-4">Comece cadastrando o primeiro tópico.</div>
                        <Button onClick={() => navigate(routes.administration.topic.create)} variant="outline">
                          <IconPlus className="h-4 w-4 mr-2" />
                          Cadastrar Tópico
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              topics.map((topic, index) => {
                const isTopicSelected = isSelected(topic.id);
                return (
                  <TableRow
                    key={topic.id}
                    className={cn(
                      "cursor-pointer transition-colors border-b border-border",
                      index % 2 === 1 && "bg-muted/10",
                      "hover:bg-muted/20",
                      isTopicSelected && "bg-muted/30 hover:bg-muted/40",
                    )}
                    onClick={(e) => handleRowClick(topic, e)}
                    onContextMenu={(e) => handleContextMenu(e, topic)}
                  >
                    {showInteractive && (
                      <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                        <div
                          className="flex items-center justify-center h-full w-full px-2 py-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectTopic(topic.id, e);
                          }}
                        >
                          <Checkbox
                            checked={isTopicSelected}
                            aria-label={`Selecionar tópico ${topic.title}`}
                            data-checkbox
                          />
                        </div>
                      </TableCell>
                    )}
                    {columns.map((column) => (
                      <TableCell
                        key={column.key}
                        className={cn(
                          "p-0 !border-r-0",
                          column.className,
                          column.align === "center" ? "text-center" : "text-left",
                        )}
                      >
                        <div
                          className={cn(
                            "px-4 py-2 text-sm",
                            column.align === "center" ? "text-center" : "text-left",
                          )}
                        >
                          {column.accessor(topic)}
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

      <div className="px-4 border-l border-r border-b border-border rounded-b-lg bg-muted/50">
        <SimplePaginationAdvanced
          currentPage={page}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalRecords}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[20, 40, 60, 100]}
          showPageSizeSelector={true}
          showGoToPage={true}
          showPageInfo={true}
        />
      </div>

      <DropdownMenu open={!!contextMenu} onOpenChange={(open) => !open && setContextMenu(null)}>
        <PositionedDropdownMenuContent
          position={contextMenu}
          isOpen={!!contextMenu}
          className="w-56 ![position:fixed]"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {contextMenu?.isBulk && (
            <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
              {contextMenu.topics.length} tópicos selecionados
            </div>
          )}

          {!contextMenu?.isBulk && (
            <DropdownMenuItem onClick={handleViewDetails}>
              <IconEye className="mr-2 h-4 w-4" />
              Ver Detalhes
            </DropdownMenuItem>
          )}

          {canEdit && (
            <DropdownMenuItem onClick={handleEdit}>
              <IconEdit className="mr-2 h-4 w-4" />
              {contextMenu?.isBulk && contextMenu.topics.length > 1 ? "Editar em lote" : "Editar"}
            </DropdownMenuItem>
          )}

          {(canEdit || canDelete) && <DropdownMenuSeparator />}

          {canDelete && (
            <DropdownMenuItem onClick={handleDelete} className="text-destructive">
              <IconTrash className="mr-2 h-4 w-4" />
              {contextMenu?.isBulk && contextMenu.topics.length > 1 ? "Excluir selecionados" : "Excluir"}
            </DropdownMenuItem>
          )}
        </PositionedDropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog?.isBulk
                ? `Tem certeza que deseja excluir ${deleteDialog.items.length} tópicos? Esta ação não pode ser desfeita.`
                : `Tem certeza que deseja excluir o tópico "${deleteDialog?.items[0]?.title}"? Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
