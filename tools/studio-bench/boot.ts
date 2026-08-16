/* O que a bancada carrega no navegador: o ENGINE INTEIRO, montado.
   ===========================================================================
   A diferença para `tools/studio-render/rig.ts` — a outra página de máquina
   deste repositório — é o assunto de cada uma. Aquela monta uma CENA PRÓPRIA
   para fotografar cavalos: ela reusa `paint.ts`, `view.ts` e `presets.ts`, mas
   não sobe o estúdio. Esta sobe o estúdio de verdade, com seletor, HUD, cortina
   e captura, porque o que ela existe para verificar é justamente o
   comportamento deles.

   `src/pages/tools/truck-studio/index.tsx` NÃO entra, e é a única coisa que
   fica de fora: ele é React e é quem liga a paleta à API. Sem ele o engine cai
   na paleta embutida (`catalog/colors.ts` já degrada assim, de propósito), que
   é exatamente o que uma bancada quer — nenhuma dependência de rede externa. */
import '../../src/pages/tools/truck-studio/engine/core/studio.css';
import '../../src/pages/tools/truck-studio/engine/ui/selector.css';
import '../../src/pages/tools/truck-studio/engine/ui/loader.css';
import '../../src/pages/tools/truck-studio/engine/ui/hud.css';
import '../../src/pages/tools/truck-studio/engine/ui/paint-panel.css';
/* ⚠️ ESTA LISTA É UMA CÓPIA DA DE `src/pages/tools/truck-studio/index.tsx`, E AS
   DUAS TÊM DE ANDAR JUNTAS. Um `.css` que exista lá e falte aqui não quebra a
   bancada com erro nenhum: o componente aparece SEM ESTILO, e como
   `position: absolute` é justamente uma das coisas que a folha traz, ele cai no
   fluxo normal e some da foto — enquanto todos os portões de comportamento
   continuam passando. Foi assim que o criador de vídeo (2026-08-16) apareceu
   "funcionando e invisível" na primeira rodada. */
import '../../src/pages/tools/truck-studio/engine/ui/timeline.css';

import { mountStudio } from '../../src/pages/tools/truck-studio/engine';
import * as sceneMod from '../../src/pages/tools/truck-studio/engine/scene/scene';
import { captureViewport } from '../../src/pages/tools/truck-studio/engine/scene/capture';
import { applyEnvironment } from '../../src/pages/tools/truck-studio/engine/scene/environment';
import { getEnvironment } from '../../src/pages/tools/truck-studio/engine/catalog/catalog';
import { syncHud } from '../../src/pages/tools/truck-studio/engine/ui/hud';

declare global {
  interface Window {
    __bench: Record<string, unknown>;
    __studio?: Record<string, unknown>;
  }
}

const host = document.getElementById('host') as HTMLElement;
void mountStudio(host);

/* O CAMINHÃO É UM SUBSTITUTO, e isto é deliberado.
   ---------------------------------------------------------------------------
   O driver BLOQUEIA `*.glb` e `*.fbx` (ver bench.mjs). Sem isso o implemento —
   31 MB de Draco sobre 2 151 malhas — é parseado de forma síncrona sob
   SwiftShader, e o que ele starva não é o render: são os próprios temporizadores
   do teste. A mesma armadilha está anotada no harness de plotagem.

   O que a bancada verifica não precisa da geometria real: enquadramento, órbita,
   luz, fundo e recorte são função de uma CAIXA. Então o `RIG` ganha um bloco com
   as medidas do conjunto (19 × 4 × 2,6 m) e tudo a jusante passa a ter um
   sujeito. Quem quiser verificar a geometria de verdade tira o bloqueio — a
   bancada continua funcionando, só devagar. */
