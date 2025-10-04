import { useNavigate } from "react-router-dom";
import { routes } from "../../../constants";
import { PageHeader } from "@/components/ui/page-header";
import { IconTruck, IconPlus } from "@tabler/icons-react";
import { TruckList } from "@/components/fleet/truck/list";
import { usePageTracker } from "@/hooks/use-page-tracker";

const TruckListPage = () => {
  const navigate = useNavigate();

  // Track page access
  usePageTracker({
    title: "Lista de Caminhões",
    icon: "truck",
  });

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex-shrink-0">
        <PageHeader
          title="Caminhões"
          icon={IconTruck}
          breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Produção", href: routes.production.root }, { label: "Caminhões" }]}
          actions={[
            {
              key: "create",
              label: "Novo Caminhão",
              icon: IconPlus,
              onClick: () => navigate(routes.production.trucks?.create || "#"),
              variant: "default",
            },
          ]}
        />
      </div>

      <TruckList className="flex-1 min-h-0" />
    </div>
  );
};

export default TruckListPage;
