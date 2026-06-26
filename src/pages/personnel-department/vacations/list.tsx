import { PageHeader } from "@/components/ui/page-header";
import { IconPlus } from "@tabler/icons-react";
import { VacationList } from "@/components/personnel-department/vacation/list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { FAVORITE_PAGES, routes, SECTOR_PRIVILEGES } from "../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { usePrivileges } from "@/hooks/common/use-privileges";
import { useNavigate } from "react-router-dom";

/**
 * Férias — single unified list of vacations. A "coletiva" is NOT a separate
 * browsable entity: it is just a bulk-create (target selector on "Novas Férias")
 * that expands into individual vacation rows, tagged with a "Coletiva" badge via
 * groupId. There is no group-browsing surface here.
 */
const VacationListPage = () => {
  usePageTracker({ title: "Férias", icon: "vacation" });
  const navigate = useNavigate();
  const { canAccess } = usePrivileges();

  // PM can view the vacation list, but only HR/Accounting/Admin may create.
  const canManageVacations = canAccess([SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]);

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.PRODUCTION_MANAGER]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Férias"
          favoritePage={FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_FERIAS_LISTAR}
          breadcrumbs={[{ label: "Início", href: "/" }, { label: "Departamento Pessoal", href: routes.personnelDepartment.root }, { label: "Férias" }]}
          actions={
            canManageVacations
              ? [
                  {
                    key: "create",
                    label: "Novas Férias",
                    icon: IconPlus,
                    onClick: () => navigate(routes.personnelDepartment.vacations.create),
                    variant: "default" as const,
                  },
                ]
              : []
          }
          className="flex-shrink-0"
        />
        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <VacationList className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default VacationListPage;
