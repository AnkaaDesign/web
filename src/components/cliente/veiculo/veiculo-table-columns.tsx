// web/src/components/cliente/veiculo/veiculo-table-columns.tsx
//
// AS COLUNAS DA FROTA DO CLIENTE.
//
// ⚠️ `id` SEM PONTO. O motor da DataTable transforma o id em custom property CSS
// (`--col-<id>-size`) e em chave de persistência; um `truck.plate` viraria uma
// variável que o navegador descarta em silêncio e a coluna perderia a largura
// salva. Por isso `plate`, e não `truck.plate`.
//
// ⚠️ OS DADOS MORAM EM GRUPOS RECORTÁVEIS. `row.identity` é `undefined` quando o
// contato não tem a seção `VEHICLE`; `row.progress` é `undefined` sem `DELIVERY`.
// Essa é a diferença entre "este caminhão não tem placa" e "você não vê placa
// nenhuma" — e é por isso que as colunas de identidade só existem quando o
// recorte as libera (a página decide, ver `createPortalVeiculoColumns`). Ler
// `row.plate` (a forma plana antiga) devolvia `undefined` nos dois casos e a
// tela pintava um aviso âmbar de "sem placa" para uma frota inteira que tem
// placa.
//
// O QUE ESTA TABELA NÃO TEM, e é de propósito (§9 do CONTRATO): nenhuma coluna
// de tempo trabalhado, de responsável interno, de pausa, de vaga no barracão,
// de bonificação, de observação, de detalhe da tarefa nem de PRAZO — `Task.term`
// é compromisso INTERNO e não vai para o cliente. O que ele vê de data é a
// PREVISÃO.
//
// ⛔ E NÃO HÁ COLUNA DE `status`. O servidor RETIRA `Task.status` da resposta: é
// a coluna que REGRIDE, e a verdade sobre "em que pé está" é `milestoneLabel`,
// que é projeção MONOTÔNICA.
import type { ReactNode } from "react";
import { IconAlertTriangle } from "@tabler/icons-react";

import type { DataTableColumnDef } from "@/components/ui/datatable";
import type { PortalVehicleDetail } from "@/api-client/portal";
import { Badge } from "@/components/ui/badge";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { formatChassis, formatDate, formatPlate } from "@/utils";
import { cn } from "@/lib/utils";

const Dash = () => <span className="text-muted-foreground">—</span>;

/**
 * O VAZIO QUE PEDE AÇÃO, e não o travessão que só informa.
 *
 * Placa e chassi em branco são o motivo de o contato estar nesta tela. Um
 * travessão cinza os iguala a qualquer outro campo não preenchido — some no
 * meio da linha. Aqui a célula vira um aviso âmbar com a palavra que falta.
 */
const Faltando = ({ label }: { label: string }) => (
  <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-sm font-medium text-amber-700 dark:text-amber-400">
    <IconAlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
    {label}
  </span>
);

const mono = (value: ReactNode) => (
  <span className="whitespace-nowrap text-sm tabular-nums">{value}</span>
);

/**
 * ⚠️ SEM ordenação padrão, e não por esquecimento.
 *
 * Em modo servidor o motor marca `manualSorting`: quem ordena é o servidor, e
 * `/cliente/me/veiculos` sem `orderBy` devolve `createdAt desc` — o mais novo
 * primeiro, que é o que esta lista sempre mostrou. Declarar uma ordem aqui
 * acenderia a seta de um cabeçalho no primeiro carregamento e mudaria, sem
 * pedido de ninguém, a ordem que o dono já conhece.
 */
export const PORTAL_VEICULOS_DEFAULT_SORTING: Array<{ id: string; desc: boolean }> = [];

