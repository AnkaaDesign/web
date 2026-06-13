import { useNavigate } from "react-router-dom";
import { IconStethoscope, IconCheck } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES } from "../../../constants";
import type { MedicalExamCreateFormData } from "@/schemas/medical-exam";
import { useMedicalExamMutations } from "@/hooks/occupational-health/use-medical-exams";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { MedicalExamForm } from "@/components/occupational-health/medical-exam/form";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const MedicalExamCreatePage = () => {
  const navigate = useNavigate();
  const { createAsync, createMutation } = useMedicalExamMutations();

  usePageTracker({
    title: "Novo Exame (ASO)",
    icon: "stethoscope",
  });

  const handleSubmit = async (data: MedicalExamCreateFormData) => {
    try {
      const result = await createAsync(data);
      if (result.data?.id) {
        navigate(routes.occupationalHealth.medicalExams.details(result.data.id));
      } else {
        navigate(routes.occupationalHealth.medicalExams.root);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error creating medical exam:", error);
      }
    }
  };

  const handleCancel = () => {
    navigate(routes.occupationalHealth.medicalExams.root);
  };

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: handleCancel,
      variant: "outline" as const,
      disabled: createMutation.isPending,
    },
    {
      key: "submit",
      label: "Criar",
      icon: IconCheck,
      onClick: () => document.getElementById("medical-exam-form-submit")?.click(),
      variant: "default" as const,
      disabled: createMutation.isPending,
      loading: createMutation.isPending,
    },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <div className="container mx-auto max-w-4xl flex-shrink-0">
          <PageHeader
            title="Novo Exame (ASO)"
            icon={IconStethoscope}
            breadcrumbs={[
              { label: "Início", href: "/" },
              { label: "Medicina do Trabalho", href: routes.occupationalHealth.root },
              { label: "ASO", href: routes.occupationalHealth.medicalExams.root },
              { label: "Novo" },
            ]}
            actions={actions}
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          <MedicalExamForm mode="create" onSubmit={handleSubmit} isSubmitting={createMutation.isPending} />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default MedicalExamCreatePage;
