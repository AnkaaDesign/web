// components/questionnaire/anonymous-results.tsx
//
// Aggregated, identity-free results for an anonymous questionnaire campaign.
// Renders the per-question option distribution as horizontal bars, the average
// score, and the answered count. Absolutely NO respondent names/ids are shown
// here — this view consumes the dedicated GET /questionnaire/:id/results
// endpoint, which omits all identity information by contract.

import { useMemo } from "react";
import { IconChartBar, IconEyeOff, IconLoader2, IconMessage2 } from "@tabler/icons-react";

import { useQuestionnaireResults } from "@/hooks/questionnaire/use-questionnaire";
import type { QuestionnaireResultsQuestion } from "@/types";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreBadge } from "@/components/production/skill-assessment/score-badge";
import { cn } from "@/lib/utils";

export function AnonymousResults({ questionnaireId }: { questionnaireId: string }) {
  const { data, isLoading } = useQuestionnaireResults(questionnaireId);
  const results = data?.data;

  // Group questions by tema (falling back to "Sem tema"), preserving order.
  const byTema = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; items: QuestionnaireResultsQuestion[] }>();
    for (const q of (results?.questions ?? [])) {
      const key = q.group?.id ?? "_";
      const bucket = groups.get(key) ?? { id: key, name: q.group?.name ?? "Sem tema", items: [] };
      bucket.items.push(q);
      groups.set(key, bucket);
    }
    return Array.from(groups.values()).map((g) => ({
      ...g,
      items: [...g.items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    }));
  }, [results?.questions]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!results || results.questions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconChartBar className="h-5 w-5 text-muted-foreground" />
            Resultados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <IconEyeOff className="h-6 w-6 opacity-60" />
            <span>Nenhuma resposta registrada ainda.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <IconChartBar className="h-5 w-5 text-muted-foreground" />
          Resultados
        </CardTitle>
        <Badge variant="outline" className="gap-1.5">
          <IconEyeOff className="h-3.5 w-3.5" />
          {results.respondedCount} de {results.totalEntries} responderam
        </Badge>
      </CardHeader>
      <CardContent className="space-y-6">
        {byTema.map((tema) => (
          <div key={tema.id} className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {tema.name}
            </h3>
            <div className="space-y-4">
              {tema.items.map((q) => (
                <QuestionResult key={q.id} question={q} />
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function QuestionResult({ question }: { question: QuestionnaireResultsQuestion }) {
  const { title, group, options, distribution, answeredCount, average, commentCount } = question;

  return (
    <div className="rounded-lg border border-border/40 bg-muted/20 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <span className="font-medium leading-tight">{title}</span>
          {group?.name && (
            <p className="text-xs text-muted-foreground">{group.name}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {average != null && (
            <ScoreBadge score={Math.round(average)} label={average.toFixed(2)} size="md" />
          )}
        </div>
      </div>

      <div className="space-y-2">
        {options.map((opt) => {
          const count = distribution[String(opt.value)] ?? 0;
          const pct = answeredCount > 0 ? Math.round((count / answeredCount) * 100) : 0;
          return (
            <div key={opt.value} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-foreground/90">{opt.label}</span>
                <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                  {count} · {pct}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full bg-primary transition-all")}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="tabular-nums">{answeredCount} resposta(s)</span>
        {commentCount > 0 && (
          <span className="flex items-center gap-1 tabular-nums">
            <IconMessage2 className="h-3.5 w-3.5" />
            {commentCount} comentário(s)
          </span>
        )}
      </div>
    </div>
  );
}

export default AnonymousResults;
