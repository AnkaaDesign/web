import { PaintCatalogueList } from "@/components/painting/catalogue/list/paint-catalogue-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { IconPaint } from "@tabler/icons-react";

/**
 * View-only Catalog List Page for Leaders and Designers
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
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.LEADER, SECTOR_PRIVILEGES.DESIGNER]}>
      <div className="flex flex-col h-full space-y-4">
        <div className="flex-shrink-0">
          <PageHeaderWithFavorite
            title="Catálogo de Tintas"
            icon={IconPaint}
            favoritePage={FAVORITE_PAGES.PINTURA_CATALOGO_LISTAR}
            breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Catálogo" }]}
            actions={actions}
          />
        </div>
        <PaintCatalogueList
          className="flex-1 min-h-0"
          viewOnly={true}
        />
      </div>
    </PrivilegeRoute>
  );
}
