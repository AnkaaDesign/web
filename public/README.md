# `public/` — convenção de organização

Tudo aqui é servido **cru na raiz do site** (`/`). Não passa pelo bundler: o
Vite copia o diretório inteiro para `dist/` sem tocar em nada. Consequência
prática que dita toda a convenção abaixo:

> **O TypeScript não enxerga estes caminhos.** Renomear um arquivo daqui não
> gera erro de compilação nem de build — gera um 404 silencioso em produção.

Por isso a regra única:

## Regra de ouro

**Nenhum caminho de `public/` é escrito à mão no código.** Todos vivem em
[`src/config/assets.ts`](../src/config/assets.ts), e o código importa de lá:

```ts
import { BRAND_ASSETS } from '@/config/assets';

<img src={BRAND_ASSETS.logo} />                    // JSX
`<img src="${BRAND_ASSETS.logo}" class="logo" />`  // HTML dentro de template literal
```

Ao mover qualquer coisa dentro de `public/`, **edite só `src/config/assets.ts`**
— e, se o que moveu for consumido por manifesto, os manifestos listados adiante.

## A raiz é um contrato, não uma pasta

Ficam soltos na raiz **apenas** os arquivos que o navegador, o SO ou o service
worker buscam por convenção em `/`. Essa lista não deve crescer:

| Arquivo | Por que não pode sair da raiz |
|---|---|
| `favicon.ico` | O navegador busca `/favicon.ico` sozinho em contexto sem HTML (404 do nginx, favorito, aba restaurada), sem passar pelo `<link>` do `index.html`. |
| `site.webmanifest` | `start_url` e `scope` são `/`; manifesto na raiz é o caminho que todo instalador de PWA testa. |
| `firebase-messaging-sw.js` | O escopo de um service worker é limitado ao **diretório dele**. Em `/vendor/`, ele só controlaria `/vendor/*` e as notificações em background parariam. |
| `.well-known/` | Caminho fixado pela RFC 8615 — App Links (Android) e Universal Links (iOS) só olham ali. |

## Diretórios

Organizados por **o que a coisa é**, não por qual tela a usa. Um asset usado por
duas features não deve morar dentro de nenhuma das duas.

| Diretório | Conteúdo | Consumidor |
|---|---|---|
| `branding/` | Logotipo e assinatura do diretor comercial | Cabeçalho, telas de autenticação, exports HTML→PDF, e-mails da API |
| `icons/` | Favicons PNG, `apple-touch-icon`, ícones de PWA | `index.html`, `site.webmanifest`, bloco "Ícone" do editor de Mensagens |
| `messages/` | Faixas de cabeçalho/rodapé dos blocos decoradores | Editor e renderizador de Mensagens, exportador de PDF de mensagem |
| `ghs/` | Os 9 pictogramas de perigo GHS (domínio público, ONU) | Módulo FISPQ (`occupational-health/fispq`) |
| `vendor/` | Runtime de terceiros: worker do pdf.js, decoder Draco | Visualizadores de PDF; `DRACOLoader` do Truck Studio |
| `textures/` | **Só** os dois normal maps de tinta (`metallic_nor`, `pearl_nor`) | Preview 2D de tinta |

`textures/` é **plano de propósito**. Um `paint/` separado de um `ground/`
dividiria por *quem consome* — que é exatamente o agrupamento por feature que o
resto de `public/` abandonou. O nome do arquivo já carrega a família, e a
convenção `<material>_<mapa>` (`asphalt_nor.jpg`, `metallic_nor.jpg`) vale para
todos. Ela continua valendo mesmo agora que as duas famílias estão em
servidores diferentes (ver abaixo): o `_nor` é o que diz de que família cada
arquivo é, e isso não dependia de estarem no mesmo diretório.

## A árvore do Truck Studio NÃO mora mais aqui

`models/`, `environments/`, `brands/` e a maior parte de `textures/` saíram de
`public/`. São servidos pela **API**, sob `/studio-assets/v1/`.

**Por quê:** a árvore inteira dá ~300 MB, e um único arquivo dela —
`models/vehicles/scania.fbx`, 44 MB, **baixado em runtime** — já raspa o limite
de 100 MB por arquivo do GitHub. Somando tudo, `public/` tinha chegado a
446 MB. Isso não é peso de deploy: é peso de **clone**, pago por todo mundo que
toca o repositório, para servir arte binária que nunca é lida por código e
nunca aparece num diff útil. Git versiona mal blob grande — cada rebake de uma
textura acrescenta a versão nova ao histórico sem nunca remover a antiga.

O que ficou para trás, e por quê:

