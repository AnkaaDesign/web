import { useNavigate } from "react-router-dom";
import { IconPlus } from "@tabler/icons-react";

import { FAVORITE_PAGES, routes, SECTOR_PRIVILEGES } from "../../../constants";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { MedicalExamList } from "@/components/occupational-health/medical-exam/list";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const MedicalExamListPage = () => {
  const navigate = useNavigate();

  usePageTracker({
    title: "ASO",
    icon: "stethoscope",
  });

  const actions = [
    {
      key: "create",
      label: "Novo Exame",
      icon: IconPlus,
      onClick: () => navigate(routes.occupationalHealth.medicalExams.create),
      variant: "default" as const,
    },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="ASO"
          favoritePage={FAVORITE_PAGES.MEDICINA_DO_TRABALHO_ASO_LISTAR}
          breadcrumbs={[{ label: "Início", href: "/" }, { label: "Medicina do Trabalho", href: routes.occupationalHealth.root }, { label: "ASO" }]}
          actions={actions}
          className="flex-shrink-0"
        />
        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <MedicalExamList className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default MedicalExamListPage;
