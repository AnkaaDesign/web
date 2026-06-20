import { useParams, useNavigate, Navigate } from "react-router-dom";
import { IconUserPlus, IconCheck } from "@tabler/icons-react";
import { routes, SECTOR_PRIVILEGES, FAVORITE_PAGES } from "../../../../constants";
import type { AdmissionUpdateFormData } from "../../../../schemas/admission";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { AdmissionForm } from "@/components/personnel-department/admission/form";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useAdmission, useAdmissionMutations } from "@/hooks/personnel-department/use-admissions";

const REQUIRED_PRIVILEGES = [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.PRODUCTION_MANAGER];

export const AdmissionEditPage = () => {
  usePageTracker({ title: "Editar Admissão", icon: "user-plus" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { updateAsync, updateMutation } = useAdmissionMutations();

  const {
    data: response,
    isLoading,
    error,
  } = useAdmission(id || "", {
    include: { user: { include: { position: true, sector: true } } },
    enabled: !!id,
  });

  const admission = response?.data;

  if (!id) {
    return <Navigate to={routes.personnelDepartment.admissions.root} replace />;
  }

  if (error) {
    return <Navigate to={routes.personnelDepartment.admissions.root} replace />;
  }

  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={REQUIRED_PRIVILEGES}>
        <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
          <div className="container mx-auto max-w-4xl space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  if (!admission) {
    return <Navigate to={routes.personnelDepartment.admissions.root} replace />;
  }

  const handleSubmit = async (data: AdmissionUpdateFormData) => {
    try {
      await updateAsync({ id, data });
      navigate(routes.personnelDepartment.admissions.details(id));
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== "production") {
        console.error("Error updating admission:", error);
      }
    }
  };

  const handleCancel = () => {
    navigate(routes.personnelDepartment.admissions.details(id));
  };

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: handleCancel,
      variant: "outline" as const,
      disabled: updateMutation.isPending,
    },
    {
      key: "submit",
      label: "Salvar",
      icon: IconCheck,
      onClick: () => document.getElementById("admission-form-submit")?.click(),
      variant: "default" as const,
      disabled: updateMutation.isPending,
      loading: updateMutation.isPending,
    },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={REQUIRED_PRIVILEGES}>
      <div className="h-full flex flex-col bg-background px-4 pt-4">
        {/* Header + form share ONE scroll container and ONE max-w-4xl column (igual
            à tela de criação), mantendo o cabeçalho fixo (sticky) enquanto o
            formulário rola por baixo. */}
        <div className="flex-1 overflow-y-auto pb-6 [scrollbar-gutter:stable]">
          <div className="container mx-auto max-w-4xl flex flex-col gap-4">
            <div className="sticky top-0 z-20 bg-background pb-1">
              <PageHeader
                title={admission.user?.name ? `Editar Admissão — ${admission.user.name}` : "Editar Admissão"}
                icon={IconUserPlus}
                favoritePage={FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_ADMISSOES_LISTAR}
                breadcrumbs={[
                  { label: "Início", href: "/" },
                  { label: "Departamento Pessoal" },
                  { label: "Admissões", href: routes.personnelDepartment.admissions.root },
                  { label: admission.user?.name || "Admissão", href: routes.personnelDepartment.admissions.details(id) },
                  { label: "Editar" },
                ]}
                actions={actions}
              />
            </div>
            <AdmissionForm mode="update" admission={admission} onSubmit={handleSubmit} isSubmitting={updateMutation.isPending} />
          </div>
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default AdmissionEditPage;
