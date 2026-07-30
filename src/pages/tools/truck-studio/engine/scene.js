/* Renderer, scene, camera, controls, the procedural road environment, the
   weather/time-of-day light rig, and the render loop.
   ---------------------------------------------------------------------------
   LIGHT RIG DESIGN

   One `key` DirectionalLight stands in for both sun and moon. It is NOT two
   lights that swap: `castShadow` is a shader program parameter
   (NUM_DIR_LIGHT_SHADOWS), so flipping it recompiles every material in the
   scene — the old sun/moon swap at night did exactly that. With a single key
   light, NUM_DIR_LIGHTS and NUM_DIR_LIGHT_SHADOWS are constant for the page's
   lifetime and "sun vs moon" becomes pure data (colour + intensity + angle).
   Shadow darkness is still fully controllable because r171 plumbs
   LightShadow.intensity through to the `shadowIntensity` uniform
   (getShadow() ends in `mix( 1.0, shadow, shadowIntensity )`), so "shadows
   almost off" under overcast is a tweenable float, never a boolean.

   Everything else about a preset is data too: light colours, sky gradient
   stops, fog, exposure, star/lamp state, ground wetness, rain. Presets
   crossfade over ~0.8 s through a generic snapshot lerp, so no preset needs
   hand-written transition code.

   The sky dome is a ShaderMaterial with three colour uniforms rather than
   baked vertex colours. The old version re-uploaded a ~2 000-float buffer
   attribute on every slider event and could only ever interpolate between two
   hard-coded gradients.

   Note on overcast: a CIE overcast sky is BRIGHTER AT THE ZENITH
   (L(θ) = L_zenith·(1+2cosθ)/3, so horizon ≈ 1/3 of zenith) — the opposite of
   a clear sky, where the zenith is deep blue and the horizon pale. The
   presets encode that flip; it is a large part of why each one reads
   differently. The near-horizon brightening people associate with overcast is
   aerosol haze, which is scene.fog's job, not the dome's.
*/
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { setKeyLight } from './paint.js';
import { $ } from './dom.js';

export const holder = $('canvas-holder');

export const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;   // shadow.radius only works with PCFSoft
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
holder.appendChild(renderer.domElement);

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb8d8f5);
/* FogExp2 for every preset: switching fog TYPE would flip #define FOG_EXP2 and
   recompile everything, and exponential falloff is what sells near-field mist.
   density ≈ 1.978 / visibility_metres (98 % opaque at that distance). */
scene.fog = new THREE.FogExp2(0xb8d8f5, 0.0028);

export const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 600);
camera.position.set(14, 6, 18);

export const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxPolarAngle = Math.PI / 2 - 0.02;      // never orbit below the horizon

const CAM_MIN_Y = 0.15;                            // pan guard: camera stays above ground

/* ---------------- frame / rig hooks ----------------
   weather.js registers here instead of scene.js importing it, which would be a
   cycle (weather needs `scene`, `camera` and the render loop). */
const frameHooks = [];
const rigHooks = [];
export function onFrame(fn) { frameHooks.push(fn); }
export function onRig(fn) { rigHooks.push(fn); if (rigCur) fn(rigCur); }

/* ---------------- light rig ---------------- */
const key = new THREE.DirectionalLight(0xffefe1, 3.1);
key.castShadow = true;                             // permanently — never toggled
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -14; key.shadow.camera.right = 14;
key.shadow.camera.top = 14; key.shadow.camera.bottom = -14;
key.shadow.camera.near = 4; key.shadow.camera.far = 90;
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.02;
key.shadow.radius = 2;
scene.add(key, key.target);

/* cool counter-light from behind: separates the bodywork from the sky and
   gives the metallic flanks something to catch */
const rim = new THREE.DirectionalLight(0xbfd6ff, 0.35);
scene.add(rim);

/* sky/ground bounce + a floor of ambient so nothing is ever pure black */
const hemi = new THREE.HemisphereLight(0x8fb8f0, 0x514c44, 0.35);
scene.add(hemi);
const ambient = new THREE.AmbientLight(0x6f7d90, 0.10);
scene.add(ambient);

/* ---------------- procedural textures ---------------- */
function canvasTex(c, repX, repY, colorSpace) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = colorSpace === undefined ? THREE.SRGBColorSpace : colorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repX, repY);
  t.anisotropy = 8;
  return t;
}

/* wheel-track positions, shared by the asphalt wear and the puddle mask */
const RUTS = [0.16, 0.37, 0.63, 0.84];

function makeAsphaltCanvas(withLines) {
  const S = 1024;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#2c2e31';
  g.fillRect(0, 0, S, S);
  /* multi-octave speckle */
  for (const [n, s, a] of [[26000, 1.5, 0.5], [9000, 3, 0.28], [2200, 6, 0.16]]) {
    for (let i = 0; i < n; i++) {
      const v = 30 + Math.random() * 46;
      g.fillStyle = `rgba(${v},${v},${v + 3},${a})`;
      g.fillRect(Math.random() * S, Math.random() * S, s, s);
    }
  }
  /* faint cracks */
  g.strokeStyle = 'rgba(12,13,15,.35)';
  g.lineWidth = 1.2;
  for (let i = 0; i < 22; i++) {
    g.beginPath();
    let x = Math.random() * S, y = Math.random() * S;
    g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 90; y += Math.random() * 70; g.lineTo(x, y); }
    g.stroke();
  }
  if (withLines) {
    /* tire-wear darkening: two wheel tracks per lane */
    for (const u of RUTS) {
      const x = u * S;
      const grad = g.createLinearGradient(x - 46, 0, x + 46, 0);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.5, 'rgba(0,0,0,.20)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(x - 46, 0, 92, S);
    }
    /* crisp lane markings */
    g.fillStyle = '#ece9df';
    for (let y = 0; y < S; y += 256) g.fillRect(S / 2 - 7, y, 14, 128);   // dashed center
    g.fillRect(30, 0, 12, S);                                             // edge lines
    g.fillRect(S - 42, 0, 12, S);
  }
  return c;
}

/* Puddle mask, used as a roughnessMap when the road is wet: water pools in the
   wheel-track depressions, so most blobs are pinned to the ruts. three reads
   the GREEN channel only and MULTIPLIES it by material.roughness, so white
   means "as rough as the material says" (damp film) and dark means mirror. */
