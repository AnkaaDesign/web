import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { IconAlertTriangle, IconPackage, IconUser, IconCalendar, IconArrowLeft, IconCheck, IconExclamationCircle } from "@tabler/icons-react";
import { type Borrow } from "../../../../types";
import { BORROW_STATUS, routes, USER_STATUS } from "../../../../constants";
import { formatDateTime, formatRelativeTime } from "../../../../utils";
import { toast } from "sonner";
import { useBorrowMutations } from "../../../../hooks";
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

interface BorrowReturnFormProps {
  borrow: Borrow & {
    item?: { name: string; uniCode?: string; quantity?: number; measureUnit?: string; itemCategory?: { name: string; type: string } };
    user?: { name: string; email?: string; status?: string; position?: { name: string } };
  };
  onCancel: () => void;
}

export function BorrowReturnForm({ borrow, onCancel }: BorrowReturnFormProps) {
  const navigate = useNavigate();
  const { updateAsync, updateMutation } = useBorrowMutations();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const isReturned = borrow.status === BORROW_STATUS.RETURNED || borrow.returnedAt !== null;
  const isLost = borrow.status === BORROW_STATUS.LOST;

  // Calculate borrow duration
  const borrowDate = new Date(borrow.createdAt);
  const currentDate = new Date();
  const returnDate = borrow.returnedAt ? new Date(borrow.returnedAt) : null;

  const handleReturn = async () => {
    try {
      const errors: string[] = [];

      // Comprehensive validation
      if (isReturned) {
        errors.push("Este empréstimo já foi devolvido");
      }

      if (isLost) {
        errors.push("Este empréstimo foi marcado como perdido");
      }

      // Validate borrow exists and has valid data
      if (!borrow.item) {
        errors.push("Informações do item não encontradas");
      }

      if (!borrow.user) {
        errors.push("Informações do usuário não encontradas");
      }

      // Validate item is still a valid tool
      if (borrow.item?.itemCategory?.type !== "TOOL") {
        errors.push("Este item não é mais uma ferramenta válida para empréstimo");
      }

      // Validate user is still active (warning only)
      if (borrow.user?.status && borrow.user.status !== USER_STATUS.EFFECTED) {
        toast.warning("Aviso: Usuário do empréstimo está inativo");
      }

      // Business logic validation
      const daysBorrowed = Math.ceil((currentDate.getTime() - borrowDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysBorrowed > 365) {
        errors.push("Empréstimo muito antigo (mais de 1 ano). Entre em contato com o administrador.");
      }

      // Set validation errors if any
      if (errors.length > 0) {
        setValidationErrors(errors);
        toast.error(errors[0]);
        return;
      }

      // Clear any previous validation errors
      setValidationErrors([]);

      // Proceed with return
      const returnDate = new Date();
      const result = await updateAsync({
        id: borrow.id,
        data: {
          returnedAt: returnDate,
          status: BORROW_STATUS.RETURNED,
        },
      });

      if (result.success) {
        navigate(routes.inventory.loans.list);
      } else {
        setValidationErrors(["Erro ao processar devolução. Tente novamente."]);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error returning borrow:", error);
      }
      setValidationErrors(["Erro inesperado ao processar devolução"]);
    }
  };

  return (
    <>
      <div className="space-y-6">
        {/* Main Information Card */}
        <Card>
          <CardHeader>
            <CardTitle>Informações do Empréstimo</CardTitle>
            <CardDescription>Detalhes do empréstimo e status de devolução</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status Banner */}
            {validationErrors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <IconExclamationCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-red-900">Problemas Encontrados</p>
                  <ul className="text-sm text-red-700 mt-1 space-y-1">
                    {validationErrors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {isReturned ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                <IconCheck className="h-5 w-5 text-green-600" />
                <div className="flex-1">
                  <p className="font-medium text-green-900">Item Devolvido</p>
                  <p className="text-sm text-green-700">Este empréstimo foi devolvido em {formatDateTime(borrow.returnedAt!)}</p>
                  <p className="text-sm text-green-600 mt-1">
                    Duração: {formatRelativeTime(borrowDate)} - {formatRelativeTime(returnDate!)}
                  </p>
                </div>
              </div>
            ) : isLost ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                <IconExclamationCircle className="h-5 w-5 text-red-600" />
                <div className="flex-1">
                  <p className="font-medium text-red-900">Item Perdido</p>
                  <p className="text-sm text-red-700">Este empréstimo foi marcado como perdido</p>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
                <IconAlertTriangle className="h-5 w-5 text-amber-600" />
                <div className="flex-1">
                  <p className="font-medium text-amber-900">Empréstimo Ativo</p>
                  <p className="text-sm text-amber-700">Este item ainda não foi devolvido - emprestado {formatRelativeTime(borrowDate)}</p>
                  <p className="text-sm text-amber-600 mt-1">Duração: {Math.ceil((currentDate.getTime() - borrowDate.getTime()) / (1000 * 60 * 60 * 24))} dia(s)</p>
                </div>
              </div>
            )}

            <Separator />

            {/* Item Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <IconPackage className="h-4 w-4" />
                <span className="text-sm font-medium">Informações do Item</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">Item</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{borrow.item?.name || "-"}</p>
                    {borrow.item?.itemCategory && (
                      <Badge variant="secondary" className="text-xs">
                        {borrow.item.itemCategory.name}
                      </Badge>
                    )}
                  </div>
                </div>
                {borrow.item?.uniCode && (
                  <div>
                    <label className="text-sm text-muted-foreground">Código</label>
                    <p className="font-medium">{borrow.item.uniCode}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm text-muted-foreground">Quantidade Emprestada</label>
                  <p className="font-medium">
                    {borrow.quantity} {borrow.item?.measureUnit || "unidade(s)"}
                  </p>
                </div>
                {borrow.item?.quantity !== undefined && (
                  <div>
                    <label className="text-sm text-muted-foreground">Estoque Atual</label>
                    <p className="font-medium">
                      {borrow.item.quantity} {borrow.item.measureUnit || "unidade(s)"}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* User Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <IconUser className="h-4 w-4" />
                <span className="text-sm font-medium">Informações do Usuário</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">Nome</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{borrow.user?.name || "-"}</p>
                    {borrow.user?.status && (
                      <Badge variant={borrow.user.status === USER_STATUS.EFFECTED ? "default" : "destructive"} className="text-xs">
                        {borrow.user.status === USER_STATUS.EFFECTED ? "Ativo" : "Inativo"}
                      </Badge>
                    )}
                  </div>
                </div>
                {borrow.user?.email && (
                  <div>
                    <label className="text-sm text-muted-foreground">Email</label>
                    <p className="font-medium">{borrow.user.email}</p>
                  </div>
                )}
                {borrow.user?.position && (
                  <div>
                    <label className="text-sm text-muted-foreground">Cargo</label>
                    <p className="font-medium">{borrow.user.position.name}</p>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Date Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <IconCalendar className="h-4 w-4" />
                <span className="text-sm font-medium">Informações de Data</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">Data do Empréstimo</label>
                  <p className="font-medium">{formatDateTime(borrow.createdAt)}</p>
                </div>
                {isReturned && (
                  <div>
                    <label className="text-sm text-muted-foreground">Data de Devolução</label>
                    <p className="font-medium">{formatDateTime(borrow.returnedAt!)}</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-between gap-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={updateMutation.isPending}>
            <IconArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>

          {!isReturned && !isLost && (
            <Button type="button" onClick={() => setShowConfirmDialog(true)} disabled={updateMutation.isPending || validationErrors.length > 0}>
              <IconCheck className="mr-2 h-4 w-4" />
              Marcar como Devolvido
            </Button>
          )}
          {isLost && (
            <Button type="button" variant="outline" disabled>
              <IconExclamationCircle className="mr-2 h-4 w-4" />
              Item Perdido
            </Button>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Devolução</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>Você está prestes a registrar a devolução deste empréstimo:</p>

              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <p className="text-sm">
                  <span className="font-medium">Item:</span> {borrow.item?.name}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Quantidade:</span> {borrow.quantity}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Usuário:</span> {borrow.user?.name}
                </p>
              </div>

              <p className="text-sm text-muted-foreground">Esta ação irá marcar o empréstimo como devolvido e atualizar o estoque do item.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReturn} disabled={updateMutation.isPending}>
              Confirmar Devolução
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
