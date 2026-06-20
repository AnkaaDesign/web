import { useNavigate } from "react-router-dom";
import { IconPlus } from "@tabler/icons-react";

import { FAVORITE_PAGES, routes, SECTOR_PRIVILEGES } from "../../../constants";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { FispqList } from "@/components/occupational-health/fispq/list";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const FispqPage = () => {
  const navigate = useNavigate();

  usePageTracker({
    title: "FISPQ/FDS",
    icon: "flask",
  });

  const actions = [
    {
      key: "create",
      label: "Nova FISPQ",
      icon: IconPlus,
      onClick: () => navigate(routes.occupationalHealth.fispq.create),
      variant: "default" as const,
    },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="FISPQ/FDS"
          favoritePage={FAVORITE_PAGES.MEDICINA_DO_TRABALHO_FISPQ_LISTAR}
          breadcrumbs={[{ label: "Início", href: "/" }, { label: "Medicina do Trabalho", href: routes.occupationalHealth.root }, { label: "FISPQ/FDS" }]}
          actions={actions}
          className="flex-shrink-0"
        />
        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <FispqList className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default FispqPage;
