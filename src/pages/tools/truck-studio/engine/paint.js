/* Automotive car-paint material system.
   ---------------------------------------------------------------------------
   Three finish families, matching how real paint is built (e-coat → basecoat →
   optional mica mid-coat → clearcoat):

     'solid'    pigmented basecoat + clearcoat. metalness 0. No flakes, no
                colour travel — flat colour with one sharp coat reflection.
     'metallic' aluminium FLAKES suspended in a coloured basecoat. This is
                *paint* metallic, NOT bare aluminium: the basecoat stays a
                coloured dielectric (metalness ≤ 0.28) and the metal shows up
                only as sparse pin-point flake glints plus a lightness "flop"
                (bright face-on, darker at grazing angles). Pushing metalness
                toward 1 is the classic mistake that turns paint into chrome —
                three.js kills diffuse as metalness rises
                (material.diffuseColor = diffuse * (1 - metalness)), so the
                pigment disappears. Hence the hard cap.
     'pearl'    mica / interference platelets. The hue TRAVELS with viewing
                angle: a face colour that shifts toward a flop colour as the
                surface turns away. Pearls also sparkle, but ~1/3 as densely as
                a metallic.

   Why not three.js `iridescence` for pearl: it is a Belcour-Barla thin-film
   model applied to the SPECULAR lobe only (BRDF_GGX does
   F = mix(F, material.iridescenceFresnel, material.iridescence)), it never
   tints diffuse, and its thickness range sweeps several interference orders —
   which reads as soap bubble, not as mica. Real interference pigment has an
   engineered narrow thickness and therefore ONE hue transition. We instead
   write the travelled colour straight into `diffuseColor` before
   <lights_physical_fragment>; because three then derives
   material.specularColor = mix(0.04, diffuseColor, metalness), a small
   metalness makes the F0 tint inherit the travel too — one injection, both
   lobes, and it survives environment-only lighting.

   Shader injection points (verified against the vendored r171 meshphysical
   fragment shader, whose main() order is:
     … normal_fragment_maps → clearcoat_normal_fragment_begin →
     clearcoat_normal_fragment_maps → emissivemap_fragment →
     lights_physical_fragment → lights_fragment_begin → lights_fragment_maps →
     lights_fragment_end → aomap_fragment → (clearcoat combine) →
     opaque_fragment … ):

     <clearcoat_normal_fragment_begin>  + orange-peel micro-normal on the COAT
                                          only (the basecoat stays smooth)
     <lights_physical_fragment>       pre: pearl travel + metallic flop written
                                          into diffuseColor; flake glint from
                                          the key light
                                     post: orange peel roughens the coat
     <lights_fragment_end>            + environment-lit flakes, added to
                                          directSpecular so the clearcoat
                                          attenuates them (flakes live UNDER
                                          the coat — this ordering is what
                                          keeps it from reading as sandpaper)
*/
import * as THREE from 'three';

/* ---------------- parameter space ----------------
   Everything the UI can touch, normalised 0..1 (or a hex colour). This object
   is the single source of truth, is what localStorage/share links would carry,
   and is applied to every paint material by applyToMaterials(). */
export const PAINT_FINISHES = ['solid', 'metallic', 'pearl'];

/* Per-finish starting points. Switching finish resets the finish-specific
   params to these (the shared ones — colour, coat gloss, peel — are kept). */
export const PAINT_DEFAULTS_BY_FINISH = {
  solid: {
    baseRough: 0.42,
    metallic: 0, flop: 0,
    flakeSize: 0.35, flakeColor: '#ffffff', flakeGlint: 0.5,
    pearl: 0, pearlColor: '#ffffff', pearlSharp: 0.45,
  },
  metallic: {
    baseRough: 0.34,
    metallic: 0.72, flop: 0.65,
    flakeSize: 0.38, flakeColor: '#ffffff', flakeGlint: 0.55,
    pearl: 0, pearlColor: '#ffffff', pearlSharp: 0.45,
  },
  pearl: {
    baseRough: 0.38,
    metallic: 0, flop: 0.35,
    flakeSize: 0.24, flakeColor: '#fff6e0', flakeGlint: 0.38,
    pearl: 0.62, pearlColor: '#d8c7a8', pearlSharp: 0.45,
  },
};

