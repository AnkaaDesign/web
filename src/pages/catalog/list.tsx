import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { SECTOR_PRIVILEGES } from "../../constants";

export default function CatalogListPage() {
  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.LEADER}>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Catálogo Básico</h1>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <p className="text-gray-600">Esta é a página de listagem do catálogo básico para líderes.</p>
          <p className="text-sm text-gray-500 mt-2">Aqui você pode visualizar os itens do catálogo sem precisar de acesso ao módulo completo de pintura.</p>
        </div>
      </div>
    </PrivilegeRoute>
  );
}
