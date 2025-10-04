import { useNavigate, useParams } from "react-router-dom";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { BorrowReturnForm } from "@/components/inventory/borrow/form/borrow-return-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { useBorrow } from "../../../../hooks";
import { routes, SECTOR_PRIVILEGES } from "../../../../constants";
import { useAuth } from "@/contexts/auth-context";
import { hasPrivilege } from "../../../../utils";

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

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0">
          <div className="max-w-5xl mx-auto px-4 pt-4">
            <Skeleton className="h-10 w-64 mb-6" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 pb-6">
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Not found error
  if (error || !borrow) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 pt-4 pb-6">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-2">Empréstimo não encontrado</h2>
              <p className="text-muted-foreground mb-4">O empréstimo que você está procurando não existe ou foi removido.</p>
              <Button onClick={() => navigate(routes.inventory.loans.root)}>Voltar para lista</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Permission check
  if (!canEdit) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 pt-4 pb-6">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-2">Acesso Negado</h2>
              <p className="text-muted-foreground mb-4">Você não tem permissão para gerenciar devoluções de empréstimos.</p>
              <Button onClick={() => navigate(routes.inventory.loans.root)}>Voltar para lista</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <div className="max-w-5xl mx-auto px-4 pt-4">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">Devolver Empréstimo</h1>
            <Breadcrumb
              items={[
                { label: "Início", href: routes.home },
                { label: "Estoque", href: routes.inventory.root },
                { label: "Empréstimos", href: routes.inventory.loans.root },
                { label: "Devolver" },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Scrollable Form Container */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 pb-6">
          <BorrowReturnForm borrow={borrow as any} onCancel={handleCancel} />
        </div>
      </div>
    </div>
  );
};
