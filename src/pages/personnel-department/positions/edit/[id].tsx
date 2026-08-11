import { useParams, useNavigate, Navigate } from "react-router-dom";
import { IconBriefcase, IconCheck, IconLoader2, IconX } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES } from "../../../../constants";
import { usePosition, usePositionMutations } from "../../../../hooks";
import type { PositionUpdateFormData } from "../../../../schemas";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/page-header";
import { PositionForm } from "@/components/personnel-department/position/form";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const PositionEditPage = () => {
  usePageTracker({ title: "Editar Cargo", icon: "briefcase" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { updateAsync, updateMutation } = usePositionMutations();

  // Sem `include`: o include padrão do repositório já traz a remuneração vigente
  // (remunerations desc take 1), de onde a api deriva o campo virtual `remuneration`
  // que o formulário usa para pré-preencher o valor atual.
  const {
    data: position,
    isLoading,
    error,
  } = usePosition(id || "", {
    enabled: !!id,
  });

  const handleSubmit = async (data: PositionUpdateFormData) => {
    if (!id) return;
    await updateAsync({ id, data });
    navigate(routes.personnelDepartment.positions.details(id));
  };

  const handleCancel = () => {
    navigate(id ? routes.personnelDepartment.positions.details(id) : routes.personnelDepartment.positions.root);
  };

  if (!id) {
    return <Navigate to={routes.personnelDepartment.positions.root} replace />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-destructive mb-4">Erro ao carregar cargo</p>
        <Navigate to={routes.personnelDepartment.positions.root} replace />
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

  if (!position) {
    return <Navigate to={routes.personnelDepartment.positions.root} replace />;
  }

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      icon: IconX,
      onClick: handleCancel,
      variant: "outline" as const,
      disabled: updateMutation.isPending,
    },
    {
      key: "submit",
      label: "Salvar",
      icon: IconCheck,
      onClick: () => document.getElementById("position-form-submit")?.click(),
      variant: "default" as const,
      disabled: updateMutation.isPending,
      loading: updateMutation.isPending,
    },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="form"
          title="Editar Cargo"
          icon={IconBriefcase}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Departamento Pessoal", href: routes.personnelDepartment.root },
            { label: "Cargos", href: routes.personnelDepartment.positions.root },
            { label: position?.data?.name || "Cargo", href: routes.personnelDepartment.positions.details(id) },
            { label: "Editar" },
          ]}
          actions={actions}
          className="flex-shrink-0"
        />
        <div className="flex-1 overflow-y-auto pb-6">
          <PositionForm mode="update" position={position?.data as any} onSubmit={handleSubmit} isSubmitting={updateMutation.isPending} />
        </div>
      </div>
    </PrivilegeRoute>
  );
};
