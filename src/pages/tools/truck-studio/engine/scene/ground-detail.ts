/* O DESGASTE DO CHÃO — detalhe de superfície por fragmento, em espaço de mundo.
   ===========================================================================
   A queixa de 2026-09-26, nas palavras do dono do produto: "as texturas
   continuam muito organizadas e parecendo um padrão", "as faixas sem nenhum
   desgaste", "os rodapés / meio-fios muito quadradinhos".

   DUAS CAUSAS, E A PRIMEIRA NEM ERA DESTE ARQUIVO. O ladrilhamento estocástico
   de set.ts (autocorrelação de um ladrilho de 0,99 para 0,004, medida em
   NumPy) NUNCA RODOU NO APP: `resolveSet()` em environment.ts recriava o
   `macro` só com `scale` e `amount` e `break` morria lá — ver a nota de
   2026-09-26 naquela função. O chão repetia o ladrilho desde agosto.

   A segunda é a ESTATÍSTICA: mesmo sem ladrilho, o chão inteiro tinha o mesmo
   tipo de mancha, na mesma escala, em toda parte. Um chão de verdade é o
   contrário — ele é feito de COISAS, cada uma única e num lugar que tem motivo:

     asfalto  trilha de roda polida, a faixa de óleo no meio da faixa, poeira
              junto da guia, a junta longitudinal da vibroacabadora, trincas
              transversais a cada tantos metros, trincas seladas com piche
              (brilhantes e mais pretas que tudo), remendos com a costura
              selada, couro de jacaré na trilha, manchas de óleo;
     laje     junta serrada a cada 5 m, cada placa de um tom (é um lote de
              concreto), borda lascada em trechos, trinca de canto, pneu de
              manobra em arco, óleo;
     sarjeta  junta de dilatação, areia e folha acumuladas contra a guia;
     guia     sujeira no pé da face, líquen no dorso;
     tinta    tinta que FALTA, e não tinta mais escura;
     grama    mancha seca, mancha mais verde, terra onde pelou.

   TUDO AQUI É FUNÇÃO DE POSIÇÃO — mundo ou referencial da via —, então nada
   repete, nada tem ladrilho e nada custa textura nenhuma. O referencial da via
   (afastamento do eixo, abscissa, meia largura) vem do build, em TEXCOORD_1/2:
   ver `write_frame` em tools/env-build/build_industrial_park.py. As trilhas de
   roda ficam a ±WHEELPATH (0,86 m) do centro de cada faixa lá e aqui — é isso
   que põe o escurecimento de pneu exatamente em cima do sulco da geometria.

   ANTIALIAS DE LINHA. Trinca, junta e costura têm milímetros; a 30 m um pixel
   tem 3 cm. Toda linha passa por `gdLine`, que é o filtro-caixa exato de uma
   faixa contra o pixel: longe, a trinca vira um escurecimento proporcional à
   área que ela cobre, em vez de cintilar. A largura do pixel é medida em
   controle de fluxo UNIFORME, no topo (`fwidth` dentro de um `if` que diverge
   entre os quatro fragmentos de um quad é indefinido), e passada adiante.

   CUSTO, MEDIDO (RX 570, 1440x900, sem o conjunto, checks-parque-custo-0926):
   o detalhe inteiro custava +1,1 a +2,2 ms por quadro. O que o paga agora é a
   DISTÂNCIA: tudo o que só existe em centímetros (couro de jacaré, lasca,
   capim, estria de pneu, grão da tinta) fica dentro de `gdNear`, que vale
   quando o pixel tem menos de 6 cm de chão. Os fragmentos vizinhos na tela
   estão à mesma distância, então o desvio quase não diverge dentro do grupo —
   e longe ele é pulado inteiro, em vez de calculado e depois apagado.

   RELEVO. O que tem volume (costura de piche, borda de remendo, trinca,
   degrau entre placas) entra numa altura em metros, e a normal é inclinada
   pela derivada de tela dela no fim — a mesma técnica do bump map do three
   (`perturbNormalArb`). Some com a distância junto com o que a gera. */
import type * as THREE from 'three';

export type GroundDetailKind = 'asphalt' | 'slab' | 'gutter' | 'kerb' | 'paint' | 'grass';

export interface GroundDetailDef {
  kind: GroundDetailKind;
  /** laje: passo das juntas serradas, em metros [x, y] (padrão 5 x 5) */
  joint?: [number, number];
  /** laje: origem da grelha a leste e a oeste de `split` (x de Blender) */
  origins?: [[number, number], [number, number]];
  /** laje: x (de Blender) que separa as duas grelhas */
  split?: number;
  /** multiplicador geral do contraste do desgaste (padrão 1) */
  amount?: number;
}

const KIND_ID: Record<GroundDetailKind, number> = {
  asphalt: 1, slab: 2, gutter: 3, kerb: 4, paint: 5, grass: 6,
};

export function isGroundDetail(d: unknown): d is GroundDetailDef {
  return !!d && typeof d === 'object'
    && typeof (d as GroundDetailDef).kind === 'string'
    && (d as GroundDetailDef).kind in KIND_ID;
}

/* ---------------- vértice ---------------- */

const VERT_DECL = /* glsl */`
varying vec3 vGdWorld;
varying vec2 vGdUv1;
varying vec2 vGdUv2;
#ifndef USE_UV1
  attribute vec2 uv1;
#endif
#ifndef USE_UV2
  attribute vec2 uv2;
#endif
`;

const VERT_BODY = /* glsl */`
{
  vec4 gdW = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    gdW = instanceMatrix * gdW;
  #endif
  vGdWorld = ( modelMatrix * gdW ).xyz;
  vGdUv1 = uv1;
  vGdUv2 = uv2;
}
`;

/* ---------------- fragmento: ruído e linhas ---------------- */

