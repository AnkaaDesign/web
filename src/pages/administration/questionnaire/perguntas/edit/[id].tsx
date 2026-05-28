// pages/administration/questionnaire/perguntas/edit/[id].tsx
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { IconCheck, IconClipboardList, IconLoader2 } from "@tabler/icons-react";
import { routes, SECTOR_PRIVILEGES } from "@/constants";
import {
  useQuestionnaireQuestion,
  useUpdateQuestionnaireQuestion,
  useUpsertQuestionnaireQuestionOptions,
} from "@/hooks/questionnaire/use-questionnaire";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { PerguntaForm, type PerguntaFormValues } from "@/components/questionnaire/admin/pergunta-form";

export const QuestionnairePerguntaEditPage = () => {
  usePageTracker({ title: "Editar Pergunta", icon: "clipboard-list" });
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useQuestionnaireQuestion(id ?? "", { include: { options: true, group: true } } as any, { enabled: !!id });
  const updateMut = useUpdateQuestionnaireQuestion(id ?? "");
  const optionsMut = useUpsertQuestionnaireQuestionOptions(id ?? "");

  const q = data?.data as any;
  if (!id || error) return <Navigate to={routes.administration.questionnaire.perguntas} replace />;
  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }
  if (!q) return <Navigate to={routes.administration.questionnaire.perguntas} replace />;

  const isSubmitting = updateMut.isPending || optionsMut.isPending;

  const onSubmit = async (values: PerguntaFormValues) => {
    try {
      await updateMut.mutateAsync({
        groupId: values.groupId,
        order: values.order,
        title: values.title,
        description: values.description,
        helpText: values.helpText ?? null,
        isActive: values.isActive,
      });
      await optionsMut.mutateAsync({
        options: values.options.map((o) => ({ order: o.order, value: o.value, label: o.label, description: o.description ?? null })),
      });
      navigate(routes.administration.questionnaire.perguntas);
    } catch {
      /* toast via interceptor */
    }
  };

  const sortedOptions = ((q.options ?? []) as any[]).slice().sort((a, b) => a.order - b.order);

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.HUMAN_RESOURCES]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <div className="container mx-auto max-w-5xl flex-shrink-0">
          <PageHeader
            variant="form"
            title="Editar Pergunta"
            icon={IconClipboardList}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Administração" },
              { label: "Questionários", href: routes.administration.questionnaire.root },
              { label: "Perguntas", href: routes.administration.questionnaire.perguntas },
              { label: q.title },
            ]}
            actions={[
              { key: "cancel", label: "Cancelar", onClick: () => navigate(routes.administration.questionnaire.perguntas), variant: "outline" as const },
              { key: "submit", label: "Salvar", icon: IconCheck, onClick: () => document.getElementById("pergunta-form-submit")?.click(), variant: "default" as const, loading: isSubmitting },
            ]}
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          <PerguntaForm
            isSubmitting={isSubmitting}
            onSubmit={onSubmit}
            defaultValues={{
              groupId: q.groupId,
              order: q.order,
              title: q.title,
              description: q.description,
              helpText: q.helpText ?? "",
              isActive: q.isActive,
              options: sortedOptions.length
                ? sortedOptions.map((o, i) => ({ order: i, value: o.value, label: o.label, description: o.description ?? null }))
                : undefined,
            }}
          />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default QuestionnairePerguntaEditPage;
