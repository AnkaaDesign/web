import { useNavigate } from "react-router-dom";
import { IconTruck } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants";
import { formatPlate } from "@/utils";

export interface QuoteVehicleIdentity {
  id: string;
  serialNumber?: string | null;
  plate?: string | null;
  chassisNumber?: string | null;
  customerOrderNumber?: string | null;
}

/**
 * A RELAÇÃO DE VEÍCULOS, no lugar dos campos de identidade de UM deles.
 *
 * Cada linha leva à tela daquele caminhão, que é onde a edição é individual:
 * série, placa, chassi, plaqueta e nº do pedido são DELE, e um orçamento de
 * quatro não tem um "o" veículo para editar aqui. As colunas são as mesmas do
 * documento e da página pública, para que a conferência seja a mesma em todas
 * as telas.
 */
export function MultiVehicleIdentityTable({ vehicles }: { vehicles: QuoteVehicleIdentity[] }) {
  const navigate = useNavigate();
  if (vehicles.length === 0) return null;
  const anyOrderNumber = vehicles.some((v) => !!(v.customerOrderNumber ?? "").trim());
  const dash = <span className="text-muted-foreground italic">a registrar</span>;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <IconTruck className="h-4 w-4" />
        Veículos do orçamento ({vehicles.length})
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr className="bg-muted/40 text-muted-foreground">
              <th className="w-10 px-3 py-2 text-left text-[0.65rem] font-semibold uppercase tracking-wide">#</th>
              <th className="px-3 py-2 text-left text-[0.65rem] font-semibold uppercase tracking-wide">Nº de série</th>
              <th className="px-3 py-2 text-left text-[0.65rem] font-semibold uppercase tracking-wide">Placa</th>
              <th className="px-3 py-2 text-left text-[0.65rem] font-semibold uppercase tracking-wide">Chassi</th>
              {anyOrderNumber && (
                <th className="px-3 py-2 text-left text-[0.65rem] font-semibold uppercase tracking-wide">Nº do pedido</th>
              )}
              <th className="w-24 px-3 py-2 text-right text-[0.65rem] font-semibold uppercase tracking-wide">Editar</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v, i) => (
              <tr key={v.id} className="border-t border-border/60">
                <td className="px-3 py-2 tabular-nums text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-2 font-medium">{v.serialNumber || dash}</td>
                <td className="px-3 py-2 font-medium">{v.plate ? formatPlate(v.plate) : dash}</td>
                <td className="px-3 py-2 font-mono text-xs">{v.chassisNumber || dash}</td>
                {anyOrderNumber && (
                  <td className="px-3 py-2 tabular-nums">
                    {(v.customerOrderNumber ?? "").trim() || <span className="text-muted-foreground">—</span>}
                  </td>
                )}
                <td className="px-3 py-2 text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(routes.production.schedule.details(v.id))}
                  >
                    Abrir
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