const FRAG_COMMON = /* glsl */`
varying vec3 vGdWorld;
varying vec2 vGdUv1;
varying vec2 vGdUv2;
uniform vec4 uGdSlab;
uniform vec4 uGdOrg;
uniform float uGdAmt;

/* saídas do estágio de albedo, lidas pelos estágios seguintes */
vec3 gdAlb = vec3( 1.0 );
float gdRoughMul = 1.0;
float gdRoughSet = 0.5;
float gdRoughSetW = 0.0;
float gdHeight = 0.0;
float gdCov = 1.0;
/* Cor ABSOLUTA misturada por cima do multiplicador — terra num gramado não sai
   de multiplicar um verde por nada. */
vec3 gdAbs = vec3( 0.0 );
float gdAbsW = 0.0;
/* Pegada do pixel no chão, em metros. gdFwP é a MAIOR das duas direções de
   tela (decide o relevo, que serrilha feio); gdFwG é a média geométrica e
   decide quando um detalhe fino deixa de existir. Com a maior, na rasante —
   onde o pixel tem 30 cm ao longo da visada e 1 cm atravessado — a borda
   irregular da tinta sumia a 5 m da câmera e a faixa voltava a ser régua. */
float gdFwP = 1.0;
float gdFwG = 1.0;
bool gdNear = true;

float gdH( vec2 p ) {
  vec3 q = fract( vec3( p.x, p.y, p.x ) * vec3( 0.1031, 0.1030, 0.0973 ) );
  q += dot( q, vec3( q.y, q.z, q.x ) + 33.33 );
  return fract( ( q.x + q.y ) * q.z );
}
vec2 gdH2( vec2 p ) {
  vec3 q = fract( vec3( p.x, p.y, p.x ) * vec3( 0.1031, 0.1030, 0.0973 ) );
  q += dot( q, vec3( q.y, q.z, q.x ) + 33.33 );
  return fract( vec2( ( q.x + q.y ) * q.z, ( q.z + q.y ) * q.x ) );
}
float gdN( vec2 p ) {
  vec2 i = floor( p ), f = fract( p );
  vec2 u = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( gdH( i ), gdH( i + vec2( 1.0, 0.0 ) ), u.x ),
              mix( gdH( i + vec2( 0.0, 1.0 ) ), gdH( i + vec2( 1.0, 1.0 ) ), u.x ), u.y );
}
/* Três oitavas GIRADAS — o eixo comum é o que se lê como grelha. */
float gdF( vec2 p ) {
  float a = gdN( p );
  float b = gdN( mat2( 0.8, -0.6, 0.6, 0.8 ) * p * 2.13 + 3.1 );
  float c = gdN( mat2( 0.28, -0.96, 0.96, 0.28 ) * p * 4.71 + 7.3 );
  return a * 0.55 + b * 0.30 + c * 0.15;
}

/* Filtro-caixa exato de uma faixa de meia-largura hw contra um pixel de
   largura fw, na distância com sinal d. Longe, devolve a FRAÇÃO do pixel
   coberta (2hw/fw) — a trinca vira escurecimento proporcional, sem cintilar. */
float gdLine( float d, float hw, float fw ) {
  fw = max( fw, 1e-5 );
  float lo = abs( d ) - 0.5 * fw;
  float hi = abs( d ) + 0.5 * fw;
  return clamp( ( min( hi, hw ) - max( lo, -hw ) ) / fw, 0.0, 1.0 );
}

/* Distância aproximada à aresta de Voronoi, (F2 - F1) / 2, e o sorteio da
   célula. Nove amostras; só roda onde há couro de jacaré. */
vec2 gdVoro( vec2 p ) {
  vec2 n = floor( p ), f = fract( p );
  float d1 = 8.0, d2 = 8.0, id = 0.0;
  for ( int j = -1; j <= 1; j++ ) {
    for ( int i = -1; i <= 1; i++ ) {
      vec2 g = vec2( float( i ), float( j ) );
      vec2 r = g + gdH2( n + g ) * 0.8 + 0.1 - f;
      float d = dot( r, r );
      if ( d < d1 ) { d2 = d1; d1 = d; id = gdH( n + g + 0.5 ); }
      else if ( d < d2 ) { d2 = d; }
    }
  }
  return vec2( 0.5 * ( sqrt( d2 ) - sqrt( d1 ) ), id );
}

/* Mancha de óleo numa grelha de mundo: uma mancha por célula sorteada, toda
   dentro da célula (o centro fica no meio e o raio não passa da borda), então
   basta olhar a PRÓPRIA célula. */
float gdOilStain( vec2 P, float cell, float prob, float salt ) {
  vec2 g = floor( P / cell );
  if ( gdH( g + salt ) >= prob ) return 0.0;
  vec2 c = ( g + 0.3 + 0.4 * gdH2( g + salt + 13.0 ) ) * cell;
  float r = cell * ( 0.06 + 0.12 * gdH( g + salt + 17.0 ) );
  vec2 d2 = ( P - c ) * vec2( 1.0, 0.65 + 0.7 * gdH( g + salt + 2.0 ) );
  /* duas oitavas de borda: uma mancha redonda lia como tampa de bueiro */
  float d = length( d2 ) / r + 0.75 * ( gdN( P * 3.1 + g * 1.7 ) - 0.5 )
          + 0.35 * ( gdN( P * 11.0 + g * 2.3 ) - 0.5 );
  return 1.0 - smoothstep( 0.45, 1.0, d );
}
`;

/* ---------------- asfalto ---------------- */

