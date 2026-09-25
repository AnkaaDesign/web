// web/src/api-client/portal.ts
//
// O CLIENTE HTTP DE `/cliente/me/*` — tudo que o PORTAL DO RESPONSÁVEL lê e
// escreve, e os hooks de react-query que as telas do portal consomem.
//
// ── Por que este arquivo existe, e por que ele NÃO usa o `apiClient` ─────────
//
// O portal já tem axios próprio: `api-client/responsible-auth.ts`, com chave de
// armazenamento `ankaa_cliente_token` e SEM o interceptor de 401 do funcionário.
// A razão está escrita lá e vale repetir: um contato de cliente navegando na
// mesma máquina em que alguém da Ankaa está logado derrubaria a sessão do
// funcionário — e, pior, mandaria o bearer do funcionário para as rotas do
// portal. Este módulo ESTENDE aquela mesma instância; nunca a de funcionário.
//
// ── O que este arquivo acrescenta à instância ───────────────────────────────
//
// Um interceptor de RESPOSTA, que a instância ainda não tinha, com duas tarefas:
//
//  1. `_statusCode`. A convenção da casa é ler o status do erro em
//     `error._statusCode`, e não em `error.response.status` (o `apiClient`
//     reembrulha o erro). Sem isto, código escrito na convenção leria
//     `undefined` aqui e trataria um 403 do portão de papel como falha de rede.
//     ⚠️ O erro ORIGINAL é preservado (não se cria um `Error` novo): `response`
//     continua lá, porque `main.tsx` decide o retry do react-query por
//     `error.response.status` e `responsible-auth-context` encerra a sessão por
//     ele. Reembrulhar apagaria os dois comportamentos em silêncio.
//
//  2. Os TOASTS. "O interceptor já toasta erro de API e sucesso de escrita" é
//     premissa do contrato (§10) e das telas — a partir daqui ela é verdadeira
//     também no portal. NÃO toaste de novo na página.
//     Duas exceções, ambas deliberadas: `/cliente/auth/*` (a tela de entrada
//     mostra o erro embaixo do campo, e um toast por cima seria a mesma frase
//     duas vezes) e `metadata.suppressToast` para quem é dono da própria
//     mensagem.
//
// ── A FORMA DO DADO É A DO SERVIDOR, campo a campo ──────────────────────────
//
// ⛔ Este arquivo nasceu como PROPOSTA, escrito antes de a API existir, com uma
// forma PLANA inventada (`PortalVehicleSummary.plate`, `PortalBudgetDetail.total`,
// `PortalBilling.invoices`). A API entregou outra coisa: uma projeção AGRUPADA
// POR SEÇÃO (`vehicle.identity.plate`, `budget.pricing.total`, a cobrança sendo
// `Invoice` e não `Billing`). Os tipos abaixo foram reconciliados contra
// `api/src/modules/people/portal/portal-read.service.ts` e
// `portal-projection.service.ts`, `select` por `select`.
//
// A lição que fica escrita aqui: **o agrupamento POR SEÇÃO não é estética, é o
// recorte**. `identity`, `layout`, `progress`, `pricing`, `payment`, `guarantee`
// existem como objetos porque cada um é uma SEÇÃO inteira que aparece ou não
// aparece. `undefined` quer dizer "você não vê isto" e a tela esconde o bloco;
// `null` dentro dele quer dizer "isto existe e está vazio" e a tela desenha um
// traço. Achatar os grupos apaga a diferença — foi o que o tipo plano fez, e foi
// por isso que o contato de MARKETING abria o orçamento e não via a arte que
// ele estava ali para aprovar: `PortalBudgetDetail` não declarava `layout`, e o
// servidor mandava os arquivos o tempo todo.
//
// Envelope idêntico ao resto da API: `{ success, message, data, meta }`, com
// `meta.totalRecords` e `meta.take`. As funções devolvem o ENVELOPE inteiro, e
// não `data` — é o que todo `*Service` desta casa faz, e é de onde a paginação
// tira o total. Nas telas: `const budgets = response?.data ?? []`.
//
// ⚠️ O RECORTE POR SEÇÃO É DO SERVIDOR. `sectionsForRoles()` corta no `select`,
// não num `.filter()` de React — foi exatamente o `.filter()` no navegador que
// fez `GET /budgets/public/:id` entregar o cadastro fiscal de um pagador ao
// outro. Campo que a pessoa não pode ver chega `null` ou não chega; a tela
// esconde a linha vazia, ela não decide o sigilo.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";
import { toast } from "@/components/ui/sonner";
import type { PaymentConfig, TASK_QUOTE_STATUS } from "@/types/budget";
import type { QuoteSection } from "./signature";
import { responsibleAuthClient } from "./responsible-auth";

// =====================================================
// O interceptor de resposta
// =====================================================

/** Config com a metadata que este módulo entende. */
type PortalRequestConfig = AxiosRequestConfig & {
  metadata?: { suppressToast?: boolean };
};

/** O erro que sai daqui — axios intacto, mais `_statusCode`. */
export interface PortalApiError extends AxiosError {
  /** ⚠️ A convenção da casa. `0` quando não houve resposta (rede, CORS, timeout). */
  _statusCode: number;
}

const WRITE_METHODS = new Set(["post", "put", "patch", "delete"]);

/** Rotas cuja tela é dona da própria mensagem — a de entrada mostra inline. */
const SELF_REPORTING_PREFIX = "/cliente/auth";

function isSelfReporting(url: string | undefined): boolean {
  return (url ?? "").startsWith(SELF_REPORTING_PREFIX);
}

function statusOf(error: unknown): number {
  return (error as AxiosError | undefined)?.response?.status ?? 0;
}

/**
 * A mensagem que o servidor mandou, se mandou alguma.
 *
 * A API devolve `{ success:false, message }` no corpo do erro; `error.message`
 * do axios é "Request failed with status code 403", que não diz nada a ninguém.
 */
function serverMessage(error: unknown): string | null {
  const data = (error as AxiosError<{ message?: unknown }> | undefined)?.response?.data;
  const message = typeof data === "object" && data ? (data as { message?: unknown }).message : null;
  if (typeof message === "string" && message.trim()) return message.trim();
  return null;
}

/** Título e texto de um erro do portal, já em português e sem jargão HTTP. */
function describeError(error: unknown): { title: string; message: string } {
  const status = statusOf(error);
  const fromServer = serverMessage(error);

  if (status === 0) {
    return {
      title: "Sem conexão",
      message: "Não foi possível falar com o servidor. Verifique a internet e tente de novo.",
    };
  }
  if (status === 401) {
    return { title: "Sessão encerrada", message: fromServer ?? "Entre novamente para continuar." };
  }
  if (status === 403) {
    // O portão de papel. A mensagem do servidor É a explicação — é ela que diz
    // "Informe o número do pedido de compra antes de assinar."
    return { title: "Sem permissão", message: fromServer ?? "Seu perfil não permite esta ação." };
  }
  if (status === 404) {
    return { title: "Não encontrado", message: fromServer ?? "Este registro não está mais disponível." };
  }
  if (status === 429) {
    return {
      title: "Muitas tentativas",
      message: fromServer ?? "Aguarde alguns minutos antes de tentar de novo.",
    };
  }
  if (status >= 500) {
    return { title: "Erro no servidor", message: fromServer ?? "Tente novamente em instantes." };
  }
  return { title: "Não foi possível concluir", message: fromServer ?? "Confira os dados e tente de novo." };
}

/** `error._statusCode` — a leitura de status da casa, para quem pegou o erro. */
export function portalErrorStatus(error: unknown): number {
  const tagged = (error as { _statusCode?: number } | undefined)?._statusCode;
  return typeof tagged === "number" ? tagged : statusOf(error);
}

/** A mensagem do servidor, ou o `fallback` quando ele não mandou nenhuma. */
export function portalErrorMessage(error: unknown, fallback: string): string {
  return serverMessage(error) ?? fallback;
}

// Instalado UMA vez, no import. O módulo é singleton e a instância também.
responsibleAuthClient.interceptors.response.use(
  (response: AxiosResponse) => {
    const config = response.config as PortalRequestConfig;
    const method = (config.method ?? "get").toLowerCase();

    if (
      WRITE_METHODS.has(method) &&
      !isSelfReporting(config.url) &&
      !config.metadata?.suppressToast &&
      (response.data as { success?: boolean } | undefined)?.success !== false
    ) {
      const message = (response.data as { message?: string } | undefined)?.message;
      toast.success("Sucesso", message || "Operação concluída.");
    }

    return response;
  },
  (error: AxiosError) => {
    const config = (error.config ?? {}) as PortalRequestConfig;
    // ⚠️ Anota NO erro original. Ver o cabeçalho: `response` tem de sobreviver.
    (error as PortalApiError)._statusCode = statusOf(error);

    if (!isSelfReporting(config.url) && !config.metadata?.suppressToast) {
      const { title, message } = describeError(error);
      toast.error(title, message);
    }

    return Promise.reject(error);
  },
);

// =====================================================
// A forma do envelope
// =====================================================

export interface PortalMeta {
  totalRecords: number;
  page?: number;
  take?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
}

export interface PortalResponse<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: PortalMeta;
}

export interface PortalListResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  meta?: PortalMeta;
}

/**
 * Paginação e busca — EXATAMENTE os nomes que `portalListQuerySchema`
 * (`api/.../portal-read.controller.ts`) declara, e nada além deles.
 *
 * ⛔ Nada em zod é `.strict()` neste repositório: chave desconhecida some em
 * SILÊNCIO, com 200. Este tipo já mandou `limit` (o servidor lê `take`) e um
 * `orderBy` no formato do Prisma (o servidor aceita `'fila' | 'recentes'`) — o
 * primeiro fazia toda lista voltar com 20 linhas independentemente do seletor de
 * tamanho de página, e o segundo derrubava a requisição inteira em 400 assim que
 * alguém clicasse num cabeçalho. Os dois saíram.
 */
export interface PortalListParams {
  page?: number;
  take?: number;
  searchingFor?: string;
  /**
   * `fila` (o padrão do servidor) = `statusOrder asc` e depois `createdAt desc`.
   * `recentes` = só `createdAt desc`, ignorando o estado.
   *
   * ⚠️ `fila` AQUI NÃO É A FILA INTERNA, apesar do nome. A lista de dentro
   * desempata por `queueRank asc` — coluna GERADA que põe o pendente mais ANTIGO
   * no topo, porque lá a lista é uma FILA DE TRABALHO e o mais velho é o mais
   * urgente. O portal é o HISTÓRICO DO CLIENTE: ninguém abre o próprio portal
   * para achar o pedido que espera há mais tempo, abre para ver o que acabou de
   * mandar — e com `queueRank asc` a requisição recém-aberta caía no FIM do
   * grupo de pendentes. A divergência é deliberada; ver `PORTAL_BUDGET_ORDER` em
   * `api/.../portal/portal-read.service.ts`.
   *
   * ⛔ Este comentário já descreveu a ordem ERRADA (dizia `createdAt desc` quando
   * o servidor mandava `queueRank asc`) — a única prova da ordem é o servidor, e
   * o web não reordena: o motor de tabela marca `manualSorting`.
   *
   * ⚠️ Só a lista de ORÇAMENTOS lê este parâmetro NESTA FORMA. A de veículos
   * sobrescreve a chave com a lista de `campo:direção` — ver
   * `PortalVehicleListParams`, que a declara com `Omit`, e
   * `PORTAL_VEHICLE_SORT_FIELDS` no servidor.
   */
  orderBy?: "fila" | "recentes";
  /**
   * `GET /cliente/me/veiculos?semPedido=true` — só os veículos que ainda NÃO têm
   * número de pedido de compra. `false` = só os que têm. Ausente = todos.
   *
   * ⚠️ Só a lista de VEÍCULOS lê este parâmetro, e ele existe para que ninguém
   * precise ler a frota inteira para contar pendência: a resposta é
   * `meta.totalRecords` de uma página curta. O teto de `take` do servidor é 100
   * e não sobe.
   */
  semPedido?: boolean;
}

