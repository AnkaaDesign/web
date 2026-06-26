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
  IconPlayerPlay,
  IconLock,
  IconX,
} from "@tabler/icons-react";

import type {
  Assessment,
  AssessmentGetManyFormData,
  AssessmentOrderBy,
} from "../../../../types";
import {
  routes,
  ASSESSMENT_STATUS,
  ASSESSMENT_STATUS_LABELS,
} from "../../../../constants";
import { useAuth } from "../../../../hooks/common/use-auth";
import {
  canEditAssessments,
  canDeleteAssessments,
} from "@/utils/permissions/entity-permissions";
import {
  useAssessments,
  useDeleteAssessment,
  useOpenAssessment,
  useCloseAssessment,
  useCancelAssessment,
} from "../../../../hooks";
import { formatDate } from "../../../../utils";

import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { useScrollbarWidth } from "@/hooks/common/use-scrollbar-width";
import { SkillAssessmentListSkeleton } from "./skill-assessment-list-skeleton";
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

interface SkillAssessmentTableProps {
  filters: Partial<AssessmentGetManyFormData>;
  onDataChange?: (data: { assessments: Assessment[]; totalRecords: number }) => void;
  className?: string;
}

function convertSortConfigsToAssessmentOrderBy(
  sortConfigs: Array<{ column: string; direction: "asc" | "desc" }>,
): AssessmentOrderBy | undefined {
  if (sortConfigs.length === 0) return undefined;
  const orderBy: AssessmentOrderBy = {};
  for (const config of sortConfigs) {
    const field = config.column as keyof AssessmentOrderBy;
    if (
      field === "id" ||
      field === "name" ||
      field === "status" ||
      field === "periodStart" ||
      field === "periodEnd" ||
      field === "createdAt" ||
      field === "updatedAt"
    ) {
      orderBy[field] = config.direction;
    }
  }
  return Object.keys(orderBy).length > 0 ? orderBy : undefined;
}

const getStatusVariant = (
  status: ASSESSMENT_STATUS,
): "blue" | "green" | "gray" | "orange" => {
  switch (status) {
    case ASSESSMENT_STATUS.OPEN:
      return "blue";
    case ASSESSMENT_STATUS.CLOSED:
      return "green";
    case ASSESSMENT_STATUS.CANCELLED:
      return "orange";
    case ASSESSMENT_STATUS.DRAFT:
    default:
      return "gray";
  }
};