const ASPHALT_GLSL = /* glsl */`
void gdAsphalt( vec2 P, vec2 fr, float HW, vec4 fw ) {
  float A = fr.x, S = fr.y;
  float framed = step( 0.5, HW );
  float HWx = max( HW, 0.5 );
  float aA = abs( A );
  vec3 alb = vec3( 1.0 );
  float rough = 1.0, h = 0.0, crack = 0.0, seal = 0.0;

  /* 1. a faixa usada. Trilha de roda: mais escura (borracha, finos) e mais
     lisa (agregado polido). Meio da faixa: a linha de óleo que pinga do
     cárter. Junto da guia: poeira, que é mais CLARA e mais fosca. */
  float lc = HWx * 0.5;
  float dLane = abs( aA - lc );
  float dW = abs( dLane - 0.86 );
  float wp = framed * exp( -dW * dW / 0.10 )
           * ( 0.55 + 0.45 * gdN( vec2( S * 0.045, A * 0.25 + 7.0 ) ) );
  float oilN = gdN( vec2( S * 0.9, A * 3.1 ) ) * 0.55
             + gdN( vec2( S * 0.11, A * 0.7 + 3.0 ) ) * 0.45;
  float oil = framed * exp( -dLane * dLane / 0.06 ) * smoothstep( 0.42, 0.75, oilN );
  /* A rugosidade mexe POUCO: medido na primeira foto, 30 % a menos na faixa
     de óleo espelhava o céu e ela lia como uma lista azul molhada no meio da
     faixa. Óleo velho em asfalto é escuro e quase fosco. */
  alb *= 1.0 - 0.22 * wp;
  rough *= 1.0 - 0.05 * wp;
  alb *= 1.0 - 0.30 * oil;
  rough *= 1.0 - 0.08 * oil;
  float edge = framed * smoothstep( HWx - 1.2, HWx - 0.05, aA )
             * ( 0.55 + 0.45 * gdN( P * 1.1 + 5.0 ) );
  alb = mix( alb, alb * vec3( 1.65, 1.55, 1.38 ), edge * 0.6 );
  rough = mix( rough, 1.12, edge );

  if ( framed > 0.5 ) {
    /* 2a. a junta longitudinal da vibroacabadora, no eixo: trinca aberta em
       trechos, selada com piche em outros. */
    float mA = 0.08 * ( gdN( vec2( S * 0.23, 3.3 ) ) - 0.5 )
             + 0.03 * ( gdN( vec2( S * 1.9, 9.1 ) ) - 0.5 );
    float segJ = smoothstep( 0.40, 0.50, gdN( vec2( S * 0.031, 1.7 ) ) );
    float dJ = A - mA;
    float sealJ = step( 0.52, gdN( vec2( S * 0.017, 5.5 ) ) );
    seal = max( seal, segJ * sealJ
      * gdLine( dJ, 0.022 + 0.012 * gdN( vec2( S * 1.3, 2.0 ) ), fw.x ) );
    crack = max( crack, segJ * ( 1.0 - sealJ )
      * gdLine( dJ, 0.003 + 0.003 * gdN( vec2( S * 2.7, 4.0 ) ), fw.x ) );

    /* 2b. trincas transversais (retração térmica / reflexão), em células de
       11 m. Cada uma serpenteia, pode inclinar, pode atravessar só parte da
       pista e pode ter sido selada. As vizinhas entram porque a trinca anda
       até ±0,3 m para fora da própria célula. */
    float L = 11.0;
    float ci = floor( S / L );
    /* DUAS células e não três: a trinca anda no máximo ±0,3 m para fora da
       sua, então só a vizinha do LADO MAIS PRÓXIMO pode alcançar o fragmento. */
    float cn = fract( S / L ) < 0.5 ? -1.0 : 1.0;
    for ( int k = 0; k < 2; k++ ) {
      float c = ci + ( k == 0 ? 0.0 : cn );
      if ( gdH( vec2( c, 17.0 ) ) < 0.62 ) {
        float S0 = ( c + 0.15 + 0.7 * gdH( vec2( c, 29.0 ) ) ) * L;
        float skew = ( gdH( vec2( c, 3.0 ) ) - 0.5 ) * 0.22;
        float mS = 0.45 * ( gdN( vec2( A * 0.5 + c * 3.1, c ) ) - 0.5 )
                 + 0.06 * ( gdN( vec2( A * 3.7, c * 1.3 ) ) - 0.5 ) + skew * A;
        float dS = S - S0 - mS;
        float an = A / HWx;
        float a0 = gdH( vec2( c, 41.0 ) ) < 0.55 ? -1.2 : mix( -1.0, 0.3, gdH( vec2( c, 43.0 ) ) );
        float a1 = a0 + mix( 0.7, 2.6, gdH( vec2( c, 47.0 ) ) );
        float ext = smoothstep( a0, a0 + 0.08, an ) * ( 1.0 - smoothstep( a1 - 0.08, a1, an ) );
        float isSeal = step( 0.45, gdH( vec2( c, 53.0 ) ) );
        seal = max( seal, isSeal * ext * gdLine( dS, 0.024, fw.y ) );
        crack = max( crack, ( 1.0 - isSeal ) * ext * gdLine( dS, 0.004, fw.y ) );
      }
    }

    /* 3. couro de jacaré: fadiga, SÓ na trilha de roda e só em trechos. */
    float alMask = wp * smoothstep( 0.60, 0.72, gdN( vec2( S * 0.07, A * 0.35 + 11.0 ) ) );
    if ( gdNear && alMask > 0.02 ) {
      vec2 e = gdVoro( vec2( A, S ) * 3.3 );
      crack = max( crack, alMask * gdLine( e.x / 3.3, 0.0025, 0.7 * length( fw.xy ) ) );
      alb *= 1.0 - 0.10 * alMask * e.y;
      h -= 0.002 * alMask;
    }
  }

  /* 4. manchas de óleo. A probabilidade é da CÉLULA e não do fragmento: se
     dependesse da faixa de óleo ali, a mancha seria cortada pelo contorno dela. */
  float stain = max( gdOilStain( P, 3.0, 0.07, 71.0 ),
                     gdOilStain( P + 1.5, 7.0, 0.12, 31.0 ) * 0.8 );
  alb *= 1.0 - 0.36 * stain;
  rough *= 1.0 - 0.12 * stain;

  /* 5. remendos: um sorteio por faixa em células de 14 m (defasadas entre as
     faixas). O remendo TAPA o que estava embaixo — trinca e piche somem
     dentro dele — e tem a costura selada. Remendo novo é mais preto e fica
     um pouco acima; remendo velho é cinza e afundou. */
  if ( framed > 0.5 ) {
    for ( int sd = 0; sd < 2; sd++ ) {
      float sg = sd == 0 ? -1.0 : 1.0;
      float off = sd == 0 ? 0.0 : 0.43;
      float L2 = 14.0;
      float cs = floor( S / L2 + off );
      vec2 key = vec2( cs, sg * 7.0 + 3.0 );
      if ( gdH( key ) < 0.20 ) {
        float len = 1.0 + 2.6 * gdH( key + 1.3 );
        float Sc = ( cs - off ) * L2 + 0.6 + len * 0.5 + ( L2 - len - 1.2 ) * gdH( key + 2.9 );
        float wA = 0.55 + 0.9 * gdH( key + 3.7 );
        float Ac = sg * clamp( lc + ( gdH( key + 4.1 ) - 0.5 ) * 1.6, wA + 0.3, HWx - wA - 0.3 );
        /* canto arredondado e borda irregular: remendo é cortado a disco e
           acabado a rodo, não é um retângulo de régua */
        float rr = 0.12 + 0.25 * gdH( key + 6.3 );
        vec2 qd = abs( vec2( A - Ac, S - Sc ) ) - vec2( wA, len * 0.5 ) + rr;
        float dP = length( max( qd, 0.0 ) ) + min( max( qd.x, qd.y ), 0.0 ) - rr;
        dP += 0.06 * ( gdN( P * 4.0 + gdH( key ) * 40.0 ) - 0.5 )
            + 0.02 * ( gdN( P * 17.0 ) - 0.5 );
        float fwd = 0.7 * length( fw.xy ) + 0.002;
        float inside = 1.0 - smoothstep( -fwd, fwd, dP );
        float fresh = step( 0.5, gdH( key + 5.1 ) );
        crack *= 1.0 - inside;
        seal *= 1.0 - inside;
        float tone = mix( 0.72, 0.84, gdH( key + 8.8 ) );
        alb *= mix( vec3( 1.0 ), fresh > 0.5 ? vec3( tone ) : vec3( 1.06, 1.05, 1.02 ), inside );
        rough *= mix( 1.0, fresh > 0.5 ? 0.90 : 1.05, inside );
        h += inside * ( fresh > 0.5 ? 0.004 : -0.005 );
        seal = max( seal, step( 0.5, gdH( key + 7.7 ) ) * gdLine( dP, 0.022, fwd ) );
      }
    }
  }

  /* 6. tampão de poço de visita: ferro fundido num colar de concreto, no meio
     da faixa (entre as trilhas, que é onde a rede corre), um a cada ~57 m. A
     grade do ferro fica POLIDA nos altos e suja nos baixos; o colar é concreto
     claro e trincado; a tampa assenta 5 mm abaixo do asfalto. */
  if ( framed > 0.5 ) {
    float Lm = 57.0;
    float cm = floor( S / Lm + 0.31 );
    if ( gdH( vec2( cm, 61.0 ) ) < 0.7 ) {
      float Sm = ( cm - 0.31 + 0.3 + 0.4 * gdH( vec2( cm, 67.0 ) ) ) * Lm;
      float Am = ( gdH( vec2( cm, 71.0 ) ) < 0.5 ? -1.0 : 1.0 ) * lc;
      vec2 q = vec2( A - Am, S - Sm );
      float r = length( q );
      float R = 0.31;
      float fwr = 0.7 * length( fw.xy ) + 0.001;
      float cover = 1.0 - smoothstep( R - fwr, R + fwr, r );
      float collar = ( 1.0 - smoothstep( R + 0.13 - fwr, R + 0.13 + fwr, r
                       + 0.03 * ( gdN( q * 9.0 + cm ) - 0.5 ) ) ) * ( 1.0 - cover );
      float ang = gdH( vec2( cm, 73.0 ) ) * 1.57;
      vec2 qr = mat2( cos( ang ), -sin( ang ), sin( ang ), cos( ang ) ) * q;
      float fine = 1.0 - smoothstep( 0.004, 0.02, gdFwG );
      float grid = max( abs( sin( qr.x * 42.0 ) ), abs( sin( qr.y * 42.0 ) ) );
      float raised = mix( 0.5, smoothstep( 0.55, 0.8, 1.0 - grid ), fine );
      vec3 iron = mix( vec3( 0.55, 0.52, 0.50 ), vec3( 1.25, 1.2, 1.15 ), raised );
      iron *= 1.0 - 0.4 * gdLine( r - R + 0.035, 0.006, fwr );
      crack *= 1.0 - max( cover, collar );
      seal *= 1.0 - max( cover, collar );
      alb = mix( alb, iron, cover );
      alb = mix( alb, vec3( 2.3, 2.2, 2.05 ) * ( 0.8 + 0.25 * gdN( q * 13.0 ) ), collar );
      rough = mix( rough, mix( 0.85, 0.55, raised ), cover );
      rough = mix( rough, 1.1, collar );
      alb *= 1.0 - 0.6 * gdLine( r - R, 0.004, fwr );
      h += -0.005 * cover + 0.0015 * raised * cover;
    }
  }

  /* piche: preto, brilhante e um fio acima; trinca: escura e funda */
  /* O piche é mais liso que o asfalto, mas não é espelho: com rugosidade 0,36
     a costura refletia o céu na rasante e lia como FAIXA PINTADA atravessando
     a pista. 0,55 guarda o brilho de perto e escurece longe. */
  alb = mix( alb, vec3( 0.26 ), seal * 0.92 );
  gdRoughSet = 0.55;
  gdRoughSetW = seal * 0.7;
  h += 0.0025 * seal;
  alb *= 1.0 - 0.72 * crack;
  h -= 0.004 * crack;

  gdAlb = mix( vec3( 1.0 ), alb, uGdAmt );
  gdRoughMul = mix( 1.0, rough, uGdAmt );
  gdHeight = h * uGdAmt;
}
`;

