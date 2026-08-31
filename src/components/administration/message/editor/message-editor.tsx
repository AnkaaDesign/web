import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { FormSteps } from "@/components/ui/form-steps";
import { BlockEditorCanvas } from "./block-editor-canvas";
import { MessageMetadataForm } from "./message-metadata-form";
import type { MessageFormData, ContentBlock, MessageRecurrenceFormData } from "./types";
import { useMessageSchedulePreview } from "@/hooks/administration/use-message-schedule";
import { buildSchedulePayload, isRecurrenceComplete } from "@/utils/message-recurrence";

interface MessageEditorProps {
  initialData?: Partial<MessageFormData>;
  onSubmit: (data: MessageFormData, isDraft: boolean) => void;
  onFormStateChange?: (state: { isValid: boolean; isDirty: boolean; canPreview: boolean }) => void;
  onStepChange?: (step: number, totalSteps: number, canGoNext: boolean, canGoPrev: boolean) => void;
  /** Falso na edição de uma mensagem — ver a nota em `MessageMetadataForm`. */
  allowRecurrence?: boolean;
  /** Verdadeiro na edição de um AGENDAMENTO — ver a nota em `MessageMetadataForm`. */
  lockRecurrence?: boolean;
}

const STEPS = [
  { id: 1, name: "Informações Básicas", description: "Título e configurações" },
  { id: 2, name: "Conteúdo", description: "Editor de blocos da mensagem" },
];

