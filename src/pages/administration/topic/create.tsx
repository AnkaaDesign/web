import { useNavigate, useSearchParams } from "react-router-dom";
import { IconCheck, IconClipboardList } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES } from "../../../constants";
import type { TopicCreateFormData } from "../../../types";
import { useTopicMutations } from "../../../hooks";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { TopicForm } from "@/components/administration/topic/topic-form";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const TopicCreatePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialSkillId = searchParams.get("skillId") ?? undefined;

  const { createAsync, createMutation } = useTopicMutations();

  usePageTracker({ title: "Novo Tópico", icon: "clipboard-list" });

  const handleSubmit = async (data: TopicCreateFormData) => {
    try {
      const result = await createAsync(data);
      // Success/error toasts handled by the axios interceptor.
      if (result.data?.id) {
        navigate(routes.administration.topic.edit(result.data.id));
      } else {
        navigate(routes.administration.topic.root);
      }
    } catch (err) {
      // Error toast handled by the axios interceptor.
      if (process.env.NODE_ENV !== "production") console.error(err);
    }
  };

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.PRODUCTION_MANAGER]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <div className="container mx-auto max-w-5xl flex-shrink-0">
          <PageHeader
            title="Novo Tópico"
            icon={IconClipboardList}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Administração", href: routes.administration.root },
              { label: "Tópicos", href: routes.administration.topic.root },
              { label: "Novo" },
            ]}
            actions={[
              {
                key: "cancel",
                label: "Cancelar",
                onClick: () => navigate(routes.administration.topic.root),
                variant: "outline" as const,
              },
              {
                key: "submit",
                label: "Criar",
                icon: IconCheck,
                onClick: () => document.getElementById("topic-form-submit")?.click(),
                variant: "default" as const,
                loading: createMutation.isPending,
              },
            ]}
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          <TopicForm
            mode="create"
            defaultValues={initialSkillId ? { skillId: initialSkillId } : undefined}
            onSubmit={handleSubmit}
            isSubmitting={createMutation.isPending}
            hideSubmit
          />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default TopicCreatePage;
