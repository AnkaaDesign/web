// components/production/skill-assessment/topic-scorer.tsx
//
// One Card per Topic on the fill page. Shows:
//  - Topic title + description + counter-behaviors callout
//  - 6 LevelRadio cards (responsive grid)
//  - Inline justification preview + "Adicionar/Editar justificativa" trigger
//
// The actual justification text is captured in the bottom <JustificationSheet>
// — this component just orchestrates open/close + reads the value back.
//
// READ-ONLY mode hides the radio cards and renders the score badge + chosen
// level name + justification text in static rows.

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconFlag3,
  IconNote,
  IconPencil,
  IconPlus,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { LevelRadio } from "./level-radio";
import { JustificationSheet } from "./justification-sheet";
import { ScoreBadge } from "./score-badge";
import type { Topic, TopicLevel } from "../../../types";

interface TopicScorerProps {
  index: number;
  topic: Topic;
  levels: TopicLevel[]; // expected length 6 (score 0..5)
  score: number | null;
  justification: string;
  readOnly?: boolean;
  onScoreChange: (score: number) => void;
  onJustificationChange: (value: string) => void;
}

const JUSTIFICATION_REQUIRED_THRESHOLD = 2;

export function TopicScorer({
  index,
  topic,
  levels,
  score,
  justification,
  readOnly,
  onScoreChange,
  onJustificationChange,
}: TopicScorerProps) {
  const sortedLevels = useMemo(
    () => [...levels].sort((a, b) => a.score - b.score),
    [levels],
  );
  const selectedLevel = useMemo(
    () => (score == null ? null : sortedLevels.find((l) => l.score === score) ?? null),
    [sortedLevels, score],
  );

  const justificationRequired =
    score != null && score <= JUSTIFICATION_REQUIRED_THRESHOLD;
  const justificationMissing = justificationRequired && !justification.trim();

  const [sheetOpen, setSheetOpen] = useState(false);
  // Auto-open the sheet once when a low score is freshly picked and no
  // justification has been written yet.
  const [autoOpenedFor, setAutoOpenedFor] = useState<number | null>(null);
  useEffect(() => {
    if (readOnly) return;
    if (
      justificationRequired &&
      !justification.trim() &&
      score !== null &&
      autoOpenedFor !== score
    ) {
      setSheetOpen(true);
      setAutoOpenedFor(score);
    }
    if (!justificationRequired) {
      setAutoOpenedFor(null);
    }
  }, [score, justificationRequired, justification, autoOpenedFor, readOnly]);

  const handleScoreClick = (next: number) => {
    if (readOnly) return;
    onScoreChange(next);
  };

  const handleJustificationSave = (value: string) => {
    onJustificationChange(value);
  };

  return (
    <Card
      id={`topic-${topic.id}`}
      className={cn(
        "scroll-mt-32 transition-colors",
        score == null && !readOnly && "border-dashed",
        justificationMissing && "border-amber-400/70",
      )}
    >
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-2 text-xs font-semibold tabular-nums">
            {index + 1}
          </span>
          {topic.skill?.name && (
            <Badge variant="outline" className="text-[10px]">
              {topic.skill.name}
            </Badge>
          )}
          {score != null && (
            <div className="ml-auto flex items-center gap-2">
              <ScoreBadge score={score} size="md" />
              {selectedLevel && (
                <span className="text-xs text-muted-foreground">
                  {selectedLevel.name}
                </span>
              )}
            </div>
          )}
        </div>
        <CardTitle className="text-lg leading-snug">{topic.title}</CardTitle>
        {topic.description && (
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {topic.description}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {topic.counterBehaviors && (
          <Alert variant="default" className="border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20">
            <IconFlag3 className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-900 dark:text-amber-200">
              <span className="font-semibold">O que evitar: </span>
              <span className="whitespace-pre-line">{topic.counterBehaviors}</span>
            </AlertDescription>
          </Alert>
        )}

        {readOnly ? (
          <div className="rounded-lg border bg-muted/30 p-3">
            {selectedLevel ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <ScoreBadge score={selectedLevel.score} size="md" />
                  <span className="text-sm font-semibold">{selectedLevel.name}</span>
                </div>
                <p className="whitespace-pre-line text-xs text-muted-foreground">
                  {selectedLevel.description}
                </p>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Sem resposta registrada</span>
            )}
          </div>
        ) : (
          <div
            role="radiogroup"
            aria-label={`Nota para o tópico ${topic.title}`}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
          >
            {sortedLevels.map((level) => (
              <LevelRadio
                key={level.id}
                score={level.score}
                name={level.name}
                description={level.description}
                selected={score === level.score}
                onSelect={() => handleScoreClick(level.score)}
              />
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium">
              <IconNote className="h-4 w-4 text-muted-foreground" />
              Justificativa
              {justificationRequired && (
                <span className="text-xs font-normal text-amber-600">(obrigatória)</span>
              )}
            </span>
            {!readOnly && (
              <Button
                type="button"
                variant={justification ? "outline" : justificationRequired ? "default" : "ghost"}
                size="sm"
                onClick={() => setSheetOpen(true)}
              >
                {justification ? (
                  <>
                    <IconPencil className="h-4 w-4" />
                    Editar
                  </>
                ) : (
                  <>
                    <IconPlus className="h-4 w-4" />
                    Adicionar
                  </>
                )}
              </Button>
            )}
          </div>
          {justification ? (
            <p className="whitespace-pre-line text-sm text-muted-foreground">{justification}</p>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              Nenhuma justificativa registrada.
            </p>
          )}
          {justificationMissing && (
            <div className="inline-flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <IconAlertCircle className="h-3.5 w-3.5" />
              Justificativa obrigatória para esta nota.
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

      <JustificationSheet
        open={sheetOpen}
        topicTitle={topic.title}
        score={score}
        required={justificationRequired}
        initialValue={justification}
        disabled={readOnly}
        onOpenChange={setSheetOpen}
        onSave={handleJustificationSave}
      />
    </Card>
  );
}
