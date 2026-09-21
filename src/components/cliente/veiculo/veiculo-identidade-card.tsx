// web/src/components/cliente/veiculo/veiculo-identidade-card.tsx
//
// A IDENTIDADE DO VEÍCULO — a metade da tela que o cliente vem CONSERTAR.
//
// Série, placa, chassi e número do pedido são os QUATRO dados que a Ankaa não
// tem como saber e o cliente tem na mão. Sem placa e chassi não sai NFS-e, não
// fecha faturamento e não se assina o documento — por isso esta metade é
// EDITÁVEL no lugar, e não um formulário em outra página.
//
// ⛔ ERAM CINCO, E A PLAQUETA SAIU (decisão do dono, 20/09): *"eles não precisam
// colocar a plaqueta, apenas os outros valores"*. A foto da plaqueta é trabalho
// de PÁTIO — quem a tira é a Ankaa, na entrada do veículo — e pedi-la ao contato
// transformava tarefa interna em pendência dele.
//
// O que ficou: a LEITURA. Existindo a foto, `PlaquetaLeitura` a mostra nas duas
// metades desta tela, clicável; não existindo, não há linha nenhuma — uma linha
// vazia rotulada "Plaqueta" é um pedido implícito, e um "não enviada" em âmber
// era a cobrança explícita.
//
// ⚠️ E A API NÃO MUDOU. `PATCH …/veiculos/:taskId/identificacao` segue aceitando
// `truckVinPlate` (multipart) e `vinPlateFileId` (corpo): isto é decisão de
// TELA. O que esta tela faz agora é OMITIR `vinPlateFileId` — no schema do
// servidor ele é `.nullable().optional()` e `null` quer dizer APAGUE A FOTO,
// então mandá-lo "vazio" a cada salvamento era o cliente escrevendo por acidente
// no que a Ankaa fotografou.
//
// O portão é `WRITE_VEHICLE_IDENTITY` (`utils/portal-capabilities.ts`): quem não
// o tem vê os mesmos dados em leitura. O recorte de interface NÃO é segurança —
// quem decide é o `@PortalCapability` da API.
//
// ⛔ E HÁ UM SEGUNDO PORTÃO, DENTRO DO PRIMEIRO: o NÚMERO DO PEDIDO DE COMPRA só
// é editável para quem tem `WRITE_PURCHASE_ORDER`. A API cobra esse sub-portão
// com 403; oferecer o campo a quem não o tem seria desenhar um botão que só
// sabe recusar.
//
// ⚠️ HOJE ESSE SUB-PORTÃO NÃO BARRA NINGUÉM, e é decisão do dono: os NOVE
// papéis têm `WRITE_PURCHASE_ORDER` ("todos os papéis podem definir o número de
// pedido; se não tiver, pelo menos o Compras fica impedido de assinar"). A
// exigência migrou inteira para o PORTÃO DA ASSINATURA
// (`purchase-order-gate.ts`), que é onde ela sempre pertenceu: a regra é sobre
// o ATO DE APROVAR, não sobre quem digita.
// O ramo de leitura abaixo fica de pé mesmo assim — ele é a defesa para o dia
// em que a tabela de capacidades voltar a estreitar, e custa quatro linhas.
//
// ─────────────────────────────────────────────────────────────────────────────
// ⛔ AS TRÊS RECUSAS, E POR QUE CADA UMA TEM TRATAMENTO PRÓPRIO
// ─────────────────────────────────────────────────────────────────────────────
// Esta é a única tela do portal em que o cliente escreve um dado que pode já
// estar IMPRESSO num documento assinado. As três respostas do servidor são
// perguntas diferentes e uma mensagem genérica ("confira os dados") responde
// errado às três:
//
//  1. **409 — o documento assinado.** O valor está impresso num PDF congelado,
//     que três pessoas leram e assinaram. Trocá-lo no cadastro faria a folha
//     passar a mentir, e por isso a API RECUSA em vez de invalidar uma coleta
//     que o contato não tem como refazer. Isto NÃO é erro de digitação e
//     insistir não resolve: é conversa com o comercial da Ankaa, que corrige o
//     cadastro e reemite o documento. Um toast de oito segundos com essa frase
//     seria a forma mais cara possível de contá-la — daí o painel fixo, que não
//     se fecha sozinho e fica ali enquanto o valor divergente estiver na tela.
//
//  2. **400 — unicidade.** `Task.serialNumber` e `Truck.plate` são `@unique`
//     GLOBAIS. A API recusa ANTES de escrever e manda `conflicts[]` NOMEANDO o
//     campo e o valor, exatamente para que a mensagem caia SOB O CAMPO culpado
//     em vez de virar um parágrafo genérico no rodapé. É erro de digitação, ou
//     o mesmo caminhão cadastrado duas vezes — dá para consertar ali.
//
//  3. **403 — o sub-portão do pedido.** Não deveria acontecer: o campo nem é
//     desenhado para quem não tem a capacidade. Se acontecer, os dois mapas de
//     capacidade (o do web e o da API) divergiram, e o texto diz isso em vez de
//     mandar a pessoa "tentar de novo" numa porta que vai recusar sempre.
//
// ⚠️ O interceptor de `api-client/portal.ts` já toasta os três. O que esta tela
// acrescenta é o que o toast não sabe fazer: ficar na tela, apontar o campo e
// explicar o que fazer a seguir. É a mesma doutrina do `pedido-compra-field`.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  IconAlertTriangle,
  IconDeviceFloppy,
  IconFileCertificate,
  IconId,
  IconLock,
  IconX,
} from "@tabler/icons-react";