/* ---------------- laje de concreto ---------------- */

const SLAB_GLSL = /* glsl */`
void gdSlab( vec2 P, vec4 fw ) {
  vec2 J = uGdSlab.xy;
  vec2 org = P.x > uGdSlab.z ? uGdOrg.xy : uGdOrg.zw;
  vec2 q = ( P - org ) / J;
  vec2 id = floor( q );
  vec2 f = ( q - id ) * J;
  vec3 alb = vec3( 1.0 );
  float rough = 1.0, h = 0.0, crack = 0.0;

  /* 1. junta serrada. A serra segue uma linha de giz: ±2,5 mm de desvio. */
  float kx = floor( q.x + 0.5 ), ky = floor( q.y + 0.5 );
  float dX = ( q.x - kx ) * J.x - 0.005 * ( gdN( vec2( P.y * 0.9, kx * 7.1 ) ) - 0.5 );
  float dY = ( q.y - ky ) * J.y - 0.005 * ( gdN( vec2( P.x * 0.9, ky * 5.3 ) ) - 0.5 );
  float joint = max( gdLine( dX, 0.004, fw.z ), gdLine( dY, 0.004, fw.w ) );
  /* borda lascada em trechos: faixa irregular mais escura e áspera */
  float spall = 0.0;
  if ( gdNear ) {
    float spW = 0.015 + 0.03 * gdN( P * 7.0 );
    float spX = smoothstep( 0.64, 0.8, gdN( vec2( P.y * 0.6, kx * 3.3 + 1.0 ) ) );
    float spY = smoothstep( 0.64, 0.8, gdN( vec2( P.x * 0.6, ky * 2.9 + 4.0 ) ) );
    spall = max( spX * ( 1.0 - smoothstep( 0.0, spW, abs( dX ) ) ),
                 spY * ( 1.0 - smoothstep( 0.0, spW, abs( dY ) ) ) );
    spall *= 1.0 - smoothstep( 0.03, 0.06, gdFwG );
  }
  alb *= 1.0 - 0.62 * joint;
  alb *= 1.0 - 0.25 * spall;
  rough = mix( rough, 1.15, spall );
  h -= 0.006 * joint + 0.004 * spall;

  /* 2. cada placa é um lote: tom, matiz e rugosidade próprios, e um degrau de
     poucos milímetros contra a vizinha (a placa que recalcou). */
  float h1 = gdH( id + 0.37 ), h2 = gdH( id + 7.13 ), h3 = gdH( id + 3.31 ), h4 = gdH( id + 9.77 );
  alb *= vec3( 0.90 + 0.18 * h1 )
       * mix( vec3( 1.025, 1.0, 0.955 ), vec3( 0.975, 1.0, 1.03 ), h2 );
  rough *= 0.94 + 0.12 * h3;
  h += ( h4 - 0.5 ) * 0.006;

  /* 3. trinca em ~30 % das placas: de canto (corta uma quina) ou atravessada */
  if ( h3 < 0.30 ) {
    float t = gdH( id + 5.5 );
    vec2 c0, c1;
    if ( t < 0.55 ) {
      float cr = floor( gdH( id + 6.6 ) * 4.0 );
      vec2 corner = vec2( mod( cr, 2.0 ), floor( cr * 0.5 ) ) * J;
      vec2 sgn = 1.0 - 2.0 * vec2( mod( cr, 2.0 ), floor( cr * 0.5 ) );
      c0 = corner + vec2( sgn.x * ( 0.8 + 2.0 * gdH( id + 8.1 ) ), 0.0 );
      c1 = corner + vec2( 0.0, sgn.y * ( 0.8 + 2.0 * gdH( id + 8.9 ) ) );
    } else {
      float pos = 0.3 + 0.4 * gdH( id + 6.1 );
      float sk = ( gdH( id + 6.3 ) - 0.5 ) * 1.4;
      if ( gdH( id + 6.7 ) < 0.5 ) { c0 = vec2( pos * J.x, 0.0 ); c1 = vec2( pos * J.x + sk, J.y ); }
      else { c0 = vec2( 0.0, pos * J.y ); c1 = vec2( J.x, pos * J.y + sk ); }
    }
    vec2 pa = f - c0, ba = c1 - c0;
    float tt = clamp( dot( pa, ba ) / dot( ba, ba ), 0.0, 1.0 );
    vec2 perp = normalize( vec2( -ba.y, ba.x ) );
    float along = tt * length( ba );
    float mean = 0.05 * ( gdN( vec2( along * 1.3, h3 * 50.0 ) ) - 0.5 )
               + 0.015 * ( gdN( vec2( along * 7.0, h3 * 30.0 ) ) - 0.5 );
    float dC = dot( pa - ba * tt, perp ) - mean;
    crack = gdLine( dC, 0.0022 + 0.002 * gdN( f * 3.0 ), 0.7 * length( fw.zw ) );
  }

  /* 4. manchas: óleo onde caminhão para, ferrugem mais rara e maior */
  float stain = max( gdOilStain( P, 3.5, 0.10, 71.0 ), gdOilStain( P + 2.0, 9.0, 0.28, 29.0 ) );
  alb *= 1.0 - 0.38 * stain;
  rough *= 1.0 - 0.35 * stain;
  float rust = gdOilStain( P + 5.0, 13.0, 0.18, 97.0 );
  alb = mix( alb, alb * vec3( 1.08, 0.82, 0.62 ), rust * 0.55 );

  /* 5. pneu de manobra: arcos de raio 7 a 15 m, dois rodados por eixo (o par
     duplo e a outra ponta do eixo, 1,85 m adiante), com estrias ao longo. As
     quatro células mais próximas porque o arco sai da própria. */
  float tyre = 0.0;
  vec2 gc = floor( P / 28.0 );
  vec2 fo = step( vec2( 0.5 ), fract( P / 28.0 ) ) * 2.0 - 1.0;
  for ( int j = 0; j < 2; j++ ) {
    for ( int i = 0; i < 2; i++ ) {
      vec2 gg = gc + vec2( float( i ), float( j ) ) * fo;
      if ( gdH( gg + 91.0 ) < 0.5 ) {
        vec2 c = ( gg + gdH2( gg + 3.0 ) ) * 28.0;
        float R = 7.0 + 8.0 * gdH( gg + 5.0 );
        vec2 v = P - c;
        float dr = length( v ) - R;
        float da = mod( atan( v.y, v.x ) - gdH( gg + 7.0 ) * 6.2832 + 12.5664, 6.2832 );
        float span = 0.5 + 0.9 * gdH( gg + 9.0 );
        float inArc = smoothstep( 0.0, 0.25, da ) * ( 1.0 - smoothstep( span - 0.3, span, da ) );
        float tr = max( 1.0 - smoothstep( 0.10, 0.17, abs( dr ) ),
                        1.0 - smoothstep( 0.10, 0.17, abs( dr - 1.85 ) ) );
        float streak = gdNear ? 0.45 + 0.55 * gdN( vec2( da * R * 1.5, dr * 18.0 ) ) : 0.72;
        tyre = max( tyre, tr * inArc * streak );
      }
    }
  }
  alb *= 1.0 - 0.30 * tyre;
  rough *= 1.0 - 0.10 * tyre;

  alb *= 1.0 - 0.62 * crack;
  h -= 0.004 * crack;

  /* 6. mato na junta: pátio de concreto no Brasil tem capim onde a junta
     perdeu o selante. Faixa de 2-4 cm em trechos, verde-escuro em tufos; só de
     perto ele é tufo, de longe é uma linha escura esverdeada. */
  if ( gdNear ) {
    float wd = 0.012 + 0.018 * gdN( P * 3.0 + 9.0 );
    float weedX = smoothstep( 0.66, 0.78, gdN( vec2( P.y * 0.35, kx * 4.1 + 7.0 ) ) )
                * ( 1.0 - smoothstep( 0.0, wd, abs( dX ) ) );
    float weedY = smoothstep( 0.66, 0.78, gdN( vec2( P.x * 0.35, ky * 3.7 + 2.0 ) ) )
                * ( 1.0 - smoothstep( 0.0, wd, abs( dY ) ) );
    float tuft = mix( 0.7, step( 0.45, gdN( P * 45.0 ) ), 1.0 - smoothstep( 0.01, 0.04, gdFwG ) );
    float weed = max( weedX, weedY ) * tuft * ( 1.0 - smoothstep( 0.03, 0.06, gdFwG ) );
    alb = mix( alb, vec3( 0.42, 0.60, 0.26 ) * ( 0.8 + 0.4 * gdN( P * 20.0 ) ), weed * 0.85 );
    rough = mix( rough, 1.1, weed );
  }

  gdAlb = mix( vec3( 1.0 ), alb, uGdAmt );
  gdRoughMul = mix( 1.0, rough, uGdAmt );
  gdHeight = h * uGdAmt;
}
`;

