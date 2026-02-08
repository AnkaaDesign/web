import { useNavigate, useParams } from "react-router-dom";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { CategoryForm } from "@/components/inventory/item/category/form/category-form";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingSpinner } from "@/components/ui/loading";
import { IconCategory, IconCheck, IconLoader2 } from "@tabler/icons-react";
import { useItemCategoryDetail, useItemCategoryMutations } from "../../../../../hooks";
import { type ItemCategoryUpdateFormData } from "../../../../../schemas";
import { routes } from "../../../../../constants";

const EditCategoryPage = () => {
  usePageTracker({
    title: "Editar Categoria",
    icon: "category",
  });
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { updateAsync, updateMutation } = useItemCategoryMutations();

  const {
    data: response,
    isLoading,
    error,
  } = useItemCategoryDetail(id!, {
    include: {
      items: {
        include: {
          brand: true,
          category: true,
        },
      },
    },
  });

  const category = response?.data;

  // Extract items from category
  const currentItems = category?.items || [];
  const currentItemIds = currentItems.map((item) => item.id);

  const handleFormSubmit = async (data: ItemCategoryUpdateFormData) => {
    if (!id) return;

    try {
      await updateAsync({
        id,
        data,
      });

      navigate(routes.inventory.products.categories.root);
    } catch (error) {
      // Error handled by mutation hook
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error updating category:", error);
      }
    }
  };

  const handleCancel = () => {
    navigate(routes.inventory.products.categories.root);
  };

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: handleCancel,
      variant: "outline" as const,
      disabled: updateMutation.isPending,
    },
    {
      key: "submit",
      label: "Salvar Alterações",
      icon: updateMutation.isPending ? IconLoader2 : IconCheck,
      onClick: () => document.getElementById("category-form-submit")?.click(),
      variant: "default" as const,
      disabled: updateMutation.isPending,
      loading: updateMutation.isPending,
    },
  ];

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-4xl py-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (error || !category) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Categoria não encontrada</h2>
          <p className="text-muted-foreground mb-4">A categoria que você está procurando não existe ou foi removida.</p>
          <Button onClick={() => navigate(routes.inventory.products.categories.root)}>Voltar para lista</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <div className="container mx-auto max-w-4xl flex-shrink-0">
        <PageHeader
          variant="form"
          title={`Editar ${category.name}`}
          icon={IconCategory}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Estoque", href: routes.inventory.root },
            { label: "Produtos", href: routes.inventory.products.root },
            { label: "Categorias", href: routes.inventory.products.categories.root },
            { label: category.name, href: routes.inventory.products.categories.details(id!) },
            { label: "Editar" },
          ]}
          actions={actions}
        />
      </div>
      <div className="flex-1 overflow-y-auto pb-6">
        <CategoryForm
          mode="update"
          defaultValues={{
            name: category.name,
            itemIds: currentItemIds,
          }}
          initialItems={currentItems}
          onSubmit={handleFormSubmit}
          isSubmitting={updateMutation.isPending}
        />
      </div>
    </div>
  );
};

export default EditCategoryPage;
