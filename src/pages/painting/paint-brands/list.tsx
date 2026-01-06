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
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Marcas de Tinta"
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
          className="flex-shrink-0"
        />
        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <PaintBrandList className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
}

export default PaintBrandsListPage;
