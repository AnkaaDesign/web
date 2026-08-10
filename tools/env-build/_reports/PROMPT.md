# Prompt de continuação — distrito-industrial

Cole o bloco abaixo numa sessão nova. Ele é auto-contido: assume que quem lê não
viu nada da conversa anterior.

---

Trabalhe no cenário `distrito-industrial` do Truck Studio, em
`C:\Users\Kennedy\Documents\repositories`. Três correções pendentes, nesta ordem.
Verifique cada uma com render antes de dizer que está feita — não confie em
raciocínio, olhe a imagem.

## Como o cenário é construído, servido e verificado

- Fonte: `web/tools/env-build/build_industrial_park.py` (~2.700 linhas, comentado
  com o histórico de cada decisão — leia os comentários antes de mexer, várias
  "melhorias" óbvias já falharam e estão documentadas ali).
- Vegetação: `web/tools/env-build/veg.py`. Impostores: `bake_impostors.py`.
- Prédios importados: `dl_packs.py`, `ibc1.py`, `props_ph.py`.
- Layout das peças: `web/tools/env-build/map-creator/layout.json`
  (coordenadas do editor; o build soma o deslocamento de sítio (3.25, −25)).
- Build: `"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b -P build_industrial_park.py`
- **Verificação: `blender -b -P shot_park.py`** — roda o build e escreve 12 renders
  em `_shots_park/`. Os que importam: `i_junc`, `j_junc_low`, `k_median_gap`,
  `l_trees`, `g_top`.
- Saída: `web/public/environments/distrito-industrial/set.glb`.
- **Espelhe à mão** para `truck-studio-desktop/assets/environments/distrito-industrial/set.glb`.
  Nada automatiza isso e nada acusa quando esquece.
- App para olhar: `http://localhost:5173/studio-harness.html` (sem login).
  `vite.config.ts` tem um `bypass` no proxy `/studio-assets`: o que existir em
  `web/public/` é servido local, o resto vai para a API de produção.

## Armadilhas já pagas — não repita

- `export_apply=False` no glTF, senão o instancing morre.
- Draco DESLIGADO: o encoder falha nas malhas com `COLOR_0` e aborta o export
  deixando o `set.glb` anterior no lugar (build silenciosamente no-op).
- `export_vertex_color="ACTIVE"`, senão sai `COLOR_0` todo branco.
- `patch_glb_alpha()` força `alphaMode: MASK` DEPOIS do export; o exportador
  ignora `blend_method`.
- O audit de layout usa **BVH sobre a malha**, não caixa envolvente: `ibc12`
  ("long hall") são dois galpões nas pontas de um lote com 33 m de vão vazio no
  meio, e a envolvente cobre os 64 m. Caixa envolvente mente aqui.
- A API de produção manda `Cache-Control: immutable, max-age=31536000` nos
  studio-assets. O proxy do dev já reescreve para `no-store`, mas uma entrada
  velha em cache só sai com hard reload.

## Tarefa 1 — canto arredondado da abertura do canteiro

Hoje a abertura do canteiro (onde a transversal `(-106, 103, -44, -36)` cruza)
tem canto em esquadro. Precisa de concordância, e **as três coisas têm de ser
feitas juntas** ou abre buraco:

1. O asfalto da ligação pelo canteiro (o trecho curto de `svc_spans`, hoje
   excluído de `mouths()` por `FLARE_MIN_SPAN`) precisa de concordância de raio
   `R_c` nas pontas.
2. A grama do canteiro precisa recuar pelo MESMO raio (os segmentos vêm de
   `breaks` em `build_ground`).
3. Guia e sarjeta precisam seguir arcos CONCÊNTRICOS no mesmo centro:
   pavimento em `r > R_c`, sarjeta em `[R_c − 0.45, R_c]`, meio-fio em
   `[R_c − 0.62, R_c − 0.45]`.

Use `build_service_kerbs()` como modelo — a boca do entroncamento já é
exatamente essa construção e a tangência foi verificada numericamente (erro
< 4e-14 m). `R_c` entre 1,5 e 2,5 m; o canteiro tem 10,5 m de largura.

**Por que juntas:** já aconteceu de o nariz do canteiro parar no dorso do
meio-fio enquanto a canaleta longitudinal abria 62 cm, deixando um quadrado de
62 × 62 cm descoberto em cada quina por onde aparecia a brita 63 cm abaixo. Ver
`09-canteiro-elevado-e-buracos.png`.

## Tarefa 2 — importar o pack de árvores

`web/tools/env-build/_src_trees/` (já extraído de
`~/Downloads/English Trees and Bushes pack.zip`). Substituir os impostores de
cartão do `plant()` por esta geometria.

Medido no pack:

- `model_0.obj` 63.895 v / 144.212 f, `model_1` 58.027 / 123.411,
  `model_2` 59.028 / 62.992.
