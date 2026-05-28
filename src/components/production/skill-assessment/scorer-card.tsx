// components/production/skill-assessment/scorer-card.tsx
//
// THE shared scorer card used by every "score an item" surface so they look
// identical by construction:
//   - leader assessment fill page         (edit)
//   - admin assessment detail/review page (read-only, full ladder + Δ vs last)
//   - questionnaire self-fill page         (edit)
//   - questionnaire review page            (read-only)
//
// Generalized over a neutral { title, description, categoryLabel, callout,
// levels } shape so it is agnostic to Skill/Topic vs QuestionnaireGroup/Question.
// In READ-ONLY mode it still renders the FULL level ladder (every option as a
// disabled LevelRadio with the chosen one highlighted), matching the fill page.

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconArrowDownRight,
  IconArrowUpRight,
  IconFlag3,
  IconInfoCircle,
  IconMinus,
  IconNote,
  IconPencil,
  IconPlus,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { LevelRadio } from "./level-radio";
import { JustificationSheet } from "./justification-sheet";
import { ScoreBadge } from "./score-badge";

export interface ScorerLevel {
  id?: string;
  score: number;
  name: string;
  description: string;
}

export interface ScorerCardProps {
  index: number;
  title: string;
  description?: string | null;
  categoryLabel?: string | null;
  callout?: { label?: string; text: string; variant?: "warn" | "info" } | null;
  levels: ScorerLevel[];
  score: number | null;
  /** Previous-period score for this item — drives the Δ chip in the header. */
  previousScore?: number | null;
  note: string;
  noteLabel?: string;
  /** Scores ≤ threshold require a note (assessment = 2). null = never required. */
  noteRequiredThreshold?: number | null;
  readOnly?: boolean;
  onScoreChange?: (score: number) => void;
  onNoteChange?: (value: string) => void;
}

/** Small "Anterior: Y ▲+1" comparison chip. */
export function DeltaChip({ current, previous }: { current: number | null; previous: number | null }) {
  if (previous == null) return null;
  const delta = current == null ? null : current - previous;
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground tabular-nums">
      <span>Ant. {previous}</span>
      {delta != null && (
        <span
          className={cn(
            "inline-flex items-center gap-0.5 font-semibold",
            delta > 0 && "text-emerald-600",
            delta < 0 && "text-red-600",
          )}
        >
          {delta > 0 ? <IconArrowUpRight className="h-3 w-3" /> : delta < 0 ? <IconArrowDownRight className="h-3 w-3" /> : <IconMinus className="h-3 w-3" />}
          {delta > 0 ? `+${delta}` : delta}
        </span>
      )}
    </span>
  );
}

export function ScorerCard({
  index,
  title,
  description,
  categoryLabel,
  callout,
  levels,
  score,
  previousScore,
  note,
  noteLabel = "Justificativa",
  noteRequiredThreshold = null,
  readOnly,
  onScoreChange,
  onNoteChange,
}: ScorerCardProps) {
  const sortedLevels = useMemo(() => [...levels].sort((a, b) => a.score - b.score), [levels]);
  const selectedLevel = useMemo(
    () => (score == null ? null : sortedLevels.find((l) => l.score === score) ?? null),
    [sortedLevels, score],
  );

  const required = noteRequiredThreshold != null && score != null && score <= noteRequiredThreshold;
  const noteMissing = required && !note.trim();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [autoOpenedFor, setAutoOpenedFor] = useState<number | null>(null);
  useEffect(() => {
    if (readOnly || noteRequiredThreshold == null) return;
    if (required && !note.trim() && score !== null && autoOpenedFor !== score) {
      setSheetOpen(true);
      setAutoOpenedFor(score);
    }
    if (!required) setAutoOpenedFor(null);
  }, [score, required, note, autoOpenedFor, readOnly, noteRequiredThreshold]);

  const calloutVariant = callout?.variant ?? "warn";

  return (
    <Card
      className={cn(
        "scroll-mt-32 transition-colors",
        score == null && !readOnly && "border-dashed",
        noteMissing && "border-amber-400/70",
      )}
    >
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-2 text-xs font-semibold tabular-nums">
            {index + 1}
          </span>
          {categoryLabel && (
            <Badge variant="outline" className="text-[10px]">
              {categoryLabel}
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-2">
            <DeltaChip current={score} previous={previousScore ?? null} />
            {score != null && (
              <>
                <ScoreBadge score={score} size="md" />
                {selectedLevel && <span className="text-xs text-muted-foreground">{selectedLevel.name}</span>}
              </>
            )}
          </div>
        </div>
        <CardTitle className="text-lg leading-snug">{title}</CardTitle>
        {description && (
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {callout?.text && (
          <Alert
            variant="default"
            className={cn(
              calloutVariant === "warn"
                ? "border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20"
                : "border-blue-200 bg-blue-50/60 dark:border-blue-900/40 dark:bg-blue-950/20",
            )}
          >
            {calloutVariant === "warn" ? (
              <IconFlag3 className="h-4 w-4 text-amber-600" />
            ) : (
              <IconInfoCircle className="h-4 w-4 text-blue-600" />
            )}
            <AlertDescription
              className={cn(
                calloutVariant === "warn"
                  ? "text-amber-900 dark:text-amber-200"
                  : "text-blue-900 dark:text-blue-200",
              )}
            >
              {callout.label && <span className="font-semibold">{callout.label} </span>}
              <span className="whitespace-pre-line">{callout.text}</span>
            </AlertDescription>
          </Alert>
        )}

        {/* Full level ladder — always rendered (disabled in read-only). */}
        <div
          role="radiogroup"
          aria-label={`Nota para ${title}`}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
        >
          {sortedLevels.map((level) => (
            <LevelRadio
              key={level.id ?? level.score}
              score={level.score}
              name={level.name}
              description={level.description}
              selected={score === level.score}
              disabled={readOnly}
              onSelect={() => !readOnly && onScoreChange?.(level.score)}
            />
          ))}
        </div>

        <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium">
              <IconNote className="h-4 w-4 text-muted-foreground" />
              {noteLabel}
              {required ? (
                <span className="text-xs font-normal text-amber-600">(obrigatória)</span>
              ) : (
                !readOnly && <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
              )}
            </span>
            {!readOnly && (
              <Button
                type="button"
                variant={note ? "outline" : required ? "default" : "ghost"}
                size="sm"
                onClick={() => setSheetOpen(true)}
              >
                {note ? (
                  <>
                    <IconPencil className="h-4 w-4" /> Editar
                  </>
                ) : (
                  <>
                    <IconPlus className="h-4 w-4" /> Adicionar
                  </>
                )}
              </Button>
            )}
          </div>
          {note ? (
            <p className="whitespace-pre-line text-sm text-muted-foreground">{note}</p>
          ) : (
            <p className="text-xs italic text-muted-foreground">Nenhuma {noteLabel.toLowerCase()} registrada.</p>
          )}
          {noteMissing && (
            <div className="inline-flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <IconAlertCircle className="h-3.5 w-3.5" />
              {noteLabel} obrigatória para esta nota.
            </div>
          )}
          {score == null && !readOnly && (
            <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <IconAlertTriangle className="h-3.5 w-3.5" />
              Selecione uma nota acima.
            </div>
          )}
        </div>
      </CardContent>

      {!readOnly && (
        <JustificationSheet
          open={sheetOpen}
          topicTitle={title}
          score={score}
          required={required}
          initialValue={note}
          label={noteLabel}
          onOpenChange={setSheetOpen}
          onSave={(v) => onNoteChange?.(v)}
        />
      )}
    </Card>
  );
}
