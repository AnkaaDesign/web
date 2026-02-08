import { useParams, useNavigate } from "react-router-dom";
import { useExternalWithdrawal } from "../../../../hooks";
import { routes, EXTERNAL_WITHDRAWAL_STATUS } from "../../../../constants";
import type { ExternalWithdrawal } from "../../../../types";
import { Button } from "@/components/ui/button";
import { IconAlertTriangle, IconPackage } from "@tabler/icons-react";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { SECTOR_PRIVILEGES } from "../../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ExternalWithdrawalEditForm } from "@/components/inventory/external-withdrawal/form/external-withdrawal-edit-form";

export const ExternalWithdrawalEditPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Track page access
  usePageTracker({
    title: "Editar Retirada Externa",
    icon: "edit",
  });

  const {
    data: response,
    isLoading,
    error,
  } = useExternalWithdrawal(id!, {
    include: {
      items: {
        include: {
          item: {
            include: {
              category: true,
              brand: true,
            },
          },
        },
      },
      budgets: true,
      receipts: true,
      invoices: true,
    },
    enabled: !!id,
  });

  const withdrawal = response?.data;

  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="h-full flex flex-col px-4 pt-4">
          <div className="flex-shrink-0">
            <div className="h-32 bg-muted rounded-xl animate-pulse"></div>
          </div>
          <div className="flex-1 overflow-y-auto pb-6">
            <div className="mt-4 h-96 bg-muted rounded-xl animate-pulse"></div>
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  if (error || !withdrawal) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="h-full flex flex-col px-4 pt-4">
          <div className="flex-shrink-0">
            <PageHeader
              variant="form"
              title="Editar Retirada Externa"
              icon={IconPackage}
              breadcrumbs={[
                { label: "Início", href: routes.home },
                { label: "Estoque", href: routes.inventory.root },
                { label: "Retiradas Externas", href: routes.inventory.externalWithdrawals?.list || "/inventory/external-withdrawals" },
                { label: "Editar" },
              ]}
              backButton={{
                onClick: () => navigate(routes.inventory.externalWithdrawals?.list || "/inventory/external-withdrawals"),
              }}
            />
          </div>

          <div className="flex-1 overflow-y-auto pb-6">
            <div className="mt-4">
              <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="text-center max-w-md mx-auto">
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                    <IconAlertTriangle className="h-10 w-10 text-red-500" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-semibold mb-3 text-foreground">Retirada externa não encontrada</h2>
                  <p className="text-sm sm:text-base text-muted-foreground mb-6 leading-relaxed">
                    A retirada externa que você está tentando editar não existe ou foi removida do sistema.
                  </p>
                  <div className="space-y-3">
                    <Button onClick={() => navigate(routes.inventory.externalWithdrawals?.list || "/inventory/external-withdrawals")} className="w-full sm:w-auto">
                      Ir para Lista de Retiradas
                    </Button>
                    <Button variant="outline" onClick={() => navigate(routes.inventory.root)} className="w-full sm:w-auto">
                      Ir para Estoque
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            </div>
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  // Check if withdrawal can be edited
  const canEdit = [EXTERNAL_WITHDRAWAL_STATUS.PENDING, EXTERNAL_WITHDRAWAL_STATUS.PARTIALLY_RETURNED].includes(withdrawal.status);

  if (!canEdit) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="h-full flex flex-col px-4 pt-4">
          <div className="flex-shrink-0">
            <PageHeader
              variant="form"
              title="Editar Retirada Externa"
              icon={IconPackage}
              breadcrumbs={[
                { label: "Início", href: routes.home },
                { label: "Estoque", href: routes.inventory.root },
                { label: "Retiradas Externas", href: routes.inventory.externalWithdrawals?.list || "/inventory/external-withdrawals" },
                { label: `#${withdrawal.id.slice(-8)}` },
                { label: "Editar" },
              ]}
              backButton={{
                onClick: () => navigate(routes.inventory.externalWithdrawals?.list || "/inventory/external-withdrawals"),
              }}
            />
          </div>

          <div className="flex-1 overflow-y-auto pb-6">
            <div className="mt-4">
              <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="text-center max-w-md mx-auto">
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                    <IconPackage className="h-10 w-10 text-amber-500" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-semibold mb-3 text-foreground">Retirada não pode ser editada</h2>
                  <p className="text-sm sm:text-base text-muted-foreground mb-6 leading-relaxed">
                    Esta retirada externa não pode ser editada porque seu status atual é "{withdrawal.status}". Apenas retiradas ativas ou parcialmente devolvidas podem ser
                    editadas.
                  </p>
                  <div className="space-y-3">
                    <Button onClick={() => navigate(`/inventory/external-withdrawals/details/${withdrawal.id}`)} className="w-full sm:w-auto">
                      Ver Detalhes
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => navigate(routes.inventory.externalWithdrawals?.list || "/inventory/external-withdrawals")}
                      className="w-full sm:w-auto"
                    >
                      Ir para Lista de Retiradas
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            </div>
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  // Ensure items are loaded
  if (!withdrawal.items) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-muted-foreground">Carregando itens...</span>
        </div>
      </div>
    );
  }

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN]}>
      <ExternalWithdrawalEditForm withdrawal={withdrawal as ExternalWithdrawal & { items: NonNullable<ExternalWithdrawal["items"]> }} />
    </PrivilegeRoute>
  );
};