function makePuddleCanvas() {
  const S = 512;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, S, S);
  const blob = (x, y, rx, ry, rot) => {
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    grad.addColorStop(0, 'rgba(20,20,20,1)');
    grad.addColorStop(0.62, 'rgba(20,20,20,.92)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.scale(rx, ry);
    g.fillStyle = grad;
    g.beginPath(); g.arc(0, 0, 1, 0, 7); g.fill();
    g.restore();
  };
  for (let i = 0; i < 90; i++) {
    /* ~78 % of puddles sit in a rut; the rest are scattered */
    const inRut = Math.random() < 0.78;
    const x = inRut
      ? RUTS[(Math.random() * RUTS.length) | 0] * S + (Math.random() - 0.5) * 34
      : Math.random() * S;
    const y = Math.random() * S;
    const rx = 10 + Math.random() * 26;
    const ry = rx * (2.2 + Math.random() * 2.6);      // elongated along the road
    /* draw three times so blobs wrap across the seam in both axes */
    for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
      if (Math.abs(x + dx - S / 2) > S || Math.abs(y + dy - S / 2) > S) continue;
      blob(x + dx, y + dy, rx, ry, 0);
    }
  }
  return c;
}

function makeGrassCanvas() {
  const S = 512;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#3d5f2a';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 70; i++) {
    g.fillStyle = ['rgba(70,107,47,.35)', 'rgba(54,84,38,.4)', 'rgba(96,124,58,.3)', 'rgba(120,134,70,.22)'][i % 4];
    g.beginPath();
    g.ellipse(Math.random() * S, Math.random() * S, 25 + Math.random() * 70, 15 + Math.random() * 45, Math.random() * 3, 0, 7);
    g.fill();
  }
  const shades = ['#4c7a33', '#557f2f', '#6b8f3a', '#2f4a20', '#7f9a4a', '#40651f'];
  for (let i = 0; i < 26000; i++) {
    g.fillStyle = shades[(Math.random() * shades.length) | 0];
    g.globalAlpha = 0.45;
    g.fillRect(Math.random() * S, Math.random() * S, 1.2, 2 + Math.random() * 3);
  }
  g.globalAlpha = 1;
  return c;
}

function makeGravelCanvas() {
  const S = 256;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#6b6257';
  g.fillRect(0, 0, S, S);
  const shades = ['#7a7164', '#5c544a', '#8a8274', '#4e463d', '#9a927f'];
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = shades[(Math.random() * shades.length) | 0];
    g.globalAlpha = 0.6;
    const s = 1 + Math.random() * 3;
    g.fillRect(Math.random() * S, Math.random() * S, s, s);
  }
  g.globalAlpha = 1;
  return c;
}

function makeBladeTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  const greens = ['#4c7a33', '#5b8a38', '#3d6527', '#6f9440'];
  for (let i = 0; i < 9; i++) {
    const x0 = 6 + Math.random() * 52;
    const bend = (Math.random() - 0.5) * 26;
    g.strokeStyle = greens[(Math.random() * greens.length) | 0];
    g.lineWidth = 2.5 + Math.random() * 2.5;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x0, 128);
    g.quadraticCurveTo(x0 + bend * 0.4, 70, x0 + bend, 8 + Math.random() * 26);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ---------------- sky dome ---------------- */
const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize( position );
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`;

const SKY_FRAG = /* glsl */`
uniform vec3 uTop;
uniform vec3 uMid;
uniform vec3 uHor;
uniform float uMidPos;
uniform float uBias;
uniform vec3 uHaloColor;
uniform float uHalo;
uniform float uDisc;
uniform vec3 uKeyDir;
uniform float uCloud;
uniform float uTime;
varying vec3 vDir;

float skyHash( vec2 p ) {
  return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 );
}
float skyNoise( vec2 p ) {
  vec2 i = floor( p ), f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( skyHash( i ), skyHash( i + vec2( 1.0, 0.0 ) ), f.x ),
              mix( skyHash( i + vec2( 0.0, 1.0 ) ), skyHash( i + vec2( 1.0 ) ), f.x ), f.y );
}
float skyFbm( vec2 p ) {
  return skyNoise( p ) * 0.55 + skyNoise( p * 2.17 ) * 0.28 + skyNoise( p * 4.63 ) * 0.17;
}

void main() {
  float t = clamp( vDir.y, 0.0, 1.0 );
  float tt = pow( t, uBias );
  vec3 col = tt < uMidPos
    ? mix( uHor, uMid, tt / max( uMidPos, 1e-4 ) )
    : mix( uMid, uTop, ( tt - uMidPos ) / max( 1.0 - uMidPos, 1e-4 ) );

  /* Cloud mottling as a pure luminance modulation — it can never produce
     white puffs pasted on blue, it just breaks up the flat grey that makes an
     overcast dome look like a gradient. The 1/y projection makes the cells
     converge correctly toward the horizon. */
  if ( uCloud > 0.01 ) {
    vec2 cuv = vDir.xz / max( abs( vDir.y ), 0.055 ) * 0.9 + vec2( uTime * 0.006, uTime * 0.0025 );
    float n = skyFbm( cuv );
    col *= mix( 1.0, 0.80 + 0.40 * n, uCloud * smoothstep( 0.02, 0.25, t ) );
  }

  /* halo + celestial disc, driven by the key-light direction. Under overcast
     uHalo is tiny and uDisc is zero, which gives exactly the diffuse bright
     patch a cloudy sky has where the sun is. */
  float sd = max( dot( vDir, uKeyDir ), 0.0 );
  col += uHaloColor * ( uHalo * pow( sd, 6.0 ) * 0.55 );
  col += uHaloColor * ( uDisc * pow( sd, 4500.0 ) * 14.0 );

  gl_FragColor = vec4( col, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const skyU = {
  uTop: { value: new THREE.Color(0x1f5fc4) },
  uMid: { value: new THREE.Color(0x4d93e8) },
  uHor: { value: new THREE.Color(0xb8d8f5) },
  uMidPos: { value: 0.30 },
  uBias: { value: 0.85 },
  uHaloColor: { value: new THREE.Color(0xfff2d8) },
  uHalo: { value: 0.55 },
  uDisc: { value: 1.0 },
  uKeyDir: { value: new THREE.Vector3(0, 1, 0) },
  uCloud: { value: 0.06 },
  uTime: { value: 0 },
};

function makeSkyDome() {
  /* per-pixel now, so the tessellation only has to be round, not smooth */
  const geo = new THREE.SphereGeometry(340, 24, 14);
  const mat = new THREE.ShaderMaterial({
    uniforms: skyU,
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: true,
    fog: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

function makeStars() {
  const N = 700, R = 332;
  const pts = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const az = Math.random() * Math.PI * 2;
    const el = Math.asin(0.10 + Math.random() * 0.90);   // biased away from the horizon
    pts[i * 3] = R * Math.cos(el) * Math.sin(az);
    pts[i * 3 + 1] = R * Math.sin(el);
    pts[i * 3 + 2] = R * Math.cos(el) * Math.cos(az);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  const m = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xdde6ff, size: 1.7, sizeAttenuation: false,
    transparent: true, opacity: 0, depthWrite: false, fog: false,
  }));
  m.visible = false;
  return m;
}

/* ---------------- street lamps ----------------
   7 lamps, alternating roadsides every 25 m. Their SpotLights are toggled with
   `visible`, which DOES change NUM_SPOT_LIGHTS and therefore recompiles
   materials — verified: WebGLRenderer gathers lights with traverseVisible().
   That is why the toggle is deliberately tied to the day/night switch only (an
   explicit, infrequent user action) and never to a slider. Keeping 7 spotlights
   permanently live would tax every fragment of every material all day. */
const lampSpots = [];
let lampHeadMat = null;

function makeLamps() {
  const g = new THREE.Group();
  lampHeadMat = new THREE.MeshStandardMaterial({
    color: 0x22201c, emissive: 0xffc66b, emissiveIntensity: 0, roughness: 0.6,
  });
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.7, metalness: 0.6 });
  const poleGeo = new THREE.CylinderGeometry(0.05, 0.08, 5.2, 8);
  const armGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.5, 8);
  const headGeo = new THREE.BoxGeometry(0.55, 0.12, 0.24);

  let n = 0;
  for (let z = -75; z <= 75 && n < 7; z += 25, n++) {
    const side = n % 2 ? 1 : -1;
    const lamp = new THREE.Group();
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 2.6;
    lamp.add(pole);
    const arm = new THREE.Mesh(armGeo, poleMat);
    arm.rotation.z = side * Math.PI / 2;
    arm.position.set(-side * 0.75, 5.1, 0);
    lamp.add(arm);
    const head = new THREE.Mesh(headGeo, lampHeadMat);
    head.position.set(-side * 1.5, 5.08, 0);
    lamp.add(head);

    const spot = new THREE.SpotLight(0xffb45e, 0, 30, 0.62, 0.55, 1.6);
    spot.position.set(-side * 1.5, 5.0, 0);
    spot.target.position.set(-side * 2.6, 0, 0);
    spot.castShadow = false;                     // perf: light pools only
    lamp.add(spot, spot.target);
    lampSpots.push(spot);

    lamp.position.set(side * 7.9, 0, z);
    g.add(lamp);
  }
  g.visible = true;
  return g;
}

