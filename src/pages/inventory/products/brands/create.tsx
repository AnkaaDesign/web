import { useNavigate } from "react-router-dom";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { BrandForm } from "@/components/inventory/item/brand/form/brand-form";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { IconTag, IconCheck, IconLoader2 } from "@tabler/icons-react";
import { useItemBrandMutations } from "../../../../hooks";
import { type ItemBrandCreateFormData } from "../../../../schemas";
import { routes, FAVORITE_PAGES } from "../../../../constants";

const CreateBrandPage = () => {
  usePageTracker({
    title: "Cadastrar Marca",
    icon: "tag",
  });
  const navigate = useNavigate();
  const { createAsync, createMutation } = useItemBrandMutations();

  const handleSubmit = async (data: ItemBrandCreateFormData) => {
    try {
      const result = await createAsync(data);

      if (result.success) {
        // Clear URL parameters on successful submission
        navigate(routes.inventory.products.brands.root, { replace: true });
      }
    } catch (error) {
      // Error handled by mutation hook
      console.error("Error creating brand:", error);
    }
  };

  const handleCancel = () => {
    // Clear URL parameters on cancellation
    navigate(routes.inventory.products.brands.root, { replace: true });
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
      onClick: () => document.getElementById("brand-form-submit")?.click(),
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
              title="Cadastrar Marca"
              icon={IconTag}
              favoritePage={FAVORITE_PAGES.ESTOQUE_PRODUTOS_MARCAS_CADASTRAR}
              breadcrumbs={[
                { label: "Início", href: routes.home },
                { label: "Estoque", href: routes.inventory.root },
                { label: "Produtos", href: routes.inventory.products.root },
                { label: "Marcas", href: routes.inventory.products.brands.root },
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
          <BrandForm mode="create" onSubmit={handleSubmit} isSubmitting={createMutation.isPending} />
        </div>
      </div>
    </div>
  );
};

export default CreateBrandPage;