const PAINT_BASE = {
  finish: 'metallic',
  color: '#b9bec6',
  ccGloss: 0.90,        // clearcoat gloss  → clearcoatRoughness
  peel: 0.12,           // orange peel      → coat micro-normal
  ...PAINT_DEFAULTS_BY_FINISH.metallic,
};

/* ---------------- colours derived from the base colour ----------------
   Aluminium flakes physically take on some of the pigment they are suspended
   in, and mica flop colours are relatives of the face colour — a flake or flop
   colour picked independently of the base reads as glitter dust or as two
   unrelated paints. So both follow the base colour automatically, and stop
   doing so only once the user picks one deliberately (which then holds until
   the next base-colour change). */
const _tmpA = new THREE.Color(), _tmpB = new THREE.Color();
const WHITE_C = new THREE.Color(0xffffff);
let userFlakeColor = false, userPearlColor = false;

function derivedFlakeColor(hex) {
  _tmpA.set(hex).lerp(WHITE_C, 0.62);
  return '#' + _tmpA.getHexString(THREE.SRGBColorSpace);
}

/* flop colour: same family, rotated ~55° and a shade deeper — real flop is
   normally darker than the face colour.
   Near-neutral bases are a special case: rotating the hue of a white or grey is
   meaningless (the hue is arbitrary noise, so white would flop to a random
   green). Real white and silver pearls flop to champagne/gold, so that is what
   a desaturated base gets. */
/* Neutrality is measured as CHROMA (max−min), not HSL saturation: the HSL
   denominator collapses toward white and black, so #eef0f2 — a colour 4/255
   off pure grey — reports s ≈ 0.14 and would be treated as a real hue. */
const PEARL_NEUTRAL_CHROMA = 0.10;
const _rgb = { r: 0, g: 0, b: 0 };
function derivedPearlColor(hex) {
  const hsl = {};
  _tmpA.set(hex).getHSL(hsl, THREE.SRGBColorSpace);
  _tmpA.getRGB(_rgb, THREE.SRGBColorSpace);
  const chroma = Math.max(_rgb.r, _rgb.g, _rgb.b) - Math.min(_rgb.r, _rgb.g, _rgb.b);
  const neutral = chroma < PEARL_NEUTRAL_CHROMA;
  _tmpB.setHSL(
    neutral ? 0.105 : (hsl.h + 0.155) % 1,                       // champagne
    neutral ? 0.30 : Math.min(1, hsl.s * 0.85 + 0.14),
    Math.max(0.14, Math.min(0.70, hsl.l * 0.80 + 0.04)),
    THREE.SRGBColorSpace
  );
  return '#' + _tmpB.getHexString(THREE.SRGBColorSpace);
}

function syncDerivedColors() {
  if (!userFlakeColor) params.flakeColor = derivedFlakeColor(params.color);
  if (!userPearlColor) params.pearlColor = derivedPearlColor(params.color);
}

/* live parameters */
const params = { ...PAINT_BASE };
export const getPaintParams = () => ({ ...params });
export const getFinish = () => params.finish;
syncDerivedColors();               // seed flake/flop tints from the base colour

/* ---------------- shared uniforms ----------------
   Every paint material (cab + trailer body + trailer front wall) references
   the SAME uniform objects, so one write live-updates all of them. */
