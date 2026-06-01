// pages/administration/questionnaire/temas/create.tsx
import { useNavigate } from "react-router-dom";
import { IconCheck, IconClipboardList } from "@tabler/icons-react";
import { routes, SECTOR_PRIVILEGES } from "@/constants";
import { useCreateQuestionnaireGroup } from "@/hooks/questionnaire/use-questionnaire";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { TemaForm, type TemaFormValues } from "@/components/questionnaire/admin/tema-form";

export const QuestionnaireTemaCreatePage = () => {
  usePageTracker({ title: "Novo Tema", icon: "clipboard-list" });
  const navigate = useNavigate();
  const createMut = useCreateQuestionnaireGroup();

  const onSubmit = async (values: TemaFormValues) => {
    try {
      await createMut.mutateAsync({ name: values.name, description: values.description ?? null, order: values.order, isActive: values.isActive });
      navigate(routes.administration.questionnaire.temas);
    } catch {
      /* toast via interceptor */
    }
  };

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.HUMAN_RESOURCES]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <div className="container mx-auto max-w-5xl flex-shrink-0">
          <PageHeader
            title="Novo Tema"
            icon={IconClipboardList}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Administração", href: routes.administration.root },
              { label: "Questionários", href: routes.administration.questionnaire.root },
              { label: "Temas", href: routes.administration.questionnaire.temas },
              { label: "Novo" },
            ]}
            actions={[
              { key: "cancel", label: "Cancelar", onClick: () => navigate(routes.administration.questionnaire.temas), variant: "outline" as const },
              { key: "submit", label: "Criar", icon: IconCheck, onClick: () => document.getElementById("tema-form-submit")?.click(), variant: "default" as const, loading: createMut.isPending },
            ]}
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          <TemaForm onSubmit={onSubmit} isSubmitting={createMut.isPending} />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default QuestionnaireTemaCreatePage;
