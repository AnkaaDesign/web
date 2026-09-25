import { useState } from "react";
import { IconTruck, IconLoader2, IconCheck } from "@tabler/icons-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTaskMutations } from "@/hooks/production/use-task";
import { toast } from "@/components/ui/sonner";

export interface CoveredVehicle {
  id: string;
  name?: string | null;
  serialNumber?: string | null;
  customerOrderNumber?: string | null;
  implement?: { plate?: string | null; chassisNumber?: string | null } | null;
}

interface Props {
  /** Os veículos que ESTA cobrança cobre — não os do orçamento. */
  vehicles: CoveredVehicle[];
  /** Trava DURA: quem abriu a tela não pode escrever em tarefa nenhuma. */
  disabled?: boolean;
  /** A cobrança já foi aprovada — muda o AVISO, não o direito de escrever. */
  approved?: boolean;
}

/**
 * OS VEÍCULOS QUE ESTA COBRANÇA COBRA — e por que eles precisam ser editáveis aqui.
 *
 * A queixa que originou este bloco, nas palavras do dono: "na tela de detalhe de
 * faturamento o primeiro passo é para corrigir valores da tarefa, mas só é
 * possível de uma tarefa".
 *
 * Era verdade, e era estrutural. A tela abria por UM veículo e o passo "Tarefa"
 * editava aquele; os outros três da mesma fatura não tinham onde ser corrigidos
 * — mas placa, chassi e número do pedido dos QUATRO vão sair na MESMA nota
 * fiscal. Quem vai emiti-la precisava sair da tela, abrir cada caminhão pelo
 * módulo de produção e voltar.
 *
 * Então o recorte deste bloco é exatamente o recorte do documento: os veículos
 * desta cobrança, com os três campos que a NFS-e exige. Não é a frota do
 * orçamento — é o que esta fatura vai dizer.
 *
 * ⚠️ NÃO SE TRAVA DEPOIS DA APROVAÇÃO, e isso é decisão, não esquecimento.
 *
 * Os três campos chegam TARDE por natureza. O número do pedido de compra é o caso
 * puro: a API o deixou de fora de `enforceNestedQuoteGuards` justamente porque ele
 * aparece depois de o orçamento fechar — travá-lo na tela desfaz de propósito o que
 * o servidor abriu de propósito. Placa e chassi são a identidade do caminhão: um
 * chassi digitado errado continua errado no cadastro depois da aprovação, e o
 * conserto é aqui.
 *
 * O que a aprovação muda é o AVISO, não o direito: a nota autorizada e o boleto
 * registrado não se reescrevem, e o cartão passa a dizer isso. Trocar o aviso por
 * um `disabled` não protegia documento nenhum — só obrigava quem emite a sair da
 * tela, abrir cada caminhão em Produção e voltar.
 *
 * GRAVA CAMPO A CAMPO, ao sair do campo. Não entra no formulário da página: o
 * `PUT /tasks/:id` da gravação principal é do veículo ABERTO, e pendurar os
 * irmãos ali faria um "Salvar" da cobrança 1 escrever em caminhões que ela nem
 * mostra. Uma linha, uma escrita, um alvo.
 */
/**
 * ONDE CADA CAMPO MORA NO CORPO DO `PUT /tasks/:id` — e por que isso não é detalhe.
 *
 * `customerOrderNumber` é campo de PRIMEIRO NÍVEL da tarefa. `plate` e
 * `chassisNumber` **não são**: pertencem ao caminhão, e o zod da API os declara
 * dentro de `truck` (`api/src/schemas/task.ts`, `taskTruckSchema`).
 *
 * ⚠️ O defeito que isto conserta: a grade mandava os três no topo, com um `as any`
 * calando o compilador. `taskUpdateSchema` não é `.strict()`, então o zod
 * **descartava** placa e chassi em silêncio — a API respondia 200, o ✓ verde
 * aparecia na célula, e nada era gravado. Quem corrigia a placa antes de aprovar
 * via a confirmação, aprovava, e a NFS-e saía com a placa velha. Zod não-strict
 * não recusa campo fora do lugar: ele APAGA.
 */
const payloadFor = (
  field: "plate" | "chassisNumber" | "customerOrderNumber",
  value: string | null,
): Record<string, unknown> =>
  field === "customerOrderNumber" ? { customerOrderNumber: value } : { implement: { [field]: value } };

export function BillingCoveredVehicles({ vehicles, disabled, approved }: Props) {
  const { updateAsync } = useTaskMutations();
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  // Vale TAMBÉM com um veículo só. Esta grade é o único lugar da tela de
  // cobrança onde placa, chassi e pedido se editam — o formulário de tarefa que
  // duplicava esses campos foi removido, e some-la aqui deixaria o caso simples
  // (um orçamento, um caminhão) sem onde corrigir o que vai na nota.
  if (vehicles.length === 0) return null;

  const commit = async (
    taskId: string,
    field: "plate" | "chassisNumber" | "customerOrderNumber",
    raw: string,
    current: string,
  ) => {
    const next = raw.trim();
    if (next === (current ?? "").trim()) return;
    const key = `${taskId}:${field}`;
    setSaving(key);
    try {
      await updateAsync({ id: taskId, data: payloadFor(field, next || null) });
      setSaved(key);
      setTimeout(() => setSaved((k) => (k === key ? null : k)), 2000);
    } catch {
      // O interceptor já avisou; devolver o foco seria pior que deixar o valor.
      toast.error("Não foi possível gravar. O valor anterior continua valendo.");
    } finally {
      setSaving((k) => (k === key ? null : k));
    }
  };

  const cell = (
    v: CoveredVehicle,
    field: "plate" | "chassisNumber" | "customerOrderNumber",
    value: string,
    placeholder: string,
  ) => {
    const key = `${v.id}:${field}`;
    return (
      <div className="relative">
        <Input
          defaultValue={value}
          placeholder={placeholder}
          disabled={disabled}
          className="bg-transparent h-9"
          onBlur={(e: any) => commit(v.id, field, String(e?.target?.value ?? ""), value)}
        />
        {saving === key && (
          <IconLoader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {saved === key && (
          <IconCheck className="absolute right-2 top-2.5 h-4 w-4 text-green-600" />
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <IconTruck className="h-4 w-4 text-muted-foreground" />
          Veículos desta cobrança
          <Badge variant="secondary" className="ml-1">
            {vehicles.length}
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Placa, chassi e número do pedido de cada um saem na mesma nota fiscal.
        </p>
        {approved && (
          <p className="text-xs text-amber-700 dark:text-amber-500">
            Esta cobrança já foi aprovada: a nota fiscal e o boleto que já saíram continuam com os
            dados antigos. Corrigir aqui acerta o cadastro do veículo — para o documento emitido é
            preciso retificação.
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[22%]">Veículo</TableHead>
                <TableHead className="w-[26%]">Placa</TableHead>
                <TableHead className="w-[26%]">Chassi</TableHead>
                <TableHead className="w-[26%]">Nº do Pedido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicles.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="whitespace-nowrap font-medium tabular-nums">
                    {v.serialNumber || v.implement?.plate || v.name || v.id.slice(0, 8)}
                  </TableCell>
                  <TableCell>{cell(v, "plate", v.implement?.plate ?? "", "ABC-1D23")}</TableCell>
                  <TableCell>
                    {cell(v, "chassisNumber", v.implement?.chassisNumber ?? "", "17 caracteres")}
                  </TableCell>
                  <TableCell>
                    {cell(v, "customerOrderNumber", v.customerOrderNumber ?? "", "PED-0000")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
