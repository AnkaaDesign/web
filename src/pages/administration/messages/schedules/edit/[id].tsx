import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { routes } from "../../../../../constants";
import { PageHeader } from "@/components/ui/page-header";
import {
  IconRepeat,
  IconCheck,
  IconLoader2,
  IconEye,
  IconArrowLeft,
  IconArrowRight,
} from "@tabler/icons-react";
import { MessageEditor } from "@/components/administration/message/editor/message-editor";
import { MessagePreviewDialog } from "@/components/administration/message/editor/message-preview-dialog";
import type { MessageFormData } from "@/components/administration/message/editor/types";
import {
  useMessageSchedule,
  useUpdateMessageSchedule,
} from "@/hooks/administration/use-message-schedule";
import { buildSchedulePayload, scheduleToFormData } from "@/utils/message-recurrence";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavBreadcrumbs } from "@/contexts/navigation-context";

/**
 * Editar um comunicado RECORRENTE.
 *
 * A regra existia desde o primeiro dia, mas só dava para criá-la, pausá-la e
 * apagá-la: um erro de cadência ou uma linha errada no texto obrigava a excluir
 * o agendamento e refazê-lo, e refazer significa perder o vínculo com o que já
 * foi publicado (as ocorrências viram mensagens avulsas) e recomeçar a contagem
 * de `maxOccurrences`.
 *
 * O que se edita aqui vale para as publicações FUTURAS. As já publicadas guardam
 * o que foi enviado no dia — não se reescreve um comunicado que o quadro já leu.
 *
 * É o MESMO formulário da criação, com a recorrência travada em ligada: o
 * registro é um agendamento, e desligar o interruptor não teria como significar
 * "vire uma mensagem avulsa" sem decidir por baixo do pano o destino das
 * ocorrências já no ar.
 */
