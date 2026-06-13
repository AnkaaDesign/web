import { useParams, useNavigate, Navigate } from "react-router-dom";
import { IconHeartHandshake, IconLoader2, IconCheck } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES } from "../../../../../constants";
import { useUserBenefit } from "../../../../../hooks/personnel-department/use-user-benefits";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { UserBenefitForm } from "@/components/personnel-department/user-benefit/form";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const UserBenefitEditPage = () => {
  usePageTracker({ title: "Editar Adesão" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    data: response,
    isLoading,
    error,
  } = useUserBenefit(id || "", {
    include: {
      // remunerations = salário-base, usado no preview Empresa × Colaborador
      // (regra percentual do Vale Transporte: % do salário)
      user: { include: { position: { include: { remunerations: true } }, sector: true } },
      benefit: true,
    },
    enabled: !!id,
  });

  if (!id) {
    return <Navigate to={routes.personnelDepartment.benefits.enrollments.root} replace />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-destructive mb-4">Erro ao carregar adesão</p>
        <Navigate to={routes.personnelDepartment.benefits.enrollments.root} replace />
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

  if (!response || !response.data) {
    return <Navigate to={routes.personnelDepartment.benefits.enrollments.root} replace />;
  }

  const userBenefit = response.data;

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: () => navigate(routes.personnelDepartment.benefits.enrollments.details(id)),
      variant: "outline" as const,
    },
    {
      key: "submit",
      label: "Salvar",
      icon: IconCheck,
      onClick: () => document.getElementById("user-benefit-form-submit")?.click(),
      variant: "default" as const,
    },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <div className="container mx-auto max-w-4xl flex-shrink-0">
          <PageHeader
            variant="form"
            title="Editar Adesão"
            icon={IconHeartHandshake}
            breadcrumbs={[
              { label: "Início", href: "/" },
              { label: "Departamento Pessoal" },
              { label: "Benefícios", href: routes.personnelDepartment.benefits.root },
              { label: "Adesões", href: routes.personnelDepartment.benefits.enrollments.root },
              { label: userBenefit.user?.name || "Adesão", href: routes.personnelDepartment.benefits.enrollments.details(id) },
              { label: "Editar" },
            ]}
            actions={actions}
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          <UserBenefitForm mode="update" userBenefit={userBenefit} />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default UserBenefitEditPage;
