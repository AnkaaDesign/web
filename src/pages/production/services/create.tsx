import { useNavigate } from "react-router-dom";
import { useServiceMutations } from "../../../hooks";
import { type ServiceCreateFormData } from "../../../schemas";
import { routes, FAVORITE_PAGES } from "../../../constants";
import { ServiceForm } from "@/components/production/service/form/service-form";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { IconTool } from "@tabler/icons-react";

export const ServiceCreatePage = () => {
  const navigate = useNavigate();
  const { createAsync: create, createMutation } = useServiceMutations();

  const handleSubmit = async (data: ServiceCreateFormData) => {
    try {
      const result = await create(data);
      if (result?.data?.id) {
        navigate(routes.production.services.details(result.data.id));
      } else {
        navigate(routes.production.services.list);
      }
    } catch (error) {
      // Error is handled by the API client
    }
  };

  const handleCancel = () => {
    navigate(routes.production.services.list);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <div className="max-w-3xl mx-auto px-4 pt-4">
          <PageHeaderWithFavorite
            title="Novo Serviço"
            subtitle="Crie um novo tipo de serviço que pode ser associado às tarefas"
            icon={IconTool}
            favoritePage={FAVORITE_PAGES.PRODUCAO_SERVICOS_CADASTRAR}
            breadcrumbs={[
              { label: "Home", href: "/" },
              { label: "Produção", href: routes.production.root },
              { label: "Serviços", href: routes.production.services.list },
              { label: "Novo Serviço" },
            ]}
            backButton={{
              onClick: () => navigate(routes.production.services.list),
            }}
          />
        </div>
      </div>

      {/* Scrollable Form Container */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto h-full">
          <ServiceForm onSubmit={handleSubmit} onCancel={handleCancel} isSubmitting={createMutation.isPending} />
        </div>
      </div>
    </div>
  );
};
