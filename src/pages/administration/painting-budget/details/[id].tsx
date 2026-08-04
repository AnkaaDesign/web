import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowRight,
  IconCalculator,
  IconCheck,
  IconPlayerPlay,
} from "@tabler/icons-react";

import { AnalysisTab } from "@/components/administration/painting-budget/detail/analysis-tab";
import { BudgetTab } from "@/components/administration/painting-budget/detail/budget-tab";
import { FacesCard } from "@/components/administration/painting-budget/detail/faces-card";
import { SimulationTab } from "@/components/administration/painting-budget/detail/simulation/simulation-tab";
import { StepDotsBar, entryKey, type DetailEntry } from "@/components/administration/painting-budget/detail/simulation/step-dots";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader, type PageAction } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { SECTOR_PRIVILEGES, routes } from "@/constants";
import { usePaintingAnalysisDetail, usePaintingAnalysisMutations, useProcessPaintingAnalysis } from "@/hooks";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

const PAINTING_BUDGET_PRIVILEGES = [
  SECTOR_PRIVILEGES.ADMIN,
  SECTOR_PRIVILEGES.COMMERCIAL,
  SECTOR_PRIVILEGES.FINANCIAL,
  SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
  SECTOR_PRIVILEGES.ACCOUNTING,
];

