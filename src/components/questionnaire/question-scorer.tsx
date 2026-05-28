// components/questionnaire/question-scorer.tsx
//
// Thin adapter mapping a QuestionnaireQuestion + its options onto the SHARED
// ScorerCard — the exact same component the skill-assessment fill/detail pages
// use. This guarantees the questionnaire is pixel-identical to the assessment
// (same ladder, same spacing, same note panel) instead of a parallel design.

import { ScorerCard } from "@/components/production/skill-assessment/scorer-card";
import type { QuestionnaireQuestion, QuestionnaireOption } from "@/types";

interface QuestionScorerProps {
  index: number;
  question: QuestionnaireQuestion;
  options: QuestionnaireOption[];
  value: number | null;
  comment: string;
  readOnly?: boolean;
  onValueChange: (value: number) => void;
  onCommentChange: (value: string) => void;
}

export function QuestionScorer({
  index,
  question,
  options,
  value,
  comment,
  readOnly,
  onValueChange,
  onCommentChange,
}: QuestionScorerProps) {
  return (
    <ScorerCard
      index={index}
      title={question.title}
      description={question.description}
      categoryLabel={question.group?.name ?? null}
      callout={question.helpText ? { text: question.helpText, variant: "info" } : null}
      levels={options.map((o) => ({ id: o.id, score: o.value, name: o.label, description: o.description ?? "" }))}
      score={value}
      note={comment}
      noteLabel="Comentário"
      noteRequiredThreshold={null}
      readOnly={readOnly}
      onScoreChange={onValueChange}
      onNoteChange={onCommentChange}
    />
  );
}
