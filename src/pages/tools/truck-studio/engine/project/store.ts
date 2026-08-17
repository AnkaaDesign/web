/* A BIBLIOTECA: os projetos salvos neste navegador.
   ---------------------------------------------------------------------------
   É o que "Salvar" e "Abrir" movem. O arquivo `.ankaastudio` (./file.ts) é o que
   "Exportar" e "Importar" movem, e é ele que atravessa máquinas — esta camada
   nunca sai daqui.

   POR QUE IndexedDB E NÃO localStorage

   O estúdio já usa `localStorage` em cinco lugares, então a pergunta é legítima.
   A resposta é o TAMANHO e o TIPO:

     · a cota de `localStorage` é da ordem de 5 MB POR ORIGEM, compartilhada com
       todo o resto do Ankaa. Um projeto com três logos já passa disso sozinho, e
       o modo de falha é uma exceção de cota no meio do `setItem` — que é
       exatamente o que `livery-doc.persistNow()` engole hoje, e por isso ele é
       "conveniência" e não uma biblioteca;
     · `localStorage` guarda STRING. Uma imagem teria de virar base64 (+33 %)
       para entrar e ser decodificada para sair. O IndexedDB guarda `Blob`
       nativo, por clonagem estruturada: os bytes vão e voltam como bytes.

   E o acesso é assíncrono, que é o que impede uma biblioteca de vinte projetos
   de travar a interface ao ser listada.

   ---------------------------------------------------------------------------
   O DESENHO DAS DUAS LOJAS, e por que são duas

     `meta`  → um registro leve por projeto: id, nome, data, rótulos, miniatura.
     `docs`  → o documento inteiro, pesado, indexado pelo mesmo id.

   `listProjects()` lê SÓ a `meta`. Sem a separação, abrir o menu leria os
   documentos inteiros de todos os projetos — dezenas de megabytes de JSON
   desserializados para desenhar uma lista de nomes. Com ela, a lista custa
   alguns kB e o documento só é lido quando alguém escolhe um.

   A miniatura mora na `meta` de propósito, apesar de ser a maior coisa lá: ela
   É o que a lista mostra, e buscá-la na outra loja transformaria uma leitura em
   N+1. */
import type { StudioProject } from './schema';

const DB_NAME = 'truckstudio';
/* v1. Uma versão nova pede um `onupgradeneeded` que MIGRE — nunca um
   `deleteObjectStore`, que apagaria os projetos de quem já salvou. */
const DB_VERSION = 1;
const STORE_META = 'meta';
const STORE_DOCS = 'docs';

/** A linha da lista: tudo que a interface precisa sem tocar no documento. */
export interface ProjectMeta {
  id: string;
  name: string;
  /** epoch ms — ordenação, e a data que a lista mostra */
  savedAt: number;
  /** de que caminhão é este projeto, para a lista dizer sem abrir nada */
  model?: string;
  color?: string;
  environment?: string;
  thumb?: Blob;
  /** tamanho aproximado do documento, em bytes. Só para a lista informar. */
  bytes?: number;
}

/* ---------------- a conexão ---------------- */

let dbPromise: Promise<IDBDatabase> | null = null;

/** IndexedDB não existe em algumas configurações (Firefox em janela privada de
 *  versões antigas, políticas corporativas). Não é fatal: sem biblioteca, o
 *  estúdio continua inteiro e Exportar/Importar continuam funcionando. */
export const canStore = () => typeof indexedDB !== 'undefined';

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!canStore()) { reject(new Error('IndexedDB indisponível neste navegador.')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_META)) {
        const s = db.createObjectStore(STORE_META, { keyPath: 'id' });
        /* O índice é o que deixa a lista sair já ordenada do banco em vez de
           ser ordenada em memória depois de lida inteira. */
        s.createIndex('savedAt', 'savedAt');
      }
      if (!db.objectStoreNames.contains(STORE_DOCS)) {
        db.createObjectStore(STORE_DOCS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      /* ARMAZENAMENTO PERSISTENTE, pedido uma vez.
         Sem isto o IndexedDB é `best-effort`: sob pressão de disco o navegador
         pode DESCARTAR a biblioteca inteira sem avisar ninguém — e o menu promete
         "salvo na biblioteca deste navegador", que é uma promessa mais forte do
         que o padrão entrega. Pedir não custa nada e o navegador decide sozinho
         (o Chrome concede por engajamento; o Firefox pergunta).
         Recusa NÃO é erro: a biblioteca continua funcionando, só sem garantia —
         e é por isso que Exportar existe, que é o que de fato atravessa máquina.
         `void` + `catch` porque um navegador sem a API não pode derrubar o open. */
      void navigator.storage?.persist?.().catch(() => false);
      /* Outra aba pediu uma versão nova. Fechar aqui é o que a deixa migrar em
         vez de ficar bloqueada para sempre — e a próxima operação desta aba
         reabre no esquema novo. */
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    /* ⚠️ `onblocked` FALTAVA, e a falta é latente até o primeiro `DB_VERSION = 2`.
       Com outra aba do estúdio segurando uma conexão da versão antiga, o `open`
       fica BLOQUEADO: `onsuccess` não dispara, `onerror` não dispara, e a
       promessa nunca assenta — o "Salvando o projeto…" fica pendurado para
       sempre. É o mesmo modo de falha que `done()` logo abaixo se deu ao
       trabalho de eliminar para o `abort`, chegando pela outra porta. */
    req.onblocked = () => reject(new Error(
      'Feche as outras abas do estúdio para a biblioteca poder ser atualizada.'));
    req.onerror = () => reject(req.error ?? new Error('Não foi possível abrir a biblioteca.'));
  });
  /* Uma falha de abertura NÃO PODE FICAR MEMOIZADA: a próxima tentativa tem de
     poder dar certo (a cota pode ter sido liberada, a aba privada fechada). */
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

