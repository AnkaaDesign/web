import { IconPlus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

import { routes, SECTOR_PRIVILEGES } from "../../../constants";

import { PageHeader } from "@/components/ui/page-header";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { WorkAccidentList } from "@/components/occupational-health/work-accident/list";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const WorkAccidentListPage = () => {
  const navigate = useNavigate();

  usePageTracker({
    title: "CAT — Acidentes de Trabalho",
    icon: "clipboard-list",
  });

  const actions = [
    {
      key: "create",
      label: "Nova CAT",
      icon: IconPlus,
      onClick: () => navigate(routes.occupationalHealth.workAccidents.create),
      variant: "default" as const,
    },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="CAT — Acidentes de Trabalho"
          breadcrumbs={[{ label: "Início", href: "/" }, { label: "Medicina do Trabalho", href: routes.occupationalHealth.root }, { label: "CAT" }]}
          actions={actions}
          className="flex-shrink-0"
        />
        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <WorkAccidentList className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default WorkAccidentListPage;