// =====================================================
// Os tipos do dado — espelho de `portal-projection.service.ts`
// =====================================================

/**
 * As sete seções do documento — o eixo do que a pessoa VÊ.
 *
 * ⚠️ ALIAS de `QuoteSection`, e não uma segunda declaração. O contrato é
 * explícito de que a régua da assinatura e a régua da tela são A MESMA
 * (`sectionsForRoles()`); duas uniões com os mesmos sete literais sobrevivem
 * exatamente até alguém acrescentar a oitava seção em um dos dois lugares.
 */
export type PortalSection = QuoteSection;

/**
 * O estado do orçamento. ALIAS do tipo do sistema, de propósito: os oito valores
 * já estão declarados em `@/types/budget`, e rótulo e cor em
 * `QUOTE_STATUS_CONFIG`. Redeclarar aqui criaria a terceira tabela — que é
 * exatamente o defeito que aquele arquivo conta ter custado caro.
 */
export type PortalBudgetStatus = TASK_QUOTE_STATUS;

/**
 * Um ARQUIVO, no recorte que o projetor entrega.
 *
 * ⛔ SEM `path`. `File.path` é o caminho no disco do servidor e a árvore é
 * literal (`Clientes/{razão social}/Boletos/`) — mandá-lo ao cliente é mandar o
 * mapa do armazenamento junto do arquivo. Para montar a URL use
 * `components/cliente/veiculo/portal-file-url.ts`, que só precisa do `id`.
 */
export interface PortalFile {
  id: string;
  filename: string | null;
  originalName: string | null;
  mimetype: string | null;
  size: number | null;
  thumbnailUrl: string | null;
}

/** Uma tinta, nos quatro campos que o portal mostra. */
export interface PortalPaint {
  id: string;
  name: string | null;
  hex: string | null;
  finish: string | null;
  /** `PaintType.name` — "Poliéster", "Acrílica". Achatado pelo projetor. */
  type: string | null;
}

/** Uma seção da medida de um lado do implemento. ⚠️ Larguras em METROS. */
export interface PortalMeasureSection {
  width: number | null;
  isDoor: boolean;
  doorHeight: number | null;
  position: number;
}

/**
 * A medida de UM LADO do implemento.
 *
 * ⚠️ METROS, como no banco. O projetor NÃO converte — converter ali faria o
 * portal ter unidade diferente do resto do sistema para o mesmo campo. Quem fala
 * centímetros é o FORMULÁRIO da requisição, e a divisão por 100 é da borda do
 * servidor (`portalRequisicaoSchema` → `centimetrosParaMetros`).
 */
export interface PortalMeasure {
  height: number | null;
  sections: PortalMeasureSection[];
}

/** O cliente, como o `select` do portal o entrega. */
export interface PortalCustomerRef {
  id: string;
  fantasyName: string | null;
  corporateName: string | null;
}

/** `{ id, name }` — o formato compacto que a identidade do veículo usa. */
export interface PortalNamedRef {
  id: string;
  name: string | null;
}

// ── A ESCADA (§9) ───────────────────────────────────────────────────────────

/**
 * Os quatro marcos, NA ORDEM. Espelho de `PORTAL_MILESTONES`
 * (`portal-read.service.ts`).
 */
export type PortalMilestoneKey =
  | "ORCAMENTO_ENVIADO"
  | "VEICULO_RECEBIDO"
  | "EM_PRODUCAO"
  | "CONCLUIDO";

/**
 * Um degrau da escada.
 *
 * ⚠️ `reachedAt: null` num marco `reached: true` significa "o carimbo foi
 * APAGADO e só o changelog prova o fato" — e não "sem data". Os carimbos de
 * produção são apagados em operação normal (O.S. → `PENDING` zera as datas dela;
 * cancelar toda O.S. de produção zera `Task.startedAt`), e é por isso que a
 * projeção é MONOTÔNICA e vive no servidor. A tela desenha; nunca recalcula.
 */
export interface PortalTimelineEntry {
  key: PortalMilestoneKey;
  label: string;
  order: number;
  reached: boolean;
  reachedAt: string | null;
}

/**
 * Uma ETAPA de produção (`ServiceOrder` de tipo `PRODUCTION`).
 *
 * ⛔ Nenhuma O.S. `COMMERCIAL` chega aqui — são 52 descrições, entre elas
 * "Aplicar Desconto", "Contraproposta" e "Tratar Reclamação". O filtro é de
 * TIPO, no `where` do servidor.
 *
 * ⚠️ `PAUSED` é reescrito para `IN_PROGRESS` na origem: para o cliente uma etapa
 * pausada é uma etapa em andamento, e a pausa é quase sempre almoço ou fila de
 * cabine. `pausedAt` não sai nem reescrito.
 */
export interface PortalStep {
  id: string;
  description: string | null;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  startedAt: string | null;
  finishedAt: string | null;
}

/**
 * O ANDAMENTO — seção `DELIVERY`.
 *
 * `checkinFiles`/`checkoutFiles` são relações de ARQUIVO da tarefa, e não
 * dependem de comparar texto livre de descrição de O.S. Vêm `[]` na LISTA (o
 * `select` de lista não as carrega) e preenchidas no DETALHE.
 */
export interface PortalVehicleProgress {
  entryDate: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  /** ⚠️ A PREVISÃO, que é o que se promete. `Task.term` é o prazo INTERNO e nunca sai. */
  forecastDate: string | null;
  steps: PortalStep[];
  timeline: PortalTimelineEntry[];
  checkinFiles: PortalFile[];
  checkoutFiles: PortalFile[];
}

/** A IDENTIDADE — seção `VEHICLE`. */
export interface PortalVehicleIdentity {
  serialNumber: string | null;
  plate: string | null;
  chassisNumber: string | null;
  category: string | null;
  implementType: string | null;
  /** A plaqueta é IMAGEM, não texto, desde `20260727150000_truck_vin_plate_image`. */
  vinPlate: PortalFile | null;
  /** ⚠️ METROS. Ver `PortalMeasure`. A chave traseira é `back`, não `rear`. */
  measures: {
    left: PortalMeasure | null;
    right: PortalMeasure | null;
    back: PortalMeasure | null;
  };
  customerOrderNumber: string | null;
  purchaseOrder: { id: string; number: string | null; issuedAt: string | null } | null;
  customer: PortalNamedRef | null;
}

/** O LAYOUT DO VEÍCULO — seção `LAYOUT`. */
export interface PortalVehicleLayout {
  generalPainting: PortalPaint | null;
  logoPaints: PortalPaint[];
  baseFiles: PortalFile[];
  /** Só os `Layout` APROVADOS. Layout em revisão é conversa interna. */
  artworks: PortalFile[];
}

/** O orçamento a que um veículo pertence, no recorte da rota de veículos. */
export interface PortalVehicleBudgetRef {
  id: string;
  budgetNumber: number | null;
  status: PortalBudgetStatus;
  statusOrder: number | null;
  expiresAt: string | null;
  vehicleCount: number | null;
}

/**
 * O VEÍCULO.
 *
 * ⛔ **NÃO EXISTE `status` AQUI, E É DE PROPÓSITO.** `Task.status` é a coluna que
 * REGRIDE (`COMPLETED → PREPARATION` é transição legal), e devolvê-la ao lado de
 * uma escada monotônica seria publicar as duas verdades e deixar a tela escolher
 * qual mostrar. `overlayVehicle` a RETIRA da resposta e põe `milestone` no
 * lugar. `milestone`/`milestoneLabel` é a única verdade sobre "em que pé está".
 *
 * ⚠️ `identity`, `layout` e `progress` são `undefined` quando a SEÇÃO não está
 * no recorte deste contato — não são objetos de campos nulos. A distinção é a
 * tela inteira: `undefined` esconde o bloco, `null` dentro dele desenha traço.
 *
 * A mesma forma sai da LISTA e do DETALHE de `/cliente/me/veiculos`, e também
 * de `PortalBudget.vehicles` — com uma diferença: dentro do orçamento os
 * veículos não trazem `sections` nem `budget` (quem os traz é o orçamento).
 */
export interface PortalVehicle {
  id: string;
  name: string | null;
  identity?: PortalVehicleIdentity;
  layout?: PortalVehicleLayout;
  progress?: PortalVehicleProgress;
  /** `null` quando o contato não tem a seção `DELIVERY`. */
  milestone: PortalMilestoneKey | null;
  milestoneLabel: string | null;
  cancelled: boolean | null;
}

/** O que `/cliente/me/veiculos` (lista E detalhe) acrescenta ao veículo. */
export interface PortalVehicleDetail extends PortalVehicle {
  /** O recorte que ESTE contato recebeu — devolvido junto com o dado. */
  sections: PortalSection[];
  budget: PortalVehicleBudgetRef | null;
}

// ── O ORÇAMENTO ─────────────────────────────────────────────────────────────

/**
 * Uma linha de serviço — seção `SERVICES`.
 *
 * ⛔ **SEM `amount`.** A lista e o preço são seções DIFERENTES, e há um papel
 * real entre as duas: o Marketing do cliente aprova a arte e o escopo sem ver
 * quanto custa. O valor de cada linha vive em `pricing.items`, com o MESMO `id`
 * — quem tem as duas seções cruza por ele.
 */
export interface PortalBudgetService {
  id: string;
  description: string | null;
  observation: string | null;
  position: number;
}

/** Uma linha de serviço COM valor — seção `PRICING`. Mesmo `id` de `services`. */
export interface PortalPricingItem {
  id: string;
  description: string | null;
  amount: number | null;
  position: number;
}

/**
 * O PREÇO — seção `PRICING`.
 *
 * ⚠️ Não existe `discountValue` no orçamento. O desconto é do PAGADOR
 * (`BudgetPayer.discountType`/`discountValue`) e aparece em `PortalChargePayer`,
 * na rota de cobranças. O tipo antigo declarava um desconto no topo do orçamento
 * que o servidor nunca mandou — e a tela desenhava a linha "Desconto" só quando
 * `typeof === 'number'`, então ninguém percebeu que ela nunca aparecia.
 */
