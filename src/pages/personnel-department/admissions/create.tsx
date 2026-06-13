import { useNavigate } from "react-router-dom";
import { IconUserPlus, IconCheck } from "@tabler/icons-react";
import { routes, SECTOR_PRIVILEGES, FAVORITE_PAGES } from "../../../constants";
import type { AdmissionCreateFormData } from "../../../schemas/admission";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { AdmissionForm } from "@/components/personnel-department/admission/form";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useAdmissionMutations } from "@/hooks/personnel-department/use-admissions";

export const AdmissionCreatePage = () => {
  const navigate = useNavigate();
  const { createAsync, createMutation } = useAdmissionMutations();

  usePageTracker({
    title: "Nova Admissão",
    icon: "user-plus",
  });

  const handleSubmit = async (data: AdmissionCreateFormData) => {
    try {
      const result = await createAsync(data);
      if (result.data?.id) {
        navigate(routes.personnelDepartment.admissions.details(result.data.id));
      } else {
        navigate(routes.personnelDepartment.admissions.root);
      }
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== "production") {
        console.error("Error creating admission:", error);
      }
    }
  };

  const handleCancel = () => {
    navigate(routes.personnelDepartment.admissions.root);
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
      label: "Cadastrar",
      icon: IconCheck,
      onClick: () => document.getElementById("admission-form-submit")?.click(),
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
            title="Nova Admissão"
            icon={IconUserPlus}
            favoritePage={FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_ADMISSOES_LISTAR}
            breadcrumbs={[
              { label: "Início", href: "/" },
              { label: "Departamento Pessoal" },
              { label: "Admissões", href: routes.personnelDepartment.admissions.root },
              { label: "Nova" },
            ]}
            actions={actions}
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          <AdmissionForm mode="create" onSubmit={handleSubmit} isSubmitting={createMutation.isPending} />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default AdmissionCreatePage;