export function PaintingBudgetDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: response, isLoading } = usePaintingAnalysisDetail(id);
  const analysis = response?.data;
  const { updateMutation } = usePaintingAnalysisMutations();
  const processMutation = useProcessPaintingAnalysis();

  usePageTracker({ title: "Detalhes do Orçamento de Pintura", icon: "calculator" });

  const [selectedFaceId, setSelectedFaceId] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<DetailEntry | null>(null);

  const faces = analysis?.faces ?? [];
  const selectedFace = faces.find((face) => face.id === selectedFaceId) ?? faces[0];
  const hasProcessedFace = faces.some((face) => face.processedAt);
  const isProcessing = analysis?.status === "PROCESSING";

  const steps = useMemo(() => [...(analysis?.plan?.steps ?? [])].sort((a, b) => a.position - b.position), [analysis?.plan?.steps]);

  // Sequência plana única: [Artes] → [Revisão] → [Produção 1..N] → [Orçamento]
  const entries = useMemo<DetailEntry[]>(
    () => [{ type: "faces" }, { type: "review" }, ...steps.map((step) => ({ type: "step" as const, stepId: step.id })), { type: "budget" }],
    [steps],
  );

  // Entrada inicial: Artes enquanto nada foi processado; Revisão caso contrário.
  const currentEntry: DetailEntry = selectedEntry ?? (hasProcessedFace ? { type: "review" } : { type: "faces" });
  const currentKey = entryKey(currentEntry);
  const currentIndex = entries.findIndex((entry) => entryKey(entry) === currentKey);

  const goToOffset = useCallback(
    (offset: number) => {
      const nextIndex = currentIndex + offset;
      if (nextIndex < 0 || nextIndex >= entries.length) return;
      setSelectedEntry(entries[nextIndex]);
    },
    [currentIndex, entries],
  );

  // Alt+←/→ espelham Anterior/Próximo (ignorando campos de edição)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
      const target = event.target as HTMLElement | null;
      if (target && target.closest("input, textarea, select, [contenteditable=true]")) return;
      event.preventDefault();
      goToOffset(event.key === "ArrowLeft" ? -1 : 1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goToOffset]);

  const handleApprove = async () => {
    if (!analysis) return;
    try {
      await updateMutation.mutateAsync({ id: analysis.id, data: { status: "APPROVED" } });
      toast.success("Orçamento aprovado");
    } catch {
      // Error toast is handled by the API client interceptor
    }
  };

  const handleProcess = () => {
    if (!analysis) return;
    processMutation.mutate(
      { id: analysis.id },
      { onSuccess: () => toast.success("Processamento iniciado — esta página atualiza automaticamente") },
    );
  };

  /**
   * Mesma gramática dos wizards da casa (ex.: Pedido de Compra): um botão outline
   * de volta + UM primário que empurra o fluxo. Nada de menu de recálculo por
   * estágio na UI — "Processar análise" já roda tudo (MATCH+STRATEGY+PLAN).
   */
  const atStart = currentIndex <= 0;
  const atEnd = currentIndex >= entries.length - 1;
  const onFaces = currentEntry.type === "faces";
  const onBudget = currentEntry.type === "budget";
  const processing = isProcessing || processMutation.isPending;

  const headerActions: PageAction[] = !analysis
    ? []
    : [
        {
          key: "prev",
          label: "Voltar",
          icon: IconArrowLeft,
          variant: "outline",
          disabled: atStart,
          onClick: () => goToOffset(-1),
        },
        // Reprocessar só aparece depois que já existe análise — antes disso ele É o primário.
        ...(onFaces && hasProcessedFace
          ? [
              {
                key: "reprocess",
                label: processing ? "Processando..." : "Reprocessar",
                icon: IconPlayerPlay,
                variant: "outline" as const,
                disabled: faces.length === 0 || processing,
                loading: processing,
                onClick: handleProcess,
              },
            ]
          : []),
        onFaces && !hasProcessedFace
          ? {
              key: "process",
              label: processing ? "Processando..." : "Processar análise",
              icon: IconPlayerPlay,
              variant: "default",
              disabled: faces.length === 0 || processing,
              loading: processing,
              title: faces.length === 0 ? "Adicione ao menos uma arte do implemento" : undefined,
              onClick: handleProcess,
            }
          : onBudget
            ? {
                key: "approve",
                label: "Aprovar orçamento",
                icon: IconCheck,
                variant: "default",
                disabled: analysis.status !== "REVIEW",
                title: analysis.status !== "REVIEW" ? "Disponível quando a análise estiver em revisão" : undefined,
                loading: updateMutation.isPending,
                onClick: handleApprove,
              }
            : {
                key: "next",
                label: "Próximo",
                icon: IconArrowRight,
                variant: "default",
                disabled: atEnd,
                onClick: () => goToOffset(1),
              },
      ];

  return (
    <PrivilegeRoute requiredPrivilege={PAINTING_BUDGET_PRIVILEGES}>
      <div className="flex h-full flex-col px-4 pt-4">
        {isLoading && !analysis ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : !analysis ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Orçamento de pintura não encontrado.
          </div>
        ) : (
          <>
            <div className="flex-shrink-0">
              <PageHeader
                variant="detail"
                title={analysis.name}
                icon={IconCalculator}
                breadcrumbs={[
                  { label: "Início", href: routes.home },
                  { label: "Administração" },
                  { label: "Orçamento de Pintura", href: routes.administration.paintingBudget.root },
                  { label: analysis.name },
                ]}
                actions={headerActions}
              />
            </div>

            {analysis.status === "PROCESSING" && (
              <p className="mt-2 flex-shrink-0 text-sm text-muted-foreground">Processando imagem — esta página atualiza automaticamente.</p>
            )}
            {analysis.status === "FAILED" && analysis.processingError && (
              <div className="mt-4 flex flex-shrink-0 items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <IconAlertTriangle className="h-4 w-4 shrink-0" />
                {analysis.processingError}
              </div>
            )}

            {/* Multistep horizontal: uma bolinha por passo de produção (sem agrupamento por dia) */}
            <StepDotsBar
              className="mt-4 flex-shrink-0"
              entries={entries}
              steps={steps}
              current={currentEntry}
              onSelect={setSelectedEntry}
            />

            <div className="mt-4 min-h-0 flex-1">
              <div className="h-full min-h-0 overflow-y-auto pb-6">
                <div style={{ display: currentEntry.type === "faces" ? undefined : "none" }}>
                  <FacesCard analysis={analysis} />
                </div>
                {/* Revisão fica montada para preservar a seleção de região/face */}
                <div style={{ display: currentEntry.type === "review" ? undefined : "none" }}>
                  <AnalysisTab analysis={analysis} face={selectedFace} onSelectFace={setSelectedFaceId} />
                </div>
                {/* Passos de produção montam sob demanda — dezenas de canvases simultâneos custam caro */}
                {currentEntry.type === "step" && (
                  <SimulationTab
                    analysis={analysis}
                    stepId={currentEntry.stepId}
                    onNavigateStep={(stepId) => setSelectedEntry({ type: "step", stepId })}
                  />
                )}
                <div style={{ display: currentEntry.type === "budget" ? undefined : "none" }}>
                  <BudgetTab analysis={analysis} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </PrivilegeRoute>
  );
}

export default PaintingBudgetDetailsPage;