export interface PortalBudgetPricing {
  subtotal: number | null;
  total: number | null;
  vehicleCount: number | null;
  items: PortalPricingItem[];
}

/** O PRAZO no nível do contrato — seção `DELIVERY`. */
export interface PortalBudgetDelivery {
  customForecastDays: number | null;
  simultaneousTasks: number | null;
}

/** Um boleto, do ponto de vista de quem paga. */
export interface PortalBankSlipRef {
  id: string;
  digitableLine: string | null;
  dueDate: string | null;
  amount: number | null;
  status: string | null;
}

/** Uma parcela do plano de pagamento do orçamento — seção `PAYMENT`. */
export interface PortalBudgetInstallment {
  id: string;
  number: number | null;
  amount: number | null;
  dueDate: string | null;
  paidAt: string | null;
  status: string | null;
  bankSlip: PortalBankSlipRef | null;
}

/**
 * UM PAGADOR do orçamento — seção `PAYMENT`.
 *
 * ⚠️ A lista vem JÁ ESCOPADA pelo servidor (`payerScopeSelect`): quem lê recebe
 * só o próprio cadastro, nunca o do outro pagador do mesmo orçamento. Foi
 * exatamente o `customerConfigs: true` sem `where` que fez
 * `GET /budgets/public/:id` entregar a A o cadastro fiscal de B.
 */
export interface PortalBudgetPayer {
  id: string;
  customerId: string;
  customerName: string | null;
  /**
   * ── O ACORDO, e não só as parcelas ──────────────────────────────────────
   *
   * ⛔ O card de Pagamento mostrava a TABELA de parcelas e mais nada: nem a
   * forma (boleto ou Pix), nem a condição, nem se sai nota, nem para quem a
   * fatura vai. O cliente lia "3 parcelas de R$ X" sem saber como paga nem a
   * partir de quando conta o prazo — e a resposta estava no PDF, que é
   * exatamente o documento que o portal existe para substituir.
   *
   * É o mesmo conjunto que a cláusula impressa cita, e `generatePaymentText`
   * (o gerador do PDF) é reusado na tela para que as duas NUNCA divirjam.
   */
  subtotal: number | null;
  total: number | null;
  discountType: string | null;
  discountValue: number | null;
  paymentCondition: string | null;
  /** `PaymentConfig` (`types/budget.ts`) serializado. */
  paymentConfig: PaymentConfig | null;
  customPaymentText: string | null;
  generateInvoice: boolean | null;
  generateBankSlip: boolean | null;
  installments: PortalBudgetInstallment[];
}

/** Uma NFS-e do orçamento. Só AUTORIZADA e com id na prefeitura. */
export interface PortalNfseRef {
  id: string;
  nfseNumber: number | null;
  status: string | null;
  createdAt: string | null;
}

/** O PAGAMENTO — seção `PAYMENT`. */
export interface PortalBudgetPayment {
  billingSplit: string | null;
  payers: PortalBudgetPayer[];
  nfse: PortalNfseRef[];
}

/** A GARANTIA — seção `GUARANTEE`. */
export interface PortalBudgetGuarantee {
  years: number | null;
  text: string | null;
}

/**
 * O LAYOUT DO ORÇAMENTO — seção `LAYOUT`: as artes penduradas no documento.
 *
 * ⛔ ESTE É O CAMPO QUE FALTAVA. O contato de MARKETING tem `LAYOUT` como ÚNICA
 * seção — ele abre o orçamento exatamente para ver a arte —, e o tipo antigo não
 * declarava nada disto. O servidor mandava `layout.files` o tempo todo; a tela,
 * escrita contra o tipo, não tinha por onde desenhá-lo. A arte por VEÍCULO é
 * outra (`PortalVehicle.layout`), e as duas aparecem juntas no card de Layout.
 */
export interface PortalBudgetLayout {
  files: PortalFile[];
}

/**
 * A REQUISIÇÃO, quando o orçamento nasceu no portal.
 *
 * Não tem seção própria, e é de propósito: briefing e nome de logomarca são o
 * que o PRÓPRIO cliente escreveu. Recortar de volta o texto que ele mandou seria
 * esconder dele o que ele mesmo disse.
 *
 * ⚠️ Os três autores só vêm no DETALHE (`opts.detail`), nunca na lista.
 */
export interface PortalBudgetRequestInfo {
  briefing: string | null;
  logoName: string | null;
  requestedAt: string | null;
  preApprovedAt: string | null;
  refusedAt: string | null;
  decisionNote: string | null;
  requestedBy?: PortalNamedRef | null;
  preApprovedBy?: PortalNamedRef | null;
  refusedBy?: PortalNamedRef | null;
}

/**
 * O ORÇAMENTO — a MESMA forma na lista e no detalhe.
 *
 * O que o detalhe acrescenta não é campo de topo: são os autores da decisão
 * dentro de `request` e as fotos de check-in/out dentro de cada
 * `vehicles[].progress`. Por isso um tipo só — dois tipos empurrariam a lista a
 * declarar menos do que o servidor manda, que é como o `layout` sumiu.
 */
export interface PortalBudget {
  id: string;
  /** `Budget.budgetNumber` — o número que o cliente lê e cita no telefone. */
  budgetNumber: number | null;
  status: PortalBudgetStatus;
  statusOrder: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  expiresAt: string | null;
  vehicleCount: number | null;
  billingSplit: string | null;
  /** O recorte que ESTE contato recebeu neste documento. */
  sections: PortalSection[];
  /** As capacidades DESTE contato (§2.1). União dos papéis, nunca interseção. */
  capabilities: string[];
  /** `true` só quando há capacidade `PRE_APPROVE` **e** o estado é `IN_NEGOTIATION`. */
  canPreApprove: boolean;
  /** O marco do CONTRATO: o MENOR entre os veículos vivos. `null` sem `DELIVERY`. */
  milestone: PortalMilestoneKey | null;
  milestoneLabel: string | null;
  /**
   * A VERDADE SOBRE A ASSINATURA — e por que ela não se deduz do estado.
   *
   * `emitted`: existe coleta emitida (envelope `RUNNING` ou `COMPLETED`).
   * `awaitingMe`: EU tenho assinatura pendente numa coleta em curso — a MESMA
   * pergunta que `GET /cliente/me/assinaturas` responde.
   *
   * ⛔ A coluna "Esperando" dizia "Com você" para todo `PENDING`, por dedução.
   * No acervo do dono, **18 de 18** orçamentos em `PENDING` não tinham envelope
   * nenhum: a lista anunciava dezoito documentos esperando por ele enquanto a
   * tela de Assinaturas dizia, corretamente, "Nada para assinar". Duas telas do
   * mesmo produto se contradizendo — e a que mentia era a mais visível.
   */
  signature: { emitted: boolean; awaitingMe: boolean };
  services?: PortalBudgetService[];
  pricing?: PortalBudgetPricing;
  delivery?: PortalBudgetDelivery;
  payment?: PortalBudgetPayment;
  guarantee?: PortalBudgetGuarantee;
  layout?: PortalBudgetLayout;
  request?: PortalBudgetRequestInfo;
  vehicles: PortalVehicle[];
}

/**
 * ALIAS de continuidade — lista e detalhe têm a mesma forma.
 *
 * ⚠️ NÃO reintroduza uma interface separada para o detalhe. Foi a divisão
 * `Summary` × `Detail` que fez a lista declarar menos campos do que o servidor
 * manda e as duas telas discordarem sobre o que existe.
 */
export type PortalBudgetDetail = PortalBudget;

// ── O RESUMO ────────────────────────────────────────────────────────────────

/** Um orçamento na fila de "esperando a minha decisão". */
export interface PortalSummaryBudget {
  id: string;
  budgetNumber: number | null;
  status: PortalBudgetStatus;
  statusOrder: number | null;
  createdAt: string | null;
  expiresAt: string | null;
  vehicleCount: number | null;
  /** ⚠️ `null` sem a seção `PRICING`. Um `?? 0` na tela mentiria. */
  subtotal: number | null;
  total: number | null;
  customer: PortalCustomerRef | null;
}

/**
 * Um envelope parado na assinatura DESTA pessoa.
 *
 * ⚠️ Esta é a ÚNICA fonte de assinaturas pendentes que existe hoje:
 * `GET /cliente/me/assinaturas` ainda não foi implementada no servidor. Quem
 * precisa da fila — o Início, o card do detalhe do orçamento, a tela de
 * Assinaturas — lê daqui.
 */
export interface PortalSummaryEnvelope {
  /** `EnvelopeSigner.id`. É ele que vai na URL de `/assinar`. */
  signerId: string;
  signerStatus: string;
  authMethod: string | null;
  envelopeId: string;
  deadlineAt: string | null;
  /** O RECORTE que esta pessoa assina — pode não ser o documento inteiro. */
  sections: PortalSection[];
  budget: { id: string; budgetNumber: number | null; status: PortalBudgetStatus } | null;
}

/** Um veículo na fábrica AGORA. */
export interface PortalSummaryVehicle {
  taskId: string;
  name: string | null;
  serialNumber: string | null;
  plate: string | null;
  startedAt: string | null;
  forecastDate: string | null;
  budget: { id: string; budgetNumber: number | null } | null;
}

/**
 * Um grupo de "o que espera por mim".
 *
 * `available: false` quer dizer "este trabalho não é seu" e é diferente de
 * `total: 0` ("é seu e está vazio"). A tela esconde o card no primeiro caso e
 * desenha o vazio comemorativo no segundo.
 */
export interface PortalWaitingGroup<T> {
  available: boolean;
  total: number;
  items: T[];
}

/**
 * `GET /cliente/me/resumo`.
 *
 * ⚠️ A FORMA MUDOU e é a do servidor: `budgets.byStatus` é um REGISTRO com TODAS
 * as chaves presentes e zeradas (contador ausente viraria `undefined` na tela e
 * "—" onde deveria estar "0"), não um array `statusCounts[]`. E o grupo é
 * `waitingOnMe`, não `waitingOnYou`.
 *
 * ⛔ NÃO EXISTE `vehiclesMissingIdentity`. O servidor não calcula esse grupo — a
 * régua de "o que falta na identidade" vive na tela de Veículos, que é onde o
 * conserto acontece. Ver o retorno deste pacote.
 */
export interface PortalSummary {
  responsible: {
    id: string;
    name: string | null;
    roles: string[];
    companyId: string | null;
    companyName: string | null;
  };
  sections: PortalSection[];
  capabilities: string[];
  budgets: {
    total: number;
    /** Todas as oito chaves, sempre presentes. */
    byStatus: Record<string, number>;
  };
  waitingOnMe: {
    preApproval: { available: boolean; total: number; budgets: PortalSummaryBudget[] };
    signatures: { available: boolean; total: number; envelopes: PortalSummaryEnvelope[] };
    inProduction: { available: boolean; total: number; vehicles: PortalSummaryVehicle[] };
  };
}

// ── AS COBRANÇAS ────────────────────────────────────────────────────────────

