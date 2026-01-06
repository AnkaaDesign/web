import { useNavigate } from "react-router-dom";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { BrandForm } from "@/components/inventory/item/brand/form/brand-form";
import { PageHeader } from "@/components/ui/page-header";
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
      await createAsync(data);
      // If we reach here, the creation was successful
      navigate(routes.inventory.products.brands.root, { replace: true });
    } catch (error) {
      // Error handled by mutation hook
      if (process.env.NODE_ENV !== "production") {
        console.error("Error creating brand:", error);
      }
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
    <div className="h-full flex flex-col px-4 pt-4">
      <PageHeader
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
      <div className="flex-1 overflow-y-auto pb-6">
        <div className="mt-4 space-y-4">
          <BrandForm mode="create" onSubmit={handleSubmit} isSubmitting={createMutation.isPending} />
        </div>
      </div>
    </div>
  );
};

export default CreateBrandPage;
