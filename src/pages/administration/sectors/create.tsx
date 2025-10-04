import { useNavigate } from "react-router-dom";
import { IconBuildingSkyscraper, IconCheck, IconLoader2 } from "@tabler/icons-react";
import { routes, SECTOR_PRIVILEGES, FAVORITE_PAGES } from "../../../constants";
import type { SectorCreateFormData } from "../../../schemas";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
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
      console.error("Error creating sector:", error);
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
      <div className="h-full flex flex-col">
        {/* Fixed Header */}
        <div className="flex-shrink-0">
          <div className="max-w-3xl mx-auto">
            <PageHeaderWithFavorite
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
            />
          </div>
        </div>

        {/* Scrollable Form Container */}
        <div className="flex-1 overflow-y-auto mt-6">
          <div className="max-w-3xl mx-auto h-full">
            <SectorForm mode="create" onSubmit={handleSubmit} isSubmitting={false} />
          </div>
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default SectorCreatePage;
