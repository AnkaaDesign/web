/* O ARQUIVO `.ankaastudio` — o projeto como um documento que se manda para
   outra pessoa.
   ---------------------------------------------------------------------------
   POR QUE UM ZIP, E NÃO UM JSON

   Um `.json` com as imagens em `data:` resolve tudo isto em vinte linhas, e foi
   a primeira ideia. Ele cai por causa das IMAGENS, que são o volume real de um
   projeto de plotagem:

     · base64 custa +33 % — 40 MB de logos viram 54 MB de arquivo;
     · e, o que decide: tudo tem de passar por UMA string. `JSON.stringify` de
       54 MB aloca a string inteira antes de qualquer byte ir para o disco, e
       `JSON.parse` na volta trava a thread principal por segundos. Num arquivo
       que a pessoa acabou de receber e quer abrir, esse é o pior lugar
       possível para um congelamento.

   O ZIP separa as duas naturezas: o estado é texto e comprime muito (o JSON do
   fabric é repetitivo — DEFLATE tira 80 % dele), as imagens são binárias e já
   vêm comprimidas, então entram com `STORE` — gastar CPU recomprimindo um PNG
   rende zero. E o resultado abre em qualquer descompactador, que é o que faz um
   formato sobreviver a quem o escreveu.

     projeto.ankaastudio
     ├── manifest.json     identidade, versão, integridade, origem
     ├── project.json      o documento (./document.ts), sem as imagens
     ├── assets/<sha>.png  cada imagem, byte a byte
     └── preview.jpg       miniatura — não é estado, é para reconhecer o arquivo

   ---------------------------------------------------------------------------
   O ENDEREÇO DE UM ASSET É O HASH DO CONTEÚDO DELE

   `assets/9f2c1a…8b.png`, e isso dá três coisas de graça:

     1. **deduplicação.** O mesmo logo aplicado nas duas laterais e na traseira é
        UMA entrada no ZIP, não três. Numa plotagem espelhada isso é metade do
        arquivo;
     2. **integridade sem tabela extra.** O nome já É o digest; conferir é
        re-hashar o que saiu do ZIP e comparar com o próprio caminho;
     3. **estabilidade.** Salvar duas vezes sem mexer em nada gera dois arquivos
        com os mesmos caminhos internos, então dá para comparar dois projetos com
        um `diff` de `unzip -l`.

   ---------------------------------------------------------------------------
   INTEGRIDADE

   `manifest.json` traz o sha-256 de `project.json` e de cada asset. Um arquivo
   truncado num anexo de e-mail, ou editado à mão por alguém curioso, é pego na
   LEITURA e não vira uma cena silenciosamente diferente. `crypto.subtle` exige
   contexto seguro — o app é HTTPS e `localhost` também conta —, e quando ele
   não existe a gravação segue sem digest em vez de recusar: um arquivo sem
   conferência é pior que um com, e muito melhor que nenhum arquivo.

   O JSZip é `await import()` — ele já é dependência deste app (cinco telas o
   usam), mas não tem por que entrar no chunk do estúdio para quem nunca vai
   clicar em Exportar. */
/* De ./schema e NÃO de ./document: aquele importa `scene/scene.ts`, que
   constrói um WebGLRenderer no escopo de módulo — importá-lo daqui tornaria
   este arquivo impossível de carregar fora de um navegador, e é justamente ele
   que precisa de teste (ver ./file.spec.ts). */
import { PROJECT_KIND, PROJECT_VERSION, parseProject } from './schema';
import type { StudioProject } from './schema';
import type { LiverySurfaceState } from '../vehicle/livery-doc';

/** A extensão. Própria de propósito: um `.zip` genérico convidaria a abrir e
 *  mexer, e um duplo-clique num nome que o sistema não conhece leva a pessoa de
 *  volta para o botão Importar, que é onde ela precisa estar. */
export const PROJECT_EXT = 'ankaastudio';

/* Um zip é um zip; declarar o tipo certo é o que faz o anexo sobreviver a
   provedores de e-mail que sniffam conteúdo. */
const ZIP_MIME = 'application/zip';

