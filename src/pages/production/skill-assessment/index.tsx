// pages/production/skill-assessment/index.tsx
//
// Leader landing page: a table of campaigns the current user has at least
// one AssessmentEntry in (as evaluator). Sorted with OPEN campaigns first,
// then most-recently created. Clicking a row navigates to the per-campaign
// topic-paged page where the leader scores every evaluatee for each topic.

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  IconCalendar,
  IconChevronRight,
  IconClipboardCheck,
  IconClipboardList,
  IconRefresh,
} from "@tabler/icons-react";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useAssessmentEntries } from "@/hooks/skill/use-assessment-entry";
import { useAssessments } from "@/hooks/skill/use-assessment";
import { ASSESSMENT_ENTRY_STATUS, routes } from "@/constants";
import type { Assessment, AssessmentEntry } from "@/types";

const formatDateRange = (start?: Date | string | null, end?: Date | string | null) => {
  if (!start || !end) return "";
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${fmt(s)} – ${fmt(e)}`;
};

interface CampaignSummary {
  assessment: Assessment | undefined;
  entries: AssessmentEntry[];
  pending: number;
  inProgress: number;
  submitted: number;
}

export const SkillAssessmentLeaderPage = () => {
  const navigate = useNavigate();
  usePageTracker({ title: "Avaliações de Competências", icon: "clipboard-list" });

  // Pull EVERY entry the leader has across ALL statuses so submitted-only
  // campaigns still show up. Server scopes to evaluatorId=me for non-admin
  // roles, so no client-side filtering is needed.
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

  // Distinct assessment ids referenced by the queue. We need extra metadata
  // (status, topic count, total entries) from /assessment.
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
      let s = groups.get(e.assessmentId);
      if (!s) {
        s = {
          assessment: byId.get(e.assessmentId) ?? e.assessment,
          entries: [],
          pending: 0,
          inProgress: 0,
          submitted: 0,
        };
        groups.set(e.assessmentId, s);
      }
      s.entries.push(e);
      if (e.status === ASSESSMENT_ENTRY_STATUS.SUBMITTED) s.submitted += 1;
      else if (e.status === ASSESSMENT_ENTRY_STATUS.IN_PROGRESS) s.inProgress += 1;
      else s.pending += 1;
    }

    // Sort: OPEN campaigns first, then by createdAt desc as a stable proxy
    // for "opened most recently" (we don't expose an explicit openedAt yet).
    return Array.from(groups.values()).sort((a, b) => {
      const sa = a.assessment?.status === "OPEN" ? 0 : 1;
      const sb = b.assessment?.status === "OPEN" ? 0 : 1;
      if (sa !== sb) return sa - sb;
      const ca = a.assessment?.createdAt
        ? new Date(a.assessment.createdAt).getTime()
        : 0;
      const cb = b.assessment?.createdAt
        ? new Date(b.assessment.createdAt).getTime()
        : 0;
      return cb - ca;
    });
  }, [entries, assessmentsResp]);

  const isLoading = isLoadingQueue || isLoadingAssessments;
  const isEmpty = !isLoading && summaries.length === 0;

  return (
    <PrivilegeRoute
      requiredPrivilege={[
        "PRODUCTION",
        "PRODUCTION_MANAGER",
        "ADMIN",
        "HUMAN_RESOURCES",
      ]}
    >
      <div className="flex flex-col gap-4 bg-background px-4 pt-4 pb-6">
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
        />

        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-md" />
            ))}
          </div>
        ) : isEmpty ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="rounded-full bg-emerald-100 p-3 dark:bg-emerald-950/40">
                <IconClipboardCheck className="h-7 w-7 text-emerald-600" />
              </div>
              <h2 className="text-lg font-semibold">Nenhuma avaliação pendente</h2>
              <p className="max-w-md text-sm text-muted-foreground">
                Você está em dia com as avaliações de competências do seu setor.
                Quando uma nova campanha for aberta, ela aparecerá aqui.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campanha</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Minhas avaliações</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaries.map((s) => {
                  const a = s.assessment;
                  if (!a) return null;
                  const total = s.entries.length;
                  const done = s.submitted;
                  return (
                    <TableRow
                      key={a.id}
                      className="cursor-pointer"
                      onClick={() => navigate(routes.skillAssessmentLeader.campaign(a.id))}
                    >
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium leading-tight">{a.name}</span>
                          {a.description && (
                            <span className="line-clamp-1 text-xs text-muted-foreground">
                              {a.description}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <IconCalendar className="h-3.5 w-3.5" />
                          {formatDateRange(a.periodStart, a.periodEnd)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={a.status === "OPEN" ? "default" : "outline"}
                          className="text-[10px]"
                        >
                          {a.status === "OPEN" ? "Aberta" : a.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="tabular-nums font-medium">
                            {done}/{total}
                          </span>
                          {s.pending > 0 && (
                            <Badge variant="outline" className="text-[10px]">
                              {s.pending} pendente
                            </Badge>
                          )}
                          {s.inProgress > 0 && (
                            <Badge variant="secondary" className="text-[10px]">
                              {s.inProgress} em progresso
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <IconChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </PrivilegeRoute>
  );
};

export default SkillAssessmentLeaderPage;
