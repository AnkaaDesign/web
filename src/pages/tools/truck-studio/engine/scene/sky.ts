/* The procedural sky dome and its star field.
   -------------------------------------------------------------------------
   A ShaderMaterial with three colour uniforms rather than baked vertex colours
   — see the sky-dome notes in scene.ts, which owns `skyU`'s VALUES and drives
   them from the light rig. This module only builds the two meshes and
   publishes the uniform block; it reads no scene state. */
import * as THREE from 'three';

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

export const skyU = {
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

export function makeSkyDome() {
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

export function makeStars() {
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
