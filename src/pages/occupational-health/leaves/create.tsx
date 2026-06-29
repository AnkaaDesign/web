import { useNavigate } from "react-router-dom";
import { IconCalendarOff, IconCheck } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES, FAVORITE_PAGES } from "../../../constants";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { LeaveForm } from "@/components/occupational-health/leave/form";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const LeaveCreatePage = () => {
  const navigate = useNavigate();

  usePageTracker({
    title: "Novo Afastamento",
    icon: "calendar-off",
  });

  const handleCancel = () => {
    navigate(routes.occupationalHealth.leaves.root);
  };

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: handleCancel,
      variant: "outline" as const,
    },
    {
      key: "submit",
      label: "Criar",
      icon: IconCheck,
      onClick: () => document.getElementById("leave-form-submit")?.click(),
      variant: "default" as const,
    },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <div className="container mx-auto max-w-4xl flex-shrink-0">
          <PageHeader
            favoritePage={FAVORITE_PAGES.MEDICINA_DO_TRABALHO_AFASTAMENTOS_CADASTRAR}
            title="Novo Afastamento"
            icon={IconCalendarOff}
            breadcrumbs={[
              { label: "Início", href: "/" },
              { label: "Medicina do Trabalho", href: routes.occupationalHealth.root },
              { label: "Afastamentos", href: routes.occupationalHealth.leaves.root },
              { label: "Novo" },
            ]}
            actions={actions}
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          <LeaveForm mode="create" />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default LeaveCreatePage;
