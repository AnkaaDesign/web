import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { IconTrash, IconRefresh, IconLoader2, IconAlertTriangle, IconPercentage, IconBriefcase } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES, CHANGE_LOG_ENTITY_TYPE, SALARY_ADJUSTMENT_TYPE_LABELS } from "../../../../constants";
import type { SALARY_ADJUSTMENT_TYPE } from "../../../../constants";
import { useSalaryAdjustment, useSalaryAdjustmentMutations } from "@/hooks/personnel-department/use-salary-adjustment";
import { useAuth } from "@/hooks/common/use-auth";
import { formatCurrency, formatDate, formatDateTime } from "../../../../utils";
import { formatPercentage } from "@/components/personnel-department/salary-adjustment/list/salary-adjustment-table-columns";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { DetailRow } from "@/components/ui/detail-row";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

const REQUIRED_PRIVILEGES = [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN];

export const SalaryAdjustmentDetailPage = () => {
  usePageTracker({ title: "Detalhes do Reajuste" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const { user } = useAuth();
  const isAdmin = user?.sector?.privileges === SECTOR_PRIVILEGES.ADMIN;

  const {
    data: response,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useSalaryAdjustment(id || "", {
    include: {
      appliedBy: true,
      items: {
        include: {
          position: true,
        },
      },
    },
    enabled: !!id,
  });

  const { deleteAsync, deleteMutation } = useSalaryAdjustmentMutations();

  const adjustment = response?.data;

  if (!id) {
    return <Navigate to={routes.personnelDepartment.salaryAdjustments.root} replace />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-destructive mb-4">Erro ao carregar reajuste salarial</p>
        <Navigate to={routes.personnelDepartment.salaryAdjustments.root} replace />
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
          <Skeleton className="h-64 w-full" />
        </div>
      </PrivilegeRoute>
    );
  }

  if (!adjustment) {
    return <Navigate to={routes.personnelDepartment.salaryAdjustments.root} replace />;
  }

  const handleDelete = async () => {
    try {
      await deleteAsync(id);
      navigate(routes.personnelDepartment.salaryAdjustments.root);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error deleting salary adjustment:", error);
      }
    }
    setIsDeleteDialogOpen(false);
  };

  const title = `${SALARY_ADJUSTMENT_TYPE_LABELS[adjustment.type as SALARY_ADJUSTMENT_TYPE] || adjustment.type} — ${formatDate(new Date(adjustment.effectiveDate))}`;
  const items = adjustment.items || [];

  const actions = [
    {
      key: "refresh",
      label: "Atualizar",
      icon: IconRefresh,
      onClick: () => refetch(),
      loading: isRefetching,
    },
    ...(isAdmin
      ? [
          {
            key: "delete",
            label: "Excluir",
            icon: IconTrash,
            onClick: () => setIsDeleteDialogOpen(true),
            disabled: deleteMutation.isPending,
          },
        ]
      : []),
  ];

  return (
    <PrivilegeRoute requiredPrivilege={REQUIRED_PRIVILEGES}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="detail"
          title={title}
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Departamento Pessoal" },
            { label: "Reajustes", href: routes.personnelDepartment.salaryAdjustments.root },
            { label: formatDate(new Date(adjustment.effectiveDate)) },
          ]}
          actions={actions}
          className="flex-shrink-0"
        />
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="space-y-4">
            {/* Summary and Changelog Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
              <Card className="shadow-sm border border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconPercentage className="h-5 w-5 text-muted-foreground" />
                    Resumo do Reajuste
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <DetailRow
                      label="Tipo"
                      value={<Badge variant="secondary">{SALARY_ADJUSTMENT_TYPE_LABELS[adjustment.type as SALARY_ADJUSTMENT_TYPE] || adjustment.type}</Badge>}
                    />
                    <DetailRow
                      label="Percentual"
                      value={
                        adjustment.percentage !== null && adjustment.percentage !== undefined ? (
                          formatPercentage(adjustment.percentage)
                        ) : (
                          <Badge variant="outline">Valores personalizados</Badge>
                        )
                      }
                    />
                    <DetailRow label="Data de Vigência" value={formatDate(new Date(adjustment.effectiveDate))} />
                    <DetailRow label="Cargos Afetados" value={<Badge variant="default">{items.length}</Badge>} />
                    <DetailRow label="Aplicado Por" value={adjustment.appliedBy?.name || "-"} />
                    <DetailRow label="Criado Em" value={adjustment.createdAt ? formatDateTime(new Date(adjustment.createdAt)) : "-"} />
                    {adjustment.note && <DetailRow label="Observação" value={<span className="break-words">{adjustment.note}</span>} block />}
                  </div>
                </CardContent>
              </Card>

              <ChangelogHistory
                entityType={CHANGE_LOG_ENTITY_TYPE.SALARY_ADJUSTMENT}
                entityId={id}
                entityName={title}
                entityCreatedAt={adjustment.createdAt}
                className="h-full"
              />
            </div>

            {/* Items table */}
            <Card className="shadow-sm border border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconBriefcase className="h-5 w-5 text-muted-foreground" />
                  Cargos Reajustados
                </CardTitle>
              </CardHeader>
              <CardContent>
                {items.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-4 text-center">Nenhum cargo vinculado a este reajuste.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted hover:bg-muted">
                        <TableHead className="text-foreground font-bold uppercase text-xs">Cargo</TableHead>
                        <TableHead className="text-foreground font-bold uppercase text-xs text-right">Valor Anterior</TableHead>
                        <TableHead className="text-foreground font-bold uppercase text-xs text-right">Novo Valor</TableHead>
                        <TableHead className="text-foreground font-bold uppercase text-xs text-right">Variação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, index) => {
                        const delta = item.previousValue > 0 ? ((item.newValue - item.previousValue) / item.previousValue) * 100 : null;
                        return (
                          <TableRow key={item.id} className={index % 2 === 1 ? "bg-muted/10" : undefined}>
                            <TableCell className="font-medium">{item.position?.name || item.positionId}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.previousValue)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.newValue)}</TableCell>
                            <TableCell className="text-right">
                              {delta === null ? (
                                <span className="text-muted-foreground">-</span>
                              ) : (
                                <span className={delta > 0 ? "text-destructive" : delta < 0 ? "text-emerald-600" : "text-muted-foreground"}>{formatPercentage(delta)}</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <IconAlertTriangle className="h-5 w-5 text-destructive" />
                Confirmar Exclusão
              </DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir este reajuste salarial? A exclusão remove apenas o registro do histórico — as remunerações atuais dos cargos não serão
                alteradas. Esta ação não poderá ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? <IconLoader2 className="h-4 w-4 mr-2 animate-spin" /> : <IconTrash className="h-4 w-4 mr-2" />}
                Excluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PrivilegeRoute>
  );
};

export default SalaryAdjustmentDetailPage;
