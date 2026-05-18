// components/production/skill-assessment/matrix/evaluatees-table.tsx
//
// Matrix table for the leader's per-campaign topic-paged view. Built on the
// UI Table primitives but with the zebra striping + heavy borders that the
// default TableRow / TableHead apply intentionally overridden — leaders
// scan this table row-by-row and need a calm, low-contrast surface.
//
// Columns are fixed-width except Avaliado so the row layout NEVER reflows
// while a cell saves — the spinner lives inside the score-button at the
// same glyph size as the digit it replaces.

import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EvaluateeRow } from "./evaluatee-row";
import { cn } from "@/lib/utils";
import type { AssessmentEntry, Topic } from "@/types";

interface EvaluateesTableProps {
  entries: AssessmentEntry[];
  activeTopic: Topic;
  totalTopics: number;
  scoredCountByEntry: Map<string, { scored: number; missingJustifications: number }>;
  onCellHover: (score: number | null) => void;
}

const HEAD_BASE =
  "h-9 px-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground !bg-transparent";

export function EvaluateesTable({
  entries,
  activeTopic,
  totalTopics,
  scoredCountByEntry,
  onCellHover,
}: EvaluateesTableProps) {
  if (entries.length === 0) {
    return (
      <Card className="flex items-center justify-center py-10 text-sm text-muted-foreground">
        Nenhum avaliado nesta campanha.
      </Card>
    );
  }

  return (
    <Card className="flex h-full flex-col overflow-hidden p-0">
      <div className="flex-1 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="!bg-muted/20 hover:!bg-muted/20 border-b border-border/40">
              <TableHead className={HEAD_BASE}>Avaliado</TableHead>
              <TableHead className={cn(HEAD_BASE, "w-[180px]")}>Cargo</TableHead>
              <TableHead className={cn(HEAD_BASE, "w-[240px]")}>Nota</TableHead>
              <TableHead className={cn(HEAD_BASE, "w-[100px] text-center")}>
                Tópicos
              </TableHead>
              <TableHead className={cn(HEAD_BASE, "w-[130px]")}>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => {
              const stats = scoredCountByEntry.get(entry.id) ?? {
                scored: 0,
                missingJustifications: 0,
              };
              return (
                <EvaluateeRow
                  key={entry.id}
                  entry={entry}
                  activeTopic={activeTopic}
                  totalTopics={totalTopics}
                  scoredCount={stats.scored}
                  missingJustificationsCount={stats.missingJustifications}
                  onCellHover={onCellHover}
                />
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
