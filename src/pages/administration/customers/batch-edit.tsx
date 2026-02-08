import { useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useCustomers } from "../../../hooks";
import type { Customer } from "../../../types";
import { routes, FAVORITE_PAGES } from "../../../constants";
import { CustomerBatchEditTable } from "@/components/administration/customer/batch-edit/customer-batch-edit-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "sonner";
import { IconUsers, IconAlertTriangle, IconLoader, IconDeviceFloppy, IconX, IconArrowLeft } from "@tabler/icons-react";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const CustomerBatchEditPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  usePageTracker({
    title: "Editar Clientes em Lote",
    icon: "users",
  });

  // Get customer IDs from URL params
  const customerIds = useMemo(() => {
    const ids = searchParams.get("ids");
    if (!ids) return [];
    return ids.split(",").filter(Boolean);
  }, [searchParams]);

  // Fetch customers to edit
  const {
    data: customersResponse,
    isLoading,
    error,
  } = useCustomers(
    {
      where: {
        id: { in: customerIds },
      },
      include: {
        logo: true,
        count: true,
      },
    },
    {
      enabled: customerIds.length > 0,
    },
  );

  const customers = customersResponse?.data || [];

  // Validate that we have customers to edit
  const hasValidCustomers = customers.length > 0;
  const allCustomersFound = customers.length === customerIds.length;

  const handleCancel = () => {
    navigate(routes.administration.customers.root);
  };

  if (customerIds.length === 0) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconAlertTriangle className="h-5 w-5 text-destructive" />
              Nenhum Cliente Selecionado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">Nenhum cliente foi selecionado para edição em lote.</p>
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
              <CardTitle>Carregando Clientes...</CardTitle>
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

  if (error || !hasValidCustomers) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconAlertTriangle className="h-5 w-5 text-destructive" />
              Erro ao Carregar Clientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">{error ? "Ocorreu um erro ao carregar os clientes selecionados." : "Os clientes selecionados não foram encontrados."}</p>
              {!allCustomersFound && customers.length > 0 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Apenas {customers.length} de {customerIds.length} clientes foram encontrados. Os clientes não encontrados podem ter sido excluídos.
                  </p>
                </div>
              )}
              <div className="flex gap-2 justify-center">
                <Button onClick={handleCancel} variant="outline">
                  <IconArrowLeft className="mr-2 h-4 w-4" />
                  Voltar para Lista
                </Button>
                {customers.length > 0 && (
                  <Button onClick={() => navigate(routes.administration.customers.root)}>
                    <IconUsers className="mr-2 h-4 w-4" />
                    Ir para Lista de Clientes
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
        const submitButton = document.getElementById("customer-batch-form-submit");
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
        title="Editar Clientes em Lote"
        icon={IconUsers}
        favoritePage={FAVORITE_PAGES.ADMINISTRACAO_CLIENTES_LISTAR}
        breadcrumbs={[
          { label: "Início", href: "/" },
          { label: "Administração", href: routes.administration.root },
          { label: "Clientes", href: routes.administration.customers.root },
          { label: "Editar em Lote" },
        ]}
        actions={actions}
        className="flex-shrink-0"
      />
      <div className="flex-1 overflow-hidden pt-4 pb-6">
        <CustomerBatchEditTable
          customers={customers}
          onCancel={handleCancel}
          onSubmit={() => {
            // This will be triggered from the page header save button
            const submitButton = document.getElementById("customer-batch-form-submit");
            if (submitButton) {
              submitButton.click();
            }
          }}
        />
      </div>
    </div>
  );
};
