import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  IconChevronUp,
  IconChevronDown,
  IconSelector,
  IconEye,
  IconEdit,
  IconTrash,
  IconAlertTriangle,
  IconStethoscope,
  IconPlus,
  IconClipboardCheck,
  IconBan,
} from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES, MEDICAL_EXAM_STATUS } from "../../../../constants";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { useScrollbarWidth } from "@/hooks/common/use-scrollbar-width";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/common/use-table-state";
import { useMedicalExams } from "@/hooks/occupational-health/use-medical-exams";
import type { MedicalExam } from "@/types/medical-exam";
import type { MedicalExamGetManyFormData } from "@/schemas/medical-exam";
import { createMedicalExamColumns } from "./medical-exam-table-columns";
import { MedicalExamListSkeleton } from "./medical-exam-list-skeleton";
import type { MedicalExamColumn } from "./types";

interface MedicalExamTableProps {
  visibleColumns: Set<string>;
  className?: string;
  onComplete?: (exam: MedicalExam) => void;
  onCancel?: (exam: MedicalExam) => void;
  onDelete?: (exams: MedicalExam[]) => void;
  filters?: Partial<MedicalExamGetManyFormData>;
  onDataChange?: (data: { exams: MedicalExam[]; totalRecords: number }) => void;
}

