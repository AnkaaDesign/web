import { Navigate, useNavigate, useParams } from "react-router-dom";
import { IconCheck, IconClipboardList, IconLoader2 } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES } from "../../../../constants";
import type { SkillUpdateFormData } from "../../../../types";
import { useSkill, useSkillMutations } from "../../../../hooks";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { SkillForm } from "@/components/administration/skill/skill-form";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const SkillEditPage = () => {
  usePageTracker({ title: "Editar Competência", icon: "clipboard-list" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useSkill(id ?? "", { enabled: !!id });
  const { updateAsync, updateMutation } = useSkillMutations();

  if (!id) return <Navigate to={routes.administration.skill.root} replace />;
  if (error) return <Navigate to={routes.administration.skill.root} replace />;
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  const skill = data?.data;
  if (!skill) return <Navigate to={routes.administration.skill.root} replace />;

  const handleSubmit = async (formData: SkillUpdateFormData) => {
    try {
      await updateAsync({ id, data: formData });
      // Success/error toasts handled by the axios interceptor.
      navigate(routes.administration.skill.details(id));
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
            variant="form"
            title="Editar Competência"
            icon={IconClipboardList}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Administração", href: routes.administration.root },
              { label: "Competências", href: routes.administration.skill.root },
              { label: skill.name, href: routes.administration.skill.details(id) },
              { label: "Editar" },
            ]}
            actions={[
              {
                key: "cancel",
                label: "Cancelar",
                onClick: () => navigate(routes.administration.skill.details(id)),
                variant: "outline" as const,
              },
              {
                key: "submit",
                label: "Salvar",
                icon: IconCheck,
                onClick: () => document.getElementById("skill-form-submit")?.click(),
                variant: "default" as const,
                loading: updateMutation.isPending,
              },
            ]}
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          <SkillForm
            mode="update"
            skill={skill}
            onSubmit={handleSubmit}
            isSubmitting={updateMutation.isPending}
            hideSubmit
          />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default SkillEditPage;
