import { useNavigate, useSearchParams } from "react-router-dom";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { CategoryForm } from "@/components/inventory/item/category/form/category-form";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { IconCategory, IconCheck, IconLoader2 } from "@tabler/icons-react";
import { useItemCategoryMutations } from "../../../../hooks";
import { type ItemCategoryCreateFormData } from "../../../../schemas";
import { routes, FAVORITE_PAGES } from "../../../../constants";
import { getDefaultItemCategoryFormValues } from "@/utils/url-form-state";

const CreateCategoryPage = () => {
  usePageTracker({
    title: "Cadastrar Categoria",
    icon: "category",
  });
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { createAsync, createMutation } = useItemCategoryMutations();

  // Get default values from URL parameters
  const defaultValues = getDefaultItemCategoryFormValues(searchParams);

  const handleSubmit = async (data: ItemCategoryCreateFormData) => {
    try {
      const result = await createAsync(data);

      if (result.success) {
        navigate(routes.inventory.products.categories.root);
      }
    } catch (error) {
      // Error handled by mutation hook
      console.error("Error creating category:", error);
    }
  };

  const handleCancel = () => {
    // Clear URL parameters and navigate
    setSearchParams({}, { replace: true });
    navigate(routes.inventory.products.categories.root);
  };

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: handleCancel,
      variant: "outline" as const,
      disabled: createMutation.isPending,
    },
    {
      key: "submit",
      label: "Cadastrar",
      icon: createMutation.isPending ? IconLoader2 : IconCheck,
      onClick: () => document.getElementById("category-form-submit")?.click(),
      variant: "default" as const,
      disabled: createMutation.isPending,
      loading: createMutation.isPending,
    },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <div className="px-4 pt-4">
          <div className="max-w-3xl mx-auto">
            <PageHeaderWithFavorite
              title="Cadastrar Categoria"
              icon={IconCategory}
              favoritePage={FAVORITE_PAGES.ESTOQUE_PRODUTOS_CATEGORIAS_CADASTRAR}
              breadcrumbs={[
                { label: "Início", href: routes.home },
                { label: "Estoque", href: routes.inventory.root },
                { label: "Produtos", href: routes.inventory.products.root },
                { label: "Categorias", href: routes.inventory.products.categories.root },
                { label: "Cadastrar" },
              ]}
              actions={actions}
            />
          </div>
        </div>
      </div>

      {/* Scrollable Form Container */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto h-full">
          <CategoryForm mode="create" defaultValues={defaultValues} onSubmit={handleSubmit} isSubmitting={createMutation.isPending} />
        </div>
      </div>
    </div>
  );
};

export default CreateCategoryPage;