/* ---------------- sarjeta ---------------- */

const GUTTER_GLSL = /* glsl */`
void gdGutter( vec2 P, vec2 fr, vec4 fw ) {
  if ( fr.y < 0.5 ) return;              // malha sem GutterFrame
  float s = fr.x, t = clamp( fr.y - 1.0, 0.0, 1.0 );
  vec3 alb = vec3( 1.0 );
  float rough = 1.0, h = 0.0;
  /* junta de dilatação: concreto moldado no lugar, cortado a cada ~2,5 m */
  float pitch = 2.5;
  float k = floor( s / pitch + 0.5 );
  float dJ = ( s - k * pitch ) - 0.12 * ( gdH( vec2( k, 3.0 ) ) - 0.5 );
  float joint = gdLine( dJ, 0.004, fw.x );
  alb *= 1.0 - 0.55 * joint;
  h -= 0.004 * joint;
  /* areia e sujeira contra a guia, onde a água corre e larga o que traz */
  float band = 0.22 + 0.38 * gdN( vec2( s * 0.55, 1.0 ) ) + 0.12 * gdN( vec2( s * 2.3, 5.0 ) );
  float sand = smoothstep( 1.0 - band, 1.0 - band + 0.14, t );
  alb = mix( alb, alb * vec3( 1.02, 0.90, 0.72 ), sand * 0.85 );
  rough = mix( rough, 1.15, sand );
  float fine = 1.0 - smoothstep( 0.01, 0.04, gdFwG );
  float deb = gdNear ? step( 0.84, gdN( P * 22.0 ) ) * sand * fine : 0.0;
  alb *= 1.0 - 0.45 * deb;
  /* a costura com o asfalto, no lado baixo */
  alb *= 1.0 - 0.5 * gdLine( t * 0.45, 0.005, fw.y * 0.45 );
  alb *= 1.0 - 0.15 * smoothstep( 0.75, 1.0, t ) * ( 1.0 - sand );
  /* mato: na areia contra a guia e na costura com o asfalto, em trechos */
  float tuft = gdNear ? mix( 0.6, step( 0.5, gdN( P * 40.0 ) ), fine ) : 0.6;
  float wg = smoothstep( 0.70, 0.80, gdN( vec2( s * 0.42, 3.0 ) ) )
           * ( smoothstep( 0.86, 0.97, t ) + ( 1.0 - smoothstep( 0.0, 0.08, t ) ) ) * tuft;
  alb = mix( alb, vec3( 0.40, 0.58, 0.25 ) * ( 0.8 + 0.4 * gdN( P * 18.0 ) ), clamp( wg, 0.0, 1.0 ) * 0.8 );
  gdAlb = mix( vec3( 1.0 ), alb, uGdAmt );
  gdRoughMul = mix( 1.0, rough, uGdAmt );
  gdHeight = h * uGdAmt;
}
`;

