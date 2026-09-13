/**
 * JUNTO, SEPARADO OU EM LOTES — o controle que decide quantas faturas o cliente
 * recebe, e de quais veículos é cada uma.
 *
 * POR QUE ISTO É UM COMPONENTE, e não um `<Combobox>` solto em cada assistente
 * ─────────────────────────────────────────────────────────────────────────────
 * A escolha existia só no assistente de Orçamento, um seletor de duas opções
 * escrito na mão dentro do passo do cliente. Duas consequências:
 *
 *   · o FINANCEIRO — que é quem fatura — não tinha como separar: a tela de
 *     Faturamento não mandava o campo, então "faturar separado" só era possível
 *     voltando ao Comercial;
 *   · não havia meio-termo. "Os vinte primeiros no pedido 8842, os quarenta no
 *     9013" não cabia em nenhuma das duas opções.
 *
 * O mesmo controle passa a viver nos dois assistentes, no mesmo lugar da tela, e
 * a compor LOTES quando é preciso.
 *
 * O QUE ELE ESCREVE
 * ─────────────────────────────────────────────────────────────────────────────
 * `billingSplit` (o modo) e `billingGroups` (a partição dos veículos, só
 * relevante em lotes). Quem transforma isso no `customerConfigs[].taskIds` que a
 * API recebe é o assistente, no momento do save — porque a partição é a MESMA
 * para todos os clientes do orçamento (um lote é uma unidade de cobrança, não um
 * negócio diferente), e mantê-la num campo só evita que a tela precise gerenciar
 * K faturas por cliente.
 */
import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { IconAlertTriangle, IconPlus } from "@tabler/icons-react";

export type BillingSplitValue = "JOINT" | "PER_TASK" | "CUSTOM";

export interface BillingSplitVehicle {
  id: string;
  name?: string | null;
  serialNumber?: string | null;
  plate?: string | null;
  customerOrderNumber?: string | null;
}

/** Como o operador identifica um implemento: série, senão placa, senão nome. */
export function vehicleLabel(v: BillingSplitVehicle): string {
  return v.serialNumber || v.plate || v.name || v.id.slice(0, 8);
}

/**
 * A partição normalizada.
 *
 * Espelha `planCoverage` da API: descarta o que não é veículo deste orçamento,
 * derruba lote vazio e ISOLA quem nenhum lote reivindicou — nunca enfia no
 * primeiro. Enfiar mudaria em silêncio o valor de uma fatura que alguém já
 * conferiu; isolar faz aparecer um lote novo, sozinho, que é uma pergunta
 * visível.
 */
export function normalizeGroups(
  groups: string[][] | null | undefined,
  vehicleIds: readonly string[],
): string[][] {
  const valid = new Set(vehicleIds);
  const seen = new Set<string>();
  const out: string[][] = [];
  for (const group of groups ?? []) {
    const kept = group.filter((id) => valid.has(id) && !seen.has(id));
    kept.forEach((id) => seen.add(id));
    if (kept.length > 0) out.push(kept);
  }
  for (const id of vehicleIds) if (!seen.has(id)) out.push([id]);
  return out;
}

/** A partição que um modo produz, para o assistente mandar no save. */
export function groupsForSplit(
  split: BillingSplitValue,
  vehicleIds: readonly string[],
  customGroups?: string[][] | null,
): string[][] {
  if (vehicleIds.length === 0) return [];
  if (split === "PER_TASK") return vehicleIds.map((id) => [id]);
  if (split === "CUSTOM") return normalizeGroups(customGroups, vehicleIds);
  return [[...vehicleIds]];
}

/**
 * O FORMULÁRIO TEM UMA FATURA POR CLIENTE; A API RECEBE UMA POR (CLIENTE × LOTE).
 *
 * A expansão acontece no save, e só quando há lotes: nos outros modos a
 * cobertura é derivável do modo, e mandá-la seria payload inútil — e uma segunda
 * fonte de verdade sobre quem cobra quem.
 *
 * ⚠️ O `id` NÃO acompanha a expansão. Ele identifica UMA fatura; repeti-lo nos K
 * lotes do cliente faria o servidor casar os K grupos com a MESMA linha. Sem ele,
 * o casamento cai nas tentativas seguintes — cobertura idêntica, depois maior
 * sobreposição —, que é exatamente o que mantém a fatura certa viva quando um
 * lote é redividido.
 */
