import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { BorrowReturnForm } from "@/components/inventory/borrow/form/borrow-return-form";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useBorrow } from "../../../../hooks";
import { routes, SECTOR_PRIVILEGES } from "../../../../constants";
import { useAuth } from "@/contexts/auth-context";
import { hasPrivilege } from "../../../../utils";
import { IconLoader2 } from "@tabler/icons-react";

export const LoanEditPage = () => {
  usePageTracker({
    title: "Devolver Empréstimo",
    icon: "handshake",
  });

  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  // Check permissions
  const canEdit = user && hasPrivilege(user as any, SECTOR_PRIVILEGES.ADMIN);

  const {
    data: response,
    isLoading,
    error,
  } = useBorrow(id!, {
    include: {
      item: true,
      user: true,
    },
  });

  const borrow = response?.data;

  const handleCancel = () => {
    navigate(routes.inventory.loans.root);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="form"
          title="Devolver Empréstimo"
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Estoque", href: routes.inventory.root },
            { label: "Empréstimos", href: routes.inventory.loans.root },
            { label: "Devolver" },
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="text-center py-8">
            <IconLoader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Carregando empréstimo...</p>
          </div>
        </div>
      </div>
    );
  }

  // Not found error
  if (error || !borrow) {
    return (
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="form"
          title="Devolver Empréstimo"
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Estoque", href: routes.inventory.root },
            { label: "Empréstimos", href: routes.inventory.loans.root },
            { label: "Devolver" },
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="text-center py-8">
            <h2 className="text-2xl font-semibold mb-2">Empréstimo não encontrado</h2>
            <p className="text-muted-foreground mb-4">O empréstimo que você está procurando não existe ou foi removido.</p>
            <Button onClick={() => navigate(routes.inventory.loans.root)}>Voltar para lista</Button>
          </div>
        </div>
      </div>
    );
  }

  // Permission check
  if (!canEdit) {
    return (
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="form"
          title="Devolver Empréstimo"
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Estoque", href: routes.inventory.root },
            { label: "Empréstimos", href: routes.inventory.loans.root },
            { label: "Devolver" },
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="text-center py-8">
            <h2 className="text-2xl font-semibold mb-2">Acesso Negado</h2>
            <p className="text-muted-foreground mb-4">Você não tem permissão para gerenciar devoluções de empréstimos.</p>
            <Button onClick={() => navigate(routes.inventory.loans.root)}>Voltar para lista</Button>
          </div>
        </div>
      </div>
    );
  }

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: handleCancel,
      variant: "outline" as const,
    },
  ];

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <PageHeader
        variant="form"
        title="Devolver Empréstimo"
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Estoque", href: routes.inventory.root },
          { label: "Empréstimos", href: routes.inventory.loans.root },
          { label: "Devolver" },
        ]}
        actions={actions}
        className="flex-shrink-0"
      />
      <div className="flex-1 overflow-y-auto pb-6">
        <BorrowReturnForm borrow={borrow as any} onCancel={handleCancel} />
      </div>
    </div>
  );
};
