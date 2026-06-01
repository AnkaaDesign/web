import { useNavigate } from "react-router-dom";
import { IconCheck, IconClipboardList } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES } from "../../../constants";
import type { SkillCreateFormData } from "../../../types";
import { useSkillMutations } from "../../../hooks";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { SkillForm } from "@/components/administration/skill/skill-form";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const SkillCreatePage = () => {
  const navigate = useNavigate();
  const { createAsync, createMutation } = useSkillMutations();

  usePageTracker({ title: "Nova Competência", icon: "clipboard-list" });

  const handleSubmit = async (data: SkillCreateFormData) => {
    try {
      const result = await createAsync(data);
      // Success/error toasts handled by the axios interceptor.
      if (result.data?.id) {
        navigate(routes.administration.skill.details(result.data.id));
      } else {
        navigate(routes.administration.skill.root);
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
            title="Nova Competência"
            icon={IconClipboardList}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Administração", href: routes.administration.root },
              { label: "Competências", href: routes.administration.skill.root },
              { label: "Nova" },
            ]}
            actions={[
              {
                key: "cancel",
                label: "Cancelar",
                onClick: () => navigate(routes.administration.skill.root),
                variant: "outline" as const,
              },
              {
                key: "submit",
                label: "Criar",
                icon: IconCheck,
                onClick: () => document.getElementById("skill-form-submit")?.click(),
                variant: "default" as const,
                loading: createMutation.isPending,
              },
            ]}
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          <SkillForm
            mode="create"
            onSubmit={handleSubmit}
            isSubmitting={createMutation.isPending}
            hideSubmit
          />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default SkillCreatePage;
