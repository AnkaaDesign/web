// web/src/components/cliente/orcamento/vehicle-chips.tsx
//
// OS VEÍCULOS DE UM ORÇAMENTO, EM ETIQUETAS.
//
// O cliente não procura orçamento por número: procura pelo IMPLEMENTO. "O 1042" e
// "o da placa ABC1D23" são as duas formas que ele usa, e são exatamente série e
// placa. Por isso a coluna de veículos é uma fileira de etiquetas legíveis, e
// não um número solto de quantidade.
//
// ⚠️ A quantidade continua sendo dita por extenso quando as etiquetas não cabem
// (ou não vieram): um orçamento de sessenta implementos não pode virar sessenta
// etiquetas dentro de uma linha de tabela.
//
// ⚠️ SEM `identity` (o contato não tem a seção `VEHICLE`) a etiqueta cai no NOME
// do serviço, e não em "sem identificação": o implemento tem placa, quem não a vê
// é esta pessoa, e dizer "sem identificação" transformaria um recorte de
// privilégio num relatório de pendências falso.
import type { PortalVehicle } from "@/api-client/portal";
import { portalIdentityOf } from "@/api-client/portal";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Quantas etiquetas cabem numa linha de lista antes de virar "+N". */
const LIST_CHIP_LIMIT = 3;

/**
 * O texto de UMA etiqueta: série e placa, as duas quando houver as duas.
 *
 * Nunca devolve string vazia — um veículo ainda sem identificação (o caso normal
 * de uma requisição recém-aberta) tem de aparecer, senão a linha mente sobre
 * quantos implementos o orçamento cobre.
 */
export function vehicleChipLabel(vehicle: PortalVehicle): string {
  const identity = portalIdentityOf(vehicle);
  const parts = [identity?.serialNumber, identity?.plate].filter(Boolean) as string[];
  if (parts.length) return parts.join(" · ");
  if (vehicle.name) return vehicle.name;
  return identity ? "Sem identificação" : "Veículo";
}

/**
 * A ETIQUETA CURTA — só a série, para quando há mais de um veículo na célula.
 *
 * ⛔ ENCOLHER PELA INFORMAÇÃO, NÃO PELO CORTE. Com três veículos, o rótulo
 * completo ("90201 · RKO7A01") não cabe e o `truncate` produzia três etiquetas
 * cortadas no MEIO — "90201 · RK(", "90202 · RK(" —, que é o pior dos dois
 * mundos: ocupa o espaço da placa e não mostra placa nenhuma. A série sozinha
 * cabe inteira e é justamente o token que identifica o implemento na conversa do
 * cliente ("o 90201"). A placa continua no `title` e na tela do veículo.
 *
 * Com UM veículo o rótulo completo cabe, e aí mostrar os dois é melhor: quem
 * procura pela placa acha sem abrir nada.
 */
function vehicleChipShort(vehicle: PortalVehicle): string {
  const identity = portalIdentityOf(vehicle);
  if (identity?.serialNumber) return identity.serialNumber;
  return vehicleChipLabel(vehicle);
}

export function VehicleChips({
  vehicles,
  count,
  limit = LIST_CHIP_LIMIT,
  className,
}: {
  vehicles: PortalVehicle[];
  /**
   * `Budget.vehicleCount` — a verdade sobre QUANTOS são.
   *
   * ⚠️ Não é `vehicles.length`: o `select` das tarefas dentro do orçamento é
   * ESCOPADO (`taskScopeWhere`), então num orçamento `PER_TASK` de dez implementos
   * quem paga o terceiro recebe UM veículo e o contador continua dizendo dez. As
   * duas informações são verdadeiras e diferentes.
   */
  count?: number | null;
  limit?: number;
  className?: string;
}) {
  const total = count ?? vehicles.length;

  if (!vehicles.length) {
    if (!total) return <span className="text-muted-foreground">—</span>;
    return (
      <span className="whitespace-nowrap text-sm text-muted-foreground">
        {total} {total === 1 ? "veículo" : "veículos"}
      </span>
    );
  }

  const shown = vehicles.slice(0, limit);
  const hidden = Math.max(total, vehicles.length) - shown.length;

  return (
    // ⛔ `flex-nowrap`, NUNCA `flex-wrap`.
    //
    // Com quebra de linha, um orçamento de três implementos desenhava três
    // etiquetas EMPILHADAS e a linha da tabela ficava três vezes mais alta que
    // as vizinhas — a lista perdia o ritmo e a varredura com o olho, que é a
    // única coisa que uma tabela oferece. Agora a fileira é sempre de UMA
    // linha: as etiquetas encolhem e truncam, o "+N" fica preso no fim
    // (`shrink-0`), e o conjunto inteiro continua legível no `title`.
    //
    // `min-w-0` é obrigatório no contêiner E nas etiquetas: sem ele um filho
    // flex recusa encolher abaixo do próprio conteúdo e o truncamento nunca
    // acontece — a fileira simplesmente transborda a célula.
    <div className={cn("flex min-w-0 flex-nowrap items-center gap-1 overflow-hidden", className)}>
      {shown.map((vehicle) => (
        <Badge
          key={vehicle.id}
          variant="secondary"
          size="sm"
          className="min-w-0 max-w-[12rem] shrink truncate font-normal tabular-nums"
          title={vehicleChipLabel(vehicle)}
        >
          {shown.length > 1 ? vehicleChipShort(vehicle) : vehicleChipLabel(vehicle)}
        </Badge>
      ))}
      {hidden > 0 && (
        <span
          className="shrink-0 whitespace-nowrap text-sm text-muted-foreground"
          title={vehicles.map(vehicleChipLabel).join(", ")}
        >
          +{hidden}
        </span>
      )}
    </div>
  );
}
