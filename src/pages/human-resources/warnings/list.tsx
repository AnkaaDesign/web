import { IconAlertTriangle } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES, FAVORITE_PAGES } from "../../../constants";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeaderWithFavorite } from "@/components/page-header";
import { WarningList } from "@/components/human-resources/warning/list";
import { usePageTracker } from "@/hooks/use-page-tracker";

export const WarningListPage = () => {
  usePageTracker({ title: "Lista de Advertências", icon: "alert-triangle" });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.HUMAN_RESOURCES}>
      <div className="flex flex-col h-full space-y-4">
        <PageHeaderWithFavorite
          title="Advertências"
          icon={IconAlertTriangle}
          favoritePage={FAVORITE_PAGES.RECURSOS_HUMANOS_AVISOS_LISTAR}
          breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Recursos Humanos" }, { label: "Advertências" }]}
          actions={[
            {
              key: "new",
              label: "Nova Advertência",
              href: routes.humanResources.warnings.create,
              variant: "default",
            },
          ]}
        />

        <WarningList className="flex-1 min-h-0" />
      </div>
    </PrivilegeRoute>
  );
};
