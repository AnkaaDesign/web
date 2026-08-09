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

/* A POSE DO CARD, QUE DE PROPOSITO NAO E MAIS A DO ESTUDIO.
   ---------------------------------------------------------------------------
   O cabecalho deste arquivo diz que as duas tem de bater, e a razao continua
   valendo: abrir a cena noutro angulo faz parecer que veio parar noutro
   veiculo. O que mudou e que "o mesmo angulo" para de significar "a mesma
   leitura" quando as duas molduras sao diferentes.

   No estudio a camera pousa em openingDistance() e sobra folga em volta do
   caminhao. No card, calibrate() mede a silhueta em pixels e APROXIMA ate ela
   encher ~90% do eixo mais apertado. Com o quadro cheio, os mesmos 13 graus de
   elevacao entregam muito mais telhado: a mesma pose, lida de duas distancias,
   nao e a mesma imagem. Foi essa a queixa — o estudio ficou bom e o card ficou
   "muito do topo".

   Entao o card fica MAIS BAIXO e MAIS FRONTAL que a cena:
     azimute   52 graus (contra 62 do estudio)
     elevacao   8 graus (contra 13)
   Perto o bastante para o card continuar sendo a promessa que a cena cumpre,
   longe o bastante para os dois enquadramentos lerem igual.

   O override por cabine (`viewDir` no cabs.json) SAIU junto com o cabs.json, e
   com ele o consumidor desta constante no card: os cards mostram renders
   PRE-PRODUZIDOS agora (catalog/renders.ts), nao um render ao vivo. Esta pose
   continua sendo a de frameAll(), e e ELA que o pipeline offline de renders tem
   de reproduzir para o card prometer o que a cena entrega. */
export const CARD_VIEW_DIR = new THREE.Vector3(2.00, 0.360, 1.56).normalize();

/** Teleobjetiva curta. É o que achata a perspectiva e afasta a câmera: uma
 *  cabine em 45° incha de perto e denuncia o CG. */
export const FOV = 30;

/** Altura da mira dentro da caixa do veículo. Meia altura, não acima dela:
 *  mirar acima do meio inclina a câmera para baixo e devolve por outro caminho
 *  a vista de cima que VIEW_DIR tirou. */
export const TARGET_H = 0.48;
