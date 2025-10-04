import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useItemBrands } from "../../../../hooks";
import { routes } from "../../../../constants";
import { BrandBatchEditTable } from "@/components/inventory/item/brand/batch-edit/brand-batch-edit-table";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { IconTag, IconAlertTriangle } from "@tabler/icons-react";
import { IconLoader } from "@tabler/icons-react";

export default function BrandBatchEditPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [brandIds, setBrandIds] = useState<string[]>([]);

  useEffect(() => {
    const ids = searchParams.get("ids");
    if (!ids) {
      navigate(routes.inventory.products.brands.list);
      return;
    }
    setBrandIds(ids.split(","));
  }, [searchParams, navigate]);

  const { data: response, isLoading } = useItemBrands({
    where: {
      id: { in: brandIds },
    },
    include: {
      items: true,
      count: {
        select: {
          items: true,
        },
      },
    },
    enabled: brandIds.length > 0,
  });

  const brands = response?.data || [];

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0">
          <div className="container mx-auto max-w-7xl p-4 sm:p-6">
            <PageHeader
              variant="batch"
              title="Edição em Lote de Marcas"
              icon={IconTag}
              breadcrumbs={[
                { label: "Início", href: routes.home },
                { label: "Estoque", href: routes.inventory.root },
                { label: "Produtos", href: routes.inventory.products.root },
                { label: "Marcas", href: routes.inventory.products.brands.root },
                { label: "Edição em Lote" },
              ]}
              selection={{
                count: brandIds.length,
                entityName: "marcas",
                onClearSelection: () => navigate(routes.inventory.products.brands.list),
              }}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-center min-h-[400px]">
            <IconLoader className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    );
  }

  if (brands.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0">
          <div className="container mx-auto max-w-7xl p-4 sm:p-6">
            <PageHeader
              variant="batch"
              title="Edição em Lote de Marcas"
              icon={IconTag}
              breadcrumbs={[
                { label: "Início", href: routes.home },
                { label: "Estoque", href: routes.inventory.root },
                { label: "Produtos", href: routes.inventory.products.root },
                { label: "Marcas", href: routes.inventory.products.brands.root },
                { label: "Edição em Lote" },
              ]}
              selection={{
                count: 0,
                entityName: "marcas",
                onClearSelection: () => navigate(routes.inventory.products.brands.list),
              }}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="container mx-auto max-w-7xl p-4 sm:p-6">
            <Card>
              <CardContent className="p-8 text-center">
                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                  <IconAlertTriangle className="h-10 w-10 text-orange-500" />
                </div>
                <p className="text-muted-foreground">Nenhuma marca selecionada para edição em lote.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex-shrink-0">
        <PageHeader
          variant="batch"
          title="Edição em Lote de Marcas"
          icon={IconTag}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Estoque", href: routes.inventory.root },
            { label: "Produtos", href: routes.inventory.products.root },
            { label: "Marcas", href: routes.inventory.products.brands.root },
            { label: "Edição em Lote" },
          ]}
          selection={{
            count: brands.length,
            entityName: "marcas",
            onClearSelection: () => navigate(routes.inventory.products.brands.list),
          }}
          backButton={{
            onClick: () => navigate(routes.inventory.products.brands.list),
            label: "Voltar para lista",
          }}
        />
      </div>
      <div className="flex-1 overflow-hidden">
        <BrandBatchEditTable brands={brands} onCancel={() => navigate(routes.inventory.products.brands.list)} />
      </div>
    </div>
  );
}
