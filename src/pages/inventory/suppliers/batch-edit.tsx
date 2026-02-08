import { useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useSuppliers } from "../../../hooks";
import type { Supplier } from "../../../types";
import { routes, FAVORITE_PAGES } from "../../../constants";
import { SupplierBatchEditTable } from "@/components/inventory/supplier/batch-edit/supplier-batch-edit-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "sonner";
import { IconTruck, IconAlertTriangle, IconLoader, IconDeviceFloppy, IconX, IconArrowLeft } from "@tabler/icons-react";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export default function SupplierBatchEditPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  usePageTracker({
    title: "Editar Fornecedores em Lote",
    icon: "truck",
  });

  // Get supplier IDs from URL params
  const supplierIds = useMemo(() => {
    const ids = searchParams.get("ids");
    if (!ids) return [];
    return ids.split(",").filter(Boolean);
  }, [searchParams]);

  // Fetch suppliers to edit
  const {
    data: suppliersResponse,
    isLoading,
    error,
  } = useSuppliers(
    {
      where: {
        id: { in: supplierIds },
      },
      include: {
        logo: true,
      },
    },
    {
      enabled: supplierIds.length > 0,
    },
  );

  const suppliers = suppliersResponse?.data || [];

  // Validate that we have suppliers to edit
  const hasValidSuppliers = suppliers.length > 0;
  const allSuppliersFound = suppliers.length === supplierIds.length;

  const handleCancel = () => {
    navigate(routes.inventory.suppliers.root);
  };

  if (supplierIds.length === 0) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconAlertTriangle className="h-5 w-5 text-destructive" />
              Nenhum Fornecedor Selecionado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">Nenhum fornecedor foi selecionado para edição em lote.</p>
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
              <CardTitle>Carregando Fornecedores...</CardTitle>
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

  if (error || !hasValidSuppliers) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconAlertTriangle className="h-5 w-5 text-destructive" />
              Erro ao Carregar Fornecedores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">{error ? "Ocorreu um erro ao carregar os fornecedores selecionados." : "Os fornecedores selecionados não foram encontrados."}</p>
              {!allSuppliersFound && suppliers.length > 0 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Apenas {suppliers.length} de {supplierIds.length} fornecedores foram encontrados. Os fornecedores não encontrados podem ter sido excluídos.
                  </p>
                </div>
              )}
              <div className="flex gap-2 justify-center">
                <Button onClick={handleCancel} variant="outline">
                  <IconArrowLeft className="mr-2 h-4 w-4" />
                  Voltar para Lista
                </Button>
                {suppliers.length > 0 && (
                  <Button onClick={() => navigate(routes.inventory.suppliers.root)}>
                    <IconTruck className="mr-2 h-4 w-4" />
                    Ir para Lista de Fornecedores
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
        const submitButton = document.getElementById("supplier-batch-form-submit");
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
        title="Editar Fornecedores em Lote"
        icon={IconTruck}
        favoritePage={FAVORITE_PAGES.ESTOQUE_FORNECEDORES_LISTAR}
        breadcrumbs={[
          { label: "Início", href: "/" },
          { label: "Estoque", href: routes.inventory.root },
          { label: "Fornecedores", href: routes.inventory.suppliers.root },
          { label: "Editar em Lote" },
        ]}
        actions={actions}
        className="flex-shrink-0"
      />
      <div className="flex-1 overflow-hidden pt-4 pb-6">
        <SupplierBatchEditTable
          suppliers={suppliers}
          onCancel={handleCancel}
          onSubmit={() => {
            // This will be triggered from the page header save button
            const submitButton = document.getElementById("supplier-batch-form-submit");
            if (submitButton) {
              submitButton.click();
            }
          }}
        />
      </div>
    </div>
  );
}