/**
 * ID DE COLUNA → CAMPO DE ORDENAÇÃO DO SERVIDOR.
 *
 * ⛔ A ordenação desta lista é INTEIRAMENTE do servidor (`mode: "server"` liga
 * `manualSorting`; não existe ordenação no navegador para reaproveitar). O que
 * viaja é `campo:direção`, e os nomes válidos são os de
 * `PORTAL_VEHICLE_SORT_FIELDS` em `portal-read.controller.ts` — esta tabela é o
 * espelho daquela, e é ela que impede o cabeçalho de mandar um nome que a rota
 * não conhece.
 *
 * ⛔ **NUNCA um objeto do Prisma.** Uma rodada anterior mandou
 * `{ truck: { plate: 'asc' } }` para um `orderBy` que era um enum de duas
 * palavras, e TODO clique de cabeçalho voltava 400.
 *
 * O que NÃO está aqui, e por quê:
 *   · `stage` — o marco é PROJEÇÃO MONOTÔNICA montada em memória a partir do
 *     changelog (§9). Não existe coluna no banco por onde ordená-lo, e ordenar
 *     por `Task.status` ordenaria pela verdade que REGRIDE — a que o servidor
 *     retira da resposta exatamente para não ser mostrada.
 *   · `vinPlate` — "tem foto / não tem" é um booleano derivado de uma relação;
 *     ordenar por ele não responde pergunta nenhuma que a coluna já não
 *     responda de relance.
 */
export const VEICULO_SORT_FIELD_MAP: Record<string, string> = {
  name: "name",
  customer: "customer",
  serialNumber: "serialNumber",
  plate: "plate",
  chassisNumber: "chassisNumber",
  purchaseOrderNumber: "purchaseOrderNumber",
  budget: "budgetNumber",
  forecastDate: "forecastDate",
};

/**
 * Estado de ordenação da tabela → o `orderBy` da rota.
 *
 * Uma coluna sem entrada no mapa é DESCARTADA em vez de mandada adiante: é o
 * que torna inofensivo um `?sort=` guardado num favorito com o id de uma coluna
 * que já não existe. Lista vazia = a ordem padrão do servidor.
 */
export function buildVeiculoOrderBy(sorting: Array<{ id: string; desc: boolean }>): string[] {
  return sorting
    .map((s) => {
      const campo = VEICULO_SORT_FIELD_MAP[s.id];
      return campo ? `${campo}:${s.desc ? "desc" : "asc"}` : null;
    })
    .filter((e): e is string => !!e);
}

/**
 * O número do pedido de compra da linha — entidade primeiro, coluna legada
 * depois. MESMA precedência de `pedidoDe()` em `veiculo-identidade-card.tsx`:
 * duas leituras divergentes do mesmo campo mostrariam números diferentes para o
 * mesmo veículo em duas telas do mesmo portal.
 */
function pedidoDaLinha(row: PortalVehicleDetail): string {
  const identity = row.identity;
  return identity?.purchaseOrder?.number?.trim() || identity?.customerOrderNumber?.trim() || "";
}

export interface PortalVeiculoColumnOptions {
  /** O recorte deste contato inclui `VEHICLE`? Sem ela não há identidade a mostrar. */
  canSeeIdentity: boolean;
  /** E `DELIVERY`? Sem ela não há previsão nem etapa. */
  canSeeProgress: boolean;
}

