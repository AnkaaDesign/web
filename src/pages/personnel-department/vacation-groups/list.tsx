import { PageHeader } from "@/components/ui/page-header";
import { IconPlus } from "@tabler/icons-react";
import { VacationGroupList } from "@/components/personnel-department/vacation-group/list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { routes, SECTOR_PRIVILEGES } from "../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useNavigate } from "react-router-dom";

const VacationGroupListPage = () => {
  usePageTracker({ title: "Férias Coletivas", icon: "vacation" });
  const navigate = useNavigate();

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Férias Coletivas"
          breadcrumbs={[{ label: "Início", href: "/" }, { label: "Departamento Pessoal" }, { label: "Férias Coletivas" }]}
          actions={[
            {
              key: "create",
              label: "Novas Férias Coletivas",
              icon: IconPlus,
              onClick: () => navigate(routes.personnelDepartment.vacationGroups.create),
              variant: "default" as const,
            },
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <VacationGroupList className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default VacationGroupListPage;
