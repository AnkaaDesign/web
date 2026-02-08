import { PaintCatalogueList } from "@/components/painting/catalogue/list/paint-catalogue-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { IconPaint } from "@tabler/icons-react";
import { DETAIL_PAGE_SPACING } from "@/lib/layout-constants";
import { cn } from "@/lib/utils";

/**
 * View-only Catalog List Page for Designers
 *
 * This page provides read-only access to the paint catalog.
 * Features:
 * - No create button (Nova Tinta)
 * - No reordering capabilities
 * - View-only access to paint details
 */
export default function CatalogListPage() {
  // Track page access
  usePageTracker({
    title: "Catálogo de Tintas",
    icon: "paint",
  });

  // No actions - view only
  const actions: never[] = [];

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.DESIGNER, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.LOGISTIC, SECTOR_PRIVILEGES.TEAM_LEADER, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col px-4 pt-4">
        <div className="flex-shrink-0">
          <PageHeader
            title="Catálogo de Tintas"
            favoritePage={FAVORITE_PAGES.PINTURA_CATALOGO_LISTAR}
            breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Catálogo" }]}
            actions={actions}
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="mt-4">
            <PaintCatalogueList
              className="h-full"
              viewOnly={true}
            />
          </div>
        </div>
      </div>
    </PrivilegeRoute>
  );
}