export const MessageEditor = ({ initialData, onSubmit, onFormStateChange, onStepChange, allowRecurrence = true, lockRecurrence = false }: MessageEditorProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [blocks, setBlocks] = useState<ContentBlock[]>(initialData?.blocks || []);
  const [metadata, setMetadata] = useState<{
    title: string;
    targeting: {
      type: 'all' | 'specific' | 'sector' | 'position';
      userIds?: string[];
      sectorIds?: string[];
      positionIds?: string[];
    };
    scheduling: {
      startDate?: Date;
      endDate?: Date;
    };
    recurrence?: MessageRecurrenceFormData;
  }>({
    title: initialData?.title || '',
    targeting: initialData?.targeting || { type: 'specific' as const, userIds: [], sectorIds: [], positionIds: [] },
    scheduling: initialData?.scheduling || (() => {
      const today = new Date();
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 7);
      return { startDate: today, endDate };
    })(),
    recurrence: initialData?.recurrence,
  });

  // Update state when initialData changes (for edit mode)
  useEffect(() => {
    if (initialData) {
      console.log('[MessageEditor] Received initialData:', initialData);

      if (initialData.blocks !== undefined) {
        console.log('[MessageEditor] Setting blocks:', initialData.blocks);
        setBlocks(initialData.blocks);
      }

      if (initialData.title !== undefined || initialData.targeting !== undefined || initialData.scheduling !== undefined) {
        console.log('[MessageEditor] Setting metadata:', {
          title: initialData.title,
          targeting: initialData.targeting,
          scheduling: initialData.scheduling,
        });
        setMetadata({
          title: initialData.title || '',
          targeting: initialData.targeting || { type: 'specific' as const, userIds: [], sectorIds: [], positionIds: [] },
          scheduling: initialData.scheduling || {},
          recurrence: initialData.recurrence,
        });
      }
    }
  }, [initialData]);

  // Helper function to validate targeting
  const isTargetingValid = (): boolean => {
    const { type, userIds, sectorIds, positionIds } = metadata.targeting as {
      type: 'all' | 'specific' | 'sector' | 'position';
      userIds?: string[];
      sectorIds?: string[];
      positionIds?: string[];
    };

    switch (type) {
      case 'all':
        return true;
      case 'specific':
        const isValid = !!(userIds && userIds.length > 0);
        if (process.env.NODE_ENV !== 'production') {
          console.log('[MessageEditor] Validating specific targeting:', { userIds, isValid });
        }
        return isValid;
      case 'sector':
        return !!(sectorIds && sectorIds.length > 0);
      case 'position':
        return !!(positionIds && positionIds.length > 0);
      default:
        return true;
    }
  };

  // Preview only needs blocks, but publishing needs title + blocks + valid targeting
  const canPreview = blocks.length > 0;
  const targetingValid = isTargetingValid();
  const canPublish = metadata.title.trim().length > 0 && blocks.length > 0 && targetingValid;
  const isValid = canPublish; // For draft/publish, require title and valid targeting
  const isDirty = blocks.length > 0 || metadata.title.length > 0;

  // Validation for each step
  const step1Valid = metadata.title.trim().length > 0 && targetingValid;
  const step2Valid = blocks.length > 0;

  const stepErrors = {
    1: !step1Valid && currentStep > 1,
    2: !step2Valid && currentStep > 2,
  };

  useEffect(() => {
    onFormStateChange?.({ isValid, isDirty, canPreview });
  }, [isValid, isDirty, canPreview, onFormStateChange]);

  useEffect(() => {
    const canGoNext = currentStep < STEPS.length && (currentStep !== 1 || step1Valid);
    const canGoPrev = currentStep > 1;
    onStepChange?.(currentStep, STEPS.length, canGoNext, canGoPrev);
  }, [currentStep, step1Valid, onStepChange]);

  const handleSubmitDraft = () => {
    if (!isValid) {
      console.error('[MessageEditor] Cannot submit draft - form invalid', { step1Valid, step2Valid });
      return;
    }

    const formData: MessageFormData = {
      title: metadata.title,
      blocks,
      targeting: metadata.targeting,
      scheduling: metadata.scheduling,
      recurrence: metadata.recurrence,
      isDraft: true,
    };

    console.log('[MessageEditor] Submitting draft:', formData);
    onSubmit(formData, true);
  };

  const handleSubmitPublish = () => {
    if (!isValid) {
      console.error('[MessageEditor] Cannot publish - form invalid', { step1Valid, step2Valid });
      return;
    }

    const formData: MessageFormData = {
      title: metadata.title,
      blocks,
      targeting: metadata.targeting,
      scheduling: metadata.scheduling,
      recurrence: metadata.recurrence,
      isDraft: false,
    };

    console.log('[MessageEditor] Publishing:', formData);
    onSubmit(formData, false);
  };

  const handleNext = () => {
    if (currentStep < STEPS.length && (currentStep !== 1 || step1Valid)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Step marker click. Back is free; forward runs the SAME gate as "Próximo"
  // (step 1 must be valid), which `stepErrors` already surfaces on the marker.
  const handleStepClick = (step: number) => {
    if (step === currentStep) return;
    if (step < currentStep) {
      setCurrentStep(step);
      return;
    }
    if (currentStep === 1 && !step1Valid) return;
    setCurrentStep(Math.min(step, STEPS.length));
  };

  // Expose getData and navigation methods for parent component
  useEffect(() => {
    const editorElement = document.querySelector('[data-message-editor]') as any;
    if (editorElement) {
      editorElement.getData = () => ({
        title: metadata.title,
        blocks,
        targeting: metadata.targeting,
        scheduling: metadata.scheduling,
        recurrence: metadata.recurrence,
        isDraft: false,
      });
      editorElement.goToNextStep = handleNext;
      editorElement.goToPreviousStep = handlePrevious;
    }
  }, [blocks, metadata, currentStep]);

  // Prévia das próximas datas. Só consulta quando a recorrência já está
  // completa o bastante para produzir data — a API devolve 400 numa
  // configuração pela metade, e um 400 por tecla digitada seria só ruído.
  const previewPayload = useMemo(() => {
    if (!metadata.recurrence?.enabled) return null;
    if (!isRecurrenceComplete(metadata.recurrence)) return null;
    return buildSchedulePayload({
      title: metadata.title || 'Prévia',
      blocks: blocks.length > 0 ? blocks : [{ id: 'preview', type: 'paragraph', content: '.' }],
      targeting: metadata.targeting,
      scheduling: metadata.scheduling,
      recurrence: metadata.recurrence,
      isDraft: false,
    } as MessageFormData);
  }, [metadata, blocks]);

  const previewQuery = useMessageSchedulePreview(previewPayload, 5, !!previewPayload);
  const recurrencePreview = useMemo(
    () => (previewQuery.data?.data ?? []).map(iso => new Date(iso)),
    [previewQuery.data],
  );

  return (
    <div data-message-editor className="space-y-6">
      {/* Step Indicator */}
      <FormSteps steps={STEPS} currentStep={currentStep} stepErrors={stepErrors} onStepClick={handleStepClick} />

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6">
          {currentStep === 1 && (
            <MessageMetadataForm
              data={metadata}
              onChange={setMetadata}
              allowRecurrence={allowRecurrence}
              lockRecurrence={lockRecurrence}
              recurrencePreview={recurrencePreview}
              recurrencePreviewError={
                previewQuery.isError
                  ? 'Não foi possível calcular as próximas datas com esta configuração.'
                  : null
              }
            />
          )}

          {currentStep === 2 && (
            <BlockEditorCanvas
              blocks={blocks}
              onBlocksChange={setBlocks}
            />
          )}
        </CardContent>
      </Card>

      {/* Hidden submit buttons */}
      <button
        id="message-form-draft"
        type="button"
        onClick={handleSubmitDraft}
        className="hidden"
      />
      <button
        id="message-form-publish"
        type="button"
        onClick={handleSubmitPublish}
        className="hidden"
      />
    </div>
  );
};
