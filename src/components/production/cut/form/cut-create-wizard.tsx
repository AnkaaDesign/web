// Cut create wizard — the "Adicionar" flow on the cuts page.
//
// A 3-step wizard mirroring the airbrushing create form (airbrushing-form.tsx):
//   1. Configurações — the cut plans: reuses the task form's MultiCutSelector, so each row is a
//                      file + type + QUANTITY, and you can add multiple cuts ("Adicionar Corte").
//   2. Tarefas       — one or more tasks (reuses the shared TaskSelector).
//   3. Revisão       — confirm; the config is fanned out over every (task × cut × quantity).
//
// Cuts reference an already-uploaded fileId, so on submit we FIRST upload each cut's file (→ id)
// and THEN issue a single batch-create: for every selected task, for every cut plan, `quantity`
// PLAN cuts. tasks × Σ(quantity) cuts in one request.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import {
  IconScissors,
  IconClipboardList,
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconLoader2,
  IconStack2,
  IconFileText,
} from "@tabler/icons-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, type PageAction } from "@/components/ui/page-header";
import { FormSteps } from "@/components/ui/form-steps";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import type { FileWithPreview } from "@/components/common/file";
import { MultiCutSelector, type EmittedCut } from "@/components/production/task/form/multi-cut-selector";
import { TaskSelector } from "@/components/production/airbrushing/form/task-selector";
import type { ClusteredTask } from "@/components/production/task/preparation/cluster-tasks";
import { SelectedTasksSummary } from "@/components/production/task/form/selected-tasks-summary";

import { useCutBatchMutations } from "../../../../hooks";
import { uploadSingleFile } from "../../../../api-client";
import type { CutBatchCreateData } from "../../../../types";
import {
  routes,
  FAVORITE_PAGES,
  CUT_TYPE,
  CUT_TYPE_LABELS,
  CUT_ORIGIN,
} from "../../../../constants";

// One row of the MultiCutSelector field array (matches its `addCut` shape).
interface CutFormEntry {
  id: string;
  type: CUT_TYPE;
  quantity: number;
  origin: CUT_ORIGIN;
  fileId?: string;
  file?: FileWithPreview;
  fileName?: string;
}
interface CutWizardForm {
  cuts: CutFormEntry[];
}

const makeEmptyCut = (): CutFormEntry => ({
  id: `cut-${Date.now()}`,
  type: CUT_TYPE.VINYL,
  quantity: 1,
  origin: CUT_ORIGIN.PLAN,
  fileId: undefined,
  file: undefined,
  fileName: undefined,
});


// Three-step wizard definition (mirrors the airbrushing wizard).
const STEPS = [
  { id: 1, name: "Configurações", description: "Planos de corte e arquivos" },
  { id: 2, name: "Tarefas", description: "Selecione uma ou mais tarefas" },
  { id: 3, name: "Revisão", description: "Confirme antes de criar" },
];

// URL-backed step state (mirrors the airbrushing/order wizards).
const getStepFromUrl = (searchParams: URLSearchParams): number => {
  const step = parseInt(searchParams.get("step") || "1", 10);
  return Math.max(1, Math.min(STEPS.length, Number.isNaN(step) ? 1 : step));
};
const setStepInUrl = (searchParams: URLSearchParams, step: number): URLSearchParams => {
  const params = new URLSearchParams(searchParams);
  params.set("step", step.toString());
  return params;
};

interface CutCreateWizardProps {
  /** Optional deep-link: pre-select a task via ?taskId= (from a task detail page). */
  initialTaskId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
}