import {
  portalErrorConflicts,
  portalErrorMessage,
  portalErrorStatus,
  usePortalUpdateVehicleIdentity,
} from "@/api-client/portal";
import { Button } from "@/components/ui/button";
import { DetailRow } from "@/components/ui/detail-row";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  CHASSIS_FORBIDDEN_LETTERS,
  CHASSIS_FORBIDDEN_LETTERS_MESSAGE,
  CHASSIS_INVALID_MESSAGE,
  CHASSIS_REGEX,
  PLATE_INVALID_MESSAGE,
  PLATE_REGEX,
  formatChassis,
  formatPlate,
} from "@/utils";
import { PortalCard, PortalRows } from "../portal-detail";

import { portalVinPlateThumbUrl, portalVinPlateUrl } from "./portal-file-url";
import type { PortalVehicleDetail, PortalVehicleIdentity } from "@/api-client/portal";
import { portalMissingIdentity } from "@/api-client/portal";

/**
 * AS DUAS MENSAGENS DO CHASSI SÃO DUAS PERGUNTAS DIFERENTES.
 *
 * "17 caracteres" responde a quem digitou de menos ou colou com espaço. Mas o
 * erro que realmente acontece é o outro: a ISO 3779 proíbe I, O e Q no VIN
 * justamente porque se confundem com 1 e 0, e quem lê a plaqueta em campo
 * escreve `O` onde está `0`. Dizer "17 caracteres" a esse caso manda a pessoa
 * conferir o TAMANHO, que está certo — e ela fica presa. A segunda mensagem diz
 * exatamente o que trocar.
 *
 * As duas, e as regexes, moram em `utils/truck.ts` — espelho de
 * `api/src/utils/truck.ts`. Nenhuma delas é redigitada aqui.
 */
const identidadeSchema = z
  .object({
    serialNumber: z.string().trim().max(120, "Número de série longo demais"),
    plate: z.string().trim(),
    chassisNumber: z.string().trim(),
    // ⚠️ TEXTO LIVRE, e é assim no banco: `Task.customerOrderNumber` é
    // `String?` com 100 de teto. Pedido de compra tem prefixo de ERP, barra,
    // ano — "PC-2026/8842" é um número de pedido tão legítimo quanto "8842".
    purchaseOrderNumber: z.string().trim().max(100, "Número do pedido longo demais"),
  })
  .superRefine((values, ctx) => {
    if (values.plate && !PLATE_REGEX.test(values.plate)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["plate"], message: PLATE_INVALID_MESSAGE });
    }

    if (values.chassisNumber) {
      if (CHASSIS_FORBIDDEN_LETTERS.test(values.chassisNumber)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["chassisNumber"],
          message: CHASSIS_FORBIDDEN_LETTERS_MESSAGE,
        });
      } else if (!CHASSIS_REGEX.test(values.chassisNumber)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["chassisNumber"],
          message: CHASSIS_INVALID_MESSAGE,
        });
      }
    }
  });