const PATH_MANIFEST = 'manifest.json';
const PATH_PROJECT = 'project.json';
const PATH_ASSETS = 'assets/';
const PATH_PREVIEW = 'preview.jpg';

interface FileManifest {
  kind: typeof PROJECT_KIND;
  version: number;
  /** app + versão do documento, para uma mensagem legível num arquivo futuro */
  producer: string;
  savedAt: string;
  name?: string;
  /** caminho → sha-256 hex. Ausente quando `crypto.subtle` não existe. */
  digest?: Record<string, string>;
  /** de onde saiu. Diagnóstico apenas — nada aqui é aplicado. */
  origin?: { href?: string };
}

/* ---------------- sha-256 ---------------- */

const hex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');

/** `null` quando o navegador não oferece `crypto.subtle` (contexto inseguro). */
async function sha256(bytes: Uint8Array): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  try {
    /* `slice()` normaliza a view para um ArrayBuffer próprio: `digest` recusa uma
       view que não cubra o buffer inteiro em alguns motores. */
    return hex(await subtle.digest('SHA-256', bytes.slice().buffer));
  } catch { return null; }
}

/* ---------------- data URL ↔ bytes ---------------- */

interface DecodedImage { bytes: Uint8Array; mime: string; ext: string }

const EXT_OF: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
  'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/avif': 'avif',
};