const U = {
  uFlakeScale: { value: 400 },
  uFlakeStrength: { value: 0 },
  uFlakeTint: { value: new THREE.Color(0xffffff) },
  uGlintPower: { value: 600 },
  uGlintJitter: { value: 0.26 },
  /* fraction of cells that are actually a flake. This must stay SPARSE: at 0.7
     the env-lit term stops being sparkle and becomes a uniform bright wash that
     both flattens the paint and aliases into speckle at distance (measured:
     +11 luminance, −11 stddev over the flank — brighter AND flatter, the exact
     opposite of what flakes should do). */
  uFlakeCoverage: { value: 0.22 },
  uGlintGain: { value: 1.5 },
  uFlakeEnvGain: { value: 0.32 },
  uFlakeEnvRough: { value: 0.12 },
  uFlopStrength: { value: 0 },
  uPearlColor: { value: new THREE.Color(0xffffff) },
  uPearlStrength: { value: 0 },
  uPearlPower: { value: 1.8 },
  uOrangePeel: { value: 0 },
  uOrangePeelScale: { value: 140 },
  /* key light, published by the scene rig every frame: direction is VIEW
     space and points toward the light; colour is linear × intensity. We do not
     read directionalLights[0] any more — three sorts shadow-casting lights
     first, so that index is not a stable contract, and a preset that dims the
     sun to zero would silently kill every glint. */
  uKeyLightDir: { value: new THREE.Vector3(0, 0, 1) },
  uKeyLightColor: { value: new THREE.Color(0xffffff) },
  uGlintBoost: { value: 1 },     // night presets need brighter glints to read
};
export const _sharedPaint = U;   // tuning handle (window.__studio)

/* Called by the scene rig once per frame. */
export function setKeyLight(dirView, colorLinear, boost) {
  U.uKeyLightDir.value.copy(dirView);
  U.uKeyLightColor.value.copy(colorLinear);
  if (typeof boost === 'number') U.uGlintBoost.value = boost;
}

/* ---------------- parameter → material/uniform mapping ---------------- */
const clamp01 = v => Math.min(1, Math.max(0, +v || 0));

/* Metalness is the danger dial. Real metallic paint keeps a pigmented
   dielectric basecoat; practitioners put the metal in a masked flake layer and
   leave the body at 0 (or 0.05–0.25 when there is no flake lobe). We keep a
   little so the flop and the F0 tint have something to bite on, and cap it far
   below anything that would read as aluminium. */
const METAL_CAP = { solid: 0, metallic: 0.28, pearl: 0.22 };

function metalnessFor(p) {
  if (p.finish === 'metallic') return 0.04 + 0.24 * clamp01(p.metallic);
  if (p.finish === 'pearl') return 0.08 + 0.14 * clamp01(p.pearl);
  return 0;
}

const FLAKE_FREQ_FINE = 650, FLAKE_FREQ_COARSE = 125;

const materials = new Set();

/* Recompute every uniform + material property from `params`. */
function applyToMaterials() {
  const p = params;
  const solid = p.finish === 'solid';
  const pearlOn = p.finish === 'pearl';

  const metal = Math.min(METAL_CAP[p.finish], metalnessFor(p));
  /* Basecoat roughness. An automotive basecoat sits UNDER a clearcoat, so it is
     far smoother than a bare painted surface — the old 0.10..0.55 range left
     even the "glossy" solid finish at ~0.29, which scatters the highlight into
     a dull sheen instead of a reflection. 0.05..0.29 reads as real paint. */
  const rough = 0.05 + 0.24 * clamp01(p.baseRough);
  /* clearcoat gloss → roughness. three floors clearcoatRoughness at ~0.0525
     internally, so 0.90 gloss is already "OEM show finish". */
  const ccRough = 0.22 - 0.19 * clamp01(p.ccGloss);

  const col = new THREE.Color(p.color);
  for (const m of materials) {
    m.color.copy(col);
    m.metalness = metal;
    m.roughness = rough;
    m.clearcoat = 1.0;
    m.clearcoatRoughness = ccRough;
  }

  /* flakes: metallic drives them directly; pearl sparkles at ~1/3 density;
     solid has none. */
  let flake = 0;
  if (p.finish === 'metallic') flake = 0.22 + 0.78 * clamp01(p.metallic);
  else if (pearlOn) flake = 0.34 * clamp01(p.pearl);
  U.uFlakeStrength.value = flake;
  U.uFlakeScale.value = FLAKE_FREQ_FINE - clamp01(p.flakeSize) * (FLAKE_FREQ_FINE - FLAKE_FREQ_COARSE);
  U.uFlakeTint.value.set(p.flakeColor || '#ffffff');
  U.uGlintGain.value = 0.25 + 3.25 * clamp01(p.flakeGlint);
  /* coarser flakes are individually bigger, so their lobe is wider */
  U.uGlintPower.value = 900 - 650 * clamp01(p.flakeSize);
  /* pearl mica is sparser than aluminium flake; solid has no flakes at all */
  U.uFlakeCoverage.value = solid ? 0 : (pearlOn ? 0.12 : 0.22);

  U.uFlopStrength.value = solid ? 0 : clamp01(p.flop);
  U.uPearlStrength.value = pearlOn ? clamp01(p.pearl) : 0;
  U.uPearlColor.value.set(p.pearlColor || '#ffffff');
  U.uPearlPower.value = 1.2 + 2.0 * clamp01(p.pearlSharp);
  U.uOrangePeel.value = 0.035 * clamp01(p.peel);
}

