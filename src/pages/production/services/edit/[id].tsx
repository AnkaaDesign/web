import { useParams, useNavigate } from "react-router-dom";
import { useServiceDetail, useServiceMutations } from "../../../../hooks";
import { type ServiceUpdateFormData } from "../../../../schemas";
import { routes } from "../../../../constants";
import { ServiceForm } from "@/components/production/service/form/service-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { IconTool } from "@tabler/icons-react";

export const ServiceEditPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useServiceDetail(id!);
  const { update, isUpdating } = useServiceMutations();

  const handleSubmit = async (data: ServiceUpdateFormData) => {
    if (!id) return;

    try {
      await update({ id, data });
      navigate(routes.production.services.details(id));
    } catch (error) {
      // Error is handled by the API client
    }
  };

  const handleCancel = () => {
    if (id) {
      navigate(routes.production.services.details(id));
    } else {
      navigate(routes.production.services.list);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        {/* Fixed Header */}
        <div className="flex-shrink-0">
          <div className="px-4 pt-4">
            <div className="max-w-3xl mx-auto">
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto p-4">
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!data?.data) {
    return (
      <div className="h-full flex flex-col">
        {/* Fixed Header */}
        <div className="flex-shrink-0">
          <div className="px-4 pt-4">
            <div className="max-w-3xl mx-auto">
              <PageHeader
                title="Editar Serviço"
                icon={IconTool}
                variant="form"
                breadcrumbs={[
                  { label: "Home", href: "/" },
                  { label: "Produção", href: routes.production.root },
                  { label: "Serviços", href: routes.production.services.list },
                  { label: "Editar Serviço" },
                ]}
              />
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto p-4">
            <Card>
              <CardContent className="p-6">
                <p className="text-center text-muted-foreground">Serviço não encontrado</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <div className="px-4 pt-4">
          <div className="max-w-3xl mx-auto">
            <PageHeader
              title={`Editar ${data.data.description}`}
              subtitle="Atualize as informações do serviço"
              icon={IconTool}
              variant="form"
              breadcrumbs={[
                { label: "Home", href: "/" },
                { label: "Produção", href: routes.production.root },
                { label: "Serviços", href: routes.production.services.list },
                { label: data.data.description, href: routes.production.services.details(id!) },
                { label: "Editar" },
              ]}
              backButton={{
                onClick: () => navigate(routes.production.services.details(id!)),
              }}
            />
          </div>
        </div>
      </div>

      {/* Scrollable Form Container */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4">
          <Card>
            <CardContent className="p-6">
              <ServiceForm service={data.data} onSubmit={handleSubmit} onCancel={handleCancel} isSubmitting={isUpdating} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