export const CutCreateWizard = ({ initialTaskId, onSuccess, onCancel, className }: CutCreateWizardProps) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [currentStep, setCurrentStep] = useState<number>(() => getStepFromUrl(searchParams));

  // The cut plans live in RHF so we can reuse the task form's MultiCutSelector verbatim.
  const form = useForm<CutWizardForm>({ defaultValues: { cuts: [makeEmptyCut()] } });

  // Task selection — any number of tasks; the plans are fanned out over each.
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set(initialTaskId ? [initialTaskId] : []));
  const [selectedTaskRows, setSelectedTaskRows] = useState<ClusteredTask[]>([]);

  // Authoritative cut rows lifted from MultiCutSelector (its own robust file detection). The wizard's
  // form.watch("cuts") can't reliably see a freshly-picked file, so review + validation + submit all
  // read THIS instead of the raw form array — this is the "0 recortes" fix.
  const [selectorCuts, setSelectorCuts] = useState<EmittedCut[]>([]);
  const handleCutsChange = useCallback((cuts: EmittedCut[]) => setSelectorCuts(cuts), []);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const { batchCreateAsync } = useCutBatchMutations();

  // Seed a task from a ?taskId= deep-link (once).
  useEffect(() => {
    const taskIdFromUrl = searchParams.get("taskId");
    if (taskIdFromUrl) setSelectedTasks((prev) => (prev.has(taskIdFromUrl) ? prev : new Set([taskIdFromUrl])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the local step in sync with the URL (back/forward).
  useEffect(() => {
    const stepFromUrl = getStepFromUrl(searchParams);
    if (stepFromUrl !== currentStep) setCurrentStep(stepFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const goToStep = useCallback(
    (step: number) => {
      const clamped = Math.max(1, Math.min(STEPS.length, step));
      setCurrentStep(clamped);
      setSearchParams((prev) => setStepInUrl(prev, clamped), { replace: true });
    },
    [setSearchParams],
  );

  const handleTaskSelectionChange = useCallback((taskIds: string[], rows: ClusteredTask[]) => {
    setSelectedTasks(new Set(taskIds));
    setSelectedTaskRows(rows);
  }, []);

  const taskIds = useMemo(() => Array.from(selectedTasks), [selectedTasks]);

  // Reactive review data — derived from the cut rows the selector lifts up (robust file detection).
  const reviewCuts = useMemo(() => selectorCuts.filter((c) => c.hasFile), [selectorCuts]);
  const cutsPerTask = useMemo(() => reviewCuts.reduce((s, c) => s + Math.max(1, c.quantity || 1), 0), [reviewCuts]);
  const totalCuts = cutsPerTask * taskIds.length;

  // Expand to ONE entry per cut that will actually be created: for each task × each plan × quantity.
  // The review lists these so the card count matches "N recortes serão criados" (not just the plans).
  const expandedCuts = useMemo(() => {
    const out: Array<{ key: string; fileName: string; type: CUT_TYPE; taskName: string; identifier: string }> = [];
    for (const t of selectedTaskRows) {
      const identifier = [t.serialNumber, t.truck?.plate].filter(Boolean).join(" · ");
      for (const c of reviewCuts) {
        const q = Math.max(1, c.quantity || 1);
        for (let i = 0; i < q; i++) {
          out.push({
            key: `${t.id}-${c.id}-${i}`,
            fileName: c.file?.name || c.fileName || "Arquivo",
            type: c.type,
            taskName: t.name || "-",
            identifier,
          });
        }
      }
    }
    return out;
  }, [selectedTaskRows, reviewCuts]);

  // Per-step gate (mirrors the airbrushing wizard's validateCurrentStep).
  const validateStep = useCallback(
    (step: number): boolean => {
      if (step === 1) {
        if (!selectorCuts.some((c) => c.hasFile)) {
          toast.error("Adicione ao menos um corte com arquivo.");
          return false;
        }
        return true;
      }
      if (step === 2 && selectedTasks.size === 0) {
        toast.error("Selecione ao menos uma tarefa.");
        return false;
      }
      return true;
    },
    [selectorCuts, selectedTasks.size],
  );

  const handleNext = useCallback(() => {
    if (validateStep(currentStep)) goToStep(currentStep + 1);
  }, [validateStep, currentStep, goToStep]);

  const handleCancel = useCallback(() => {
    if (onCancel) return onCancel();
    navigate(routes.production.cutting.list);
  }, [onCancel, navigate]);

  const handleSubmit = useCallback(async () => {
    const cuts = selectorCuts.filter((c) => c.hasFile);
    if (cuts.length === 0) {
      toast.error("Adicione ao menos um corte com arquivo.");
      goToStep(1);
      return;
    }
    if (taskIds.length === 0) {
      toast.error("Selecione ao menos uma tarefa.");
      goToStep(2);
      return;
    }

    setIsSubmitting(true);
    try {
      // 1) Resolve a fileId for each cut plan — upload the picked file if it isn't already uploaded.
      //    (Sequential per-file so the id maps back to the right plan; the set is small, ≤10.)
      const resolved: Array<{ fileId: string; type: CUT_TYPE; quantity: number }> = [];
      for (const c of cuts) {
        let fileId = c.fileId;
        if (!fileId && c.file) {
          const res = await uploadSingleFile(c.file);
          if (!res.success || !res.data?.id) {
            toast.error(`Não foi possível enviar o arquivo "${c.file.name}".`);
            return;
          }
          fileId = res.data.id;
        }
        if (fileId) resolved.push({ fileId, type: c.type ?? CUT_TYPE.VINYL, quantity: Math.max(1, c.quantity || 1) });
      }
      if (resolved.length === 0) {
        toast.error("Nenhum arquivo válido para criar recortes.");
        return;
      }

      // 2) Fan out: one PLAN cut per (task × plan × quantity).
      const payload: CutBatchCreateData[] = [];
      for (const taskId of taskIds) {
        for (const r of resolved) {
          for (let q = 0; q < r.quantity; q++) {
            payload.push({ fileId: r.fileId, taskId, type: r.type, origin: CUT_ORIGIN.PLAN });
          }
        }
      }

      // The batch-create hook surfaces its own success/error toast + invalidation.
      await batchCreateAsync({ cuts: payload } as never);

      if (onSuccess) onSuccess();
      else navigate(routes.production.cutting.list);
    } catch {
      // Upload failure (the batch-create hook already toasts its own errors).
      toast.error("Erro ao criar os recortes. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }, [selectorCuts, taskIds, batchCreateAsync, onSuccess, navigate, goToStep]);

  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === STEPS.length;
  const canSubmit = reviewCuts.length > 0 && taskIds.length > 0;

  // Navigation actions (owned by the form; matches the airbrushing wizard).
  const navigationActions: PageAction[] = [
    { key: "cancel", label: "Cancelar", onClick: handleCancel, variant: "outline", disabled: isSubmitting },
  ];
  if (!isFirstStep) {
    navigationActions.push({
      key: "previous",
      label: "Anterior",
      icon: IconArrowLeft,
      onClick: () => goToStep(currentStep - 1),
      variant: "outline",
      disabled: isSubmitting,
    });
  }
  if (!isLastStep) {
    navigationActions.push({
      key: "next",
      label: "Próximo",
      icon: IconArrowRight,
      onClick: handleNext,
      variant: "default",
      disabled: isSubmitting,
    });
  } else {
    navigationActions.push({
      key: "submit",
      label: "Cadastrar",
      icon: isSubmitting ? IconLoader2 : IconCheck,
      onClick: handleSubmit,
      variant: "default",
      disabled: isSubmitting || !canSubmit,
      loading: isSubmitting,
    });
  }

  return (
    <div className={cn("h-full flex flex-col gap-4 bg-background px-4 pt-4 pb-4", className)}>
      <PageHeader
        className="flex-shrink-0"
        variant="form"
        title="Novo Recorte"
        icon={IconScissors}
        favoritePage={FAVORITE_PAGES.PRODUCAO_RECORTE_CADASTRAR}
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Produção", href: routes.production.root },
          { label: "Recortes", href: routes.production.cutting.list },
          { label: "Criar" },
        ]}
        actions={navigationActions}
      />

      <Card className="flex-1 min-h-0 flex flex-col shadow-sm border border-border">
        <CardContent className="flex-1 flex flex-col p-4 overflow-hidden min-h-0">
          <FormProvider {...form}>
            <form className="flex flex-col h-full" onSubmit={(e) => e.preventDefault()}>
              {/* Stepper */}
              <div className="flex-shrink-0 mb-6">
                <FormSteps steps={STEPS} currentStep={currentStep} />
              </div>

              {/* Step content — step 2 (task table) takes full height. */}
              <div className={cn("flex-1 min-h-0", currentStep === 2 ? "flex flex-col overflow-hidden" : "overflow-y-auto")}>
                {/* ---------- Step 1: Configurações (cut plans) ---------- */}
                {currentStep === 1 && (
                  <div className="space-y-4">
                    <Card className="w-full">
                      <CardContent className="p-4">
                        <MultiCutSelector control={form.control} disabled={isSubmitting} onCutsChange={handleCutsChange} />
                      </CardContent>
                    </Card>
                    <p className="text-xs text-muted-foreground px-1">
                      Cada corte será criado para cada tarefa selecionada, na quantidade informada.
                    </p>
                  </div>
                )}

                {/* ---------- Step 2: Tarefas ---------- */}
                {currentStep === 2 && (
                  <div className="flex flex-col h-full min-h-0 space-y-4">
                    <TaskSelector
                      selectedTaskIds={taskIds}
                      onSelectionChange={handleTaskSelectionChange}
                      selectionMode="multiple"
                      className="flex-1 min-h-0"
                    />
                  </div>
                )}

                {/* ---------- Step 3: Revisão ---------- */}
                {currentStep === 3 && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-xl font-semibold text-foreground">Revisão dos Recortes</h2>
                      <p className="text-sm text-muted-foreground mt-1">Confirme os detalhes antes de cadastrar.</p>
                    </div>

                    {/* Total callout */}
                    <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
                      <IconStack2 className="h-6 w-6 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          {totalCuts} {totalCuts === 1 ? "recorte será criado" : "recortes serão criados"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {cutsPerTask} {cutsPerTask === 1 ? "recorte" : "recortes"} por tarefa × {taskIds.length}{" "}
                          {taskIds.length === 1 ? "tarefa" : "tarefas"}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Cut plans card */}
                      <Card className="h-full">
                        <CardHeader className="pb-4">
                          <CardTitle className="flex items-center gap-2">
                            <IconScissors className="h-5 w-5" />
                            Cortes ({expandedCuts.length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          {expandedCuts.length > 0 ? (
                            <div className="space-y-2">
                              {expandedCuts.map((c) => (
                                <div key={c.key} className="flex items-center gap-3 bg-muted/50 rounded-lg px-4 py-2.5">
                                  <IconFileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">{c.fileName}</p>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {c.taskName}
                                      {c.identifier ? ` · ${c.identifier}` : ""}
                                    </p>
                                  </div>
                                  <span className="text-xs text-muted-foreground shrink-0">{CUT_TYPE_LABELS[c.type] || c.type}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">Nenhum corte com arquivo.</p>
                          )}
                        </CardContent>
                      </Card>

                      {/* Tasks card */}
                      <Card className="h-full">
                        <CardHeader className="pb-4">
                          <CardTitle className="flex items-center gap-2">
                            <IconClipboardList className="h-5 w-5" />
                            Tarefas ({taskIds.length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <SelectedTasksSummary tasks={selectedTaskRows} />
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}
              </div>
            </form>
          </FormProvider>
        </CardContent>
      </Card>
    </div>
  );
};

CutCreateWizard.displayName = "CutCreateWizard";
