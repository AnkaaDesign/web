import { useParams, useNavigate } from "react-router-dom";
import { useItemCategoryDetail } from "../../../../../hooks";
import { routes, CHANGE_LOG_ENTITY_TYPE } from "../../../../../constants";
import { Button } from "@/components/ui/button";
import { IconAlertTriangle, IconRefresh, IconEdit } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page-header";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { RelatedItemsCard } from "@/components/inventory/item/category/detail/related-items-card";
import { SpecificationsCard } from "@/components/inventory/item/category/detail/specifications-card";
import { useAuth } from "@/contexts/auth-context";
import { canEditItems } from "@/utils/permissions/entity-permissions";

const CategoryDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = canEditItems(user);

  const {
    data: response,
    isLoading,
    error,
    refetch,
  } = useItemCategoryDetail(id!, {
    include: {
      items: {
        include: {
          brand: true,
          prices: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
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

  const category = response?.data;
  const items = category?.items || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-neutral-900 dark:to-neutral-800">
        <div className="container mx-auto p-4 sm:p-4 max-w-7xl">
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

            {/* 2x2 Grid Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-96 bg-muted rounded-xl"></div>
              <div className="h-96 bg-muted rounded-xl"></div>
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

  if (error || !category) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-neutral-900 dark:to-neutral-800">
        <div className="container mx-auto p-4 sm:p-4 max-w-7xl">
          <div className="flex flex-1 items-center justify-center min-h-[60vh]">
            <div className="text-center px-4 max-w-md mx-auto">
              <div className="animate-in fade-in-50 duration-500">
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                  <IconAlertTriangle className="h-10 w-10 text-red-500" />
                </div>
                <h2 className="text-xl sm:text-2xl font-semibold mb-3 text-foreground">Categoria não encontrada</h2>
                <p className="text-sm sm:text-base text-muted-foreground mb-6 leading-relaxed">A categoria que você está procurando não existe ou foi removida do sistema.</p>
                <div className="space-y-3">
                  <Button onClick={() => navigate(routes.inventory.products.categories.root)} className="w-full sm:w-auto">
                    Ir para Lista de Categorias
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
    navigate(routes.inventory.products.categories.edit(category.id));
  };

  const handleRefresh = () => {
    refetch();
  };

  return (
    <div className="h-full flex flex-col px-4 pt-4">
      <div className="flex-shrink-0">
        <div className="animate-in fade-in-50 duration-500">
          <PageHeader
            variant="detail"
            title={category.name}
            className="shadow-sm"
            breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Estoque", href: routes.inventory.root },
            { label: "Produtos", href: routes.inventory.products.root },
            { label: "Categorias", href: routes.inventory.products.categories.root },
            { label: category.name },
          ]}
          actions={[
            {
              key: "refresh",
              label: "Atualizar",
              icon: IconRefresh,
              onClick: handleRefresh,
            },
            ...(canEdit ? [{
              key: "edit",
              label: "Editar",
              icon: IconEdit,
              onClick: handleEdit,
            }] : []),
          ]}
          />
        </div>
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="space-y-4 mt-4">
            {/* Core Information Grid - Specifications and Changelog */}
            <div className="animate-in fade-in-50 duration-700">
          {/* Mobile: Single column stacked */}
          <div className="block lg:hidden space-y-4">
            <SpecificationsCard category={category} itemCount={items.length} className="h-full" />
            <ChangelogHistory
              entityType={CHANGE_LOG_ENTITY_TYPE.ITEM_CATEGORY}
              entityId={category.id}
              entityName={category.name}
              entityCreatedAt={category.createdAt}
              className="h-full"
              maxHeight="500px"
            />
          </div>

          {/* Desktop/Tablet: 2 columns grid */}
          <div className="hidden lg:block">
            <div className="grid grid-cols-2 gap-4">
              <SpecificationsCard category={category} itemCount={items.length} className="h-full" />
              <ChangelogHistory
                entityType={CHANGE_LOG_ENTITY_TYPE.ITEM_CATEGORY}
                entityId={category.id}
                entityName={category.name}
                entityCreatedAt={category.createdAt}
                className="h-full"
              />
            </div>
            </div>

            {/* Related Items - Full Width Section */}
            <div className="animate-in fade-in-50 duration-900">
              <RelatedItemsCard category={category} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategoryDetailsPage;
