/* Rain streaks + impact ripples for the Chuvoso preset.
   ---------------------------------------------------------------------------
   Both systems are single-draw-call InstancedBufferGeometry with ALL motion in
   the vertex shader, so a frame costs two uniform writes and zero buffer
   uploads.

   THREE.Points was rejected for the rain: gl_PointSize produces a square that
   is always axis-aligned to the screen, so a streak sprite can neither
   foreshorten nor follow the drop's world velocity when the camera tilts —
   look straight up a real downpour and the streaks should collapse to dots.

   The lattice trick: drop positions are a world-space grid that is FOLDED into
   a box centred on the camera (mod around the camera in XZ, mod against the box
   height in Y). That gives free recycling, keeps rain from visibly "sticking"
   to the camera, and anchors the field to the ground rather than to the eye.
*/
import * as THREE from 'three';
import { scene, camera, onFrame, onRig } from './scene';
import type { Rig } from './presets';

const RAIN_COUNT = 2600;                 // ≈0.21 drops/m³ in a 26 m box
const RAIN_BOX = new THREE.Vector3(26, 26, 26);
const RIPPLE_COUNT = 160;

/* ---------------- shared quad ---------------- */
type QuadAttr = [name: string, data: Float32Array, itemSize: number];

function instancedQuad(count: number, extraAttrs: QuadAttr[]) {
  const geo = new THREE.InstancedBufferGeometry();
  geo.instanceCount = count;
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0,
  ]), 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  for (const [name, arr, size] of extraAttrs) {
    geo.setAttribute(name, new THREE.InstancedBufferAttribute(arr, size));
  }
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  return geo;
}

/* ---------------- rain ---------------- */
const RAIN_VERT = /* glsl */`
uniform float uTime;
uniform vec3 uCamPos;
uniform vec3 uBox;
uniform vec2 uWind;
uniform float uLen;
uniform float uWidth;
uniform float uAmount;
attribute vec3 aSeed;
attribute float aRand;
varying vec2 vQuad;
varying float vFade;

void main() {
  // instances above the current density threshold are clipped away entirely,
  // so rainAmount scales the visible count without touching any buffer
  if ( aRand > uAmount ) {
    gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 );
    vQuad = vec2( 0.0 );
    vFade = 0.0;
    return;
  }

  // Gunn & Kinzer terminal velocities: 1 mm → 4.0 m/s, 2 mm → 6.5, 5 mm → 9.1
  float speed = mix( 4.5, 9.0, aRand / max( uAmount, 1e-3 ) );

  vec3 base = aSeed * uBox;
  base.xz += uTime * uWind;
  base.y -= uTime * speed;

  // fold XZ around the camera, Y against the box height (ground-anchored)
  vec2 rel = mod( base.xz - uCamPos.xz + 0.5 * uBox.xz, uBox.xz ) - 0.5 * uBox.xz;
  float wy = mod( base.y, uBox.y );
  vec3 world = vec3( uCamPos.x + rel.x, wy, uCamPos.z + rel.y );

  vec3 posV = ( viewMatrix * vec4( world, 1.0 ) ).xyz;
  vec3 velV = ( viewMatrix * vec4( vec3( uWind.x, -speed, uWind.y ), 0.0 ) ).xyz;

  vec2 d = velV.xy;
  float lenXY = length( d );
  vec2 dir = lenXY > 1e-4 ? d / lenXY : vec2( 0.0, 1.0 );
  // foreshortening: a drop travelling toward the eye has almost no screen-space
  // velocity, so its streak shrinks to a point
  float fore = lenXY / max( length( velV ), 1e-4 );

  vec2 perp = vec2( -dir.y, dir.x );
  posV.xy += dir * ( position.y * uLen * fore ) + perp * ( position.x * uWidth );

  vQuad = position.xy;
  // fade the nearest drops out: a streak a few centimetres from the lens is a
  // full-screen smear
  float dist = length( world - uCamPos );
  vFade = smoothstep( 0.6, 2.5, dist ) * ( 0.35 + 0.65 * fore );

  gl_Position = projectionMatrix * vec4( posV, 1.0 );
}
`;

const RAIN_FRAG = /* glsl */`
uniform vec3 uTint;
uniform float uOpacity;
varying vec2 vQuad;
varying float vFade;
void main() {
  float a = 1.0 - abs( vQuad.x ) * 2.0;                     // soft across the streak
  // edge0 < edge1 always: smoothstep is UNDEFINED when edge0 >= edge1, so the
  // taper is written as an inverted forward ramp rather than a reversed one
  a *= 1.0 - smoothstep( 0.18, 0.5, abs( vQuad.y ) );       // taper the ends
  a *= vFade * uOpacity;
  if ( a <= 0.002 ) discard;
  gl_FragColor = vec4( uTint, a );
}
`;

const rainU = {
  uTime: { value: 0 },
  uCamPos: { value: new THREE.Vector3() },
  uBox: { value: RAIN_BOX },
  uWind: { value: new THREE.Vector2(1.1, 0.35) },
  uLen: { value: 0.55 },
  uWidth: { value: 0.012 },
  uAmount: { value: 0 },
  uTint: { value: new THREE.Color(0xc8d6ea) },
  uOpacity: { value: 0 },
};


