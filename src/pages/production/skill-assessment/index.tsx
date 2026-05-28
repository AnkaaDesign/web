// pages/production/skill-assessment/index.tsx
//
// Leader landing page: a table of campaigns the current user has at least
// one AssessmentEntry in (as evaluator). Sorted with OPEN campaigns first,
// then most-recently created. Clicking a row navigates to the per-campaign
// topic-paged page where the leader scores every evaluatee for each topic.

import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  IconChevronDown,
  IconChevronUp,
  IconClipboardList,
  IconRefresh,
  IconSelector,
} from "@tabler/icons-react";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";

import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useAssessmentEntries } from "@/hooks/skill/use-assessment-entry";
import { useAssessments } from "@/hooks/skill/use-assessment";
import { useTableState } from "@/hooks/common/use-table-state";
import { useScrollbarWidth } from "@/hooks/common/use-scrollbar-width";
import { ASSESSMENT_ENTRY_STATUS, routes } from "@/constants";
import type { Assessment, AssessmentEntry } from "@/types";
import { AssessmentStatusBadge } from "@/components/production/skill-assessment/assessment-status-badge";
import { cn } from "@/lib/utils";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { SkillAssessmentListSkeleton } from "@/components/administration/skill-assessment/list/skill-assessment-list-skeleton";

const formatDate = (value?: Date | string | null) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

interface CampaignSummary {
  assessment: Assessment;
  entries: AssessmentEntry[];
  pending: number;
  inProgress: number;
  submitted: number;
  /** Entries whose responses cover every topic in the campaign. */
  fullyScored: number;
}

const COLUMNS = [
  { key: "name", header: "Campanha", sortable: true, className: "min-w-[220px]" },
  { key: "periodStart", header: "Inicia em", sortable: true, className: "min-w-[140px]" },
  { key: "periodEnd", header: "Termina em", sortable: true, className: "min-w-[140px]" },
  { key: "status", header: "Status", sortable: true, className: "min-w-[120px]" },
  { key: "myEntries", header: "Minhas avaliações", sortable: false, className: "min-w-[200px]" },
] as const;

