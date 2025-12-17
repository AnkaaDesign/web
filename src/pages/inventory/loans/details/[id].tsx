import { useParams, useNavigate } from "react-router-dom";
import { useBorrow } from "../../../../hooks";
import { routes, BORROW_STATUS } from "../../../../constants";
import { Button } from "@/components/ui/button";
import { IconAlertTriangle, IconPackage, IconTrash, IconAlertTriangleFilled, IconEdit, IconRefresh } from "@tabler/icons-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { BorrowSpecificationsCard } from "@/components/inventory/borrow/detail/borrow-specifications-card";
import { BorrowItemCard } from "@/components/inventory/borrow/detail/borrow-item-card";
import { BorrowHistoryCard } from "@/components/inventory/borrow/detail/borrow-history-card";
import { usePrivileges } from "../../../../hooks";
import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { canEditBorrows } from "@/utils/permissions/entity-permissions";
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
import { useBorrowMutations } from "../../../../hooks";

export const LoanDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showMarkLostDialog, setShowMarkLostDialog] = useState(false);
  const { user } = useAuth();
  const canManageWarehouse = canEditBorrows(user);
  const { deleteMutation, markAsLostMutation } = useBorrowMutations();

  const {
    data: response,
    isLoading,
    error,
    refetch,
  } = useBorrow(id!, {
    include: {
      item: {
        include: {
          brand: true,
          category: true,
          supplier: true,
          prices: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
      user: {
        include: {
          position: true,
          sector: true,
        },
      },
    },
    enabled: !!id,
  });

  const borrow = response?.data;

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        {/* Header Skeleton */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <div className="h-4 w-16 bg-muted rounded"></div>
            <div className="h-4 w-4 bg-muted rounded"></div>
            <div className="h-4 w-20 bg-muted rounded"></div>
            <div className="h-4 w-4 bg-muted rounded"></div>
            <div className="h-4 w-24 bg-muted rounded"></div>
          </div>
          <div className="flex items-center justify-between">
            <div className="h-8 bg-muted rounded w-48"></div>
            <div className="flex gap-2">
              <div className="h-9 w-20 bg-muted rounded"></div>
              <div className="h-9 w-20 bg-muted rounded"></div>
              <div className="h-9 w-16 bg-muted rounded"></div>
            </div>
          </div>
        </div>

        {/* Enhanced Header Card Skeleton */}
        <div className="h-48 bg-muted rounded-xl"></div>

        {/* 2x2 Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-96 bg-muted rounded-xl"></div>
          <div className="h-96 bg-muted rounded-xl"></div>
          <div className="h-96 bg-muted rounded-xl"></div>
          <div className="h-96 bg-muted rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error || !borrow) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[60vh]">
        <div className="text-center px-4 max-w-md mx-auto">
          <div className="animate-in fade-in-50 duration-500">
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <IconAlertTriangle className="h-10 w-10 text-red-500" />
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold mb-3 text-foreground">Empréstimo não encontrado</h2>
            <p className="text-sm sm:text-base text-muted-foreground mb-6 leading-relaxed">O empréstimo que você está procurando não existe ou foi removido do sistema.</p>
            <div className="space-y-3">
              <Button onClick={() => navigate(routes.inventory.loans.root)} className="w-full sm:w-auto">
                Ir para Lista de Empréstimos
              </Button>
              <Button variant="outline" onClick={() => navigate(routes.inventory.root)} className="w-full sm:w-auto">
                Ir para Estoque
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleEdit = () => {
    // Navigate to batch edit with single item ID since single edit page was removed
    navigate(`${routes.inventory.loans.batchEdit}?ids=${borrow.id}`);
  };

  const handleRefresh = () => {
    refetch();
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(borrow.id);
      navigate(routes.inventory.loans.root);
    } catch (error) {
      console.error("Error deleting borrow:", error);
    }
  };

  const handleMarkAsLost = async () => {
    try {
      await markAsLostMutation.mutateAsync({
        id: borrow.id,
        include: {
          item: {
            include: {
              brand: true,
              category: true,
              supplier: true,
            },
          },
          user: {
            include: {
              position: true,
            },
          },
        },
      });
      setShowMarkLostDialog(false);
      refetch();
    } catch (error) {
      console.error("Error marking borrow as lost:", error);
    }
  };

  // Create entity object for DetailPageHeader (unused)
  // const entityForHeader = {
  //   id: borrow.id,
  //   name: `Empréstimo #${borrow.id.slice(-8)}`,
  // };

  // Custom actions for the header
  const customActions = [];

  if (canManageWarehouse) {
    // Only show "Mark as Lost" button if item is not already lost or returned
    if (borrow.status === BORROW_STATUS.ACTIVE) {
      customActions.push({
        key: "mark-lost",
        label: "Marcar como Perdido",
        icon: IconAlertTriangleFilled,
        onClick: () => setShowMarkLostDialog(true),
      });
    }

    customActions.push({
      key: "delete",
      label: "Excluir",
      icon: IconTrash,
      onClick: () => setShowDeleteDialog(true),
    });
  }

  return (
    <div className="space-y-6">
      {/* Hero Section - Enhanced Header with Actions */}
      <PageHeader
        variant="detail"
        title={`Empréstimo #${borrow.id.slice(-8)}`}
        icon={IconPackage}
        className="shadow-lg"
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Estoque", href: routes.inventory.root },
          { label: "Empréstimos", href: routes.inventory.loans.root },
          { label: `#${borrow.id.slice(-8)}` },
        ]}
        actions={[
          {
            key: "refresh",
            label: "Atualizar",
            icon: IconRefresh,
            onClick: handleRefresh,
          },
          ...(canManageWarehouse
            ? [
                {
                  key: "edit",
                  label: "Editar",
                  icon: IconEdit,
                  onClick: handleEdit,
                  variant: "default" as const,
                },
              ]
            : []),
          ...customActions,
        ]}
      />

      {/* Core Information Grid - Specifications and Item */}
      {/* Mobile: Single column stacked */}
      <div className="block lg:hidden space-y-4 animate-in fade-in-50 duration-700">
        <BorrowSpecificationsCard borrow={borrow} className="h-full" />
        <BorrowItemCard borrow={borrow} className="h-full" />
      </div>

      {/* Desktop/Tablet: 2 columns grid */}
      <div className="hidden lg:grid grid-cols-2 gap-6 animate-in fade-in-50 duration-700">
        <BorrowSpecificationsCard borrow={borrow} className="h-full" />
        <BorrowItemCard borrow={borrow} className="h-full" />
      </div>

      {/* History Section - Full width */}
      <BorrowHistoryCard borrow={borrow} className="h-full animate-in fade-in-50 duration-900" />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir este empréstimo? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mark as Lost Confirmation Dialog */}
      <AlertDialog open={showMarkLostDialog} onOpenChange={setShowMarkLostDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar como Perdido</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja marcar este empréstimo como perdido? O item será considerado como perdido no estoque e será criado um registro de atividade. Esta ação não pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkAsLost} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Marcar como Perdido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