/* THE public setter. One funnel, because the mappings are coupled: a single
   slider can write three uniforms, switching finish rewrites five params, and
   setting the base colour re-derives two more. Per-control setters would have
   to duplicate all of that in ui.js. */
export function setPaint(partial) {
  const p = partial || {};
  if (p.finish && p.finish !== params.finish) {
    const f = PAINT_FINISHES.includes(p.finish) ? p.finish : 'metallic';
    Object.assign(params, PAINT_DEFAULTS_BY_FINISH[f], { finish: f });
    /* the finish defaults carry placeholder flake/flop colours; re-derive them
       from the colour actually on the vehicle */
    syncDerivedColors();
  }
  /* An explicit pick wins — until the base colour moves again, at which point
     following the new colour is far less surprising than keeping a tint chosen
     for the previous one. */
  if (p.color !== undefined) { userFlakeColor = false; userPearlColor = false; }
  if (p.flakeColor !== undefined) userFlakeColor = true;
  if (p.pearlColor !== undefined) userPearlColor = true;

  for (const [k, v] of Object.entries(p)) {
    if (k === 'finish') continue;
    if (k in params) params[k] = v;
  }
  if (p.color !== undefined) syncDerivedColors();

  applyToMaterials();
  return getPaintParams();
}

/* Reset to the shipped default paint (metallic silver). */
export function resetPaint() {
  Object.assign(params, PAINT_BASE);
  userFlakeColor = false;
  userPearlColor = false;
  syncDerivedColors();
  applyToMaterials();
  return getPaintParams();
}