/* ---------------- guia ---------------- */

const KERB_GLSL = /* glsl */`
void gdKerb( vec2 P, vec2 fr, vec3 wN ) {
  if ( fr.y < 0.5 ) return;              // malha sem KerbFrame (o embasamento da cerca)
  float above = fr.y - 1.0;
  vec3 alb = vec3( 1.0 );
  /* respingo da sarjeta: os primeiros centímetros da face */
  float g = 1.0 - smoothstep( 0.0, 0.04 + 0.05 * gdN( vec2( fr.x * 2.1, 0.0 ) ), above );
  alb *= 1.0 - 0.30 * g;
  /* líquen e alga preta no que olha para cima */
  float up = clamp( wN.y, 0.0, 1.0 );
  float lich = up * smoothstep( 0.55, 0.82, gdF( P * 2.2 + 11.0 ) );
  alb = mix( alb, alb * vec3( 0.60, 0.64, 0.52 ), lich * 0.65 );
  /* poros e escoriação, só de perto */
  float fine = 1.0 - smoothstep( 0.004, 0.02, gdFwG );
  alb *= 1.0 - 0.18 * fine * step( 0.8, gdN( vec2( fr.x, above + P.x ) * 60.0 ) );
  gdAlb = mix( vec3( 1.0 ), alb, uGdAmt );
}
`;

