import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { routes, FAVORITE_PAGES } from "../../../constants";
import { PageHeader } from "@/components/ui/page-header";
import { IconMessagePlus, IconCheck, IconLoader2, IconEye } from "@tabler/icons-react";
import { MessageEditor } from "@/components/administration/message/editor/message-editor";
import { MessagePreviewDialog } from "@/components/administration/message/editor/message-preview-dialog";
import type { MessageFormData } from "@/components/administration/message/editor/types";

export const CreateMessagePage = () => {
  const navigate = useNavigate();
  const [formState, setFormState] = useState({ isValid: false, isDirty: false });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [currentData, setCurrentData] = useState<MessageFormData | null>(null);

  const handleSubmit = async (data: MessageFormData, isDraft: boolean) => {
    try {
      console.log("Submitting message:", data, "isDraft:", isDraft);
      // TODO: Implement API call
      // const response = await createMessage.mutateAsync({ ...data, isDraft });
      // navigate(routes.administration.messages.root);
    } catch (error: any) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error creating message:", error);
      }
    }
  };

  const handleCancel = () => {
    navigate(routes.administration.messages?.root || routes.administration.root);
  };

  const handlePreview = (data: MessageFormData) => {
    setCurrentData(data);
    setPreviewOpen(true);
  };

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: handleCancel,
      variant: "outline" as const,
      disabled: false,
    },
    {
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
      disabled: !formState.isValid,
    },
    {
      key: "draft",
      label: "Salvar Rascunho",
      onClick: () => document.getElementById("message-form-draft")?.click(),
      variant: "secondary" as const,
      disabled: !formState.isValid,
    },
    {
      key: "publish",
      label: "Publicar",
      icon: IconCheck,
      onClick: () => document.getElementById("message-form-publish")?.click(),
      variant: "default" as const,
      disabled: !formState.isValid,
    },
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
            onFormStateChange={setFormState}
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