export function SkillAssessmentTable({ filters, onDataChange, className }: SkillAssessmentTableProps) {
  const navigate = useNavigate();
  const deleteAssessmentMutation = useDeleteAssessment();
  const openAssessmentMutation = useOpenAssessment();
  const closeAssessmentMutation = useCloseAssessment();
  const cancelAssessmentMutation = useCancelAssessment();
  const [pendingLifecycle, setPendingLifecycle] = useState<
    | { kind: "open" | "close" | "cancel"; assessment: Assessment }
    | null
  >(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { user } = useAuth();
  const canEdit = user ? canEditAssessments(user) : false;
  const canDelete = user ? canDeleteAssessments(user) : false;
  const showInteractive = canEdit;

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    assessments: Assessment[];
    isBulk: boolean;
  } | null>(null);

  const [deleteDialog, setDeleteDialog] = useState<{ items: Assessment[]; isBulk: boolean } | null>(
    null,
  );

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
        createdBy: true,
        // Per-sector evaluatee counts so we can show planned counts in DRAFT
        // (before any AssessmentEntry rows exist). Sum on the client.
        sectors: { include: { _count: { select: { evaluatees: true } } } },
        _count: { select: { sectors: true, topics: true, entries: true } },
      } as any,
      ...(sortConfigs.length > 0
        ? { orderBy: convertSortConfigsToAssessmentOrderBy(sortConfigs) }
        : { orderBy: { createdAt: "desc" as const } }),
      ...(showSelectedOnly &&
        selectedIds.length > 0 && {
          where: { id: { in: selectedIds } },
        }),
    }),
    [filters, page, pageSize, sortConfigs, showSelectedOnly, selectedIds],
  );

  const { data: response, isLoading, error, refetch } = useAssessments(queryParams);

  const assessments: Assessment[] = response?.data || [];
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
        assessments.length > 0
          ? `${totalRecords}-${assessments.map((a) => a.id).join(",")}`
          : `empty-${totalRecords}`;
      if (dataKey !== lastNotifiedDataRef.current) {
        lastNotifiedDataRef.current = dataKey;
        onDataChange({ assessments, totalRecords });
      }
    }
  }, [assessments, totalRecords, onDataChange]);

  const { width: scrollbarWidth, isOverlay } = useScrollbarWidth();

  const currentPageIds = React.useMemo(() => assessments.map((a) => a.id), [assessments]);

  const handleSelectAll = useCallback(() => {
    toggleSelectAll(currentPageIds);
  }, [toggleSelectAll, currentPageIds]);

  const handleSelectRow = useCallback(
    (id: string, event?: React.MouseEvent) => {
      if (event) event.stopPropagation();
      handleRowClickSelection(id, currentPageIds, event?.shiftKey || false);
    },
    [handleRowClickSelection, currentPageIds],
  );

  const handleRowClick = useCallback(
    (assessment: Assessment, event: React.MouseEvent) => {
      if (
        (event.target as HTMLElement).closest('[role="checkbox"]') ||
        (event.target as HTMLElement).closest('[role="menu"]')
      ) {
        return;
      }
      navigate(routes.administration.skillAssessment.details(assessment.id));
    },
    [navigate],
  );

  const handleViewDetails = useCallback(() => {
    if (contextMenu && !contextMenu.isBulk) {
      navigate(routes.administration.skillAssessment.details(contextMenu.assessments[0].id));
      setContextMenu(null);
    }
  }, [contextMenu, navigate]);

  const handleEdit = useCallback(() => {
    if (contextMenu && !contextMenu.isBulk) {
      navigate(routes.administration.skillAssessment.edit(contextMenu.assessments[0].id));
      setContextMenu(null);
    }
  }, [contextMenu, navigate]);

  const handleDelete = useCallback(() => {
    if (contextMenu) {
      setDeleteDialog({
        items: contextMenu.assessments,
        isBulk: contextMenu.assessments.length > 1,
      });
      setContextMenu(null);
    }
  }, [contextMenu]);

  const handleLifecycle = useCallback(
    (kind: "open" | "close" | "cancel") => {
      if (contextMenu && !contextMenu.isBulk) {
        setPendingLifecycle({ kind, assessment: contextMenu.assessments[0] });
        setContextMenu(null);
      }
    },
    [contextMenu],
  );

  const confirmLifecycle = async () => {
    if (!pendingLifecycle) return;
    const { kind, assessment } = pendingLifecycle;
    const mutation =
      kind === "open"
        ? openAssessmentMutation
        : kind === "close"
          ? closeAssessmentMutation
          : cancelAssessmentMutation;
    try {
      await mutation.mutateAsync(assessment.id);
      refetch();
    } catch {
      // toast handled by mutation
    } finally {
      setPendingLifecycle(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteDialog) return;
    try {
      if (deleteDialog.isBulk) {
        await Promise.all(deleteDialog.items.map((a) => deleteAssessmentMutation.mutateAsync(a.id)));
        resetSelection();
      } else {
        await deleteAssessmentMutation.mutateAsync(deleteDialog.items[0].id);
      }
      refetch();
      setDeleteDialog(null);
    } catch {
      // handled by mutation
    }
  };

  const handleContextMenu = useCallback(
    (event: React.MouseEvent, assessment: Assessment) => {
      event.preventDefault();
      event.stopPropagation();

      const isRowSelected = isSelected(assessment.id);
      const hasSelection = selectionCount > 0;

      if (hasSelection && isRowSelected) {
        const selectedList = assessments.filter((a) => isSelected(a.id));
        setContextMenu({
          x: event.clientX,
          y: event.clientY,
          assessments: selectedList,
          isBulk: true,
        });
      } else {
        setContextMenu({
          x: event.clientX,
          y: event.clientY,
          assessments: [assessment],
          isBulk: false,
        });
      }
    },
    [assessments, isSelected, selectionCount],
  );

  React.useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const columns = useMemo(
    () => [
      // Widths picked so every header text fits without truncation alongside
      // its sort icon. CAMPANHA is the only flex column (min-only) and absorbs
      // the remaining width.
      {
        key: "name",
        header: "CAMPANHA",
        sortable: true,
        className: "min-w-[220px]",
        align: "left" as const,
        accessor: (a: Assessment) => (
          <span className="font-medium truncate block" title={a.name}>
            {a.name}
          </span>
        ),
      },
      {
        key: "periodStart",
        header: "INICIA EM",
        sortable: true,
        className: "w-32 min-w-32 max-w-32",
        align: "left" as const,
        accessor: (a: Assessment) => (
          <span className="text-sm text-muted-foreground">
            {formatDate(a.periodStart)}
          </span>
        ),
      },
      {
        key: "periodEnd",
        header: "TERMINA EM",
        sortable: true,
        className: "w-32 min-w-32 max-w-32",
        align: "left" as const,
        accessor: (a: Assessment) => (
          <span className="text-sm text-muted-foreground">
            {formatDate(a.periodEnd)}
          </span>
        ),
      },
      {
        key: "createdBy.name",
        header: "CRIADA POR",
        sortable: false,
        className: "w-48 min-w-48 max-w-48",
        align: "left" as const,
        accessor: (a: Assessment) =>
          a.createdBy?.name ? (
            <span className="text-sm truncate block" title={a.createdBy.name}>
              {a.createdBy.name}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground/60">—</span>
          ),
      },
      {
        key: "_count.sectors",
        header: "SETORES",
        sortable: false,
        className: "w-28 min-w-28 max-w-28",
        align: "center" as const,
        accessor: (a: Assessment) => (
          <Badge variant="default" className="w-10 justify-center">
            {a._count?.sectors ?? 0}
          </Badge>
        ),
      },
      {
        key: "_count.topics",
        header: "TÓPICOS",
        sortable: false,
        className: "w-28 min-w-28 max-w-28",
        align: "center" as const,
        accessor: (a: Assessment) => (
          <Badge variant="default" className="w-10 justify-center">
            {a._count?.topics ?? 0}
          </Badge>
        ),
      },
      {
        key: "_count.entries",
        header: "AVALIADOS",
        sortable: false,
        className: "w-32 min-w-32 max-w-32",
        align: "center" as const,
        accessor: (a: Assessment) => {
          const planned = (a.sectors ?? []).reduce(
            (sum, s: any) => sum + (s._count?.evaluatees ?? 0),
            0,
          );
          const count =
            a.status === ASSESSMENT_STATUS.DRAFT
              ? planned
              : (a._count?.entries ?? planned);
          return (
            <Badge variant="default" className="w-10 justify-center">
              {count}
            </Badge>
          );
        },
      },
      {
        key: "status",
        header: "STATUS",
        sortable: true,
        className: "w-32 min-w-32 max-w-32",
        align: "left" as const,
        accessor: (a: Assessment) => (
          <Badge variant={getStatusVariant(a.status as ASSESSMENT_STATUS)} className="font-normal">
            {ASSESSMENT_STATUS_LABELS[a.status as ASSESSMENT_STATUS]}
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
    return <SkillAssessmentListSkeleton />;
  }

  const allSelected = isAllSelected(currentPageIds);
  const someSelected = isPartiallySelected(currentPageIds);

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
                      disabled={isLoading || assessments.length === 0}
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
                      disabled={isLoading || assessments.length === 0}
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
                    <div className="text-lg font-medium mb-2">Não foi possível carregar as avaliações</div>
                    <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : assessments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (showInteractive ? 1 : 0)} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <IconClipboardList className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="text-lg font-medium mb-2">Nenhuma campanha encontrada</div>
                    {filters && Object.keys(filters).length > 1 ? (
                      <div className="text-sm">Ajuste os filtros para ver mais resultados.</div>
                    ) : (
                      <>
                        <div className="text-sm mb-4">Crie a primeira campanha de avaliação.</div>
                        <Button
                          onClick={() => navigate(routes.administration.skillAssessment.create)}
                          variant="outline"
                        >
                          <IconPlus className="h-4 w-4 mr-2" />
                          Nova Campanha
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              assessments.map((assessment, index) => {
                const isRowSelected = isSelected(assessment.id);
                return (
                  <TableRow
                    key={assessment.id}
                    className={cn(
                      "cursor-pointer transition-colors border-b border-border",
                      index % 2 === 1 && "bg-muted/10",
                      "hover:bg-muted/20",
                      isRowSelected && "bg-muted/30 hover:bg-muted/40",
                    )}
                    onClick={(e) => handleRowClick(assessment, e)}
                    onContextMenu={(e) => handleContextMenu(e, assessment)}
                  >
                    {showInteractive && (
                      <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                        <div
                          className="flex items-center justify-center h-full w-full px-2 py-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectRow(assessment.id, e);
                          }}
                        >
                          <Checkbox
                            checked={isRowSelected}
                            aria-label={`Selecionar avaliação ${assessment.name}`}
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
                          {column.accessor(assessment)}
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
              {contextMenu.assessments.length} avaliações selecionadas
            </div>
          )}

          {(() => {
            // Single-row context menu drives the lifecycle actions.
            // Bulk only exposes Excluir (CANCELLED ones only) — open/close/cancel
            // in bulk would need confirmations per-status, which is out of scope.
            const single = !contextMenu?.isBulk
              ? contextMenu?.assessments[0]
              : undefined;
            const singleStatus = single?.status as ASSESSMENT_STATUS | undefined;
            const isDraft = singleStatus === ASSESSMENT_STATUS.DRAFT;
            const isOpen = singleStatus === ASSESSMENT_STATUS.OPEN;
            const isCancelled = singleStatus === ASSESSMENT_STATUS.CANCELLED;
            // Any non-cancelled campaign can be cancelled (incl. CLOSED), so it
            // can then be excluded — deletion requires CANCELLED status.
            const canStatusCancel = !isCancelled;
            // Excluir only applies to CANCELLED rows. For bulk, we let the
            // delete dialog filter on submit (or just allow the attempt).
            const showDelete = !contextMenu?.isBulk
              ? isCancelled && canDelete
              : canDelete;

            return (
              <>
                {!contextMenu?.isBulk && (
                  <DropdownMenuItem onClick={handleViewDetails}>
                    <IconEye className="mr-2 h-4 w-4" />
                    Ver Detalhes
                  </DropdownMenuItem>
                )}

                {single && canEdit && (isDraft || isOpen) && (
                  <DropdownMenuItem onClick={handleEdit}>
                    <IconEdit className="mr-2 h-4 w-4" />
                    Editar
                  </DropdownMenuItem>
                )}

                {single && canEdit && isDraft && (
                  <DropdownMenuItem onClick={() => handleLifecycle("open")}>
                    <IconPlayerPlay className="mr-2 h-4 w-4" />
                    Abrir campanha
                  </DropdownMenuItem>
                )}

                {single && canEdit && isOpen && (
                  <DropdownMenuItem onClick={() => handleLifecycle("close")}>
                    <IconLock className="mr-2 h-4 w-4" />
                    Fechar campanha
                  </DropdownMenuItem>
                )}

                {single && canEdit && canStatusCancel && (
                  <DropdownMenuItem
                    onClick={() => handleLifecycle("cancel")}
                    className="text-destructive"
                  >
                    <IconX className="mr-2 h-4 w-4" />
                    Cancelar campanha
                  </DropdownMenuItem>
                )}

                {showDelete && <DropdownMenuSeparator />}

                {showDelete && (
                  <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                    <IconTrash className="mr-2 h-4 w-4" />
                    {contextMenu?.isBulk && contextMenu.assessments.length > 1
                      ? "Excluir selecionadas"
                      : "Excluir"}
                  </DropdownMenuItem>
                )}
              </>
            );
          })()}
        </PositionedDropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog?.isBulk
                ? `Tem certeza que deseja excluir ${deleteDialog.items.length} avaliações? Esta ação não pode ser desfeita.`
                : `Tem certeza que deseja excluir a avaliação "${deleteDialog?.items[0]?.name}"? Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteAssessmentMutation.isPending}
            >
              {deleteAssessmentMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!pendingLifecycle}
        onOpenChange={(open) => !open && setPendingLifecycle(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingLifecycle?.kind === "open" && "Abrir campanha?"}
              {pendingLifecycle?.kind === "close" && "Fechar campanha?"}
              {pendingLifecycle?.kind === "cancel" && "Cancelar campanha?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingLifecycle?.kind === "open" &&
                `Esta ação gera as fichas para todos os avaliados configurados de "${pendingLifecycle.assessment.name}" e libera a coleta para os avaliadores.`}
              {pendingLifecycle?.kind === "close" &&
                `Esta ação encerra a coleta de "${pendingLifecycle.assessment.name}". Avaliadores não poderão mais enviar avaliações pendentes.`}
              {pendingLifecycle?.kind === "cancel" &&
                `Esta ação invalida "${pendingLifecycle.assessment.name}". As entradas existentes ficam congeladas e não recebem novas respostas.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmLifecycle}
              className={cn(
                pendingLifecycle?.kind === "cancel" &&
                  "bg-destructive text-destructive-foreground hover:bg-destructive/90",
              )}
              disabled={
                openAssessmentMutation.isPending ||
                closeAssessmentMutation.isPending ||
                cancelAssessmentMutation.isPending
              }
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