/** Promisifica uma transação: resolve no `complete`, rejeita no `error`/`abort`. */
function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Falha ao gravar na biblioteca.'));
    /* `abort` é o caminho da COTA ESTOURADA, e ele não passa por `onerror` da
       transação em todos os motores. Sem esta linha, salvar um projeto grande
       num disco cheio ficaria pendurado para sempre. */
    tx.onabort = () => reject(tx.error ?? new Error('A gravação foi cancelada (cota de armazenamento?).'));
  });
}

function ask<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Falha ao ler a biblioteca.'));
  });
}

/* ---------------- operações ---------------- */

/** Um id que não colide e que ordena por tempo, sem depender de `crypto.randomUUID`
 *  (ausente em contexto inseguro, que é onde o desktop às vezes roda). */
function newId(): string {
  const rnd = Math.floor(Math.random() * 0xffffff).toString(36).padStart(5, '0');
  return `p${Date.now().toString(36)}${rnd}`;
}

export interface SaveOptions {
  /** Atualiza um projeto existente. Sem isto, cria um novo. */
  id?: string;
  thumb?: Blob | null;
}

/**
 * Grava um projeto e devolve o registro da lista.
 *
 * AS DUAS LOJAS NUMA TRANSAÇÃO SÓ. Se a `meta` entrasse e o `doc` falhasse por
 * cota, a lista mostraria um projeto que não abre — e não haveria como o usuário
 * saber que aquela linha é uma mentira. Uma transação sobre as duas lojas faz o
 * par ser tudo ou nada.
 */
export async function saveProject(
  doc: StudioProject, name: string, opts: SaveOptions = {},
): Promise<ProjectMeta> {
  const db = await open();
  const id = opts.id ?? newId();
  const savedAt = Date.now();
  const stored: StudioProject = { ...doc, name };

  const meta: ProjectMeta = {
    id,
    name,
    savedAt,
    model: doc.labels?.model,
    color: doc.labels?.color,
    environment: doc.labels?.environment,
    /* Numa regravação sem miniatura nova, a antiga não é apagada: quem salva
       com a janela minimizada não pode perder a imagem que já tinha. */
    ...(opts.thumb ? { thumb: opts.thumb } : {}),
    bytes: estimateBytes(stored),
  };

  if (!opts.thumb && opts.id) {
    const prev = await getMeta(opts.id);
    if (prev?.thumb) meta.thumb = prev.thumb;
  }

  const tx = db.transaction([STORE_META, STORE_DOCS], 'readwrite');
  tx.objectStore(STORE_META).put(meta);
  tx.objectStore(STORE_DOCS).put({ id, doc: stored });
  await done(tx);
  return meta;
}

/** A lista, do mais recente para o mais antigo. */
export async function listProjects(): Promise<ProjectMeta[]> {
  const db = await open();
  const tx = db.transaction(STORE_META, 'readonly');
  const rows = await ask(tx.objectStore(STORE_META).index('savedAt').getAll());
  return (rows as ProjectMeta[]).reverse();
}

export async function getMeta(id: string): Promise<ProjectMeta | null> {
  const db = await open();
  const tx = db.transaction(STORE_META, 'readonly');
  return (await ask(tx.objectStore(STORE_META).get(id))) as ProjectMeta ?? null;
}

export async function loadProject(id: string): Promise<StudioProject | null> {
  const db = await open();
  const tx = db.transaction(STORE_DOCS, 'readonly');
  const row = await ask(tx.objectStore(STORE_DOCS).get(id)) as { doc?: StudioProject } | undefined;
  return row?.doc ?? null;
}

export async function deleteProject(id: string): Promise<void> {
  const db = await open();
  const tx = db.transaction([STORE_META, STORE_DOCS], 'readwrite');
  tx.objectStore(STORE_META).delete(id);
  tx.objectStore(STORE_DOCS).delete(id);
  await done(tx);
}

/* ---------------- tamanho ---------------- */

/**
 * Quantos bytes este documento ocupa, aproximadamente.
 *
 * APROXIMADO DE PROPÓSITO, e a aproximação é medir só as imagens: elas são
 * ordens de grandeza maiores que todo o resto junto, e um `JSON.stringify` do
 * documento inteiro só para contar caracteres alocaria uma string do tamanho do
 * documento — a coisa exata que este módulo existe para não fazer.
 *
 * Um data URL base64 tem 4 caracteres por 3 bytes, daí o ×3/4.
 */
function estimateBytes(doc: StudioProject): number {
  let total = 0;
  const walk = (list: { src?: string; objects?: unknown[] }[] | undefined) => {
    for (const n of list ?? []) {
      if (!n || typeof n !== 'object') continue;
      if (typeof n.src === 'string' && n.src.startsWith('data:')) {
        total += Math.round((n.src.length - n.src.indexOf(',') - 1) * 0.75);
      }
      if (Array.isArray(n.objects)) walk(n.objects as { src?: string }[]);
    }
  };
  for (const surface of Object.values(doc.livery ?? {})) {
    walk(surface?.o?.objects as { src?: string }[] | undefined);
  }
  /* Um piso para o estado que não é imagem — a plotagem de um baú cheio de
     texto é da ordem de dezenas de kB, e mostrar "0 B" para ela seria pior do
     que mostrar um número redondo. */
  return total + 24 * 1024;
}

/** `1,4 MB`. pt-BR, porque é o que a lista mostra. */
export function formatBytes(n: number | undefined): string {
  if (!n || n < 1024) return `${n ?? 0} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${Math.round(kb)} kB`;
  return `${(kb / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
}