function makeGrassBlades() {
  const geo = new THREE.PlaneGeometry(0.42, 0.32);
  geo.translate(0, 0.16, 0);
  const mat = new THREE.MeshStandardMaterial({
    map: makeBladeTexture(), alphaTest: 0.45, side: THREE.DoubleSide,
    roughness: 1, metalness: 0,
  });
  const COUNT = 4200;
  const inst = new THREE.InstancedMesh(geo, mat, COUNT);
  const m = new THREE.Matrix4(), p = new THREE.Vector3(),
    q = new THREE.Quaternion(), s = new THREE.Vector3(), e = new THREE.Euler();
  for (let i = 0; i < COUNT; i++) {
    const side = i % 2 ? 1 : -1;
    const nearBias = Math.pow(Math.random(), 1.6);          // denser near the road
    p.set(side * (7.2 + nearBias * 48), 0, (Math.random() - 0.5) * 120);
    e.set(0, Math.random() * Math.PI, 0);
    q.setFromEuler(e);
    const k = 0.7 + Math.random() * 0.9;
    s.set(k, k, k);
    m.compose(p, q, s);
    inst.setMatrixAt(i, m);
  }
  inst.instanceMatrix.needsUpdate = true;
  inst.frustumCulled = false;
  return inst;
}

/* ---------------- road environment ---------------- */
const road = { asphalt: null, shoulders: [], grass: null, blades: null };
let starsMesh = null, lampGroup = null;
let puddleTex = null;

(function buildRoad() {
  const g = new THREE.Group();

  /* 700 m instead of 400: the old plane's 283 m corners were only ~86 % fogged
     and the diagonal edge could be spotted; at 700 the corners (495 m) sit well
     behind the 340 m dome, which occludes them. It is still two triangles. */
  const grassMat = new THREE.MeshStandardMaterial({
    map: canvasTex(makeGrassCanvas(), 88, 88), roughness: 1, metalness: 0,
  });
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), grassMat);
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.03;
  grass.receiveShadow = true;
  g.add(grass);
  road.grass = grassMat;

  for (const side of [-1, 1]) {
    const mat = new THREE.MeshStandardMaterial({
      map: canvasTex(makeGravelCanvas(), 2, 160), roughness: 1, metalness: 0,
    });
    const shoulder = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 340), mat);
    shoulder.rotation.x = -Math.PI / 2;
    shoulder.position.set(side * 7.0, -0.02, 0);
    shoulder.receiveShadow = true;
    g.add(shoulder);
    road.shoulders.push(mat);
  }

  const asphaltMat = new THREE.MeshStandardMaterial({
    map: canvasTex(makeAsphaltCanvas(true), 1, 28), roughness: 0.95, metalness: 0,
  });
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(12, 340), asphaltMat);
  strip.rotation.x = -Math.PI / 2;
  strip.position.y = -0.01;
  strip.receiveShadow = true;
  g.add(strip);
  road.asphalt = asphaltMat;

  road.blades = makeGrassBlades();
  g.add(road.blades);
  g.add(makeSkyDome());
  starsMesh = makeStars();
  g.add(starsMesh);
  lampGroup = makeLamps();
  g.add(lampGroup);
  scene.add(g);
})();

/* remember the dry albedo of every ground material so wetness is reversible */
const dryColors = new Map();
for (const m of [road.asphalt, road.grass, road.blades.material, ...road.shoulders]) {
  dryColors.set(m, m.color.clone());
}

/* Wet asphalt is NOT a Fresnel/F0 change — water's F0 is 0.020, LOWER than
   asphalt's 0.04. It is (a) a large albedo drop, because water fills the pores
   and light that enters no longer scatters back out, and (b) a roughness
   collapse. The dramatic grazing-angle brightening comes for free from the
   F0→F90 term three already computes. Practitioners ship a diffuse multiplier
   around 0.2–0.3; we use 0.25 on the road, less on grass and gravel. */