/* ---------------- GLSL ---------------- */
const PAINT_PARS = /* glsl */`
varying vec3 vPaintWorldPos;
varying vec3 vPaintWorldNormal;
uniform float uFlakeScale;
uniform float uFlakeStrength;
uniform vec3  uFlakeTint;
uniform float uGlintPower;
uniform float uGlintJitter;
uniform float uFlakeCoverage;
uniform float uGlintGain;
uniform float uFlakeEnvGain;
uniform float uFlakeEnvRough;
uniform float uFlopStrength;
uniform vec3  uPearlColor;
uniform float uPearlStrength;
uniform float uPearlPower;
uniform float uOrangePeel;
uniform float uOrangePeelScale;
uniform vec3  uKeyLightDir;
uniform vec3  uKeyLightColor;
uniform float uGlintBoost;

/* flake state, handed from the lights_physical hook to the env hook */
vec3  gFlakeNormalV = vec3( 0.0, 0.0, 1.0 );
float gFlakeEnergy  = 0.0;
float gPeelMag      = 0.0;

/* INTEGER hash, not the usual fract(sin(dot(...))).
   The sin trick collapses at large arguments: the flake field is world position
   × up to 650, so a panel 8 m from the origin reaches cell indices in the
   thousands and the sine argument approaches a million — far beyond float32's
   ~7 significant digits. The fractional part then quantises and the "random"
   field degenerates into a regular lattice. That was visible as a diagonal
   cross-hatch moiré on the trailer flanks (the largest flat panel, furthest
   from the origin) while the compact cab still looked fine.
   PCG3D is exact at any magnitude because it only ever does integer work. */
uvec3 tsPcg3d( uvec3 v ) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
const float TS_INV = 1.0 / 1048575.0;
uvec3 tsCellKey( vec3 cell ) {
  // bias keeps the int→uint reinterpretation of negative coords well-defined
  return uvec3( ivec3( floor( cell ) ) + 262144 );
}
float tsHash1( vec3 cell ) {
  return float( tsPcg3d( tsCellKey( cell ) ).x & 1048575u ) * TS_INV;
}
vec3 tsHash3( vec3 cell ) {
  uvec3 h = tsPcg3d( tsCellKey( cell ) ) & uvec3( 1048575u );
  return -1.0 + 2.0 * ( vec3( h ) * TS_INV );
}
/* Nearest Voronoi feature cell, returned as INTEGER cell coordinates so every
   downstream hash stays exact. No texture is involved, so there is no mipmap
   averaging and no UV dependence: every painted mesh sparkles identically
   regardless of how its UVs are laid out. */
vec3 tsVoronoiCell( vec3 p ) {
  vec3 ip = floor( p ); vec3 fp = fract( p );
  float md = 999.0; vec3 id = ip;
  for ( int z = -1; z <= 1; ++z )
  for ( int y = -1; y <= 1; ++y )
  for ( int x = -1; x <= 1; ++x ) {
    vec3 o = vec3( float( x ), float( y ), float( z ) );
    vec3 pt = 0.5 + 0.5 * tsHash3( ip + o );      // feature point inside the cell
    float d = length( o + pt - fp );
    if ( d < md ) { md = d; id = ip + o; }
  }
  return id;
}
float tsValueNoise( vec3 p ) {
  vec3 i = floor( p ), f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  float n000 = tsHash1( i ), n100 = tsHash1( i + vec3( 1.0, 0.0, 0.0 ) );
  float n010 = tsHash1( i + vec3( 0.0, 1.0, 0.0 ) ), n110 = tsHash1( i + vec3( 1.0, 1.0, 0.0 ) );
  float n001 = tsHash1( i + vec3( 0.0, 0.0, 1.0 ) ), n101 = tsHash1( i + vec3( 1.0, 0.0, 1.0 ) );
  float n011 = tsHash1( i + vec3( 0.0, 1.0, 1.0 ) ), n111 = tsHash1( i + vec3( 1.0 ) );
  return mix( mix( mix( n000, n100, f.x ), mix( n010, n110, f.x ), f.y ),
              mix( mix( n001, n101, f.x ), mix( n011, n111, f.x ), f.y ), f.z );
}
/* Hue travel must NOT be a linear-RGB lerp: a linear mix between, say, green
   and magenta passes through a muddy dark midpoint. Blending in a roughly
   perceptual (gamma) space keeps the transition chromatic all the way. */
vec3 tsMixPerceptual( vec3 a, vec3 b, float t ) {
  vec3 ga = pow( max( a, 0.0 ), vec3( 1.0 / 2.2 ) );
  vec3 gb = pow( max( b, 0.0 ), vec3( 1.0 / 2.2 ) );
  return pow( mix( ga, gb, t ), vec3( 2.2 ) );
}
`;

/* Orange peel — real clearcoat is never a perfect mirror; 4–12 mm ripples are
   the single highest realism-per-line win because a flawless reflection is the
   loudest CG tell. Applied to the COAT normal only: the basecoat underneath
   stays smooth, which is physically what happens. */
const PAINT_PEEL = /* glsl */`
#ifdef USE_CLEARCOAT
if ( uOrangePeel > 0.0001 ) {
  vec3 pw = vPaintWorldPos * uOrangePeelScale;
  float e = 0.35;
  float h0 = tsValueNoise( pw );
  vec3 grad = vec3(
    tsValueNoise( pw + vec3( e, 0.0, 0.0 ) ) - h0,
    tsValueNoise( pw + vec3( 0.0, e, 0.0 ) ) - h0,
    tsValueNoise( pw + vec3( 0.0, 0.0, e ) ) - h0
  ) / e;
  vec3 nW = normalize( vPaintWorldNormal );
  grad -= nW * dot( grad, nW );                       // tangential only
  gPeelMag = length( grad ) * uOrangePeel;
  vec3 bumpW = normalize( nW + grad * uOrangePeel );
  vec3 bumpV = normalize( ( viewMatrix * vec4( bumpW, 0.0 ) ).xyz );
  // fade the perturbation as the ripple period shrinks below a pixel,
  // otherwise it aliases into shimmer at distance
  float fwp = length( fwidth( pw ) );
  clearcoatNormal = normalize( mix( clearcoatNormal, bumpV, 1.0 / ( 1.0 + fwp * fwp ) ) );
}
#endif
`;

