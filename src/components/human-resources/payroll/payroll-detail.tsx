import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  IconArrowLeft,
  IconEdit,
  IconPlus,
  IconTrash,
  IconCurrencyReal,
  IconUser,
  IconCalendar,
  IconCalculator,
  IconFileText,
  IconGripVertical,
  IconRefresh,
} from "@tabler/icons-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import {
  usePayrollByUserAndPeriod,
  usePayrollDiscountMutations,
  usePayrollMutations,
} from "../../../hooks";
import { formatCurrency } from "../../../utils";
import { routes } from "../../../constants";
import type { Discount } from "../../../types";
import { DiscountForm } from "./discount-form";
import { PayrollCalculation } from "./payroll-calculation";
import { PayrollSummaryCard } from "./payroll-summary-card";

interface PayrollDetailProps {
  className?: string;
}

export function PayrollDetail({ className }: PayrollDetailProps) {
  const { year, month, userId } = useParams<{
    year: string;
    month: string;
    userId: string;
  }>();
  const navigate = useNavigate();

  const [showDiscountDialog, setShowDiscountDialog] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);
  const [showCalculationDialog, setShowCalculationDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ items: Discount[]; isBulk: boolean } | null>(null);

  // Parse URL params
  const yearNum = year ? parseInt(year) : 0;
  const monthNum = month ? parseInt(month) : 0;

  // Fetch payroll data
  const {
    data: payrollResponse,
    isLoading,
    error,
    refetch
  } = usePayrollByUserAndPeriod(userId!, yearNum, monthNum);

  const payroll = payrollResponse;

  // Discount mutations
  const {
    addDiscount,
    removeDiscount,
    updateDiscount,
    isLoading: isDiscountLoading,
  } = usePayrollDiscountMutations();

  // Payroll mutations for updating discount order
  const { update: updatePayroll } = usePayrollMutations();

  // Calculate totals with proper fallbacks
  // Get base remuneration from payroll.baseRemuneration, or user.position.baseRemuneration, or 0
  const baseRemuneration = payroll?.baseRemuneration || payroll?.user?.position?.baseRemuneration || 0;
  const bonusValue = payroll?.bonus?.baseBonus || 0;
  const grossSalary = Number(baseRemuneration) + Number(bonusValue);

  const totalDiscounts = payroll?.discounts?.reduce((sum, discount) => {
    if (discount.value) {
      return sum + Number(discount.value);
    }
    if (discount.percentage) {
      return sum + (Number(grossSalary) * Number(discount.percentage) / 100);
    }
    return sum;
  }, 0) || 0;

  const netSalary = Math.max(0, Number(grossSalary) - Number(totalDiscounts));

  // Handle discount operations
  const handleAddDiscount = (discountData: any) => {
    if (!payroll) return;

    addDiscount({
      payrollId: payroll.id,
      discount: {
        ...discountData,
        calculationOrder: (payroll.discounts?.length || 0) + 1,
      }
    }, {
      onSuccess: () => {
        setShowDiscountDialog(false);
        refetch();
      }
    });
  };

  const handleUpdateDiscount = (discountData: any) => {
    if (!payroll || !editingDiscount) return;

    updateDiscount({
      payrollId: payroll.id,
      discountId: editingDiscount.id,
      discount: discountData
    }, {
      onSuccess: () => {
        setEditingDiscount(null);
        refetch();
      }
    });
  };

  const handleRemoveDiscount = (discount: Discount) => {
    if (!payroll) return;

    setDeleteDialog({
      items: [discount],
      isBulk: false
    });
  };

  const confirmDelete = () => {
    if (!payroll || !deleteDialog) return;

    if (deleteDialog.isBulk) {
      // Bulk delete if needed (currently not used)
      deleteDialog.items.forEach(discount => {
        removeDiscount({
          payrollId: payroll.id,
          discountId: discount.id
        }, {
          onSuccess: () => refetch()
        });
      });
    } else {
      // Single delete
      removeDiscount({
        payrollId: payroll.id,
        discountId: deleteDialog.items[0].id
      }, {
        onSuccess: () => refetch()
      });
    }

    setDeleteDialog(null);
  };

  // Handle drag and drop reordering of discounts
  const handleDiscountReorder = (result: DropResult) => {
    if (!result.destination || !payroll?.discounts) return;

    const items = Array.from(payroll.discounts);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update discount orders
    const updatedDiscounts = items.map((discount, index) => ({
      ...discount,
      calculationOrder: index + 1
    }));

    // Optimistically update UI and persist changes
    // This would require backend support for reordering
    // TODO: Implement backend endpoint for reordering
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando folha de pagamento...</p>
        </div>
      </div>
    );
  }

  if (error || !payroll) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-destructive mb-4">Erro ao carregar folha de pagamento</p>
          <Button onClick={() => refetch()}>
            <IconRefresh className="h-4 w-4 mr-2" />
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(routes.humanResources.payroll.root)}
          >
            <IconArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Folha de Pagamento
            </h1>
            <p className="text-muted-foreground">
              {payroll.user?.name || payroll.userName || "Funcionário"} - {monthNum}/{yearNum}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Dialog open={showCalculationDialog} onOpenChange={setShowCalculationDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <IconCalculator className="h-4 w-4 mr-2" />
                Cálculos ao Vivo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Cálculos em Tempo Real</DialogTitle>
                <DialogDescription>
                  Visualize os cálculos atualizados da folha de pagamento
                </DialogDescription>
              </DialogHeader>
              <PayrollCalculation userId={userId!} year={yearNum} month={monthNum} />
            </DialogContent>
          </Dialog>

          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <IconRefresh className="h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Employee Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <IconUser className="h-5 w-5" />
            <CardTitle>Informações do Funcionário</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Nome</label>
              <p className="font-medium">{payroll.user?.name || payroll.userName || "Funcionário"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <p className="text-sm">{payroll.user?.email || payroll.userEmail || "N/A"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Setor</label>
              <p className="text-sm">{payroll.user?.sector?.name || payroll.user?.position?.sector?.name || "N/A"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Cargo</label>
              <p className="text-sm">{payroll.user?.position?.name || payroll.user?.position?.title || "N/A"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comprehensive Payroll Summary */}
      <PayrollSummaryCard payroll={payroll} />

      {/* Additional Info Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Bonus Details */}
        {payroll.bonus && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IconCurrencyReal className="h-5 w-5 text-green-600" />
                  <CardTitle>Detalhes do Bônus</CardTitle>
                </div>
                <Badge variant="secondary">Vinculado</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Valor Base:</span>
                  <span className="font-semibold text-green-600">
                    {formatCurrency(Number(payroll.bonus?.baseBonus) || 0)}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span>Total de Tarefas:</span>
                  <span>{payroll.taskStats?.totalTasks || payroll.bonus.taskCount || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tarefas Completas:</span>
                  <span>{payroll.taskStats?.fullCommissionTasks || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tarefas Parciais:</span>
                  <span>{payroll.taskStats?.partialCommissionTasks || 0}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold">
                  <span>Total Ponderado:</span>
                  <span>
                    {payroll.taskStats?.totalPonderado?.toFixed(1) || '0.0'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Period & Working Days Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <IconCalendar className="h-5 w-5" />
              <CardTitle>Período e Dias Trabalhados</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Ano/Mês:</span>
                <span className="font-medium">{monthNum}/{yearNum}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Mês:</span>
                <span className="font-medium">
                  {new Date(yearNum, monthNum - 1).toLocaleDateString("pt-BR", {
                    month: "long"
                  })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Período de Apuração:</span>
                <span className="font-medium">26/{(monthNum - 1) || 12} à 25/{monthNum}</span>
              </div>
              <Separator />
              {payroll.workingDaysInMonth && (
                <div className="flex justify-between text-sm">
                  <span>Dias Úteis no Mês:</span>
                  <span className="font-medium">{payroll.workingDaysInMonth} dias</span>
                </div>
              )}
              {payroll.workedDaysInMonth && (
                <div className="flex justify-between text-sm">
                  <span>Dias Trabalhados:</span>
                  <span className="font-medium">{payroll.workedDaysInMonth} dias</span>
                </div>
              )}
              {(payroll.absenceDays && payroll.absenceDays > 0) && (
                <div className="flex justify-between text-sm">
                  <span className="text-red-600">Dias de Falta:</span>
                  <span className="font-medium text-red-600">{payroll.absenceDays} dias</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Discounts Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IconFileText className="h-5 w-5" />
              <div>
                <CardTitle>Descontos</CardTitle>
                <CardDescription>
                  {payroll.discounts?.length || 0} desconto(s) aplicado(s)
                </CardDescription>
              </div>
            </div>

            <Dialog open={showDiscountDialog} onOpenChange={setShowDiscountDialog}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <IconPlus className="h-4 w-4 mr-2" />
                  Adicionar Desconto
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Desconto</DialogTitle>
                  <DialogDescription>
                    Adicione um novo desconto à folha de pagamento
                  </DialogDescription>
                </DialogHeader>
                <DiscountForm
                  onSubmit={handleAddDiscount}
                  onCancel={() => setShowDiscountDialog(false)}
                  isLoading={isDiscountLoading}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {payroll.discounts && payroll.discounts.length > 0 ? (
            <DragDropContext onDragEnd={handleDiscountReorder}>
              <Droppable droppableId="discounts">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="space-y-3"
                  >
                    {payroll.discounts.map((discount, index) => {
                      const discountValue = discount.value
                        ? Number(discount.value)
                        : discount.percentage
                        ? (Number(grossSalary) * Number(discount.percentage) / 100)
                        : 0;

                      return (
                        <Draggable
                          key={discount.id}
                          draggableId={discount.id}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`flex items-center gap-4 p-4 border rounded-lg bg-card ${
                                snapshot.isDragging ? "shadow-sm" : ""
                              }`}
                            >
                              <div
                                {...provided.dragHandleProps}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <IconGripVertical className="h-4 w-4" />
                              </div>

                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-medium">{discount.reference}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {discount.value
                                        ? "Valor fixo"
                                        : `${discount.percentage}% do salário bruto`
                                      }
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-medium text-red-600">
                                      -{formatCurrency(Number(discountValue) || 0)}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setEditingDiscount(discount)}
                                >
                                  <IconEdit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRemoveDiscount(discount)}
                                >
                                  <IconTrash className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <IconFileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum desconto aplicado</p>
              <p className="text-sm">Clique em "Adicionar Desconto" para adicionar descontos</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Discount Dialog */}
      <Dialog
        open={editingDiscount !== null}
        onOpenChange={(open) => !open && setEditingDiscount(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Desconto</DialogTitle>
            <DialogDescription>
              Modifique os dados do desconto
            </DialogDescription>
          </DialogHeader>
          {editingDiscount && (
            <DiscountForm
              initialData={editingDiscount}
              onSubmit={handleUpdateDiscount}
              onCancel={() => setEditingDiscount(null)}
              isLoading={isDiscountLoading}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Discount Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Desconto</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog?.isBulk && deleteDialog.items.length > 1
                ? `Tem certeza que deseja remover ${deleteDialog.items.length} descontos? Esta ação não pode ser desfeita.`
                : `Tem certeza que deseja remover o desconto "${deleteDialog?.items[0]?.reference}"? Esta ação não pode ser desfeita.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}