function applyWetness(w) {
  const set = (m, mul, roughWet) => {
    const dry = dryColors.get(m);
    if (!dry) return;
    m.color.copy(dry).multiplyScalar(1 - w * (1 - mul));
    if (roughWet !== undefined) m.roughness = THREE.MathUtils.lerp(0.95, roughWet, w);
    m.envMapIntensity = 1 + w * 0.35;
  };
  set(road.asphalt, 0.25, 0.42);
  for (const s of road.shoulders) set(s, 0.45, 0.60);
  set(road.grass, 0.72);
  set(road.blades.material, 0.72);

  /* The puddle roughnessMap is attached only while wet. Adding/removing a map
     flips USE_ROUGHNESSMAP and compiles one extra program for these three
     ground materials — a few milliseconds, once, on an explicit preset change,
     and cached from then on. Worth it: without a mask the whole road becomes
     uniformly mirror-smooth, which reads as ice, not rain. */
  const wantMap = w > 0.02;
  if (wantMap && !puddleTex) {
    puddleTex = canvasTex(makePuddleCanvas(), 1, 5, THREE.NoColorSpace);
  }
  const target = wantMap ? puddleTex : null;
  if (road.asphalt.roughnessMap !== target) {
    road.asphalt.roughnessMap = target;
    road.asphalt.needsUpdate = true;
  }
}

/* ---------------- presets ---------------- */
/* Every field here is tweened. Colours are authored as hex and normalised to
   THREE.Color once, at module load. */
const RIG_BASE = {
  keyColor: 0xffefe1, keyIntensity: 3.1, keyAz: 38, keyEl: 52,
  shadowIntensity: 1.0, shadowRadius: 2.0,
  rimColor: 0xbfd6ff, rimIntensity: 0.35,
  hemiSky: 0x8fb8f0, hemiGround: 0x514c44, hemiIntensity: 0.35,
  ambientColor: 0x6f7d90, ambientIntensity: 0.10,
  fogColor: 0xb8d8f5, fogDensity: 0.0028,
  bgColor: 0xb8d8f5,
  skyTop: 0x1f5fc4, skyMid: 0x4d93e8, skyHorizon: 0xb8d8f5,
  skyMidPos: 0.30, skyBias: 0.85,
  skyHaloColor: 0xfff2d8, skyHalo: 0.55, skyDisc: 1.0, cloudiness: 0.06,
  envIntensity: 1.0, exposure: 1.05,
  starOpacity: 0, lampIntensity: 0, lampEmissive: 0, lampColor: 0xffb45e,
  wetness: 0, rain: 0, rainColor: 0xc8d6ea,
  nightness: 0, glintBoost: 1.0,
};

/* Night is a WEATHER-ORTHOGONAL axis: every preset has a dia and a noite face,
   so "overcast at night" and "raining at night" both exist and look right. */
const NIGHT_CLEAR = {
  /* Moonlight is physically ~4100 K — warm, it is reflected sunlight — but is
     universally perceived and depicted as blue (the Purkinje shift moves rod
     vision toward 507 nm at low light). Film convention wins here. */
  keyColor: 0x8fa8d8, keyIntensity: 0.55, keyAz: 300, keyEl: 48,
  shadowIntensity: 0.55, shadowRadius: 4.0,
  rimColor: 0x5f78b0, rimIntensity: 0.10,
  hemiSky: 0x3d5580, hemiGround: 0x1a1c22, hemiIntensity: 0.22,
  ambientColor: 0x26314a, ambientIntensity: 0.10,
  fogColor: 0x141d2e, fogDensity: 0.0050,
  bgColor: 0x141d2e,
  skyTop: 0x050912, skyMid: 0x0b1424, skyHorizon: 0x22304a,
  skyMidPos: 0.26, skyBias: 0.9,
  skyHaloColor: 0xaec4ee, skyHalo: 0.22, skyDisc: 0.55, cloudiness: 0.05,
  envIntensity: 0.35, exposure: 1.45,
  starOpacity: 1, lampIntensity: 95, lampEmissive: 3,
  nightness: 1, glintBoost: 2.0,
};