/**
 * ⚠️ A LINHA DE `/cliente/me/cobrancas` É UMA `Invoice`, NÃO UMA `Billing`.
 *
 * O tipo antigo chamava-se `PortalBilling` e declarava `{ budgetId, total,
 * installments[].value, invoices[] }`. O servidor entrega a FATURA viva
 * (`LIVE_INVOICE_WHERE`), com `totalAmount`/`paidAmount`, as parcelas em
 * `amount`, o boleto como OBJETO (linha digitável, código de barras e PIX — são
 * o instrumento de pagamento, e quem lê a rota é o pagador autenticado) e as
 * notas em `nfse`. A `Billing` aparece como um bloco ANINHADO, porque o estado
 * dela é outro ciclo.
 */
export interface PortalChargeInstallment {
  id: string;
  number: number | null;
  dueDate: string | null;
  amount: number | null;
  /** ⚠️ EXISTE. Pagamento PARCIAL de parcela é representável — não derive de `paidAt`. */
  paidAmount: number | null;
  paidAt: string | null;
  status: string | null;
  paymentMethod: string | null;
  bankSlip: PortalChargeBankSlip | null;
}

/**
 * O boleto COMPLETO, do ponto de vista de quem paga.
 *
 * ⛔ O que NÃO vem, e não deve ser pedido: `nossoNumero`, `txid`,
 * `sicrediStatus`, `errorMessage`, `errorCount`, `liquidationData`,
 * `lastSyncAt`, `pdfFileId` — é a operação interna da cobrança.
 *
 * ⚠️ E por isso NÃO HÁ arquivo de boleto para abrir. A tela antiga desenhava um
 * botão "Abrir" a partir de um `bankSlipFileId` que nunca existiu. O que o
 * cliente recebe é a LINHA DIGITÁVEL, o código de barras e o copia-e-cola do
 * PIX — que é o que ele de fato usa para pagar.
 */
export interface PortalChargeBankSlip {
  id: string;
  status: string | null;
  type: string | null;
  amount: number | null;
  dueDate: string | null;
  digitableLine: string | null;
  barcode: string | null;
  pixQrCode: string | null;
  paidAt: string | null;
}

/**
 * O QUADRO DO TOMADOR — o cadastro da PRÓPRIA empresa do contato.
 *
 * É o que ele está ali para conferir, e é o que a prefeitura exige na NFS-e.
 * `payerScopeSelect` garantiu que só o dele chegou até aqui.
 */
export interface PortalChargeCustomer {
  id: string;
  fantasyName: string | null;
  corporateName: string | null;
  cnpj: string | null;
  cpf: string | null;
  stateRegistration: string | null;
  municipalRegistration: string | null;
  streetType: string | null;
  address: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
}

export interface PortalChargePayer {
  id: string;
  customerId: string;
  customer: PortalChargeCustomer | null;
  paymentCondition: string | null;
  customPaymentText: string | null;
  /** O desconto é DO PAGADOR — nunca um campo do orçamento. */
  discountType: string | null;
  discountValue: number | null;
}

/** A NFS-e, como a cobrança a entrega. Só AUTORIZADA e com id na prefeitura. */
export interface PortalChargeNfse extends PortalNfseRef {
  elotechNfseId: string | null;
}

/** Um veículo coberto por esta cobrança. */
export interface PortalChargeVehicle {
  taskId: string;
  name: string | null;
  serialNumber: string | null;
  plate: string | null;
  customerOrderNumber: string | null;
}

/**
 * UMA COBRANÇA — a fatura viva de um orçamento.
 *
 * ⚠️ `billing.status` é `BILLING_STATUS`, e NÃO o estado do orçamento: são dois
 * ciclos, com valores de mesmo nome querendo dizer coisas diferentes ("Vencido"
 * aqui é parcela em atraso; lá não existe). Para pintar use
 * `BillingStatusBadge`, nunca `QuoteStatusBadge`. E `status` no TOPO é o da
 * `Invoice`, que é um terceiro ciclo ainda — não o desenhe como se fosse o da
 * cobrança.
 */
export interface PortalCharge {
  id: string;
  status: string | null;
  totalAmount: number | null;
  paidAmount: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  budget: {
    id: string;
    budgetNumber: number | null;
    status: PortalBudgetStatus;
    statusOrder: number | null;
  } | null;
  billing: {
    id: string;
    status: string | null;
    statusOrder: number | null;
    approvedAt: string | null;
  } | null;
  payer: PortalChargePayer | null;
  vehicles: PortalChargeVehicle[];
  installments: PortalChargeInstallment[];
  nfse: PortalChargeNfse[];
}

// ── AS DECISÕES ─────────────────────────────────────────────────────────────

/**
 * O que `PUT …/pre-aprovar` e `PUT …/recusar` devolvem.
 *
 * ⚠️ NÃO é o orçamento inteiro — é o recibo do ato. A tela relê o orçamento pela
 * invalidação do cache, que é o caminho que também conserta a lista e o resumo.
 */
export interface PortalDecisionResult {
  id: string;
  status: PortalBudgetStatus;
  decision: "PRE_APPROVE" | "REFUSE";
  decidedAt: string;
  decidedByResponsibleId: string;
  decisionNote: string | null;
}

/**
 * O CADASTRO QUE A REQUISIÇÃO REAPROVEITOU em vez de criar um segundo.
 *
 * ⛔ O CNPJ/CPF digitado no "Cadastrar cliente" que JÁ EXISTE não é mais 400. O
 * 400 era um beco: o cadastro pode estar FORA do escopo de quem envia, e então
 * nem a lista do combobox o encontra — e o que a pessoa fazia em seguida era
 * mudar uma letra do nome e criar um SEGUNDO cadastro da MESMA empresa, que
 * parte o faturamento em dois. Agora o documento manda: casou, a requisição
 * corre para o cadastro que já existe.
 *
 * ⚠️ E POR ISSO A TELA TEM DE DIZER. A pessoa digitou "Carrelli Implementos" e
 * a requisição nasceu para "Carrellii Implementos Rodoviarios"; trocar isso em
 * silêncio seria pior que a recusa que havia antes. `typedFantasyName` vem
 * preenchido exatamente quando os dois nomes diferem.
 *
 * ⚠️ NADA foi escrito no cadastro encontrado — nem nome, nem endereço, nem
 * inscrições. Ele é o registro-mestre da Ankaa.
 */
export interface PortalReusedCustomer {
  id: string;
  /** O nome fantasia COMO ESTÁ NO CADASTRO — não o que foi digitado. */
  fantasyName: string;
  /** Por qual documento ele foi encontrado. */
  matchedBy: "cnpj" | "cpf";
  /** O documento JÁ FORMATADO pelo servidor. A tela o cita como veio. */
  document: string;
  /** O nome digitado no formulário, SÓ quando difere do cadastrado. */
  typedFantasyName: string | null;
}

/**
 * O que `POST /cliente/me/orcamentos` devolve: o recibo da requisição.
 *
 * ⛔ `vehicles`, EM INGLÊS. O servidor monta `PortalRequisicaoCriada` com
 * `vehicles` (`portal-request.service.ts`); este tipo declarava `veiculos`, que
 * é um campo que a resposta NUNCA teve — e ler um campo inexistente não dá erro
 * de compilação nenhum, dá `undefined` em produção. É a mesma classe de defeito
 * que o contrato §4 registra em `canSign`/`podeAssinarAqui`.
 */
export interface PortalBudgetRequestResult {
  budgetId: string;
  budgetNumber: number | null;
  requestId: string;
  billingId?: string | null;
  payerId?: string | null;
  /** O dono dos veículos (`Task.customerId`) — criado, escolhido ou reaproveitado. */
  customerId?: string | null;
  /** O nome fantasia do cadastro que a requisição DE FATO usou. */
  customerName?: string | null;
  /** Verdadeiro só quando o cliente nasceu NESTA requisição. */
  customerCreated?: boolean;
  /**
   * Preenchido SÓ quando o documento digitado casou com um cadastro existente.
   *
   * ⚠️ `customerCreated === false` sozinho NÃO distingue "reaproveitou" de
   * "escolheu na lista" — escolher na lista devolve `customerReused: null`.
   */
  customerReused?: PortalReusedCustomer | null;
  vehicles: Array<{
    taskId: string;
    implementId: string | null;
    serialNumber: string | null;
    plate: string | null;
    chassisNumber: string | null;
    measureIds?: Record<string, string | null> | null;
  }>;
}

// =====================================================
// Leitores do recorte — para o `?.` não virar ruído
// =====================================================

/**
 * A identidade do veículo, ou `null` quando a seção `VEHICLE` não está no
 * recorte.
 *
 * ⚠️ `null` e NÃO um objeto de campos vazios. Um objeto vazio faria a tela do
 * contato de MARKETING (que só tem `LAYOUT`) desenhar "sem placa", "sem chassi"
 * e "sem série" em toda a frota — transformando um recorte de privilégio num
 * relatório de pendências falso.
 */
export function portalIdentityOf(
  vehicle: PortalVehicle | null | undefined,
): PortalVehicleIdentity | null {
  return vehicle?.identity ?? null;
}

/**
 * O que falta na identidade — DERIVADO, porque o servidor não manda booleano.
 *
 * ⚠️ Sem a seção `VEHICLE` a resposta é lista VAZIA, nunca "falta tudo": não
 * saber é diferente de faltar. Quem chama precisa distinguir os dois casos pelo
 * recorte, não por esta lista.
 */
export function portalMissingIdentity(
  vehicle: PortalVehicle | null | undefined,
): Array<"série" | "placa" | "chassi"> {
  const identity = portalIdentityOf(vehicle);
  if (!identity) return [];
  const missing: Array<"série" | "placa" | "chassi"> = [];
  if (!identity.serialNumber?.trim()) missing.push("série");
  if (!identity.plate?.trim()) missing.push("placa");
  if (!identity.chassisNumber?.trim()) missing.push("chassi");
  return missing;
}

/** O identificador humano do veículo: placa, senão série, senão o nome. */
export function portalVehicleLabel(vehicle: PortalVehicle | null | undefined): string {
  const identity = portalIdentityOf(vehicle);
  return (
    identity?.plate || identity?.serialNumber || vehicle?.name || "Veículo sem identificação"
  );
}

/** O valor de uma linha de serviço, cruzado de `pricing.items` pelo MESMO `id`. */
export function portalServiceAmount(budget: PortalBudget | null | undefined, serviceId: string): number | null {
  const item = budget?.pricing?.items.find((i) => i.id === serviceId);
  return typeof item?.amount === "number" ? item.amount : null;
}

// =====================================================
// Entradas de escrita
// =====================================================

/** Uma seção da medida de um lado, EM CENTÍMETROS (espelho de `portalSecaoSchema`). */
export interface PortalMeasureSectionInput {
  width: number;
  isDoor?: boolean;
  doorHeight?: number | null;
  position?: number;
}

