import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { IconGift, IconCheck, IconClock, IconPlus, IconDots, IconPencil, IconCash, IconTrash } from "@tabler/icons-react";
import { useThirteenths, useThirteenthMutations, useThirteenthPayFirst, useThirteenthPaySecond } from "../../hooks/personnel-department/use-thirteenths";
import { useAuth } from "@/contexts/auth-context";
import { formatCurrency, formatDate } from "../../utils";
import { THIRTEENTH_STATUS_LABELS, THIRTEENTH_STATUS, SECTOR_PRIVILEGES } from "../../constants";
import type { Thirteenth } from "../../types/thirteenth";
import { ThirteenthForm } from "./thirteenth/form/thirteenth-form";

interface CollaboratorThirteenthCardProps {
  userId: string;
  /** Colaborador name, used to label the fixed-user form. */
  userName?: string;
  className?: string;
}

const statusVariant = (status: THIRTEENTH_STATUS): "delivered" | "pending" | "secondary" | "outline" => {
  switch (status) {
    case THIRTEENTH_STATUS.PAID:
      return "delivered";
    case THIRTEENTH_STATUS.FIRST_PAID:
    case THIRTEENTH_STATUS.SECOND_PAID:
      return "secondary";
    case THIRTEENTH_STATUS.CANCELLED:
      return "outline";
    default:
      return "pending";
  }
};

function InstallmentRow({ label, value, date }: { label: string; value: number | null; date: Date | string | null }) {
  const paid = !!date;
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground flex items-center gap-1.5">
        {paid ? <IconCheck className="h-3.5 w-3.5 text-green-600" /> : <IconClock className="h-3.5 w-3.5" />}
        {label}
        {paid && date ? ` · paga em ${formatDate(new Date(date))}` : " · pendente"}
      </span>
      <span className="tabular-nums font-medium">{value != null ? formatCurrency(value) : "-"}</span>
    </div>
  );
}

type PayTarget = { record: Thirteenth; installment: "first" | "second" };

/**
 * 13º Salário — per-employee management surface (replaces the former standalone
 * 13º pages). Surfaces the colaborador's gratificação natalina records and lets
 * HR/ADMIN/Contabilidade lançar, editar, pagar parcelas e excluir. The engine
 * and the Contas a Pagar forecast still consume the same Thirteenth records.
 */
