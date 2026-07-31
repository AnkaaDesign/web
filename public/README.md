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
| `models/vehicles/` | Cabines, carreta, baú refrigerado + `cabs.json` e `*_meta.json` | Truck Studio |
| `models/props/` | Objetos de cenário (postes, touceiras, pedras…) + `props.json` | Truck Studio |
| `textures/` | Plano: 5 conjuntos PBR de chão + `macro_noise.webp` + os normal maps de tinta (`metallic_nor`, `pearl_nor`) | Truck Studio; preview 2D de tinta |
| `environments/` | Um diretório por cenário (`sky.hdr`, `sky.jpg`, `thumb.webp`) + `environments.json` + `CREDITS.md` | Truck Studio |
| `brands/trucks/` | Logos e fotos por montadora + `brands.json` | Truck Studio (e qualquer tela que exiba `TruckManufacturer`) |

`textures/` é **plano de propósito**. Um `paint/` separado de um `ground/`
dividiria por *quem consome* — que é exatamente o agrupamento por feature que o
resto de `public/` abandonou. O nome do arquivo já carrega a família, e a
convenção `<material>_<mapa>` (`asphalt_nor.jpg`, `metallic_nor.jpg`) vale para
todos.

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

Hoje cada família tem o seu diretório e os manifestos guardam **caminhos
absolutos** (`/models/props/stone_01.glb`). O engine declara os diretórios em
[`engine/core/paths.ts`](../src/pages/tools/truck-studio/engine/core/paths.ts),
que é o único módulo do engine que importa do app (`@/config/assets`) — o resto
continua um port autocontido.

`assetUrl()` (`engine/catalog/catalog.ts`) devolve intocado qualquer caminho
começado por `/`, então manifesto e código convergem para a mesma URL sem
ninguém prefixar nada.

## Manifestos servidos

Estes quatro arquivos são **dados**, não código: o bundler não os lê e o tsc não
os verifica. Ao mover algo que eles apontam, reescreva os caminhos dentro deles.

| Manifesto | Aponta para |
|---|---|
| `environments/environments.json` | `/environments/<id>/*`, `/textures/*` |
| `brands/trucks/brands.json` | `/brands/trucks/<marca>/*` |
| `models/props/props.json` | `/models/props/*.glb` |
| `models/vehicles/cabs.json` | `/models/vehicles/*.{glb,fbx}` |

Verificação rápida de que nenhum apontou para o vazio:

```bash
cd web/public && python3 - <<'EOF'
import re, os, glob
for f in ["environments/environments.json","brands/trucks/brands.json",
          "models/props/props.json","models/vehicles/cabs.json"]:
    for m in re.finditer(r'"(/[\w./-]+\.(?:glb|fbx|hdr|jpg|png|webp|json))"', open(f).read()):
        if not os.path.exists("." + m.group(1)): print("FALTA", f, m.group(1))
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

**`models/vehicles/scania.fbx` tem 44 MB e É BAIXADO EM RUNTIME.** O nome antigo
(`source-models/`) sugeria arte de origem esquecida no deploy; não é. É a cabine
`scania` **e** a `daf` — as duas entram por `cabs.json` com
`format: "fbx-scania"`, e as duas quebram se o arquivo sumir. Se um dia essa
geometria for convertida para `.glb` com Draco, o ganho é grande; até lá, ele é
carga obrigatória.

**`messages/header-logo.webp` não tem consumidor no web.** É o logotipo
original, sem recorte: o `header-logo` renderizado é o `-compact` (394×156, sem
margem transparente, spec §6). Fica versionado por ser a arte-fonte do
`assets/messages/header-logo.png` do Flutter. Não apague sem trocar o lado do
Flutter também.