type IdentidadeFormData = z.infer<typeof identidadeSchema>;

/** Os campos que o servidor pode NOMEAR num `conflicts[]` e que existem aqui. */
const CAMPOS_MARCAVEIS = new Set<keyof IdentidadeFormData>([
  "serialNumber",
  "plate",
  "chassisNumber",
  "purchaseOrderNumber",
]);

/**
 * ⛔ AQUI MORAVAM `VIN_PLATE_ACCEPT`, `VIN_PLATE_MAX_SIZE` e
 * `toFileWithPreview` — o par de constantes e o adaptador que alimentavam um
 * campo de upload de plaqueta NESTA tela.
 *
 * Saíram por decisão do dono: **o cliente não é perguntado pela plaqueta.** Ele
 * informa série, placa, chassi e o número do pedido, e mais nada. A foto da
 * plaqueta é trabalho de pátio — quem a tira é a Ankaa, na entrada do veículo —
 * e pedi-la ao contato transformava uma tarefa interna numa pendência dele.
 *
 * O que NÃO saiu, e de propósito:
 *   · a LEITURA. Existindo a foto, ela continua visível e clicável nas duas
 *     metades desta tela (`PlaquetaLeitura`); o cliente pode olhar a plaqueta
 *     do caminhão dele.
 *   · o `truckVinPlate`/`vinPlateFileId` da API. `PATCH
 *     …/veiculos/:taskId/identificacao` segue aceitando os dois — isto é uma
 *     decisão de TELA, e arrancá-la do servidor quebraria o caminho interno e
 *     fecharia a porta para o dia em que a foto voltar a ser pedida.
 *
 * ⚠️ E a AUSÊNCIA da foto deixou de ser pendência em lugar nenhum: não conta em
 * `portalMissingIdentity` (nunca contou), não tinge linha, e a célula
 * "Plaqueta" da tabela virou travessão em vez do aviso âmbar "sem foto".
 */
/**
 * O NÚMERO DO PEDIDO VIVE EM DOIS LUGARES, e o da direita é o novo.
 *
 * `purchaseOrder.number` é a entidade (`PurchaseOrder`, 1..N veículos);
 * `customerOrderNumber` é a coluna LEGADA, que a NFS-e, o boleto e a regra de
 * atenção ainda leem. O servidor escreve as DUAS no mesmo `update` e elas têm de
 * concordar sempre — mas os caminhos antigos (`PUT /tasks/:id`, a grade em lote)
 * escrevem só a coluna. Ler a entidade primeiro e a coluna depois é o que mostra
 * o número certo nos dois estados.
 */
function pedidoDe(identity: PortalVehicleIdentity | null): string {
  return identity?.purchaseOrder?.number?.trim() || identity?.customerOrderNumber?.trim() || "";
}

function defaultsFrom(identity: PortalVehicleIdentity | null): IdentidadeFormData {
  return {
    serialNumber: identity?.serialNumber ?? "",
    plate: identity?.plate ?? "",
    chassisNumber: identity?.chassisNumber ?? "",
    purchaseOrderNumber: pedidoDe(identity),
  };
}

/** `""` some; o que vai para a API é `null` — é assim que se APAGA um valor. */
const orNull = (value: string): string | null => (value.trim() ? value.trim() : null);

