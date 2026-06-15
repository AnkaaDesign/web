// workflow-stepper.tsx
// Stepper horizontal compartilhado pelos fluxos de Admissão e Rescisão.
// Renderiza pontos de ponta a ponta com uma trilha conectora contínua atrás
// deles e rótulos centralizados sob cada ponto. Quando o processo é cancelado,
// preserva visualmente a ETAPA em que parou (até `cancelledAtIndex`) e anexa um
// nó vermelho "Cancelada" ao final, exibindo a justificativa.

import { IconBan, IconCheck } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export interface WorkflowStep {
  key: string;
  label: string;
}

interface WorkflowStepperProps {
  steps: WorkflowStep[];
  /** Índice da etapa ATUAL dentro de `steps`. */
  currentIndex: number;
  /** Verdadeiro quando o processo chegou à última etapa (preenche a trilha). */
  isCompleted?: boolean;
  /** Quando presente, o processo está cancelado: dim + nó vermelho ao final. */
  cancelled?: {
    /** Etapa em que o processo estava ao ser cancelado (índice em `steps`). */
    atIndex: number;
    reason?: string | null;
    label?: string;
  } | null;
  className?: string;
}

export function WorkflowStepper({ steps, currentIndex, isCompleted, cancelled, className }: WorkflowStepperProps) {
  const n = steps.length;
  // Quando cancelado, a "etapa atual" exibida é onde o processo parou.
  const effectiveIndex = cancelled ? cancelled.atIndex : currentIndex;

  // Largura do preenchimento: termina EXATAMENTE no centro do círculo atual.
  // Os círculos não são interpolados linearmente — o primeiro é alinhado à
  // esquerda (centro em 1rem), o último à direita (centro em 100% - 1rem) e os
  // do meio centralizados em colunas iguais (centro = (i + 0.5) * 100% / n). A
  // trilha começa em 1rem (left-4), então a largura = centro atual - 1rem.
  const fillWidth =
    isCompleted || effectiveIndex >= n - 1
      ? "calc(100% - 2rem)"
      : effectiveIndex <= 0
        ? "0px"
        : `calc((${effectiveIndex} + 0.5) * (100% / ${n}) - 1rem)`;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-start gap-2">
        <div className={cn("relative flex-1", cancelled && "opacity-50")}>
          {n > 1 && (
            <>
              <div className="absolute top-4 left-4 right-4 h-0.5 -translate-y-1/2 bg-border" />
              <div className="absolute top-4 left-4 h-0.5 -translate-y-1/2 bg-primary transition-all" style={{ width: fillWidth }} />
            </>
          )}
          <div className="relative flex items-start justify-between">
            {steps.map((step, index) => {
              const isDone = (!cancelled && (isCompleted || index < currentIndex)) || (cancelled && index < cancelled.atIndex);
              const isCurrent = !isCompleted && index === effectiveIndex;
              const isFirst = index === 0;
              const isLast = index === n - 1;

              return (
                <div key={step.key} className={cn("flex min-w-0 flex-1 flex-col", isFirst ? "items-start" : isLast ? "items-end" : "items-center")}>
                  <div
                    className={cn(
                      "relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 bg-background text-xs font-semibold transition-colors",
                      isDone && "border-primary bg-primary text-primary-foreground",
                      isCurrent && "border-primary text-primary",
                      !isDone && !isCurrent && "border-border text-muted-foreground",
                    )}
                  >
                    {isDone ? <IconCheck className="h-4 w-4" /> : index + 1}
                  </div>
                  <span
                    className={cn(
                      "mt-2 w-full px-1 text-[11px] leading-tight break-words sm:text-xs",
                      isFirst ? "text-left" : isLast ? "text-right" : "text-center",
                      isCurrent ? "font-semibold text-primary" : isDone ? "font-medium text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {cancelled && (
          <div className="relative flex flex-shrink-0 flex-col items-center">
            <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-destructive bg-destructive text-destructive-foreground">
              <IconBan className="h-4 w-4" />
            </div>
            <span className="mt-2 text-center text-[11px] font-semibold text-destructive sm:text-xs">{cancelled.label ?? "Cancelada"}</span>
          </div>
        )}
      </div>

      {cancelled && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
          <p className="font-medium text-destructive">
            Cancelada na etapa "{steps[cancelled.atIndex]?.label ?? "—"}"
          </p>
          {cancelled.reason ? (
            <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{cancelled.reason}</p>
          ) : (
            <p className="mt-0.5 text-muted-foreground">Este processo foi cancelado e não pode mais ser avançado.</p>
          )}
        </div>
      )}
    </div>
  );
}
