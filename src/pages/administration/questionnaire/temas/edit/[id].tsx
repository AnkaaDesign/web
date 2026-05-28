// pages/administration/questionnaire/temas/edit/[id].tsx
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { IconCheck, IconClipboardList, IconLoader2 } from "@tabler/icons-react";
import { routes, SECTOR_PRIVILEGES } from "@/constants";
import { useQuestionnaireGroup, useUpdateQuestionnaireGroup } from "@/hooks/questionnaire/use-questionnaire";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { TemaForm, type TemaFormValues } from "@/components/questionnaire/admin/tema-form";

export const QuestionnaireTemaEditPage = () => {
  usePageTracker({ title: "Editar Tema", icon: "clipboard-list" });
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useQuestionnaireGroup(id ?? "", undefined, { enabled: !!id });
  const updateMut = useUpdateQuestionnaireGroup(id ?? "");

  const tema = data?.data;
  if (!id || error) return <Navigate to={routes.administration.questionnaire.temas} replace />;
  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }
  if (!tema) return <Navigate to={routes.administration.questionnaire.temas} replace />;

  const onSubmit = async (values: TemaFormValues) => {
    try {
      await updateMut.mutateAsync({ name: values.name, description: values.description ?? null, order: values.order, isActive: values.isActive });
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
            variant="form"
            title="Editar Tema"
            icon={IconClipboardList}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Administração" },
              { label: "Questionários", href: routes.administration.questionnaire.root },
              { label: "Temas", href: routes.administration.questionnaire.temas },
              { label: tema.name },
            ]}
            actions={[
              { key: "cancel", label: "Cancelar", onClick: () => navigate(routes.administration.questionnaire.temas), variant: "outline" as const },
              { key: "submit", label: "Salvar", icon: IconCheck, onClick: () => document.getElementById("tema-form-submit")?.click(), variant: "default" as const, loading: updateMut.isPending },
            ]}
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          <TemaForm
            defaultValues={{ name: tema.name, description: tema.description ?? "", order: tema.order, isActive: tema.isActive }}
            onSubmit={onSubmit}
            isSubmitting={updateMut.isPending}
          />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default QuestionnaireTemaEditPage;