interface VeiculoIdentidadeCardProps {
  veiculo: PortalVehicleDetail;
  /** `hasPortalCapability(roles, WRITE_VEHICLE_IDENTITY)` — decidido pela página. */
  canWrite: boolean;
  /**
   * `hasPortalCapability(roles, WRITE_PURCHASE_ORDER)` — o SUB-PORTÃO.
   *
   * Separado de `canWrite` porque são capacidades diferentes de papéis
   * diferentes: o gestor de frota tem a primeira e não a segunda.
   */
  canWriteOrder?: boolean;
  /** Publica o estado sujo para a guarda de navegação da página. */
  onDirtyChange?: (dirty: boolean) => void;
  /** Chamado depois de um salvamento bem-sucedido. */
  onSaved?: () => void;
}

export function VeiculoIdentidadeCard({
  veiculo,
  canWrite,
  canWriteOrder = false,
  onDirtyChange,
  onSaved,
}: VeiculoIdentidadeCardProps) {
  const mutation = usePortalUpdateVehicleIdentity();

  /**
   * ⚠️ A IDENTIDADE É UM GRUPO RECORTÁVEL, não campos soltos no veículo.
   *
   * `veiculo.identity` é `undefined` quando o contato não tem a seção `VEHICLE`
   * — e aí este card inteiro não faz sentido: não há o que ler nem o que
   * escrever. Quem decide não montá-lo é a PÁGINA; aqui o `null` garante que um
   * render intermediário não leia `undefined.serialNumber`.
   */
  const identity = veiculo.identity ?? null;
  const vinPlateFileId = identity?.vinPlate?.id ?? null;
  /** O número que o cadastro tem HOJE — a régua do "mudou?" e do "apagou?". */
  const pedidoAtual = pedidoDe(identity);

  const defaults = useMemo(() => defaultsFrom(identity), [identity]);

  const form = useForm<IdentidadeFormData>({
    resolver: zodResolver(identidadeSchema),
    defaultValues: defaults,
    mode: "onBlur",
  });

  /**
   * O 400 de unicidade já foi POSTO SOB OS CAMPOS?
   *
   * Sem esta marca, a mesma frase apareceria duas vezes: uma no campo e outra no
   * parágrafo de rodapé, que é o destino de todo erro que a tela não soube
   * atribuir a um controle.
   */
  const [marcadoNosCampos, setMarcadoNosCampos] = useState(false);

  // Reseeda quando o servidor manda outra versão do veículo (ou outro veículo).
  //
  // ⚠️ `vinPlateFileId` CONTINUA NA CHAVE mesmo sem campo de plaqueta: ele é a
  // metade da resposta do servidor que muda quando a Ankaa fotografa a plaqueta
  // no pátio, e é ele que faz a LEITURA da foto aparecer sem F5.
  const seededFor = useRef(`${veiculo.id}:${vinPlateFileId ?? ""}:${pedidoAtual}`);
  useEffect(() => {
    const key = `${veiculo.id}:${vinPlateFileId ?? ""}:${pedidoAtual}`;
    if (seededFor.current === key) return;
    seededFor.current = key;
    form.reset(defaultsFrom(identity));
  }, [veiculo.id, vinPlateFileId, pedidoAtual, identity, form]);

  // Sem a plaqueta, "sujo" é exatamente o que o `react-hook-form` sabe: os
  // quatro campos de texto. Era `|| vinPlateDirty` porque o arquivo vivia fora
  // do formulário.
  const isDirty = form.formState.isDirty;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const onSubmit = form.handleSubmit(async (values) => {
    const pedidoNovo = values.purchaseOrderNumber.trim();

    // ⛔ APAGAR O NÚMERO DO PEDIDO NÃO PASSA — e a recusa é DAQUI, não de um
    // 400 do servidor depois da viagem. O número é citado na NFS-e e no boleto;
    // a correção é informar o novo, não esvaziar o campo. Dizer isso ao lado do
    // controle é o que impede a pessoa de achar que salvou e apagou.
    if (canWriteOrder && pedidoAtual && !pedidoNovo) {
      form.setError("purchaseOrderNumber", {
        type: "manual",
        message:
          "O número do pedido não pode ser apagado pelo portal — ele é citado na nota fiscal e no boleto. " +
          "Para corrigi-lo, informe o número novo.",
      });
      return;
    }

    setMarcadoNosCampos(false);

    try {
      await mutation.mutateAsync({
        taskId: veiculo.id,
        data: {
          serialNumber: orNull(values.serialNumber),
          plate: orNull(values.plate),
          chassisNumber: orNull(values.chassisNumber),
          // ⛔ `vinPlateFileId` É OMITIDO, e a omissão é o ponto.
          //
          // No schema do servidor ele é `.nullable().optional()` e `gravar()`
          // só toca no caminhão quando a chave vem: `undefined` é "não mexa",
          // `null` é "APAGUE A FOTO". Esta tela mandava
          // `vinPlateFileId: existente ?? null` — ou seja, todo salvamento de
          // um veículo SEM foto mandava `null`, e todo salvamento de um COM
          // foto a reafirmava. Agora que o cliente não é dono desse campo,
          // reenviá-lo em qualquer forma seria ele escrever por acidente no que
          // a Ankaa fotografou.
          // ⚠️ SÓ QUANDO MUDOU, e nunca `null`.
          //
          // `undefined` é "não toque" e é o que este `...(cond ? {} : {})`
          // produz — reenviar o número que já está lá faria o servidor percorrer
          // a escrita DUPLA do pedido de compra (upsert + relink + a guarda do
          // documento assinado) para não mudar nada. E `null` seria o pedido de
          // APAGAR, que esta rota recusa com 400.
          ...(canWriteOrder && pedidoNovo && pedidoNovo !== pedidoAtual
            ? { purchaseOrderNumber: pedidoNovo }
            : {}),
        },
      });

      form.reset(values);
      onSaved?.();
    } catch (error) {
      // O interceptor de `api-client/portal.ts` JÁ toastou. O que fica na tela é
      // o tratamento abaixo, que o toast não sabe fazer: apontar o campo (400) e
      // ficar visível enquanto o valor divergente estiver ali (409).
      if (portalErrorStatus(error) === 400) {
        let marcou = false;
        for (const colisao of portalErrorConflicts(error)) {
          const campo = colisao.field as keyof IdentidadeFormData;
          if (!CAMPOS_MARCAVEIS.has(campo)) continue;
          form.setError(campo, {
            type: "server",
            // A frase do SERVIDOR quando ele mandou uma — ela nomeia o valor
            // culpado, e reescrevê-la aqui produziria duas redações da mesma
            // recusa (uma no toast, outra no campo) que divergiriam no primeiro
            // conserto de texto.
            message:
              colisao.message ??
              `${colisao.value ?? "Este valor"} já está cadastrado em outro veículo.`,
          });
          marcou = true;
        }
        setMarcadoNosCampos(marcou);
      }
    }
  });

  const handleCancel = useCallback(() => {
    form.reset(defaultsFrom(identity));
    setMarcadoNosCampos(false);
    // Limpa o painel do 409 junto: ele fala de um valor que não está mais na
    // tela, e deixá-lo aceso acusaria uma divergência já desfeita.
    mutation.reset();
  }, [form, identity, vinPlateFileId, mutation]);

  // O aviso do topo é sobre PLACA e CHASSI, não sobre série: são esses dois que
  // travam nota e entrega. Série faltando aparece na célula, e só.
  //
  // ⚠️ `portalMissingIdentity` devolve lista VAZIA sem a seção `VEHICLE` — não
  // saber é diferente de faltar, e o aviso só é honesto para quem enxerga os
  // campos.
  const bloqueando = portalMissingIdentity(veiculo).filter((campo) => campo !== "série");

  const erroStatus = mutation.isError ? portalErrorStatus(mutation.error) : 0;
  /** O 409 é o único que ganha painel fixo. Ver o cabeçalho deste arquivo. */
  const conflitoDocumento =
    erroStatus === 409
      ? portalErrorMessage(
          mutation.error,
          "Este dado já consta do documento em assinatura e não pode ser alterado por aqui.",
        )
      : null;

  return (
    <PortalCard
      icon={IconId}
      title="Identificação"
      actions={
        !canWrite ? (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <IconLock className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Somente leitura
          </span>
        ) : undefined
      }
      contentClassName="space-y-4"
    >
        {/* ⛔ O PAINEL DO DOCUMENTO ASSINADO — fixo, no TOPO, sem botão de
            fechar. Fica acima dos campos porque é ele que explica por que o
            valor que a pessoa digitou não entrou; embaixo, ela salvaria de novo
            antes de ler. A única saída é corrigir o valor ou desfazer — e as
            duas coisas o fazem sumir. */}
        {conflitoDocumento && (
          <div
            role="alert"
            aria-live="assertive"
            className="space-y-3 rounded-lg border-2 border-destructive bg-destructive/10 p-4"
          >
            <div className="flex items-start gap-3">
              <IconFileCertificate
                className="mt-0.5 h-5 w-5 shrink-0 text-destructive"
                aria-hidden
              />
              <div className="space-y-2">
                <p className="text-base font-semibold text-destructive">
                  Este dado já está no documento assinado
                </p>
                {/* A frase do servidor NOMEIA o campo, o valor impresso, o que
                    foi enviado e quem procurar. Resumi-la aqui tiraria
                    exatamente o que a torna acionável. */}
                <p className="text-sm text-destructive">{conflitoDocumento}</p>
                <p className="text-sm text-muted-foreground">
                  Nada foi alterado: o cadastro continua igual ao que o documento imprime. Isto
                  não é falha da tela e tentar de novo devolve a mesma resposta — mudar um dado
                  que já foi assinado precisa do comercial da Ankaa, que corrige o cadastro e
                  reemite o documento para assinatura.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="button" variant="outline" size="sm" onClick={handleCancel}>
                Voltar aos valores do documento
              </Button>
            </div>
          </div>
        )}

        {bloqueando.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
            <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>
              {bloqueando.length === 2
                ? "Este veículo ainda está sem placa e sem chassi."
                : `Este veículo ainda está sem ${bloqueando[0]}.`}{" "}
              {canWrite
                ? "Informe os dados abaixo para liberar a emissão da nota e a entrega."
                : "Peça a quem cuida da frota na sua empresa para informar esses dados."}
            </p>
          </div>
        )}

        {canWrite ? (
          <Form {...form}>
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="serialNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Número de série</FormLabel>
                      <FormControl>
                        {/* ⚠️ TEXTO. Há série com letra, e o campo é `String` no
                            banco — um `type="number"` comeria zeros à esquerda. */}
                        <Input
                          type="text"
                          value={field.value}
                          onChange={(value) => field.onChange(typeof value === "string" ? value : "")}
                          onBlur={field.onBlur}
                          name={field.name}
                          placeholder="Ex.: 1042"
                          disabled={mutation.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="plate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Placa</FormLabel>
                      <FormControl>
                        {/* A máscara é POSICIONAL e cobre os dois padrões
                            brasileiros (antigo AAA9999 e Mercosul AAA9A99) sem
                            travar no 4º caractere. ⚠️ O valor que SAI é LIMPO —
                            o hífen de `formatPlate` é só exibição. */}
                        <Input
                          type="plate"
                          value={field.value}
                          onChange={(value) => field.onChange(typeof value === "string" ? value : "")}
                          onBlur={field.onBlur}
                          name={field.name}
                          disabled={mutation.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="chassisNumber"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel className="text-sm">Chassi</FormLabel>
                      <FormControl>
                        <Input
                          type="chassis"
                          value={field.value}
                          onChange={(value) => field.onChange(typeof value === "string" ? value : "")}
                          onBlur={field.onBlur}
                          name={field.name}
                          disabled={mutation.isPending}
                        />
                      </FormControl>
                      <FormDescription>
                        17 caracteres. A norma do VIN não usa as letras I, O e Q — onde
                        parecerem, são os dígitos 1 e 0.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* ⛔ O SUB-PORTÃO — some o CAMPO, nunca o DADO.
                    Saber o número é diferente de poder escrevê-lo: esconder o
                    número de quem não o emite faria o gestor de frota achar que
                    o veículo está sem pedido e abrir chamado por causa disso. */}
                {!canWriteOrder && pedidoAtual && (
                  <div className="space-y-1 sm:col-span-2">
                    <p className="text-sm text-muted-foreground">Número do pedido de compra</p>
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {pedidoAtual}
                      {/* ⚠️ A FRASE NÃO NOMEIA MAIS UM PAPEL. Ela dizia "quem
                          altera é o Compras da sua empresa", o que deixou de
                          ser verdade quando os nove papéis ganharam a
                          capacidade — e uma tela que explica uma trava citando
                          a pessoa errada manda o cliente ligar para quem não
                          pode ajudá-lo. Agora ela diz o que é sempre
                          verdadeiro: este perfil não altera este número. */}
                      <span className="inline-flex items-center gap-1 text-sm font-normal text-muted-foreground">
                        <IconLock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        seu perfil de contato não altera este número
                      </span>
                    </p>
                  </div>
                )}

                {canWriteOrder && (
                  <FormField
                    control={form.control}
                    name="purchaseOrderNumber"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel className="text-sm">Número do pedido de compra</FormLabel>
                        <FormControl>
                          {/* ⚠️ TEXTO LIVRE, sem máscara: "PC-2026/8842" é um
                              número de pedido tão legítimo quanto "8842". */}
                          <Input
                            type="text"
                            value={field.value}
                            onChange={(value) =>
                              field.onChange(typeof value === "string" ? value : "")
                            }
                            onBlur={field.onBlur}
                            name={field.name}
                            placeholder="Ex.: 8842"
                            autoComplete="off"
                            disabled={mutation.isPending}
                          />
                        </FormControl>
                        <FormDescription>
                          É este número que a nota fiscal e o boleto citam. Informar o mesmo
                          número em vários veículos é o normal — eles passam a fazer parte do
                          mesmo pedido. Para corrigi-lo, informe o número novo: ele não pode ser
                          apagado por aqui.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* ⛔ AQUI HAVIA O CAMPO DE UPLOAD DA PLAQUETA, e ele saiu:
                  o cliente preenche série, placa, chassi e o número do
                  pedido — mais nada. A foto é trabalho de pátio da Ankaa.
                  Existindo, ela continua VISÍVEL logo abaixo; não existindo,
                  não há linha nenhuma, porque uma linha vazia num formulário é
                  um pedido implícito. */}
              <PlaquetaLeitura identity={identity} />

              {/* ⚠️ O RODAPÉ É O QUE SOBRA — e sobra pouco, de propósito.
                  O 409 já está no painel do topo e o 400 de unicidade já está
                  SOB o campo culpado; repetir qualquer um dos dois aqui seria a
                  mesma frase duas vezes na mesma tela. */}
              {mutation.isError && !conflitoDocumento && !marcadoNosCampos && (
                <p className="text-sm text-destructive" role="alert">
                  {erroStatus === 403
                    ? // ⛔ NÃO DEVERIA ACONTECER: o campo do pedido nem é
                      // desenhado sem a capacidade. Se chegou aqui, o mapa do
                      // web e o da API divergiram — e mandar "tente de novo"
                      // seria mandar bater numa porta que recusa sempre.
                      portalErrorMessage(
                        mutation.error,
                        "Seu perfil de contato não permite esta alteração.",
                      ) +
                      " Os demais dados podem ser salvos normalmente; para o número do pedido, fale com o comercial da Ankaa."
                    : portalErrorMessage(
                        mutation.error,
                        "Não foi possível salvar a identificação. Confira os dados e tente de novo.",
                      )}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={!isDirty || mutation.isPending}
                >
                  <IconX className="mr-2 h-4 w-4" aria-hidden />
                  Descartar
                </Button>
                <Button type="submit" disabled={!isDirty || mutation.isPending}>
                  <IconDeviceFloppy className="mr-2 h-4 w-4" aria-hidden />
                  {mutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </form>
          </Form>
        ) : (
          <IdentidadeSomenteLeitura identity={identity} />
        )}
    </PortalCard>
  );
}

/**
 * A PLAQUETA, SÓ PARA LER — e só quando ela existe.
 *
 * ⛔ Sem foto não há linha. A versão anterior desenhava "Plaqueta — não
 * enviada" em âmbar, que é a cobrança que o dono mandou tirar: o cliente não é
 * perguntado pela plaqueta, e um rótulo com "não enviada" ao lado diz o
 * contrário em toda frota que a Ankaa ainda não fotografou.
 *
 * ⚠️ `href` abre o arquivo inteiro; `src` desenha a miniatura. A foto vem de um
 * celular e pesa megabytes — aqui ela aparece a 64 px de altura.
 *
 * Usada nas DUAS metades (editando e em leitura), porque nas duas a plaqueta é
 * a mesma coisa: algo que se olha, nunca algo que se preenche.
 */
function PlaquetaLeitura({ identity }: { identity: PortalVehicleIdentity | null }) {
  const vinPlateFileId = identity?.vinPlate?.id ?? null;
  const plaqueta = portalVinPlateUrl(vinPlateFileId);
  const plaquetaThumb = portalVinPlateThumbUrl(vinPlateFileId);
  if (!plaqueta) return null;

  return (
    <DetailRow
      label="Plaqueta"
      value={
        <a
          href={plaqueta}
          target="_blank"
          rel="noreferrer"
          className="block overflow-hidden rounded-md border border-border"
        >
          <img
            src={plaquetaThumb}
            alt="Plaqueta do veículo"
            loading="lazy"
            className="h-16 w-auto max-w-[12rem] object-cover"
          />
        </a>
      }
    />
  );
}

/**
 * A METADE DE LEITURA — em `DetailRow`, a linha rótulo/valor da casa.
 *
 * ⛔ ERA UMA LINHA PRÓPRIA (`flex justify-between` com `border-b`), inventada
 * neste arquivo: fundo nenhum, divisória em vez de bloco, e um amarelo próprio
 * para o valor faltando. `ui/detail-row.tsx` é o que TODA tela de detalhe desta
 * casa usa, importa só `react` + `cn` (seguro fora do `AuthProvider`) e já traz
 * o `—` itálico do vazio.
 *
 * ⚠️ O FALTANDO CONTINUA EM ÂMBAR, e continua sendo texto e não traço: "não
 * informado" num campo que trava nota e entrega é uma PENDÊNCIA do cliente, e
 * apagá-la num traço neutro esconderia dele o que só ele pode resolver.
 */
function ValorFaltando({ label }: { label: string }) {
  return <span className="font-normal text-amber-700 dark:text-amber-400">{label}</span>;
}

function IdentidadeSomenteLeitura({ identity }: { identity: PortalVehicleIdentity | null }) {
  return (
    <PortalRows>
      <DetailRow
        label="Número de série"
        value={
          identity?.serialNumber ? (
            <span className="tabular-nums">{identity.serialNumber}</span>
          ) : (
            <ValorFaltando label="não informado" />
          )
        }
      />
      <DetailRow
        label="Placa"
        value={
          identity?.plate ? (
            <span className="tabular-nums">{formatPlate(identity.plate)}</span>
          ) : (
            <ValorFaltando label="não informada" />
          )
        }
      />
      <DetailRow
        label="Chassi"
        value={
          identity?.chassisNumber ? (
            <span className="tabular-nums">{formatChassis(identity.chassisNumber)}</span>
          ) : (
            <ValorFaltando label="não informado" />
          )
        }
      />
      {identity?.customerOrderNumber ? (
        <DetailRow label="Pedido do cliente" value={identity.customerOrderNumber} />
      ) : null}
      {identity?.purchaseOrder?.number ? (
        <DetailRow label="Pedido de compra" value={identity.purchaseOrder.number} />
      ) : null}

      <PlaquetaLeitura identity={identity} />
    </PortalRows>
  );
}