export const LIGHT_PRESETS = {
  ensolarado: {
    name: 'Ensolarado',
    dia: {},                       // RIG_BASE *is* the sunny day
    noite: { ...NIGHT_CLEAR },
  },

  /* Cool, flat, desaturated — and deliberately containing not one warm hex.
     The cloud deck IS the light source, so hemi does the heavy lifting (1.05)
     while the key light drops to 18 % and its shadow goes faint and very soft.
     Zenith brighter than horizon, per CIE overcast. */
  nublado: {
    name: 'Nublado',
    dia: {
      keyColor: 0xc6d2e0, keyIntensity: 0.58, keyEl: 62,
      shadowIntensity: 0.34, shadowRadius: 9.0,
      rimColor: 0xc9d6e8, rimIntensity: 0.18,
      hemiSky: 0xc4ced9, hemiGround: 0x4e4c48, hemiIntensity: 1.05,
      ambientColor: 0x9aa4ae, ambientIntensity: 0.22,
      fogColor: 0xc2c9cf, fogDensity: 0.0046,
      bgColor: 0xc2c9cf,
      skyTop: 0xc8cbd1, skyMid: 0xacacad, skyHorizon: 0xa1a1a2,
      skyMidPos: 0.42, skyBias: 1.0,
      skyHaloColor: 0xdfe4ea, skyHalo: 0.12, skyDisc: 0.0, cloudiness: 0.85,
      envIntensity: 1.25, exposure: 1.18,
      glintBoost: 1.15,
    },
    noite: {
      ...NIGHT_CLEAR,
      keyColor: 0x7f90ad, keyIntensity: 0.30, keyEl: 60,
      shadowIntensity: 0.22, shadowRadius: 9.0,
      hemiSky: 0x3a4356, hemiGround: 0x191b1f, hemiIntensity: 0.40,
      ambientColor: 0x2b3242, ambientIntensity: 0.16,
      fogColor: 0x1a2028, fogDensity: 0.0062,
      bgColor: 0x1a2028,
      skyTop: 0x141922, skyMid: 0x171c25, skyHorizon: 0x1b2028,
      skyMidPos: 0.42, skyBias: 1.0,
      skyHalo: 0.05, skyDisc: 0.0, cloudiness: 0.9,
      starOpacity: 0,                     // overcast: no stars
      envIntensity: 0.45, exposure: 1.5,
    },
  },

  chuvoso: {
    name: 'Chuvoso',
    dia: {
      keyColor: 0xdfe7ff, keyIntensity: 0.34, keyEl: 68,
      shadowIntensity: 0.20, shadowRadius: 12.0,
      rimColor: 0xb9c8de, rimIntensity: 0.14,
      hemiSky: 0x8e9aa8, hemiGround: 0x2b2c2e, hemiIntensity: 0.88,
      ambientColor: 0x6b7683, ambientIntensity: 0.20,
      fogColor: 0x79848f, fogDensity: 0.0076,
      bgColor: 0x79848f,
      skyTop: 0x898b8f, skyMid: 0x7b7b7d, skyHorizon: 0x767677,
      skyMidPos: 0.45, skyBias: 1.0,
      skyHaloColor: 0xc3c9cf, skyHalo: 0.05, skyDisc: 0.0, cloudiness: 1.0,
      envIntensity: 1.45, exposure: 1.02,
      wetness: 1.0, rain: 0.85,
      glintBoost: 1.2,
    },
    noite: {
      ...NIGHT_CLEAR,
      keyColor: 0x6d7e9e, keyIntensity: 0.24, keyEl: 66,
      shadowIntensity: 0.16, shadowRadius: 12.0,
      hemiSky: 0x2f3846, hemiGround: 0x14161a, hemiIntensity: 0.42,
      ambientColor: 0x252c38, ambientIntensity: 0.16,
      fogColor: 0x12171f, fogDensity: 0.0090,
      bgColor: 0x12171f,
      skyTop: 0x0f131a, skyMid: 0x11161d, skyHorizon: 0x151a21,
      skyMidPos: 0.45, skyBias: 1.0,
      skyHalo: 0.03, skyDisc: 0.0, cloudiness: 1.0,
      starOpacity: 0,
      envIntensity: 0.50, exposure: 1.42,
      wetness: 1.0, rain: 0.9, rainColor: 0x9fb0c8,
      lampIntensity: 115,                 // wet asphalt mirroring lamps: the
      glintBoost: 2.1,                    // best-looking state in the app
    },
  },

  dourado: {
    name: 'Dourado',
    dia: {
      keyColor: 0xffbb81, keyIntensity: 2.2, keyAz: 285, keyEl: 8,
      shadowIntensity: 0.95, shadowRadius: 3.0,
      rimColor: 0x9fb7e8, rimIntensity: 0.30,
      hemiSky: 0xb98ec4, hemiGround: 0x5c4632, hemiIntensity: 0.35,
      ambientColor: 0x8a6f78, ambientIntensity: 0.12,
      fogColor: 0xe8a469, fogDensity: 0.0036,
      bgColor: 0xe8a469,
      skyTop: 0x1d4f8f, skyMid: 0x7b7fae, skyHorizon: 0xff9d4a,
      skyMidPos: 0.34, skyBias: 0.7,
      skyHaloColor: 0xffcf9a, skyHalo: 0.95, skyDisc: 1.4, cloudiness: 0.12,
      envIntensity: 0.95, exposure: 1.15,
    },
    /* golden hour after sundown is the blue hour, not moonlight */
    noite: {
      ...NIGHT_CLEAR,
      keyColor: 0x7e8fc8, keyIntensity: 0.62, keyAz: 285, keyEl: 14,
      hemiSky: 0x4a5f96, hemiGround: 0x241f28, hemiIntensity: 0.34,
      ambientColor: 0x323a5c, ambientIntensity: 0.14,
      fogColor: 0x2b3352, fogDensity: 0.0044,
      bgColor: 0x2b3352,
      skyTop: 0x0a1130, skyMid: 0x1d2a5c, skyHorizon: 0x5a4f7a,
      skyMidPos: 0.32, skyBias: 0.72,
      skyHaloColor: 0xd8a2a0, skyHalo: 0.45, skyDisc: 0.0, cloudiness: 0.10,
      starOpacity: 0.55,
      envIntensity: 0.50, exposure: 1.35,
      lampIntensity: 70,
      glintBoost: 1.7,
    },
  },

  neblina: {
    name: 'Neblina',
    dia: {
      keyColor: 0xeceff9, keyIntensity: 0.42, keyEl: 60,
      shadowIntensity: 0.12, shadowRadius: 12.0,
      rimColor: 0xd6dce6, rimIntensity: 0.12,
      hemiSky: 0xc9d1d4, hemiGround: 0x4a4a48, hemiIntensity: 0.95,
      ambientColor: 0xa3abb0, ambientIntensity: 0.30,
      fogColor: 0xcfd5d6, fogDensity: 0.0165,
      bgColor: 0xcfd5d6,
      skyTop: 0xc6cccd, skyMid: 0xcbd1d2, skyHorizon: 0xd2d7d8,
      skyMidPos: 0.45, skyBias: 1.0,
      skyHaloColor: 0xe8ecee, skyHalo: 0.10, skyDisc: 0.0, cloudiness: 0.45,
      envIntensity: 1.15, exposure: 1.22,
      wetness: 0.35,
      glintBoost: 1.1,
    },
    noite: {
      ...NIGHT_CLEAR,
      keyColor: 0x8492a8, keyIntensity: 0.26, keyEl: 58,
      shadowIntensity: 0.10, shadowRadius: 12.0,
      hemiSky: 0x3f4650, hemiGround: 0x1b1d20, hemiIntensity: 0.46,
      ambientColor: 0x30363f, ambientIntensity: 0.22,
      fogColor: 0x24292e, fogDensity: 0.0180,
      bgColor: 0x24292e,
      skyTop: 0x1d2126, skyMid: 0x1f2429, skyHorizon: 0x22272c,
      skyMidPos: 0.45, skyBias: 1.0,
      skyHalo: 0.04, skyDisc: 0.0, cloudiness: 0.5,
      starOpacity: 0,
      envIntensity: 0.55, exposure: 1.45,
      wetness: 0.4,
      lampIntensity: 105,
    },
  },

  /* Neutral showroom: the one preset that keeps RoomEnvironment, whose
     rectangular light panels give paint the elongated softbox highlights a
     gradient sky cannot. Pick this to judge a colour. */
  estudio: {
    name: 'Estúdio', env: 'room',
    dia: {
      keyColor: 0xfff6ed, keyIntensity: 2.1, keyAz: 150, keyEl: 45,
      shadowIntensity: 0.65, shadowRadius: 6.0,
      rimColor: 0xdfe6f2, rimIntensity: 0.45,
      hemiSky: 0x8a8f96, hemiGround: 0x3c3e42, hemiIntensity: 0.45,
      ambientColor: 0x787d84, ambientIntensity: 0.16,
      fogColor: 0x4a4e54, fogDensity: 0.0012,
      bgColor: 0x4a4e54,
      skyTop: 0x3a3d42, skyMid: 0x4a4e54, skyHorizon: 0x5a5f66,
      skyMidPos: 0.4, skyBias: 1.0,
      skyHaloColor: 0xffffff, skyHalo: 0.05, skyDisc: 0.0, cloudiness: 0,
      envIntensity: 1.35, exposure: 1.10,
    },
    noite: {
      keyColor: 0xe8eefb, keyIntensity: 1.5, keyAz: 150, keyEl: 45,
      shadowIntensity: 0.75, shadowRadius: 5.0,
      rimColor: 0xc6d2ea, rimIntensity: 0.55,
      hemiSky: 0x2c3038, hemiGround: 0x141619, hemiIntensity: 0.35,
      ambientColor: 0x2a2e36, ambientIntensity: 0.12,
      fogColor: 0x14161a, fogDensity: 0.0012,
      bgColor: 0x14161a,
      skyTop: 0x0b0d11, skyMid: 0x101317, skyHorizon: 0x161a1f,
      skyMidPos: 0.4, skyBias: 1.0,
      skyHaloColor: 0xffffff, skyHalo: 0.04, skyDisc: 0.0, cloudiness: 0,
      envIntensity: 1.15, exposure: 1.20,
      nightness: 1, glintBoost: 1.4,
    },
  },
};