export function expandConfigsIntoLots<T extends Record<string, unknown>>(
  configs: readonly T[],
  split: BillingSplitValue,
  vehicleIds: readonly string[],
  customGroups?: string[][] | null,
): Array<Record<string, unknown>> {
  if (split !== "CUSTOM" || vehicleIds.length <= 1) return [...configs];
  const lots = groupsForSplit("CUSTOM", vehicleIds, customGroups);
  return lots.flatMap((lot) =>
    configs.map((config) => {
      const { id: _dropped, ...rest } = config as Record<string, unknown>;
      return { ...rest, taskIds: lot };
    }),
  );
}

interface BillingSplitFieldProps {
  /**
   * Os veículos do orçamento, com id.
   *
   * VAZIO é legítimo e acontece no assistente de CRIAÇÃO: ali as tarefas ainda
   * não existem (nascem no save, do produto placas × séries), então não há id
   * para agrupar. Nesse caso o controle oferece só "junto" e "separado" — montar
   * lotes sobre veículos que ainda não existem exigiria identidades provisórias
   * que o save teria de reconciliar, e o ganho não paga o risco: quem cria um
   * orçamento de sessenta caminhões agrupa depois, quando sabe quais entregou.
   */
  vehicles: BillingSplitVehicle[];
  /** Contagem quando `vehicles` está vazio (criação). Default: `vehicles.length`. */
  vehicleCount?: number;
  value: BillingSplitValue;
  groups: string[][];
  onChange: (next: { billingSplit: BillingSplitValue; billingGroups: string[][] }) => void;
  disabled?: boolean;
  /**
   * Quantas faturas deste orçamento JÁ foram aprovadas.
   *
   * Maior que zero trava o controle: a cobertura de uma fatura aprovada sustenta
   * uma nota fiscal autorizada e boletos registrados, e mudá-la alteraria
   * retroativamente de quais caminhões é um documento fiscal que já saiu. A API
   * recusa; a tela diz antes, em vez de deixar o operador tentar.
   */
  approvedCount?: number;
  /** Avisa que refatiar derruba a coleta de assinaturas em andamento. */
  warnSignature?: boolean;
  className?: string;
}