function decodeDataUrl(url: string): DecodedImage | null {
  const comma = url.indexOf(',');
  if (comma < 0) return null;
  const head = url.slice(5, comma);                 // pula "data:"
  if (!head.endsWith(';base64')) return null;       // só base64 nos interessa
  const mime = head.slice(0, -';base64'.length) || 'image/png';
  try {
    const bin = atob(url.slice(comma + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes, mime, ext: EXT_OF[mime] ?? 'bin' };
  } catch { return null; }
}

function encodeDataUrl(bytes: Uint8Array, mime: string): string {
  /* Em pedaços: `String.fromCharCode(...bytes)` num logo de alguns MB estoura o
     limite de argumentos da chamada e derruba a importação com um
     "Maximum call stack size exceeded" que não diz nada sobre imagem nenhuma. */
  let s = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:${mime};base64,${btoa(s)}`;
}

/* ---------------- as imagens do documento ----------------
   Um documento carrega imagem em MAIS DE UM LUGAR, e a lista cresce: hoje é o
   `src` de cada objeto do fabric (em qualquer profundidade) e o `thumb` de cada
   chave do percurso de câmera. Amanhã é outra coisa.

   Por isso a varredura devolve SLOTS — um par ler/escrever por campo — em vez de
   os dois caminhos serem escritos duas vezes, um na gravação e outro na leitura.
   Com slots, `writeProjectFile` e `readProjectFile` compartilham literalmente a
   mesma enumeração, e um campo novo entra numa linha em `imageSlots()` em vez de
   em quatro laços que precisam concordar entre si. Um campo que entrasse só na
   gravação viraria uma imagem que sai e não volta — silenciosamente. */
interface ImageSlot {
  get(): string | undefined;
  set(v: string): void;
}

type Node = { src?: string; objects?: Node[] };

/* RECURSIVA, pelo mesmo motivo que a de livery-doc.ts: um `Group` aninha os
   filhos em `objects`, e uma imagem agrupada é uma imagem. */
function walkSrc(list: Node[] | undefined, visit: (n: Node) => void) {
  for (const n of list ?? []) {
    if (!n || typeof n !== 'object') continue;
    visit(n);
    if (Array.isArray(n.objects)) walkSrc(n.objects, visit);
  }
}

/** Todos os campos de imagem do documento, prontos para ler e reescrever. */
function imageSlots(doc: StudioProject): ImageSlot[] {
  const out: ImageSlot[] = [];

  const surfaces = Object.values(doc.livery ?? {})
    .filter((s): s is LiverySurfaceState => !!s?.o);
  for (const surface of surfaces) {
    walkSrc(surface.o.objects as Node[] | undefined, (n) => {
      out.push({ get: () => n.src, set: (v) => { n.src = v; } });
    });
  }

  /* As miniaturas do percurso. São até 24 e cada uma é um quadro da cena — o
     maior grupo de bytes depois dos logos, e o que faz um percurso montado valer
     a pena reabrir: sem elas a tira volta com placas numeradas e ninguém
     reconhece qual ponto é qual. */
  for (const k of doc.timeline ?? []) {
    out.push({ get: () => k.thumb ?? undefined, set: (v) => { k.thumb = v || null; } });
  }

  return out;
}

/* ---------------- ESCREVER ---------------- */

export interface WriteOptions {
  /** miniatura JPEG. Opcional — o arquivo abre sem ela. */
  preview?: Blob | null;
}

/**
 * O documento → um Blob `.ankaastudio`.
 *
 * O `doc` NÃO é mutado: o `src` de cada imagem é trocado por um caminho dentro
 * do ZIP, e isso acontece sobre um CLONE. Mutar destruiria o documento vivo do
 * chamador — que, no caminho de Salvar, é o mesmo objeto que a biblioteca vai
 * guardar logo em seguida, e ele iria para lá apontando para caminhos de dentro
 * de um zip que a biblioteca não tem.
 */
export async function writeProjectFile(
  doc: StudioProject, opts: WriteOptions = {},
): Promise<Blob> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  /* CÓPIA PROFUNDA e barata: o documento é JSON puro por construção (é o que
     `captureProject()` produz), então esta é a clonagem certa e a única que
     garante que o `src` trocado abaixo não vaze para o objeto do chamador. */
  const out = JSON.parse(JSON.stringify(doc)) as StudioProject;

  /* Uma imagem, uma entrada — mesmo conteúdo em faces diferentes cai no mesmo
     caminho, e o Map é o que impede de gravá-la duas vezes. */
  const assets = new Map<string, DecodedImage>();
  let anonymous = 0;

  for (const slot of imageSlots(out)) {
    const src = slot.get();
    if (typeof src !== 'string' || !src.startsWith('data:')) continue;
    const img = decodeDataUrl(src);
    if (!img) continue;
    const digest = await sha256(img.bytes);
    /* Sem `crypto.subtle` o endereço vira um contador. Perde a deduplicação e
       a conferência; não perde o arquivo, que é o que importa. */
    const stem = digest ?? `a${++anonymous}`;
    const path = `${PATH_ASSETS}${stem}.${img.ext}`;
    if (!assets.has(path)) assets.set(path, img);
    slot.set(path);
  }

  for (const [path, img] of assets) {
    /* STORE, e não DEFLATE: PNG/JPEG/WebP já são fluxos comprimidos. Deflatá-los
       gasta CPU proporcional ao tamanho para ganhar frações de por cento — e é
       justamente sobre os megabytes que esse desperdício incide. */
    zip.file(path, img.bytes, { compression: 'STORE' });
  }

  const projectJson = JSON.stringify(out);
  const projectBytes = new TextEncoder().encode(projectJson);

  const digest: Record<string, string> = {};
  const projectDigest = await sha256(projectBytes);
  if (projectDigest) digest[PATH_PROJECT] = projectDigest;
  for (const [path] of assets) {
    /* O caminho JÁ é o digest quando ele existe — repetir a conta seria pagar
       duas vezes pelo mesmo número. */
    const stem = path.slice(PATH_ASSETS.length).replace(/\.[^.]+$/, '');
    if (stem.length === 64) digest[path] = stem;
  }

  const manifest: FileManifest = {
    kind: PROJECT_KIND,
    version: PROJECT_VERSION,
    producer: `truck-studio/${PROJECT_VERSION}`,
    savedAt: out.savedAt ?? new Date().toISOString(),
    name: out.name,
    ...(Object.keys(digest).length ? { digest } : {}),
    origin: { href: location.origin },
  };

  /* O MANIFESTO PRIMEIRO NO ZIP, de propósito: um leitor que só queira saber "o
     que é este arquivo?" acha a resposta nos primeiros kilobytes, sem
     descomprimir o projeto inteiro. */
  zip.file(PATH_MANIFEST, JSON.stringify(manifest, null, 2));
  zip.file(PATH_PROJECT, projectJson, { compression: 'DEFLATE' });
  if (opts.preview) zip.file(PATH_PREVIEW, opts.preview, { compression: 'STORE' });

  return zip.generateAsync({
    type: 'blob',
    mimeType: ZIP_MIME,
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

/* ---------------- LER ---------------- */

export interface ReadResult {
  doc: StudioProject;
  /** Miniatura embutida, se o arquivo trouxer uma. */
  preview: Blob | null;
  /** Problemas de INTEGRIDADE (não de compatibilidade — essa é do document). */
  problems: string[];
}

/** Uma falha que o usuário pode entender e agir sobre. */
export class ProjectFileError extends Error {}

/**
 * Um `.ankaastudio` → o documento, com as imagens de volta em `data:`.
 *
 * TOLERANTE COM O QUE NÃO DECIDE, INTRANSIGENTE COM O QUE DECIDE. Um asset que
 * falta ou não confere vira um problema RELATADO e a imagem correspondente sai
 * do documento — abrir um projeto sem um dos cinco logos é muito melhor do que
 * não abrir. Já `project.json` ausente, ilegível ou com digest errado é o fim:
 * ali não há metade que se aproveite.
 */
export async function readProjectFile(input: Blob): Promise<ReadResult> {
  const JSZip = (await import('jszip')).default;

  let zip: InstanceType<typeof JSZip>;
  try {
    zip = await JSZip.loadAsync(input);
  } catch {
    throw new ProjectFileError(
      `Este arquivo não é um projeto do estúdio (esperado um .${PROJECT_EXT}).`,
    );
  }

  const entry = zip.file(PATH_PROJECT);
  if (!entry) {
    throw new ProjectFileError(
      `O arquivo não contém "${PATH_PROJECT}" — ele não foi gerado pelo Truck Studio.`,
    );
  }

  const problems: string[] = [];

  let manifest: FileManifest | null = null;
  const manifestEntry = zip.file(PATH_MANIFEST);
  if (manifestEntry) {
    try { manifest = JSON.parse(await manifestEntry.async('string')) as FileManifest; }
    catch { problems.push('O manifesto do arquivo está ilegível; a conferência de integridade foi pulada.'); }
  }

  if (manifest && manifest.kind !== PROJECT_KIND) {
    throw new ProjectFileError('Este arquivo é de outra ferramenta, não do Truck Studio.');
  }
  /* MAIOR, e não diferente: um documento de versão MENOR é lido pelos
     validadores campo a campo (é a mesma política de `restoreSceneState`). Um
     de versão maior traz campos cujo significado este código não conhece, e
     abri-lo seria adivinhar. */
  if (manifest && manifest.version > PROJECT_VERSION) {
    throw new ProjectFileError(
      `Este projeto foi salvo por uma versão mais nova do estúdio `
      + `(formato ${manifest.version}, este app lê até ${PROJECT_VERSION}). Atualize a página.`,
    );
  }

  const projectBytes = await entry.async('uint8array');
  const wantProject = manifest?.digest?.[PATH_PROJECT];
  if (wantProject && (await sha256(projectBytes)) !== wantProject) {
    throw new ProjectFileError(
      'O arquivo está corrompido: o conteúdo não confere com a assinatura dele. '
      + 'Peça uma cópia nova para quem enviou.',
    );
  }

  let raw: unknown;
  try { raw = JSON.parse(new TextDecoder().decode(projectBytes)); }
  catch { throw new ProjectFileError('O conteúdo do projeto está ilegível.'); }

  const doc = parseProject(raw);
  if (!doc) throw new ProjectFileError('O conteúdo do arquivo não é um projeto do estúdio.');

  /* ---- as imagens de volta ----
     Lidas UMA vez por caminho: o mesmo logo em três faces é uma leitura e três
     referências à mesma string, exatamente como era antes de sair. */
  const cache = new Map<string, string | null>();

  const load = async (path: string): Promise<string | null> => {
    if (cache.has(path)) return cache.get(path) ?? null;
    let url: string | null = null;
    const f = zip.file(path);
    if (!f) {
      problems.push(`A imagem "${path}" não está no arquivo e foi descartada.`);
    } else {
      const bytes = await f.async('uint8array');
      const stem = path.slice(PATH_ASSETS.length).replace(/\.[^.]+$/, '');
      /* O caminho é o digest; conferir é re-hashar e comparar com ele. Só vale
         quando o nome TEM cara de digest — arquivos gravados sem `crypto.subtle`
         usam um contador, e cobrar assinatura deles reprovaria imagens boas. */
      if (stem.length === 64 && (await sha256(bytes)) !== stem) {
        problems.push(`A imagem "${path}" está corrompida e foi descartada.`);
      } else {
        const ext = /\.([^.]+)$/.exec(path)?.[1]?.toLowerCase() ?? '';
        const mime = Object.keys(EXT_OF).find((m) => EXT_OF[m] === ext) ?? 'image/png';
        url = encodeDataUrl(bytes, mime);
      }
    }
    cache.set(path, url);
    return url;
  };

  for (const slot of imageSlots(doc)) {
    const path = slot.get();
    if (typeof path !== 'string' || !path.startsWith(PATH_ASSETS)) continue;
    /* Uma imagem que não veio sai como string VAZIA e não como o caminho: o
       fabric tentaria buscar `assets/…png` na ORIGEM DO APP e a requisição 404
       iria para o console de todo mundo que abrisse o projeto. Do lado da
       timeline, o slot traduz vazio de volta para `null`, que é o valor que
       aquele módulo entende por "sem miniatura". */
    slot.set((await load(path)) ?? '');
  }

  let preview: Blob | null = null;
  const previewEntry = zip.file(PATH_PREVIEW);
  if (previewEntry) {
    /* `uint8array` + `new Blob`, e NÃO `async('blob')`. O tipo `blob` do JSZip
       depende de o ambiente ter `Blob`/`BlobBuilder` do jeito que ele espera, e
       fora do navegador ele devolve um objeto que só parece um Blob — sem
       `arrayBuffer()`, sem `type`. Construir o Blob aqui é o mesmo resultado no
       navegador e o resultado CERTO em qualquer outro lugar (foi assim que o
       teste pegou). E é onde o `type: image/jpeg` entra, que `async('blob')` não
       preenche. */
    try {
      /* `.slice().buffer`, o MESMO idioma de `sha256()` acima, e pela mesma
         razão: sob as libs novas do TS um `Uint8Array` é
         `Uint8Array<ArrayBufferLike>`, que admite `SharedArrayBuffer` e portanto
         não satisfaz `BlobPart`. `slice()` devolve uma cópia com buffer próprio
         e não-compartilhado, então a asserção descreve o que de fato existe em
         tempo de execução em vez de silenciar o compilador. */
      const bytes = await previewEntry.async('uint8array');
      preview = new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'image/jpeg' });
    } catch { /* a miniatura é enfeite */ }
  }

  if (manifest?.name && !doc.name) doc.name = manifest.name;

  return { doc, preview, problems };
}

/* ---------------- nome de arquivo ---------------- */

/** Um pedaço de nome seguro em qualquer sistema — a MESMA regra de ui/chrome.ts.
 *  A faixa combinante vai escapada (`̀-ͯ`) e não como os caracteres
 *  literais: são glifos invisíveis, e um `git diff` que os mostre como um
 *  quadradinho é a forma mais fácil de alguém "limpar" o regex e quebrar a
 *  remoção de acento sem perceber. */
const slug = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/**
 * O nome sugerido do download.
 *
 * Leva o nome do projeto quando há um, e senão o CAMINHÃO — quem exporta cinco
 * variações para comparar precisa distinguir os arquivos na pasta de downloads,
 * e "projeto (3).ankaastudio" não distingue nada. A data entra sempre, pela
 * mesma razão.
 */
export function projectFilename(doc: StudioProject): string {
  const L = doc.labels ?? {};
  const parts = [doc.name, L.model, L.color].map((p) => slug(p || '')).filter(Boolean);
  const base = parts.length ? parts.join('-') : 'truck-studio';
  const day = (doc.savedAt ?? new Date().toISOString()).slice(0, 10);
  return `${base}-${day}.${PROJECT_EXT}`;
}
