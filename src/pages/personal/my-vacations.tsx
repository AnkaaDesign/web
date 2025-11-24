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
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader title="Minhas Férias" subtitle="Suas solicitações e períodos de férias" />
      <VacationList userId={user.id} className="flex-1 min-h-0" />
    </div>
  );
};

export default MyVacationsPage;
