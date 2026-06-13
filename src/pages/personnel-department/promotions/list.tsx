import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { IconUserUp } from "@tabler/icons-react";
import { UserPositionHistoryList } from "@/components/personnel-department/user-position-history/list/user-position-history-list";
import { PromoteDialog } from "@/components/personnel-department/user-position-history/promote/promote-dialog";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { FAVORITE_PAGES, SECTOR_PRIVILEGES } from "../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const PromotionListPage = () => {
  usePageTracker({ title: "Promoções" });
  const [showPromoteDialog, setShowPromoteDialog] = useState(false);

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Promoções"
          favoritePage={FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_PROMOCOES_LISTAR}
          breadcrumbs={[{ label: "Início", href: "/" }, { label: "Departamento Pessoal" }, { label: "Promoções" }]}
          actions={[
            {
              key: "promote",
              label: "Promover Colaborador",
              icon: IconUserUp,
              onClick: () => setShowPromoteDialog(true),
              variant: "default" as const,
            },
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <UserPositionHistoryList className="h-full" />
        </div>

        <PromoteDialog open={showPromoteDialog} onOpenChange={setShowPromoteDialog} />
      </div>
    </PrivilegeRoute>
  );
};

export default PromotionListPage;