export const PRESET_ORDER = ['ensolarado', 'nublado', 'chuvoso', 'dourado', 'neblina', 'estudio'];

/* which rig fields are colours (lerped as THREE.Color) vs plain numbers */
const COLOR_FIELDS = [
  'keyColor', 'rimColor', 'hemiSky', 'hemiGround', 'ambientColor',
  'fogColor', 'bgColor', 'skyTop', 'skyMid', 'skyHorizon', 'skyHaloColor',
  'lampColor', 'rainColor',
];
const NUM_FIELDS = Object.keys(RIG_BASE).filter(k => !COLOR_FIELDS.includes(k));

function makeRig(src) {
  const out = {};
  for (const k of NUM_FIELDS) out[k] = src[k];
  for (const k of COLOR_FIELDS) out[k] = new THREE.Color(src[k]);
  return out;
}

/* preset[tod] merged over RIG_BASE, then the user's own az/el/brightness */
function resolveRig(st) {
  const preset = LIGHT_PRESETS[st.preset] || LIGHT_PRESETS.ensolarado;
  const face = preset[st.timeOfDay] || preset.dia || {};
  const merged = { ...RIG_BASE, ...face };
  const rig = makeRig(merged);
  rig.keyAz = st.az;
  rig.keyEl = st.el;
  rig.keyIntensity = merged.keyIntensity * st.brightness;
  return rig;
}

function presetDefaults(id, tod) {
  const preset = LIGHT_PRESETS[id] || LIGHT_PRESETS.ensolarado;
  const face = { ...RIG_BASE, ...(preset[tod] || preset.dia || {}) };
  return { az: face.keyAz, el: face.keyEl };
}

/* ---------------- state ---------------- */
const SCENE_KEY = 'truckstudio.scene.v3';
for (const old of ['truckstudio.scene.v1', 'truckstudio.scene.v2']) {
  try { localStorage.removeItem(old); } catch (_) { /* ignore */ }
}

export const LIGHT_DEFAULTS = {
  preset: 'ensolarado', timeOfDay: 'dia',
  az: RIG_BASE.keyAz, el: RIG_BASE.keyEl, brightness: 1,
};
export const sceneState = { ...LIGHT_DEFAULTS };

let saveTimer = 0;
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(flushSave, 400);          // sliders must not hammer localStorage
}
export function flushSave() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = 0; }
  try {
    localStorage.setItem(SCENE_KEY, JSON.stringify({ v: 3, ...sceneState }));
  } catch (_) { /* ignore */ }
}
addEventListener('pagehide', flushSave);
addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); });

/* ---------------- environment maps ----------------
   A gradient-sky IBL, one per preset+time. This matters far beyond looks: the
   moment puddle roughness drops to 0.05 the road becomes a mirror, and with
   the old RoomEnvironment it would mirror a white studio box. The canvas is
   equirectangular and deliberately CLOUDLESS — the PMREM mip chain destroys
   high-frequency detail for irradiance anyway, and a blurry reflection cannot
   be told from a gradient. */
const pmrem = new THREE.PMREMGenerator(renderer);
const envCache = new Map();
let roomEnv = null;

function envKey(st) {
  const p = LIGHT_PRESETS[st.preset];
  return (p && p.env === 'room') ? 'room' : st.preset + ':' + st.timeOfDay;
}

/* A smooth gradient reflects as nothing, which is exactly why a clearcoat over
   one reads as dull plastic rather than paint: gloss is perceived from the
   SHARPNESS OF WHAT IT REFLECTS, not from a roughness number. So this env
   deliberately carries hard structure — a crisp horizon line (the strongest
   single cue in any real car photograph), a bright near-horizon band, a tight
   sun core, and a few soft cloud bands to break up the sky. */
function buildSkyEnv(rig) {
  const W = 512, H = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const hex = col => '#' + col.getHexString(THREE.SRGBColorSpace);
  const horizonY = H * 0.5;

  /* sky: zenith → mid → horizon */
  const grad = g.createLinearGradient(0, 0, 0, horizonY);
  grad.addColorStop(0, hex(rig.skyTop));
  grad.addColorStop(THREE.MathUtils.clamp(1 - rig.skyMidPos, 0.05, 0.95), hex(rig.skyMid));
  grad.addColorStop(1, hex(rig.skyHorizon));
  g.fillStyle = grad;
  g.fillRect(0, 0, W, horizonY);

  /* cloud banding: horizontal streaks, brightest near the horizon. Low
     frequency on purpose — PMREM's mip chain would erase fine detail, but
     broad bands survive into the blurrier mips and give a moving reflection. */
  if (rig.cloudiness > 0.05) {
    g.globalAlpha = 0.10 + 0.16 * rig.cloudiness;
    for (let i = 0; i < 7; i++) {
      const y = horizonY * (0.16 + 0.80 * Math.pow(i / 7, 0.7));
      const h = horizonY * (0.02 + 0.05 * (1 - i / 7));
      g.fillStyle = i % 2 ? hex(rig.skyTop) : hex(rig.skyHorizon);
      g.fillRect(0, y, W, h);
    }
    g.globalAlpha = 1;
  }

  /* bright band hugging the horizon */
  const band = g.createLinearGradient(0, horizonY * 0.80, 0, horizonY);
  band.addColorStop(0, 'rgba(255,255,255,0)');
  band.addColorStop(1, `rgba(255,255,255,${(0.16 + 0.22 * (1 - rig.cloudiness)).toFixed(3)})`);
  g.fillStyle = band;
  g.fillRect(0, horizonY * 0.80, W, horizonY * 0.20);

  /* ground half, darker — the sky/ground step at horizonY stays a HARD edge */
  const gg = g.createLinearGradient(0, horizonY, 0, H);
  gg.addColorStop(0, hex(rig.skyHorizon));
  gg.addColorStop(0.10, hex(rig.hemiGround));
  gg.addColorStop(1, hex(rig.hemiGround));
  g.fillStyle = gg;
  g.fillRect(0, horizonY, W, H - horizonY);

  /* key light: a tight core inside a broad halo. Under overcast (skyDisc 0) it
     collapses to just the broad patch, which is what a cloudy sky actually
     shows where the sun is. */
  const az = rig.keyAz * Math.PI / 180, el = rig.keyEl * Math.PI / 180;
  const sx = ((((az / (Math.PI * 2)) % 1) + 1) % 1) * W;
  const sy = (0.5 - el / Math.PI) * H;
  const halo = rig.skyDisc > 0.2 ? 70 : 130;
  const core = rig.skyDisc > 0.2 ? 13 : 0;
  g.save();
  for (const dx of [-W, 0, W]) {                   // wrap across the seam
    g.setTransform(1, 0, 0, 1, dx, 0);
    const hg = g.createRadialGradient(sx, sy, 0, sx, sy, halo);
    hg.addColorStop(0, `rgba(255,255,255,${Math.min(0.75, 0.20 + rig.keyIntensity * 0.14).toFixed(3)})`);
    hg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = hg;
    g.fillRect(0, 0, W, H);
    if (core > 0) {
      const cg = g.createRadialGradient(sx, sy, 0, sx, sy, core);
      cg.addColorStop(0, 'rgba(255,255,255,1)');
      cg.addColorStop(0.55, 'rgba(255,255,255,0.92)');
      cg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = cg;
      g.fillRect(0, 0, W, H);
    }
  }
  g.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  const rt = pmrem.fromEquirectangular(tex);
  tex.dispose();
  return rt.texture;
}

