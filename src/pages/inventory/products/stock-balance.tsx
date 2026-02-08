import { useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useItems } from "../../../hooks";
import { routes, FAVORITE_PAGES } from "../../../constants";
import { ItemStockBalanceTable } from "@/components/inventory/item/stock-balance/item-stock-balance-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { IconClipboardCheck, IconAlertTriangle, IconLoader, IconDeviceFloppy, IconArrowLeft } from "@tabler/icons-react";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export default function ItemStockBalancePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  usePageTracker({
    title: "Balanço de Estoque",
    icon: "clipboard-check",
  });

  // Get item IDs from URL params
  const itemIds = useMemo(() => {
    const ids = searchParams.get("ids");
    if (!ids) return [];
    return ids.split(",").filter(Boolean);
  }, [searchParams]);

  // Fetch items for stock balance
  const {
    data: itemsResponse,
    isLoading,
    error,
  } = useItems(
    {
      where: {
        id: { in: itemIds },
      },
      include: {
        brand: true,
        category: true,
      },
    },
    {
      enabled: itemIds.length > 0,
    },
  );

  const items = itemsResponse?.data || [];

  // Validate that we have items
  const hasValidItems = items.length > 0;
  const allItemsFound = items.length === itemIds.length;

  const handleCancel = () => {
    navigate(routes.inventory.products.list);
  };

  if (itemIds.length === 0) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconAlertTriangle className="h-5 w-5 text-destructive" />
              Nenhum Produto Selecionado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">Nenhum produto foi selecionado para balanço de estoque.</p>
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
              <CardTitle>Carregando Produtos...</CardTitle>
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

  if (error || !hasValidItems) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconAlertTriangle className="h-5 w-5 text-destructive" />
              Erro ao Carregar Produtos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">
                {error ? "Ocorreu um erro ao carregar os produtos selecionados." : "Os produtos selecionados não foram encontrados."}
              </p>
              {!allItemsFound && items.length > 0 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Apenas {items.length} de {itemIds.length} produtos foram encontrados. Os produtos não encontrados podem ter sido excluídos.
                  </p>
                </div>
              )}
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
      label: "Confirmar Balanço",
      icon: IconDeviceFloppy,
      onClick: () => {
        const submitButton = document.getElementById("stock-balance-form-submit");
        if (submitButton) {
          submitButton.click();
        }
      },
      variant: "default" as const,
      disabled: false,
    },
  ];

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <PageHeader
          title={`Balanço de Estoque - ${items.length} ${items.length === 1 ? "Item" : "Itens"}`}
          icon={IconClipboardCheck}
          favoritePage={FAVORITE_PAGES.ESTOQUE_PRODUTOS_LISTAR}
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Estoque", href: routes.inventory.root },
            { label: "Produtos", href: routes.inventory.products.list },
            { label: "Balanço de Estoque" },
          ]}
          actions={actions}
        />
      </div>

      {/* Scrollable Content Container */}
      <div className="flex-1 overflow-hidden">
        <ItemStockBalanceTable
          items={items}
          onCancel={handleCancel}
          onSubmit={() => {
            // This will be triggered from the page header save button
            const submitButton = document.getElementById("stock-balance-form-submit");
            if (submitButton) {
              submitButton.click();
            }
          }}
        />
      </div>
    </div>
  );
}
