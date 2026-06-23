import { useState, useCallback, useMemo } from "react";
import { useVacationMutations } from "../../../../hooks/personnel-department/use-vacations";
import { useUsers } from "../../../../hooks/human-resources/use-user";
import type { Vacation } from "../../../../types/vacation";
import type { VacationGetManyFormData } from "../../../../schemas/vacation";
import { VACATION_STATUS } from "../../../../constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { PeriodControl } from "@/components/human-resources/time-clock-entry/period-control";
import { VacationTable } from "./vacation-table";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { GenericColumnVisibilityManager } from "@/components/ui/generic-column-visibility-manager";
import { createVacationColumns, DEFAULT_VACATION_VISIBLE_COLUMNS } from "./vacation-table-columns";
import { cn } from "@/lib/utils";
import { useTableFilters } from "@/hooks/common/use-table-filters";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";
import { startOfMonth, endOfMonth, startOfDay, endOfDay, addMonths, subMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
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

interface VacationListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

/** Sentinel value for the "Todos os colaboradores" entry in the collaborator selector. */
const ALL_USERS = "__all__";

/**
 * Gozo period filter, persisted in the URL via the table filters. `mode: "month"`
 * filters startDate to a calendar month; `mode: "custom"` to an explicit range
 * (lte may be null mid-selection); `mode: "all"` disables the date filter.
 * When the filter is absent entirely we default to the current month for display
 * and querying (see `effectivePeriod`).
 */
type GozoPeriod = { mode: "all" } | { mode: "month"; month: string } | { mode: "custom"; gte: string; lte: string | null };

export function VacationList({ className }: VacationListProps) {
  const { deleteAsync, deleteMutation } = useVacationMutations();

  const [deleteDialog, setDeleteDialog] = useState<Vacation | null>(null);

  const deserializeFilters = useCallback((params: URLSearchParams): Partial<VacationGetManyFormData> => {
    const filters: Partial<VacationGetManyFormData> = {};

    const statuses = params.get("statuses");
    if (statuses) {
      filters.statuses = statuses.split(",");
    }

    const userIds = params.get("userIds");
    if (userIds) {
      filters.userIds = userIds.split(",");
    }

    const concessiveAfter = params.get("concessiveAfter");
    const concessiveBefore = params.get("concessiveBefore");
    if (concessiveAfter || concessiveBefore) {
      filters.where = {
        concessiveEnd: {
          ...(concessiveAfter && { gte: new Date(concessiveAfter) }),
          ...(concessiveBefore && { lte: new Date(concessiveBefore) }),
        },
      };
    }

    const gozoMode = params.get("gozoMode");
    if (gozoMode === "all") {
      (filters as any).gozoPeriod = { mode: "all" };
    } else if (gozoMode === "month") {
      const month = params.get("gozoMonth");
      if (month) (filters as any).gozoPeriod = { mode: "month", month };
    } else if (gozoMode === "custom") {
      const gte = params.get("gozoStart");
      if (gte) (filters as any).gozoPeriod = { mode: "custom", gte, lte: params.get("gozoEnd") };
    }

    return filters;
  }, []);

  const serializeFilters = useCallback((filters: Partial<VacationGetManyFormData>): Record<string, string> => {
    const params: Record<string, string> = {};

    if (filters.statuses?.length) params.statuses = filters.statuses.join(",");
    if (filters.userIds?.length) params.userIds = filters.userIds.join(",");

    const range = (filters.where as any)?.concessiveEnd;
    if (range?.gte) params.concessiveAfter = new Date(range.gte).toISOString();
    if (range?.lte) params.concessiveBefore = new Date(range.lte).toISOString();

    const gozo = (filters as any).gozoPeriod as GozoPeriod | undefined;
    if (gozo) {
      params.gozoMode = gozo.mode;
      if (gozo.mode === "month") params.gozoMonth = gozo.month;
      if (gozo.mode === "custom") {
        params.gozoStart = gozo.gte;
        if (gozo.lte) params.gozoEnd = gozo.lte;
      }
    }

    return params;
  }, []);

  const { filters, setFilters, queryFilters: baseQueryFilters } = useTableFilters<
    VacationGetManyFormData
  >({
    defaultFilters: {
      limit: DEFAULT_PAGE_SIZE,
    },
    searchDebounceMs: 500,
    searchParamName: "search",
    serializeToUrl: serializeFilters,
    deserializeFromUrl: deserializeFilters,
    excludeFromUrl: ["limit", "orderBy"],
  });

  const { visibleColumns, setVisibleColumns } = useColumnVisibility("vacation-list-visible-columns", DEFAULT_VACATION_VISIBLE_COLUMNS);

  const allColumns = useMemo(() => createVacationColumns(), []);

  // ---- Collaborator selector (direct, single-select with "Todos") ----
  const usersQuery = useUsers({ orderBy: { name: "asc" }, take: 100 });
  const usersList = usersQuery.data?.data ?? [];
  const usersLoading = usersQuery.isLoading;

  const userOptions: ComboboxOption[] = useMemo(
    () => [{ value: ALL_USERS, label: "Todos os colaboradores" }, ...usersList.map((u) => ({ value: u.id, label: u.name }))],
    [usersList],
  );

  const selectedUserId = filters.userIds && filters.userIds.length === 1 ? filters.userIds[0] : ALL_USERS;

  const handleUserSelect = useCallback(
    (val: string) => {
      if (!val || val === ALL_USERS) {
        const { userIds: _u, ...rest } = filters as any;
        setFilters(rest);
      } else {
        setFilters({ ...filters, userIds: [val] });
      }
    },
    [filters, setFilters],
  );

  const stepUser = useCallback(
    (delta: number) => {
      if (usersList.length === 0) return;
      const idx = usersList.findIndex((u) => u.id === selectedUserId);
      const next = idx === -1 ? (delta > 0 ? 0 : usersList.length - 1) : (idx + delta + usersList.length) % usersList.length;
      handleUserSelect(usersList[next].id);
    },
    [usersList, selectedUserId, handleUserSelect],
  );

  // ---- Gozo period selector (defaults to current month, clearable to "Todos") ----
  const gozoPeriod = (filters as any).gozoPeriod as GozoPeriod | undefined;
  const effectivePeriod: GozoPeriod = gozoPeriod ?? { mode: "month", month: startOfMonth(new Date()).toISOString() };

  const setGozoPeriod = useCallback(
    (gp: GozoPeriod) => {
      setFilters({ ...filters, gozoPeriod: gp } as any);
    },
    [filters, setFilters],
  );

  // The actual startDate range applied to the query (undefined = no date filter).
  // A custom range with no end yet (mid-selection) does not filter.
  const gozoRange = useMemo<{ gte: Date; lte: Date } | undefined>(() => {
    if (effectivePeriod.mode === "all") return undefined;
    if (effectivePeriod.mode === "month") {
      const m = new Date(effectivePeriod.month);
      return { gte: startOfMonth(m), lte: endOfMonth(m) };
    }
    if (!effectivePeriod.lte) return undefined;
    return { gte: new Date(effectivePeriod.gte), lte: new Date(effectivePeriod.lte) };
  }, [effectivePeriod.mode, (effectivePeriod as any).month, (effectivePeriod as any).gte, (effectivePeriod as any).lte]);

  // Raw bounds for the calendar's selected range (keeps mid-selection visible).
  const { calendarStart, calendarEnd } = useMemo(() => {
    if (effectivePeriod.mode === "month") {
      const m = new Date(effectivePeriod.month);
      return { calendarStart: startOfMonth(m), calendarEnd: endOfMonth(m) as Date | undefined };
    }
    if (effectivePeriod.mode === "custom") {
      return { calendarStart: new Date(effectivePeriod.gte), calendarEnd: effectivePeriod.lte ? new Date(effectivePeriod.lte) : undefined };
    }
    return { calendarStart: undefined as Date | undefined, calendarEnd: undefined as Date | undefined };
  }, [effectivePeriod.mode, (effectivePeriod as any).month, (effectivePeriod as any).gte, (effectivePeriod as any).lte]);

  const { periodTitle, periodSubtitle } = useMemo(() => {
    if (effectivePeriod.mode === "all") return { periodTitle: "Todos os períodos", periodSubtitle: undefined as string | undefined };
    if (effectivePeriod.mode === "month") {
      const m = new Date(effectivePeriod.month);
      return {
        periodTitle: format(m, "MMMM yyyy", { locale: ptBR }),
        periodSubtitle: `${format(startOfMonth(m), "dd/MM")} a ${format(endOfMonth(m), "dd/MM/yyyy")}`,
      };
    }
    const s = new Date(effectivePeriod.gte);
    return {
      periodTitle: "Período personalizado",
      periodSubtitle: `${format(s, "dd/MM/yyyy")} a ${effectivePeriod.lte ? format(new Date(effectivePeriod.lte), "dd/MM/yyyy") : "—"}`,
    };
  }, [effectivePeriod.mode, (effectivePeriod as any).month, (effectivePeriod as any).gte, (effectivePeriod as any).lte]);

  const periodBaseMonth = useMemo(() => {
    if (effectivePeriod.mode === "month") return new Date(effectivePeriod.month);
    if (gozoRange) return startOfMonth(gozoRange.gte);
    return startOfMonth(new Date());
  }, [effectivePeriod.mode, (effectivePeriod as any).month, gozoRange]);

  const handlePrevPeriod = useCallback(() => setGozoPeriod({ mode: "month", month: startOfMonth(subMonths(periodBaseMonth, 1)).toISOString() }), [periodBaseMonth, setGozoPeriod]);
  const handleNextPeriod = useCallback(() => setGozoPeriod({ mode: "month", month: startOfMonth(addMonths(periodBaseMonth, 1)).toISOString() }), [periodBaseMonth, setGozoPeriod]);

  const handlePeriodRangeChange = useCallback(
    (start: Date | null, end: Date | null) => {
      if (!start) return;
      setGozoPeriod({ mode: "custom", gte: startOfDay(start).toISOString(), lte: end ? endOfDay(end).toISOString() : null });
    },
    [setGozoPeriod],
  );

  const handleClearPeriod = useCallback(() => setGozoPeriod({ mode: "all" }), [setGozoPeriod]);

  // ---- Query filters: inject the gozo startDate range, strip local-only key ----
  const queryFilters = useMemo(() => {
    const { orderBy: _o, gozoPeriod: _g, ...rest } = baseQueryFilters as any;
    const where = { ...((rest.where as any) || {}) };
    if (gozoRange) {
      where.startDate = { gte: gozoRange.gte, lte: gozoRange.lte };
    } else {
      delete where.startDate;
    }
    return {
      ...rest,
      where: Object.keys(where).length > 0 ? where : undefined,
      limit: DEFAULT_PAGE_SIZE,
    } as Partial<VacationGetManyFormData>;
  }, [baseQueryFilters, gozoRange]);

  const confirmDelete = async () => {
    if (!deleteDialog) return;
    try {
      await deleteAsync(deleteDialog.id);
      setDeleteDialog(null);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error deleting vacation:", error);
      }
    }
  };

  return (
    <Card className={cn("flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2">
          {/* Direct collaborator selector with prev/next navigation */}
          <div className="flex gap-1 shrink-0">
            <Button type="button" variant="default" size="icon" onClick={() => stepUser(-1)} disabled={usersList.length === 0} className="h-10 w-10">
              <IconChevronLeft className="h-4 w-4" />
            </Button>
            <Combobox
              options={userOptions}
              value={selectedUserId}
              onValueChange={(value) => handleUserSelect(Array.isArray(value) ? value[0] || ALL_USERS : value || ALL_USERS)}
              placeholder={usersLoading ? "Carregando..." : "Selecione um colaborador"}
              emptyText="Nenhum colaborador encontrado"
              searchable={true}
              className="w-96"
              disabled={usersLoading}
            />
            <Button type="button" variant="default" size="icon" onClick={() => stepUser(1)} disabled={usersList.length === 0} className="h-10 w-10">
              <IconChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Period + columns */}
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <PeriodControl
              variant="range"
              title={periodTitle}
              subtitle={periodSubtitle}
              startDate={calendarStart}
              endDate={calendarEnd}
              onRangeChange={handlePeriodRangeChange}
              onPrev={handlePrevPeriod}
              onNext={handleNextPeriod}
              onClear={effectivePeriod.mode === "all" ? undefined : handleClearPeriod}
              clearLabel="Todos os períodos"
            />
            <GenericColumnVisibilityManager
              columns={allColumns.map((col) => ({ key: col.key, header: col.header }))}
              visibleColumns={visibleColumns}
              onVisibilityChange={setVisibleColumns}
              getDefaultVisibleColumns={() => DEFAULT_VACATION_VISIBLE_COLUMNS}
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          <VacationTable visibleColumns={visibleColumns} onDelete={setDeleteDialog} filters={queryFilters} className="h-full" />
        </div>
      </CardContent>

      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o registro de férias{deleteDialog?.user?.name ? ` de "${deleteDialog.user.name}"` : ""}? Esta ação não pode ser desfeita.
              {deleteDialog?.status === VACATION_STATUS.PAID && (
                <span className="block mt-2 font-medium text-destructive">Atenção: estas férias já foram pagas.</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleteMutation.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
