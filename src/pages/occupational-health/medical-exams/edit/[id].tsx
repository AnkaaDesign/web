import { useParams, useNavigate, Navigate } from "react-router-dom";
import { IconStethoscope, IconCheck, IconLoader2 } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES } from "../../../../constants";
import type { MedicalExamUpdateFormData } from "@/schemas/medical-exam";
import { useMedicalExam, useMedicalExamMutations } from "@/hooks/occupational-health/use-medical-exams";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { MedicalExamForm } from "@/components/occupational-health/medical-exam/form";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const MedicalExamEditPage = () => {
  usePageTracker({ title: "Editar Exame (ASO)" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { updateAsync, updateMutation } = useMedicalExamMutations();

  const {
    data: response,
    isLoading,
    error,
  } = useMedicalExam(id || "", {
    include: {
      user: true,
    },
    enabled: !!id,
  });

  const exam = response?.data;

  if (!id) {
    return <Navigate to={routes.occupationalHealth.medicalExams.root} replace />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-destructive mb-4">Erro ao carregar exame</p>
        <Navigate to={routes.occupationalHealth.medicalExams.root} replace />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!exam) {
    return <Navigate to={routes.occupationalHealth.medicalExams.root} replace />;
  }

  const handleSubmit = async (data: MedicalExamUpdateFormData) => {
    try {
      await updateAsync({ id, data });
      navigate(routes.occupationalHealth.medicalExams.details(id));
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error updating medical exam:", error);
      }
    }
  };

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: () => navigate(routes.occupationalHealth.medicalExams.details(id)),
      variant: "outline" as const,
      disabled: updateMutation.isPending,
    },
    {
      key: "submit",
      label: "Salvar",
      icon: IconCheck,
      onClick: () => document.getElementById("medical-exam-form-submit")?.click(),
      variant: "default" as const,
      disabled: updateMutation.isPending,
      loading: updateMutation.isPending,
    },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <div className="container mx-auto max-w-4xl flex-shrink-0">
          <PageHeader
            variant="form"
            title="Editar Exame (ASO)"
            icon={IconStethoscope}
            breadcrumbs={[
              { label: "Início", href: "/" },
              { label: "Medicina do Trabalho", href: routes.occupationalHealth.root },
              { label: "ASO", href: routes.occupationalHealth.medicalExams.root },
              { label: exam.user?.name || "Exame", href: routes.occupationalHealth.medicalExams.details(id) },
              { label: "Editar" },
            ]}
            actions={actions}
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          <MedicalExamForm mode="update" exam={exam} onSubmit={handleSubmit} isSubmitting={updateMutation.isPending} />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default MedicalExamEditPage;
