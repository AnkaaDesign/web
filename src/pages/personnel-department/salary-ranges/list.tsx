import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { IconPercentage } from "@tabler/icons-react";
import { SalaryRangeList } from "@/components/personnel-department/salary-range/salary-range-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { FAVORITE_PAGES, routes, SECTOR_PRIVILEGES } from "../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const SalaryRangeListPage = () => {
  usePageTracker({ title: "Faixas Salariais" });
  const navigate = useNavigate();

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Faixas Salariais"
          favoritePage={FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_FAIXAS_SALARIAIS_LISTAR}
          breadcrumbs={[{ label: "Início", href: "/" }, { label: "Departamento Pessoal" }, { label: "Faixas Salariais" }]}
          actions={[
            {
              key: "adjustments",
              label: "Reajustes",
              icon: IconPercentage,
              onClick: () => navigate(routes.personnelDepartment.salaryAdjustments.root),
              variant: "default" as const,
            },
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <SalaryRangeList className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default SalaryRangeListPage;
