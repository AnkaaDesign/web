import { useNavigate } from "react-router-dom";
import { IconClipboardPlus, IconCheck } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES, FAVORITE_PAGES } from "../../../constants";
import { useWorkAccidentReportMutations } from "../../../hooks/occupational-health/use-work-accidents";
import type { WorkAccidentReportCreateFormData } from "@/schemas/work-accident";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { WorkAccidentForm } from "@/components/occupational-health/work-accident/form";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const WorkAccidentCreatePage = () => {
  const navigate = useNavigate();
  const { createAsync } = useWorkAccidentReportMutations();

  usePageTracker({ title: "Nova CAT", icon: "clipboard-list" });

  const handleSubmit = async (data: WorkAccidentReportCreateFormData) => {
    const result = await createAsync(data);
    if (result.data?.id) {
      navigate(routes.occupationalHealth.workAccidents.details(result.data.id));
    } else {
      navigate(routes.occupationalHealth.workAccidents.root);
    }
  };

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: () => navigate(routes.occupationalHealth.workAccidents.root),
      variant: "outline" as const,
    },
    {
      key: "submit",
      label: "Criar",
      icon: IconCheck,
      onClick: () => document.getElementById("work-accident-form-submit")?.click(),
      variant: "default" as const,
    },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <div className="container mx-auto max-w-4xl flex-shrink-0">
          <PageHeader
            favoritePage={FAVORITE_PAGES.MEDICINA_DO_TRABALHO_CAT_CADASTRAR}
            title="Nova CAT"
            icon={IconClipboardPlus}
            breadcrumbs={[
              { label: "Início", href: "/" },
              { label: "Medicina do Trabalho", href: routes.occupationalHealth.root },
              { label: "CAT", href: routes.occupationalHealth.workAccidents.root },
              { label: "Nova" },
            ]}
            actions={actions}
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          <WorkAccidentForm mode="create" onSubmit={handleSubmit} />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default WorkAccidentCreatePage;