/* ---------------- tinta ---------------- */

const PAINT_GLSL = /* glsl */`
void gdPaint( vec2 P, vec2 fr, vec2 info ) {
  float wear = info.x, seed = info.y;
  /* O campo de cobertura é de MUNDO (marcas vizinhas concordam sobre qual
     trecho gastou) e tem três escalas: a placa que soltou, a lasca e o grão.
     As finas só existem enquanto o pixel as resolve — longe elas viram a média
     (0,5) em vez de cintilar. */
  float fine = 1.0 - smoothstep( 0.012, 0.05, gdFwG );
  float mid = 1.0 - smoothstep( 0.06, 0.25, gdFwG );
  /* O PESO ESTÁ NO GRÃO, e não na placa. Com a placa de 0,5 m pesando metade,
     a linha contínua gasta virava tracejado — o que se lê é outra sinalização,
     não tinta velha. Tinta de via gasta some em PONTOS, a partir dos picos do
     agregado, e só depois em trechos. */
  float n = 0.30 * gdN( P * 1.9 + seed * 17.0 )
          + 0.35 * mix( 0.5, gdN( P * 8.3 + 3.1 ), mid )
          + 0.35 * mix( 0.5, gdN( P * 37.0 + 7.7 ), fine );
  /* a borda do rolo/da pistola: não é régua */
  float edge = 1.0 - abs( fr.y );
  float rag = 0.07 + 0.20 * mix( 0.5, gdN( vec2( fr.x * 11.0, fr.y * 1.5 + seed * 40.0 ) ), mid );
  /* 1,25 e não 0,85: medido na foto, com a curva mais mansa uma marca de
     desgaste 0,3 perdia menos de 2 % da área e lia como tinta nova. */
  float c = n - ( wear * 1.25 - 0.08 );
  c = min( c, ( edge - rag ) * 0.9 );
  /* ENTRE -0,10 e 0 FICA O FANTASMA: a película fina que sobra nos poros,
     cinza e translúcida de sujeira. Só abaixo disso o asfalto aparece. */
  float cg = c + 0.10;
  float fwc = max( fwidth( cg ), 1e-4 );
  float covNear = clamp( 0.5 + cg / fwc, 0.0, 1.0 );
  float shade = mix( 0.48, 1.0, smoothstep( -0.10, 0.06, c ) );
  /* LONGE, O RECORTE VIRA MÉDIA. Quando o pixel deixa de resolver a lasca, o
     que sobra do campo é a oitava de meio metro, e recortar por ela punha
     buracos regulares ao longo da linha: a linha de bordo gasta lia como
     TRACEJADA a 30 m, que é outra sinalização. A esta distância a tinta não é
     recortada — ela escurece pela fração que se foi, que é o que o olho vê de
     uma faixa gasta ao longe (a média entre a tinta e o asfalto por baixo). */
  float thr = wear * 1.25 - 0.18;
  float covFar = clamp( ( 0.5 - thr ) / 0.45 + 0.5, 0.0, 1.0 );
  covFar *= smoothstep( -0.05, 0.25, edge - 0.12 );
  float far = smoothstep( 0.025, 0.08, gdFwG );
  gdCov = mix( covNear, step( 0.04, covFar ), far );
  vec3 alb = vec3( mix( shade, mix( 0.16, 1.0, covFar ), far ) );
  float grime = 0.20 * gdN( P * 0.7 + 5.0 ) + 0.30 * wear;
  alb *= mix( vec3( 1.0 ), vec3( 0.76, 0.74, 0.69 ), clamp( grime, 0.0, 1.0 ) );
  gdAlb = mix( vec3( 1.0 ), alb, uGdAmt );
  gdRoughMul = mix( 1.0, 1.0 + 0.45 * wear, uGdAmt );
}
`;

/* ---------------- grama ---------------- */

const GRASS_GLSL = /* glsl */`
void gdGrass( vec2 P ) {
  /* Gramado de canteiro industrial não é campo de golfe: seca em manchas onde
     a terra é rasa, fica mais verde onde a água para, e pela em pontos onde se
     pisa ou onde a roçadeira raspou. Três campos de mundo, escalas diferentes. */
  vec3 alb = vec3( 1.0 );
  /* duas oitavas e não três: a grama é a maior área da tela (o campo de fora
     inteiro), e a terceira oitava de uma mancha de 10 m é invisível */
  float dry = smoothstep( 0.52, 0.78, 0.62 * gdN( P * 0.09 + 3.0 )
                                    + 0.38 * gdN( mat2( 0.8, -0.6, 0.6, 0.8 ) * P * 0.21 ) );
  float lush = smoothstep( 0.55, 0.80, 0.62 * gdN( P * 0.13 + 17.0 )
                                     + 0.38 * gdN( mat2( 0.28, -0.96, 0.96, 0.28 ) * P * 0.31 ) )
             * ( 1.0 - dry );
  alb *= mix( vec3( 1.0 ), vec3( 1.40, 1.20, 0.60 ), dry * 0.75 );
  alb *= mix( vec3( 1.0 ), vec3( 0.78, 0.92, 0.72 ), lush * 0.6 );
  float bare = smoothstep( 0.74, 0.86, 0.62 * gdN( P * 0.55 + 41.0 )
                                     + 0.38 * gdN( mat2( 0.8, 0.6, -0.6, 0.8 ) * P * 1.3 ) );
  gdAbs = vec3( 0.16, 0.12, 0.085 ) * ( gdNear ? 0.8 + 0.4 * gdN( P * 6.0 ) : 1.0 );
  gdAbsW = bare * 0.85;
  gdAlb = mix( vec3( 1.0 ), alb, uGdAmt );
  gdRoughMul = mix( 1.0, mix( 1.0, 1.06, bare ), uGdAmt );
}
`;