/** A medida de um lado, EM CENTÍMETROS (espelho de `portalMedidaLadoSchema`). */
export interface PortalMeasureSideInput {
  height: number;
  sections: PortalMeasureSectionInput[];
}

/**
 * Um veículo da requisição.
 *
 * ⛔ PAR EXPLÍCITO (série, placa), NUNCA produto cartesiano. `Task.serialNumber`
 * e `Truck.plate` são `@unique` GLOBAIS: N placas × 1 série produz N tarefas com
 * a mesma série e o servidor devolve 400. Faixa de série ("1001 a 1005") expande
 * no CLIENTE, em 5 linhas editáveis, ANTES de enviar.
 */
export interface PortalBudgetRequestVehicleInput {
  /** ⚠️ TEXTO, não número — o caminho de criação por faixa só aceita numérico. */
  serialNumber?: string | null;
  /** 7 caracteres, `PLATE_REGEX`. */
  plate?: string | null;
  /** 17 caracteres, sem I/O/Q. */
  chassisNumber?: string | null;
  /**
   * CATEGORIA E IMPLEMENTO — valores de enum, nunca rótulo.
   *
   * ⚠️ O formulário pergunta UMA vez (o lote inteiro é o mesmo modelo de
   * implemento, como as medidas) e `buildSolicitacaoPayload` copia para cada
   * veículo — a mesma mecânica de `medidas`. O servidor grava um por `Truck`.
   */
  category?: string | null;
  implementType?: string | null;
  /**
   * ⚠️ CENTÍMETROS na borda; o servidor divide por 100 antes de gravar.
   *
   * ⚠️ E cada lado é `{ height, sections[] }`, NÃO um número solto — o implemento
   * tem altura e uma sequência de seções com portas. O tipo antigo declarava
   * `{ esquerda?: number }`, e um número onde o zod espera objeto vira
   * `invalid_type` na primeira requisição com medida.
   */
  medidas?: {
    esquerda?: PortalMeasureSideInput | null;
    direita?: PortalMeasureSideInput | null;
    traseira?: PortalMeasureSideInput | null;
  } | null;
}

/**
 * Cliente criado na hora, pelo combobox "criar".
 *
 * ⛔ EXIGIR `cnpj` OU `cpf` no zod do portal. `POST /customers/quick` pula esse
 * refine (o `customerQuickCreateSchema` do web nem declara `cpf`), e um cliente
 * sem documento trava a NFS-e lá na frente. O schema do servidor
 * (`portalNovoClienteSchema`) já o exige — o do formulário tem de exigir também,
 * senão o erro só aparece depois de o contato preencher a tela inteira.
 */
export interface PortalNewCustomerInput {
  fantasyName: string;
  cnpj?: string | null;
  cpf?: string | null;
  corporateName?: string | null;
  email?: string | null;
  streetType?: string | null;
  address?: string | null;
  addressNumber?: string | null;
  addressComplement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  phones?: string[];
  stateRegistration?: string | null;
  municipalRegistration?: string | null;
}

/** `POST /cliente/me/orcamentos` — a requisição. Nasce `REQUESTED`, sem itens. */
export interface PortalBudgetRequestInput {
  /** Um OU outro: cliente existente, ou cadastrado na hora. */
  customerId?: string;
  novoCliente?: PortalNewCustomerInput;
  /**
   * "Faturar Para" — vira o único `BudgetPayer` do orçamento.
   *
   * ⚠️ OPCIONAL, ao contrário do que o §5 do contrato diz. Com `novoCliente` ele
   * é IMPOSSÍVEL de preencher (o cliente ainda não tem id quando o formulário é
   * enviado), e o servidor documenta o desvio: ausente = o pagador É o dono dos
   * veículos.
   */
  faturarParaCustomerId?: string;
  briefing: string;
  logoName?: string | null;
  /** `Task.paintId` (tinta geral). `Budget` não tem campo de tinta. */
  paintId?: string;
  /** Tinta nova: o servidor cria a tinta antes de amarrar. */
  novaTinta?: { name: string; hex: string; finish: string; paintTypeId: string };
  veiculos: PortalBudgetRequestVehicleInput[];
}

/**
 * `PATCH /cliente/me/veiculos/:taskId/identificacao`. ✅ **NO AR desde 20/09.**
 *
 * ⚠️ AUSENTE (`undefined`) É "NÃO TOQUE"; `null` É "APAGUE". A distinção é o
 * contrato inteiro de um `PATCH`: um formulário que manda só a placa com os
 * demais em `null` APAGA série e chassi, com 200 na cara. Monte o corpo com as
 * chaves que a pessoa de fato mexeu.
 *
 * ⚠️ O servidor é `.strict()` nesta rota (ao contrário de `taskUpdateSchema`):
 * chave com nome errado é RECUSADA e nomeada, em vez de sumir em silêncio.
 */
export interface PortalVehicleIdentityInput {
  serialNumber?: string | null;
  plate?: string | null;
  chassisNumber?: string | null;
  /**
   * CATEGORIA E IMPLEMENTO — dado do cliente, e é ele quem corrige.
   *
   * ⚠️ Valor de ENUM (`TRUCK_CATEGORY` / `IMPLEMENT_TYPE`), nunca o rótulo em
   * português: a coluna no banco é enum e o servidor recusa o que não for um
   * dos valores. `null` apaga a escolha, que é legítimo — o cadastro nasce sem
   * os dois.
   *
   * ⛔ Os dois passam pela guarda do DOCUMENTO CONGELADO como a placa: a folha
   * assinada imprime "Truck · Frigorífico", então trocá-los depois da
   * assinatura devolve 409.
   */
  category?: string | null;
  implementType?: string | null;
  /**
   * O número do pedido de compra do cliente.
   *
   * ⛔ **SUB-PORTÃO**: só quem tem `WRITE_PURCHASE_ORDER` pode mandá-lo — o
   * gestor de frota escreve placa e chassi e **não** o pedido. Mandá-lo sem a
   * capacidade devolve **403**, e a tela não deveria oferecer o campo.
   *
   * ⛔ **E NÃO SE APAGA PELO PORTAL**: `null`/`''` devolve **400**. O número é
   * citado na NFS-e e no boleto; corrigi-lo é informar o novo, não esvaziar.
   *
   * ⚠️ A escrita é DUPLA no servidor (`Task.purchaseOrderId` +
   * `Task.customerOrderNumber`), delegada ao `PurchaseOrderService`.
   */
  purchaseOrderNumber?: string | null;
  /** `File.id` de uma plaqueta já enviada. Para enviar a IMAGEM, use o 3º argumento. */
  vinPlateFileId?: string | null;
}

/**
 * UMA COLISÃO DE UNICIDADE, como o servidor a nomeia.
 *
 * `Task.serialNumber` e `Truck.plate` são `@unique` GLOBAIS, e o servidor recusa
 * ANTES de escrever com `400 { message, errors[], conflicts[] }` — o mesmo
 * contrato de erro da requisição de orçamento. `conflicts[]` existe exatamente
 * para que o formulário marque O CAMPO em vermelho sem fazer parsing de frase:
 * ler o texto do `message` para adivinhar se foi a placa ou a série é o tipo de
 * acoplamento que quebra no dia em que alguém melhorar a redação.
 */
export interface PortalFieldConflict {
  /** O nome do campo NA API (`serialNumber`, `plate`) — o mesmo do corpo. */
  field: string;
  /** O valor culpado, para a tela poder citá-lo. */
  value: string | null;
  /** `'database'` quando outro veículo já o tem. */
  scope?: string;
  /** A frase que o servidor redigiu para ESTA colisão, quando redigiu alguma. */
  message: string | null;
}

/**
 * As colisões de um erro de escrita do portal — lista VAZIA quando não houve
 * nenhuma (o que inclui todo erro que não é 400 de unicidade).
 *
 * ⚠️ Lê `error.response.data`, e isso não contradiz a convenção do
 * `_statusCode`: o interceptor deste arquivo preserva o erro ORIGINAL do axios
 * justamente para que o CORPO continue alcançável. O que não se lê é o
 * `response.status`.
 */
export function portalErrorConflicts(error: unknown): PortalFieldConflict[] {
  const data = (error as AxiosError<{ conflicts?: unknown; errors?: unknown }> | undefined)?.response
    ?.data;
  const lista = (data as { conflicts?: unknown } | undefined)?.conflicts;
  if (!Array.isArray(lista)) return [];

  // `errors[]` vem NA MESMA ORDEM de `conflicts[]` (o servidor as monta no mesmo
  // laço). Parear por índice é o que dá à tela a frase pronta do servidor sem
  // redigir uma segunda, que divergiria da que o toast já mostrou.
  const frases = (data as { errors?: unknown } | undefined)?.errors;
  const frase = (i: number): string | null =>
    Array.isArray(frases) && typeof frases[i] === "string" ? (frases[i] as string) : null;

  const out: PortalFieldConflict[] = [];
  lista.forEach((item, i) => {
    const campo = (item as { field?: unknown } | null)?.field;
    // Colisão sem `field` não marca campo nenhum — e inventar um destino para
    // ela poria a mensagem sob o controle errado, que é pior que não marcar.
    if (typeof campo !== "string" || !campo) return;
    const valor = (item as { value?: unknown }).value;
    out.push({
      field: campo,
      value: typeof valor === "string" ? valor : null,
      scope: (item as { scope?: string }).scope,
      message: frase(i),
    });
  });
  return out;
}

/**
 * `POST /cliente/me/pedidos`.
 *
 * ⚠️ `POST /cliente/me/pedidos` reusa o pedido quando `(cliente, número)` já
 * existe — duplicar é ACRESCENTAR veículos, nunca erro.
 */
export interface PortalPurchaseOrderInput {
  number: string;
  /** ISO. Opcional — nem todo pedido tem data de emissão registrada. */
  issuedAt?: string | null;
  /** Os veículos que este pedido cobre. Pelo menos um. */
  taskIds: string[];
}

/**
 * `POST /cliente/me/assinaturas/:signerId/assinar` — assinatura POR SESSÃO.
 *
 * Sem `challengeId` e sem `code`: a autenticação É a sessão do portal
 * (`SignatureAuthMethod.RESPONSIBLE_SESSION`). O conjunto de declarações é o da
 * VARIANTE de sessão — sem `identity`, COM `authority`.
 *
 * Sem `identity` porque a posse do canal não é provada NESTE ato: foi provada no
 * login, por OTP. `authority` fica, e é a declaração que de fato importa em juízo
 * (CC art. 118 — ver `docs/BUDGET-SIGNATURE-DESIGN.md` §4.4).
 */
export interface PortalSignInput {
  declarations: string[];
  clientTimestamp?: string;
  geo?: { lat: number; lon: number; accuracy?: number } | null;
}

/**
 * O que o ato devolve — o estado DEPOIS de assinar.
 *
 * ⚠️ Não é a pendência atualizada: é o par que o envelope reporta
 * (`EnvelopeSignerStatus` + `EnvelopeStatus`). A fila volta pela invalidação do
 * cache, que é o aviso que de fato importa: o cartão some sozinho.
 */
