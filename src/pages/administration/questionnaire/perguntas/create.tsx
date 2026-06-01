// pages/administration/questionnaire/perguntas/create.tsx
import { useNavigate } from "react-router-dom";
import { IconCheck, IconClipboardList } from "@tabler/icons-react";
import { routes, SECTOR_PRIVILEGES } from "@/constants";
import { useCreateQuestionnaireQuestion } from "@/hooks/questionnaire/use-questionnaire";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { PerguntaForm, type PerguntaFormValues } from "@/components/questionnaire/admin/pergunta-form";

export const QuestionnairePerguntaCreatePage = () => {
  usePageTracker({ title: "Nova Pergunta", icon: "clipboard-list" });
  const navigate = useNavigate();
  const createMut = useCreateQuestionnaireQuestion();

  const onSubmit = async (values: PerguntaFormValues) => {
    try {
      await createMut.mutateAsync({
        groupId: values.groupId,
        order: values.order,
        title: values.title,
        description: values.description,
        helpText: values.helpText ?? null,
        isActive: values.isActive,
        options: values.options.map((o) => ({ order: o.order, value: o.value, label: o.label, description: o.description ?? null })),
      });
      navigate(routes.administration.questionnaire.perguntas);
    } catch {
      /* toast via interceptor */
    }
  };

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.HUMAN_RESOURCES]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <div className="container mx-auto max-w-5xl flex-shrink-0">
          <PageHeader
            title="Nova Pergunta"
            icon={IconClipboardList}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Administração", href: routes.administration.root },
              { label: "Questionários", href: routes.administration.questionnaire.root },
              { label: "Perguntas", href: routes.administration.questionnaire.perguntas },
              { label: "Nova" },
            ]}
            actions={[
              { key: "cancel", label: "Cancelar", onClick: () => navigate(routes.administration.questionnaire.perguntas), variant: "outline" as const },
              { key: "submit", label: "Criar", icon: IconCheck, onClick: () => document.getElementById("pergunta-form-submit")?.click(), variant: "default" as const, loading: createMut.isPending },
            ]}
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          <PerguntaForm onSubmit={onSubmit} isSubmitting={createMut.isPending} />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default QuestionnairePerguntaCreatePage;
