import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconChecklist, IconLoader2, IconSearch } from "@tabler/icons-react";

import type { AssessmentEntry, User } from "../../../types";
import {
  ASSESSMENT_ENTRY_STATUS,
  ASSESSMENT_ENTRY_STATUS_LABELS,
  routes,
} from "../../../constants";
import { useAssessmentEntries } from "../../../hooks";

/**
 * Synthesized "to-be-created" entry for DRAFT campaigns. Rendered alongside
 * real entries when the campaign hasn't been opened yet, so HR can see who is
 * about to be assessed and by whom.
 */
export interface PlannedEntry {
  id: string;
  evaluatee: User;
  evaluator: User | null;
  sectorName?: string;
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";
import { ScoreBadge } from "@/components/production/skill-assessment/score-badge";
import { AssessmentEntryStatusBadge } from "@/components/production/skill-assessment/assessment-entry-status-badge";

interface EntriesTableProps {
  assessmentId: string;
  topicsCount: number;
  /**
   * When set, the table renders these pseudo-entries instead of fetching real
   * AssessmentEntry rows. Used for DRAFT campaigns where entries don't exist
   * yet but HR still wants to preview who'll be assessed.
   */
  plannedEntries?: PlannedEntry[];
}

const STATUS_OPTIONS = [
  { value: "ALL", label: "Todos os status" },
  ...Object.values(ASSESSMENT_ENTRY_STATUS).map((s) => ({
    value: s,
    label: ASSESSMENT_ENTRY_STATUS_LABELS[s as ASSESSMENT_ENTRY_STATUS],
  })),
];


const HEAD_BASE =
  "h-10 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground";

export function EntriesTable({
  assessmentId,
  topicsCount,
  plannedEntries,
}: EntriesTableProps) {
  const [status, setStatus] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const isPlannedMode = plannedEntries !== undefined;

  const params = useMemo(
    () => ({
      assessmentId,
      ...(status !== "ALL" ? { status: status as any } : {}),
      include: {
        evaluatee: { include: { position: true, sector: true } },
        evaluator: true,
        responses: true,
        _count: { select: { responses: true } },
      } as any,
      limit: 200,
    }),
    [assessmentId, status],
  );

  // Skip the network call entirely when we're rendering planned entries.
  const { data, isLoading } = useAssessmentEntries(params as any, {
    enabled: !isPlannedMode,
  } as any);
  const entries: AssessmentEntry[] = data?.data ?? [];

  // Group rows visually by Setor → Cargo → Nome, so HR can scan a campaign
  // sector-by-sector instead of seeing names interleaved across sectors.
  const collator = useMemo(
    () => new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true }),
    [],
  );
  const compareEvaluatees = useCallback(
    (a: { sector?: string; position?: string; name?: string }, b: typeof a) => {
      const s = collator.compare(a.sector ?? "", b.sector ?? "");
      if (s !== 0) return s;
      const p = collator.compare(a.position ?? "", b.position ?? "");
      if (p !== 0) return p;
      return collator.compare(a.name ?? "", b.name ?? "");
    },
    [collator],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matched = !term
      ? entries
      : entries.filter(
          (e) =>
            e.evaluatee?.name?.toLowerCase().includes(term) ||
            e.evaluator?.name?.toLowerCase().includes(term),
        );
    return [...matched].sort((a, b) =>
      compareEvaluatees(
        {
          sector: (a.evaluatee as any)?.sector?.name,
          position: (a.evaluatee as any)?.position?.name,
          name: a.evaluatee?.name,
        },
        {
          sector: (b.evaluatee as any)?.sector?.name,
          position: (b.evaluatee as any)?.position?.name,
          name: b.evaluatee?.name,
        },
      ),
    );
  }, [entries, search, compareEvaluatees]);

  const filteredPlanned = useMemo(() => {
    if (!plannedEntries) return [];
    const term = search.trim().toLowerCase();
    const matched = !term
      ? plannedEntries
      : plannedEntries.filter(
          (p) =>
            p.evaluatee?.name?.toLowerCase().includes(term) ||
            p.evaluator?.name?.toLowerCase().includes(term),
        );
    return [...matched].sort((a, b) =>
      compareEvaluatees(
        {
          sector: a.sectorName ?? (a.evaluatee as any)?.sector?.name,
          position: (a.evaluatee as any)?.position?.name,
          name: a.evaluatee?.name,
        },
        {
          sector: b.sectorName ?? (b.evaluatee as any)?.sector?.name,
          position: (b.evaluatee as any)?.position?.name,
          name: b.evaluatee?.name,
        },
      ),
    );
  }, [plannedEntries, search, compareEvaluatees]);

  const totalCount = isPlannedMode ? filteredPlanned.length : filtered.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconChecklist className="h-5 w-5 text-muted-foreground" />
          Avaliações ({totalCount})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(v) => setSearch(typeof v === "string" ? v : v == null ? "" : String(v))}
              placeholder="Buscar por avaliado ou avaliador..."
              className="pl-9"
            />
          </div>
          {!isPlannedMode && (
            <div className="w-full md:w-64">
              <Combobox
                value={status}
                onValueChange={(v) => setStatus((v as string) ?? "ALL")}
                options={STATUS_OPTIONS}
                placeholder="Filtrar por status"
              />
            </div>
          )}
        </div>

        <div className="rounded-md border border-border/40 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border/40 hover:!bg-muted">
                <TableHead className={cn(HEAD_BASE, "w-56")}>Avaliado</TableHead>
                <TableHead className={cn(HEAD_BASE, "w-32")}>Cargo</TableHead>
                <TableHead className={cn(HEAD_BASE, "w-32")}>Setor</TableHead>
                <TableHead className={cn(HEAD_BASE, "w-56")}>Avaliador</TableHead>
                <TableHead className={HEAD_BASE}>Progresso</TableHead>
                <TableHead className={cn(HEAD_BASE, "w-20 text-center")}>Nota</TableHead>
                <TableHead className={cn(HEAD_BASE, "w-32 text-center")}>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPlannedMode ? (
                filteredPlanned.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                      Nenhum avaliado selecionado ainda.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPlanned.map((p, idx) => (
                    <PlannedRow key={p.id} planned={p} rowIndex={idx} />
                  ))
                )
              ) : isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <IconLoader2 className="h-5 w-5 animate-spin inline-block text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    Nenhuma entrada de avaliação encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((e, idx) => (
                  <EntryRow
                    key={e.id}
                    entry={e}
                    topicsCount={topicsCount}
                    rowIndex={idx}
                    onOpen={() =>
                      navigate(routes.administration.skillAssessment.entry(assessmentId, e.id))
                    }
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