export interface PortalSignResult {
  status: PortalSignerStatus;
  envelopeStatus: string;
}

/**
 * Um veículo coberto por um pedido de compra — a forma que o SERVIDOR devolve.
 *
 * ⚠️ `taskId`, e não `id`. É o mesmo identificador que volta em `taskIds` na
 * escrita, e o nome diz de qual entidade ele é: um `id` solto dentro de um
 * pedido de compra se lê como o id do VÍNCULO, que não existe.
 */
export interface PortalPurchaseOrderVehicle {
  taskId: string;
  /** Série, placa ou nome — já resolvido no servidor. */
  label: string;
  name: string | null;
  serialNumber: string | null;
  plate: string | null;
  /**
   * O espelho da coluna legada (`Task.customerOrderNumber`), exposto de
   * propósito: quando ele diverge de `number`, alguém escreveu a tarefa por um
   * caminho que não passa pelo `PurchaseOrder`.
   */
  customerOrderNumber: string | null;
}

/**
 * Um pedido de compra — `PurchaseOrderRow` de
 * `api/src/modules/production/purchase-order/purchase-order.service.ts`.
 *
 * O mesmo pedido aparece amarrado ao veículo em
 * `PortalVehicleIdentity.purchaseOrder` — lá é o vínculo, aqui é a entidade.
 *
 * ⛔ ESTE TIPO JÁ MENTIU. Ele declarava `customer: PortalCustomerRef` e
 * `tasks: […]`, e o servidor nunca mandou nem um nem outro: manda `customerId`
 * (string), `emitidoPor` e `veiculos`. O efeito não dava erro de compilação
 * nenhum — `pedido.tasks?.length` virava `0` e a coluna "Veículos" da tela de
 * pedidos imprimia zero para todo pedido, enquanto `existente.tasks.length`,
 * sem o `?.`, derrubava o diálogo assim que alguém digitasse um número
 * repetido. O servidor é a autoridade; este arquivo o copia, campo a campo.
 */
export interface PortalPurchaseOrder {
  id: string;
  number: string;
  issuedAt: string | null;
  createdAt: string;
  /** O DONO do pedido: quem o emitiu. Vem como id, não como objeto. */
  customerId: string;
  /** O contato do portal que informou o número. `null` quando foi um funcionário. */
  emitidoPor: PortalNamedRef | null;
  veiculos: PortalPurchaseOrderVehicle[];
}

/** A cerimônia de um signatário — espelho de `CeremonyKind` na api. */
export type PortalCeremonyKind = "OTP" | "INTERNAL" | "PORTAL";

/** O estado de um signatário dentro do envelope. */
export type PortalSignerStatus =
  | "PENDING"
  | "VIEWED"
  | "AUTHENTICATED"
  | "SIGNED"
  | "REFUSED"
  | "EXPIRED"
  | "VOIDED";

/**
 * Um veículo coberto pelo envelope que espera esta assinatura.
 *
 * ⛔ VEM DA PRÓPRIA ROTA DE ASSINATURAS, e é a correção que fechou o defeito de
 * duas telas: até aqui `PortalPendingSignature` não declarava veículo nenhum, e
 * a tela respondia "quais veículos deste orçamento estão sem número de pedido?"
 * lendo a FROTA INTEIRA (`GET /cliente/me/veiculos?take=500`) e filtrando no
 * navegador por `vehicle.budget.id`. Além de ser uma segunda requisição para um
 * dado que o envelope já conhece, `take: 500` estoura o teto de 100 do schema —
 * a tela abria com dois toasts vermelhos de "Parâmetros de consulta inválidos".
 *
 * ⚠️ VAZIO quando o recorte deste signatário não inclui `VEHICLE` — e vazio aqui
 * é "você não vê isto", NÃO "o orçamento não tem veículos". Quem responde a
 * segunda pergunta é `pedidoDeCompra`, que o servidor decide sobre a lista
 * completa, inclusive sobre o que este recorte não deixa listar.
 *
 * ⚠️ Hoje `VEHICLE` é seção OBRIGATÓRIA no servidor (`ALWAYS_SECTIONS`): ela
 * entra em todo recorte que assina, inclusive o do Marketing. Na prática a
 * lista nunca vem vazia com dado bom — mas a tela não pode depender disso, e o
 * `veiculos.length > 0` que decide desenhar o bloco é o que a mantém honesta.
 */
export interface PortalSignatureVehicle {
  /** `Task.id` — é ele que vai em `taskIds` de `POST /cliente/me/pedidos`. */
  taskId: string;
  name: string | null;
  /** Série, placa ou nome — o identificador humano, já resolvido no servidor. */
  label: string;
  serialNumber: string | null;
  plate: string | null;
  /** A coluna legada, que é a que a NFS-e e o `seuNumero` do boleto leem. */
  customerOrderNumber: string | null;
  purchaseOrder: { id: string; number: string; issuedAt: string | null } | null;
}

/**
 * Um envelope esperando a assinatura deste responsável, com o que a tela de
 * assinar precisa além do resumo.
 *
 * ⚠️ Não confundir com `PortalSummaryEnvelope`, de `GET /cliente/me/resumo`: lá
 * é o RESUMO que o Início desenha; aqui é o que a CERIMÔNIA precisa — as
 * declarações, o veredito do portão e a cláusula de aceite CONGELADA (em
 * `envelope.acceptanceClause`, nunca recomposta na tela).
 *
 * ⛔ ESTE TIPO JÁ MENTIU INTEIRO. Ele foi escrito como PROPOSTA, em inglês e
 * plano (`envelopeId`, `budgetNumber`, `sections`, `declarations`, `canSign`,
 * `blockedReason`), e o servidor devolve outra coisa: agrupada e em português
 * (`envelope`, `documento`, `declaracoes`, `pedidoDeCompra`). Nenhum dos campos
 * batia, e nada disso dava erro de compilação — `assinatura.canSign` era
 * `undefined`, o botão de assinar nascia desabilitado para TODO mundo, e
 * `assinatura.budgetNumber` imprimia "Orçamento nº undefined". É a mesma classe
 * de defeito que o cabeçalho deste arquivo documenta para `PortalVehicle`: a
 * forma é a do SERVIDOR, campo a campo.
 */
export interface PortalPendingSignature {
  /** `EnvelopeSigner.id` — é ele que vai na URL de `/assinar`. */
  signerId: string;
  status: PortalSignerStatus;
  /** Como esta coleta autentica o ato. */
  ceremony: PortalCeremonyKind;
  /**
   * O ato cabe NESTE portal?
   *
   * `false` é uma coleta antiga, emitida por código: ela aparece na fila (para
   * que o portal não diga "nada esperando por você" enquanto um orçamento
   * espera) e é resolvida pelo link pessoal, não aqui.
   */
  podeAssinarAqui: boolean;
  envelope: {
    id: string;
    /** `Budget.id` — o endereço do orçamento, para o link "ver o orçamento". */
    budgetId: string;
    status: string;
    budgetNumber: number;
    /** O prazo do envelope. */
    deadlineAt: string | null;
    /**
     * A cláusula de aceite, LIDA da coluna e nunca recomposta: é ela que o PDF
     * congelou, e recompô-la na tela faria o exibido divergir do assinado.
     */
    acceptanceClause: string | null;
  };
  /** O DOCUMENTO desta pessoa — o recorte dela, que pode não ser o inteiro. */
  documento: {
    id: string | null;
    sections: PortalSection[];
    /** O rótulo do recorte, já em português (`describeSections` do servidor). */
    label: string;
    isFull: boolean;
    sha256: string | null;
  };
  /** Segue o recorte: `null` para quem não recebeu `PRICING`. Já formatado em BRL. */
  total: string | null;
  /** Os veículos cobertos. Vazio sem a seção `VEHICLE` — ver `PortalSignatureVehicle`. */
  veiculos: PortalSignatureVehicle[];
  /**
   * ⛔ O PORTÃO DO PEDIDO DE COMPRA, JÁ JULGADO PELO SERVIDOR.
   *
   * Quem tem `PURCHASING` como ÚNICO papel (`exigido`) só assina com o número do
   * pedido na mão; sem ele o `POST …/assinar` devolve 403 com a frase de
   * `mensagem`. `pendente` é o veredito sobre TODOS os veículos do envelope —
   * inclusive os que este recorte não deixa a tela listar.
   */
  pedidoDeCompra: { exigido: boolean; pendente: boolean; mensagem: string | null };
  /**
   * As declarações que a cerimônia exige aceitar, na ordem de exibição, com o
   * TEXTO renderizado no servidor.
   *
   * ⚠️ Vazio quando `podeAssinarAqui` é `false`. O texto é montado lá e não aqui
   * porque é ele que será persistido byte a byte em `declarations`: compô-lo no
   * navegador faria o que foi exibido e o que foi guardado poderem divergir.
   */
  declaracoes: Array<{ key: string; text: string }>;
}

// =====================================================
// As chamadas
// =====================================================

const BASE = "/cliente/me";

/**
 * Monta o multipart do caminho com arquivo.
 *
 * O corpo vai num ÚNICO campo `payload`, como JSON. Não é estética: o corpo da
 * requisição tem objeto aninhado e lista (`veiculos[].medidas`), e multipart não
 * transporta isso sem uma convenção de colchetes que o Nest não desmonta
 * sozinho. Um campo, um `JSON.parse` no servidor, zero ambiguidade.
 */
function multipart(payload: unknown, files: Record<string, File[] | undefined>): FormData {
  const form = new FormData();
  form.append("payload", JSON.stringify(payload));
  for (const [field, list] of Object.entries(files)) {
    for (const file of list ?? []) form.append(field, file);
  }
  return form;
}

const MULTIPART: AxiosRequestConfig = { headers: { "Content-Type": "multipart/form-data" } };

/**
 * `status` vira UMA string separada por vírgula.
 *
 * O `statusSchema` do controller faz `String(value).split(',')` quando não
 * recebe array, e o controller documenta `?status=PENDING,IN_NEGOTIATION`.
 * Deixar o axios serializar (`status[]=A&status[]=B`) funciona por acidente do
 * `qs` do Express — e deixaria de funcionar no dia em que o parser de query
 * mudasse, sem erro nenhum, só com o filtro sumindo.
 */
function budgetListQuery(params?: PortalBudgetListParams): Record<string, unknown> | undefined {
  if (!params) return undefined;
  const { status, ...rest } = params;
  const list = Array.isArray(status) ? status : status ? [status] : [];
  return list.length ? { ...rest, status: list.join(",") } : rest;
}

/**
 * OS PARÂMETROS DA FROTA — `PortalListParams` com o `orderBy` DA COLUNA.
 *
 * ⛔ `Omit` e não `extends` direto: em `/cliente/me/veiculos` a chave `orderBy`
 * quer dizer outra coisa. Na lista de ORÇAMENTOS ela é o par `fila|recentes`
 * (a ordem de ATENÇÃO do contrato, que nenhum cabeçalho reordena); aqui a linha
 * é um VEÍCULO e o dono pediu coluna ordenável, então ela é a lista de
 * `campo:direção` que o `PORTAL_VEHICLE_SORT_FIELDS` do servidor conhece. Um
 * `extends` simples herdaria o tipo errado e o `tsc` deixaria passar o valor
 * errado — que o zod descartaria em silêncio, com 200 e a ordem antiga.
 */
