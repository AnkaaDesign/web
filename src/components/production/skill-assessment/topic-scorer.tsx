// components/production/skill-assessment/topic-scorer.tsx
//
// Thin adapter mapping a Skill/Topic + its TopicLevels onto the shared
// ScorerCard. Kept so existing call-sites (the leader fill page) are unchanged.
// Read-only mode now renders the full level ladder (via ScorerCard) and an
// optional `previousScore` delta for the admin detail/review page.

import { ScorerCard } from "./scorer-card";
import type { Topic, TopicLevel } from "../../../types";

interface TopicScorerProps {
  index: number;
  topic: Topic;
  levels: TopicLevel[]; // expected length 6 (score 0..5)
  score: number | null;
  justification: string;
  previousScore?: number | null;
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
  previousScore,
  readOnly,
  onScoreChange,
  onJustificationChange,
}: TopicScorerProps) {
  return (
    <ScorerCard
      index={index}
      title={topic.title}
      description={topic.description}
      categoryLabel={topic.skill?.name ?? null}
      callout={topic.counterBehaviors ? { label: "O que evitar:", text: topic.counterBehaviors, variant: "warn" } : null}
      levels={levels.map((l) => ({ id: l.id, score: l.score, name: l.name, description: l.description }))}
      score={score}
      previousScore={previousScore}
      note={justification}
      noteLabel="Justificativa"
      noteRequiredThreshold={JUSTIFICATION_REQUIRED_THRESHOLD}
      readOnly={readOnly}
      onScoreChange={onScoreChange}
      onNoteChange={onJustificationChange}
    />
  );
}
