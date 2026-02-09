import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useBorrows } from "../../../hooks";
import { routes, FAVORITE_PAGES } from "../../../constants";
import { BorrowBatchEditTable } from "@/components/inventory/borrow/batch-edit/borrow-batch-edit-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { IconHandMove, IconAlertTriangle, IconLoader, IconDeviceFloppy, IconArrowLeft } from "@tabler/icons-react";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export default function LoanBatchEditPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  usePageTracker({
    title: "Editar Empréstimos em Lote",
    icon: "hand-move",
  });

  // Get borrow IDs from URL params
  const borrowIds = useMemo(() => {
    const ids = searchParams.get("ids");
    if (!ids) return [];
    return ids.split(",").filter(Boolean);
  }, [searchParams]);

  // Fetch borrows to edit
  const {
    data: response,
    isLoading,
    error,
  } = useBorrows({
    where: {
      id: { in: borrowIds },
    },
    include: {
      item: {
        include: {
          brand: true,
          category: true,
        },
      },
      user: {
        include: {
          sector: true,
        },
      },
    },
    enabled: borrowIds.length > 0,
  });

  const borrows = response?.data || [];

  // Validate that we have borrows to edit
  const hasValidBorrows = borrows.length > 0;
  const allBorrowsFound = borrows.length === borrowIds.length;

  const handleCancel = () => {
    navigate(routes.inventory.loans.root);
  };

  if (borrowIds.length === 0) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconAlertTriangle className="h-5 w-5 text-destructive" />
              Nenhum Empréstimo Selecionado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">Nenhum empréstimo foi selecionado para edição em lote.</p>
              <Button onClick={handleCancel} variant="outline">
                <IconArrowLeft className="mr-2 h-4 w-4" />
                Voltar para Lista
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Carregando Empréstimos...</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center p-8">
              <IconLoader className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !hasValidBorrows) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconAlertTriangle className="h-5 w-5 text-destructive" />
              Erro ao Carregar Empréstimos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">{error ? "Ocorreu um erro ao carregar os empréstimos selecionados." : "Os empréstimos selecionados não foram encontrados."}</p>
              {!allBorrowsFound && borrows.length > 0 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Apenas {borrows.length} de {borrowIds.length} empréstimos foram encontrados. Os empréstimos não encontrados podem ter sido excluídos.
                  </p>
                </div>
              )}
              <div className="flex gap-2 justify-center">
                <Button onClick={handleCancel} variant="outline">
                  <IconArrowLeft className="mr-2 h-4 w-4" />
                  Voltar para Lista
                </Button>
                {borrows.length > 0 && (
                  <Button onClick={() => navigate(routes.inventory.loans.root)}>
                    <IconHandMove className="mr-2 h-4 w-4" />
                    Ir para Lista de Empréstimos
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: handleCancel,
      variant: "outline" as const,
      disabled: false,
    },
    {
      key: "save",
      label: "Salvar Alterações",
      icon: IconDeviceFloppy,
      onClick: () => {
        const submitButton = document.getElementById("borrow-batch-form-submit");
        if (submitButton) {
          submitButton.click();
        }
      },
      variant: "default" as const,
      disabled: false,
    },
  ];

  return (
    <div className="h-full flex flex-col bg-background px-4 pt-4">
      <PageHeader
        title="Editar Empréstimos em Lote"
        icon={IconHandMove}
        favoritePage={FAVORITE_PAGES.ESTOQUE_EMPRESTIMOS_LISTAR}
        breadcrumbs={[
          { label: "Início", href: "/" },
          { label: "Estoque", href: routes.inventory.root },
          { label: "Empréstimos", href: routes.inventory.loans.root },
          { label: "Editar em Lote" },
        ]}
        actions={actions}
        className="flex-shrink-0"
      />
      <div className="flex-1 overflow-hidden pt-4 pb-6">
        <BorrowBatchEditTable
          borrows={borrows}
          onCancel={handleCancel}
          onSubmit={() => {
            // This will be triggered from the page header save button
            const submitButton = document.getElementById("borrow-batch-form-submit");
            if (submitButton) {
              submitButton.click();
            }
          }}
        />
      </div>
    </div>
  );
}
