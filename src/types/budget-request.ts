/**
 * A REQUISIÇÃO que deu origem a um orçamento — o que o cliente mandou antes de
 * existir preço.
 *
 * 1:1 com `Budget`, e MORA FORA dele de propósito (`schema.prisma`, modelo
 * `BudgetRequest`): o que está em `Budget` corre o risco de entrar na projeção
 * material da assinatura e derrubar uma coleta em curso, e briefing e nome de
 * logomarca são conversa comercial, não cláusula do instrumento. Aqui também
 * ficam as DECISÕES do lado do cliente — pré-aprovação e recusa —, que são atos
 * de pessoas do cliente e não da Ankaa.
 *
 * Ausente = orçamento criado por dentro, pelo comercial. É o caso da imensa
 * maioria, e por isso toda leitura desta relação é opcional.
 *
 * ⚠️ Vive AQUI, e não em `types/budget.ts`, porque aquele arquivo é a espinha do
 * ciclo do orçamento e está fechado nesta rodada. Quando a costura final unir os
 * pacotes, o lugar natural de `Budget.request` é lá.
 */
export interface BudgetRequest {
  id: string;
  budgetId: string;

  /** Quem abriu a requisição no portal, e quando. */
  requestedByResponsibleId: string;
  requestedBy?: BudgetRequestActor | null;
  requestedAt: Date | string;

  /** O texto livre que o cliente escreveu explicando o serviço. */
  briefing: string;

  /**
   * Nome da logomarca a aplicar, quando há. TEXTO — a ARTE vem nos
   * `Task.baseFiles`, que é onde o resto do sistema procura imagem de origem.
   */
  logoName?: string | null;

  /** PRÉ-APROVAÇÃO: o vendedor do cliente clicou em Aprovar. */
  preApprovedAt?: Date | string | null;
  preApprovedByResponsibleId?: string | null;
  preApprovedBy?: BudgetRequestActor | null;

  /**
   * RECUSA na pré-aprovação. NÃO é cancelamento: o orçamento volta para o
   * comercial refazer, e o motivo é o que ele precisa ler.
   */
  refusedAt?: Date | string | null;
  refusedByResponsibleId?: string | null;
  refusedBy?: BudgetRequestActor | null;

  /** Justificativa da decisão — preenchida na pré-aprovação OU na recusa. */
  decisionNote?: string | null;

  createdAt?: Date | string;
  updatedAt?: Date | string;
}

/**
 * O recorte de `Responsible` que esta tela usa. Deliberadamente minúsculo: a
 * tela interna precisa de um NOME para atribuir o ato, e nada mais — telefone,
 * CPF e e-mail de contato do cliente não têm por que trafegar num painel de
 * requisição.
 */
export interface BudgetRequestActor {
  id: string;
  name: string;
  roles?: string[];
}

/**
 * A requisição deste orçamento, quando a consulta a trouxe.
 *
 * ⚠️ `Budget` (em `types/budget.ts`) ainda NÃO declara `request` — aquele arquivo
 * é a espinha e está fechado nesta rodada. O acesso passa por aqui, num único
 * ponto, para que a costura final precise mexer em um lugar só.
 *
 * ⚠️ AUSENTE NÃO QUER DIZER "não houve requisição": quer dizer "não perguntei".
 * Hoje `GET /budgets/task/:taskId` tem `include` FIXO no repositório e não traz a
 * relação; enquanto a API não a acrescentar, este painel simplesmente não
 * aparece — que é o comportamento certo para um orçamento nascido por dentro, e
 * o motivo de nada aqui lançar erro.
 */
export function budgetRequestOf(budget: unknown): BudgetRequest | null {
  const request = (budget as { request?: unknown } | null | undefined)?.request;
  if (!request || typeof request !== 'object') return null;
  const candidate = request as Partial<BudgetRequest>;
  // `briefing` é NOT NULL no banco: sem ele o que chegou não é uma requisição.
  return typeof candidate.briefing === 'string' ? (candidate as BudgetRequest) : null;
}

/**
 * O estado da decisão do cliente sobre a requisição.
 *
 * ⚠️ `refused` vem ANTES de `preApproved` na leitura, espelhando o CHECK do
 * banco (pré-aprovado E recusado ao mesmo tempo é recusado pelo banco): se um
 * dia os dois carimbos coexistirem por algum caminho não previsto, a tela
 * mostra a RECUSA — que é o lado que faz o comercial agir.
 */
export type BudgetRequestDecision = 'refused' | 'preApproved' | 'pending';

export function budgetRequestDecision(request: BudgetRequest): BudgetRequestDecision {
  if (request.refusedAt) return 'refused';
  if (request.preApprovedAt) return 'preApproved';
  return 'pending';
}
