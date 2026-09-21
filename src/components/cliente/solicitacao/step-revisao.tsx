// web/src/components/cliente/solicitacao/step-revisao.tsx
//
// PASSO 5 — O RESUMO, E O QUE ELE DELIBERADAMENTE NÃO TEM.
//
// ⛔ NÃO HÁ PREÇO EM LUGAR NENHUM DESTA TELA, e isso não é recorte de papel: é
// o que uma requisição É. Ela nasce `Budget{ subtotal: 0, total: 0 }` e SEM
// nenhum `BudgetItem` — serviço e valor são do comercial, e inventar aqui um
// "valor estimado" criaria a expectativa de um número que a Ankaa não deu.
//
// O que este passo faz é a última conferência do que VAI SER ENVIADO: a mesma
// lista de veículos, na mesma ordem, e a medida do implemento que vale para
// TODOS eles.
//
// ⚠️ A medida aparece UMA VEZ, num cartão próprio, e não numa coluna da tabela
// de veículos. Repeti-la em cada linha diria que ela é da linha — e ela não é:
// é da requisição, e o envio a copia para cada veículo
// (`buildSolicitacaoPayload`). A frase "aplicadas aos N veículos" está ali para
// que a conferência final não deixe dúvida sobre isso.
import type { ReactNode } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import {
  IconBuildingStore,
  IconCar,
  IconDoor,
  IconFileInvoice,
  IconMessage2,
  IconPaint,
  IconPaperclip,
  IconRuler2,
} from "@tabler/icons-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { DetailRow } from "@/components/ui/detail-row";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCNPJ, formatCPF, formatChassis, formatPlate } from "@/utils";
import { PAINT_FINISH_LABELS } from "@/constants";
import type { PAINT_FINISH } from "@/constants";
import type { FileWithPreview } from "@/components/common/file";
import type { PortalCustomerOption, PortalPaintOption } from "./solicitacao-api";
import {
  LADO_DO_IMPLEMENTO,
  NOVA_TINTA_VALUE,
  NOVO_CLIENTE_VALUE,
  ROTULO_DO_LADO,
  type LadoImplemento,
  type SolicitacaoFormData,
} from "./solicitacao-schema";

interface StepRevisaoProps {
  /** Nomes já vistos pelos comboboxes — ver `onOptionsSeen`. */
  customers: Map<string, PortalCustomerOption>;
  paints: Map<string, PortalPaintOption>;
  baseFiles: FileWithPreview[];
}

/**
 * Uma linha rótulo/valor — a MESMA das telas de detalhe.
 *
 * ⛔ ERA UMA LINHA PRÓPRIA, inventada aqui: `flex justify-between` com
 * `border-b`. Fundo nenhum, divisória em vez de bloco — e o dono viu o
 * resultado lado a lado com o detalhe do orçamento: no resumo da requisição os
 * campos "somem" no cinza, porque nada os delimita. `ui/detail-row.tsx` é o que
 * TODA tela de detalhe desta casa usa, importa só `react` + `cn` (seguro fora
 * do `AuthProvider`, que é o requisito do portal) e já traz o `—` itálico do
 * vazio.
 *
 * É a mesma correção que `portal-detail.tsx` já tinha feito nos cards do
 * portal; este arquivo tinha ficado para trás.
 */
function Linha({ rotulo, valor }: { rotulo: string; valor: ReactNode }) {
  return <DetailRow label={rotulo} value={valor} />;
}

const vazio = <span className="font-normal text-muted-foreground">Não informado</span>;

const LADOS: readonly LadoImplemento[] = ["left", "right", "back"];

/**
 * Centímetro inteiro → metro com vírgula, como o `ImplementMeasureForm` escreve.
 *
 * ⚠️ DIVIDE SÓ PARA MOSTRAR. O valor guardado segue em centímetros e é ele que
 * viaja no payload — esta função não toca no que é enviado.
 */
function emMetros(cm: number | null | undefined): string {
  if (typeof cm !== "number" || !Number.isFinite(cm)) return "—";
  return `${(cm / 100).toFixed(2).replace(".", ",")} m`;
}

