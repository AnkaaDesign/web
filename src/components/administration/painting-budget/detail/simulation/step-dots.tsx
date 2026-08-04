import { useMemo } from "react";
import { FormSteps, type FormStep } from "@/components/ui/form-steps";
import { PAINTING_STEP_KIND_LABELS } from "@/types";
import type { PaintingProductionStep } from "@/types";

/** Entrada da sequência plana da página: telas fixas + um passo de produção por entrada. */
export type DetailEntry = { type: "faces" } | { type: "review" } | { type: "step"; stepId: string } | { type: "budget" };

export const entryKey = (entry: DetailEntry): string => (entry.type === "step" ? `step:${entry.stepId}` : entry.type);

interface StepDotsBarProps {
  entries: DetailEntry[];
  steps: PaintingProductionStep[];
  current: DetailEntry;
  onSelect: (entry: DetailEntry) => void;
  className?: string;
}

/**
 * Multistep no padrão dos wizards da casa (FormSteps: círculo numerado + nome +
 * descrição, ligados por uma linha). Como um plano pode ter dezenas de passos,
 * acima de SAMPLE_THRESHOLD a barra mostra só uma amostra — os números pulam,
 * e o salto fica visível pela própria numeração.
 */
const SAMPLE_THRESHOLD = 7;

function visibleIndexes(total: number, currentIndex: number): number[] {
  if (total <= SAMPLE_THRESHOLD) return Array.from({ length: total }, (_, index) => index);
  const picks = new Set<number>([0, 1, total - 2, total - 1, Math.round((total - 1) / 3), Math.round(((total - 1) * 2) / 3)]);
  if (currentIndex >= 0) picks.add(currentIndex);
  return [...picks].filter((index) => index >= 0 && index < total).sort((a, b) => a - b);
}

export function StepDotsBar({ entries, steps, current, onSelect, className }: StepDotsBarProps) {
  const stepById = useMemo(() => new Map(steps.map((step) => [step.id, step])), [steps]);
  const currentKey = entryKey(current);
  const currentIndex = entries.findIndex((entry) => entryKey(entry) === currentKey);

  const meta = (entry: DetailEntry): { name: string; description: string } => {
    switch (entry.type) {
      case "faces":
        return { name: "Artes", description: "Imagens por vista do implemento" };
      case "review":
        return { name: "Revisão", description: "Regiões, fronteiras e estratégias" };
      case "budget":
        return { name: "Orçamento", description: "Composição de custo e preço" };
      default: {
        const step = stepById.get(entry.stepId);
        if (!step) return { name: "Passo", description: "" };
        return { name: PAINTING_STEP_KIND_LABELS[step.kind] ?? "Passo", description: step.title };
      }
    }
  };

  const visible = visibleIndexes(entries.length, currentIndex);
  // FormSteps compara por `id` numérico: usamos a POSIÇÃO real na sequência, então
  // o número no círculo já denuncia os saltos da amostragem.
  const formSteps: FormStep[] = visible.map((index) => ({ id: index + 1, ...meta(entries[index]) }));

  return (
    <FormSteps
      steps={formSteps}
      currentStep={currentIndex + 1}
      className={className}
      onStepClick={(stepId) => {
        const entry = entries[stepId - 1];
        if (entry) onSelect(entry);
      }}
    />
  );
}
