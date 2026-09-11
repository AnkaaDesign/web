import { useMemo, useState } from "react";
import { IconCopy, IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * O PEDIDO DE COMPRA É DO VEÍCULO.
 *
 * Morava em `TaskQuoteCustomerConfig.orderNumber`, uma linha por CLIENTE. Isso
 * obrigava os sessenta caminhões de um orçamento a citarem o mesmo número na
 * nota e no boleto — e o pedido de compra é por ENTREGA: o cliente compra dez
 * hoje num pedido, cinquenta na semana seguinte em outro. Agora mora em
 * `Task.customerOrderNumber`, um por veículo.
 *
 * A TELA TEM DE COBRIR OS DOIS CASOS SEM COBRAR PELOS DOIS:
 *
 *   · UM veículo (a esmagadora maioria) — um campo só, no mesmo lugar em que
 *     sempre esteve. Quem nunca viu um orçamento multitarefa não percebe que a
 *     natureza do campo mudou.
 *   · N veículos comprados no MESMO pedido (o caso comum quando são muitos) —
 *     digitar sessenta vezes o mesmo número é o tipo de trabalho que faz o
 *     operador desistir e deixar tudo em branco. Daí "Aplicar a todos".
 *   · N veículos em pedidos DIFERENTES — a tabela, aberta sob demanda.
 *
 * A lista fica fechada por padrão: sessenta linhas abertas empurrariam a
 * condição de pagamento para fora da tela em toda visita, inclusive nas que não
 * têm nada a ver com pedido de compra.
 */

export interface PurchaseOrderVehicle {
  /**
   * A chave ESTÁVEL da linha.
   *
   * No detalhe é o `id` da tarefa. Na criação as tarefas ainda não existem, e é
   * a combinação placa|série — que é exatamente o que o `POST` reconstrói para
   * casar o número digitado com a tarefa que vai nascer. Índice NÃO serve:
   * acrescentar uma placa no passo 1 reordena o produto cartesiano e o pedido
   * do caminhão 3 passaria a valer para o 7.
   */
  key: string;
  label: string;
}

interface PurchaseOrderVehiclesProps {
  vehicles: PurchaseOrderVehicle[];
  values: Record<string, string | null | undefined>;
  onChange: (key: string, value: string | null) => void;
  disabled?: boolean;
  /** Classe de atenção — pintada só nos campos EM BRANCO, que é o que a regra cobra. */
  attentionClass?: string;
  attentionTitle?: string;
  className?: string;
}

export function PurchaseOrderVehicles({
  vehicles,
  values,
  onChange,
  disabled,
  attentionClass,
  attentionTitle,
  className,
}: PurchaseOrderVehiclesProps) {
  const [expanded, setExpanded] = useState(false);
  const [bulk, setBulk] = useState("");

  const filled = useMemo(
    () => vehicles.filter((v) => (values[v.key] ?? "").trim().length > 0).length,
    [vehicles, values],
  );

  if (vehicles.length === 0) return null;

  const fieldClass = (key: string) =>
    (values[key] ?? "").trim() ? undefined : attentionClass;

  // ── Um veículo: o campo de sempre, no lugar de sempre ──────────────────────
  if (vehicles.length === 1) {
    const only = vehicles[0];
    return (
      <div className={cn("space-y-1.5 flex-1 min-w-[100px]", className)}>
        <Label className="text-sm font-medium">N° do Pedido</Label>
        <Input
          value={values[only.key] ?? ""}
          onChange={(value) => {
            const text = String(value ?? "").trim();
            onChange(only.key, text === "" ? null : text);
          }}
          placeholder="Ex: 12345"
          maxLength={100}
          disabled={disabled}
          className={fieldClass(only.key)}
          title={fieldClass(only.key) ? attentionTitle : undefined}
        />
      </div>
    );
  }

  // ── N veículos ─────────────────────────────────────────────────────────────
  const applyToAll = () => {
    const text = bulk.trim();
    for (const v of vehicles) onChange(v.key, text === "" ? null : text);
  };

  return (
    <div className={cn("w-full space-y-2", className)}>
      <div className="flex items-end gap-2 flex-wrap">
        <div className="space-y-1.5 flex-1 min-w-[140px]">
          <Label className="text-sm font-medium">
            N° do Pedido{" "}
            <span className="text-xs font-normal text-muted-foreground">
              ({filled} de {vehicles.length} veículos)
            </span>
          </Label>
          <Input
            value={bulk}
            onChange={(value) => setBulk(String(value ?? ""))}
            placeholder={`Aplicar aos ${vehicles.length} veículos`}
            maxLength={100}
            disabled={disabled}
            className={filled === 0 ? attentionClass : undefined}
            title={filled === 0 ? attentionTitle : undefined}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="default"
          onClick={applyToAll}
          disabled={disabled}
          title={`Grava o número digitado nos ${vehicles.length} veículos deste orçamento`}
        >
          <IconCopy className="h-4 w-4 mr-1.5" />
          Aplicar a todos
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="default"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? <IconChevronUp className="h-4 w-4 mr-1.5" /> : <IconChevronDown className="h-4 w-4 mr-1.5" />}
          Por veículo
        </Button>
      </div>

      {expanded && (
        <div className="rounded-md border border-border divide-y divide-border max-h-72 overflow-y-auto">
          {vehicles.map((v) => (
            <div key={v.key} className="flex items-center gap-3 px-3 py-2">
              <span className="text-sm text-muted-foreground truncate flex-1 min-w-0" title={v.label}>
                {v.label}
              </span>
              <Input
                value={values[v.key] ?? ""}
                onChange={(value) => {
                  const text = String(value ?? "").trim();
                  onChange(v.key, text === "" ? null : text);
                }}
                placeholder="Ex: 12345"
                maxLength={100}
                disabled={disabled}
                className={cn("w-40 shrink-0", fieldClass(v.key))}
                title={fieldClass(v.key) ? attentionTitle : undefined}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A LEITURA da mesma coisa — para os passos de conferência e para o detalhe.
 *
 * Um número quando todos os veículos citam o mesmo (ou quando é um só). Vários,
 * separados por vírgula, quando diferem: a nota conjunta cobre todos, e omitir
 * os outros faria o cliente receber uma nota que não bate com nenhum pedido dele.
 * `null` quando nenhum veículo tem pedido — quem chama decide se isso é "—" ou
 * "Pendente".
 */
export { orderNumberLabel } from "@/utils/quote-tasks";

/**
 * O PRODUTO CARTESIANO placas × números de série — os veículos que a criação vai
 * gravar.
 *
 * Mora AQUI, junto da chave, porque as duas têm de andar juntas: o passo de
 * faturamento monta a tabela de pedidos de compra a partir desta lista e o
 * submit reconstrói a MESMA lista para montar as tarefas. Duas cópias da regra
 * deslizariam no primeiro ajuste — e o sintoma seria o pedido de um caminhão
 * gravado noutro, que só aparece na nota fiscal.
 */
export interface VehicleCombination {
  plate?: string;
  serialNumber?: string;
}

export function vehicleCombinations(
  plates: readonly string[] | null | undefined,
  serialNumbers: readonly (string | number)[] | null | undefined,
): VehicleCombination[] {
  const p = (plates ?? []).filter((x) => String(x ?? "").trim() !== "");
  const s = (serialNumbers ?? []).filter((x) => String(x ?? "").trim() !== "");
  const out: VehicleCombination[] = [];
  if (p.length > 0 && s.length > 0) {
    for (const plate of p) for (const sn of s) out.push({ plate, serialNumber: String(sn) });
  } else if (p.length > 0) {
    for (const plate of p) out.push({ plate });
  } else if (s.length > 0) {
    for (const sn of s) out.push({ serialNumber: String(sn) });
  } else {
    out.push({});
  }
  return out;
}

/**
 * A CHAVE da linha na criação. Ver `PurchaseOrderVehicle.key`: identidade do
 * veículo, nunca a posição dele na lista.
 */
export function vehicleCombinationKey(
  plate?: string | null,
  serialNumber?: string | null,
): string {
  return `${(plate ?? "").trim().toUpperCase()}|${(serialNumber ?? "").trim()}`;
}

/** O rótulo da linha na criação — placa e série são tudo o que existe ainda. */
export function vehicleCombinationLabel(combo: VehicleCombination, index: number): string {
  const parts: string[] = [];
  if (combo.serialNumber) parts.push(`#${combo.serialNumber}`);
  if (combo.plate) parts.push(combo.plate.toUpperCase());
  return parts.length > 0 ? parts.join(" · ") : `Veículo ${index + 1}`;
}
