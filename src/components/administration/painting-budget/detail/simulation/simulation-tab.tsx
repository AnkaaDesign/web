import { IconChevronLeft, IconChevronRight, IconListCheck, IconTimeline } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { PaintingAnalysis } from "@/types";
import { formatMinutesLabel } from "../common";
import { StepCanvas } from "./step-canvas";
import { StepCostTable } from "./step-cost-table";

interface SimulationTabProps {
  analysis: PaintingAnalysis;
  stepId: string;
  onNavigateStep: (stepId: string) => void;
}

/**
 * Tela de um passo de produção: cabeçalho (nº, título, família, dia/sessão), canvas de simulação
 * (tolerante a `visualization` ausente — a API ainda não emite a cena) e composição de custos.
 * CURA é tela especial: canvas com overlay de relógio, sem tabela de composição.
 */
export function SimulationTab({ analysis, stepId, onNavigateStep }: SimulationTabProps) {
  const steps = [...(analysis.plan?.steps ?? [])].sort((a, b) => a.position - b.position);
  const index = steps.findIndex((step) => step.id === stepId);
  const step = index >= 0 ? steps[index] : undefined;

  if (!step) {
    return (
      <Card>
        <CardContent className="py-6">
          <EmptyState
            icon={<IconTimeline className="h-10 w-10" />}
            title="Passo não encontrado"
            description="O plano foi recalculado — selecione um passo no painel lateral."
          />
        </CardContent>
      </Card>
    );
  }

  const faces = analysis.faces ?? [];
  const face = (step.faceId ? faces.find((analysisFace) => analysisFace.id === step.faceId) : undefined) ?? faces.find((analysisFace) => analysisFace.processedAt);
  const isCure = step.kind === "CURA";
  const tasks = [...(step.tasks ?? [])].sort((a, b) => a.position - b.position);
  const visualization = step.visualization ?? null;
  const cureLabel = isCure ? formatMinutesLabel(Number(step.waitMinutes) || Number(step.minutes) || 0) : null;
  // Sem cena da API → card do passo sem canvas (só descrição + tabela); CURA sempre mostra a face com o relógio.
  const showCanvas = !!face && (visualization != null || isCure);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-col gap-4 space-y-0 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="flex flex-wrap items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{step.position}</span>
              {step.title}
            </CardTitle>
            {Number(step.waitMinutes) > 0 && (
              <CardDescription>espera de {formatMinutesLabel(Number(step.waitMinutes) || 0)} após este passo</CardDescription>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" disabled={index <= 0} onClick={() => onNavigateStep(steps[index - 1].id)} title="Passo anterior">
              <IconChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm tabular-nums text-muted-foreground">
              {index + 1}/{steps.length}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={index >= steps.length - 1}
              onClick={() => onNavigateStep(steps[index + 1].id)}
              title="Próximo passo"
            >
              <IconChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {showCanvas && face && <StepCanvas face={face} visualization={visualization} cureLabel={cureLabel} />}
          {/* Passos de superfície não vêm da arte — o roteiro de sub-tarefas é a "cena" deles. */}
          {!showCanvas && tasks.length > 0 && (
            <div className="rounded-md border border-border bg-muted/20 p-4">
              <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <IconListCheck className="h-4 w-4" />
                Roteiro do passo
              </p>
              <ol className="flex flex-col gap-2">
                {tasks.map((task, taskIndex) => (
                  <li key={task.id} className="flex items-start gap-3 text-sm">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold tabular-nums">
                      {taskIndex + 1}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span>{task.label}</span>
                      {task.basisQuantity > 0 && task.basisUnit && (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {task.basisQuantity} {task.basisUnit}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {step.description && <p className="text-sm text-muted-foreground">{step.description}</p>}
          {isCure && (
            <p className="text-sm text-muted-foreground">
              Espera de {cureLabel} — o trabalho segue em outra área enquanto a tinta cura.
            </p>
          )}
        </CardContent>
      </Card>

      {!isCure && <StepCostTable step={step} laborRatePerHour={analysis.plan?.laborRatePerHour ?? null} />}
    </div>
  );
}
