import { useNavigate } from "react-router-dom";
import { IconBuildingSkyscraper, IconCheck, IconLoader2 } from "@tabler/icons-react";
import { routes, SECTOR_PRIVILEGES, FAVORITE_PAGES } from "../../../constants";
import type { SectorCreateFormData } from "../../../schemas";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { SectorForm } from "@/components/administration/sector/form";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { useSectorMutations } from "../../../hooks";

export const SectorCreatePage = () => {
  const navigate = useNavigate();
  const { createAsync: create } = useSectorMutations();

  usePageTracker({
    title: "Novo Setor",
    icon: "building-skyscraper",
  });

  const handleSubmit = async (data: any) => {
    try {
      const formData: SectorCreateFormData = {
        name: data.name as string,
        privileges: data.privileges as SECTOR_PRIVILEGES,
      };
      // @ts-ignore - TypeScript is incorrectly inferring the type
      const result = await create(formData);
      if (result.data?.id) {
        navigate(routes.administration.sectors.details(result.data.id));
      } else {
        navigate(routes.administration.sectors.root);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error creating sector:", error);
      }
    }
  };

  const handleCancel = () => {
    navigate(routes.administration.sectors.root);
  };

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: handleCancel,
      variant: "outline" as const,
      disabled: false,
    },
    {
      key: "submit",
      label: "Criar",
      icon: false ? IconLoader2 : IconCheck,
      onClick: () => document.getElementById("sector-form-submit")?.click(),
      variant: "default" as const,
      disabled: false,
      loading: false,
    },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          title="Novo Setor"
          icon={IconBuildingSkyscraper}
          favoritePage={FAVORITE_PAGES.ADMINISTRACAO_SETORES_CADASTRAR}
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Administração", href: routes.administration.root },
            { label: "Setores", href: routes.administration.sectors.root },
            { label: "Novo" },
          ]}
          actions={actions}
          className="flex-shrink-0"
        />
        <div className="flex-1 overflow-y-auto pb-6">
          <SectorForm mode="create" onSubmit={handleSubmit} isSubmitting={false} />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default SectorCreatePage;
