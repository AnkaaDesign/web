import { IconBuildingSkyscraper } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES, FAVORITE_PAGES } from "../../../constants";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { SectorList } from "@/components/administration/sector/list";
import { usePageTracker } from "@/hooks/use-page-tracker";

export const SectorListPage = () => {
  usePageTracker({
    title: "Lista de Setores",
    icon: "building-skyscraper",
  });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
      <div className="flex flex-col h-full space-y-4">
        <PageHeaderWithFavorite
          title="Setores"
          icon={IconBuildingSkyscraper}
          favoritePage={FAVORITE_PAGES.ADMINISTRACAO_SETORES_LISTAR}
          breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Administração" }, { label: "Setores" }]}
          actions={[
            {
              key: "new",
              label: "Cadastrar",
              href: routes.administration.sectors.create,
              variant: "default" as const,
            },
          ]}
        />

        <SectorList className="flex-1 min-h-0" />
      </div>
    </PrivilegeRoute>
  );
};