export const SkillAssessmentLeaderPage = () => {
  const navigate = useNavigate();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");

  usePageTracker({ title: "Avaliações de Competências", icon: "clipboard-list" });

  const {
    page,
    pageSize,
    sortConfigs,
    setPage,
    setPageSize,
    toggleSort,
    getSortDirection,
    getSortOrder,
  } = useTableState({
    defaultPageSize: 40,
    defaultSort: [{ column: "status", direction: "asc" }],
    useUrlForSort: false,
  });

  const {
    data: queueResp,
    isLoading: isLoadingQueue,
    isFetching: isFetchingQueue,
    refetch,
  } = useAssessmentEntries({
    evaluatorId: "me",
    include: {
      assessment: true,
      evaluatee: { include: { position: true, sector: true } },
      _count: { select: { responses: true } },
    },
    limit: 200,
  });

  const entries: AssessmentEntry[] = queueResp?.data ?? [];

  const assessmentIds = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) set.add(e.assessmentId);
    return Array.from(set);
  }, [entries]);

  const { data: assessmentsResp, isLoading: isLoadingAssessments } = useAssessments(
    assessmentIds.length > 0
      ? {
          where: { id: { in: assessmentIds } },
          include: { _count: { select: { topics: true, entries: true } } },
          limit: 100,
        }
      : undefined,
    { enabled: assessmentIds.length > 0 },
  );

  const summaries = useMemo<CampaignSummary[]>(() => {
    const byId = new Map<string, Assessment>();
    for (const a of assessmentsResp?.data ?? []) byId.set(a.id, a);

    const groups = new Map<string, CampaignSummary>();
    for (const e of entries) {
      const assessment = byId.get(e.assessmentId) ?? e.assessment;
      if (!assessment) continue;
      let s = groups.get(e.assessmentId);
      if (!s) {
        s = {
          assessment,
          entries: [],
          pending: 0,
          inProgress: 0,
          submitted: 0,
          fullyScored: 0,
        };
        groups.set(e.assessmentId, s);
      }
      s.entries.push(e);
      if (e.status === ASSESSMENT_ENTRY_STATUS.SUBMITTED) s.submitted += 1;
      else if (e.status === ASSESSMENT_ENTRY_STATUS.IN_PROGRESS) s.inProgress += 1;
      else s.pending += 1;

      const topicsTotal = s.assessment._count?.topics;
      const responsesCount = (e as any)._count?.responses ?? 0;
      if (topicsTotal && responsesCount >= topicsTotal) s.fullyScored += 1;
    }

    return Array.from(groups.values());
  }, [entries, assessmentsResp]);

  const filteredSummaries = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return summaries;
    return summaries.filter((s) => {
      const name = s.assessment.name?.toLowerCase() ?? "";
      const desc = s.assessment.description?.toLowerCase() ?? "";
      return name.includes(term) || desc.includes(term);
    });
  }, [summaries, search]);

  const sortedSummaries = useMemo(() => {
    const configs = sortConfigs.length > 0
      ? sortConfigs
      : [{ column: "status", direction: "asc" as const }];

    const compare = (a: CampaignSummary, b: CampaignSummary): number => {
      for (const { column, direction } of configs) {
        const mult = direction === "asc" ? 1 : -1;
        let diff = 0;
        switch (column) {
          case "name":
            diff = (a.assessment.name ?? "").localeCompare(b.assessment.name ?? "", "pt-BR");
            break;
          case "periodStart": {
            const av = a.assessment.periodStart ? new Date(a.assessment.periodStart).getTime() : 0;
            const bv = b.assessment.periodStart ? new Date(b.assessment.periodStart).getTime() : 0;
            diff = av - bv;
            break;
          }
          case "periodEnd": {
            const av = a.assessment.periodEnd ? new Date(a.assessment.periodEnd).getTime() : 0;
            const bv = b.assessment.periodEnd ? new Date(b.assessment.periodEnd).getTime() : 0;
            diff = av - bv;
            break;
          }
          case "status": {
            // OPEN first, then DRAFT, then CLOSED, then CANCELLED
            const order: Record<string, number> = { OPEN: 0, DRAFT: 1, CLOSED: 2, CANCELLED: 3 };
            const av = order[a.assessment.status] ?? 99;
            const bv = order[b.assessment.status] ?? 99;
            diff = av - bv;
            break;
          }
          default:
            diff = 0;
        }
        if (diff !== 0) return diff * mult;
      }
      // Tiebreaker: most-recently created first
      const ca = a.assessment.createdAt ? new Date(a.assessment.createdAt).getTime() : 0;
      const cb = b.assessment.createdAt ? new Date(b.assessment.createdAt).getTime() : 0;
      return cb - ca;
    };

    return [...filteredSummaries].sort(compare);
  }, [filteredSummaries, sortConfigs]);

  const totalRecords = sortedSummaries.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const pagedSummaries = useMemo(
    () => sortedSummaries.slice(page * pageSize, page * pageSize + pageSize),
    [sortedSummaries, page, pageSize],
  );

  const { width: scrollbarWidth, isOverlay } = useScrollbarWidth();

  const isLoading = isLoadingQueue || isLoadingAssessments;

  const renderSortIndicator = (columnKey: string) => {
    const dir = getSortDirection(columnKey);
    const order = getSortOrder(columnKey);
    return (
      <div className="inline-flex items-center ml-1">
        {dir === null && <IconSelector className="h-4 w-4 text-muted-foreground" />}
        {dir === "asc" && <IconChevronUp className="h-4 w-4 text-foreground" />}
        {dir === "desc" && <IconChevronDown className="h-4 w-4 text-foreground" />}
        {order !== null && sortConfigs.length > 1 && (
          <span className="text-xs ml-0.5">{order + 1}</span>
        )}
      </div>
    );
  };

  return (
    <PrivilegeRoute
      requiredPrivilege={[
        "PRODUCTION",
        "PRODUCTION_MANAGER",
        "ADMIN",
        "HUMAN_RESOURCES",
      ]}
    >
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Avaliações de Competências"
          icon={IconClipboardList}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Minha Equipe", href: routes.myTeam.root },
            { label: "Avaliações de Competências" },
          ]}
          actions={[
            {
              key: "refresh",
              label: "Atualizar",
              icon: IconRefresh,
              variant: "outline",
              onClick: () => refetch(),
              loading: isFetchingQueue && !isLoading,
            },
          ]}
          className="flex-shrink-0"
        />

        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <Card className="flex flex-col shadow-sm border border-border h-full">
            <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
              <div className="flex flex-col sm:flex-row gap-3">
                <TableSearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Buscar avaliações..."
                />
              </div>

              <div className="flex-1 min-h-0 overflow-auto">
                {isLoading ? (
                  <SkillAssessmentListSkeleton />
                ) : (
                  <div className="rounded-lg flex flex-col overflow-hidden h-full">
                    <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
                      <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
                        <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
                          <TableRow className="bg-muted hover:bg-muted even:bg-muted">
                            {COLUMNS.map((column) => (
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
                                    className="flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent"
                                    disabled={pagedSummaries.length === 0}
                                  >
                                    <span className="truncate">{column.header}</span>
                                    {renderSortIndicator(column.key)}
                                  </button>
                                ) : (
                                  <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
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
                          {pagedSummaries.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={COLUMNS.length} className="p-0">
                                <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                                  <IconClipboardList className="h-12 w-12 text-muted-foreground/50 mb-4" />
                                  <div className="text-lg font-medium mb-2">
                                    Nenhuma avaliação encontrada
                                  </div>
                                  {search ? (
                                    <div className="text-sm">
                                      Ajuste a busca para ver mais resultados.
                                    </div>
                                  ) : (
                                    <div className="text-sm">
                                      Quando uma nova campanha for aberta, ela aparecerá aqui.
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : (
                            pagedSummaries.map((s, index) => {
                              const a = s.assessment;
                              const total = s.entries.length;
                              const done = s.fullyScored || s.submitted;
                              return (
                                <TableRow
                                  key={a.id}
                                  className={cn(
                                    "cursor-pointer transition-colors border-b border-border",
                                    index % 2 === 1 && "bg-muted/10",
                                    "hover:bg-muted/20",
                                  )}
                                  onClick={() =>
                                    navigate(routes.skillAssessmentLeader.campaign(a.id))
                                  }
                                >
                                  <TableCell className={cn("p-0 !border-r-0", COLUMNS[0].className)}>
                                    <div className="px-4 py-2 text-sm">
                                      <div className="flex flex-col">
                                        <span className="font-medium leading-tight">{a.name}</span>
                                        {a.description && (
                                          <span className="line-clamp-1 text-xs text-muted-foreground">
                                            {a.description}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className={cn("p-0 !border-r-0", COLUMNS[1].className)}>
                                    <div className="px-4 py-2 text-sm text-muted-foreground">
                                      {formatDate(a.periodStart)}
                                    </div>
                                  </TableCell>
                                  <TableCell className={cn("p-0 !border-r-0", COLUMNS[2].className)}>
                                    <div className="px-4 py-2 text-sm text-muted-foreground">
                                      {formatDate(a.periodEnd)}
                                    </div>
                                  </TableCell>
                                  <TableCell className={cn("p-0 !border-r-0", COLUMNS[3].className)}>
                                    <div className="px-4 py-2 text-sm">
                                      <AssessmentStatusBadge
                                        status={a.status}
                                        className="text-[10px]"
                                      />
                                    </div>
                                  </TableCell>
                                  <TableCell className={cn("p-0 !border-r-0", COLUMNS[4].className)}>
                                    <div className="px-4 py-2">
                                      <div className="flex items-center gap-2">
                                        <Progress
                                          value={total > 0 ? Math.round((done / total) * 100) : 0}
                                          className="h-2"
                                        />
                                        <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                                          {done}/{total}
                                        </span>
                                      </div>
                                    </div>
                                  </TableCell>
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
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default SkillAssessmentLeaderPage;