function standIn() {
  const THREE = (window.__studio?.THREE) as typeof import('three') | undefined;
  if (!THREE) return false;
  /* `RIG` é criado no tempo de import de vehicle/models.ts (rigGroup), então ele
     existe desde antes do boot — o que falta é um sujeito DENTRO dele. */
  const rig = sceneMod.scene.getObjectByName('RIG');
  if (!rig) return false;
  if (rig.getObjectByName('bench-stand-in')) return true;
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 4.0, 19).translate(0, 2.0, 0),
    new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.35, metalness: 0.1 }),
  );
  box.name = 'bench-stand-in';
  box.castShadow = true;
  box.receiveShadow = true;
  rig.add(box);
  const b = new THREE.Box3().setFromObject(box);
  sceneMod.setVehicleFocus(b);
  sceneMod.frameAll([rig]);
  sceneMod.invalidateShadows();
  return true;
}

/* ATRAVESSA O SELETOR CLICANDO, e não semeando o localStorage.
   ---------------------------------------------------------------------------
   Uma primeira visita abre no assistente de cinco passos e FICA ESPERANDO um
   clique — `openSelector({ cancellable: false })` só resolve com uma escolha
   completa. Uma bancada que não clicasse penduraria o boot para sempre, que foi
   exatamente o primeiro modo de falha desta ferramenta.

   Semear `truckstudio.choice.v1` seria a outra saída e é PIOR: exigiria montar
   um id válido de cenário, modelo, chassi e cor a partir dos manifestos antes de
   o engine subir, ou seja reimplementar `normalizeChoice()` do lado de fora. E
   uma escolha semeada pula o seletor — que também é código que a bancada quer
   ver de pé.

   Sempre o PRIMEIRO card habilitado: um chassi "Em breve" é `disabled`, e
   clicá-lo não faria nada e o laço não avançaria nunca. */
async function settleSelector(): Promise<boolean> {
  const overlay = document.getElementById('ts-selector');
  if (!overlay) return true;
  for (let step = 0; step < 12; step++) {
    if (overlay.classList.contains('hidden')) return true;
    const card = overlay.querySelector<HTMLButtonElement>('.ts-card:not([disabled])');
    if (!card) break;
    card.click();
    /* Dois quadros: renderStep() repinta a grade no quadro seguinte ao clique. */
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }
  return overlay.classList.contains('hidden');
}

window.__bench = {
  scene: sceneMod,
  captureViewport,
  standIn,
  settleSelector,
  /* ENTRAR NO CENÁRIO ESTÚDIO DE VERDADE, e não só aplicar o preset dele.
     A diferença não é acadêmica: `applyPreset('ciclorama')` troca a LUZ, e é
     `applyEnvironment()` quem constrói a sala (`setCyclorama`), desliga os
     postes e o domo, e refaz a caixa de órbita. Um teste que só aplicasse o
     preset acharia a sala inexistente e pularia a verificação em silêncio —
     que foi exatamente o que a primeira rodada desta bancada fez.
     `estudio` é o cenário sem download nenhum (hdri null, sem set), então ele
     entra inteiro mesmo com `*.glb` bloqueado. */
  async enterStudio() {
    const env = getEnvironment('estudio');
    if (!env) return false;
    await applyEnvironment(env);
    syncHud();
    return true;
  },
  /** Um quadro apresentado — o driver espera por isto antes de medir. */
  frame: () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  /** Espera até `fn()` ser verdadeiro, ou estourar. */
  until: async (fn: () => boolean, ms = 20000) => {
    const t0 = performance.now();
    for (;;) {
      if (fn()) return true;
      if (performance.now() - t0 > ms) return false;
      await new Promise((r) => setTimeout(r, 50));
    }
  },
  /** Quantos pixels do PNG saíram transparentes, e quantos opacos. */
  alphaCensus: async (blob: Blob) => {
    const bmp = await createImageBitmap(blob);
    const c = document.createElement('canvas');
    c.width = bmp.width; c.height = bmp.height;
    const ctx = c.getContext('2d', { alpha: true })!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(bmp, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let clear = 0, solid = 0, partial = 0;
    for (let i = 3; i < d.length; i += 4) {
      if (d[i] === 0) clear++;
      else if (d[i] === 255) solid++;
      else partial++;
    }
    return { w: bmp.width, h: bmp.height, clear, solid, partial, total: d.length / 4 };
  },
};
