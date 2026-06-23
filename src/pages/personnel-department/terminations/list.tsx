import { PageHeader } from "@/components/ui/page-header";
import { IconPlus } from "@tabler/icons-react";
import { TerminationList } from "@/components/personnel-department/termination/list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { FAVORITE_PAGES, routes, SECTOR_PRIVILEGES } from "../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useNavigate } from "react-router-dom";

const TerminationListPage = () => {
  usePageTracker({ title: "Rescisões" });
  const navigate = useNavigate();

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.PRODUCTION_MANAGER]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Rescisões"
          favoritePage={FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_RESCISOES_LISTAR}
          breadcrumbs={[{ label: "Início", href: "/" }, { label: "Departamento Pessoal", href: routes.personnelDepartment.root }, { label: "Rescisões" }]}
          actions={[
            {
              key: "create",
              label: "Nova Rescisão",
              icon: IconPlus,
              onClick: () => navigate(routes.personnelDepartment.terminations.create),
              variant: "default" as const,
            },
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <TerminationList className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default TerminationListPage;