export function createPortalVeiculoColumns({
  canSeeIdentity,
  canSeeProgress,
}: PortalVeiculoColumnOptions): DataTableColumnDef<PortalVehicleDetail>[] {
  const columns: DataTableColumnDef<PortalVehicleDetail>[] = [];

  /**
   * LOGOMARCA — `Task.name`, e é a primeira coluna da linha.
   *
   * ⚠️ NÃO é `Customer.logo` (a imagem do cadastro do cliente, que já viaja
   * dentro da coluna "Cliente" no sistema interno) nem `BudgetRequest.logoName`
   * (texto de UMA requisição, que só existe nos orçamentos nascidos no portal e
   * viria vazio na frota inteira que veio por outro caminho). É `Task.name` — o
   * mesmo campo que o sistema interno imprime sob o cabeçalho "Logomarca" na
   * lista de Orçamentos, na de Faturamento, nos recebíveis e nas quatro listas
   * do painel inicial, sempre no par "Logomarca | Cliente". É o que a Ankaa
   * PINTA naquele caminhão ("Belo BOI 9,50", "Masterboi LTDA."), e é por ele
   * que o cliente chama o serviço ao telefone.
   *
   * ⚠️ E NÃO É DADO DE LAYOUT. O §2 do contrato lista "logomarca" sob a seção
   * `LAYOUT`, e lá a palavra quer dizer a ARTE e as TINTAS da logomarca —
   * `layout.artworks` e `layout.logoPaints`, que seguem recortadas e somem para
   * quem não tem a seção. `Task.name` é o TÍTULO da linha: o projetor o devolve
   * no cabeçalho do veículo, sem seção nenhuma (`projectVehicle` o escreve
   * antes do primeiro `hasSection`), e esta tabela já o desenhava para todo
   * mundo — sob o cabeçalho errado ("Serviço") e escondida por padrão.
   *
   * Ordenável porque a linha É a tarefa: `name` é coluna de `Task`, não campo
   * de relação de lista. (Na lista INTERNA de orçamentos a mesma coluna perde a
   * seta justamente por isso — lá a linha é o orçamento e `name` mora nas N
   * tarefas dele.)
   */
  columns.push({
    id: "name",
    accessorFn: (row) => row.name ?? "",
    header: "Logomarca",
    enableSorting: true,
    cell: ({ row }) =>
      row.original.name?.trim() ? (
        <TruncatedTextWithTooltip text={row.original.name} className="text-sm font-medium" />
      ) : (
        <Dash />
      ),
    meta: {
      headerLabel: "Logomarca",
      exportHeader: "Logomarca",
      exportValue: (row) => row.name ?? "",
    },
    size: 220,
    minSize: 160,
  });

  if (canSeeIdentity) {
    columns.push(
      {
        /**
         * CLIENTE — `identity.customer`, o DONO do veículo.
         *
         * Não é redundante com a empresa do contato, e a frota do vendedor da
         * Ibiporã prova: 100 veículos, 11 da própria Ibiporã e o resto de
         * Framento, Luxafit, Masterboi, Transgênio, RKO. É a intermediação do
         * §3.1 — quem emite o pedido não é quem recebe o caminhão —, e sem esta
         * coluna as linhas dos outros clientes são indistinguíveis.
         *
         * ⚠️ Mora em `identity`, que é a seção `VEHICLE`: por isso está DENTRO
         * do bloco recortado, e não fora dele desenhando travessão.
         *
         * ⚠️ Texto, não avatar. O `CustomerLogoDisplay` do sistema interno
         * desenha `Customer.logo` ao lado do nome; a projeção do portal não
         * manda esse arquivo, e servir imagem de cadastro para o portal é outro
         * assunto (o arquivo público por UUID ainda não existe). O nome é o que
         * responde a pergunta da linha.
         */
        id: "customer",
        accessorFn: (row) => row.identity?.customer?.name ?? "",
        header: "Cliente",
        enableSorting: true,
        cell: ({ row }) =>
          row.original.identity?.customer?.name?.trim() ? (
            <TruncatedTextWithTooltip
              text={row.original.identity.customer.name}
              className="text-sm"
            />
          ) : (
            <Dash />
          ),
        meta: {
          headerLabel: "Cliente",
          exportHeader: "Cliente",
          exportValue: (row) => row.identity?.customer?.name ?? "",
        },
        size: 200,
        minSize: 140,
      },
      {
        id: "serialNumber",
        accessorFn: (row) => row.identity?.serialNumber ?? "",
        header: "Série",
        enableSorting: true,
        // ⚠️ TEXTO, não número — há séries com letra, e `Task.serialNumber` é
        // `String` no banco. Formatar como número perderia zeros à esquerda.
        cell: ({ row }) =>
          row.original.identity?.serialNumber?.trim() ? (
            mono(row.original.identity.serialNumber)
          ) : (
            <Faltando label="sem série" />
          ),
        meta: {
          headerLabel: "Série",
          exportHeader: "Série",
          exportValue: (row) => row.identity?.serialNumber ?? "",
        },
        size: 110,
      },
      {
        id: "plate",
        accessorFn: (row) => row.identity?.plate ?? "",
        header: "Placa",
        enableSorting: true,
        cell: ({ row }) =>
          row.original.identity?.plate?.trim() ? (
            mono(formatPlate(row.original.identity.plate))
          ) : (
            <Faltando label="sem placa" />
          ),
        meta: {
          headerLabel: "Placa",
          exportHeader: "Placa",
          exportValue: (row) => (row.identity?.plate ? formatPlate(row.identity.plate) : ""),
        },
        size: 120,
      },
      {
        id: "chassisNumber",
        accessorFn: (row) => row.identity?.chassisNumber ?? "",
        header: "Chassi",
        enableSorting: true,
        cell: ({ row }) =>
          row.original.identity?.chassisNumber?.trim() ? (
            mono(formatChassis(row.original.identity.chassisNumber))
          ) : (
            <Faltando label="sem chassi" />
          ),
        meta: {
          headerLabel: "Chassi",
          exportHeader: "Chassi",
          exportValue: (row) =>
            row.identity?.chassisNumber ? formatChassis(row.identity.chassisNumber) : "",
        },
        size: 200,
      },
      {
        // A plaqueta é uma FOTO (`Truck.vinPlate → File`). A coluna não desenha a
        // imagem — diz se ela existe, que é a única pergunta que se responde de
        // uma lista. A foto em si está no detalhe.
        //
        // ⛔ AUSÊNCIA AQUI É TRAVESSÃO, NUNCA O AVISO ÂMBAR. A decisão do dono
        // é que o cliente NÃO é perguntado pela plaqueta — ela some do editor
        // de identidade e não conta como pendência em lugar nenhum. Um
        // "sem foto" âmbar seria exatamente a cobrança que ele mandou tirar; o
        // `Faltando` continua valendo para placa e chassi, que são o que a
        // Ankaa de fato não tem como saber sozinha.
        id: "vinPlate",
        accessorFn: (row) => (row.identity?.vinPlate ? "sim" : "nao"),
        header: "Plaqueta",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.identity?.vinPlate ? (
            <Badge variant="completed" size="sm">
              Enviada
            </Badge>
          ) : (
            <Dash />
          ),
        meta: {
          headerLabel: "Plaqueta",
          exportHeader: "Plaqueta",
          exportValue: (row) => (row.identity?.vinPlate ? "Enviada" : ""),
          align: "center",
          defaultVisible: false,
        },
        size: 110,
      },
      {
        /**
         * ⚠️ O NÚMERO DO PEDIDO VIVE EM DOIS LUGARES, e a coluna lê os DOIS —
         * na mesma precedência de `pedidoDe()` no card de identidade.
         *
         * `purchaseOrder.number` é a entidade nova (`PurchaseOrder`, 1..N
         * veículos); `customerOrderNumber` é a coluna legada, que a NFS-e, o
         * `seuNumero` do boleto e a regra de atenção ainda leem. A escrita é
         * DUPLA quando passa pela entidade, mas os caminhos antigos
         * (`PUT /tasks/:id`, a grade em lote) gravam só a coluna — e é por isso
         * que a demo tem dezenas de veículos com "PEDIDO NR 116321" na coluna e
         * `purchaseOrder: null`. Lendo só a entidade, a célula desenhava
         * travessão para todos eles.
         *
         * ⛔ E É `customerOrderNumber` QUE O SERVIDOR ORDENA
         * (`VEHICLE_ORDER_BY.purchaseOrderNumber`), pela mesma razão: é o campo
         * que TODO caminho de escrita preenche. Se a célula lesse só a
         * entidade, a seta do cabeçalho ordenaria por um valor que a coluna não
         * mostra — o defeito mais difícil de ver que existe numa tabela
         * ordenável.
         */
        id: "purchaseOrderNumber",
        accessorFn: (row) => pedidoDaLinha(row),
        header: "Pedido de compra",
        enableSorting: true,
        cell: ({ row }) => {
          const numero = pedidoDaLinha(row.original);
          return numero ? mono(numero) : <Dash />;
        },
        meta: {
          headerLabel: "Pedido",
          exportHeader: "Pedido de compra",
          exportValue: (row) => pedidoDaLinha(row),
        },
        size: 150,
      },
    );
  }

  columns.push({
    // O orçamento a que o veículo pertence — o número que o cliente cita ao
    // telefone. Sem preço nenhum: preço é a seção PRICING, e ela vive na tela
    // do orçamento, recortada por papel.
    id: "budget",
    accessorFn: (row) => row.budget?.budgetNumber ?? "",
    header: "Orçamento",
    enableSorting: true,
    cell: ({ row }) =>
      row.original.budget?.budgetNumber ? mono(`Nº ${row.original.budget.budgetNumber}`) : <Dash />,
    meta: {
      headerLabel: "Orçamento",
      exportHeader: "Orçamento",
      exportValue: (row) => (row.budget?.budgetNumber ? `Nº ${row.budget.budgetNumber}` : ""),
    },
    size: 130,
  });

  if (canSeeProgress) {
    columns.push(
      {
        // ⚠️ O RÓTULO VEM PRONTO DO SERVIDOR (`milestoneLabel`). O marco é
        // PROJEÇÃO monotônica (§9): derivá-lo aqui de status cru faria um veículo
        // "Concluído" voltar a "Em Preparação" na semana seguinte, porque os
        // carimbos de produção são legitimamente apagados em operação normal. E
        // `Task.status` nem chega até aqui — o servidor o retira.
        id: "stage",
        accessorFn: (row) => row.milestoneLabel ?? "",
        header: "Etapa atual",
        enableSorting: false,
        cell: ({ row }) => {
          const { milestone, milestoneLabel, cancelled } = row.original;
          if (cancelled) {
            return (
              <Badge variant="cancelled" size="sm">
                Cancelado
              </Badge>
            );
          }
          if (!milestoneLabel) return <Dash />;
          return (
            <Badge variant={milestone === "CONCLUIDO" ? "completed" : "inProgress"} size="sm">
              {milestoneLabel}
            </Badge>
          );
        },
        meta: {
          headerLabel: "Etapa",
          exportHeader: "Etapa atual",
          exportValue: (row) => (row.cancelled ? "Cancelado" : (row.milestoneLabel ?? "")),
        },
        size: 170,
      },
      {
        // A pergunta nº 1 de quem abre esta tela: "quando fica pronto?".
        // ⚠️ `progress.forecastDate` — a PREVISÃO. Nunca `Task.term`, que é
        // compromisso interno e está na lista do §9.
        id: "forecastDate",
        accessorFn: (row) => row.progress?.forecastDate ?? "",
        header: "Previsão",
        enableSorting: true,
        cell: ({ row }) =>
          row.original.progress?.forecastDate ? (
            mono(formatDate(row.original.progress.forecastDate))
          ) : (
            <Dash />
          ),
        meta: {
          headerLabel: "Previsão",
          exportHeader: "Previsão",
          exportValue: (row) =>
            row.progress?.forecastDate ? formatDate(row.progress.forecastDate) : "",
          align: "center",
        },
        size: 120,
      },
    );
  }

  // ⚠️ AQUI HAVIA UMA SEGUNDA COLUNA COM `id: "name"`, sob o cabeçalho
  // "Serviço" e com `defaultVisible: false`. Era a MESMA `Task.name` que agora
  // abre a tabela como "Logomarca" — dois ids iguais no mesmo `columns` fazem o
  // TanStack ficar com um e descartar o outro em silêncio, e a chave
  // `--col-name-size` teria dois donos. O dado não se perdeu: mudou de nome
  // para o que o resto do sistema já o chama, e deixou de nascer escondido.

  return columns;
}

/**
 * A linha inteira fica âmbar quando falta identidade.
 *
 * Só a célula não basta: a lista é rolável e o contato chega nela para achar
 * "quais dos meus 30 caminhões ainda me devem alguma coisa". A cor responde
 * isso de longe; a célula responde QUAL.
 *
 * ⚠️ DERIVADO, e só quando há identidade a ler. O servidor não manda booleano de
 * "falta identificação" — não existe `missingIdentity` em resposta nenhuma dele
 * (nem na frota, nem no resumo). E sem a seção `VEHICLE` a resposta é "não sei",
 * que aqui vira "não tinge": pintar a frota inteira de âmbar para quem não pode
 * ver placa seria inventar um relatório de pendências.
 */
export function portalVeiculoRowClassName(row: PortalVehicleDetail): string {
  const identity = row.identity;
  if (!identity) return "";
  const falta = !identity.plate?.trim() || !identity.chassisNumber?.trim();
  return cn(falta && "bg-amber-500/5 hover:bg-amber-500/10");
}
