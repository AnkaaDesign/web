import { useParams, Navigate } from "react-router-dom";
import { IconRefresh, IconArrowsExchange, IconUser, IconBriefcase } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES, CHANGE_LOG_ENTITY_TYPE, POSITION_CHANGE_REASON_LABELS } from "../../../../constants";
import type { POSITION_CHANGE_REASON } from "../../../../constants";
import { useUserPositionHistory, useUserSalaryAt } from "@/hooks/personnel-department/use-user-position-history";
import { formatCurrency, formatDate, formatDateTime } from "../../../../utils";
import {
  getReasonBadgeVariant,
  PositionChangeSummary,
  ChangedByLabel,
} from "@/components/personnel-department/user-position-history/list/user-position-history-table-columns";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DetailRow } from "@/components/ui/detail-row";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import type { UserSalaryAtResult } from "../../../../types/user-position-history";

const REQUIRED_PRIVILEGES = [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN];

export const PromotionDetailPage = () => {
  usePageTracker({ title: "Detalhes da Promoção" });
  const { id } = useParams<{ id: string }>();

  const {
    data: response,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useUserPositionHistory(id || "", {
    include: {
      user: { include: { position: true, sector: true } },
      position: true,
      previousPosition: true,
      changedBy: true,
    },
    enabled: !!id,
  });

  const history = response?.data;

  // Reajuste relacionado: NÃO há salário em UserPositionHistory. A "mudança
  // salarial" de uma promoção é a remuneração do cargo de destino vigente na
  // data da mudança vs. a do cargo anterior. Resolvemos via o resolver
  // histórico de salário (cargo-na-data × MonetaryValue-na-data).
  const { data: salaryResponse } = useUserSalaryAt(
    {
      userId: history?.userId,
      date: history?.startedAt ? new Date(history.startedAt).toISOString() : undefined,
    },
    { enabled: !!history?.userId && !!history?.startedAt },
  );
  const salaryAt = (Array.isArray(salaryResponse?.data) ? salaryResponse?.data[0] : salaryResponse?.data) as UserSalaryAtResult | null | undefined;

  if (!id) {
    return <Navigate to={routes.personnelDepartment.promotions.root} replace />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-destructive mb-4">Erro ao carregar a mudança de cargo</p>
        <Navigate to={routes.personnelDepartment.promotions.root} replace />
      </div>
    );
  }

  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={REQUIRED_PRIVILEGES}>
        <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Skeleton className="h-72 w-full" />
            <Skeleton className="h-72 w-full" />
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  if (!history) {
    return <Navigate to={routes.personnelDepartment.promotions.root} replace />;
  }

  const reasonLabel = POSITION_CHANGE_REASON_LABELS[history.reason as POSITION_CHANGE_REASON] || history.reason;
  const title = history.user?.name ? `${reasonLabel} — ${history.user.name}` : reasonLabel;
  const isCurrent = !history.endedAt;

  const actions = [
    {
      key: "refresh",
      label: "Atualizar",
      icon: IconRefresh,
      onClick: () => refetch(),
      loading: isRefetching,
    },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={REQUIRED_PRIVILEGES}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="detail"
          title={title}
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Departamento Pessoal", href: routes.personnelDepartment.root },
            { label: "Promoções", href: routes.personnelDepartment.promotions.root },
            { label: history.user?.name || "Detalhes" },
          ]}
          actions={actions}
          className="flex-shrink-0"
        />
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
              {/* Resumo da mudança de cargo */}
              <Card className="shadow-sm border border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconArrowsExchange className="h-5 w-5 text-muted-foreground" />
                    Resumo da Mudança
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <DetailRow icon={IconUser} label="Colaborador" value={history.user?.name || "-"} />
                    <DetailRow
                      label="Mudança de Cargo"
                      value={<PositionChangeSummary history={history} className="justify-end" />}
                    />
                    <DetailRow
                      label="Motivo"
                      value={<Badge variant={getReasonBadgeVariant(history.reason)}>{reasonLabel}</Badge>}
                    />
                    <DetailRow label="Início" value={history.startedAt ? formatDate(new Date(history.startedAt)) : "-"} />
                    <DetailRow
                      label="Fim"
                      value={history.endedAt ? formatDate(new Date(history.endedAt)) : <Badge variant="active">Atual</Badge>}
                    />
                    <DetailRow label="Alterado Por" value={<ChangedByLabel history={history} />} />
                    <DetailRow label="Criado Em" value={history.createdAt ? formatDateTime(new Date(history.createdAt)) : "-"} />
                    {history.note && <DetailRow label="Observação" value={<span className="break-words">{history.note}</span>} block />}
                  </div>
                </CardContent>
              </Card>

              {/* Reajuste relacionado — remuneração do cargo na data da mudança */}
              <Card className="shadow-sm border border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconBriefcase className="h-5 w-5 text-muted-foreground" />
                    Remuneração do Cargo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <DetailRow
                      label="Cargo Atual"
                      value={history.position?.name || (isCurrent ? history.user?.position?.name : null) || "-"}
                    />
                    <DetailRow
                      label="Remuneração na Mudança"
                      value={
                        salaryAt?.salary !== null && salaryAt?.salary !== undefined ? (
                          formatCurrency(salaryAt.salary)
                        ) : (
                          <span className="text-muted-foreground italic">Sem remuneração vigente na data</span>
                        )
                      }
                    />
                    {salaryAt?.effectiveDate && (
                      <DetailRow label="Vigente Desde" value={formatDate(new Date(salaryAt.effectiveDate))} />
                    )}
                    <p className="text-xs text-muted-foreground pt-1 px-1">
                      A remuneração reflete o valor do cargo vigente na data da mudança. Reajustes salariais são registrados separadamente em Reajustes.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Histórico de Alterações */}
            <ChangelogHistory
              entityType={CHANGE_LOG_ENTITY_TYPE.USER_POSITION_HISTORY}
              entityId={id}
              entityName={title}
              entityCreatedAt={history.createdAt}
            />
          </div>
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default PromotionDetailPage;
