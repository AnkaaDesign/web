import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { IconCalculator, IconExternalLink, IconPlus, IconSettings, IconTrash } from "@tabler/icons-react";
import { DataTablePage } from "@/components/ui/datatable";
import type {
  DataTableFilterDef,
  DataTableFilterValues,
  DataTableRowAction,
  DataTableRowClickMeta,
} from "@/components/ui/datatable";
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
import { usePaintingAnalyses, usePaintingAnalysisMutations } from "../../../../hooks";
import { getPaintingAnalyses } from "@/api-client";
import type { PaintingAnalysis, PaintingAnalysisStatus } from "../../../../types";
import { PAINTING_ANALYSIS_STATUS_LABELS } from "../../../../types";
import { routes, FAVORITE_PAGES, SECTOR_PRIVILEGES } from "../../../../constants";
import { createPaintingBudgetColumns } from "./painting-budget-table-columns";

const DEFAULT_PAGE_SIZE = 40;
const EMPTY_PARAMS: { search: string; filters: DataTableFilterValues } = { search: "", filters: {} };

const SORT_FIELD_MAP: Record<string, (dir: "asc" | "desc") => Record<string, unknown>> = {
  name: (d) => ({ name: d }),
  status: (d) => ({ status: d }),
  createdAt: (d) => ({ createdAt: d }),
};

function buildOrderBy(sorting: { id: string; desc: boolean }[]): Record<string, unknown> {
  for (const sort of sorting) {
    const build = SORT_FIELD_MAP[sort.id];
    if (build) return build(sort.desc ? "desc" : "asc");
  }
  return { createdAt: "desc" };
}

function buildQuery(filters: DataTableFilterValues, search: string): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  if (typeof filters.status === "string" && filters.status) query.status = filters.status;
  if (search) query.searchingFor = search;
  return query;
}

export function PaintingBudgetTablePage() {
  const navigate = useNavigate();
  const { remove: deleteAsync } = usePaintingAnalysisMutations();
  const [deleteTarget, setDeleteTarget] = useState<PaintingAnalysis | null>(null);

  const [searchParams] = useSearchParams();
  const [params, setParams] = useState(EMPTY_PARAMS);
  const paramsKey = useRef("");
  const onParamsChange = useCallback((next: { search: string; filters: DataTableFilterValues }) => {
    const key = JSON.stringify(next);
    if (key === paramsKey.current) return;
    paramsKey.current = key;
    setParams(next);
  }, []);

  const pageRaw = Number(searchParams.get("page") ?? "1");
  const page = Number.isFinite(pageRaw) ? Math.max(1, pageRaw) : 1;
  const pageSizeRaw = Number(searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE));
  const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : DEFAULT_PAGE_SIZE;
  const sortParam = searchParams.get("sort");
  const sorting = useMemo<{ id: string; desc: boolean }[]>(() => {
    if (!sortParam) return [];
    try {
      const parsed = JSON.parse(sortParam);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [sortParam]);

  const query = useMemo(
    () => ({
      ...buildQuery(params.filters, params.search),
      page,
      limit: pageSize,
      orderBy: buildOrderBy(sorting),
    }),
    [params, page, pageSize, sorting],
  );

  const { data: response, isLoading, error } = usePaintingAnalyses(query as never);
  const analyses = useMemo(() => response?.data ?? [], [response]);
  const totalRecords = response?.meta?.totalRecords ?? 0;

  const fetchAllForExport = useCallback(async (): Promise<PaintingAnalysis[]> => {
    const PAGE_SIZE = 100;
    const base = { ...buildQuery(params.filters, params.search), orderBy: buildOrderBy(sorting) };
    const all: PaintingAnalysis[] = [];
    for (let p = 1; ; p++) {
      const res = await getPaintingAnalyses({ ...base, page: p, limit: PAGE_SIZE } as never);
      const rows = res?.data ?? [];
      all.push(...rows);
      if (res?.meta?.hasNextPage === false || rows.length < PAGE_SIZE) break;
      if (totalRecords > 0 && all.length >= totalRecords) break;
    }
    return all;
  }, [params, sorting, totalRecords]);

  const columns = useMemo(() => createPaintingBudgetColumns(), []);

  const filterDefs = useMemo<DataTableFilterDef<PaintingAnalysis>[]>(
    () => [
      {
        key: "status",
        label: "Status",
        type: "select",
        options: (Object.keys(PAINTING_ANALYSIS_STATUS_LABELS) as PaintingAnalysisStatus[]).map((status) => ({
          value: status,
          label: PAINTING_ANALYSIS_STATUS_LABELS[status],
        })),
      },
    ],
    [],
  );

  const rowActions = useMemo<DataTableRowAction<PaintingAnalysis>[]>(
    () => [
      {
        key: "open-new-tab",
        label: "Abrir em nova guia",
        icon: <IconExternalLink className="h-4 w-4" />,
        hidden: (rows) => rows.length !== 1,
        onClick: (rows) => rows[0] && window.open(routes.administration.paintingBudget.details(rows[0].id), "_blank"),
      },
      {
        key: "delete",
        label: "Excluir",
        icon: <IconTrash className="h-4 w-4" />,
        variant: "destructive",
        separatorBefore: true,
        requiredPrivilege: [SECTOR_PRIVILEGES.ADMIN],
        hidden: (rows) => rows.length !== 1,
        onClick: (rows) => rows[0] && setDeleteTarget(rows[0]),
      },
    ],
    [],
  );

  const onRowClick = useCallback(
    (row: PaintingAnalysis, meta: DataTableRowClickMeta) => {
      navigate(routes.administration.paintingBudget.details(row.id), {
        state: { ids: meta.orderedIds },
      });
    },
    [navigate],
  );

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteAsync(deleteTarget.id);
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleteAsync]);

  return (
    <div className="flex h-full flex-col">
      {error ? (
        <div className="mx-4 mt-4 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Erro ao carregar os orçamentos de pintura. Tente novamente.
        </div>
      ) : null}
      <div className="min-h-0 flex-1">
        <DataTablePage<PaintingAnalysis>
          title="Orçamento de Pintura"
          icon={IconCalculator}
          favoritePage={FAVORITE_PAGES.ADMINISTRACAO_ORCAMENTO_PINTURA_LISTAR}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Administração" },
            { label: "Orçamento de Pintura" },
          ]}
          actions={[
            {
              key: "config",
              label: "Configurações",
              icon: IconSettings,
              onClick: () => navigate(routes.administration.paintingBudget.config),
              variant: "outline",
            },
            {
              key: "create",
              label: "Novo Orçamento",
              icon: IconPlus,
              onClick: () => navigate(routes.administration.paintingBudget.create),
              variant: "default",
            },
          ]}
          table={{
            tableId: "painting-budget-list",
            data: analyses,
            columns,
            filterDefs,
            rowActions,
            getRowId: (analysis) => analysis.id,
            onRowClick,
            isLoading,
            mode: "server",
            rowCount: totalRecords,
            onParamsChange,
            onExportFetchAll: fetchAllForExport,
            defaultSorting: [{ id: "createdAt", desc: true }],
            defaultPageSize: DEFAULT_PAGE_SIZE,
            estimateRowHeight: 44,
            searchPlaceholder: "Buscar por nome...",
            emptyMessage: "Nenhum orçamento de pintura encontrado. Crie um novo para analisar uma arte.",
            exportTitle: "Orçamentos de Pintura",
            exportFilename: "orcamentos-de-pintura",
          }}
        />
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir orçamento de pintura</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{deleteTarget?.name}"? A análise, o plano de produção e o
              orçamento serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
