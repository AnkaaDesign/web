import { useParams } from "react-router-dom";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { SECTOR_PRIVILEGES } from "../../../constants";

export default function CatalogDetailsPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.LEADER}>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Detalhes do Catálogo</h1>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <p className="text-gray-600">
            Detalhes do item do catálogo: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{id}</span>
          </p>
          <p className="text-sm text-gray-500 mt-2">Esta página mostra os detalhes de um item específico do catálogo.</p>
        </div>
      </div>
    </PrivilegeRoute>
  );
}
