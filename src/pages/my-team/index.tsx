import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { SECTOR_PRIVILEGES } from "../../constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { routes } from "../../constants";

const teamMenuItems = [
  {
    id: "commissions",
    title: "Comissões",
    description: "Gerencie as comissões dos colaboradores do seu setor",
    route: routes.myTeam.commissions,
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
    id: "loans",
    title: "Empréstimos",
    description: "Controle empréstimos de equipamentos da sua equipe",
    route: routes.myTeam.loans,
  },
];

export default function MyTeamPage() {
  const navigate = useNavigate();

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.LEADER}>
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-2">Meu Pessoal</h1>
        <p className="text-gray-600 mb-8">Gerencie os colaboradores do seu setor com facilidade</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teamMenuItems.map((item) => (
            <Card key={item.id} className="hover:shadow-lg transition-shadow">
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
    </PrivilegeRoute>
  );
}