| Fica em `public/` | Motivo |
|---|---|
| `textures/metallic_nor.jpg`, `textures/pearl_nor.jpg` | Consumidor é o preview de acabamento do cadastro de **Tinta** — tela em produção, sem relação com o studio, que não pode passar a depender de a API estar servindo a árvore. São 2 arquivos pequenos; o motivo da saída (300 MB) não se aplica. |
| `vendor/draco/` | Dependência de **build** vendorizada, irmã do worker do pdf.js — não é arte de cena. ~200 kB, e o `.wasm` é código executado no contexto da página: mesma origem evita a discussão de CSP/CORS. |

### Como isso é configurado

Uma variável de ambiente move a árvore inteira: **`VITE_STUDIO_ASSETS_BASE`**
(padrão `/studio-assets/v1`; ver `.env.example` para os três modos). Ela é lida
uma vez em [`src/config/assets.ts`](../src/config/assets.ts) como
`STUDIO_ASSETS_BASE`, e `STUDIO_ASSETS` passa a guardar diretórios **relativos**
a ela.

**A versão está na BASE, não no nome dos arquivos.** Content-hash em 400+
arquivos obrigaria a reescrever todos os manifestos a cada bake. Com um
diretório de versão, `Cache-Control: immutable` fica seguro, a virada é atômica
(`v1` inteiro → `v2` inteiro) e o rollback é trocar uma linha de env.

Em dev, o `vite.config.ts` faz proxy de `/studio-assets` → `VITE_API_URL`, e em
produção o nginx faz o mesmo. Isso mantém tudo **same-origin**, o que não é
detalhe: o three.js põe `crossOrigin="anonymous"` nos loaders (sem cabeçalho de
CORS o carregamento **falha**, não só contamina), e `livery.ts` lê os PNGs de
painel de volta com `getImageData()` — de outra origem sem CORS o canvas fica
contaminado e a medição da janela vazada morre em silêncio.

`branding/` e `messages/` usam **os mesmos nomes de arquivo** que `assets/` do
app Flutter (`mobile-flutter/assets/{branding,messages}/`). Lá são `.png` porque
o Flutter não decodifica WebP em todos os alvos; aqui são `.webp`.

> ⚠️ As texturas de tinta **divergiram** do Flutter em 2026-07-31: aqui viraram
> `textures/metallic_nor.jpg` e `pearl_nor.jpg`; lá continuam
> `assets/paint/metallic-normal-map.jpg` e `pearl-normal-map.jpg`. E o `flake.jpg`
> foi descartado só no web. Alinhar é editar `paint_preview_renderer.dart`.

### Não existe mais um diretório `truck-studio/`

Até 2026-07-31 tudo do studio vivia sob `public/truck-studio/`, resolvido por um
`ASSET_BASE` único. Foi desmontado porque agrupava por *feature* aquilo que o
resto de `public/` agrupa por *tipo*, e porque o agrupamento estava começando a
custar:

- `draco/` é o decoder da Google — dependência de terceiros igual ao worker do
  pdf.js, sem relação nenhuma com caminhões. Está em `vendor/draco/`.
- `env/shared/` eram texturas PBR de chão, vizinhas naturais dos normal maps de
  tinta. Estão as duas famílias em `textures/`.
- `brands/` são as montadoras do enum `TruckManufacturer`, que a aplicação
  inteira usa (inclusive `Paint.manufacturer`) — não é arte de cena.

Cada família continua com o seu diretório — a estrutura por tipo sobreviveu à
mudança de servidor, é ela que está espelhada dentro de `/studio-assets/v1/`. O
engine declara os diretórios em
[`engine/core/paths.ts`](../src/pages/tools/truck-studio/engine/core/paths.ts),
que é o único módulo do engine que importa do app (`@/config/assets`) — o resto
continua um port autocontido.

O que mudou é que esses diretórios são **relativos**, e os manifestos também
(`models/vehicles/scania.glb`, sem barra inicial). Quem prefixa a base é
`assetUrl()` (`engine/catalog/catalog.ts`), e ele é o **único ponto do código
que sabe onde a árvore está hospedada** — era esse o objetivo. Enquanto os
manifestos guardavam caminho absoluto de raiz de site, cada um deles era uma
segunda declaração da hospedagem, num arquivo que o tsc não lê.

> ⚠️ `assetUrl()` **não deixa mais passar** caminho começado por `/` — ele
> resolveria contra a origem do web, que não tem mais os arquivos. Só
> `https?://`, `data:`, `blob:` e `//` passam intocados. A barra inicial é
> tolerada (e removida) como rede de segurança de migração.
>
> Consequência: `VEHICLES_DIR + 'x.glb'` entregue direto a um `fetch`, a um
> `new Image()` ou a um loader do three.js **não funciona**. Tudo passa por
> `assetUrl()`.

