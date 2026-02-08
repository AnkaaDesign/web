import { routes, FAVORITE_PAGES } from "../../../constants";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { SECTOR_PRIVILEGES } from "../../../constants";
import { IconFlask } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page-header";
import { PaintProductionList } from "@/components/painting/production/list/paint-production-list";

export default function ProductionsListPage() {
  // Track page access
  usePageTracker({
    title: "Lista de Produções",
    icon: "beaker",
  });

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Produções de Tinta"
          breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Pintura", href: routes.painting.root }, { label: "Produções" }]}
          favoritePage={FAVORITE_PAGES.PINTURA_PRODUCOES_LISTAR}
          className="flex-shrink-0"
        />
        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <PaintProductionList className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
}
