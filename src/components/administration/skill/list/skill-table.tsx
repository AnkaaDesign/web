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

import type { Skill, SkillGetManyFormData, SkillOrderBy } from "../../../../types";
import { routes } from "../../../../constants";
import { useAuth } from "../../../../hooks/common/use-auth";
import {
  canEditHrEntities,
  canDeleteHrEntities,
  shouldShowInteractiveElements,
} from "@/utils/permissions/entity-permissions";
import { useSkills, useSkillMutations } from "../../../../hooks";

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
import { SkillListSkeleton } from "./skill-list-skeleton";
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

interface SkillTableProps {
  filters: Partial<SkillGetManyFormData>;
  onDataChange?: (data: { skills: Skill[]; totalRecords: number }) => void;
  className?: string;
}

function convertSortConfigsToSkillOrderBy(
  sortConfigs: Array<{ column: string; direction: "asc" | "desc" }>,
): SkillOrderBy | undefined {
  if (sortConfigs.length === 0) return undefined;
  const orderBy: SkillOrderBy = {};
  for (const config of sortConfigs) {
    const field = config.column as keyof SkillOrderBy;
    if (
      field === "id" ||
      field === "name" ||
      field === "order" ||
      field === "createdAt" ||
      field === "updatedAt"
    ) {
      orderBy[field] = config.direction;
    }
  }
  return Object.keys(orderBy).length > 0 ? orderBy : undefined;
}

