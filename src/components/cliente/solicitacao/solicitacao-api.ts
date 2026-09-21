// web/src/components/cliente/solicitacao/solicitacao-api.ts
//
// O QUE ESTA TELA PRECISA LER E QUE O CONTRATO §4 NÃO PREVIU.
//
// A escrita da requisição é de `api-client/portal.ts` (pacote WEB-1) e é de lá
// que a página a chama: `usePortalRequestBudget()`. Este arquivo NÃO a duplica.
//
// TRÊS LEITURAS de catálogo que o contrato §4 não previu e sem as quais o
// assistente não tem o que oferecer nos comboboxes. Elas JÁ EXISTEM no servidor
// (`api/src/modules/people/portal/portal-catalog.controller.ts`):
//
//     GET /cliente/me/clientes         → combobox "Cliente" e "Faturar Para"
//     GET /cliente/me/tintas           → combobox de pintura geral
//     GET /cliente/me/tipos-de-tinta   → `novaTinta.paintTypeId`
//
// ⚠️ NÃO dá para usar `getCustomers`/`getPaints` do sistema interno: aqueles vão
// pelo `apiClient` do FUNCIONÁRIO, que injeta o bearer errado e, no 401,
// desloga o funcionário que estiver usando a mesma máquina.
//
// ⚠️ A BUSCA É DO SERVIDOR, e tem de ser. O `Combobox` em modo `async` NÃO
// filtra nada localmente (`filteredOptions` devolve as opções como vieram) —
// filtrar aqui só peneiraria a primeira página, e "azul" não acharia a tinta
// número 300. Os nomes dos parâmetros são contrato: `searchingFor`, `page` e
// `take`, exatamente como `portalCatalogQuerySchema` os declara. Zod descarta
// chave desconhecida em SILÊNCIO — um `?q=` chegaria lá como "sem busca" e
// devolveria a primeira página inteira parecendo funcionar.
//
// SE UMA DELAS CAIR a tela continua utilizável: toda falha de leitura devolve
// lista vazia, o combobox de cliente ainda oferece a empresa do próprio contato
// mais "Cadastrar cliente", e o de tinta ainda oferece "Cadastrar cor" — que é
// o caminho de `novoCliente`/`novaTinta` que §5 previu.
//
// ⚠️ `suppressToast`: o interceptor de `portal.ts` toasta TODO erro desta
// instância de axios. Uma busca de catálogo que falha não pode empilhar
// "Não encontrado" sobre o formulário — quem lida com a ausência é a tela.
import type { AxiosRequestConfig } from "axios";
import { responsibleAuthClient } from "@/api-client/responsible-auth";
import type { PortalListResponse } from "@/api-client/portal";

/**
 * O cliente como o combobox do portal o mostra.
 *
 * ⚠️ DECLARADO AQUI, e não importado de `portal.ts`. Ele era um alias de
 * `PortalCustomerRef`, que é o espelho de um `select` REAL do servidor
 * (`{ id, fantasyName, corporateName }`) — e este tipo descreve a resposta de
 * OUTRA rota, `GET /cliente/me/clientes` (ver o cabeçalho), que devolve o
 * documento. Amarrar a proposta ao espelho fazia o tipo do servidor parecer ter
 * `cnpj` e `cpf`, que ele não tem, e um dia alguém leria `budget.customer.cnpj`
 * e receberia `undefined` em produção.
 *
 * O documento entra aqui porque é por ele que o contato reconhece o cliente na
 * lista — e é isso que a busca por CNPJ do catálogo devolve.
 */
export interface PortalCustomerOption {
  id: string;
  fantasyName: string | null;
  corporateName?: string | null;
  cnpj?: string | null;
  cpf?: string | null;
}

export interface PortalPaintOption {
  id: string;
  name: string;
  hex?: string | null;
  finish?: string | null;
  paintType?: { id: string; name: string } | null;
}

export interface PortalPaintTypeOption {
  id: string;
  name: string;
}

export interface PagedResult<T> {
  data: T[];
  hasMore: boolean;
}

const PAGE_SIZE = 20;
/** O interceptor de `portal.ts` entende esta chave. Ver o cabeçalho. */
const SILENT = { metadata: { suppressToast: true } } as unknown as AxiosRequestConfig;

/**
 * "Tem mais página?" — `hasNextPage` quando o servidor o manda, senão a conta
 * com `totalRecords`/`take`, que é o que §10 garante existir no envelope.
 */
function hasMoreFrom(meta: PortalListResponse<unknown>["meta"], page: number, received: number): boolean {
  if (typeof meta?.hasNextPage === "boolean") return meta.hasNextPage;
  const total = meta?.totalRecords;
  const take = meta?.take ?? PAGE_SIZE;
  if (typeof total === "number") return page * take < total;
  return received >= take;
}

/**
 * Leitura de catálogo NUNCA derruba o passo.
 *
 * O contato está no meio de um formulário longo; uma busca que falha devolve
 * lista vazia e deixa a opção "criar" de pé — não aborta o que ele digitou.
 */
async function safeList<T>(path: string, params: Record<string, unknown>, page: number): Promise<PagedResult<T>> {
  try {
    const { data } = await responsibleAuthClient.get<PortalListResponse<T>>(path, {
      ...SILENT,
      params,
    });
    const rows = Array.isArray(data?.data) ? data.data : [];
    return { data: rows, hasMore: hasMoreFrom(data?.meta, page, rows.length) };
  } catch {
    return { data: [], hasMore: false };
  }
}

export function buscarClientesDoPortal(search: string, page = 1): Promise<PagedResult<PortalCustomerOption>> {
  return safeList<PortalCustomerOption>(
    "/cliente/me/clientes",
    { searchingFor: search?.trim() || undefined, page, take: PAGE_SIZE },
    page,
  );
}

export function buscarTintasDoPortal(search: string, page = 1): Promise<PagedResult<PortalPaintOption>> {
  return safeList<PortalPaintOption>(
    "/cliente/me/tintas",
    { searchingFor: search?.trim() || undefined, page, take: PAGE_SIZE },
    page,
  );
}

export async function listarTiposDeTinta(): Promise<PortalPaintTypeOption[]> {
  const { data } = await safeList<PortalPaintTypeOption>(
    "/cliente/me/tipos-de-tinta",
    { take: 100 },
    1,
  );
  return data;
}
