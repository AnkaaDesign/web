import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { IconPercentage } from "@tabler/icons-react";
import { SalaryAdjustmentList } from "@/components/personnel-department/salary-adjustment/list/salary-adjustment-list";
import { SalaryAdjustmentApplyDialog } from "@/components/personnel-department/salary-adjustment/apply/salary-adjustment-apply-dialog";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { FAVORITE_PAGES, SECTOR_PRIVILEGES } from "../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const SalaryAdjustmentListPage = () => {
  usePageTracker({ title: "Reajustes Salariais" });
  const [showApplyDialog, setShowApplyDialog] = useState(false);

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Reajustes"
          favoritePage={FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_REAJUSTES_LISTAR}
          breadcrumbs={[{ label: "Início", href: "/" }, { label: "Departamento Pessoal" }, { label: "Reajustes" }]}
          actions={[
            {
              key: "apply",
              label: "Aplicar Reajuste",
              icon: IconPercentage,
              onClick: () => setShowApplyDialog(true),
              variant: "default" as const,
            },
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <SalaryAdjustmentList className="h-full" />
        </div>

        <SalaryAdjustmentApplyDialog open={showApplyDialog} onOpenChange={setShowApplyDialog} />
      </div>
    </PrivilegeRoute>
  );
};

export default SalaryAdjustmentListPage;