export interface PortalVehicleListParams extends Omit<PortalListParams, "orderBy"> {
  /**
   * `["name:asc"]`, `["customer:desc","plate:asc"]`. Os nomes válidos são os de
   * `VEICULO_SORT_FIELD_MAP` (`components/cliente/veiculo/veiculo-table-columns`),
   * que é o espelho da allowlist do servidor.
   */
  orderBy?: string[];
}

/** `orderBy` vira UMA string separada por vírgula — ver `budgetListQuery`. */
function vehicleListQuery(params?: PortalVehicleListParams): Record<string, unknown> | undefined {
  if (!params) return undefined;
  const { orderBy, ...rest } = params;
  return orderBy?.length ? { ...rest, orderBy: orderBy.join(",") } : rest;
}

export class PortalService {
  // ---- Início ----

  /** `GET /cliente/me/resumo` — contadores + o que espera por mim. */
  async getSummary(): Promise<PortalResponse<PortalSummary>> {
    const response = await responsibleAuthClient.get<PortalResponse<PortalSummary>>(`${BASE}/resumo`);
    return response.data;
  }

  // ---- Orçamentos ----

  /** `GET /cliente/me/orcamentos` — lista escopada e paginada. */
  async getBudgets(params?: PortalBudgetListParams): Promise<PortalListResponse<PortalBudget>> {
    const response = await responsibleAuthClient.get<PortalListResponse<PortalBudget>>(
      `${BASE}/orcamentos`,
      { params: budgetListQuery(params) },
    );
    return response.data;
  }

  /** `GET /cliente/me/orcamentos/:id` — detalhe recortado por seção. */
  async getBudget(id: string): Promise<PortalResponse<PortalBudget>> {
    const response = await responsibleAuthClient.get<PortalResponse<PortalBudget>>(
      `${BASE}/orcamentos/${id}`,
    );
    return response.data;
  }

  /**
   * `POST /cliente/me/orcamentos` — a requisição. Capacidade `REQUEST_BUDGET`.
   *
   * `baseFiles`: até 30 arquivos-base, que viram `Task.baseFiles`. Com arquivos
   * a requisição vira multipart (corpo em `payload`); sem eles, é JSON puro.
   */
  async requestBudget(
    data: PortalBudgetRequestInput,
    baseFiles?: File[],
  ): Promise<PortalResponse<PortalBudgetRequestResult>> {
    if (baseFiles?.length) {
      const response = await responsibleAuthClient.post<PortalResponse<PortalBudgetRequestResult>>(
        `${BASE}/orcamentos`,
        multipart(data, { baseFiles }),
        MULTIPART,
      );
      return response.data;
    }
    const response = await responsibleAuthClient.post<PortalResponse<PortalBudgetRequestResult>>(
      `${BASE}/orcamentos`,
      data,
    );
    return response.data;
  }

  /**
   * `PUT …/pre-aprovar` — `IN_NEGOTIATION → PRE_APPROVED`. Capacidade `PRE_APPROVE`.
   *
   * ⚠️ O corpo é `.strict()` no servidor: a única chave aceita é `nota`.
   */
  async preApproveBudget(id: string, nota?: string): Promise<PortalResponse<PortalDecisionResult>> {
    const response = await responsibleAuthClient.put<PortalResponse<PortalDecisionResult>>(
      `${BASE}/orcamentos/${id}/pre-aprovar`,
      nota ? { nota } : {},
    );
    return response.data;
  }

  /**
   * `PUT …/recusar` — `IN_NEGOTIATION → REQUESTED`. Capacidade `PRE_APPROVE`.
   *
   * ⚠️ `motivo` é OBRIGATÓRIO: recusar sem dizer por quê devolve o orçamento ao
   * comercial sem nada para ele corrigir. O corpo é `.strict()` — mandar
   * `reason` em vez de `motivo` devolve erro nomeando a chave errada, em vez de
   * acusar um campo que o cliente jurou ter preenchido.
   */
  async refuseBudget(id: string, motivo: string): Promise<PortalResponse<PortalDecisionResult>> {
    const response = await responsibleAuthClient.put<PortalResponse<PortalDecisionResult>>(
      `${BASE}/orcamentos/${id}/recusar`,
      { motivo },
    );
    return response.data;
  }

  // ---- Veículos ----

  /**
   * `GET /cliente/me/veiculos` — a frota escopada, PAGINADA E ORDENÁVEL.
   *
   * ⚠️ `orderBy` viaja como UMA string separada por vírgula, pelo mesmo motivo
   * que `status` na lista de orçamentos: o `vehicleOrderBySchema` do controller
   * faz `String(value).split(',')` e documenta essa forma. Deixar o axios
   * serializar (`orderBy[]=a&orderBy[]=b`) funciona por acidente do `qs` do
   * Express e deixaria de funcionar sem erro nenhum, só com a ordem sumindo.
   */
  async getVehicles(params?: PortalVehicleListParams): Promise<PortalListResponse<PortalVehicleDetail>> {
    const response = await responsibleAuthClient.get<PortalListResponse<PortalVehicleDetail>>(
      `${BASE}/veiculos`,
      { params: vehicleListQuery(params) },
    );
    return response.data;
  }

  /** `GET /cliente/me/veiculos/:taskId` — veículo + andamento. */
  async getVehicle(taskId: string): Promise<PortalResponse<PortalVehicleDetail>> {
    const response = await responsibleAuthClient.get<PortalResponse<PortalVehicleDetail>>(
      `${BASE}/veiculos/${taskId}`,
    );
    return response.data;
  }

  /**
   * `PATCH …/identificacao` — série, placa, chassi, plaqueta e nº do pedido.
   * ✅ **NO AR desde 20/09.** Ver `PortalVehicleIdentityInput`.
   *
   * `vinPlateFile` é a FOTO da plaqueta; com ela a chamada vira multipart, no
   * campo `truckVinPlate` — o mesmo par (`vinPlateId` no corpo × arquivo novo no
   * multipart) que o `task-edit-form` do sistema interno já usa.
   */
  async updateVehicleIdentity(
    taskId: string,
    data: PortalVehicleIdentityInput,
    vinPlateFile?: File | null,
  ): Promise<PortalResponse<PortalVehicleDetail>> {
    if (vinPlateFile) {
      const response = await responsibleAuthClient.patch<PortalResponse<PortalVehicleDetail>>(
        `${BASE}/veiculos/${taskId}/identificacao`,
        multipart(data, { implementVinPlate: [vinPlateFile] }),
        MULTIPART,
      );
      return response.data;
    }
    const response = await responsibleAuthClient.patch<PortalResponse<PortalVehicleDetail>>(
      `${BASE}/veiculos/${taskId}/identificacao`,
      data,
    );
    return response.data;
  }

  // ---- Pedidos de compra ----

  /**
   * `GET /cliente/me/pedidos` — PAGINADA E BUSCÁVEL, como toda lista do portal.
   *
   * ⚠️ `take` tem teto de 100 no servidor. A tela desta lista rodava em modo
   * `client` com `take: 500` para poder buscar no navegador, e toda abertura
   * voltava 400. Quem precisa procurar manda `searchingFor` — o `WHERE` olha o
   * número do pedido e a série/placa/nome dos veículos que ele cobre.
   */
  async getPurchaseOrders(params?: PortalListParams): Promise<PortalListResponse<PortalPurchaseOrder>> {
    const response = await responsibleAuthClient.get<PortalListResponse<PortalPurchaseOrder>>(
      `${BASE}/pedidos`,
      { params },
    );
    return response.data;
  }

  /**
   * `POST /cliente/me/pedidos`. Capacidade `WRITE_PURCHASE_ORDER`.
   *
   * ⚠️ `number` é único DENTRO do cliente (`@@unique([customerId, number])`).
   * Repetir o número do mesmo cliente devolve conflito; dois clientes com o
   * pedido "1" convivem.
   */
  async createPurchaseOrder(data: PortalPurchaseOrderInput): Promise<PortalResponse<PortalPurchaseOrder>> {
    const response = await responsibleAuthClient.post<PortalResponse<PortalPurchaseOrder>>(
      `${BASE}/pedidos`,
      data,
    );
    return response.data;
  }

  // ---- Assinaturas ----

  /** `GET /cliente/me/assinaturas`. */
  async getPendingSignatures(): Promise<PortalListResponse<PortalPendingSignature>> {
    const response = await responsibleAuthClient.get<PortalListResponse<PortalPendingSignature>>(
      `${BASE}/assinaturas`,
    );
    return response.data;
  }

  /**
   * `POST /cliente/me/assinaturas/:signerId/assinar`.
   *
   * ⚠️ O que volta em `data` NÃO é a pendência: é o par
   * `{ status, envelopeStatus }` depois do ato. Quem quiser a fila atualizada
   * relê a lista — e a mutation já invalida o cache inteiro do portal.
   */
  async sign(signerId: string, data: PortalSignInput): Promise<PortalResponse<PortalSignResult>> {
    const response = await responsibleAuthClient.post<PortalResponse<PortalSignResult>>(
      `${BASE}/assinaturas/${signerId}/assinar`,
      data,
    );
    return response.data;
  }

  // ---- Cobranças ----

  /** `GET /cliente/me/cobrancas` — parcelas, boletos, NFS-e. Exige a seção `PAYMENT`. */
  async getCharges(params?: PortalListParams): Promise<PortalListResponse<PortalCharge>> {
    const response = await responsibleAuthClient.get<PortalListResponse<PortalCharge>>(
      `${BASE}/cobrancas`,
      { params },
    );
    return response.data;
  }
}

/** Filtros da lista de orçamentos. */
export interface PortalBudgetListParams extends PortalListParams {
  /** Um estado ou vários — o servidor monta `where.status = { in: [...] }`. */
  status?: PortalBudgetStatus | PortalBudgetStatus[];
}

export const portalService = new PortalService();

/**
 * O MESMO objeto, com o nome curto.
 *
 * `portalService` segue o molde dos demais `api-client/*` (`noteService`,
 * `fileService`); `portalApi` é o apelido pelo qual as telas do portal já o
 * chamam. Um objeto, dois nomes — nunca duas instâncias.
 */
export const portalApi = portalService;

// ---- Funções soltas, no molde dos demais `api-client/*` ----

export const getPortalSummary = () => portalService.getSummary();
export const getPortalBudgets = (params?: PortalBudgetListParams) => portalService.getBudgets(params);
export const getPortalBudget = (id: string) => portalService.getBudget(id);
export const requestPortalBudget = (data: PortalBudgetRequestInput, baseFiles?: File[]) =>
  portalService.requestBudget(data, baseFiles);
