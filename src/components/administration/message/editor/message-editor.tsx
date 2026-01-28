import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { FormSteps } from "@/components/ui/form-steps";
import { BlockEditorCanvas } from "./block-editor-canvas";
import { MessageMetadataForm } from "./message-metadata-form";
import type { MessageFormData, ContentBlock } from "./types";

interface MessageEditorProps {
  initialData?: Partial<MessageFormData>;
  onSubmit: (data: MessageFormData, isDraft: boolean) => void;
  onFormStateChange?: (state: { isValid: boolean; isDirty: boolean; canPreview: boolean }) => void;
  onStepChange?: (step: number, totalSteps: number, canGoNext: boolean, canGoPrev: boolean) => void;
}

const STEPS = [
  { id: 1, name: "Informações Básicas", description: "Título e configurações" },
  { id: 2, name: "Conteúdo", description: "Editor de blocos da mensagem" },
];

export const MessageEditor = ({ initialData, onSubmit, onFormStateChange, onStepChange }: MessageEditorProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [blocks, setBlocks] = useState<ContentBlock[]>(initialData?.blocks || []);
  const [metadata, setMetadata] = useState({
    title: initialData?.title || '',
    targeting: initialData?.targeting || { type: 'specific' as const, userIds: [], sectorIds: [], positionIds: [] },
    scheduling: initialData?.scheduling || {},
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
        });
      }
    }
  }, [initialData]);

  // Helper function to validate targeting
  const isTargetingValid = () => {
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
        const isValid = userIds && userIds.length > 0;
        if (process.env.NODE_ENV !== 'production') {
          console.log('[MessageEditor] Validating specific targeting:', { userIds, isValid });
        }
        return isValid;
      case 'sector':
        return sectorIds && sectorIds.length > 0;
      case 'position':
        return positionIds && positionIds.length > 0;
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
    const canGoNext = currentStep < STEPS.length;
    const canGoPrev = currentStep > 1;
    onStepChange?.(currentStep, STEPS.length, canGoNext, canGoPrev);
  }, [currentStep, onStepChange]);

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
      isDraft: false,
    };

    console.log('[MessageEditor] Publishing:', formData);
    onSubmit(formData, false);
  };

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
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
        isDraft: false,
      });
      editorElement.goToNextStep = handleNext;
      editorElement.goToPreviousStep = handlePrevious;
    }
  }, [blocks, metadata, currentStep]);

  return (
    <div data-message-editor className="space-y-6">
      {/* Step Indicator */}
      <FormSteps steps={STEPS} currentStep={currentStep} stepErrors={stepErrors} />

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6">
          {currentStep === 1 && (
            <MessageMetadataForm
              data={metadata}
              onChange={setMetadata}
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