let envTimer = 0;
function refreshEnvironment(rig, immediate) {
  const k = envKey(sceneState);
  const run = () => {
    envTimer = 0;
    if (envCache.has(k)) { scene.environment = envCache.get(k); return; }
    let tex;
    if (k === 'room') {
      if (!roomEnv) roomEnv = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      tex = roomEnv;
    } else {
      tex = buildSkyEnv(rig);
    }
    envCache.set(k, tex);
    scene.environment = tex;
  };
  if (immediate) { if (envTimer) { clearTimeout(envTimer); envTimer = 0; } run(); return; }
  if (envTimer) clearTimeout(envTimer);
  envTimer = setTimeout(run, 120);
}

/* ---------------- tween ---------------- */
let rigCur = null, rigFrom = null, rigTo = null;
let tweenT = 1, tweenDur = 0.8;

const easeInOutCubic = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/* shortest-arc degree lerp, so 350° → 10° goes through 0, not backwards */
function lerpDeg(a, b, t) {
  let d = ((b - a + 540) % 360) - 180;
  return a + d * t;
}

function lerpRig(dst, a, b, t) {
  for (const k of NUM_FIELDS) {
    dst[k] = k === 'keyAz' ? lerpDeg(a[k], b[k], t) : a[k] + (b[k] - a[k]) * t;
  }
  /* Colours lerp in linear-sRGB (THREE.Color already stores linear when colour
     management is on) because these are radiometric quantities. Never lerpHSL:
     blue-grey → orange would swing the hue through green. */
  for (const k of COLOR_FIELDS) dst[k].copy(a[k]).lerp(b[k], t);
}

const _dirW = new THREE.Vector3();
const _dirV = new THREE.Vector3();
const _keyCol = new THREE.Color();

function applyRig(rig) {
  const azr = rig.keyAz * Math.PI / 180;
  const elr = rig.keyEl * Math.PI / 180;
  const r = 26;
  key.position.set(
    r * Math.cos(elr) * Math.sin(azr),
    Math.max(1.0, r * Math.sin(elr)),
    r * Math.cos(elr) * Math.cos(azr)
  );
  key.color.copy(rig.keyColor);
  key.intensity = Math.max(0, rig.keyIntensity);
  key.shadow.intensity = THREE.MathUtils.clamp(rig.shadowIntensity, 0, 1);
  key.shadow.radius = Math.max(0.5, rig.shadowRadius);

  /* rim sits opposite the key and a little higher */
  const rimAz = azr + Math.PI * 0.78;
  rim.position.set(
    22 * Math.cos(0.6) * Math.sin(rimAz), 14, 22 * Math.cos(0.6) * Math.cos(rimAz)
  );
  rim.color.copy(rig.rimColor);
  rim.intensity = Math.max(0, rig.rimIntensity);

  hemi.color.copy(rig.hemiSky);
  hemi.groundColor.copy(rig.hemiGround);
  hemi.intensity = Math.max(0, rig.hemiIntensity);
  ambient.color.copy(rig.ambientColor);
  ambient.intensity = Math.max(0, rig.ambientIntensity);

  scene.fog.color.copy(rig.fogColor);
  scene.fog.density = Math.max(0, rig.fogDensity);
  scene.background.copy(rig.bgColor);
  scene.environmentIntensity = Math.max(0, rig.envIntensity);
  renderer.toneMappingExposure = Math.max(0.05, rig.exposure);

  skyU.uTop.value.copy(rig.skyTop);
  skyU.uMid.value.copy(rig.skyMid);
  skyU.uHor.value.copy(rig.skyHorizon);
  skyU.uMidPos.value = rig.skyMidPos;
  skyU.uBias.value = Math.max(0.05, rig.skyBias);
  skyU.uHaloColor.value.copy(rig.skyHaloColor);
  skyU.uHalo.value = Math.max(0, rig.skyHalo);
  skyU.uDisc.value = Math.max(0, rig.skyDisc);
  skyU.uCloud.value = THREE.MathUtils.clamp(rig.cloudiness, 0, 1);
  _dirW.copy(key.position).normalize();
  skyU.uKeyDir.value.copy(_dirW);

  if (starsMesh) {
    starsMesh.material.opacity = THREE.MathUtils.clamp(rig.starOpacity, 0, 1);
    starsMesh.visible = rig.starOpacity > 0.01;
  }
  if (lampHeadMat) lampHeadMat.emissiveIntensity = Math.max(0, rig.lampEmissive);
  for (const s of lampSpots) {
    s.color.copy(rig.lampColor);
    s.intensity = Math.max(0, rig.lampIntensity);
  }

  applyWetness(THREE.MathUtils.clamp(rig.wetness, 0, 1));

  /* the paint shader reads the key light from these uniforms rather than
     directionalLights[0] — that index depends on three's internal
     shadow-casters-first sort and would silently follow the wrong light */
  _dirV.copy(_dirW).transformDirection(camera.matrixWorldInverse);
  _keyCol.copy(key.color).multiplyScalar(key.intensity);
  setKeyLight(_dirV, _keyCol, rig.glintBoost);

  for (const fn of rigHooks) fn(rig);
}