- **Cada OBJ é um bosque inteiro, não uma planta**: bbox de `model_0` é
  x −97.65..−32.52, y −9.98..259.94, z −3.16..40.70. Z é a vertical.
- **Nenhum `usemtl`, nenhum `.mtl`.** Nada no arquivo diz quais faces são casca e
  quais são folha.
- Texturas: `BarkAtlas-Diffuse.png` (4096²), `BarkAtlas-Normal.png`,
  `Grasses&branch.png` (8192², o atlas de folhas).
- **O atlas de folhas NÃO tem alpha utilizável**: medi o canal A e ele é 255 em
  todos os pixels (mínimo 255, máximo 255, zero transparentes). Sem derivar
  alpha, folha vira retângulo verde opaco — que é literalmente o defeito
  documentado no cabeçalho do `veg.py`.

Portanto o importador precisa de três passos, nesta ordem:

1. **Derivar alpha** do fundo do atlas (o padrão desses packs é fundo preto:
   `a = luminância > limiar`, com um pouco de erosão para não deixar franja
   clara). Gravar um PNG RGBA novo e usar `alphaMode: MASK` — `patch_glb_alpha`
   já força MASK para materiais cujo nome começa com `PLANT_`, então nomeie
   assim.
2. **Fatiar o bosque em plantas**: componentes conexos, depois agrupar por
   proximidade em XY (um tronco e suas folhas são componentes separados).
   Escolher ~6 árvores e ~4 arbustos como protótipos, normalizar cada um com a
   base em z=0 e centrado no próprio footprint.
3. **Classificar casca × folha**: os cartões de folha são componentes PLANARES
   (todos os vértices num plano, 2 triângulos por cartão); tronco e galho são
   tubulares. Classifique por planaridade do componente e atribua o material
   correspondente.

Orçamento: o cinturão tem ~450 plantas instanciadas de ~10 malhas. 3–7 k faces
por planta é aceitável (o pack já está nessa faixa); acima disso decime **por
componente de casca apenas**, nunca as folhas — decimador de colapso transforma
folha em pasta.

`group_instances()` agrupa por nome de malha começando com `tree_`, `bush_` ou
`card_`; mantenha um desses prefixos ou ajuste a função.

## Tarefa 3 — o que ainda pisca

Três marcações do usuário continuam piscando no app: duas portas e um elemento
sobre a fachada, todos em prédios da família `mc_*` (bloco de concreto). Ver
`screenshots/05`, `06` e `07`.

Já foi feito e **não resolveu**: `separate_coplanar()` em `dl_packs.py` foi
reescrito três vezes. Hoje ele agrupa por plano canonizado (frente e verso no
mesmo grupo), detecta por distância (`|Δd| < 12 mm`, sem balde de arredondamento)
e afasta 10 mm — a casca inteira quando são cascas distintas, a face quando a
peça está soldada na parede. Pega 1.306 pares no `DL_cabinet`, 425 no `MC_00`.

**A pista que eu não testei e que deveria ser a primeira:** pode não ser
z-fighting de geometria coplanar, e sim **shadow acne**. Os renders do Blender
(Cycles, sem shadow map) nunca mostram o defeito; o app usa shadow map. Em
`web/src/pages/tools/truck-studio/engine/scene/scene.ts` a luz principal usa
`shadow.camera.near = 1; shadow.camera.far = 90` com mapa 3072². Teste subir
`shadow.bias` / `shadow.normalBias` e olhe as mesmas portas. É um teste de dois
minutos e explica exatamente o padrão relatado — superfície plana vertical que
cintila conforme a órbita anda, sem geometria duplicada por baixo.

Se for acne, a correção é no engine e vale para o veículo também. Se não for,
identifique a peça pelo nome no `.glb` e trate direto em vez de por heurística.

## Estado atual, medido

`set.glb` = 15.127.160 bytes. Já corrigido e verificado por render nesta
sequência (não refaça):

- Campo externo: `outer` (brita) e `out_*` (grama) cobriam a mesma faixa com
  relevos independentes — a brita ficava acima em 52,4 % da área, furo máx.
  91 cm. Agora `outer` é derivado de `outland_z − 0.35`.
- Tinta da pista: `MARK_DZ_K` quadrático + `MARK_MAX_R = 240 m`.
- Boca do entroncamento: guia e sarjeta em arco tangente ao asfalto, UV refeita,
  linha de bordo acompanhando o raio.
- Guia ao longo de toda a via interna, com arremate em rampa na ponta livre.
- Travessia do canteiro na cota do canteiro (era a do pátio, +6 cm).
- Rebaixo da laje com concordância `SLAB_BLEND` (era retângulo, degrau reto).
- `COLOR_0` limitado em banda pela célula medida da malha, e **um campo só para
  o sítio** (era uma semente por malha — duas superfícies do mesmo asfalto liam
  como materiais diferentes).
- Audit de layout com BVH; `NA RUA` detecta peça sobre via interna.
