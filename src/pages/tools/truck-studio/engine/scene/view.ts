/* A pose canônica de "olhar um caminhão".
   ---------------------------------------------------------------------------
   Três números, e dois lugares os usam: o card do seletor (ui/preview.ts, que
   renderiza a miniatura offscreen) e a abertura do estúdio (scene/scene.ts,
   frameAll()). O card é o que o usuário clicou; se a cena abrisse noutro ângulo,
   o veículo pareceria ter virado outro no caminho.

   POR QUE UM MÓDULO SÓ PARA ISTO, e não um `export` em preview.ts: scene.ts não
   pode importar ui/preview.ts. O caminho seria scene → ui/preview →
   vehicle/models → scene/scene, e scene.ts constrói um WebGLRenderer no tempo de
   import — um ciclo em cima dele não dá um erro claro, dá binding em zona morta
   temporal no meio do boot. Este arquivo não importa nada além do three, então
   os dois lados o alcançam sem fechar aresta nenhuma. */
import * as THREE from 'three';

/* Direção da câmera em relação ao centro do veículo. MAIS DE LADO QUE DE FRENTE,
   e de cima o bastante para ler o comprimento do conjunto.
   O +Z é a frente (vehicle/models.ts assenta a cabine ocupando [0, comprimento]
   com a dianteira no +Z).

   Os números são o azimute e a elevação, escritos como vetor:
     azimute   atan2(x, z) = 62°   — 0° seria de frente, 90° perfil puro. Acima
                                     de 45° a LATERAL manda no quadro, que é
                                     onde a tinta e a plotagem aparecem.
     elevação  atan2(y, hypot(x,z)) = 13°
   Conferir com `__studio.lighting.getCameraPose()`, que devolve exatamente
   `fx/fy/fz` prontos para colar aqui — é o laço de calibração que scene.ts
   documenta, e é como estes três saíram.

   ERA (1.55, 0.30, 1.95): azimute 38,5°, elevação 6,9°. Ou seja mais de FRENTE
   que de lado, e quase na linha do para-brisa. O pedido foi ir para o
   enquadramento do card do cenário (o thumb.webp de cada environment), que é
   uma vista quase de perfil e claramente de cima.

   SOBRE O AVISO QUE ESTAVA AQUI: dizia que y = 0.62 "terminava ~1 m acima do
   teto e virava uma vista de cima". Aquilo foi medido quando frameAll()
   posicionava a câmera por MULTIPLICADORES sobre a diagonal da caixa; hoje a
   distância sai de openingDistance() (raio da esfera / sen do meio-ângulo), que
   num conjunto de 19 m dá ~36 m. Com y = 0.575 sobre um horizontal de 2.49 a
   elevação é 13° e a câmera pousa ~6 m acima do teto do implemento — alto o
   bastante para ver o comprimento, longe de uma planta baixa. O aviso não vale
   mais para esta conta; o limite real de hoje é RISE_ELEV_MAX (62°) lá em
   scene.ts, que é onde a vista de cima realmente começa.

   ESTE VETOR ESTÁ NO REFERENCIAL DO MODELO, NÃO NO DO MUNDO — e quem o usa numa
   cena precisa levar isso em conta. Com a frente no +Z e o Y para cima, o
   esquerdo do veículo (o lado do MOTORISTA) é o +X, e é por ali que esta vista
   olha. O card renderiza o veículo na origem, sem giro, então para
   ele os dois referenciais coincidem; o estúdio põe o conjunto virado 180° no
   pátio (RIG_PLACEMENT), e somar este vetor em mundo lá dava o lado do
   PASSAGEIRO, de trás. Ver openingDir() em scene/scene.ts. */
export const VIEW_DIR = new THREE.Vector3(2.20, 0.575, 1.17).normalize();

/* A POSE DO CARD, QUE DE PROPOSITO NAO E A DO ESTUDIO.
   ---------------------------------------------------------------------------
   O cabecalho deste arquivo diz que as duas tem de bater, e a razao continua
   valendo: abrir a cena noutro angulo faz parecer que o veiculo virou outro no
   caminho. O que mudou e que "o mesmo angulo" para de significar "a mesma
   leitura" quando as duas molduras sao diferentes.

   No estudio a camera pousa em openingDistance() e sobra folga em volta do
   caminhao. No card o quadro e CHEIO — a silhueta ocupa 88 % da altura. Com o
   quadro cheio, os mesmos graus de elevacao entregam muito mais telhado: a
   mesma pose, lida de duas distancias, nao e a mesma imagem.

   Quem consome esta constante e so o pipeline offline
   (`tools/studio-render/rig.ts`). `scene/scene.ts` importa o `VIEW_DIR` acima
   com o APELIDO `CARD_VIEW_DIR`, que e outra coisa: a pose da cena.

   MEDIDO NAS FOTOS DE CATÁLOGO, em 2026-08-09, e não escolhido no olho.
   ---------------------------------------------------------------------------
   As três fotos de fabricante que o projeto já tinha — `iveco/models/s-way`,
   `volvo/models/fh16` e `scania/models/s730` — são exatamente o que um card de
   caminhão tem de parecer, e as três concordam entre si: FRENTE quase inteira,
   lateral encurtada, e do teto só uma fresta.

   Como o azimute sai delas: a largura aparente da FRENTE é `W·cos(az)` e a do
   FLANCO é `L·sin(az)`. Medindo os dois no S-Way (300 px de frente para 270 px
   de flanco, sobre 2,5 m de largura e 2,3 m de cabine) sai `tan(az) ≈ 0,98`,
   ou seja **az ≈ 42°**. A elevação sai das elipses das rodas, que nas três
   fotos são quase círculos: **el ≈ 3,5°**. Comparando o primeiro render com a
   foto lado a lado, 42° ainda mostrava mais flanco que a referência; o valor
   fechado é **38°**, que é onde as duas larguras aparentes coincidem.

     x = sin(38°)·cos(3,5°)   y = sin(3,5°)   z = cos(38°)·cos(3,5°)

   ERA (2.00, 0.360, 1.56) — az 52°, el 8,1°. Dez graus mais de perfil e o
   dobro de elevação, e a diferença NÃO é sutil no quadro: com o caminhão
   ocupando 88 % da altura, o FOV de 30° põe a câmera a ~8,5 m; a 8° de
   elevação ela pousa a 3,1 m do chão, ou seja ACIMA da metade de uma cabine de
   4 m, olhando para o capô e para o teto. A 3,5° ela cai para ~2,4 m — altura
   de janela de motorista, que é de onde as fotos de catálogo são tiradas.

   */
export const CARD_VIEW_DIR = new THREE.Vector3(0.6145, 0.0610, 0.7865).normalize();

/** Teleobjetiva curta. É o que achata a perspectiva e afasta a câmera: uma
 *  cabine em 45° incha de perto e denuncia o CG. */
export const FOV = 30;

/** Altura da mira dentro da caixa do veículo. Meia altura, não acima dela:
 *  mirar acima do meio inclina a câmera para baixo e devolve por outro caminho
 *  a vista de cima que VIEW_DIR tirou. */
export const TARGET_H = 0.48;
