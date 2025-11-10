import { PaintTypeList } from "@/components/painting/paint-type/list/paint-type-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { IconPaint, IconPlus } from "@tabler/icons-react";
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
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.DESIGNER, SECTOR_PRIVILEGES.LEADER, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="flex flex-col h-full space-y-4">
        <div className="flex-shrink-0">
          <PageHeader
            variant="default"
            title="Tipos de Tinta"
            icon={IconPaint}
            breadcrumbs={breadcrumbs}
            favoritePage={FAVORITE_PAGES.PINTURA_TIPOS_TINTA_LISTAR}
            actions={actions}
          />
        </div>
        <PaintTypeList className="flex-1 min-h-0" />
      </div>
    </PrivilegeRoute>
  );
}