export function CollaboratorThirteenthCard({ userId, userName, className }: CollaboratorThirteenthCardProps) {
  const { user: currentUser } = useAuth();
  const privileges = currentUser?.sector?.privileges;
  const canManage =
    privileges === SECTOR_PRIVILEGES.ADMIN ||
    privileges === SECTOR_PRIVILEGES.HUMAN_RESOURCES ||
    privileges === SECTOR_PRIVILEGES.ACCOUNTING;

  const { data, isLoading } = useThirteenths({ where: { userId }, orderBy: { year: "desc" }, limit: 20 });
  const { createAsync, updateAsync, deleteAsync, isLoading: isMutating } = useThirteenthMutations();
  const payFirst = useThirteenthPayFirst();
  const paySecond = useThirteenthPaySecond();

  const records = (data?.data ?? []) as Thirteenth[];

  const [createOpen, setCreateOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<Thirteenth | null>(null);
  const [payTarget, setPayTarget] = useState<PayTarget | null>(null);
  const [payDate, setPayDate] = useState<Date>(new Date());
  const [deleteRecord, setDeleteRecord] = useState<Thirteenth | null>(null);

  // Keep the section hidden for viewers without records (preserves prior UX).
  // Managers always see it so they can lançar a new 13º.
  if (isLoading) return null;
  if (records.length === 0 && !canManage) return null;

  const handleCreate = async (formData: any) => {
    await createAsync({ data: formData });
    setCreateOpen(false);
  };

  const handleEdit = async (formData: any) => {
    if (!editRecord) return;
    await updateAsync({ id: editRecord.id, data: formData });
    setEditRecord(null);
  };

  const handlePay = async () => {
    if (!payTarget) return;
    const args = { id: payTarget.record.id, data: { paidAt: payDate } };
    if (payTarget.installment === "first") await payFirst.mutateAsync(args);
    else await paySecond.mutateAsync(args);
    setPayTarget(null);
  };

  const handleDelete = async () => {
    if (!deleteRecord) return;
    await deleteAsync(deleteRecord.id);
    setDeleteRecord(null);
  };

  const canPayFirst = (t: Thirteenth) => t.status !== THIRTEENTH_STATUS.CANCELLED && !t.firstInstallmentDate;
  const canPaySecond = (t: Thirteenth) => t.status !== THIRTEENTH_STATUS.CANCELLED && !!t.firstInstallmentDate && !t.secondInstallmentDate;

  return (
    <Card className={className}>
      <CardHeader className="pb-4 flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <IconGift className="h-5 w-5 text-muted-foreground" />
          13º Salário
        </CardTitle>
        {canManage && (
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
            <IconPlus className="h-4 w-4 mr-1.5" />
            Lançar 13º
          </Button>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {records.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Nenhum registro de 13º para este colaborador. Use "Lançar 13º" para criar manualmente ou a rotina anual na listagem de colaboradores.
          </p>
        ) : (
          <div className="space-y-3">
            {records.map((t) => {
              const total = (t.firstInstallment ?? 0) + (t.secondInstallment ?? 0);
              return (
                <div key={t.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{t.year}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {t.avos}/12 avos
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={statusVariant(t.status)} className="text-xs">
                        {THIRTEENTH_STATUS_LABELS[t.status] ?? t.status}
                      </Badge>
                      {canManage && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <IconDots className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditRecord(t)}>
                              <IconPencil className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            {canPayFirst(t) && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setPayDate(new Date());
                                  setPayTarget({ record: t, installment: "first" });
                                }}
                              >
                                <IconCash className="h-4 w-4 mr-2" />
                                Pagar 1ª parcela
                              </DropdownMenuItem>
                            )}
                            {canPaySecond(t) && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setPayDate(new Date());
                                  setPayTarget({ record: t, installment: "second" });
                                }}
                              >
                                <IconCash className="h-4 w-4 mr-2" />
                                Pagar 2ª parcela
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteRecord(t)}>
                              <IconTrash className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <InstallmentRow label="1ª parcela" value={t.firstInstallment} date={t.firstInstallmentDate} />
                    <InstallmentRow label="2ª parcela" value={t.secondInstallment} date={t.secondInstallmentDate} />
                    <div className="flex items-center justify-between text-sm pt-1.5 mt-1.5 border-t border-border/50">
                      <span className="text-muted-foreground">Total</span>
                      <span className="tabular-nums font-semibold">{formatCurrency(total)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Lançar 13º */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Lançar 13º Salário</DialogTitle>
            <DialogDescription>Registro manual de 13º para este colaborador.</DialogDescription>
          </DialogHeader>
          {createOpen && (
            <ThirteenthForm
              mode="create"
              formId="thirteenth-create-form"
              fixedUser={{ id: userId, name: userName ?? "Colaborador" }}
              isSubmitting={isMutating}
              onSubmit={handleCreate}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={isMutating}>
              Cancelar
            </Button>
            <Button onClick={() => document.getElementById("thirteenth-create-form-submit")?.click()} disabled={isMutating}>
              Lançar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editar 13º */}
      <Dialog open={!!editRecord} onOpenChange={(o) => !o && setEditRecord(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar 13º Salário {editRecord ? `· ${editRecord.year}` : ""}</DialogTitle>
            <DialogDescription>Ajuste manual de avos, base e status. As parcelas são recalculadas pelo servidor.</DialogDescription>
          </DialogHeader>
          {editRecord && (
            <ThirteenthForm
              mode="update"
              formId="thirteenth-edit-form"
              thirteenth={editRecord}
              isSubmitting={isMutating}
              onSubmit={handleEdit}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRecord(null)} disabled={isMutating}>
              Cancelar
            </Button>
            <Button onClick={() => document.getElementById("thirteenth-edit-form-submit")?.click()} disabled={isMutating}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pagar parcela */}
      <Dialog open={!!payTarget} onOpenChange={(o) => !o && setPayTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pagar {payTarget?.installment === "first" ? "1ª" : "2ª"} parcela</DialogTitle>
            <DialogDescription>
              Confirme o pagamento da {payTarget?.installment === "first" ? "primeira" : "segunda"} parcela do 13º de {payTarget?.record.year}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Data do pagamento</label>
            <DateTimeInput mode="date" context="due" value={payDate} onChange={(d) => d instanceof Date && setPayDate(d)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayTarget(null)} disabled={payFirst.isPending || paySecond.isPending}>
              Cancelar
            </Button>
            <Button onClick={handlePay} disabled={payFirst.isPending || paySecond.isPending}>
              Confirmar pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excluir 13º */}
      <AlertDialog open={!!deleteRecord} onOpenChange={(o) => !o && setDeleteRecord(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir 13º Salário</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir o registro de 13º de {deleteRecord?.year}? Esta ação não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMutating}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isMutating} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