export const EditMessageSchedulePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: response, isLoading, error } = useMessageSchedule(id!);
  const updateSchedule = useUpdateMessageSchedule();

  const breadcrumbs = useNavBreadcrumbs([
    { label: "Início", href: routes.home },
    { label: "Administração", href: routes.administration.root },
    { label: "Mensagens", href: routes.administration.messages?.root || routes.administration.root },
    { label: "Editar recorrente" },
  ]);

  const [formState, setFormState] = useState({ isValid: false, isDirty: false, canPreview: false });
  const [stepState, setStepState] = useState({ currentStep: 1, totalSteps: 2, canGoNext: true, canGoPrev: false });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [currentData, setCurrentData] = useState<MessageFormData | null>(null);
  const [initialData, setInitialData] = useState<Partial<MessageFormData>>({});

  // Semeia o formulário UMA vez. O `MessageEditor` reaplica `initialData` sempre
  // que a referência muda, e o React Query revalida ao voltar o foco da janela —
  // sem esta trava, alternar de aba no meio da edição jogaria fora o que já
  // tinha sido digitado.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || !response?.data) return;
    seededRef.current = true;
    setInitialData(scheduleToFormData(response.data));
  }, [response]);

  const handleSubmit = useCallback(
    async (data: MessageFormData, isDraft: boolean) => {
      try {
        await updateSchedule.mutateAsync({
          id: id!,
          // Mesmo construtor do compositor: o corpo do PUT é idêntico ao do POST,
          // então não há um segundo formato para manter em sincronia.
          // "Salvar Rascunho" aqui significa PAUSAR — a regra fica gravada e para
          // de publicar, que é o análogo honesto de um rascunho para uma regra.
          data: buildSchedulePayload({ ...data, isDraft }),
        });
        navigate(routes.administration.messages?.root || routes.administration.root);
      } catch (error: any) {
        // O interceptador do axios já mostra o erro da API como toast.
        if (process.env.NODE_ENV !== "production") {
          console.error("Error updating message schedule:", error);
        }
      }
    },
    [id, updateSchedule, navigate],
  );

  const handlePreview = useCallback((data: MessageFormData) => {
    setCurrentData(data);
    setPreviewOpen(true);
  }, []);

  const handleFormStateChange = useCallback(
    (state: { isValid: boolean; isDirty: boolean; canPreview: boolean }) => setFormState(state),
    [],
  );

  const handleStepChange = useCallback(
    (step: number, totalSteps: number, canGoNext: boolean, canGoPrev: boolean) =>
      setStepState({ currentStep: step, totalSteps, canGoNext, canGoPrev }),
    [],
  );

  const handleNextStep = () => {
    const editorComponent = document.querySelector("[data-message-editor]") as any;
    editorComponent?.goToNextStep?.();
  };

  const handlePreviousStep = () => {
    const editorComponent = document.querySelector("[data-message-editor]") as any;
    editorComponent?.goToPreviousStep?.();
  };

  const isSubmitting = updateSchedule.isPending;

  if (isLoading) {
    return (
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <div className="container mx-auto max-w-6xl flex-shrink-0">
          <Skeleton className="h-16 w-full" />
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="container mx-auto max-w-6xl">
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !response?.data) {
    return (
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <div className="container mx-auto max-w-6xl">
          <Alert variant="destructive">
            <AlertDescription>
              {error ? "Erro ao carregar o agendamento." : "Agendamento não encontrado."}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const schedule = response.data;

  const actions = [
    ...(formState.canPreview
      ? [
          {
            key: "preview",
            label: "Preview",
            icon: IconEye,
            onClick: () => {
              const editorComponent = document.querySelector("[data-message-editor]") as any;
              if (editorComponent?.getData) handlePreview(editorComponent.getData());
            },
            variant: "outline" as const,
            disabled: isSubmitting,
          },
        ]
      : []),
    // Numa REGRA, "rascunho" é pausa: a configuração fica gravada e nada é
    // publicado até alguém retomar.
    ...(stepState.currentStep === stepState.totalSteps
      ? [
          {
            key: "draft",
            label: isSubmitting ? "Salvando..." : "Salvar e Pausar",
            icon: isSubmitting ? IconLoader2 : undefined,
            onClick: () => document.getElementById("message-form-draft")?.click(),
            variant: "secondary" as const,
            disabled: !formState.isValid || isSubmitting,
          },
        ]
      : []),
    ...(stepState.currentStep > 1
      ? [
          {
            key: "previous",
            label: "Anterior",
            icon: IconArrowLeft,
            onClick: handlePreviousStep,
            variant: "outline" as const,
            disabled: isSubmitting,
          },
        ]
      : []),
    ...(stepState.currentStep < stepState.totalSteps
      ? [
          {
            key: "next",
            label: "Próximo",
            icon: IconArrowRight,
            iconPosition: "right" as const,
            onClick: handleNextStep,
            variant: "outline" as const,
            disabled: isSubmitting || !stepState.canGoNext,
          },
        ]
      : []),
    ...(stepState.currentStep === stepState.totalSteps
      ? [
          {
            key: "publish",
            label: isSubmitting ? "Salvando..." : "Salvar e Ativar",
            icon: isSubmitting ? IconLoader2 : IconCheck,
            onClick: () => document.getElementById("message-form-publish")?.click(),
            variant: "default" as const,
            disabled: !formState.isValid || isSubmitting,
          },
        ]
      : []),
  ];

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <div className="container mx-auto max-w-6xl flex-shrink-0">
        <PageHeader
          title="Editar Mensagem Recorrente"
          icon={IconRepeat}
          breadcrumbs={breadcrumbs}
          actions={actions}
        />
      </div>
      <div className="flex-1 overflow-y-auto pb-6">
        <div className="container mx-auto max-w-6xl space-y-4">
          {schedule.occurrenceCount > 0 && (
            <Alert>
              <AlertDescription>
                Este agendamento já publicou {schedule.occurrenceCount} comunicado(s). As
                alterações valem para as publicações <strong>futuras</strong> — as já enviadas
                guardam o que o quadro leu no dia.
              </AlertDescription>
            </Alert>
          )}

          <MessageEditor
            initialData={initialData}
            onSubmit={handleSubmit}
            lockRecurrence
            onFormStateChange={handleFormStateChange}
            onStepChange={handleStepChange}
          />
        </div>
      </div>

      {currentData && (
        <MessagePreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          data={currentData}
        />
      )}
    </div>
  );
};
