// pages/administration/skill-assessment/entry/[entryId].tsx
//
// Admin-side detail view for ONE AssessmentEntry. Shows the avaliado +
// avaliador metadata, summary stats, and the full per-topic response list
// (score + justification) grouped by Competência. Admins can reopen a
// SUBMITTED entry from here.

import { useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import {
  IconBriefcase,
  IconBuilding,
  IconCalendar,
  IconCalendarPlus,
  IconCalendarTime,
  IconClipboardList,
  IconHash,
  IconInfoCircle,
  IconLoader2,
  IconLockOpen,
  IconRefresh,
  IconUser,
  IconUserShield,
} from "@tabler/icons-react";

import {
  routes,
  SECTOR_PRIVILEGES,
  ASSESSMENT_ENTRY_STATUS,
} from "../../../../constants";
import { formatDate, formatDateTime } from "../../../../utils";
import {
  useAssessment,
  useAssessmentEntry,
  useReopenAssessmentEntry,
} from "../../../../hooks";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DetailRow } from "@/components/ui/detail-row";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { ScoreBadge } from "@/components/production/skill-assessment/score-badge";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { cn } from "@/lib/utils";
import { AssessmentEntryStatusBadge } from "@/components/production/skill-assessment/assessment-entry-status-badge";

export const SkillAssessmentEntryDetailsPage = () => {
  usePageTracker({ title: "Detalhe da Avaliação", icon: "clipboard-list" });
  const { id, entryId } = useParams<{ id: string; entryId: string }>();
  const [isReopenOpen, setIsReopenOpen] = useState(false);

  const {
    data: entryResp,
    isLoading: isLoadingEntry,
    isRefetching,
    refetch,
    error: entryError,
  } = useAssessmentEntry(entryId, {
    include: {
      assessment: true,
      evaluatee: { include: { position: true, sector: true } },
      evaluator: true,
      responses: true,
    } as any,
  });

  // The assessment's own topic catalogue — we need it to surface topics the
  // leader hasn't yet scored ("Sem resposta") and to drive the canonical
  // skill order.
  const { data: assessmentResp, isLoading: isLoadingAssessment } = useAssessment(
    id ?? "",
    {
      include: {
        topics: { include: { topic: { include: { skill: true, levels: true } } } },
      } as any,
    } as any,
  );

  const reopenMut = useReopenAssessmentEntry(entryId ?? "");

  const entry = entryResp?.data;
  const assessment = assessmentResp?.data;

  // Build a unified list keyed by topicId: every topic in the assessment,
  // with the matching response (if any), then group by skill in canonical
  // order.
  const responsesByTopic = useMemo(() => {
    const map = new Map<string, any>();
    for (const r of (entry?.responses ?? []) as any[]) {
      if (r.topicId) map.set(r.topicId, r);
    }
    return map;
  }, [entry?.responses]);

  const grouped = useMemo(() => {
    const join = (assessment?.topics ?? []) as any[];
    const sorted = [...join].sort((a, b) => {
      const sa = a.topic?.skill?.order ?? Number.MAX_SAFE_INTEGER;
      const sb = b.topic?.skill?.order ?? Number.MAX_SAFE_INTEGER;
      if (sa !== sb) return sa - sb;
      return (a.topic?.order ?? 0) - (b.topic?.order ?? 0);
    });
    const groups = new Map<
      string,
      { skillId: string; skillName: string; items: any[] }
    >();
    for (const at of sorted) {
      const sid = at.topic?.skill?.id ?? "_unknown";
      const sname = at.topic?.skill?.name ?? "Sem competência";
      const g = groups.get(sid);
      const row = {
        topic: at.topic,
        response: responsesByTopic.get(at.topicId) ?? null,
      };
      if (g) g.items.push(row);
      else groups.set(sid, { skillId: sid, skillName: sname, items: [row] });
    }
    // Compute per-skill average (over scored topics only).
    return Array.from(groups.values()).map((g) => {
      const scored = g.items
        .map((it) => it.response?.score)
        .filter((s: any): s is number => typeof s === "number");
      const avg =
        scored.length > 0
          ? scored.reduce((a: number, b: number) => a + b, 0) / scored.length
          : null;
      return { ...g, scoredCount: scored.length, avg };
    });
  }, [assessment?.topics, responsesByTopic]);

  const stats = useMemo(() => {
    let scored = 0;
    let sum = 0;
    let withJustif = 0;
    const total = grouped.reduce((n, g) => n + g.items.length, 0);
    for (const g of grouped) {
      for (const it of g.items) {
        if (it.response?.score != null) {
          scored += 1;
          sum += it.response.score;
          if ((it.response.justification ?? "").trim()) withJustif += 1;
        }
      }
    }
    return {
      scored,
      total,
      avg: scored > 0 ? sum / scored : null,
      withJustif,
    };
  }, [grouped]);

  const isLoading = isLoadingEntry || isLoadingAssessment;

  if (!id || !entryId) {
    return <Navigate to={routes.administration.skillAssessment.root} replace />;
  }
  if (entryError) {
    return <Navigate to={routes.administration.skillAssessment.details(id)} replace />;
  }
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!entry) {
    return <Navigate to={routes.administration.skillAssessment.details(id)} replace />;
  }

  const status = entry.status as ASSESSMENT_ENTRY_STATUS;
  const canReopen = status === ASSESSMENT_ENTRY_STATUS.SUBMITTED;

  const handleReopen = async () => {
    try {
      await reopenMut.mutateAsync();
      // Success/error toasts handled by the axios interceptor.
      setIsReopenOpen(false);
    } catch (err) {
      // Error toast handled by the axios interceptor.
      if (import.meta.env.DEV) console.error(err);
    }
  };

  return (
    <PrivilegeRoute
      requiredPrivilege={[
        SECTOR_PRIVILEGES.ADMIN,
        SECTOR_PRIVILEGES.HUMAN_RESOURCES,
        SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
      ]}
    >
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="detail"
          title={entry.evaluatee?.name ?? "Avaliação"}
          icon={IconClipboardList}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Administração" },
            {
              label: "Avaliação de Competências",
              href: routes.administration.skillAssessment.root,
            },
            {
              label: assessment?.name ?? "Campanha",
              href: routes.administration.skillAssessment.details(id),
            },
            { label: entry.evaluatee?.name ?? "Avaliação" },
          ]}
          actions={[
            {
              key: "refresh",
              label: "Atualizar",
              icon: IconRefresh,
              onClick: () => refetch(),
              loading: isRefetching,
            },
            ...(canReopen
              ? [
                  {
                    key: "reopen",
                    label: "Reabrir",
                    icon: IconLockOpen,
                    variant: "outline" as const,
                    onClick: () => setIsReopenOpen(true),
                    disabled: reopenMut.isPending,
                  },
                ]
              : []),
          ]}
          className="flex-shrink-0"
        />

        <div className="flex-1 overflow-y-auto pb-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <IconInfoCircle className="h-5 w-5 text-muted-foreground" />
                    Informações
                  </CardTitle>
                  <AssessmentEntryStatusBadge
                    status={status}
                    fullyScored={stats.total > 0 && stats.scored >= stats.total}
                  />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <DetailRow
                      icon={IconUser}
                      label="Avaliado"
                      value={<span>{entry.evaluatee?.name ?? "—"}</span>}
                    />
                    {entry.evaluatee?.position?.name && (
                      <DetailRow
                        icon={IconBriefcase}
                        label="Cargo"
                        value={<span>{entry.evaluatee.position.name}</span>}
                      />
                    )}
                    {entry.evaluatee?.sector?.name && (
                      <DetailRow
                        icon={IconBuilding}
                        label="Setor"
                        value={<span>{entry.evaluatee.sector.name}</span>}
                      />
                    )}
                    <DetailRow
                      icon={IconUserShield}
                      label="Avaliador"
                      value={<span>{entry.evaluator?.name ?? "—"}</span>}
                    />
                    {assessment && (
                      <DetailRow
                        icon={IconCalendar}
                        label="Período"
                        value={
                          <span>
                            {formatDate(assessment.periodStart)} –{" "}
                            {formatDate(assessment.periodEnd)}
                          </span>
                        }
                      />
                    )}
                    <DetailRow
                      icon={IconCalendarPlus}
                      label="Criada em"
                      value={
                        <span className="text-sm">
                          {entry.createdAt ? formatDateTime(entry.createdAt) : "—"}
                        </span>
                      }
                    />
                    <DetailRow
                      icon={IconCalendarTime}
                      label="Atualizada em"
                      value={
                        <span className="text-sm">
                          {entry.updatedAt ? formatDateTime(entry.updatedAt) : "—"}
                        </span>
                      }
                    />
                  </div>

                  {grouped.length > 0 && (
                    <>
                      <Separator />
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {grouped.map((g) => (
                          <ScoreSummaryCard
                            key={g.skillId}
                            label={g.skillName}
                            avg={g.avg}
                          />
                        ))}
                        <ScoreSummaryCard label="Nota geral" avg={stats.avg} highlight />
                      </div>
                    </>
                  )}

                  {entry.notes && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Observações do avaliador
                        </div>
                        <p className="text-sm whitespace-pre-wrap text-foreground/90">
                          {entry.notes}
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <IconHash className="h-5 w-5 text-muted-foreground" />
                    Respostas por competência
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {grouped.length === 0 ? (
                    <span className="text-sm text-muted-foreground">
                      Nenhum tópico nesta avaliação.
                    </span>
                  ) : (
                    <>
                    <Accordion
                      type="multiple"
                      defaultValue={grouped[0] ? [grouped[0].skillId] : []}
                      className="w-full"
                    >
                      {grouped.map((group, idx) => {
                        return (
                          <AccordionItem
                            key={group.skillId}
                            value={group.skillId}
                            className={cn(
                              "border-border/40",
                              idx === grouped.length - 1 && "border-b-0",
                            )}
                          >
                            <AccordionTrigger className="py-3 hover:no-underline">
                              <div className="flex flex-1 items-center justify-between gap-3 pr-3">
                                <span className="font-medium">{group.skillName}</span>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {group.scoredCount}/{group.items.length}
                                  </Badge>
                                  {group.avg != null ? (
                                    <ScoreBadge
                                      score={Math.round(group.avg)}
                                      label={group.avg.toFixed(2)}
                                      size="md"
                                    />
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-2">
                                {group.items.map(({ topic, response }) => {
                                  const level = response?.score != null
                                    ? (topic?.levels as any[] | undefined)?.find((l: any) => l.score === response.score)
                                    : undefined;
                                  return (
                                  <div
                                    key={topic?.id}
                                    className="rounded-md border border-border/40 bg-muted/30 px-3 py-2.5 text-sm"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex flex-col gap-1 min-w-0">
                                        <span className="font-medium leading-tight">
                                          {topic?.title ?? "—"}
                                        </span>
                                        {level?.description && (
                                          <p className="text-xs text-muted-foreground/80 leading-snug">
                                            {level.description}
                                          </p>
                                        )}
                                      </div>
                                      {response?.score != null ? (
                                        <div className="flex flex-col items-end gap-0.5 shrink-0">
                                          <ScoreBadge
                                            score={response.score}
                                            size="md"
                                          />
                                          {level?.name && (
                                            <span className="text-[10px] text-muted-foreground font-medium">
                                              {level.name}
                                            </span>
                                          )}
                                        </div>
                                      ) : (
                                        <Badge
                                          variant="outline"
                                          className="text-[10px]"
                                        >
                                          Sem resposta
                                        </Badge>
                                      )}
                                    </div>
                                    {response?.justification && (
                                      <p className="mt-2 whitespace-pre-line text-xs text-muted-foreground">
                                        <span className="font-semibold uppercase tracking-wide">
                                          Justificativa:
                                        </span>{" "}
                                        {response.justification}
                                      </p>
                                    )}
                                  </div>
                                  );
                                })}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>

                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <AlertDialog open={isReopenOpen} onOpenChange={setIsReopenOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <IconLockOpen className="h-5 w-5 text-amber-500" />
                Reabrir avaliação?
              </AlertDialogTitle>
              <AlertDialogDescription>
                A avaliação voltará ao status "Em progresso" e o líder poderá
                ajustar as respostas. O histórico não será apagado.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleReopen}
                disabled={reopenMut.isPending}
              >
                Reabrir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PrivilegeRoute>
  );
};

/**
 * Compact card showing a competência's name with its average score below.
 * Used in the Informações card's Resumo row.
 */
function ScoreSummaryCard({
  label,
  avg,
  highlight,
}: {
  label: string;
  avg: number | null;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2.5 flex flex-col items-center gap-1.5 text-center",
        highlight
          ? "border-primary/40 bg-primary/5"
          : "border-border/40 bg-muted/30",
      )}
    >
      <span
        className={cn(
          "text-xs leading-tight line-clamp-2",
          highlight ? "font-semibold text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
      {avg != null ? (
        <ScoreBadge
          score={Math.round(avg)}
          label={avg.toFixed(2)}
          size={highlight ? "md" : "sm"}
        />
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      )}
    </div>
  );
}

export default SkillAssessmentEntryDetailsPage;
