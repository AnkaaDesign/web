import { useNavigate } from "react-router-dom";
import { IconBriefcase, IconCheck, IconX } from "@tabler/icons-react";
import { routes, FAVORITE_PAGES } from "../../../constants";
import { usePositionMutations } from "../../../hooks";
import type { PositionCreateFormData } from "../../../schemas";
import { PageHeader } from "@/components/ui/page-header";
import { PositionForm } from "@/components/personnel-department/position/form";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const PositionCreatePage = () => {
  usePageTracker({
    title: "Novo Cargo",
    icon: "briefcase",
  });

  const navigate = useNavigate();
  const { createAsync, createMutation } = usePositionMutations();

  const handleSubmit = async (data: PositionCreateFormData) => {
    await createAsync(data);
    navigate(routes.personnelDepartment.positions.root);
  };

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      icon: IconX,
      onClick: () => navigate(routes.personnelDepartment.positions.root),
      variant: "outline" as const,
      disabled: createMutation.isPending,
    },
    {
      key: "submit",
      label: "Criar",
      icon: IconCheck,
      onClick: () => document.getElementById("position-form-submit")?.click(),
      variant: "default" as const,
      disabled: createMutation.isPending,
      loading: createMutation.isPending,
    },
  ];

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <PageHeader
        variant="form"
        title="Novo Cargo"
        icon={IconBriefcase}
        favoritePage={FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_CARGOS_CADASTRAR}
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Departamento Pessoal", href: routes.personnelDepartment.root },
          { label: "Cargos", href: routes.personnelDepartment.positions.root },
          { label: "Novo" },
        ]}
        actions={actions}
        className="flex-shrink-0"
      />
      <div className="flex-1 overflow-y-auto pb-6">
        <PositionForm mode="create" onSubmit={handleSubmit} isSubmitting={createMutation.isPending} />
      </div>
    </div>
  );
};
