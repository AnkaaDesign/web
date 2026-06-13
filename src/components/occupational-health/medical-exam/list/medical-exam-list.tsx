import { useState, useCallback, useMemo, useRef } from "react";
import { IconFilter } from "@tabler/icons-react";

import { useUsers } from "../../../../hooks";
import { MEDICAL_EXAM_STATUS } from "../../../../constants";
import { useMedicalExamMutations, useMedicalExamBatchMutations } from "@/hooks/occupational-health/use-medical-exams";
import type { MedicalExam } from "@/types/medical-exam";
import type { MedicalExamGetManyFormData } from "@/schemas/medical-exam";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
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
import { cn } from "@/lib/utils";
import { useTableState } from "@/hooks/common/use-table-state";
import { useTableFilters } from "@/hooks/common/use-table-filters";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";

import { MedicalExamTable } from "./medical-exam-table";
import { MedicalExamFilters } from "./medical-exam-filters";
import { ColumnVisibilityManager } from "./column-visibility-manager";
import { createMedicalExamColumns, DEFAULT_VISIBLE_COLUMNS } from "./medical-exam-table-columns";
import { extractActiveFilters, createFilterRemover } from "./filter-utils";
import { FilterIndicators } from "./filter-indicator";
import { MedicalExamCompleteDialog } from "../complete/medical-exam-complete-dialog";

interface MedicalExamListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

