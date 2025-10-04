import { routes, FAVORITE_PAGES } from "../../../constants";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { SECTOR_PRIVILEGES } from "../../../constants";
import { IconFlask } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page-header";
import { PaintProductionList } from "@/components/paint/production/list/paint-production-list";

export default function ProductionsListPage() {
  // Track page access
  usePageTracker({
    title: "Lista de Produções",
    icon: "beaker",
  });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.PRODUCTION}>
      <div className="flex flex-col h-full space-y-4">
        <div className="flex-shrink-0">
          <PageHeader
            variant="default"
            title="Produções de Tinta"
            icon={IconFlask}
            breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Pintura", href: routes.painting.root }, { label: "Produções" }]}
            favoritePage={FAVORITE_PAGES.PINTURA_PRODUCOES_LISTAR}
          />
        </div>
        <PaintProductionList className="flex-1 min-h-0" />
      </div>
    </PrivilegeRoute>
  );
}