export function BillingSplitField({
  vehicles,
  vehicleCount,
  value,
  groups,
  onChange,
  disabled,
  approvedCount = 0,
  warnSignature,
  className,
}: BillingSplitFieldProps) {
  const vehicleIds = useMemo(() => vehicles.map((v) => v.id), [vehicles]);
  const allowCustom = vehicles.length > 0;
  const normalized = useMemo(
    () => (value === "CUSTOM" ? normalizeGroups(groups, vehicleIds) : groupsForSplit(value, vehicleIds)),
    [value, groups, vehicleIds],
  );

  const locked = !!disabled || approvedCount > 0;
  const count = vehicles.length > 0 ? vehicles.length : Math.max(0, vehicleCount ?? 0);

  /** Em qual lote (1-based) cada veículo está. */
  const lotOf = useMemo(() => {
    const map = new Map<string, number>();
    normalized.forEach((group, i) => group.forEach((id) => map.set(id, i + 1)));
    return map;
  }, [normalized]);

  const setVehicleLot = (taskId: string, lot: number) => {
    const next: string[][] = normalized.map((g) => g.filter((id) => id !== taskId));
    while (next.length < lot) next.push([]);
    next[lot - 1].push(taskId);
    onChange({
      billingSplit: "CUSTOM",
      billingGroups: normalizeGroups(next, vehicleIds),
    });
  };

  const setSplit = (next: BillingSplitValue) => {
    onChange({ billingSplit: next, billingGroups: groupsForSplit(next, vehicleIds, groups) });
  };

  // Com um veículo a pergunta não existe, e um seletor dizendo "Fatura única"
  // num orçamento de um caminhão é ruído que o operador aprende a ignorar.
  if (count <= 1) return null;

  const lotOptions = [
    ...normalized.map((_, i) => ({ value: String(i + 1), label: `Lote ${i + 1}` })),
    { value: String(normalized.length + 1), label: "Novo lote" },
  ];

  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-sm font-medium">Faturamento dos {count} veículos</Label>
      <Combobox
        value={value}
        onValueChange={(v) => setSplit((v || "JOINT") as BillingSplitValue)}
        disabled={locked}
        options={[
          { value: "JOINT", label: `Fatura única para os ${count} veículos` },
          { value: "PER_TASK", label: "Uma fatura por veículo" },
          // Lotes só onde os veículos JÁ EXISTEM: ver a nota em `vehicles`.
          ...(allowCustom
            ? [{ value: "CUSTOM", label: "Lotes — agrupar veículos por fatura" }]
            : []),
        ]}
        placeholder="Fatura única"
        searchable={false}
        emptyText="Nenhuma opção"
      />

      {/* O QUE A ESCOLHA CUSTA, em uma linha. O número surpreende: sessenta
          caminhões em quatro parcelas são duzentos e quarenta boletos, e quem
          decide precisa saber disso antes, não quando o malote chegar. */}
      <p className="text-xs text-muted-foreground">
        {value === "JOINT"
          ? `Uma fatura com o total dos ${count} veículos, um plano de parcelas e uma nota fiscal citando todos.`
          : value === "PER_TASK"
            ? `${count} faturas, ${count} notas fiscais e um plano de parcelas por veículo. O financeiro aprova veículo a veículo, conforme cada um é entregue.`
            : `${normalized.length} ${normalized.length === 1 ? "fatura" : "faturas"}: cada lote recebe a sua nota fiscal e o seu plano de parcelas.`}
      </p>

      {approvedCount > 0 && (
        <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-500">
          <IconAlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {approvedCount === 1
              ? "Uma fatura deste orçamento já foi aprovada"
              : `${approvedCount} faturas deste orçamento já foram aprovadas`}
            : a divisão não pode mais mudar. Reverta o faturamento para refatiar.
          </span>
        </p>
      )}

      {warnSignature && approvedCount === 0 && value !== "JOINT" && (
        <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-500">
          <IconAlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Mudar a divisão altera a cláusula de pagamento do documento: a coleta de assinaturas em
            andamento é cancelada e precisa ser reenviada.
          </span>
        </p>
      )}

      {/* ─── A COMPOSIÇÃO DOS LOTES ────────────────────────────────────────
          Uma linha por veículo, com o lote ao lado. É a forma mais direta de
          responder "quem está com quem" sem arrastar nada: o operador lê a série
          e escolhe o número, e "Novo lote" abre mais um. */}
      {value === "CUSTOM" && allowCustom && (
        <div className="rounded-md border border-input divide-y">
          {vehicles.map((v) => (
            <div key={v.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{vehicleLabel(v)}</div>
                {v.customerOrderNumber ? (
                  <div className="truncate text-xs text-muted-foreground">
                    Pedido {v.customerOrderNumber}
                  </div>
                ) : null}
              </div>
              <div className="w-[140px] shrink-0">
                <Combobox
                  value={String(lotOf.get(v.id) ?? 1)}
                  onValueChange={(lot) => setVehicleLot(v.id, Number(lot) || 1)}
                  disabled={locked}
                  options={lotOptions}
                  searchable={false}
                  clearable={false}
                  placeholder="Lote"
                />
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <div className="flex flex-wrap gap-1.5">
              {normalized.map((g, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  Lote {i + 1}: {g.length} {g.length === 1 ? "veículo" : "veículos"}
                </Badge>
              ))}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={locked}
              onClick={() => {
                // Um lote vazio não sobrevive à normalização (e não deveria: uma
                // fatura sem veículo não cobra nada). O botão move o ÚLTIMO
                // veículo de um lote com mais de um para um lote novo — que é o
                // gesto que "separar mais" significa.
                const source = [...normalized].reverse().find((g) => g.length > 1);
                if (!source) return;
                setVehicleLot(source[source.length - 1], normalized.length + 1);
              }}
            >
              <IconPlus className="mr-1 h-3.5 w-3.5" />
              Novo lote
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