export const preApprovePortalBudget = (id: string, nota?: string) => portalService.preApproveBudget(id, nota);
export const refusePortalBudget = (id: string, motivo: string) => portalService.refuseBudget(id, motivo);
export const getPortalVehicles = (params?: PortalVehicleListParams) => portalService.getVehicles(params);
export const getPortalVehicle = (taskId: string) => portalService.getVehicle(taskId);
export const updatePortalVehicleIdentity = (
  taskId: string,
  data: PortalVehicleIdentityInput,
  vinPlateFile?: File | null,
) => portalService.updateVehicleIdentity(taskId, data, vinPlateFile);
export const getPortalPurchaseOrders = (params?: PortalListParams) => portalService.getPurchaseOrders(params);
export const createPortalPurchaseOrder = (data: PortalPurchaseOrderInput) =>
  portalService.createPurchaseOrder(data);
export const getPortalPendingSignatures = () => portalService.getPendingSignatures();
export const signPortalEnvelope = (signerId: string, data: PortalSignInput) =>
  portalService.sign(signerId, data);
export const getPortalCharges = (params?: PortalListParams) => portalService.getCharges(params);

// =====================================================
// Chaves de cache
// =====================================================

/**
 * ⚠️ Lista e detalhe têm segmentos PRÓPRIOS (`list` / `detail`). Sem isso a
 * chave da lista seria PREFIXO da chave do detalhe e invalidar uma derrubaria a
 * outra — o molde é o `createQueryKeyStore` da casa.
 *
 * Vive aqui, e não em `hooks/common/query-keys.ts`, porque o portal é uma árvore
 * separada (provider próprio, cliente HTTP próprio) e porque aquele arquivo é
 * caminho de colisão entre agentes.
 */
export const portalKeys = {
  all: ["portal"] as const,
  summary: () => ["portal", "resumo"] as const,
  budgets: () => ["portal", "orcamentos", "list"] as const,
  budgetList: (params?: PortalBudgetListParams) => ["portal", "orcamentos", "list", params ?? {}] as const,
  budget: (id: string) => ["portal", "orcamentos", "detail", id] as const,
  vehicles: () => ["portal", "veiculos", "list"] as const,
  vehicleList: (params?: PortalVehicleListParams) => ["portal", "veiculos", "list", params ?? {}] as const,
  vehicle: (taskId: string) => ["portal", "veiculos", "detail", taskId] as const,
  purchaseOrders: (params?: PortalListParams) => ["portal", "pedidos", "list", params ?? {}] as const,
  signatures: () => ["portal", "assinaturas", "list"] as const,
  charges: (params?: PortalListParams) => ["portal", "cobrancas", "list", params ?? {}] as const,
};

// =====================================================
// Hooks
// =====================================================

/** Opções do hook — SEPARADAS dos params, que viram query string. */
export interface PortalQueryOptions {
  enabled?: boolean;
  staleTime?: number;
  refetchOnWindowFocus?: boolean;
}

/**
 * ⚠️ `retry: false` em tudo.
 *
 * O padrão global de `main.tsx` decide o retry por `error.response.status`, e
 * um 403 do portão de papel NÃO deixa de ser 403 na segunda tentativa — seriam
 * três chamadas e três toasts para dizer a mesma coisa. O portal falha rápido e
 * explica.
 */
const PORTAL_QUERY_DEFAULTS = { retry: false as const };

/**
 * ⚠️ A PÁGINA ANTERIOR FICA NA TELA ENQUANTO A SEGUINTE VIAJA — e é por isso
 * que o rodapé para de se desabilitar sozinho.
 *
 * Paginar (ou ordenar, ou buscar) TROCA a `queryKey`. Sem isto o react-query
 * devolve `undefined` até a resposta chegar, a tela repassa `rowCount = 0`, o
 * TanStack calcula `getPageCount() = 0`, o rodapé colapsa para "1 de 1" e
 * DESABILITA o botão de avançar — no instante exato em que o contato clica de
 * novo. Era o "a paginação das tabelas não está funcionando" de TODAS as listas
 * do portal, e é a armadilha nº 3 escrita em
 * `components/ui/datatable/pagination-url-sync.test.tsx`.
 *
 * `keepPreviousData` é a resposta idiomática da v5: as linhas velhas seguem
 * visíveis, `isPlaceholderData` marca que são velhas, e `meta.totalRecords`
 * nunca passa por zero. Vale para TODA lista paginada deste arquivo — as quatro
 * têm rodapé, e as quatro tinham o mesmo defeito.
 *
 * ⛔ Não vai em `usePortalSummary` nem em `usePortalPendingSignatures`: a chave
 * delas não tem parâmetro, nunca troca, e `placeholderData` ali seria ruído.
 *
 * ⚠️ CONSEQUÊNCIA ACEITA: com dado anterior na mão, `isLoading` fica FALSO
 * durante a troca de página — a tabela mostra a página velha em vez do
 * esqueleto. É o comportamento desejado (é o mesmo da lista de Faturamento), e
 * o `effectiveRowCount` do `DataTable` continua sendo o cinto de segurança.
 */
const PORTAL_LIST_DEFAULTS = {
  ...PORTAL_QUERY_DEFAULTS,
  placeholderData: keepPreviousData,
};

/** `GET /cliente/me/resumo`. A tela de Início inteira sai daqui. */
export function usePortalSummary(options?: PortalQueryOptions) {
  return useQuery({
    queryKey: portalKeys.summary(),
    queryFn: () => getPortalSummary(),
    // Um minuto: é um painel de "o que espera por mim", não um relógio.
    staleTime: options?.staleTime ?? 1000 * 60,
    enabled: options?.enabled ?? true,
    refetchOnWindowFocus: options?.refetchOnWindowFocus,
    ...PORTAL_QUERY_DEFAULTS,
  });
}

export function usePortalBudgets(params?: PortalBudgetListParams, options?: PortalQueryOptions) {
  return useQuery({
    queryKey: portalKeys.budgetList(params),
    queryFn: () => getPortalBudgets(params),
    staleTime: options?.staleTime ?? 0,
    enabled: options?.enabled ?? true,
    refetchOnWindowFocus: options?.refetchOnWindowFocus,
    ...PORTAL_LIST_DEFAULTS,
  });
}

export function usePortalBudget(id: string | undefined, options?: PortalQueryOptions) {
  return useQuery({
    queryKey: portalKeys.budget(id ?? ""),
    queryFn: () => getPortalBudget(id as string),
    enabled: (options?.enabled ?? true) && !!id,
    staleTime: options?.staleTime ?? 0,
    refetchOnWindowFocus: options?.refetchOnWindowFocus,
    ...PORTAL_QUERY_DEFAULTS,
  });
}

export function usePortalVehicles(params?: PortalVehicleListParams, options?: PortalQueryOptions) {
  return useQuery({
    queryKey: portalKeys.vehicleList(params),
    queryFn: () => getPortalVehicles(params),
    staleTime: options?.staleTime ?? 0,
    enabled: options?.enabled ?? true,
    refetchOnWindowFocus: options?.refetchOnWindowFocus,
    ...PORTAL_LIST_DEFAULTS,
  });
}

export function usePortalVehicle(taskId: string | undefined, options?: PortalQueryOptions) {
  return useQuery({
    queryKey: portalKeys.vehicle(taskId ?? ""),
    queryFn: () => getPortalVehicle(taskId as string),
    enabled: (options?.enabled ?? true) && !!taskId,
    staleTime: options?.staleTime ?? 0,
    refetchOnWindowFocus: options?.refetchOnWindowFocus,
    ...PORTAL_QUERY_DEFAULTS,
  });
}

export function usePortalPurchaseOrders(params?: PortalListParams, options?: PortalQueryOptions) {
  return useQuery({
    queryKey: portalKeys.purchaseOrders(params),
    queryFn: () => getPortalPurchaseOrders(params),
    staleTime: options?.staleTime ?? 0,
    enabled: options?.enabled ?? true,
    refetchOnWindowFocus: options?.refetchOnWindowFocus,
    ...PORTAL_LIST_DEFAULTS,
  });
}

export function usePortalPendingSignatures(options?: PortalQueryOptions) {
  return useQuery({
    queryKey: portalKeys.signatures(),
    queryFn: () => getPortalPendingSignatures(),
    staleTime: options?.staleTime ?? 0,
    enabled: options?.enabled ?? true,
    refetchOnWindowFocus: options?.refetchOnWindowFocus,
    ...PORTAL_QUERY_DEFAULTS,
  });
}

export function usePortalCharges(params?: PortalListParams, options?: PortalQueryOptions) {
  return useQuery({
    queryKey: portalKeys.charges(params),
    queryFn: () => getPortalCharges(params),
    staleTime: options?.staleTime ?? 0,
    enabled: options?.enabled ?? true,
    refetchOnWindowFocus: options?.refetchOnWindowFocus,
    ...PORTAL_LIST_DEFAULTS,
  });
}

/**
 * Invalida TODO o cache do portal.
 *
 * É grosso de propósito: pré-aprovar um orçamento muda o resumo, a lista, o
 * detalhe e — quando o comercial lança o envelope — a fila de assinaturas.
 * Invalidação cirúrgica aqui só produziria tela desatualizada.
 */
function useInvalidatePortal() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: portalKeys.all });
}

// ⚠️ NENHUMA destas mutations toasta: o interceptor no topo deste arquivo já
// toasta erro de API e sucesso de escrita. Toastar aqui é a mesma frase duas vezes.

export function usePortalRequestBudget() {
  const invalidate = useInvalidatePortal();
  return useMutation({
    mutationFn: ({ data, baseFiles }: { data: PortalBudgetRequestInput; baseFiles?: File[] }) =>
      requestPortalBudget(data, baseFiles),
    onSuccess: invalidate,
  });
}

export function usePortalPreApproveBudget() {
  const invalidate = useInvalidatePortal();
  return useMutation({
    mutationFn: ({ id, nota }: { id: string; nota?: string }) => preApprovePortalBudget(id, nota),
    onSuccess: invalidate,
  });
}

export function usePortalRefuseBudget() {
  const invalidate = useInvalidatePortal();
  return useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) => refusePortalBudget(id, motivo),
    onSuccess: invalidate,
  });
}

export function usePortalUpdateVehicleIdentity() {
  const invalidate = useInvalidatePortal();
  return useMutation({
    mutationFn: ({
      taskId,
      data,
      vinPlateFile,
    }: {
      taskId: string;
      data: PortalVehicleIdentityInput;
      vinPlateFile?: File | null;
    }) => updatePortalVehicleIdentity(taskId, data, vinPlateFile),
    onSuccess: invalidate,
  });
}

export function usePortalCreatePurchaseOrder() {
  const invalidate = useInvalidatePortal();
  return useMutation({
    mutationFn: (data: PortalPurchaseOrderInput) => createPortalPurchaseOrder(data),
    onSuccess: invalidate,
  });
}

export function usePortalSign() {
  const invalidate = useInvalidatePortal();
  return useMutation({
    mutationFn: ({ signerId, data }: { signerId: string; data: PortalSignInput }) =>
      signPortalEnvelope(signerId, data),
    onSuccess: invalidate,
  });
}
