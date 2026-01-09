import { PageHeader } from "@/components/ui/page-header";
import { VacationList } from "@/components/human-resources/vacation";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent } from "@/components/ui/card";

export const MyVacationsPage = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="container mx-auto py-6">
        <PageHeader title="Minhas Férias" subtitle="Suas solicitações e períodos de férias" />
        <Card className="mt-6">
          <CardContent className="py-8">
            <p className="text-muted-foreground text-center">Faça login para ver suas férias</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <PageHeader
        title="Minhas Férias"
        subtitle="Suas solicitações e períodos de férias"
        className="flex-shrink-0"
      />
      <div className="flex-1 min-h-0 pb-6 flex flex-col">
        <VacationList mode="personal" className="h-full" />
      </div>
    </div>
  );
};

export default MyVacationsPage;