const CELL_BASE = "px-3 py-3 align-middle !border-b !border-border/30";

function PlannedRow({ planned, rowIndex }: { planned: PlannedEntry; rowIndex: number }) {
  const evaluateePosition = (planned.evaluatee as any)?.position?.name as string | undefined;
  const evaluateeSector =
    planned.sectorName ?? ((planned.evaluatee as any)?.sector?.name as string | undefined);
  return (
    <TableRow
      className={cn(
        "!border-b-0 transition-colors",
        rowIndex % 2 === 1 ? "!bg-muted/15" : "!bg-transparent",
      )}
    >
      <TableCell className={cn(CELL_BASE, "w-56")}>
        <div className="font-medium">{planned.evaluatee?.name ?? "—"}</div>
      </TableCell>
      <TableCell className={cn(CELL_BASE, "w-32")}>
        <span className="text-sm text-foreground/80">{evaluateePosition ?? "—"}</span>
      </TableCell>
      <TableCell className={cn(CELL_BASE, "w-32")}>
        <span className="text-sm text-foreground/80">{evaluateeSector ?? "—"}</span>
      </TableCell>
      <TableCell className={CELL_BASE}>
        {planned.evaluator ? (
          <div className="font-medium">{planned.evaluator.name}</div>
        ) : (
          <span className="text-sm text-amber-600 dark:text-amber-400">
            Sem avaliador definido
          </span>
        )}
      </TableCell>
      <TableCell className={cn(CELL_BASE, "w-40")}>
        <span className="text-xs text-muted-foreground">—</span>
      </TableCell>
      <TableCell className={cn(CELL_BASE, "w-20 text-center")}>
        <span className="text-xs text-muted-foreground">—</span>
      </TableCell>
      <TableCell className={cn(CELL_BASE, "w-36 text-center")}>
        <AssessmentEntryStatusBadge status={ASSESSMENT_ENTRY_STATUS.PENDING} />
      </TableCell>
    </TableRow>
  );
}

function EntryRow({
  entry,
  topicsCount,
  rowIndex,
  onOpen,
}: {
  entry: AssessmentEntry;
  topicsCount: number;
  rowIndex: number;
  onOpen: () => void;
}) {
  const responses = entry._count?.responses ?? 0;
  const pct = topicsCount > 0 ? Math.round((responses / topicsCount) * 100) : 0;
  const fullyScored = topicsCount > 0 && responses >= topicsCount;

  const avg = useMemo(() => {
    const scored = (entry.responses ?? [])
      .map((r) => (typeof r.score === "number" ? r.score : null))
      .filter((s): s is number => s != null);
    if (scored.length === 0) return null;
    return scored.reduce((a, b) => a + b, 0) / scored.length;
  }, [entry.responses]);

  const evaluateePosition = (entry.evaluatee as any)?.position?.name as string | undefined;
  const evaluateeSector = (entry.evaluatee as any)?.sector?.name as string | undefined;

  return (
    <TableRow
      onClick={onOpen}
      className={cn(
        "!border-b-0 cursor-pointer transition-colors",
        rowIndex % 2 === 1 ? "!bg-muted/15" : "!bg-transparent",
        "hover:!bg-muted/30",
      )}
    >
      <TableCell className={cn(CELL_BASE, "w-56")}>
        <div className="font-medium">{entry.evaluatee?.name ?? "—"}</div>
      </TableCell>
      <TableCell className={cn(CELL_BASE, "w-32")}>
        <span className="text-sm text-foreground/80">
          {evaluateePosition ?? "—"}
        </span>
      </TableCell>
      <TableCell className={cn(CELL_BASE, "w-32")}>
        <span className="text-sm text-foreground/80">
          {evaluateeSector ?? "—"}
        </span>
      </TableCell>
      <TableCell className={CELL_BASE}>
        <div className="font-medium">{entry.evaluator?.name ?? "—"}</div>
      </TableCell>
      <TableCell className={cn(CELL_BASE, "w-40")}>
        <div className="flex items-center gap-2">
          <Progress value={pct} className="h-2" />
          <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">
            {responses}/{topicsCount}
          </span>
        </div>
      </TableCell>
      <TableCell className={cn(CELL_BASE, "w-20 text-center")}>
        {avg != null ? (
          <ScoreBadge score={Math.round(avg)} label={avg.toFixed(2)} size="md" />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className={cn(CELL_BASE, "w-36 text-center")}>
        <AssessmentEntryStatusBadge
          status={entry.status as ASSESSMENT_ENTRY_STATUS}
          fullyScored={fullyScored}
        />
      </TableCell>
    </TableRow>
  );
}
