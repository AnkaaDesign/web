import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { IconLoader2 } from "@tabler/icons-react";

import { useAssessmentAnalytics } from "../../../hooks";
import type { AssessmentEvaluateeAnalytics, AssessmentTopicDistribution } from "../../../types";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { ScoreBadge, getScoreBadgeClasses } from "@/components/production/skill-assessment/score-badge";

interface CampaignAnalyticsProps {
  assessmentId: string;
}

export function CampaignAnalytics({ assessmentId }: CampaignAnalyticsProps) {
  const { data, isLoading } = useAssessmentAnalytics(assessmentId);
  const analytics = data?.data;

  const evaluateeOptions = useMemo(
    () =>
      (analytics?.byEvaluatee ?? []).map((e) => ({
        value: e.userId,
        label: e.name,
      })),
    [analytics],
  );

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const effectiveUserId = selectedUserId ?? evaluateeOptions[0]?.value ?? null;

  const selectedEvaluatee = useMemo<AssessmentEvaluateeAnalytics | undefined>(
    () => analytics?.byEvaluatee.find((e) => e.userId === effectiveUserId),
    [analytics, effectiveUserId],
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Análises ainda não disponíveis para esta campanha.
        </CardContent>
      </Card>
    );
  }

  // Per-skill bar averages — one bar per Skill, in stable skill.order ASC.
  // Driven entirely by the analytics payload, no hard-coded Skill names.
  const perSkillBars = (analytics.perSkillAvgAggregate ?? []).map((row) => ({
    skill: row.skillName,
    value: row.average ?? 0,
  }));

  // Radar data for selected evaluatee
  const radarData = (selectedEvaluatee?.radar ?? []).map((r) => ({
    topic: r.topicTitle,
    score: r.score,
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPI label="Avaliados" value={analytics.totalEvaluatees} />
        <KPI label="Enviadas" value={analytics.submittedCount} tone="success" />
        <KPI label="Em andamento" value={analytics.inProgressCount} tone="warning" />
        <KPI label="Pendentes" value={analytics.pendingCount} tone="muted" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nota geral por competência</CardTitle>
          <CardDescription>
            Média de todas as respostas submetidas, agrupadas pela área da competência.
            Escala 0..5.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perSkillBars}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="skill" />
                <YAxis domain={[0, 5]} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {analytics.overallAvg != null && (
            <div className="mt-2 text-sm text-muted-foreground flex items-center gap-2">
              <span>Nota geral da campanha:</span>
              <ScoreBadge
                score={Math.round(analytics.overallAvg)}
                label={analytics.overallAvg.toFixed(2)}
                size="md"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Radar por avaliado</CardTitle>
          <CardDescription>
            Visualize o perfil de competências de cada colaborador.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="md:w-80">
            <Combobox
              value={effectiveUserId ?? ""}
              onValueChange={(v) => setSelectedUserId((v as string) ?? null)}
              options={evaluateeOptions}
              placeholder="Selecione um avaliado"
              searchable
            />
          </div>

          {selectedEvaluatee ? (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline">Setor: {selectedEvaluatee.sectorName ?? "—"}</Badge>
                <Badge variant="outline">Cargo: {selectedEvaluatee.positionName ?? "—"}</Badge>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Nota:</span>
                  <ScoreBadge
                    score={
                      selectedEvaluatee.overallAvg != null
                        ? Math.round(selectedEvaluatee.overallAvg)
                        : null
                    }
                    label={selectedEvaluatee.overallAvg?.toFixed(2) ?? "—"}
                    size="md"
                  />
                </div>
              </div>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} outerRadius="80%">
                    <PolarGrid />
                    <PolarAngleAxis dataKey="topic" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 5]} />
                    <Radar
                      name="Nota"
                      dataKey="score"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.4}
                    />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Selecione um avaliado para visualizar o radar.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Distribuição por tópico</CardTitle>
          <CardDescription>
            Para cada tópico, quantas respostas caíram em cada nota (0..5).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TopicDistribution items={analytics.topicDistribution} />
        </CardContent>
      </Card>
    </div>
  );
}

function KPI({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "warning" | "muted";
}) {
  const color =
    tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : tone === "muted"
          ? "text-muted-foreground"
          : "text-foreground";
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className={`text-3xl font-bold ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

// Strip Tailwind hover utilities — colour-only classes for non-interactive
// histogram bars.
function stripHover(cls: string): string {
  return cls.replace(/hover:[^\s]+/g, "").trim();
}

function TopicDistribution({ items }: { items: AssessmentTopicDistribution[] }) {
  if (!items || items.length === 0) {
    return (
      <div className="py-6 text-center text-muted-foreground">
        Sem dados de distribuição ainda.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((d) => {
        const total = d.counts.reduce((a, b) => a + b, 0);
        return (
          <div key={d.topicId} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <div className="font-medium text-sm">{d.topicTitle}</div>
                <div className="text-xs text-muted-foreground">
                  {d.skillName} · {total} resposta(s)
                </div>
              </div>
            </div>
            <div className="flex gap-1 h-6 rounded overflow-hidden border bg-muted">
              {d.counts.map((c, idx) => {
                const pct = total > 0 ? (c / total) * 100 : 0;
                if (pct === 0) return null;
                return (
                  <div
                    key={idx}
                    className={`flex items-center justify-center text-[10px] font-medium ${stripHover(
                      getScoreBadgeClasses(idx),
                    )}`}
                    style={{ width: `${pct}%` }}
                    title={`Nota ${idx}: ${c}`}
                  >
                    {pct > 10 ? `${idx}: ${c}` : null}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
