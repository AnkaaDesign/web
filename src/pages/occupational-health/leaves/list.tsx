import { IconPlus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

import { FAVORITE_PAGES, routes, SECTOR_PRIVILEGES } from "../../../constants";

import { PageHeader } from "@/components/ui/page-header";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { LeaveList } from "@/components/occupational-health/leave/list";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const LeaveListPage = () => {
  const navigate = useNavigate();

  usePageTracker({
    title: "Afastamentos",
    icon: "calendar-off",
  });

  const actions = [
    {
      key: "create",
      label: "Novo Afastamento",
      icon: IconPlus,
      onClick: () => navigate(routes.occupationalHealth.leaves.create),
      variant: "default" as const,
    },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Afastamentos"
          favoritePage={FAVORITE_PAGES.MEDICINA_DO_TRABALHO_AFASTAMENTOS_LISTAR}
          breadcrumbs={[{ label: "Início", href: "/" }, { label: "Medicina do Trabalho", href: routes.occupationalHealth.root }, { label: "Afastamentos" }]}
          actions={actions}
          className="flex-shrink-0"
        />
        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <LeaveList className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default LeaveListPage;
