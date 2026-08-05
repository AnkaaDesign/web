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

/* Direção da câmera em relação ao centro do veículo. Três quartos pela frente e
   BAIXO: o olho fica perto da linha do para-brisa, não acima do teto.
   O componente y é o único número delicado — a 0.62 (a primeira tentativa) a
   câmera terminava ~1 m acima do teto e virava uma vista de cima, que é
   justamente o que não mostra a lataria. Em 0.30 a elevação fica em ~7°: ainda
   se lê o volume do veículo, e a lateral — onde a tinta aparece — ocupa o quadro.
   O +Z é a frente (vehicle/models.ts assenta a cabine ocupando [0, comprimento]
   com a dianteira no +Z). */
export const VIEW_DIR = new THREE.Vector3(1.55, 0.30, 1.95).normalize();

/** Teleobjetiva curta. É o que achata a perspectiva e afasta a câmera: uma
 *  cabine em 45° incha de perto e denuncia o CG. */
export const FOV = 30;

/** Altura da mira dentro da caixa do veículo. Meia altura, não acima dela:
 *  mirar acima do meio inclina a câmera para baixo e devolve por outro caminho
 *  a vista de cima que VIEW_DIR tirou. */
export const TARGET_H = 0.48;