/* Pearl travel + metallic flop + direct-light flake glint.
   Runs BEFORE <lights_physical_fragment> so diffuseColor is still writable —
   material.diffuseColor and material.specularColor are both derived from it. */
const PAINT_BODY = /* glsl */`
{
  vec3 viewV = normalize( vViewPosition );
  float facing = 1.0 - clamp( dot( normal, viewV ), 0.0, 1.0 );   // 0 face … 1 grazing

  /* PEARL. Curve calibrated so the travel band sits around 45°–75°, which is
     where real flop is measured (15°/45°/110° aspecular). A Schlick-style
     pow(facing, 5) would cram it into the last 15° and read as a rim light. */
  if ( uPearlStrength > 0.001 ) {
    float w = smoothstep( 0.10, 0.55, pow( facing, uPearlPower ) );
    diffuseColor.rgb = tsMixPerceptual( diffuseColor.rgb, uPearlColor, w * uPearlStrength );
  }

  /* FLOP. Metallic paint is bright face-on and darker at grazing angles — the
     opposite of a solid colour, and the main cue that flakes are present. */
  if ( uFlopStrength > 0.001 ) {
    float w = smoothstep( 0.05, 0.60, pow( facing, 1.8 ) );
    diffuseColor.rgb *= mix( 1.0 + 0.12 * uFlopStrength, 1.0 - 0.55 * uFlopStrength, w );
  }

  /* FLAKES */
  if ( uFlakeStrength > 0.001 && uFlakeCoverage > 0.001 ) {
    vec3 fp = vPaintWorldPos * uFlakeScale;
    vec3 fcell = tsVoronoiCell( fp );
    float fnoise = tsHash1( fcell );
    // sparse subset: only the top uFlakeCoverage fraction of cells is a flake
    float cov = step( 1.0 - uFlakeCoverage, fnoise );
    // and most of those are dim — a uniform brightness makes it read as glitter.
    // Offsets must be INTEGER: the cell key floors its input, so a fractional
    // offset would land back on the same cell and correlate perfectly.
    float fbright = pow( tsHash1( fcell + vec3( 17.0, 3.0, 11.0 ) ), 2.5 );

    /* Anti-aliasing: once a pixel's world footprint covers more than one flake
       cell, the sparkle can no longer be resolved and any remaining energy is
       pure aliasing. Fading it out with the footprint is what stops a truck
       seen from 20 m reading as sandpaper. The factor is folded into the shared
       energy so BOTH the direct glint and the environment-lit term fade
       together — gating only one of them was what produced the speckle. */
    float fw = length( fwidth( fp ) );
    float sharp = 1.0 / ( 1.0 + fw * fw * 4.0 );
    float dist = length( vPaintWorldPos - cameraPosition );
    float distFade = 1.0 - smoothstep( 8.0, 26.0, dist );

    gFlakeEnergy = uFlakeStrength * cov * fbright * distFade * sharp;

    vec3 nrmW = vPaintWorldNormal;
    float nlen = length( nrmW );
    if ( nlen > 1e-5 ) {
      // per-flake mirror normal: a small random tilt around the surface normal
      vec3 jw = normalize( nrmW / nlen
        + tsHash3( fcell + vec3( 5.0, 29.0, 7.0 ) ) * uGlintJitter );
      gFlakeNormalV = normalize( ( viewMatrix * vec4( jw, 0.0 ) ).xyz );

      /* Direct glint from the key light. Every normalize() input is
         length-guarded: L+V collapses to zero when the view opposes the light
         and normalize(0) → NaN → black pixels. */
      vec3 HvRaw = uKeyLightDir + viewV;
      float hlen = length( HvRaw );
      if ( hlen > 1e-3 ) {
        float nh = clamp( dot( gFlakeNormalV, HvRaw / hlen ), 0.0, 1.0 );
        float glint = pow( max( nh, 1e-4 ), uGlintPower );
        float ndl = clamp( dot( normal, uKeyLightDir ), 0.0, 1.0 );
        // flakes take on some of the pigment they sit in, never pure white
        vec3 ftint = uFlakeTint * mix( diffuseColor.rgb, vec3( 1.0 ), 0.70 );
        vec3 fadd = ftint * uKeyLightColor *
          ( glint * ndl * gFlakeEnergy * uGlintGain * uGlintBoost );
        fadd = min( fadd, vec3( 6.0 ) );
        if ( all( greaterThanEqual( fadd, vec3( 0.0 ) ) ) ) {
          // totalEmissiveRadiance is folded into outgoingLight BEFORE the
          // clearcoat term in opaque_fragment, so these sit under the coat
          totalEmissiveRadiance += fadd;
        }
      }
    }
  }
}
`;