export function SkillTable({ filters, onDataChange, className }: SkillTableProps) {
  const navigate = useNavigate();
  const { delete: deleteSkill } = useSkillMutations();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { user } = useAuth();
  const canEdit = user ? canEditHrEntities(user) : false;
  const canDelete = user ? canDeleteHrEntities(user) : false;
  const showInteractive = user ? shouldShowInteractiveElements(user, "hr") : false;

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    skills: Skill[];
    isBulk: boolean;
  } | null>(null);

  const [deleteDialog, setDeleteDialog] = useState<{ items: Skill[]; isBulk: boolean } | null>(null);

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
      include: { _count: { select: { topics: true } } },
      ...(sortConfigs.length > 0
        ? { orderBy: convertSortConfigsToSkillOrderBy(sortConfigs) }
        : { orderBy: { order: "asc" as const } }),
      ...(showSelectedOnly &&
        selectedIds.length > 0 && {
          where: { id: { in: selectedIds } },
        }),
    }),
    [filters, page, pageSize, sortConfigs, showSelectedOnly, selectedIds],
  );

  const { data: response, isLoading, error, refetch } = useSkills(queryParams);

  const skills = response?.data || [];
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
        skills.length > 0 ? `${totalRecords}-${skills.map((s) => s.id).join(",")}` : `empty-${totalRecords}`;
      if (dataKey !== lastNotifiedDataRef.current) {
        lastNotifiedDataRef.current = dataKey;
        onDataChange({ skills, totalRecords });
      }
    }
  }, [skills, totalRecords, onDataChange]);

  const { width: scrollbarWidth, isOverlay } = useScrollbarWidth();

  const currentPageSkillIds = React.useMemo(() => skills.map((s) => s.id), [skills]);

  const handleSelectAll = useCallback(() => {
    toggleSelectAll(currentPageSkillIds);
  }, [toggleSelectAll, currentPageSkillIds]);

  const handleSelectSkill = useCallback(
    (skillId: string, event?: React.MouseEvent) => {
      if (event) event.stopPropagation();
      handleRowClickSelection(skillId, currentPageSkillIds, event?.shiftKey || false);
    },
    [handleRowClickSelection, currentPageSkillIds],
  );

  const handleRowClick = useCallback(
    (skill: Skill, event: React.MouseEvent) => {
      if (
        (event.target as HTMLElement).closest('[role="checkbox"]') ||
        (event.target as HTMLElement).closest('[role="menu"]')
      ) {
        return;
      }
      navigate(routes.administration.skill.details(skill.id));
    },
    [navigate],
  );

  const handleViewDetails = useCallback(() => {
    if (contextMenu && !contextMenu.isBulk) {
      navigate(routes.administration.skill.details(contextMenu.skills[0].id));
      setContextMenu(null);
    }
  }, [contextMenu, navigate]);

  const handleEdit = useCallback(() => {
    if (contextMenu) {
      if (contextMenu.isBulk && contextMenu.skills.length > 1) {
        const ids = contextMenu.skills.map((s) => s.id).join(",");
        navigate(`${routes.administration.skill.batchEdit}?ids=${ids}`);
      } else {
        navigate(routes.administration.skill.edit(contextMenu.skills[0].id));
      }
      setContextMenu(null);
    }
  }, [contextMenu, navigate]);

  const handleDelete = useCallback(() => {
    if (contextMenu) {
      setDeleteDialog({ items: contextMenu.skills, isBulk: contextMenu.skills.length > 1 });
      setContextMenu(null);
    }
  }, [contextMenu]);

  const confirmDelete = async () => {
    if (!deleteDialog) return;
    try {
      if (deleteDialog.isBulk) {
        await Promise.all(deleteDialog.items.map((s) => deleteSkill(s.id)));
        resetSelection();
      } else {
        await deleteSkill(deleteDialog.items[0].id);
      }
      refetch();
      setDeleteDialog(null);
    } catch {
      // handled by mutation
    }
  };

  const handleContextMenu = useCallback(
    (event: React.MouseEvent, skill: Skill) => {
      event.preventDefault();
      event.stopPropagation();

      const isSkillSelected = isSelected(skill.id);
      const hasSelection = selectionCount > 0;

      if (hasSelection && isSkillSelected) {
        const selectedList = skills.filter((s) => isSelected(s.id));
        setContextMenu({
          x: event.clientX,
          y: event.clientY,
          skills: selectedList,
          isBulk: true,
        });
      } else {
        setContextMenu({
          x: event.clientX,
          y: event.clientY,
          skills: [skill],
          isBulk: false,
        });
      }
    },
    [skills, isSelected, selectionCount],
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
        className: "w-28 min-w-[100px] max-w-[120px]",
        align: "left" as const,
        accessor: (s: Skill) => (
          <span className="text-sm text-muted-foreground">{s.order}</span>
        ),
      },
      {
        key: "name",
        header: "NOME",
        sortable: true,
        className: "w-96 min-w-[300px] max-w-[400px]",
        align: "left" as const,
        accessor: (s: Skill) => (
          <span className="font-medium truncate block" title={s.name}>
            {s.name}
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
        accessor: (s: Skill) =>
          s.description ? (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="block whitespace-nowrap overflow-hidden text-ellipsis text-sm text-muted-foreground">
                    {s.description}
                  </span>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  align="start"
                  className="max-w-md whitespace-pre-wrap"
                >
                  {s.description}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <span className="text-sm text-muted-foreground/60">—</span>
          ),
      },
      {
        key: "_count.topics",
        header: "TÓPICOS",
        sortable: false,
        className: "w-32 min-w-[120px] max-w-[140px]",
        align: "center" as const,
        accessor: (s: Skill) => (
          <Badge variant="default" className="w-10 justify-center">
            {s._count?.topics ?? 0}
          </Badge>
        ),
      },
      {
        key: "isActive",
        header: "STATUS",
        sortable: false,
        className: "w-36 min-w-[130px] max-w-[150px]",
        align: "center" as const,
        accessor: (s: Skill) =>
          s.isActive ? (
            <Badge variant="green" className="font-normal">
              Ativa
            </Badge>
          ) : (
            <Badge variant="gray" className="font-normal">
              Inativa
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
    return <SkillListSkeleton />;
  }

  const allSelected = isAllSelected(currentPageSkillIds);
  const someSelected = isPartiallySelected(currentPageSkillIds);

  return (
    <div className={cn("rounded-lg flex flex-col overflow-hidden", className)}>
      {/* Fixed Header */}
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
                      disabled={isLoading || skills.length === 0}
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
                      disabled={isLoading || skills.length === 0}
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

      {/* Scrollable Body */}
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
                    <div className="text-lg font-medium mb-2">Não foi possível carregar as competências</div>
                    <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : skills.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (showInteractive ? 1 : 0)} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <IconClipboardList className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="text-lg font-medium mb-2">Nenhuma competência encontrada</div>
                    {filters && Object.keys(filters).length > 1 ? (
                      <div className="text-sm">Ajuste os filtros para ver mais resultados.</div>
                    ) : (
                      <>
                        <div className="text-sm mb-4">Comece cadastrando a primeira competência.</div>
                        <Button onClick={() => navigate(routes.administration.skill.create)} variant="outline">
                          <IconPlus className="h-4 w-4 mr-2" />
                          Cadastrar Competência
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              skills.map((skill, index) => {
                const isSkillSelected = isSelected(skill.id);
                return (
                  <TableRow
                    key={skill.id}
                    className={cn(
                      "cursor-pointer transition-colors border-b border-border",
                      index % 2 === 1 && "bg-muted/10",
                      "hover:bg-muted/20",
                      isSkillSelected && "bg-muted/30 hover:bg-muted/40",
                    )}
                    onClick={(e) => handleRowClick(skill, e)}
                    onContextMenu={(e) => handleContextMenu(e, skill)}
                  >
                    {showInteractive && (
                      <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                        <div
                          className="flex items-center justify-center h-full w-full px-2 py-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectSkill(skill.id, e);
                          }}
                        >
                          <Checkbox
                            checked={isSkillSelected}
                            aria-label={`Selecionar competência ${skill.name}`}
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
                          {column.accessor(skill)}
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
              {contextMenu.skills.length} competências selecionadas
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
              {contextMenu?.isBulk && contextMenu.skills.length > 1 ? "Editar em lote" : "Editar"}
            </DropdownMenuItem>
          )}

          {(canEdit || canDelete) && <DropdownMenuSeparator />}

          {canDelete && (
            <DropdownMenuItem onClick={handleDelete} className="text-destructive">
              <IconTrash className="mr-2 h-4 w-4" />
              {contextMenu?.isBulk && contextMenu.skills.length > 1 ? "Excluir selecionados" : "Excluir"}
            </DropdownMenuItem>
          )}
        </PositionedDropdownMenuContent>
      </DropdownMenu>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog?.isBulk
                ? `Tem certeza que deseja excluir ${deleteDialog.items.length} competências? Esta ação não pode ser desfeita.`
                : `Tem certeza que deseja excluir a competência "${deleteDialog?.items[0]?.name}"? Esta ação não pode ser desfeita.`}
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
