import { routes, SECTOR_PRIVILEGES, FAVORITE_PAGES } from "../../../constants";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { SectorList } from "@/components/administration/sector/list";
import { usePageTracker } from "@/hooks/use-page-tracker";

export const SectorListPage = () => {
  usePageTracker({
    title: "Lista de Setores",
    icon: "building-skyscraper",
  });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          title="Setores"
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
          className="flex-shrink-0"
        />
        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <SectorList className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
};
