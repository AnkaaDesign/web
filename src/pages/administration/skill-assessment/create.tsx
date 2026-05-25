import { useNavigate } from "react-router-dom";
import { IconCheck, IconClipboardList } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES } from "../../../constants";
import type { AssessmentCreateFormData } from "../../../types";
import { useCreateAssessment, useOpenAssessment } from "../../../hooks";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { CampaignForm, type CampaignSubmitOptions } from "@/components/administration/skill-assessment/campaign-form";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const SkillAssessmentCreatePage = () => {
  usePageTracker({ title: "Nova Campanha", icon: "clipboard-list" });
  const navigate = useNavigate();
  const createMutation = useCreateAssessment();
  const openMutation = useOpenAssessment();

  const handleSubmit = async (data: AssessmentCreateFormData, opts: CampaignSubmitOptions) => {
    try {
      const result = await createMutation.mutateAsync({ data });
      const newId = result.data?.id;

      if (opts.openAfter && newId) {
        try {
          // Success/error toasts handled by the axios interceptor.
          await openMutation.mutateAsync(newId);
        } catch (openErr) {
          if (process.env.NODE_ENV !== "production") console.error(openErr);
        }
      }

      if (newId) {
        navigate(routes.administration.skillAssessment.details(newId));
      } else {
        navigate(routes.administration.skillAssessment.root);
      }
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.error(err);
    }
  };

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.PRODUCTION_MANAGER]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <div className="container mx-auto max-w-5xl flex-shrink-0">
          <PageHeader
            title="Nova Campanha"
            icon={IconClipboardList}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Administração" },
              { label: "Avaliação de Competências", href: routes.administration.skillAssessment.root },
              { label: "Nova" },
            ]}
            actions={[
              {
                key: "cancel",
                label: "Cancelar",
                onClick: () => navigate(routes.administration.skillAssessment.root),
                variant: "outline" as const,
              },
              {
                key: "submit",
                label: "Criar campanha",
                icon: IconCheck,
                onClick: () => document.getElementById("campaign-form-submit")?.click(),
                variant: "default" as const,
                loading: createMutation.isPending,
              },
            ]}
          />
        </div>

        <div className="flex-1 overflow-y-auto pb-6">
          <CampaignForm
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

export default SkillAssessmentCreatePage;
