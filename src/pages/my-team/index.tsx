import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate, Navigate } from "react-router-dom";
import { routes } from "../../constants";
import { useAuth } from "@/hooks/use-auth";
import { IconLoader2 } from "@tabler/icons-react";

const teamMenuItems = [
  {
    id: "members",
    title: "Membros",
    description: "Visualize os colaboradores do seu setor",
    route: routes.myTeam.members,
  },
  {
    id: "loans",
    title: "Empréstimos",
    description: "Controle empréstimos de equipamentos da sua equipe",
    route: routes.myTeam.loans,
  },
  {
    id: "vacations",
    title: "Férias",
    description: "Aprove ou rejeite solicitações de férias da sua equipe",
    route: routes.myTeam.vacations,
  },
  {
    id: "warnings",
    title: "Advertências",
    description: "Visualize e gerencie as advertências dos colaboradores",
    route: routes.myTeam.warnings,
  },
  {
    id: "ppes",
    title: "Entregas de EPI",
    description: "Acompanhe as entregas de EPIs dos colaboradores",
    route: routes.myTeam.ppes,
  },
  {
    id: "movements",
    title: "Movimentações",
    description: "Visualize as movimentações de estoque da equipe",
    route: routes.myTeam.movements,
  },
  {
    id: "calculations",
    title: "Controle de Ponto",
    description: "Acompanhe os registros de ponto dos colaboradores",
    route: routes.myTeam.calculations,
  },
];

export default function MyTeamPage() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  // Show loading spinner while auth is being determined
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <IconLoader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Redirect if not authenticated
  if (!user) {
    return <Navigate to={routes.authentication.login} replace />;
  }

  // Only team leaders (users with managedSector) can access this page
  if (!user.managedSector) {
    return <Navigate to={routes.home} replace />;
  }

  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold mb-2">Minha Equipe</h1>
      <p className="text-gray-600 mb-8">Gerencie os colaboradores do seu setor com facilidade</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teamMenuItems.map((item) => (
          <Card key={item.id} className="hover:shadow-sm transition-shadow">
            <CardHeader>
              <CardTitle className="text-xl">{item.title}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate(item.route)} className="w-full">
                Acessar {item.title}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Dica:</strong> Como líder, você tem acesso a informações específicas da sua equipe. Use estas ferramentas para acompanhar o desempenho e bem-estar dos seus
          colaboradores.
        </p>
      </div>
    </div>
  );
}
