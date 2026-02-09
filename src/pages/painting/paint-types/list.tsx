import { PaintTypeList } from "@/components/painting/paint-type/list/paint-type-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { IconPlus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useMemo } from "react";

export function PaintTypesListPage() {
  const navigate = useNavigate();

  // Track page access
  usePageTracker({
    title: "Lista de Tipos de Tinta",
    icon: "brush",
  });

  // Memoize actions to prevent infinite re-renders
  const actions = useMemo(
    () => [
      {
        key: "create",
        label: "Cadastrar",
        icon: IconPlus,
        onClick: () => navigate(routes.painting.paintTypes.create),
        variant: "default" as const,
      },
    ],
    [navigate],
  );

  // Memoize breadcrumbs to prevent infinite re-renders
  const breadcrumbs = useMemo(() => [{ label: "Início", href: routes.home }, { label: "Pintura", href: routes.painting.root }, { label: "Tipos de Tinta" }], []);

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.DESIGNER, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Tipos de Tinta"
          breadcrumbs={breadcrumbs}
          favoritePage={FAVORITE_PAGES.PINTURA_TIPOS_TINTA_LISTAR}
          actions={actions}
          className="flex-shrink-0"
        />
        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <PaintTypeList className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
}
