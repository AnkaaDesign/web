import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { routes, FAVORITE_PAGES } from "../../../constants";
import { PageHeader } from "@/components/ui/page-header";
import { IconMessagePlus, IconCheck, IconLoader2, IconEye, IconArrowLeft, IconArrowRight } from "@tabler/icons-react";
import { MessageEditor } from "@/components/administration/message/editor/message-editor";
import { MessagePreviewDialog } from "@/components/administration/message/editor/message-preview-dialog";
import type { MessageFormData } from "@/components/administration/message/editor/types";
import { useCreateMessage } from "@/hooks/administration/use-message";
import type { MessageCreateFormData } from "@/schemas/message";
import { resolveTargetingToUserIds } from "@/utils/message-targeting";

export const CreateMessagePage = () => {
  const navigate = useNavigate();
  const createMessage = useCreateMessage();
  const [formState, setFormState] = useState({ isValid: false, isDirty: false, canPreview: false });
  const [stepState, setStepState] = useState({ currentStep: 1, totalSteps: 2, canGoNext: true, canGoPrev: false });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [currentData, setCurrentData] = useState<MessageFormData | null>(null);

  const handleSubmit = useCallback(async (data: MessageFormData, isDraft: boolean) => {
    try {
      console.log("Submitting message:", data, "isDraft:", isDraft);

      // Resolve targeting to user IDs (sectors/positions → user IDs)
      const targets = await resolveTargetingToUserIds(data.targeting);

      // Transform form data to match backend DTO schema
      const apiData: MessageCreateFormData = {
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

      console.log("Transformed API data:", apiData);
      console.log("Transformed API data (stringified):", JSON.stringify(apiData, null, 2));
      console.log("contentBlocks type:", typeof apiData.contentBlocks, "isArray:", Array.isArray(apiData.contentBlocks));
      console.log("contentBlocks length:", apiData.contentBlocks?.length);
      console.log("First block:", apiData.contentBlocks?.[0]);
      console.log("targets:", apiData.targets);

      await createMessage.mutateAsync(apiData);

      // Navigate to messages list on success
      navigate(routes.administration.messages?.root || routes.administration.root);
    } catch (error: any) {
      // Error is already handled by the mutation hook (toast)
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error creating message:", error);
      }
    }
  }, [createMessage, navigate]);

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

  const isSubmitting = createMessage.isPending;

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
      label: isSubmitting ? "Publicando..." : "Publicar",
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
          title="Criar Mensagem"
          icon={IconMessagePlus}
          favoritePage={FAVORITE_PAGES.ADMINISTRACAO_MENSAGENS_CRIAR}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Administração", href: routes.administration.root },
            { label: "Mensagens", href: routes.administration.messages?.root || routes.administration.root },
            { label: "Criar" },
          ]}
          actions={actions}
        />
      </div>
      <div className="flex-1 overflow-y-auto pb-6">
        <div className="container mx-auto max-w-6xl">
          <MessageEditor
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
