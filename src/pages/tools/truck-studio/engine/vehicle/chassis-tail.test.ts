import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { stretchRigidFrame, tailDeltaFor } from './chassis-tail';
import type { RigidMount } from './mounting';

/* CHASSI SINTÉTICO, com as cotas reais do Volvo VM em `mounts.json`.
   ---------------------------------------------------------------------------
   O teste não carrega `.glb`: o que se quer provar aqui é a ARITMÉTICA do
   deslocamento — quem anda, quem não anda, quanto, e se anda duas vezes. Um
   rip de 18 MB não prova nada disso melhor que quatro caixas, e prova pior,
   porque um defeito de conta fica escondido atrás de um milhão de vértices.

   ⚠️ O QUE ESTE TESTE **NÃO** PROVA: aparência. Que a longarina esticada não
   sai deformada, que o para-choque não fica pendurado e que a lanterna
   acompanha só a foto diz — a doutrina da casa é que uma medida que não vira
   imagem não prova aparência. Isso continua devendo.

   As quatro peças cobrem os quatro comportamentos que existem:
     LONGARINA  cruza o plano de corte      → ESTICA (a ponta anda, o resto não)
     PARACHOQUE inteira atrás do corte      → TRANSLADA rígido
     TANQUE     inteira à frente do corte   → NÃO SE MEXE
     RODA       à frente, e é o caso que o dono repara primeiro se falhar
*/
const MOUNT: RigidMount = {
  id: 'teste-vm',
  orientYaw: Math.PI,
  groundY: -0.0042,
  centerX: 0,
  frameTopY: 1.189,
  frameSlope: -0.02763,
  cabRearZ: 1.033,
  frameEndZ: -7.2473,
  cabTopY: 2.9055,
  /* As cotas de eixo passaram a atravessar `findRigid()` — antes só `config`
     chegava, e `steerZ`/`driveZ`/`liftZ` eram dado morto no manifesto. */
  axles: { config: '6x2', steerZ: [1.8475], driveZ: [-3.4933], liftZ: [-4.7892] },
  railX: 0.425,
  tail: {
    railEndZ: -7.1579,
    tailEndZ: -7.2473,
    cutZ: -6.5579,
    bays: [{ z: -6.5579, cap: 0.594 }, { z: -6.0029, cap: 0.3551 }],
  },
};

/** Uma caixa cujos cantos ficam em cotas conhecidas do espaço NORMALIZADO. */
function caixa(nome: string, z0: number, z1: number, y = 1.0): THREE.Mesh {
  const g = new THREE.BoxGeometry(0.1, 0.1, z1 - z0);
  g.translate(0, y, (z0 + z1) / 2);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial());
  m.name = nome;
  return m;
}

/**
 * A raiz, posta no espaço CRU do GLB: os rips apontam para −Z e `groundY` é o
 * contato do pneu no arquivo. Construir assim (e não já no normalizado) é o que
 * faz o teste exercitar a conversão de verdade — que é onde o erro moraria.
 */
function chassi(): { cab: THREE.Object3D; pecas: Record<string, THREE.Mesh> } {
  const cab = new THREE.Object3D();
  const pecas: Record<string, THREE.Mesh> = {};
  /* No CRU, z_cru = −z_norm e y_cru = y_norm + groundY. */
  const cru = (zNorm: number) => -zNorm;
  for (const [nome, a, b] of [
    ['LONGARINA', -7.1579, 1.5],
    ['PARACHOQUE', -7.2473, -7.10],
    ['TANQUE', -1.230, 0.114],
    ['RODA', -4.90, -4.68],
  ] as const) {
    const m = caixa(nome, cru(b), cru(a), 1.0 + MOUNT.groundY);
    cab.add(m); pecas[nome] = m;
  }
  cab.rotation.y = 0;
  cab.updateWorldMatrix(true, true);
  return { cab, pecas };
}