/* Discrete state cannot be interpolated, so: grow early, shrink late. The lamp
   SpotLights come on the instant a transition to night starts, and only switch
   off once a transition away from night has fully finished — a mid-tween flip
   would be a visible pop AND a shader recompile at the worst moment. */
function setLampsEnabled(on) {
  if (!lampGroup) return;
  for (const s of lampSpots) {
    if (s.visible !== on) s.visible = on;
  }
}

function beginTween(animate) {
  const next = resolveRig(sceneState);
  if (!rigCur) {
    rigCur = next;
    rigFrom = makeRig(RIG_BASE);
    rigTo = next;
    tweenT = 1;
    setLampsEnabled(next.lampIntensity > 0.01);
    applyRig(rigCur);
    refreshEnvironment(rigCur, true);
    return;
  }
  rigTo = next;
  if (!animate) {
    lerpRig(rigCur, next, next, 1);
    tweenT = 1;
    setLampsEnabled(next.lampIntensity > 0.01);
    applyRig(rigCur);
  } else {
    rigFrom = makeRig(RIG_BASE);
    lerpRig(rigFrom, rigCur, rigCur, 1);        // snapshot the current pose
    tweenT = 0;
    if (next.lampIntensity > 0.01) setLampsEnabled(true);   // grow early
  }
  refreshEnvironment(next, false);
}

export const isTransitioning = () => tweenT < 1;
export const getRig = () => rigCur;
export const getKeyLight = () => key;

/* Called once per frame from the render loop; the ONLY writer to three objects. */
export function updateLighting(dt) {
  skyU.uTime.value += dt;
  if (tweenT < 1) {
    tweenT = Math.min(1, tweenT + dt / tweenDur);
    lerpRig(rigCur, rigFrom, rigTo, easeInOutCubic(tweenT));
    applyRig(rigCur);
    if (tweenT >= 1) setLampsEnabled(rigTo.lampIntensity > 0.01);   // shrink late
  } else if (rigCur) {
    /* the paint uniforms are VIEW space, so they must refresh as the camera
       orbits even when the rig itself is static */
    _dirW.copy(key.position).normalize();
    _dirV.copy(_dirW).transformDirection(camera.matrixWorldInverse);
    _keyCol.copy(key.color).multiplyScalar(key.intensity);
    setKeyLight(_dirV, _keyCol, rigCur.glintBoost);
  }
}

/* ---------------- public API ---------------- */
export function applyPreset(id, opts) {
  if (!LIGHT_PRESETS[id]) id = 'ensolarado';
  sceneState.preset = id;
  const d = presetDefaults(id, sceneState.timeOfDay);
  sceneState.az = d.az;
  sceneState.el = d.el;
  sceneState.brightness = 1;
  beginTween(!opts || opts.animate !== false);
  save();
  return sceneState;
}

export function setTimeOfDay(tod, opts) {
  sceneState.timeOfDay = tod === 'noite' ? 'noite' : 'dia';
  const d = presetDefaults(sceneState.preset, sceneState.timeOfDay);
  sceneState.az = d.az;
  sceneState.el = d.el;
  beginTween(!opts || opts.animate !== false);
  save();
  return sceneState;
}

/* az / el / brightness. Defaults to NOT animating: a slider drag has to track
   the thumb, and tweening would lag behind the pointer. */
export function setLightParams(p, opts) {
  if (p.az !== undefined) sceneState.az = +p.az;
  if (p.el !== undefined) sceneState.el = +p.el;
  if (p.brightness !== undefined) sceneState.brightness = +p.brightness;
  beginTween(!!(opts && opts.animate));
  save();
  return sceneState;
}

(function restore() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(SCENE_KEY)); } catch (_) { /* ignore */ }
  if (!s || typeof s !== 'object') s = {};
  /* Stale or hand-edited state must never throw: validate and clamp every
     field, or fall back to the default. */
  const num = (v, d, lo, hi) => {
    if (v === null || v === undefined || v === '') return d;
    const n = +v;
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
  };
  sceneState.preset = LIGHT_PRESETS[s.preset] ? s.preset : LIGHT_DEFAULTS.preset;
  sceneState.timeOfDay = s.timeOfDay === 'noite' ? 'noite' : 'dia';
  const d = presetDefaults(sceneState.preset, sceneState.timeOfDay);
  sceneState.az = num(s.az, d.az, 0, 360);
  sceneState.el = num(s.el, d.el, 2, 85);
  sceneState.brightness = num(s.brightness, 1, 0.15, 2.5);
  beginTween(false);
})();

/* ---------------- framing / resize / loop ---------------- */
export function frameAll(groups) {
  const box = new THREE.Box3();
  for (const g of groups) if (g.visible) box.expandByObject(g);
  if (box.isEmpty()) return;
  const c = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3()).length();
  const k = Math.max(1, 1.35 / camera.aspect);   // narrow viewports need more distance
  controls.target.copy(c);
  camera.position.set(
    c.x + size * 0.55 * k,
    Math.max(CAM_MIN_Y, c.y + size * 0.28 * k),
    c.z + size * 0.62 * k
  );
  camera.far = Math.max(size * 10, 700);         // keep the sky dome inside the frustum
  camera.updateProjectionMatrix();               // near is managed per-frame in the loop
}

/* Ankaa: the studio can be detached from the page (route change) or resized by
   the app chrome (sidebar collapse), so a zero-sized holder is a normal state —
   resizing to 0×0 would drop the drawing buffer and divide the aspect by zero.
   mountStudio() re-runs this and keeps a ResizeObserver on the holder. */
export function resize() {
  const w = holder.clientWidth, h = holder.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();

export function stopLoop() {
  renderer.setAnimationLoop(null);
}

export function startLoop() {
  renderer.setAnimationLoop(() => {
    /* A backgrounded tab returns one huge dt, which would complete every tween
       in a single frame (a visible jump) and teleport the rain field. */
    const dt = Math.min(clock.getDelta(), 0.1);
    controls.update();
    // hard floor guard — right-click panning can otherwise drag under the ground
    if (camera.position.y < CAM_MIN_Y) camera.position.y = CAM_MIN_Y;
    if (controls.target.y < 0.05) controls.target.y = 0.05;
    // dynamic near plane: close-ups must not slice geometry (near ~0.03 when
    // zoomed in), while far views keep depth precision (near grows with range)
    const dist = camera.position.distanceTo(controls.target);
    const near = THREE.MathUtils.clamp(dist / 50, 0.03, 0.3);
    if (Math.abs(near - camera.near) > near * 0.15) {
      camera.near = near;
      camera.updateProjectionMatrix();
    }
    updateLighting(dt);
    for (const fn of frameHooks) fn(dt);
    renderer.render(scene, camera);
  });
}
