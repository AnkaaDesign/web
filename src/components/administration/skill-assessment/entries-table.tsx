import { useMemo, useState } from "react";
import { IconLoader2, IconSearch } from "@tabler/icons-react";

import type { AssessmentEntry } from "../../../types";
import { ASSESSMENT_ENTRY_STATUS, ASSESSMENT_ENTRY_STATUS_LABELS } from "../../../constants";
import { useAssessmentEntries, useReopenAssessmentEntry } from "../../../hooks";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { ScoreBadge } from "@/components/production/skill-assessment/score-badge";

interface EntriesTableProps {
  assessmentId: string;
  topicsCount: number;
}

const STATUS_OPTIONS = [
  { value: "ALL", label: "Todos os status" },
  ...Object.values(ASSESSMENT_ENTRY_STATUS).map((s) => ({
    value: s,
    label: ASSESSMENT_ENTRY_STATUS_LABELS[s as ASSESSMENT_ENTRY_STATUS],
  })),
];

function statusBadge(s: ASSESSMENT_ENTRY_STATUS) {
  switch (s) {
    case ASSESSMENT_ENTRY_STATUS.SUBMITTED:
      return <Badge>{ASSESSMENT_ENTRY_STATUS_LABELS[s]}</Badge>;
    case ASSESSMENT_ENTRY_STATUS.IN_PROGRESS:
      return <Badge variant="secondary">{ASSESSMENT_ENTRY_STATUS_LABELS[s]}</Badge>;
    case ASSESSMENT_ENTRY_STATUS.PENDING:
    default:
      return <Badge variant="outline">{ASSESSMENT_ENTRY_STATUS_LABELS[s]}</Badge>;
  }
}

export function EntriesTable({ assessmentId, topicsCount }: EntriesTableProps) {
  const [status, setStatus] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  const params = useMemo(
    () => ({
      assessmentId,
      ...(status !== "ALL" ? { status: status as any } : {}),
      include: {
        evaluatee: true,
        evaluator: true,
        responses: true,
        _count: { select: { responses: true } },
      } as any,
      limit: 200,
    }),
    [assessmentId, status],
  );

  const { data, isLoading } = useAssessmentEntries(params as any);
  const entries: AssessmentEntry[] = data?.data ?? [];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return entries;
    return entries.filter(
      (e) =>
        e.evaluatee?.name?.toLowerCase().includes(term) ||
        e.evaluator?.name?.toLowerCase().includes(term),
    );
  }, [entries, search]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Avaliações ({filtered.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por avaliado ou avaliador..."
              className="pl-9"
            />
          </div>
          <div className="w-full md:w-64">
            <Combobox
              value={status}
              onValueChange={(v) => setStatus((v as string) ?? "ALL")}
              options={STATUS_OPTIONS}
              placeholder="Filtrar por status"
            />
          </div>
        </div>

        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Avaliado</TableHead>
                <TableHead>Avaliador</TableHead>
                <TableHead className="w-40">Progresso</TableHead>
                <TableHead className="w-20 text-center">Nota</TableHead>
                <TableHead className="w-28 text-center">Status</TableHead>
                <TableHead className="w-32 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <IconLoader2 className="h-5 w-5 animate-spin inline-block text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    Nenhuma entrada de avaliação encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((e) => <EntryRow key={e.id} entry={e} topicsCount={topicsCount} />)
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function EntryRow({ entry, topicsCount }: { entry: AssessmentEntry; topicsCount: number }) {
  const responses = entry._count?.responses ?? 0;
  const pct = topicsCount > 0 ? Math.round((responses / topicsCount) * 100) : 0;

  // Per-entry average Nota (only meaningful for SUBMITTED entries with at
  // least one scored response).
  const avg = useMemo(() => {
    const scored = (entry.responses ?? [])
      .map((r) => (typeof r.score === "number" ? r.score : null))
      .filter((s): s is number => s != null);
    if (scored.length === 0) return null;
    return scored.reduce((a, b) => a + b, 0) / scored.length;
  }, [entry.responses]);

  const reopen = useReopenAssessmentEntry(entry.id);

  const handleReopen = async () => {
    try {
      await reopen.mutateAsync();
      toast.success("Avaliação reaberta");
    } catch (err) {
      toast.error("Erro ao reabrir avaliação");
    }
  };

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{entry.evaluatee?.name ?? "—"}</div>
        <div className="text-xs text-muted-foreground">
          {entry.evaluatee?.email ?? entry.evaluateeId}
        </div>
      </TableCell>
      <TableCell>
        <div className="font-medium">{entry.evaluator?.name ?? "—"}</div>
        <div className="text-xs text-muted-foreground">
          {entry.evaluator?.email ?? entry.evaluatorId}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Progress value={pct} className="h-2" />
          <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">
            {responses}/{topicsCount}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-center">
        {avg != null ? (
          <ScoreBadge
            score={Math.round(avg)}
            label={avg.toFixed(2)}
            size="md"
          />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-center">{statusBadge(entry.status as ASSESSMENT_ENTRY_STATUS)}</TableCell>
      <TableCell className="text-right">
        {entry.status === ASSESSMENT_ENTRY_STATUS.SUBMITTED ? (
          <Button size="sm" variant="ghost" onClick={handleReopen} disabled={reopen.isPending}>
            {reopen.isPending ? <IconLoader2 className="h-3 w-3 animate-spin" /> : "Reabrir"}
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}