export function MedicalExamTable({ visibleColumns, className, onComplete, onCancel, onDelete, filters = {}, onDataChange }: MedicalExamTableProps) {
  const navigate = useNavigate();

  // Permission checks - only ADMIN can delete exams
  const { user } = useAuth();
  const isAdmin = user?.sector?.privileges === SECTOR_PRIVILEGES.ADMIN;

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
    defaultSort: [{ column: "createdAt", direction: "desc" }],
  });

  // Memoize include configuration to prevent re-renders
  const includeConfig = React.useMemo(
    () => ({
      user: {
        include: {
          position: true,
        },
      },
      file: true,
    }),
    [],
  );

  // Memoize query parameters to prevent infinite re-renders
  const queryParams = React.useMemo(
    () => ({
      ...filters,
      page: page + 1, // Convert 0-based to 1-based for API
      limit: pageSize,
      include: includeConfig,
      ...(sortConfigs.length > 0 && {
        orderBy: convertSortConfigsToOrderBy(sortConfigs),
      }),
      ...(showSelectedOnly &&
        selectedIds.length > 0 && {
          where: {
            ...(filters as any)?.where,
            id: { in: selectedIds },
          },
        }),
    }),
    [filters, page, pageSize, includeConfig, sortConfigs, showSelectedOnly, selectedIds],
  );

  const { data: response, isLoading, error } = useMedicalExams(queryParams);

  const exams = response?.data || [];
  const totalRecords = response?.meta?.totalRecords || 0;
  const totalPages = Math.ceil(totalRecords / pageSize);

  // Notify parent component of data changes
  const lastNotifiedDataRef = React.useRef<string>("");
  React.useEffect(() => {
    if (onDataChange) {
      const dataKey = exams.length > 0 ? `${totalRecords}-${exams.map((exam) => exam.id).join(",")}` : `empty-${totalRecords}`;
      if (dataKey !== lastNotifiedDataRef.current) {
        lastNotifiedDataRef.current = dataKey;
        onDataChange({ exams, totalRecords });
      }
    }
  }, [exams, totalRecords, onDataChange]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    exams: MedicalExam[];
    isBulk: boolean;
  } | null>(null);

  // Define all available columns and filter by visibility
  const allColumns: MedicalExamColumn[] = createMedicalExamColumns();
  const columns = allColumns.filter((col) => visibleColumns.has(col.key));

  // Get current page exam IDs for selection
  const currentPageExamIds = React.useMemo(() => exams.map((exam) => exam.id), [exams]);

  const allSelected = isAllSelected(currentPageExamIds);
  const partiallySelected = isPartiallySelected(currentPageExamIds);

  const handleSelectAll = () => {
    toggleSelectAll(currentPageExamIds);
  };

  const handleSelectExam = (examId: string, event?: React.MouseEvent) => {
    handleRowClickSelection(examId, currentPageExamIds, event?.shiftKey || false);
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
  const handleContextMenu = (e: React.MouseEvent, exam: MedicalExam) => {
    e.preventDefault();
    e.stopPropagation();

    const isExamSelected = isSelected(exam.id);
    const hasSelection = selectionCount > 0;

    if (hasSelection && isExamSelected) {
      const selectedExamsList = exams.filter((item) => isSelected(item.id));
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        exams: selectedExamsList,
        isBulk: selectedExamsList.length > 1,
      });
    } else {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        exams: [exam],
        isBulk: false,
      });
    }
  };

  const handleViewDetails = () => {
    if (contextMenu && !contextMenu.isBulk) {
      navigate(routes.occupationalHealth.medicalExams.details(contextMenu.exams[0].id));
      setContextMenu(null);
    }
  };

  const handleComplete = () => {
    if (contextMenu && !contextMenu.isBulk && onComplete) {
      onComplete(contextMenu.exams[0]);
      setContextMenu(null);
    }
  };

  const handleEdit = () => {
    if (contextMenu && !contextMenu.isBulk) {
      navigate(routes.occupationalHealth.medicalExams.edit(contextMenu.exams[0].id));
      setContextMenu(null);
    }
  };

  const handleCancel = () => {
    if (contextMenu && !contextMenu.isBulk && onCancel) {
      onCancel(contextMenu.exams[0]);
      setContextMenu(null);
    }
  };

  const handleDelete = () => {
    if (contextMenu && onDelete) {
      onDelete(contextMenu.exams);
      removeFromSelection(contextMenu.exams.map((exam) => exam.id));
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
    return <MedicalExamListSkeleton />;
  }

  const singleExam = contextMenu && !contextMenu.isBulk ? contextMenu.exams[0] : null;
  const isScheduled = singleExam?.status === MEDICAL_EXAM_STATUS.SCHEDULED;

  return (
    <div className={cn("rounded-lg flex flex-col overflow-hidden", className)}>
      {/* Fixed Header Table */}
      <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
            <TableRow className="bg-muted hover:bg-muted even:bg-muted">
              {/* Selection column */}
              {isAdmin && (
                <TableHead className={cn(TABLE_LAYOUT.checkbox.className, "whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0")}>
                  <div className="flex items-center justify-center h-full w-full px-2">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="Selecionar todos os exames"
                      disabled={isLoading || exams.length === 0}
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
                      disabled={isLoading || exams.length === 0}
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
                    <div className="text-lg font-medium mb-2">Não foi possível carregar os exames</div>
                    <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : exams.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <IconStethoscope className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="text-lg font-medium mb-2">Nenhum exame encontrado</div>
                    {filters && Object.keys(filters).length > 1 ? (
                      <div className="text-sm">Ajuste os filtros para ver mais resultados.</div>
                    ) : (
                      <>
                        <div className="text-sm mb-4">Comece agendando o primeiro exame.</div>
                        <Button onClick={() => navigate(routes.occupationalHealth.medicalExams.create)} variant="outline">
                          <IconPlus className="h-4 w-4 mr-2" />
                          Agendar Exame
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              exams.map((exam, index) => {
                const examIsSelected = isSelected(exam.id);

                return (
                  <TableRow
                    key={exam.id}
                    data-state={examIsSelected ? "selected" : undefined}
                    className={cn(
                      "cursor-pointer transition-colors border-b border-border",
                      index % 2 === 1 && "bg-muted/10",
                      "hover:bg-muted/20",
                      examIsSelected && "bg-muted/30 hover:bg-muted/40",
                    )}
                    onClick={() => navigate(routes.occupationalHealth.medicalExams.details(exam.id))}
                    onContextMenu={(e) => handleContextMenu(e, exam)}
                  >
                    {/* Selection checkbox */}
                    {isAdmin && (
                      <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                        <div
                          className="flex items-center justify-center h-full w-full px-2 py-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectExam(exam.id, e);
                          }}
                        >
                          <Checkbox checked={examIsSelected} aria-label={`Selecionar exame de ${exam.user?.name || "colaborador"}`} data-checkbox />
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
                        <div className="px-4 py-2">{column.accessor(exam)}</div>
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
        <PositionedDropdownMenuContent position={contextMenu} isOpen={!!contextMenu} className="w-56 ![position:fixed]" onCloseAutoFocus={(e) => e.preventDefault()}>
          {contextMenu?.isBulk && <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">{contextMenu.exams.length} exames selecionados</div>}

          {!contextMenu?.isBulk && (
            <DropdownMenuItem onClick={handleViewDetails}>
              <IconEye className="mr-2 h-4 w-4" />
              Ver detalhes
            </DropdownMenuItem>
          )}

          {!contextMenu?.isBulk && isScheduled && onComplete && (
            <DropdownMenuItem onClick={handleComplete}>
              <IconClipboardCheck className="mr-2 h-4 w-4" />
              Concluir
            </DropdownMenuItem>
          )}

          {!contextMenu?.isBulk && (
            <DropdownMenuItem onClick={handleEdit}>
              <IconEdit className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
          )}

          {!contextMenu?.isBulk && isScheduled && onCancel && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleCancel}>
                <IconBan className="mr-2 h-4 w-4" />
                Cancelar
              </DropdownMenuItem>
            </>
          )}

          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                <IconTrash className="mr-2 h-4 w-4" />
                {contextMenu?.isBulk ? "Excluir selecionados" : "Excluir"}
              </DropdownMenuItem>
            </>
          )}
        </PositionedDropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