/* Orange peel also roughens the coat slightly — a rippled surface scatters a
   little more. Runs AFTER lights_physical_fragment, where `material` exists. */
const PAINT_POST = /* glsl */`
#ifdef USE_CLEARCOAT
// material.clearcoatRoughness only EXISTS on the PhysicalMaterial struct when
// USE_CLEARCOAT is defined (three sets that from clearcoat > 0). Today the
// paint always runs clearcoat 1.0, but an unguarded write here would turn any
// future "sem verniz" option into a shader compile failure.
if ( gPeelMag > 0.0 ) {
  material.clearcoatRoughness = clamp( material.clearcoatRoughness + gPeelMag * 0.02, 0.0, 1.0 );
}
#endif
`;

/* Environment-lit flakes. THE trick that makes flakes twinkle when you orbit
   without moving the sun: sample the env map through each flake's own jittered
   normal, so neighbouring flakes fetch different directions. Added to
   directSpecular so the clearcoat combine attenuates it. */
const PAINT_ENV = /* glsl */`
#ifdef USE_ENVMAP
if ( gFlakeEnergy > 0.001 ) {
  vec3 fenv = getIBLRadiance( geometryViewDir, gFlakeNormalV, uFlakeEnvRough );
  reflectedLight.directSpecular +=
    uFlakeTint * fenv * ( gFlakeEnergy * uFlakeEnvGain );
}
#endif
`;

function installPaintShader(m) {
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>',
        '#include <common>\nvarying vec3 vPaintWorldPos;\nvarying vec3 vPaintWorldNormal;')
      .replace('#include <fog_vertex>',
        '#include <fog_vertex>\n'
        + 'vPaintWorldPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;\n'
        + 'vPaintWorldNormal = normalize( mat3( modelMatrix ) * objectNormal );');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + PAINT_PARS)
      .replace('#include <clearcoat_normal_fragment_begin>',
        '#include <clearcoat_normal_fragment_begin>\n' + PAINT_PEEL)
      .replace('#include <lights_physical_fragment>',
        PAINT_BODY + '\n#include <lights_physical_fragment>\n' + PAINT_POST)
      .replace('#include <lights_fragment_end>',
        '#include <lights_fragment_end>\n' + PAINT_ENV);
  };
  /* bumped whenever the injected GLSL changes — stale cached programs would
     otherwise keep running the previous version */
  m.customProgramCacheKey = () => 'truckstudio-paint-v4';
}

export function makePaintMaterial(srcColor, srcMap) {
  const m = new THREE.MeshPhysicalMaterial({
    name: 'carpaint',
    color: new THREE.Color(params.color),
    map: srcMap || null,
    metalness: 0.1,
    roughness: 0.34,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    /* rip geometry has arbitrary winding — a FrontSide paint material culls
       inward-wound faces and reads as see-through (verified root cause) */
    side: THREE.DoubleSide,
  });
  m.envMapIntensity = 1.3;
  if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
  installPaintShader(m);
  materials.add(m);
  applyToMaterials();
  return m;
}

/* Called when a cab is swapped out and its materials disposed. */
export function forgetPaintMaterial(m) { materials.delete(m); }
export function paintMaterialCount() { return materials.size; }
/* Registry membership, not a name match — source material names vary
   ("carpaint", "CarPaint_01", …) and a substring test would be fragile. */
export function isPaintMaterial(m) { return materials.has(m); }
