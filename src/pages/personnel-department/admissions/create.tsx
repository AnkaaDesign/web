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
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.PRODUCTION_MANAGER]}>
      <div className="h-full flex flex-col bg-background px-4 pt-4">
        {/* Header + form share ONE scroll container and ONE max-w-4xl column, so their
            widths match exactly. The header is `sticky top-0` so it stays pinned while the
            form scrolls beneath it (it no longer scrolls away with the body). */}
        <div className="flex-1 overflow-y-auto pb-6 [scrollbar-gutter:stable]">
          <div className="container mx-auto max-w-4xl flex flex-col gap-4">
            <div className="sticky top-0 z-20 bg-background pb-1">
              <PageHeader
                title="Nova Admissão"
                icon={IconUserPlus}
                favoritePage={FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_ADMISSOES_LISTAR}
                breadcrumbs={[
                  { label: "Início", href: "/" },
                  { label: "Departamento Pessoal", href: routes.personnelDepartment.root },
                  { label: "Admissões", href: routes.personnelDepartment.admissions.root },
                  { label: "Nova" },
                ]}
                actions={actions}
              />
            </div>
            <AdmissionForm mode="create" onSubmit={handleSubmit} isSubmitting={createMutation.isPending} />
          </div>
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default AdmissionCreatePage;
