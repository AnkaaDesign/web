import { useParams, useNavigate, Navigate } from "react-router-dom";
import { IconClipboardPlus, IconCheck, IconLoader2 } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES } from "../../../../constants";
import { useWorkAccidentReport, useWorkAccidentReportMutations } from "../../../../hooks/occupational-health/use-work-accidents";
import type { WorkAccidentReportUpdateFormData } from "@/schemas/work-accident";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { WorkAccidentForm } from "@/components/occupational-health/work-accident/form";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const WorkAccidentEditPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { updateAsync } = useWorkAccidentReportMutations();

  usePageTracker({ title: "Editar CAT", icon: "clipboard-list" });

  const { data: response, isLoading, error } = useWorkAccidentReport(id || "", {
    include: { user: { include: { position: true } }, leave: true },
    enabled: !!id,
  });

  const report = response?.data;

  if (!id) return <Navigate to={routes.occupationalHealth.workAccidents.root} replace />;
  if (error) return <Navigate to={routes.occupationalHealth.workAccidents.root} replace />;

  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="flex items-center justify-center h-full">
          <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PrivilegeRoute>
    );
  }

  if (!report) return <Navigate to={routes.occupationalHealth.workAccidents.root} replace />;

  const handleSubmit = async (data: WorkAccidentReportUpdateFormData) => {
    await updateAsync({ id: report.id, data });
    navigate(routes.occupationalHealth.workAccidents.details(report.id));
  };

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: () => navigate(routes.occupationalHealth.workAccidents.details(report.id)),
      variant: "outline" as const,
    },
    {
      key: "submit",
      label: "Salvar",
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
            title="Editar CAT"
            icon={IconClipboardPlus}
            breadcrumbs={[
              { label: "Início", href: "/" },
              { label: "Medicina do Trabalho", href: routes.occupationalHealth.root },
              { label: "CAT", href: routes.occupationalHealth.workAccidents.root },
              { label: report.user?.name || "Editar" },
            ]}
            actions={actions}
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          <WorkAccidentForm mode="update" report={report} onSubmit={handleSubmit} />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default WorkAccidentEditPage;
