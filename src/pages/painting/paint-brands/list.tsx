import { PaintBrandList } from "@/components/painting/paint-brand/list/paint-brand-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { IconTag, IconPlus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

export function PaintBrandsListPage() {
  const navigate = useNavigate();

  // Track page access
  usePageTracker({
    title: "Lista de Marcas de Tinta",
    icon: "tag",
  });

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.DESIGNER, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="flex flex-col h-full space-y-4">
        <div className="flex-shrink-0">
          <PageHeader
            variant="default"
            title="Marcas de Tinta"
            icon={IconTag}
            breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Pintura", href: routes.painting.root }, { label: "Marcas de Tinta" }]}
            favoritePage={FAVORITE_PAGES.PINTURA_MARCAS_TINTA_LISTAR}
            actions={[
              {
                key: "create",
                label: "Cadastrar",
                icon: IconPlus,
                onClick: () => navigate(routes.painting.paintBrands.create),
                variant: "default",
              },
            ]}
          />
        </div>
        <PaintBrandList className="flex-1 min-h-0" />
      </div>
    </PrivilegeRoute>
  );
}

export default PaintBrandsListPage;