/**
 * Casas decimais nas comparações de posição.
 *
 * ⚠️ NÃO PODE SER 9. O atributo `position` é `Float32Array`, então uma cota de
 * 7 m carrega ~0,5 µm de quantum e a ida-e-volta local→normalizado→local
 * acumula um pouco mais: medido, o pior desvio deste teste é **0,13 µm**.
 * Exigir 0,5 nm reprova a aritmética correta por causa do formato do buffer.
 * 6 casas (0,5 µm) é folgado para o float e continua sendo 4 ordens de
 * grandeza abaixo de qualquer coisa que se veja.
 */
const TOL = 6;

/** A caixa de uma peça, de volta no espaço NORMALIZADO. */
function normBox(cab: THREE.Object3D, m: THREE.Mesh): THREE.Box3 {
  cab.updateWorldMatrix(true, true);
  const N = new THREE.Matrix4().makeRotationY(MOUNT.orientYaw)
    .multiply(new THREE.Matrix4().makeTranslation(-MOUNT.centerX, -MOUNT.groundY, 0));
  const L2N = N.clone()
    .multiply(new THREE.Matrix4().copy(cab.matrixWorld).invert())
    .multiply(m.matrixWorld);
  const g = m.geometry as THREE.BufferGeometry;
  g.computeBoundingBox();
  return (g.boundingBox as THREE.Box3).clone().applyMatrix4(L2N);
}

describe('stretchRigidFrame — quem anda e quem não anda', () => {
  it('a peça À FRENTE do corte não se mexe, nem alongando nem encurtando', () => {
    for (const d of [-0.314, +0.244, +0.740]) {
      const { cab, pecas } = chassi();
      stretchRigidFrame(cab, MOUNT, d);
      for (const nome of ['TANQUE', 'RODA']) {
        const b = normBox(cab, pecas[nome]);
        const b0 = normBox(chassi().cab, chassi().pecas[nome]);
        expect(b.min.z).toBeCloseTo(b0.min.z, TOL);
        expect(b.max.z).toBeCloseTo(b0.max.z, TOL);
        expect(b.min.y).toBeCloseTo(b0.min.y, TOL);
      }
    }
  });

  it('o PARA-CHOQUE translada exatamente o pedido, e sem mudar de tamanho', () => {
    const d = -0.314;                       // alongar 314 mm, o caso do VM
    const { cab, pecas } = chassi();
    const antes = normBox(cab, pecas.PARACHOQUE);
    stretchRigidFrame(cab, MOUNT, d);
    const depois = normBox(cab, pecas.PARACHOQUE);
    expect(depois.min.z - antes.min.z).toBeCloseTo(d, TOL);
    expect(depois.max.z - antes.max.z).toBeCloseTo(d, TOL);
    /* Rígido: o comprimento é o mesmo. */
    expect(depois.max.z - depois.min.z).toBeCloseTo(antes.max.z - antes.min.z, TOL);
  });

  it('a LONGARINA estica: a ponta anda, a frente fica', () => {
    const d = -0.314;
    const { cab, pecas } = chassi();
    const antes = normBox(cab, pecas.LONGARINA);
    stretchRigidFrame(cab, MOUNT, d);
    const depois = normBox(cab, pecas.LONGARINA);
    expect(depois.min.z - antes.min.z).toBeCloseTo(d, TOL);   // a ponta traseira
    expect(depois.max.z).toBeCloseTo(antes.max.z, TOL);       // a frente, parada
  });

  it('⚠️ a translação segue a RETA DA MESA: dy = frameSlope · dz', () => {
    /* Sem isto o rabo sai da reta da longarina — 8,7 mm baixo demais num
       alongamento de 314 mm no VM, e `frameTopY` passaria a precisar de
       re-medição depois de todo resize. */
    const d = -0.314;
    const { cab, pecas } = chassi();
    const antes = normBox(cab, pecas.PARACHOQUE);
    stretchRigidFrame(cab, MOUNT, d);
    const depois = normBox(cab, pecas.PARACHOQUE);
    expect(depois.min.y - antes.min.y).toBeCloseTo(MOUNT.frameSlope * d, TOL);
    expect(depois.min.y - antes.min.y).toBeCloseTo(0.00868, 5);   // +8,7 mm
  });
});

