import { RepresentativeList } from "@/components/representatives/list";
import { PageHeader } from "@/components/ui/page-header";
import { routes } from "@/constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { IconPlus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

export const RepresentativeListPage = () => {
  const navigate = useNavigate();

  // Track page access
  usePageTracker({
    title: "Lista de Representantes",
    icon: "users",
  });

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <PageHeader
        variant="list"
        title="Representantes"
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Representantes" }
        ]}
        actions={[
          {
            key: "create",
            label: "Cadastrar",
            icon: IconPlus,
            onClick: () => navigate("/representatives/new"),
            variant: "default" as const,
          },
        ]}
        className="flex-shrink-0"
      />
      <div className="flex-1 min-h-0 pb-6 flex flex-col">
        <RepresentativeList className="h-full" />
      </div>
    </div>
  );
};