## Manifestos servidos

Estes três arquivos são **dados**, não código: o bundler não os lê e o tsc não
os verifica. Ao mover algo que eles apontam, reescreva os caminhos dentro deles.
Eles moram **dentro da árvore servida pela API**, não em `public/` — os
caminhos abaixo são relativos a `/studio-assets/v1/`.

| Manifesto | Aponta para |
|---|---|
| `environments/environments.json` | `environments/<id>/*`, `textures/*` (inclusive aninhado em `set.materials.<NOME>.{diffuse,rough,normal,ao}`) |
| `brands/trucks/brands.json` | `brands/trucks/<marca>/*` |
| `models/vehicles/cabs.json` | `models/vehicles/*.{glb,fbx}` |

`models/props/props.json` **não existe mais** — a árvore de props foi removida
em 2026-08-03 junto com os cenários só-HDRI (ver `removedNote` no topo de
`environments.json`).

Verificação rápida de que nenhum apontou para o vazio — rodar na RAIZ da árvore
de assets, não em `public/`. O passeio é pela árvore JSON, e não por regex sobre
o texto: `environments.json` tem mapas de textura **aninhados** sob
`set.materials.<NOME>`, que um grep de topo não vê.

```bash
cd <raiz-da-arvore> && python3 - <<'EOF'
import json, os, re
ASSET = re.compile(r"\.(?:glb|fbx|hdr|exr|jpg|jpeg|png|webp)$", re.I)
PROSA = {"_comment", "removedNote", "note", "name", "subtitle",
         "license", "author", "source", "description", "credit"}

def walk(n, key, skip, hit):
    if isinstance(n, dict):
        for k, v in n.items(): walk(v, k, skip or k in PROSA, hit)
    elif isinstance(n, list):
        for v in n: walk(v, key, skip, hit)
    elif isinstance(n, str) and not skip and ASSET.search(n):
        hit.append((key, n))

for f in ["environments/environments.json", "brands/trucks/brands.json",
          "models/vehicles/cabs.json"]:
    hit = []
    walk(json.load(open(f)), None, False, hit)
    for key, p in hit:
        if p.startswith("/"):        print("ABSOLUTO", f, key, p)   # tem de ser relativo
        elif not os.path.exists(p):  print("FALTA   ", f, key, p)
EOF
```

## Os três lugares que repetem o caminho literal

Não dá para importar `@/config/assets` deles. Ao mover um arquivo, ajuste os
três junto:

1. **`index.html`** — `<link rel="icon">`, `apple-touch-icon`, `og:image`.
2. **`public/site.webmanifest`** — `icons[].src` (é dado, não código).
3. **`public/firebase-messaging-sw.js`** — roda fora do bundle, em contexto de
   service worker.

E um quarto, em **outro repositório**:

4. **`api/src/templates/email-templates.ts` e `signature-emails.ts`** montam
   `${WEB_APP_URL}/branding/logo.png`. A API não importa código do web, então o
   caminho é um contrato entre os dois repos. **Publique o web ANTES da API**,
   senão os e-mails saem apontando para um 404.

> ⚠️ `branding/logo.png` esteve em `/logo.png` até 2026-07-31. E-mails enviados
> antes dessa data embutem a URL antiga e vão exibir o logotipo quebrado. É
> cosmético e não tem como corrigir retroativamente.

## Duas armadilhas de tamanho

**`models/vehicles/scania.fbx` tem 44 MB e É BAIXADO EM RUNTIME.** (Hoje na
API, sob `/studio-assets/v1/`.) O nome antigo (`source-models/`) sugeria arte de
origem esquecida no deploy; não é. É a cabine `scania` **e** a `daf` — as duas
entram por `cabs.json` com `format: "fbx-scania"`, e as duas quebram se o
arquivo sumir. Sozinho, ele é o maior motivo de a árvore ter saído do git: 44 MB
num repositório onde o limite por arquivo do GitHub é 100 MB, e cada rebake
somaria mais uma cópia ao histórico. Se um dia essa geometria for convertida
para `.glb` com Draco, o ganho é grande; até lá, ele é carga obrigatória.

**`messages/header-logo.webp` não tem consumidor no web.** É o logotipo
original, sem recorte: o `header-logo` renderizado é o `-compact` (394×156, sem
margem transparente, spec §6). Fica versionado por ser a arte-fonte do
`assets/messages/header-logo.png` do Flutter. Não apague sem trocar o lado do
Flutter também.
