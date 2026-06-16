import { useParams, useNavigate, Navigate } from "react-router-dom";
import { IconGift, IconEdit } from "@tabler/icons-react";
import { routes, SECTOR_PRIVILEGES, THIRTEENTH_STATUS } from "../../../../constants";
import { useThirteenth } from "../../../../hooks/personnel-department/use-thirteenths";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { SummaryCard, StatusStepperCard, InstallmentsCard, ThirteenthDetailSkeleton } from "@/components/personnel-department/thirteenth/detail";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import type { Thirteenth } from "../../../../types/thirteenth";

export const ThirteenthDetailPage = () => {
  usePageTracker({ title: "13º Salário", icon: "gift" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: response, isLoading, error } = useThirteenth(
    id || "",
    { include: { user: { include: { position: true, sector: true } } } },
    { enabled: !!id },
  );

  const thirteenth = response?.data as Thirteenth | undefined;

  if (!id || error) {
    return <Navigate to={routes.personnelDepartment.thirteenth.root} replace />;
  }

  const isFinal = thirteenth?.status === THIRTEENTH_STATUS.PAID || thirteenth?.status === THIRTEENTH_STATUS.CANCELLED;

  const actions = [
    {
      key: "edit",
      label: "Editar",
      icon: IconEdit,
      onClick: () => navigate(routes.personnelDepartment.thirteenth.edit(id)),
      variant: "default" as const,
      disabled: isFinal,
    },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <div className="container mx-auto max-w-5xl flex-shrink-0">
          <PageHeader
            variant="detail"
            title={thirteenth?.user?.name ? `13º — ${thirteenth.user.name}` : "13º Salário"}
            icon={IconGift}
            breadcrumbs={[
              { label: "Início", href: "/" },
              { label: "Departamento Pessoal" },
              { label: "13º Salário", href: routes.personnelDepartment.thirteenth.root },
              { label: thirteenth?.user?.name || "Detalhes" },
            ]}
            actions={actions}
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="container mx-auto max-w-5xl">
            {isLoading || !thirteenth ? (
              <ThirteenthDetailSkeleton />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <SummaryCard thirteenth={thirteenth} />
                <StatusStepperCard thirteenth={thirteenth} />
                <InstallmentsCard thirteenth={thirteenth} disabled={thirteenth.status === THIRTEENTH_STATUS.CANCELLED} className="lg:col-span-2" />
              </div>
            )}
          </div>
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default ThirteenthDetailPage;
