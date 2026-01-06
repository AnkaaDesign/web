import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { routes, FAVORITE_PAGES } from "../../../../constants";
import { PaintBrandForm } from "@/components/painting/paint-brand/form";
import { usePaintBrand, usePaintBrandMutations } from "../../../../hooks";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { IconAlertCircle, IconCheck, IconLoader2, IconTag } from "@tabler/icons-react";
import type { PaintBrandUpdateFormData } from "../../../../schemas";

export function PaintBrandEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { update, updateMutation } = usePaintBrandMutations();
  const [formState, setFormState] = useState({ isValid: true, isDirty: false });

  // Fetch paint brand data with component items including full item details
  const {
    data: paintBrandResponse,
    isLoading,
    error,
  } = usePaintBrand(id || "", {
    include: {
      componentItems: {
        include: {
          brand: true,
          category: true,
          measures: true,
        },
      },
    },
    enabled: !!id,
  });

  const paintBrand = paintBrandResponse?.data;

  const handleSubmit = async (data: PaintBrandUpdateFormData) => {
    if (!id) return;

    try {
      await update({ id, data });
      navigate(routes.painting.paintBrands.root);
    } catch (error) {
      throw error; // Re-throw to keep form in submitting state
    }
  };

  const handleCancel = () => {
    navigate(routes.painting.paintBrands.root);
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col space-y-4">
        {/* Fixed Header */}
        <div className="flex-shrink-0">
          <div className="max-w-4xl mx-auto">
            <PageHeader
              title="Carregando..."
              icon={IconTag}
              favoritePage={FAVORITE_PAGES.PINTURA_MARCAS_TINTA_EDITAR}
              breadcrumbs={[
                { label: "Início", href: routes.home },
                { label: "Pintura", href: routes.painting.root },
                { label: "Marcas de Tinta", href: routes.painting.paintBrands.root },
                { label: "Carregando..." },
                { label: "Editar" },
              ]}
            />
          </div>
        </div>

        {/* Main Content Card - Dashboard style scrolling */}
        <div className="flex-1 overflow-hidden max-w-4xl mx-auto w-full">
          <div className="h-full bg-card rounded-lg shadow-sm border-muted overflow-hidden p-4">
            <div className="space-y-6">
              <div className="space-y-4">
                <Skeleton className="h-4 w-32" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
              <div className="space-y-4">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-20 w-full" />
              </div>
              <div className="space-y-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !paintBrand) {
    return (
      <div className="h-full flex flex-col space-y-4">
        {/* Fixed Header */}
        <div className="flex-shrink-0">
          <div className="max-w-4xl mx-auto">
            <PageHeader
              title="Editar Marca de Tinta"
              icon={IconTag}
              favoritePage={FAVORITE_PAGES.PINTURA_MARCAS_TINTA_EDITAR}
              breadcrumbs={[
                { label: "Início", href: routes.home },
                { label: "Pintura", href: routes.painting.root },
                { label: "Marcas de Tinta", href: routes.painting.paintBrands.root },
                { label: "Editar" },
              ]}
            />
          </div>
        </div>

        {/* Main Content Card - Dashboard style scrolling */}
        <div className="flex-1 overflow-hidden max-w-4xl mx-auto w-full">
          <div className="h-full bg-card rounded-lg shadow-sm border-muted overflow-hidden p-4">
            <Alert variant="destructive">
              <IconAlertCircle className="h-4 w-4" />
              <AlertDescription>{error ? "Erro ao carregar marca de tinta" : "Marca de tinta não encontrada"}</AlertDescription>
            </Alert>
          </div>
        </div>
      </div>
    );
  }

  // Prepare default values with component item IDs
  const defaultValues: Partial<PaintBrandUpdateFormData> = {
    name: paintBrand.name,
    componentItemIds: paintBrand.componentItems?.map((item) => item.id) || [],
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
      onClick: () => document.getElementById("paint-brand-form-submit")?.click(),
      variant: "default" as const,
      disabled: updateMutation.isPending || !formState.isValid || !formState.isDirty,
      loading: updateMutation.isPending,
    },
  ];

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <PageHeader
        variant="form"
        title={`Editar ${paintBrand.name}`}
        icon={IconTag}
        favoritePage={FAVORITE_PAGES.PINTURA_MARCAS_TINTA_EDITAR}
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Pintura", href: routes.painting.root },
          { label: "Marcas de Tinta", href: routes.painting.paintBrands.root },
          { label: paintBrand.name, href: routes.painting.paintBrands.details(id!) },
          { label: "Editar" },
        ]}
        actions={actions}
        className="flex-shrink-0"
      />
      <div className="flex-1 overflow-y-auto pb-6">
        <PaintBrandForm
          mode="update"
          paintBrandId={id!}
          defaultValues={defaultValues}
          initialComponentItems={paintBrand.componentItems || []}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={updateMutation.isPending}
          onFormStateChange={setFormState}
        />
      </div>
    </div>
  );
}

export default PaintBrandEditPage;