export function SolicitacaoStepRevisao({ customers, paints, baseFiles }: StepRevisaoProps) {
  const { control } = useFormContext<SolicitacaoFormData>();
  const values = useWatch({ control }) as Partial<SolicitacaoFormData>;

  const novoCliente = values.novoCliente;
  const clienteServico =
    values.customerId && values.customerId !== NOVO_CLIENTE_VALUE
      ? customers.get(values.customerId)
      : undefined;
  const pagador = values.faturarParaCustomerId
    ? customers.get(values.faturarParaCustomerId)
    : undefined;

  const novaTinta = values.novaTinta;
  const tinta =
    values.paintId && values.paintId !== NOVA_TINTA_VALUE ? paints.get(values.paintId) : undefined;

  const documentoDe = (c?: { cnpj?: string | null; cpf?: string | null }) =>
    c?.cnpj ? formatCNPJ(c.cnpj) : c?.cpf ? formatCPF(c.cpf) : null;

  const veiculos = (values.veiculos ?? []) as SolicitacaoFormData["veiculos"];
  const veiculosPreenchidos = veiculos.filter(
    (row) => row?.serialNumber?.trim() || row?.plate?.trim() || row?.chassisNumber?.trim(),
  );

  const medidas = values.medidas;
  const temMedidas = !!medidas && LADOS.some((l) => !!medidas[LADO_DO_IMPLEMENTO[l]]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconBuildingStore className="h-5 w-5" />
            Cliente do serviço
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {novoCliente ? (
            <>
              <Linha
                rotulo="Cliente"
                valor={
                  <span className="inline-flex items-center gap-2">
                    {novoCliente.fantasyName}
                    <Badge variant="secondary">Novo cadastro</Badge>
                  </span>
                }
              />
              {novoCliente.corporateName && (
                <Linha rotulo="Razão social" valor={novoCliente.corporateName} />
              )}
              <Linha rotulo="Documento" valor={documentoDe(novoCliente) ?? vazio} />
              {novoCliente.city && (
                <Linha
                  rotulo="Cidade"
                  valor={`${novoCliente.city}${novoCliente.state ? ` / ${novoCliente.state}` : ""}`}
                />
              )}

              {/* ⛔ O AVISO QUE EVITA O CADASTRO EM DOBRO.
                  Documento que já existe não é mais recusa: a requisição passa a
                  correr sob o cadastro que a Ankaa já tem — que pode ter OUTRO
                  nome fantasia e nem aparecer na lista deste contato, porque o
                  escopo do portal não alcança todo cliente da Ankaa. Dizer isto
                  AQUI, antes do envio, é o que impede a reação errada quando o
                  orçamento aparecer com um nome diferente do digitado. Depois do
                  envio o `ClienteReaproveitadoDialog` nomeia o cadastro de fato
                  usado. */}
              <Alert variant="default" className="mt-3">
                <AlertDescription>
                  Se este {novoCliente.cnpj ? "CNPJ" : novoCliente.cpf ? "CPF" : "documento"} já
                  estiver cadastrado na Ankaa, usaremos o cadastro que já existe em vez de criar
                  outro — e avisamos sob que nome a requisição ficou. Nenhum dado do cadastro
                  existente é alterado.
                </AlertDescription>
              </Alert>
            </>
          ) : (
            <>
              <Linha
                rotulo="Cliente"
                valor={clienteServico?.fantasyName ?? clienteServico?.corporateName ?? vazio}
              />
              <Linha rotulo="Documento" valor={documentoDe(clienteServico) ?? vazio} />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconFileInvoice className="h-5 w-5" />
            Faturar para
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          <Linha
            rotulo="Cliente a faturar"
            valor={pagador?.fantasyName ?? pagador?.corporateName ?? vazio}
          />
          <Linha rotulo="Documento" valor={documentoDe(pagador) ?? vazio} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconMessage2 className="h-5 w-5" />
            O que você pediu
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <p className="whitespace-pre-wrap text-sm">{values.briefing?.trim() || "—"}</p>
          <Linha rotulo="Logomarca" valor={values.logoName?.trim() || vazio} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <IconCar className="h-5 w-5" />
              Veículos
            </CardTitle>
            <Badge variant="secondary">
              {veiculosPreenchidos.length}{" "}
              {veiculosPreenchidos.length === 1 ? "veículo" : "veículos"}
            </Badge>
          </div>
          <CardDescription>
            Cada linha é um veículo. A medida do implemento é a MESMA para todos e está no
            cartão abaixo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {veiculosPreenchidos.length === 0 ? (
            <EmptyState
              title="Nenhum veículo informado"
              description="Volte ao passo de veículos e informe ao menos a série, a placa ou o chassi."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Série</th>
                    <th className="py-2 pr-3 font-medium">Placa</th>
                    <th className="py-2 font-medium">Chassi</th>
                  </tr>
                </thead>
                <tbody>
                  {veiculosPreenchidos.map((row, index) => (
                    <tr key={row.uid ?? index} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-3">{row.serialNumber?.trim() || "—"}</td>
                      <td className="py-2 pr-3">
                        {row.plate?.trim() ? formatPlate(row.plate) : "—"}
                      </td>
                      <td className="py-2 font-mono text-sm">
                        {row.chassisNumber?.trim() ? formatChassis(row.chassisNumber) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <IconRuler2 className="h-5 w-5" />
              Medidas do implemento
            </CardTitle>
            {temMedidas && (
              <Badge variant="secondary">
                {veiculosPreenchidos.length === 1
                  ? "Aplicadas ao veículo"
                  : `Aplicadas aos ${veiculosPreenchidos.length} veículos`}
              </Badge>
            )}
          </div>
          <CardDescription>
            Uma medida só, a mesma para todos os veículos desta requisição.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {!temMedidas ? (
            <p className="text-sm text-muted-foreground">
              Você não informou as medidas. O implemento é medido na entrada do veículo.
            </p>
          ) : (
            <div className="space-y-3">
              {LADOS.map((l) => {
                const lado = medidas?.[LADO_DO_IMPLEMENTO[l]];
                const secoes = lado?.sections ?? [];
                const comprimento = secoes.reduce((soma, s) => soma + (s?.width || 0), 0);
                const portas = secoes.filter((s) => s?.isDoor).length;
                return (
                  <div
                    key={l}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border/60 py-2 last:border-0"
                  >
                    <span className="text-sm text-muted-foreground">{ROTULO_DO_LADO[l]}</span>
                    {lado ? (
                      <span className="flex flex-wrap items-center gap-x-3 text-sm font-medium">
                        <span>Altura {emMetros(lado.height)}</span>
                        <span>Comprimento {emMetros(comprimento)}</span>
                        {portas > 0 && (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <IconDoor className="h-4 w-4" />
                            {portas} {portas === 1 ? "porta" : "portas"}
                          </span>
                        )}
                      </span>
                    ) : (
                      vazio
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconPaint className="h-5 w-5" />
            Pintura geral
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {novaTinta ? (
            <>
              <Linha
                rotulo="Cor"
                valor={
                  <span className="inline-flex items-center gap-2">
                    <span
                      aria-hidden
                      className="h-4 w-4 rounded ring-1 ring-border"
                      style={{ backgroundColor: novaTinta.hex }}
                    />
                    {novaTinta.name}
                    <Badge variant="secondary">Novo cadastro</Badge>
                  </span>
                }
              />
              <Linha
                rotulo="Acabamento"
                valor={PAINT_FINISH_LABELS[novaTinta.finish as PAINT_FINISH] ?? novaTinta.finish}
              />
            </>
          ) : tinta ? (
            <>
              <Linha
                rotulo="Cor"
                valor={
                  <span className="inline-flex items-center gap-2">
                    <span
                      aria-hidden
                      className="h-4 w-4 rounded ring-1 ring-border"
                      style={{ backgroundColor: tinta.hex || "#888888" }}
                    />
                    {tinta.name}
                  </span>
                }
              />
              {tinta.finish && (
                <Linha
                  rotulo="Acabamento"
                  valor={PAINT_FINISH_LABELS[tinta.finish as PAINT_FINISH] ?? tinta.finish}
                />
              )}
            </>
          ) : (
            <Linha rotulo="Cor" valor={vazio} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <IconPaperclip className="h-5 w-5" />
              Arquivos-base
            </CardTitle>
            <Badge variant="secondary">
              {baseFiles.length} {baseFiles.length === 1 ? "arquivo" : "arquivos"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {baseFiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum arquivo anexado.</p>
          ) : (
            <ul className="space-y-1">
              {baseFiles.map((file, index) => (
                <li key={`${file.name}-${index}`} className="truncate text-sm">
                  {file.name}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* A frase que fecha a tela. Ela existe porque a ausência de preço tem de
          ser lida como INTENÇÃO, e não como campo que faltou carregar. */}
      <p className="px-1 text-sm text-muted-foreground">
        Esta é uma requisição: ela não tem valores. O comercial da Ankaa monta o orçamento a
        partir do que você descreveu e devolve os preços para a sua aprovação.
      </p>
    </div>
  );
}
