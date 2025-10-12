import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { routes, FAVORITE_PAGES } from "../../../../constants";
import { PaintTypeForm } from "@/components/paint/paint-type/form";
import { usePaintType, usePaintTypeMutations } from "../../../../hooks";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { IconAlertCircle, IconCheck, IconLoader2, IconPaint } from "@tabler/icons-react";
import type { PaintTypeUpdateFormData } from "../../../../schemas";

export function PaintTypeEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { update, updateMutation } = usePaintTypeMutations();
  const [formState, setFormState] = useState({ isValid: true, isDirty: false });

  // Fetch paint type data with component items (including nested relations)
  const {
    data: paintTypeResponse,
    isLoading,
    error,
  } = usePaintType(id || "", {
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

  const paintType = paintTypeResponse?.data;

  const handleSubmit = async (data: PaintTypeUpdateFormData) => {
    if (!id) return;

    try {
      await update({ id, data });
      navigate(routes.painting.paintTypes.root);
    } catch (error) {
      throw error; // Re-throw to keep form in submitting state
    }
  };

  const handleCancel = () => {
    navigate(routes.painting.paintTypes.root);
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col space-y-4">
        {/* Fixed Header */}
        <div className="flex-shrink-0">
          <div className="max-w-4xl mx-auto">
            <PageHeaderWithFavorite
              title="Carregando..."
              icon={IconPaint}
              favoritePage={FAVORITE_PAGES.PINTURA_TIPOS_TINTA_EDITAR}
              breadcrumbs={[
                { label: "Início", href: routes.home },
                { label: "Pintura", href: routes.painting.root },
                { label: "Tipos de Tinta", href: routes.painting.paintTypes.root },
                { label: "Carregando..." },
                { label: "Editar" },
              ]}
            />
          </div>
        </div>

        {/* Main Content Card - Dashboard style scrolling */}
        <div className="flex-1 overflow-hidden max-w-4xl mx-auto w-full">
          <div className="h-full bg-card rounded-lg shadow-md border-muted overflow-hidden p-6">
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

  if (error || !paintType) {
    return (
      <div className="h-full flex flex-col space-y-4">
        {/* Fixed Header */}
        <div className="flex-shrink-0">
          <div className="max-w-4xl mx-auto">
            <PageHeaderWithFavorite
              title="Editar Tipo de Tinta"
              icon={IconPaint}
              favoritePage={FAVORITE_PAGES.PINTURA_TIPOS_TINTA_EDITAR}
              breadcrumbs={[
                { label: "Início", href: routes.home },
                { label: "Pintura", href: routes.painting.root },
                { label: "Tipos de Tinta", href: routes.painting.paintTypes.root },
                { label: "Editar" },
              ]}
            />
          </div>
        </div>

        {/* Main Content Card - Dashboard style scrolling */}
        <div className="flex-1 overflow-hidden max-w-4xl mx-auto w-full">
          <div className="h-full bg-card rounded-lg shadow-md border-muted overflow-hidden p-6">
            <Alert variant="destructive">
              <IconAlertCircle className="h-4 w-4" />
              <AlertDescription>{error ? "Erro ao carregar tipo de tinta" : "Tipo de tinta não encontrado"}</AlertDescription>
            </Alert>
          </div>
        </div>
      </div>
    );
  }

  // Prepare default values with component item IDs
  const defaultValues: Partial<PaintTypeUpdateFormData> = {
    name: paintType.name,
    needGround: paintType.needGround,
    componentItemIds: paintType.componentItems?.map((item) => item.id) || [],
  };

  // Extract full component items for initial options
  const initialComponentItems = paintType.componentItems || [];

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
      onClick: () => document.getElementById("paint-type-form-submit")?.click(),
      variant: "default" as const,
      disabled: updateMutation.isPending || !formState.isValid || !formState.isDirty,
      loading: updateMutation.isPending,
    },
  ];

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <div className="max-w-4xl mx-auto">
          <PageHeaderWithFavorite
            title={`Editar ${paintType.name}`}
            icon={IconPaint}
            favoritePage={FAVORITE_PAGES.PINTURA_TIPOS_TINTA_EDITAR}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Pintura", href: routes.painting.root },
              { label: "Tipos de Tinta", href: routes.painting.paintTypes.root },
              { label: paintType.name, href: routes.painting.paintTypes.details(id!) },
              { label: "Editar" },
            ]}
            actions={actions}
          />
        </div>
      </div>

      {/* Main Content Card - Dashboard style scrolling */}
      <div className="flex-1 overflow-hidden max-w-4xl mx-auto w-full">
        <div className="h-full bg-card rounded-lg shadow-md border-muted overflow-hidden">
          <PaintTypeForm
            mode="update"
            paintTypeId={id!}
            defaultValues={defaultValues}
            initialComponentItems={initialComponentItems}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isSubmitting={updateMutation.isPending}
            onFormStateChange={setFormState}
          />
        </div>
      </div>
    </div>
  );
}

export default PaintTypeEditPage;