function makeRain() {
  const seeds = new Float32Array(RAIN_COUNT * 3);
  const rand = new Float32Array(RAIN_COUNT);
  for (let i = 0; i < RAIN_COUNT; i++) {
    seeds[i * 3] = Math.random();
    seeds[i * 3 + 1] = Math.random();
    seeds[i * 3 + 2] = Math.random();
    rand[i] = Math.random();
  }
  const geo = instancedQuad(RAIN_COUNT, [
    ['aSeed', seeds, 3],
    ['aRand', rand, 1],
  ]);
  const mat = new THREE.ShaderMaterial({
    uniforms: rainU,
    vertexShader: RAIN_VERT,
    fragmentShader: RAIN_FRAG,
    transparent: true,
    /* NormalBlending, not additive: rain must near-vanish against a bright sky
       and read against the dark road and the truck, which is what real rain
       does. Additive blows out the sky. */
    blending: THREE.NormalBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    fog: false,
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = 30;
  m.visible = false;
  return m;
}

/* ---------------- impact ripples ----------------
   Without these the wet road reads as "it rained an hour ago" — the drops
   visibly never arrive. Confined to the asphalt strip (|x| < 6) and folded
   along Z only, since ripples on grass would be nonsense. */
const RIPPLE_VERT = /* glsl */`
uniform float uTime;
uniform vec3 uCamPos;
uniform float uSpanZ;
uniform float uAmount;
attribute vec3 aSeed;
attribute float aRand;
varying vec2 vQuad;
varying float vLife;

void main() {
  if ( aRand > uAmount ) {
    gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 );
    vQuad = vec2( 0.0 ); vLife = 0.0;
    return;
  }
  float life = fract( uTime * 1.15 + aRand * 7.31 );
  float radius = 0.05 + life * 0.34;

  float z0 = aSeed.z * uSpanZ;
  float relZ = mod( z0 - uCamPos.z + 0.5 * uSpanZ, uSpanZ ) - 0.5 * uSpanZ;
  vec3 world = vec3( ( aSeed.x - 0.5 ) * 12.0, 0.008, uCamPos.z + relZ );

  // ground-plane billboard: the quad lies flat in XZ
  world.x += position.x * radius * 2.0;
  world.z += position.y * radius * 2.0;

  vQuad = position.xy;
  vLife = life;
  gl_Position = projectionMatrix * viewMatrix * vec4( world, 1.0 );
}
`;

const RIPPLE_FRAG = /* glsl */`
uniform vec3 uTint;
uniform float uOpacity;
varying vec2 vQuad;
varying float vLife;
void main() {
  float d = abs( length( vQuad ) * 2.0 - 0.92 );
  float a = 1.0 - smoothstep( 0.0, 0.30, d );       // forward edges, see above
  a *= ( 1.0 - vLife ) * ( 1.0 - vLife ) * uOpacity;
  if ( a <= 0.002 ) discard;
  gl_FragColor = vec4( uTint, a );
}
`;

const rippleU = {
  uTime: { value: 0 },
  uCamPos: { value: new THREE.Vector3() },
  uSpanZ: { value: 40 },
  uAmount: { value: 0 },
  uTint: { value: new THREE.Color(0xdbe6f5) },
  uOpacity: { value: 0 },
};


function makeRipples() {
  const seeds = new Float32Array(RIPPLE_COUNT * 3);
  const rand = new Float32Array(RIPPLE_COUNT);
  for (let i = 0; i < RIPPLE_COUNT; i++) {
    seeds[i * 3] = Math.random();
    seeds[i * 3 + 1] = Math.random();
    seeds[i * 3 + 2] = Math.random();
    rand[i] = Math.random();
  }
  const geo = instancedQuad(RIPPLE_COUNT, [
    ['aSeed', seeds, 3],
    ['aRand', rand, 1],
  ]);
  const mat = new THREE.ShaderMaterial({
    uniforms: rippleU,
    vertexShader: RIPPLE_VERT,
    fragmentShader: RIPPLE_FRAG,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = 29;
  m.visible = false;
  return m;
}

/* ---------------- wiring ---------------- */
let amount = 0;
const _rippleTint = new THREE.Color();
const WHITE = new THREE.Color(0xffffff);

export function initWeather() {
  /* Locals, not module state: both closures below capture them, and nothing
     outside this function ever needs the meshes again. */
  const rain = makeRain();
  const ripples = makeRipples();
  scene.add(rain, ripples);

  onRig((rig: Rig) => {
    amount = THREE.MathUtils.clamp(rig.rain, 0, 1);
    rainU.uAmount.value = amount;
    rainU.uOpacity.value = 0.34 * Math.min(1, amount * 1.4);
    rainU.uTint.value.copy(rig.rainColor);
    rainU.uWidth.value = 0.010 + 0.006 * amount;

    rippleU.uAmount.value = amount * 0.9;
    rippleU.uOpacity.value = 0.30 * amount;
    rippleU.uTint.value.copy(_rippleTint.copy(rig.rainColor).lerp(WHITE, 0.35));

    const on = amount > 0.02;
    rain.visible = on;
    ripples.visible = on;
  });

  onFrame((dt: number) => {
    if (amount <= 0.02) return;
    /* accumulate from the clamped dt rather than reading an absolute clock, or
       returning to a backgrounded tab teleports the whole field */
    rainU.uTime.value += dt;
    rippleU.uTime.value += dt;
    rainU.uCamPos.value.copy(camera.position);
    rippleU.uCamPos.value.copy(camera.position);
  });
}
