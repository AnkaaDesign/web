import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { SECTOR_PRIVILEGES } from "../../../constants";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function MaintenanceDetailsPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.MAINTENANCE}>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Detalhes da Manutenção</h1>

        <Card>
          <CardHeader>
            <CardTitle>Ordem de Serviço #{id}</CardTitle>
            <CardDescription>Detalhes completos da ordem de manutenção</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Informações Básicas</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Equipamento:</p>
                  <p className="font-medium">Exemplo de Equipamento</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status:</p>
                  <p className="font-medium">Em Andamento</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Técnico Responsável:</p>
                  <p className="font-medium">João Silva</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Data de Abertura:</p>
                  <p className="font-medium">15/01/2024</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Descrição do Problema</h3>
              <p className="text-gray-700">Equipamento apresentando ruídos anômalos durante operação. Necessária inspeção e possível substituição de componentes.</p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Ações Realizadas</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                <li>Inspeção visual inicial</li>
                <li>Teste de funcionamento</li>
                <li>Diagnóstico do problema</li>
              </ul>
            </div>

            <div className="flex space-x-4 pt-4">
              <Button>Editar</Button>
              <Button variant="outline">Imprimir</Button>
              <Button variant="destructive">Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PrivilegeRoute>
  );
}
