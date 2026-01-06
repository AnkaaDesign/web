import { useNavigate, useSearchParams } from "react-router-dom";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { CategoryForm } from "@/components/inventory/item/category/form/category-form";
import { PageHeader } from "@/components/ui/page-header";
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
      await createAsync(data);
      // If we reach here, the creation was successful
      navigate(routes.inventory.products.categories.root);
    } catch (error) {
      // Error handled by mutation hook
      if (process.env.NODE_ENV !== "production") {
        console.error("Error creating category:", error);
      }
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
    <div className="h-full flex flex-col px-4 pt-4">
      <PageHeader
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
      <div className="flex-1 overflow-y-auto pb-6">
        <div className="mt-4 space-y-4">
          <CategoryForm mode="create" defaultValues={defaultValues} onSubmit={handleSubmit} isSubmitting={createMutation.isPending} />
        </div>
      </div>
    </div>
  );
};

export default CreateCategoryPage;
