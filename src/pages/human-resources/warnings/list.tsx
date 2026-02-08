import { routes, SECTOR_PRIVILEGES, FAVORITE_PAGES } from "../../../constants";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/page-header";
import { WarningList } from "@/components/human-resources/warning/list";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { LIST_PAGE_SPACING } from "@/lib/layout-constants";

export const WarningListPage = () => {
  usePageTracker({ title: "Lista de Advertências", icon: "alert-triangle" });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.HUMAN_RESOURCES}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Advertências"
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
          className="flex-shrink-0"
        />
        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <WarningList className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
};
