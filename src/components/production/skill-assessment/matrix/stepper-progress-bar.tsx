// components/production/skill-assessment/matrix/stepper-progress-bar.tsx
//
// Segmented progress bar used inside every topic/question stepper card across
// the app (assessment matrix fill + admin entry detail, questionnaire admin
// review + self-fill). Each step gets its own segment so the user instantly
// sees three states at a glance:
//   • blue  — the step they are CURRENTLY on
//   • green — steps already SCORED / answered
//   • gray  — steps still missing
//
// Lives next to `score-level-picker` and `topic-picker-modal` because all the
// stepper surfaces are wired to this same matrix family.

import { cn } from "@/lib/utils";

interface StepperProgressBarProps {
  total: number;
  /** 0-based index of the step the user is currently viewing. */
  currentIndex: number;
  /** Returns true when the step at this index has a saved score/answer. */
  isScored: (index: number) => boolean;
  className?: string;
}

export function StepperProgressBar({
  total,
  currentIndex,
  isScored,
  className,
}: StepperProgressBarProps) {
  if (total <= 0) {
    return <div className={cn("h-2 w-full rounded-full bg-muted-foreground/20", className)} />;
  }

  return (
    <div
      className={cn("flex h-2 w-full overflow-hidden rounded-full", className)}
      role="progressbar"
      aria-valuemin={1}
      aria-valuenow={Math.max(1, Math.min(total, currentIndex + 1))}
      aria-valuemax={total}
    >
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-full flex-1 transition-colors",
            i === currentIndex
              ? "bg-blue-500"
              : isScored(i)
                ? "bg-primary"
                : "bg-muted-foreground/20",
          )}
        />
      ))}
    </div>
  );
}
