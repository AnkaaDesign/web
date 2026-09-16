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
  truck?: { plate?: string | null; chassisNumber?: string | null } | null;
}

interface Props {
  /** Os veículos que ESTA cobrança cobre — não os do orçamento. */
  vehicles: CoveredVehicle[];
  disabled?: boolean;
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
 * desta cobrança, com os três campos que a NFS-e exige, editáveis até a
 * aprovação. Não é a frota do orçamento — é o que esta fatura vai dizer.
 *
 * GRAVA CAMPO A CAMPO, ao sair do campo. Não entra no formulário da página: o
 * `PUT /tasks/:id` da gravação principal é do veículo ABERTO, e pendurar os
 * irmãos ali faria um "Salvar" da cobrança 1 escrever em caminhões que ela nem
 * mostra. Uma linha, uma escrita, um alvo.
 */
export function BillingCoveredVehicles({ vehicles, disabled }: Props) {
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
      await updateAsync({ id: taskId, data: { [field]: next || null } as any });
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
          Placa, chassi e número do pedido de cada um saem na mesma nota fiscal. Corrija-os
          aqui até a aprovação — depois dela o documento já está emitido.
        </p>
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
                    {v.serialNumber || v.truck?.plate || v.name || v.id.slice(0, 8)}
                  </TableCell>
                  <TableCell>{cell(v, "plate", v.truck?.plate ?? "", "ABC-1D23")}</TableCell>
                  <TableCell>
                    {cell(v, "chassisNumber", v.truck?.chassisNumber ?? "", "17 caracteres")}
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
