// components/production/skill-assessment/matrix/evaluatees-table.tsx
//
// Matrix table for the leader's per-campaign topic-paged view. Rows are
// selectable — clicking a row marks the evaluatee as active, and the parent
// ScoreLevelPicker scores them. Zebra striping + readable fonts so leaders
// can scan a long roster comfortably.

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
  activeEntryId: string | null;
  /** Map of entryId → optimistic score for the current topic. */
  optimisticScores: Map<string, number | null>;
  onSelectEntry: (entryId: string) => void;
}

const HEAD_BASE =
  "h-10 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground";

export function EvaluateesTable({
  entries,
  activeTopic,
  activeEntryId,
  optimisticScores,
  onSelectEntry,
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
            <TableRow className={cn("hover:!bg-muted/20 border-b border-border/40")}>
              <TableHead className={HEAD_BASE}>Avaliado</TableHead>
              <TableHead className={cn(HEAD_BASE, "w-[220px]")}>Cargo</TableHead>
              <TableHead className={cn(HEAD_BASE, "w-[100px]")}>Nota</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry, idx) => {
              return (
                <EvaluateeRow
                  key={entry.id}
                  entry={entry}
                  activeTopic={activeTopic}
                  isActive={activeEntryId === entry.id}
                  rowIndex={idx}
                  overrideScore={optimisticScores.get(entry.id)}
                  onSelect={() => onSelectEntry(entry.id)}
                />
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
