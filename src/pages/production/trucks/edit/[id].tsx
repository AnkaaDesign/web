import { useParams } from "react-router-dom";
import { useTruckDetail } from "../../../../hooks";
import { TruckEditForm } from "@/components/fleet/truck/form";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { IconTruck, IconAlertCircle } from "@tabler/icons-react";
import { routes } from "../../../../constants";

const TruckEditPage = () => {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, error } = useTruckDetail(id!, {
    include: {
      task: {
        include: {
          customer: true,
        },
      },
      garage: true,
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col h-full space-y-4">
        <div className="flex-shrink-0">
          <div className="max-w-4xl mx-auto px-4">
            <PageHeader
              title="Carregando..."
              icon={IconTruck}
              variant="form"
              breadcrumbs={[
                { label: "Início", href: routes.home },
                { label: "Produção", href: routes.production.root },
                { label: "Caminhões", href: routes.production.trucks?.list || "/production/trucks" },
                { label: "Carregando..." },
              ]}
            />
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <div className="max-w-4xl mx-auto px-4 h-full overflow-y-auto">
            <div className="space-y-6 py-2">
              {[...Array(4)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <Skeleton className="h-6 w-48" />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Skeleton className="h-10" />
                        <Skeleton className="h-10" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="flex flex-col h-full space-y-4">
        <div className="flex-shrink-0">
          <div className="max-w-4xl mx-auto px-4">
            <PageHeader
              title="Erro ao carregar"
              icon={IconTruck}
              variant="form"
              breadcrumbs={[
                { label: "Início", href: routes.home },
                { label: "Produção", href: routes.production.root },
                { label: "Caminhões", href: routes.production.trucks?.list || "/production/trucks" },
                { label: "Erro" },
              ]}
            />
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <div className="max-w-4xl mx-auto px-4 h-full overflow-y-auto">
            <div className="py-12">
              <Alert variant="destructive">
                <IconAlertCircle className="h-4 w-4" />
                <AlertDescription>{error?.message || "Caminhão não encontrado"}</AlertDescription>
              </Alert>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const truck = data.data;

  return <TruckEditForm truck={truck} />;
};

export default TruckEditPage;
