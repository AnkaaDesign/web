import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { SECTOR_PRIVILEGES } from "../../constants";

export default function MyTeamWarningsPage() {
  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.LEADER}>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Advertências da Equipe</h1>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <p className="text-gray-600">Visualize e gerencie as advertências dos colaboradores do seu setor.</p>
          <p className="text-sm text-gray-500 mt-2">Acompanhe o histórico disciplinar da sua equipe.</p>
        </div>
      </div>
    </PrivilegeRoute>
  );
}