/* ---------------- os três pontos de emenda ---------------- */

/* Depois de <color_fragment>: albedo e máscaras. É aqui que tudo é CALCULADO;
   os estágios seguintes só leem as globais. */
const FRAG_ALBEDO = /* glsl */`
{
  vec2 gdP = vec2( vGdWorld.x, -vGdWorld.z );
  float gdFx = length( dFdx( gdP ) ), gdFy = length( dFdy( gdP ) );
  gdFwP = max( gdFx, gdFy );
  gdFwG = sqrt( gdFx * gdFy );
  gdNear = gdFwG < 0.06;
  vec4 gdFw = vec4( fwidth( vGdUv1.x ), fwidth( vGdUv1.y ), fwidth( gdP.x ), fwidth( gdP.y ) );
#if GD_KIND == 1
  gdAsphalt( gdP, vGdUv1, vGdUv2.x, gdFw );
#elif GD_KIND == 2
  gdSlab( gdP, gdFw );
#elif GD_KIND == 3
  gdGutter( gdP, vGdUv1, gdFw );
#elif GD_KIND == 4
  vec3 gdWN = vec3( 0.0, 1.0, 0.0 );
  #ifndef FLAT_SHADED
    gdWN = normalize( ( vec4( vNormal, 0.0 ) * viewMatrix ).xyz );
  #endif
  gdKerb( gdP, vGdUv1, gdWN );
#elif GD_KIND == 5
  gdPaint( gdP, vGdUv1, vGdUv2 );
#elif GD_KIND == 6
  gdGrass( gdP );
#endif
  diffuseColor.rgb = mix( diffuseColor.rgb * gdAlb, gdAbs, gdAbsW * uGdAmt );
#if GD_KIND == 5
  #ifdef ALPHA_TO_COVERAGE
    diffuseColor.a *= gdCov;
    if ( gdCov <= 0.0 ) discard;
  #else
    if ( gdCov < 0.5 ) discard;
  #endif
#endif
}
`;

/* Antes de <metalnessmap_fragment>, que vem logo depois da rugosidade —
   funciona com e sem o macro, que substitui <roughnessmap_fragment> inteiro. */
const FRAG_ROUGH = /* glsl */`
roughnessFactor = clamp( roughnessFactor * gdRoughMul, 0.04, 1.0 );
roughnessFactor = mix( roughnessFactor, gdRoughSet, gdRoughSetW );
`;

/* Antes de <emissivemap_fragment>: a normal já saiu do mapa (e do ladrilho
   estocástico). A inclinação vem da derivada de tela da altura — em fluxo
   uniforme — e some quando o pixel passa de ~10 cm, junto com o que a gera. */
const FRAG_NORMAL = /* glsl */`
#if GD_KIND != 5
{
  float gdHh = gdHeight * ( 1.0 - smoothstep( 0.03, 0.12, gdFwP ) );
  vec3 gdSx = dFdx( -vViewPosition ), gdSy = dFdy( -vViewPosition );
  vec3 gdR1 = cross( gdSy, normal ), gdR2 = cross( normal, gdSx );
  float gdDet = dot( gdSx, gdR1 ) * faceDirection;
  vec2 gdDh = vec2( dFdx( gdHh ), dFdy( gdHh ) );
  vec3 gdGrad = sign( gdDet ) * ( gdDh.x * gdR1 + gdDh.y * gdR2 );
  normal = normalize( abs( gdDet ) * normal - gdGrad );
}
#endif
`;

const KIND_GLSL: Record<GroundDetailKind, string> = {
  asphalt: ASPHALT_GLSL, slab: SLAB_GLSL, gutter: GUTTER_GLSL, kerb: KERB_GLSL, paint: PAINT_GLSL,
  grass: GRASS_GLSL,
};

/** A chave de cache do programa — muda com o tipo e com a versão do GLSL. */
export function groundDetailKey(d: GroundDetailDef): string {
  return `ts-gd-v6:${d.kind}`;
}

/**
 * Emenda o detalhe no shader de um MeshStandardMaterial do set. Chamado de
 * dentro do `onBeforeCompile` de set.ts, DEPOIS do macro — as duas emendas
 * mexem em inclusões diferentes e podem conviver no mesmo programa.
 */
export function patchGroundDetail(shader: THREE.WebGLProgramParametersWithUniforms,
                                  d: GroundDetailDef) {
  const j = d.joint ?? [5, 5];
  const o = d.origins ?? [[0, 0], [0, 0]];
  shader.uniforms.uGdSlab = { value: [j[0], j[1], d.split ?? 0, 0] };
  shader.uniforms.uGdOrg = { value: [o[0][0], o[0][1], o[1][0], o[1][1]] };
  shader.uniforms.uGdAmt = { value: d.amount ?? 1 };
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\n' + VERT_DECL)
    .replace('#include <project_vertex>', '#include <project_vertex>\n' + VERT_BODY);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n#define GD_KIND ${KIND_ID[d.kind]}\n`
      + FRAG_COMMON + KIND_GLSL[d.kind])
    .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG_ALBEDO)
    .replace('#include <metalnessmap_fragment>', FRAG_ROUGH + '#include <metalnessmap_fragment>')
    .replace('#include <emissivemap_fragment>', FRAG_NORMAL + '#include <emissivemap_fragment>');
}
