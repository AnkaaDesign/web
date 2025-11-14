import { useNavigate, useParams } from "react-router-dom";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { BrandForm } from "@/components/inventory/item/brand/form/brand-form";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading";
import { PageHeader } from "@/components/ui/page-header";
import { IconCheck, IconLoader2, IconTag } from "@tabler/icons-react";
import { useItemBrandDetail, useItemBrandMutations } from "../../../../../hooks";
import { type ItemBrandUpdateFormData } from "../../../../../schemas";
import { routes } from "../../../../../constants";

const EditBrandPage = () => {
  usePageTracker({
    title: "Editar Marca",
    icon: "tag",
  });
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { updateAsync, updateMutation } = useItemBrandMutations();

  const {
    data: response,
    isLoading,
    error,
  } = useItemBrandDetail(id!, {
    include: {
      items: true, // We need items to show current associations
    },
  });

  const brand = response?.data;

  // Extract items from brand data (already fetched with include)
  const brandItems = brand?.items || [];
  const currentItemIds = brandItems.map((item) => item.id);

  const handleFormSubmit = async (data: ItemBrandUpdateFormData) => {
    if (!id) return;

    try {
      await updateAsync({
        id,
        data,
      });

      navigate(routes.inventory.products.brands.root, { replace: true });
    } catch (error) {
      // Error handled by mutation hook
      console.error("Error updating brand:", error);
    }
  };

  const handleCancel = () => {
    navigate(routes.inventory.products.brands.root, { replace: true });
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-center min-h-[400px]">
            <LoadingSpinner />
          </div>
        </div>
      </div>
    );
  }

  if (error || !brand) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-2">Marca não encontrada</h2>
              <p className="text-muted-foreground mb-4">A marca que você está procurando não existe ou foi removida.</p>
              <Button onClick={() => navigate(routes.inventory.products.brands.root)}>Voltar para lista</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
      onClick: () => document.getElementById("brand-form-submit")?.click(),
      variant: "default" as const,
      disabled: updateMutation.isPending,
      loading: updateMutation.isPending,
    },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <div className="px-4 pt-4">
          <div className="max-w-5xl mx-auto">
            <PageHeader
              variant="form"
              title={`Editar ${brand.name}`}
              icon={IconTag}
              breadcrumbs={[
                { label: "Início", href: routes.home },
                { label: "Estoque", href: routes.inventory.root },
                { label: "Produtos", href: routes.inventory.products.root },
                { label: "Marcas", href: routes.inventory.products.brands.root },
                { label: brand.name, href: routes.inventory.products.brands.details(id!) },
                { label: "Editar" },
              ]}
              actions={actions}
            />
          </div>
        </div>
      </div>

      {/* Scrollable Form Container */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-5xl mx-auto h-full">
          <BrandForm
            mode="update"
            defaultValues={{
              name: brand.name,
              itemIds: currentItemIds,
            }}
            initialItems={brandItems}
            onSubmit={handleFormSubmit}
            isSubmitting={updateMutation.isPending}
          />
        </div>
      </div>
    </div>
  );
};

export default EditBrandPage;
