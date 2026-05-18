import { Navigate, useNavigate, useParams } from "react-router-dom";
import { IconCheck, IconClipboardList, IconLoader2 } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES, ASSESSMENT_STATUS } from "../../../../constants";
import type { AssessmentUpdateFormData } from "../../../../types";
import { useAssessment, useUpdateAssessment } from "../../../../hooks";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { CampaignForm } from "@/components/administration/skill-assessment/campaign-form";
import { Card, CardContent } from "@/components/ui/card";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { toast } from "@/components/ui/sonner";

export const SkillAssessmentEditPage = () => {
  usePageTracker({ title: "Editar Campanha", icon: "clipboard-list" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useAssessment(id ?? "", {
    include: {
      sectors: true,
      topics: true,
    } as any,
  } as any);

  const updateMutation = useUpdateAssessment();

  if (!id) return <Navigate to={routes.administration.skillAssessment.root} replace />;
  if (error) return <Navigate to={routes.administration.skillAssessment.root} replace />;
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  const assessment = data?.data;
  if (!assessment) return <Navigate to={routes.administration.skillAssessment.root} replace />;

  // Only DRAFT campaigns are editable
  if (assessment.status !== ASSESSMENT_STATUS.DRAFT) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.HUMAN_RESOURCES]}>
        <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
          <PageHeader
            title="Editar Campanha"
            icon={IconClipboardList}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Administração" },
              { label: "Avaliação de Competências", href: routes.administration.skillAssessment.root },
              { label: assessment.name, href: routes.administration.skillAssessment.details(id) },
              { label: "Editar" },
            ]}
            className="flex-shrink-0"
          />
          <div className="flex-1 overflow-y-auto pb-6">
            <Card className="container mx-auto max-w-3xl">
              <CardContent className="py-10 text-center space-y-2">
                <h2 className="text-lg font-semibold">Campanha não editável</h2>
                <p className="text-sm text-muted-foreground">
                  Apenas campanhas em rascunho (DRAFT) podem ser editadas. Esta campanha já foi aberta.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  const handleSubmit = async (formData: AssessmentUpdateFormData) => {
    try {
      await updateMutation.mutateAsync({ id, data: formData });
      toast.success("Campanha atualizada");
      navigate(routes.administration.skillAssessment.details(id));
    } catch (err) {
      toast.error("Erro ao atualizar campanha");
      if (process.env.NODE_ENV !== "production") console.error(err);
    }
  };

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.HUMAN_RESOURCES]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <div className="container mx-auto max-w-5xl flex-shrink-0">
          <PageHeader
            variant="form"
            title="Editar Campanha"
            icon={IconClipboardList}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Administração" },
              { label: "Avaliação de Competências", href: routes.administration.skillAssessment.root },
              { label: assessment.name, href: routes.administration.skillAssessment.details(id) },
              { label: "Editar" },
            ]}
            actions={[
              {
                key: "cancel",
                label: "Cancelar",
                onClick: () => navigate(routes.administration.skillAssessment.details(id)),
                variant: "outline" as const,
              },
              {
                key: "submit",
                label: "Salvar",
                icon: IconCheck,
                onClick: () => document.getElementById("campaign-form-submit")?.click(),
                variant: "default" as const,
                loading: updateMutation.isPending,
              },
            ]}
          />
        </div>

        <div className="flex-1 overflow-y-auto pb-6">
          <CampaignForm
            mode="update"
            assessment={assessment}
            onSubmit={handleSubmit}
            isSubmitting={updateMutation.isPending}
            hideSubmit
          />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default SkillAssessmentEditPage;
