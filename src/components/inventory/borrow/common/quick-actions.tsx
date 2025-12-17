import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { IconPackageExport, IconCalendarTime, IconSearch, IconPlus, IconQrcode, IconLoader2, IconHistory, IconAlertCircle } from "@tabler/icons-react";
import { BORROW_STATUS, routes } from "../../../../constants";
import { toast } from "sonner";
import { useBorrowMutations, usePrivileges } from "../../../../hooks";
import { useNavigate } from "react-router-dom";
import type { Borrow } from "../../../../types";
import { formatDateTime } from "../../../../utils";
import { cn } from "@/lib/utils";

interface QuickActionsProps {
  selectedBorrows?: Borrow[];
  className?: string;
  size?: "default" | "sm" | "lg";
  variant?: "default" | "outline" | "secondary";
}

export function QuickActions({ selectedBorrows = [], className, size = "default", variant = "default" }: QuickActionsProps) {
  const navigate = useNavigate();
  const { canManageWarehouse } = usePrivileges();
  const { updateMutation } = useBorrowMutations();
  const [showBatchReturnDialog, setShowBatchReturnDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Filter active borrows that can be returned
  const activeBorrows = selectedBorrows.filter((b) => b.status === BORROW_STATUS.ACTIVE);
  const canBatchReturn = activeBorrows.length > 0 && canManageWarehouse;

  // Quick navigation actions
  const handleNewBorrow = () => {
    navigate(routes.inventory.loans.create);
  };

  const handleSearchBorrows = () => {
    navigate(routes.inventory.loans.list);
  };

  const handleScanReturn = () => {
    // This could open a QR/barcode scanner dialog
    toast.info("Scanner não disponível", { description: "A funcionalidade de scanner será implementada em breve." });
  };

  const handleViewHistory = () => {
    navigate(routes.inventory.loans.list + "?status=RETURNED");
  };

  // Batch return functionality
  const handleBatchReturn = async () => {
    if (!canBatchReturn) return;

    setIsProcessing(true);
    try {
      const returnPromises = activeBorrows.map((borrow) =>
        updateMutation.mutateAsync({
          id: borrow.id,
          data: {
            status: BORROW_STATUS.RETURNED,
            returnedAt: new Date(),
          },
        }),
      );

      await Promise.all(returnPromises);
      setShowBatchReturnDialog(false);
    } catch (error) {
      console.error("Error processing batch returns:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const actionButtons = [
    {
      icon: IconPlus,
      label: "Novo Empréstimo",
      onClick: handleNewBorrow,
      tooltip: "Criar novo empréstimo",
      show: canManageWarehouse,
    },
    {
      icon: IconSearch,
      label: "Buscar",
      onClick: handleSearchBorrows,
      tooltip: "Buscar empréstimos",
      show: true,
    },
    {
      icon: IconQrcode,
      label: "Scanner",
      onClick: handleScanReturn,
      tooltip: "Devolver por QR Code",
      show: canManageWarehouse,
    },
    {
      icon: IconHistory,
      label: "Histórico",
      onClick: handleViewHistory,
      tooltip: "Ver histórico de devoluções",
      show: true,
    },
    {
      icon: IconPackageExport,
      label: `Devolver (${activeBorrows.length})`,
      onClick: () => setShowBatchReturnDialog(true),
      tooltip: "Devolver empréstimos selecionados",
      show: canBatchReturn,
      variant: "destructive" as const,
      disabled: activeBorrows.length === 0,
    },
  ];

  const visibleActions = actionButtons.filter((action) => action.show);

  return (
    <>
      <TooltipProvider>
        <div className={cn("flex flex-wrap gap-2", className)}>
          {visibleActions.map((action, index) => (
            <Tooltip key={index}>
              <TooltipTrigger asChild>
                <Button
                  onClick={action.onClick}
                  size={size}
                  variant={action.variant || variant}
                  disabled={action.disabled}
                  className={cn(action.variant === "destructive" && "hover:bg-destructive/90")}
                >
                  <action.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{action.label}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{action.tooltip}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>

      {/* Batch Return Confirmation Dialog */}
      <Dialog open={showBatchReturnDialog} onOpenChange={setShowBatchReturnDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Devolução em Lote</DialogTitle>
            <DialogDescription className="space-y-3">
              <p>Você está prestes a devolver {activeBorrows.length} empréstimo(s):</p>

              <div className="max-h-[300px] overflow-y-auto space-y-2">
                {activeBorrows.map((borrow) => (
                  <div key={borrow.id} className="bg-muted/50 rounded-lg p-3 space-y-1">
                    <p className="text-sm font-medium">{borrow.item?.name}</p>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Qtd: {borrow.quantity}</span>
                      <span>{borrow.user?.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Emprestado em: {formatDateTime(borrow.createdAt)}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <IconAlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                <p className="text-sm text-amber-600 dark:text-amber-500">Esta ação irá marcar todos os empréstimos como devolvidos e atualizar o estoque.</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBatchReturnDialog(false)} disabled={isProcessing}>
              Cancelar
            </Button>
            <Button onClick={handleBatchReturn} disabled={isProcessing} className="bg-primary hover:bg-primary/90">
              {isProcessing ? (
                <>
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <IconPackageExport className="mr-2 h-4 w-4" />
                  Confirmar Devoluções
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Quick action bar for single borrow operations
interface BorrowQuickActionsProps {
  borrow: Borrow;
  className?: string;
  showLabels?: boolean;
}

export function BorrowQuickActions({ borrow, className, showLabels = true }: BorrowQuickActionsProps) {
  const navigate = useNavigate();
  const { canManageWarehouse } = usePrivileges();
  const { updateMutation } = useBorrowMutations();
  const [showReturnDialog, setShowReturnDialog] = useState(false);

  const isActive = borrow.status === BORROW_STATUS.ACTIVE;

  const handleQuickReturn = async () => {
    try {
      await updateMutation.mutateAsync({
        id: borrow.id,
        data: {
          status: BORROW_STATUS.RETURNED,
          returnedAt: new Date(),
        },
      });
      setShowReturnDialog(false);
    } catch (error) {
      console.error("Error processing return:", error);
    }
  };

  const handleExtendPeriod = () => {
    // This would open a dialog to extend the borrow period
    // Since there's no scheduledReturnDate in the current schema, this is a placeholder
    toast.info("A extensão de prazo será implementada em breve.");
  };

  const handleViewDetails = () => {
    navigate(routes.inventory.loans.details(borrow.id));
  };

  return (
    <>
      <div className={cn("flex items-center gap-2", className)}>
        <TooltipProvider>
          {/* Quick Return */}
          {isActive && canManageWarehouse && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" onClick={() => setShowReturnDialog(true)} disabled={updateMutation.isPending}>
                  <IconPackageExport className="h-4 w-4" />
                  {showLabels && <span className="ml-1">Devolver</span>}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Devolução rápida</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Extend Period (placeholder for future feature) */}
          {isActive && canManageWarehouse && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" onClick={handleExtendPeriod}>
                  <IconCalendarTime className="h-4 w-4" />
                  {showLabels && <span className="ml-1">Prorrogar</span>}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Estender prazo de devolução</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* View Details */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="ghost" onClick={handleViewDetails}>
                <IconSearch className="h-4 w-4" />
                {showLabels && <span className="ml-1">Detalhes</span>}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Ver detalhes completos</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Quick Return Dialog */}
      <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Devolução Rápida</DialogTitle>
            <DialogDescription>Confirme a devolução do empréstimo:</DialogDescription>
          </DialogHeader>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="font-medium">{borrow.item?.name}</p>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Quantidade: {borrow.quantity}</p>
              <p>Emprestado para: {borrow.user?.name}</p>
              <p>Data do empréstimo: {formatDateTime(borrow.createdAt)}</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReturnDialog(false)} disabled={updateMutation.isPending}>
              Cancelar
            </Button>
            <Button onClick={handleQuickReturn} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <>
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <IconPackageExport className="mr-2 h-4 w-4" />
                  Confirmar Devolução
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
