import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { routes, FAVORITE_PAGES } from "../../../../constants";
import { PageHeader } from "@/components/ui/page-header";
import { IconPencil, IconCheck, IconLoader2, IconEye, IconArrowLeft, IconArrowRight } from "@tabler/icons-react";
import { MessageEditor } from "@/components/administration/message/editor/message-editor";
import { MessagePreviewDialog } from "@/components/administration/message/editor/message-preview-dialog";
import type { MessageFormData } from "@/components/administration/message/editor/types";
import { useMessage, useUpdateMessage } from "@/hooks/administration/use-message";
import type { MessageUpdateFormData } from "@/schemas/message";
import { resolveTargetingToUserIds } from "@/utils/message-targeting";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const EditMessagePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: response, isLoading, error } = useMessage(id!);
  const updateMessage = useUpdateMessage();
  const [formState, setFormState] = useState({ isValid: false, isDirty: false, canPreview: false });
  const [stepState, setStepState] = useState({ currentStep: 1, totalSteps: 2, canGoNext: true, canGoPrev: false });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [currentData, setCurrentData] = useState<MessageFormData | null>(null);
  const [initialData, setInitialData] = useState<Partial<MessageFormData>>({});

  // Load message data and transform to form format
  useEffect(() => {
    if (response?.data) {
      const message = response.data;

      // Extract blocks from content
      let blocks = [];
      if (message.content?.blocks) {
        blocks = message.content.blocks;
      } else if (Array.isArray(message.content)) {
        blocks = message.content;
      }

      // Transform targets array back to targeting UI state
      // Empty targets = all users, otherwise = specific users
      const targeting = {
        type: (!message.targets || message.targets.length === 0) ? 'all' as const : 'specific' as const,
        userIds: message.targets?.map((t: any) => t.userId) || [],
      };

      const formData: Partial<MessageFormData> = {
        title: message.title || '',
        blocks: blocks || [],
        targeting,
        scheduling: {
          startDate: message.startDate ? new Date(message.startDate) : undefined,
          endDate: message.endDate ? new Date(message.endDate) : undefined,
        },
      };

      console.log('[EditMessagePage] Loaded message data:', message);
      console.log('[EditMessagePage] Transformed to form data:', formData);

      setInitialData(formData);
    }
  }, [response]);

  const handleSubmit = useCallback(async (data: MessageFormData, isDraft: boolean) => {
    try {
      console.log("Updating message:", id, data, "isDraft:", isDraft);

      // Resolve targeting to user IDs (sectors/positions → user IDs)
      const targets = await resolveTargetingToUserIds(data.targeting);

      // Transform form data to match backend DTO schema
      const apiData: MessageUpdateFormData = {
        title: data.title,
        contentBlocks: data.blocks,
        targets, // Simple array of user IDs (empty = all users)
        isActive: !isDraft,
      };

      // Add scheduling fields if provided
      if (data.scheduling?.startDate) {
        apiData.startsAt = data.scheduling.startDate.toISOString();
      }

      if (data.scheduling?.endDate) {
        apiData.endsAt = data.scheduling.endDate.toISOString();
      }

      console.log("Transformed update API data:", apiData);

      await updateMessage.mutateAsync({ id: id!, data: apiData });

      // Navigate to message detail page on success
      navigate(routes.administration.messages.details(id!));
    } catch (error: any) {
      // Error is already handled by the mutation hook (toast)
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error updating message:", error);
      }
    }
  }, [id, updateMessage, navigate]);

  const handleCancel = () => {
    navigate(routes.administration.messages.details(id!));
  };

  const handlePreview = useCallback((data: MessageFormData) => {
    setCurrentData(data);
    setPreviewOpen(true);
  }, []);

  const handleFormStateChange = useCallback((state: { isValid: boolean; isDirty: boolean; canPreview: boolean }) => {
    setFormState(state);
  }, []);

  const handleStepChange = useCallback((step: number, totalSteps: number, canGoNext: boolean, canGoPrev: boolean) => {
    setStepState({ currentStep: step, totalSteps, canGoNext, canGoPrev });
  }, []);

  const handleNextStep = () => {
    const editorComponent = document.querySelector('[data-message-editor]') as any;
    if (editorComponent && editorComponent.goToNextStep) {
      editorComponent.goToNextStep();
    }
  };

  const handlePreviousStep = () => {
    const editorComponent = document.querySelector('[data-message-editor]') as any;
    if (editorComponent && editorComponent.goToPreviousStep) {
      editorComponent.goToPreviousStep();
    }
  };

  const isSubmitting = updateMessage.isPending;

  // Loading state
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

  // Error state
  if (error || !response?.data) {
    return (
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <div className="container mx-auto max-w-6xl">
          <Alert variant="destructive">
            <AlertDescription>
              {error ? "Erro ao carregar mensagem." : "Mensagem não encontrada."}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const actions = [
    // Preview - only visible when there are blocks (LEFT POSITION)
    ...(formState.canPreview ? [{
      key: "preview",
      label: "Preview",
      icon: IconEye,
      onClick: () => {
        const editorComponent = document.querySelector('[data-message-editor]') as any;
        if (editorComponent && editorComponent.getData) {
          handlePreview(editorComponent.getData());
        }
      },
      variant: "outline" as const,
      disabled: isSubmitting,
    }] : []),
    // Save Draft - only visible on last step (LEFT POSITION)
    ...(stepState.currentStep === stepState.totalSteps ? [{
      key: "draft",
      label: isSubmitting ? "Salvando..." : "Salvar Rascunho",
      icon: isSubmitting ? IconLoader2 : undefined,
      onClick: () => document.getElementById("message-form-draft")?.click(),
      variant: "secondary" as const,
      disabled: !formState.isValid || isSubmitting,
    }] : []),
    // Previous - only visible when NOT on first step
    ...(stepState.currentStep > 1 ? [{
      key: "previous",
      label: "Anterior",
      icon: IconArrowLeft,
      onClick: handlePreviousStep,
      variant: "outline" as const,
      disabled: isSubmitting,
    }] : []),
    // Next - only visible when NOT on last step
    ...(stepState.currentStep < stepState.totalSteps ? [{
      key: "next",
      label: "Próximo",
      icon: IconArrowRight,
      iconPosition: "right" as const,
      onClick: handleNextStep,
      variant: "outline" as const,
      disabled: isSubmitting,
    }] : []),
    // Publish - only visible on last step (RIGHT POSITION)
    ...(stepState.currentStep === stepState.totalSteps ? [{
      key: "publish",
      label: isSubmitting ? "Salvando..." : "Salvar e Publicar",
      icon: isSubmitting ? IconLoader2 : IconCheck,
      onClick: () => document.getElementById("message-form-publish")?.click(),
      variant: "default" as const,
      disabled: !formState.isValid || isSubmitting,
    }] : []),
  ];

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <div className="container mx-auto max-w-6xl flex-shrink-0">
        <PageHeader
          title="Editar Mensagem"
          icon={IconPencil}
          favoritePage={FAVORITE_PAGES.ADMINISTRACAO_MENSAGENS_EDITAR}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Administração", href: routes.administration.root },
            { label: "Mensagens", href: routes.administration.messages?.root || routes.administration.root },
            { label: "Editar" },
          ]}
          actions={actions}
        />
      </div>
      <div className="flex-1 overflow-y-auto pb-6">
        <div className="container mx-auto max-w-6xl">
          <MessageEditor
            initialData={initialData}
            onSubmit={handleSubmit}
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
