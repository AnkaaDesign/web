import { IconCalculator } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page-header";
import { FAVORITE_PAGES, routes } from "../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { useAuth } from "@/contexts/auth-context";
import { CalculationList } from "@/components/integrations/secullum/calculations/list";

/**
 * My Time Entries Page (Meus Pontos / Controle de Ponto)
 *
 * Displays the time clock calculations for the logged-in user.
 * Uses the CalculationList component which handles user selection and period filtering.
 */
export const MyTimeEntriesPage = () => {
  const { user } = useAuth();

  usePageTracker({
    title: "Meus Pontos",
    icon: "calculator",
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Faça login para ver seus registros de ponto</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <PageHeader
        className="flex-shrink-0"
        variant="default"
        title="Meus Pontos"
        icon={IconCalculator}
        favoritePage={FAVORITE_PAGES.PESSOAL_MEUS_PONTOS}
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Pessoal", href: routes.personal.root },
          { label: "Meus Pontos" },
        ]}
      />
      <div className="flex-1 min-h-0 pb-6">
        <CalculationList mode="personal" />
      </div>
    </div>
  );
};

export default MyTimeEntriesPage;