describe('stretchRigidFrame — idempotência e limites', () => {
  it('DUAS chamadas iguais deixam o mesmo resultado que UMA', () => {
    /* É o contrato que torna seguro chamar de dentro de `placeTrailer()`, que
       roda a cada passo de um arrasto do controle de comprimento. Somar delta
       em vez de partir da base pristina daria 628 mm depois de dois quadros. */
    const d = -0.314;
    const a = chassi(); stretchRigidFrame(a.cab, MOUNT, d);
    const b = chassi(); stretchRigidFrame(b.cab, MOUNT, d); stretchRigidFrame(b.cab, MOUNT, d);
    for (const nome of ['LONGARINA', 'PARACHOQUE']) {
      const ba = normBox(a.cab, a.pecas[nome]);
      const bb = normBox(b.cab, b.pecas[nome]);
      expect(bb.min.z).toBeCloseTo(ba.min.z, TOL);
      expect(bb.min.y).toBeCloseTo(ba.min.y, TOL);
    }
  });

  it('voltar a ZERO devolve o quadro de fábrica', () => {
    const { cab, pecas } = chassi();
    const antes = normBox(cab, pecas.PARACHOQUE);
    stretchRigidFrame(cab, MOUNT, -0.314);
    stretchRigidFrame(cab, MOUNT, +0.740);
    stretchRigidFrame(cab, MOUNT, 0);
    const depois = normBox(cab, pecas.PARACHOQUE);
    expect(depois.min.z).toBeCloseTo(antes.min.z, TOL);
    expect(depois.min.y).toBeCloseTo(antes.min.y, TOL);
  });

  it('ALONGAR não tem limite; ENCURTAR para nas baias, e DIZ quanto coube', () => {
    /* Capacidade do VM: 594,0 + 355,1 = 949,1 mm, menos 20 mm de margem por
       baia = 909,1. Pedir mais devolve menos, e é o chamador que avisa. */
    const { cab } = chassi();
    expect(stretchRigidFrame(cab, MOUNT, -3.0)).toBeCloseTo(-3.0, TOL);
    expect(stretchRigidFrame(cab, MOUNT, +0.740)).toBeCloseTo(+0.740, TOL);
    expect(stretchRigidFrame(cab, MOUNT, +2.0)).toBeCloseTo(0.9091, 4);
  });

  it('sem bloco `tail` medido, não mexe em nada e devolve 0', () => {
    const { cab, pecas } = chassi();
    const antes = normBox(cab, pecas.PARACHOQUE);
    expect(stretchRigidFrame(cab, { ...MOUNT, tail: null }, -0.5)).toBe(0);
    expect(normBox(cab, pecas.PARACHOQUE).min.z).toBeCloseTo(antes.min.z, TOL);
  });
});

describe('tailDeltaFor — o alinhamento do para-choque', () => {
  it('reproduz o desencontro medido nos três rígidos', () => {
    /* Traseira do baú com o gancheiro de fábrica, medida em `placeTrailer()`:
       `encosto − cabGap − 8,510 m`. Negativo = o baú PASSA do para-choque. */
    expect(tailDeltaFor(MOUNT, -7.560) * 1000).toBeCloseTo(-313, 0);
  });

  it('recuo zero põe a face do para-choque NA chapa traseira', () => {
    const alvo = -9.0;
    const d = tailDeltaFor(MOUNT, alvo);
    expect((MOUNT.tail as NonNullable<RigidMount['tail']>).tailEndZ + d).toBeCloseTo(alvo, TOL);
  });
});