export function MedicalExamList({ className }: MedicalExamListProps) {
  const { updateAsync } = useMedicalExamMutations();
  const { batchDeleteAsync } = useMedicalExamBatchMutations();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [showFilterModal, setShowFilterModal] = useState(false);
  const [completeExam, setCompleteExam] = useState<MedicalExam | null>(null);
  const [cancelDialog, setCancelDialog] = useState<MedicalExam | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ items: MedicalExam[]; isBulk: boolean } | null>(null);

  // Get table state for selected exams functionality
  const { selectionCount, showSelectedOnly, toggleShowSelectedOnly } = useTableState({
    defaultPageSize: DEFAULT_PAGE_SIZE,
    resetSelectionOnPageChange: false,
  });

  // Custom deserializer for medical exam filters
  const deserializeFilters = useCallback((params: URLSearchParams): Partial<MedicalExamGetManyFormData> => {
    const filters: Partial<MedicalExamGetManyFormData> = {};

    const types = params.get("types");
    if (types) filters.types = types.split(",");

    const statuses = params.get("statuses");
    if (statuses) filters.statuses = statuses.split(",");

    const results = params.get("results");
    if (results) filters.results = results.split(",");

    const users = params.get("users");
    if (users) filters.userIds = users.split(",");

    const scheduledAfter = params.get("scheduledAfter");
    const scheduledBefore = params.get("scheduledBefore");
    if (scheduledAfter || scheduledBefore) {
      filters.scheduledAt = {
        ...(scheduledAfter && { gte: new Date(scheduledAfter) }),
        ...(scheduledBefore && { lte: new Date(scheduledBefore) }),
      };
    }

    const examAfter = params.get("examAfter");
    const examBefore = params.get("examBefore");
    if (examAfter || examBefore) {
      filters.examDate = {
        ...(examAfter && { gte: new Date(examAfter) }),
        ...(examBefore && { lte: new Date(examBefore) }),
      };
    }

    return filters;
  }, []);

  // Custom serializer for medical exam filters
  const serializeFilters = useCallback((filters: Partial<MedicalExamGetManyFormData>): Record<string, string> => {
    const params: Record<string, string> = {};

    if (filters.types?.length) params.types = filters.types.join(",");
    if (filters.statuses?.length) params.statuses = filters.statuses.join(",");
    if (filters.results?.length) params.results = filters.results.join(",");
    if (filters.userIds?.length) params.users = filters.userIds.join(",");

    if (filters.scheduledAt?.gte) params.scheduledAfter = filters.scheduledAt.gte.toISOString();
    if (filters.scheduledAt?.lte) params.scheduledBefore = filters.scheduledAt.lte.toISOString();
    if (filters.examDate?.gte) params.examAfter = filters.examDate.gte.toISOString();
    if (filters.examDate?.lte) params.examBefore = filters.examDate.lte.toISOString();

    return params;
  }, []);

  // Use the unified table filters hook
  const {
    filters,
    setFilters,
    searchingFor,
    displaySearchText,
    setSearch,
    clearAllFilters,
    queryFilters: baseQueryFilters,
    hasActiveFilters,
  } = useTableFilters<MedicalExamGetManyFormData>({
    defaultFilters: {
      limit: DEFAULT_PAGE_SIZE,
    },
    searchDebounceMs: 500,
    searchParamName: "search",
    serializeToUrl: serializeFilters,
    deserializeFromUrl: deserializeFilters,
    excludeFromUrl: ["limit", "orderBy"],
  });

  // Visible columns state with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility("medical-exam-list-visible-columns", DEFAULT_VISIBLE_COLUMNS);

  // Get all available columns for column visibility manager
  const allColumns = useMemo(() => createMedicalExamColumns(), []);

  // Load users for filter indicator labels (only the selected ones)
  const filterUserIds: string[] = useMemo(() => (Array.isArray(filters.userIds) ? filters.userIds : []), [filters.userIds]);
  const { data: filterUsersData } = useUsers(
    {
      where: { id: { in: filterUserIds } },
      orderBy: { name: "asc" },
    },
    { enabled: filterUserIds.length > 0 },
  );

  // Query filters to pass to the paginated table
  const queryFilters = useMemo(() => {
    const { orderBy: _, ...filterWithoutOrderBy } = baseQueryFilters;

    const result: any = {
      ...filterWithoutOrderBy,
      limit: DEFAULT_PAGE_SIZE,
    };

    // Date ranges are not top-level convenience filters in the API schema - move them into where
    const where: any = { ...result.where };
    if (result.scheduledAt) {
      where.scheduledAt = result.scheduledAt;
      delete result.scheduledAt;
    }
    if (result.examDate) {
      where.examDate = result.examDate;
      delete result.examDate;
    }
    if (Object.keys(where).length > 0) {
      result.where = where;
    }

    return result as Partial<MedicalExamGetManyFormData>;
  }, [baseQueryFilters]);

  // Handle filter changes
  const handleFilterChange = useCallback(
    (newFilters: Partial<MedicalExamGetManyFormData>) => {
      const { orderBy: _, ...filtersWithoutOrderBy } = newFilters as any;
      setFilters(filtersWithoutOrderBy);
    },
    [setFilters],
  );

  // Handle filter removal
  const baseOnRemoveFilter = createFilterRemover(filters, handleFilterChange);

  const onRemoveFilter = useCallback(
    (key: string, value?: any) => {
      if (key === "searchingFor") {
        setSearch("");
      } else {
        baseOnRemoveFilter(key, value);
      }
    },
    [baseOnRemoveFilter, setSearch],
  );

  // Extract active filters for display
  const activeFilters = useMemo(() => {
    const filtersWithSearch = {
      ...filters,
      searchingFor: searchingFor || undefined,
    };

    return extractActiveFilters(filtersWithSearch, onRemoveFilter, {
      users: filterUsersData?.data || [],
    });
  }, [filters, searchingFor, filterUsersData?.data, onRemoveFilter]);

  // Count active filters for the button
  const activeFilterCount = useMemo(() => {
    return Object.entries(filters).filter(([key, value]) => {
      if (key === "page" || key === "limit" || key === "itemsPerPage" || key === "orderBy" || key === "sortOrder") return false;
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === "object" && value !== null) return Object.keys(value).length > 0;
      return value !== undefined && value !== null && value !== "";
    }).length;
  }, [filters]);

  // Action handlers
  const handleComplete = useCallback((exam: MedicalExam) => {
    setCompleteExam(exam);
  }, []);

  const handleCancel = useCallback((exam: MedicalExam) => {
    setCancelDialog(exam);
  }, []);

  const handleDelete = useCallback((exams: MedicalExam[]) => {
    setDeleteDialog({ items: exams, isBulk: exams.length > 1 });
  }, []);

  const confirmCancel = async () => {
    if (!cancelDialog) return;

    try {
      await updateAsync({
        id: cancelDialog.id,
        data: { status: MEDICAL_EXAM_STATUS.CANCELLED },
      });
      setCancelDialog(null);
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== "production") {
        console.error("Error cancelling medical exam:", error);
      }
    }
  };

  const confirmDelete = async () => {
    if (!deleteDialog) return;

    try {
      await batchDeleteAsync({ medicalExamIds: deleteDialog.items.map((exam) => exam.id) });
      setDeleteDialog(null);
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== "production") {
        console.error("Error deleting medical exam(s):", error);
      }
    }
  };

  return (
    <Card className={cn("flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
        {/* Search and controls */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <TableSearchInput
            ref={searchInputRef}
            value={displaySearchText}
            onChange={(value) => setSearch(value)}
            placeholder="Buscar: colaborador, médico, clínica ou observações"
            isPending={displaySearchText !== searchingFor}
          />
          <div className="flex gap-2">
            <ShowSelectedToggle showSelectedOnly={showSelectedOnly} onToggle={toggleShowSelectedOnly} selectionCount={selectionCount} />
            <ColumnVisibilityManager columns={allColumns} visibleColumns={visibleColumns} onVisibilityChange={setVisibleColumns} />
            <Button variant={hasActiveFilters ? "default" : "outline"} size="default" onClick={() => setShowFilterModal(true)}>
              <IconFilter className="h-4 w-4" />
              <span>
                Filtros
                {hasActiveFilters ? ` (${activeFilterCount})` : ""}
              </span>
            </Button>
          </div>
        </div>

        {/* Active Filter Indicators */}
        {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearAll={clearAllFilters} className="px-1 py-1" />}

        {/* Paginated table */}
        <div className="flex-1 min-h-0 overflow-auto">
          <MedicalExamTable
            visibleColumns={visibleColumns}
            onComplete={handleComplete}
            onCancel={handleCancel}
            onDelete={handleDelete}
            filters={queryFilters}
            className="h-full"
          />
        </div>
      </CardContent>

      {/* Filter Modal */}
      <MedicalExamFilters open={showFilterModal} onOpenChange={setShowFilterModal} filters={filters} onFilterChange={handleFilterChange} />

      {/* Complete Dialog */}
      <MedicalExamCompleteDialog exam={completeExam} open={!!completeExam} onOpenChange={(open) => !open && setCompleteExam(null)} />

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={!!cancelDialog} onOpenChange={(open) => !open && setCancelDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar cancelamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar o exame de "{cancelDialog?.user?.name || "colaborador"}"? O exame será marcado como cancelado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel}>Cancelar Exame</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog?.isBulk
                ? `Tem certeza que deseja excluir ${deleteDialog.items.length} exames? Esta ação não pode ser desfeita.`
                : `Tem certeza que deseja excluir o exame de "${deleteDialog?.items[0]?.user?.name || "colaborador"}"? Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
