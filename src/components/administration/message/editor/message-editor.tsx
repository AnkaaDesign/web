import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BlockEditorCanvas } from "./block-editor-canvas";
import { MessageMetadataForm } from "./message-metadata-form";
import type { MessageFormData, ContentBlock } from "./types";

interface MessageEditorProps {
  initialData?: Partial<MessageFormData>;
  onSubmit: (data: MessageFormData, isDraft: boolean) => void;
  onFormStateChange?: (state: { isValid: boolean; isDirty: boolean }) => void;
}

export const MessageEditor = ({ initialData, onSubmit, onFormStateChange }: MessageEditorProps) => {
  const [blocks, setBlocks] = useState<ContentBlock[]>(initialData?.blocks || []);
  const [metadata, setMetadata] = useState({
    title: initialData?.title || '',
    targeting: initialData?.targeting || { type: 'all' as const },
    scheduling: initialData?.scheduling || {},
    priority: initialData?.priority || 'normal' as const,
  });
  const [activeTab, setActiveTab] = useState('content');

  const isValid = metadata.title.trim().length > 0 && blocks.length > 0;
  const isDirty = blocks.length > 0 || metadata.title.length > 0;

  useEffect(() => {
    onFormStateChange?.({ isValid, isDirty });
  }, [isValid, isDirty, onFormStateChange]);

  const handleSubmitDraft = () => {
    if (!isValid) return;

    const formData: MessageFormData = {
      title: metadata.title,
      blocks,
      targeting: metadata.targeting,
      scheduling: metadata.scheduling,
      priority: metadata.priority,
      isDraft: true,
    };

    onSubmit(formData, true);
  };

  const handleSubmitPublish = () => {
    if (!isValid) return;

    const formData: MessageFormData = {
      title: metadata.title,
      blocks,
      targeting: metadata.targeting,
      scheduling: metadata.scheduling,
      priority: metadata.priority,
      isDraft: false,
    };

    onSubmit(formData, false);
  };

  // Expose getData method for preview
  useEffect(() => {
    const editorElement = document.querySelector('[data-message-editor]') as any;
    if (editorElement) {
      editorElement.getData = () => ({
        title: metadata.title,
        blocks,
        targeting: metadata.targeting,
        scheduling: metadata.scheduling,
        priority: metadata.priority,
        isDraft: false,
      });
    }
  }, [blocks, metadata]);

  return (
    <div data-message-editor>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="content">Conteúdo</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="mt-4">
          <BlockEditorCanvas
            blocks={blocks}
            onBlocksChange={setBlocks}
          />
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <MessageMetadataForm
            data={metadata}
            onChange={setMetadata}
          />
        </TabsContent>
      </Tabs>

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
