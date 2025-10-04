import { PaintCatalogueList } from "@/components/paint/catalogue/list/paint-catalogue-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { IconPaint, IconPlus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

export function CatalogListPage() {
  const navigate = useNavigate();

  // Track page access
  usePageTracker({
    title: "Catálogo de Tintas",
    icon: "paint",
  });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.PRODUCTION}>
      <div className="flex flex-col h-full space-y-4">
        <div className="flex-shrink-0">
          <PageHeaderWithFavorite
            title="Catálogo de Tintas"
            icon={IconPaint}
            favoritePage={FAVORITE_PAGES.PINTURA_CATALOGO_LISTAR}
            breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Pintura", href: routes.painting.root }, { label: "Catálogo" }]}
            actions={[
              {
                key: "create",
                label: "Nova Tinta",
                icon: IconPlus,
                onClick: () => navigate(routes.painting.catalog.create),
                variant: "default",
              },
            ]}
          />
        </div>
        <PaintCatalogueList className="flex-1 min-h-0" />
      </div>
    </PrivilegeRoute>
  );
}
