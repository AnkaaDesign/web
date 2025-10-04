import { useParams, useNavigate } from "react-router-dom";
import { useItemBrandDetail } from "../../../../../hooks";
import { routes, CHANGE_LOG_ENTITY_TYPE } from "../../../../../constants";
import { Button } from "@/components/ui/button";
import { IconAlertTriangle, IconTag, IconRefresh, IconEdit } from "@tabler/icons-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { SpecificationsCard } from "@/components/inventory/item/brand/detail/specifications-card";
import { RelatedItemsCard } from "@/components/inventory/item/brand/detail/related-items-card";

const BrandDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    data: response,
    isLoading,
    error,
    refetch,
  } = useItemBrandDetail(id!, {
    include: {
      items: {
        include: {
          category: true,
        },
        orderBy: { name: "asc" },
      },
      changelogs: {
        include: {
          user: true,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
    enabled: !!id,
  });

  const brand = response?.data;
  const items = brand?.items || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-neutral-900 dark:to-neutral-800">
        <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
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
                </div>
              </div>
            </div>

            {/* Enhanced Header Card Skeleton */}
            <div className="h-48 bg-muted rounded-xl"></div>

            {/* Specifications and Changelog Skeleton */}
            <div className="block lg:hidden space-y-4">
              <div className="h-96 bg-muted rounded-xl"></div>
              <div className="h-96 bg-muted rounded-xl"></div>
            </div>
            <div className="hidden lg:block">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="h-96 bg-muted rounded-xl"></div>
                <div className="h-96 bg-muted rounded-xl"></div>
              </div>
            </div>

            {/* Related Items Skeleton */}
            <div className="space-y-4">
              <div className="h-8 bg-muted rounded w-48"></div>
              <div className="flex gap-4 overflow-hidden">
                <div className="h-32 w-64 bg-muted rounded-xl flex-shrink-0"></div>
                <div className="h-32 w-64 bg-muted rounded-xl flex-shrink-0"></div>
                <div className="h-32 w-64 bg-muted rounded-xl flex-shrink-0"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !brand) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-neutral-900 dark:to-neutral-800">
        <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
          <div className="flex flex-1 items-center justify-center min-h-[60vh]">
            <div className="text-center px-4 max-w-md mx-auto">
              <div className="animate-in fade-in-50 duration-500">
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                  <IconAlertTriangle className="h-10 w-10 text-red-500" />
                </div>
                <h2 className="text-xl sm:text-2xl font-semibold mb-3 text-foreground">Marca não encontrada</h2>
                <p className="text-sm sm:text-base text-muted-foreground mb-6 leading-relaxed">A marca que você está procurando não existe ou foi removida do sistema.</p>
                <div className="space-y-3">
                  <Button onClick={() => navigate(routes.inventory.products.brands.root)} className="w-full sm:w-auto">
                    Ir para Lista de Marcas
                  </Button>
                  <Button variant="outline" onClick={() => navigate(routes.inventory.root)} className="w-full sm:w-auto">
                    Ir para Estoque
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleEdit = () => {
    navigate(routes.inventory.products.brands.edit(brand.id));
  };

  const handleRefresh = () => {
    refetch();
    toast.success("Dados atualizados com sucesso");
  };

  return (
    <div className="space-y-6">
      {/* Hero Section - Enhanced Header with Actions */}
      <div className="animate-in fade-in-50 duration-500">
        <PageHeader
          variant="detail"
          title={brand.name}
          icon={IconTag}
          className="shadow-lg"
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Estoque", href: routes.inventory.root },
            { label: "Produtos", href: routes.inventory.products.root },
            { label: "Marcas", href: routes.inventory.products.brands.root },
            { label: brand.name },
          ]}
          actions={[
            {
              key: "refresh",
              label: "Atualizar",
              icon: IconRefresh,
              onClick: handleRefresh,
            },
            {
              key: "edit",
              label: "Editar",
              icon: IconEdit,
              onClick: handleEdit,
            },
          ]}
        />
      </div>

      {/* Core Information Section - Specifications and Changelog */}
      <div className="animate-in fade-in-50 duration-700">
        {/* Mobile: Single column stacked */}
        <div className="block lg:hidden space-y-4">
          <SpecificationsCard brand={brand} itemCount={items.length} className="h-full" />
          <ChangelogHistory
            entityType={CHANGE_LOG_ENTITY_TYPE.ITEM_BRAND}
            entityId={brand.id}
            entityName={brand.name}
            entityCreatedAt={brand.createdAt}
            className="h-full"
            maxHeight="500px"
          />
        </div>

        {/* Desktop/Tablet: 2-column grid */}
        <div className="hidden lg:block">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SpecificationsCard brand={brand} itemCount={items.length} className="h-full" />
            <ChangelogHistory entityType={CHANGE_LOG_ENTITY_TYPE.ITEM_BRAND} entityId={brand.id} entityName={brand.name} entityCreatedAt={brand.createdAt} className="h-full" />
          </div>
        </div>
      </div>

      {/* Related Items - Full Width Section */}
      <div className="animate-in fade-in-50 duration-900">
        <RelatedItemsCard items={items} brandId={brand.id} brandName={brand.name} />
      </div>
    </div>
  );
};

export default BrandDetailsPage;
