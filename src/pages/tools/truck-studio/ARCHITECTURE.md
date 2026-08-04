# Truck Studio — arquitetura dos cenários

**Isto é um REGISTRO, não um plano.** O que está escrito aqui já foi feito, ou foi
deliberadamente **não** feito — e nesse caso o motivo está anotado junto. Existe **um**
item em aberto e ele tem seção própria ([§3](#3-em-aberto--o-skyhdr-nunca-foi-re-assado)).

Este arquivo se chamava `REAL_ENVIRONMENT_PLAN.md` e abria com *"Status: research + plan.
No code changed yet."* Isso deixou de ser verdade por volta de 2026-08-03. Foi renomeado
porque um arquivo com aquele nome e aquela primeira linha se lê como uma lista de tarefas,
e a próxima pessoa tentaria executá-la — inclusive as partes que o código **decidiu não
seguir**.

---

## 0. Linha do tempo — o que realmente aconteceu

| Quando | O quê |
|---|---|
| — | Pesquisa original: diagnóstico do "porquê a cena lê como falsa", modelo de três cascas (NEAR/MID/FAR), levantamento de licenciamento, lista de ~40 assets do Sketchfab. |
| — | **A virada para o Blender.** A lista de assets foi ABANDONADA. Em vez de garimpar CC-BY, os dois cenários foram **modelados**: `tools/env-build/build_armazem.py` e `tools/env-build/build_industrial_park.py` (mais `build_warehouse.py`, `race_track.py`, `texture_infer.py` e os scripts de shot no mesmo diretório). **Modelagem substituiu curadoria.** |
| — | `scene/set.ts` nasce: cenário = geometria de verdade (`set.glb`), materiais NOMEADOS ligados por manifesto a conjuntos PBR compartilhados de `/textures/`. |
| **2026-08-03** | **Os três cenários só-HDRI foram removidos**: `rodovia`, `patio-logistico` e `urbano`. Eram foto equirect + chão procedural. Entraram `distrito-industrial` e `armazem`. |
| **2026-08-03+** | **O corte de código morto que veio junto.** `scene/scatter.ts` (−1351 linhas) e `scene/plate.ts` (−198) apagados; `scene/environment.ts` e `scene/scene.ts` reduzidos a uma fração. Total no `truck-studio/`: 19 arquivos, **+2.517 / −5.743**. Sumiram o `nearGround`/`setNearGround`, o scatter, o roadside, o shadowCatcher e o domo projetado (`GroundedSkybox`). |

> O `removedNote` de `environments.json` previa esse corte como "o próximo, e ele é
> grande". Foi.

---

## 1. Por que a cena antiga lia como falsa

**Esta é a parte mais valiosa do documento e ela continua inteiramente válida.** É o
argumento fundador: `environments.json` (`removedNote`) e o cabeçalho de `scene/set.ts`
reproduzem os quatro pontos abaixo como justificativa deles próprios. Se algum dia alguém
propuser voltar a "foto + chão procedural", é aqui que a resposta está.

Não era um problema de "o HDRI é ruim". HDRIs do Poly Haven são fotografias — fotorreais
por definição. O que quebrava a ilusão era a **transição** entre a foto e o CG:

| # | O que acontecia | Por que o olho rejeita |
|---|---|---|
| 1 | `nearGround` construía um **disco procedural** de asfalto + orla de grama, raio 26 m, fade 18 m, misturado ao fundo | Um chão perfeitamente circular, perfeitamente plano, com fade alpha radial. Chão de verdade tem meio-fio, ralo, junta, faixa pintada, e um horizonte *ocluído por objetos*, não desbotado por alpha. |
| 2 | O maquinário de `tintRgb` — um ensaio de calibração inteiro dentro de `environments.json` — existia para forçar o asfalto CG a casar com o asfalto da foto | Precisar disso *já é* o sintoma: dois renderizadores sendo reconciliados por um multiplicador de cor. Acerta a média e não tem como acertar a textura. |
| 3 | `scatter` espalhava 420 + 280 + … instâncias de grama, postes procedurais, mastro de pista | Instâncias espalhadas não têm **lógica de arranjo**. Um pátio real tem rastro de pneu, mancha de óleo, palete largado na porta, carro estacionado em vaga pintada. |
| 4 | **Nada ocluía o horizonte** | O caminhão fica sobre um disco dentro de uma foto infinita. Não existe meio-termo. **Este é o maior de todos.** |

Um `set` resolve os quatro de graça: a geometria é real, o arranjo é real, e o prédio
oclui o horizonte.

---

## 2. A arquitetura que existe: **uma** casca, não três

O plano original propunha três bandas por distância:

```
[ NEAR  0-40 m ]   geometria PBR modelada, iluminada pelo rig        <- ISTO EXISTE
[ MID  40-250 m ]  fotogrametria aérea, unlit/baked, fog + tint      <- NUNCA EXISTIU
[ FAR  250 m+   ]  o HDRI                                            <- existe, ver §3
```

**Só a banda NEAR foi construída**, e ela é o `set.glb`. Não há banda MID: nenhuma malha
fotogramétrica entrou no projeto, e portanto nenhum dos mecanismos que ela exigiria
(material unlit, tint linear por preset, fade por distância) foi escrito. Isso é uma
decisão, não uma pendência — ver [§7](#7-o-que-foi-deliberadamente-não-feito).

O que um cenário é hoje, concretamente:

| | `distrito-industrial` | `armazem` |
|---|---|---|
| `set` | `environments/distrito-industrial/set.glb` — **7.362.408 B** | `environments/armazem/set.glb` — **3.479.204 B** |
| `hdri` | `environments/rodovia/sky.hdr` (5.750.581 B) | **`null`** — iluminado só pelas próprias tiras emissivas |
| extensões do glb | Draco · WebP · `KHR_materials_emissive_strength` · `EXT_mesh_gpu_instancing` | Draco · WebP · `KHR_materials_emissive_strength` |
| `showSkyDome` | `false` | `false` (a casca fechada esconde o domo) |

**Por que os sets são tão leves:** eles saem do Blender **sem textura**. Os materiais de
chão são só NOMES (`ASPHALT_YARD`, `CONCRETE_APRON`, …) e o manifesto liga cada nome a um
conjunto PBR de `/textures/` que o app já baixa. Sem isso cada set carregaria a própria
cópia do mesmo asfalto 4k. É por isso que `distrito-industrial` cabe em 7 MB. Ver o
cabeçalho de `scene/set.ts` e `bindMaterials()`.

O `set` **não ilumina nada**. O rig (`scene/scene.ts` + `scene/presets.ts`) continua dono
absoluto de key/rim/hemi/fog; os materiais do set são PBR normais que respondem a ele — é
exatamente por isso que um set atravessa os seis presets e o ciclo dia/noite sem tratamento
especial.

---

## 3. EM ABERTO — o `sky.hdr` nunca foi re-assado

**Este é o único item vivo deste documento.**

O plano chamava isto de *"a mudança de maior impacto do documento inteiro"*, e ela
**não foi feita**. A ideia: com o set montado no Blender, renderizar dali um **equirect
4K HDR a partir da posição do pivô do caminhão** e enviar como o `sky.hdr` daquele
cenário. Nada no engine muda — `environments.json` já tem o campo `hdri`.

O estado real:

- **`distrito-industrial` aponta para `environments/rodovia/sky.hdr`** — uma foto de
  acervo do Poly Haven, de **outro lugar**. O fundo e o reflexo mostram um sítio; a
  geometria mostra outro. O cromado, o vidro e a tinta do caminhão refletem uma rodovia
  que não está ali.
- **`armazem` tem `hdri: null`.** Não é o re-assamento: é a ausência dele. O cenário é
  uma casca fechada iluminada pelas próprias tiras emissivas, e funciona porque nada de
  fora precisa aparecer. Não resolve o caso aberto — contorna.

Quem for mexer nisso: a pasta `/environments/rodovia/` hoje contém **só** `sky.hdr`, e
existe unicamente para servir de céu ao `distrito-industrial`. Assar um HDR próprio para
o `distrito-industrial` é o que finalmente permite apagá-la.

> ⚠️ **O `removedNote` de `environments.json` está desatualizado neste ponto.** Ele avisa
> que `/environments/patio-logistico/` "NÃO pode ser apagada" porque o `armazem` usaria o
> `sky.hdr` dela. Isso mudou: `patio-logistico/` **foi** apagada por inteiro e o `armazem`
> passou a `hdri: null`. Só o aviso sobre `/environments/rodovia/` continua valendo.

---

## 4. Licenciamento — o filtro que decide tudo

**Continua vivo e continua sendo o que sustenta a virada para o Blender.** Modelar em vez
de garimpar não foi preferência estética; foi a saída para o funil abaixo.

### Unreal / Fab
Boa parte do conteúdo de terceiros do Fab é usável fora da Unreal, mas **o conteúdo
autoral da Epic não é** — Paragon, MetaHumans, City Sample (a demo do Matrix), Downtown
West e Quixel Megascans são restritos ao motor. Ou seja: o visual "City Sample" que se
imagina é justamente o único que não dá para usar.

*Exceção que vale conferir na conta:* do lançamento do Fab (out/2024) até 31/12/2024, a
Megascans ficou gratuita para todos sob a Fab Standard License **para todos os motores e
ferramentas**, e o que foi reivindicado naquela janela segue licenciado para sempre.

### Unity Asset Store
A própria Unity confirma que outros motores são permitidos — **mas** a EULA proíbe entrega
em que *"usuários do seu projeto possam acessar ou extrair os arquivos brutos"*. Um app
three.js serve `.glb` por HTTP; qualquer um puxa pela aba Network. Um app web é o pior
caso possível para essa cláusula. A mesma cláusula existe na TurboSquid e na CGTrader.
**Trate asset pago de marketplace como inutilizável num build web público.**

### O que sobra
**CC0 e CC-BY.** CC-BY é perfeitamente viável aqui: já existem
`public/environments/CREDITS.md` e um bloco `credit{}` por cenário. Atribuição é problema
resolvido neste código.

### Google Photorealistic 3D Tiles — verificado, e é armadilha para *este* uso
A política da Map Tiles API exige que você **"não pré-busque, indexe, armazene ou faça
cache de qualquer Conteúdo"**. Não dá para assar num GLB nem no HDRI — tem de vir por
streaming ao vivo, cobrado por sessão, e é indisponível na UE. Viável como *funcionalidade
separada* mais adiante ("veja este caminhão na nossa planta de Ibiporã"), nunca como base.

---

## 5. Orçamento — batido com folga

O alvo era **≤ 35 MB por cenário** (desktop; ≤ 12 MB no fallback móvel), com ~800 k tri e
~15 MB só na banda NEAR.

Entregue: **7,36 MB** (`distrito-industrial`) e **3,48 MB** (`armazem`) de `set.glb`.
Somando o HDRI compartilhado, `distrito-industrial` fecha em ~13,4 MB de fio; `armazem`,
sem HDRI, em ~3,5 MB. Os alvos de draw call foram atacados por `EXT_mesh_gpu_instancing`
no `distrito-industrial`.

O que fez a conta fechar não foi decimação agressiva: foi o set **não carregar textura
nenhuma** (§2).

---

## 6. Pipeline de asset (`gltf-transform`)

A urgência de **KTX2 tornou-se sem efeito** e a linha *"KTX2 não é opcional"* foi removida
daqui. O motivo é §2: os sets viajam sem textura, então a pressão de memória de GPU que
justificava KTX2 nunca chegou. **Não existe `KTX2Loader` no projeto** e não há razão atual
para adicionar um. Só `/vendor/draco/` é vendorizado (`config/assets.ts` →
`dracoDecoderDir: "/vendor/draco/"`).

O que continua valendo é a receita:

```bash
npx @gltf-transform/cli dedup    in.glb a.glb --materials false
npx @gltf-transform/cli prune    a.glb  b.glb --keep-attributes false --keep-leaves true
npx @gltf-transform/cli webp     b.glb  c.glb --slots "*" --lossless
npx @gltf-transform/cli draco    c.glb  out.glb --method edgebreaker \
      --quantize-position 16 --quantize-normal 12 --quantize-texcoord 14
```

Medido no `models/vehicles/trailer.glb`, que é o pior caso do acervo (bake do exportador
do three, sem Draco): **299,77 MB → 143,73 (dedup) → 99,05 (prune) → 85,35 (webp lossless)
→ 33,78 MB (Draco)**. 8,9× menor, com as 35 texturas pixel a pixel idênticas às PNG de
origem e nenhum triângulo de área não-nula perdido.

**Duas armadilhas, as duas silenciosas:**

1. **`dedup` funde materiais por padrão, e isso quebra a pintura.** Existem grupos de
   materiais byte-idênticos com NOMES DIFERENTES, e `applyTrailerFinish()` em
   `engine/vehicle/models.ts` despacha pelo **nome**. Uma rodada padrão derruba nomes e
   desfaz correções documentadas sem avisar. **`--materials false` é obrigatório.**
2. **Nunca rode `gltf-transform quantize`.** A grade dele é de CENA INTEIRA; num bake cuja
   caixa local tem milhares de unidades isso é catastrófico. A grade **por primitiva** do
   Draco é o que torna 16/12/14 seguro. Decalques que ficam décimos de milímetro
   sobressalentes sobrevivem a isso; a uma grade de cena, não.

Um terceiro cuidado, para texturas: `gltf-transform resize` **reencoda todas as texturas
do arquivo em WebP com perdas**, inclusive normal maps. Para reduzir UMA textura, escreva
um script com `@gltf-transform/core` + `sharp` que troque só aquela imagem.

Para malhas fotogramétricas (caso que não existe hoje), `simplify --ratio 0.25
--error 0.001` seria o cavalo de batalha — mas veja §7 antes de trazer uma.

---

## 7. O que foi deliberadamente **não** feito

Estas linhas existiam no plano e **não devem ser executadas**. Não são pendências.

| Item do plano | Situação |
|---|---|
| Lista de ~40 assets do Sketchfab (fotogrametria aérea, quarteirões urbanos, contêineres, cercas, carros) | **Descartada.** Os dois cenários foram modelados no Blender (`tools/env-build/`). Seguir a lista contraria a estratégia que o código adotou. |
| Banda MID de fotogrametria a 100–250 m | **Não construída.** Sem ela, nada de material unlit nem de fade por distância. |
| Tint linear por preset no material MID (item 3 do plano de código) | **Superado.** Só faria sentido com albedo fotogramétrico (sol assado dentro). Os dois sets são modelados e respondem ao rig direto. O gancho está descrito no cabeçalho de `scene/set.ts` caso um set fotogramétrico apareça. |
| `setsDir` em `core/paths.ts` / `config/assets.ts` (item 6) | **Não feito, e certo assim.** O caminho do set vem do manifesto por cenário; um diretório dedicado não acrescenta nada. |
| Ordem de fases 0–5, com `rodovia` / `patio-logistico` / `urbano` como cenários a evoluir | **Obsoleta.** Os três foram apagados em 2026-08-03. Quem seguir a "fase 4" vai trabalhar em cenários que não existem. |
| `scatter.ts` "continua opcional, não apagado" (item 4) | **Apagado mesmo** (−1351 linhas), junto com `plate.ts`. |
| KTX2 + transcoder ao lado do `/vendor/draco/` | **Sem efeito** — ver §6. |

O que **foi** feito, em forma mais rica que a proposta: o bloco `set` em
`environments.json` (itens 1 e 2), com mapa de materiais, `rotationY` e o resto do
manifesto; e `scene/lamps.ts` (item 5), que ganhou modelo de luminária de verdade
(`setLampModel`) em vez de só manter o mastro procedural.

---

## 8. Onde o código está

| Arquivo | Papel |
|---|---|
| `public/environments/environments.json` | manifesto dos cenários + `removedNote` (o argumento de §1) |
| `engine/scene/set.ts` | carrega o `set.glb`, liga materiais nomeados a conjuntos PBR de `/textures/`, molhagem por superfície |
| `engine/scene/environment.ts` | `applyEnvironment()` — HDRI, domo, modelo de poste, delega o set a `applySet()` |
| `engine/scene/scene.ts` · `presets.ts` | o rig de luz: dono de key/rim/hemi/fog e do ciclo dia/noite |
| `engine/scene/lamps.ts` | luminárias — pool distribuído, escala/orientação pela altura do modelo |
| `engine/catalog/catalog.ts` | tipos do manifesto |
| `tools/env-build/*.py` | **a fonte dos cenários**: scripts Blender que geram os `set.glb` |
