import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { SECTOR_PRIVILEGES } from "../../constants";

export default function MaintenancePage() {
  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.MAINTENANCE}>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Manutenção</h1>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <p className="text-gray-600">Esta é a página principal de manutenção para técnicos e supervisores.</p>
          <p className="text-sm text-gray-500 mt-2">Aqui você pode gerenciar ordens de serviço, equipamentos e cronogramas de manutenção preventiva.</p>
        </div>
      </div>
    </PrivilegeRoute>
  );
}
