/* The projected plate's transfer function.
   -------------------------------------------------------------------------
   Self-contained: it patches ONE material handed in by environment.ts and
   shares no state with the rest of the scene, which is why it lives on its own
   rather than in the middle of the ground code. */
import * as THREE from 'three';

/* ---------------- the plate transfer function ----------------
   THE BUG THIS FIXES, stated as a measurement.

   The projected photograph (`sky.jpg`) is DISPLAY-REFERRED: it has already been
   through a camera's tone curve. Every CG surface is SCENE-REFERRED and goes
   through ACESFilmicToneMapping on the way to the screen. Rendering the plate
   with `toneMapped = false` — which is what this engine did — puts the two
   halves of the frame through two DIFFERENT transfer functions, and then no
   albedo, no tint and no fade width can make them agree, because they are not
   measuring the same thing.

   Measured on `rodovia` before this change: the photographed road lands at
   linear 0.244 on screen while the CG band carrying `asphalt_diff_4k` under the
   same rig lands at 0.723 — 3.0x in red, 3.4x in green, 4.7x in blue. That is
   the "carpet dropped into a photo". Three rounds of "measured albedo tints"
   could not close it because they were all computed as
   `plate_pixel / texture_albedo`, i.e. in display space, against a CG value
   that lives in scene space on the far side of a tone curve.

   THE FIX IS THE VFX ONE: put both through ONE tone map. The plate is decoded
   back to scene-referred radiance with the ANALYTIC INVERSE of the exact curve
   three will re-apply, and then `toneMapped` goes back to true. Three things
   follow, and all three are the point:

     * the round trip is the identity at PLATE_EXPOSURE, so the photograph is
       not "re-graded" — it is merely moved into the space everything else is
       already in;
     * `domeMat.color` (the day/night dim, and `envIntensity` on the yard) stops
       being a multiply on DISPLAY pixels — which hard-clips, because
       sRGBTransferOETF does not clamp — and becomes a real exposure change with
       an ACES shoulder. Measured on `patio-logistico`, whose dome gain is
       1.1875: clipped pixels fall from 0.59 % to 0.14 %;
     * the near-ground tint becomes a WELL-POSED measurement. `tintRgb` below is
       solved in scene-referred radiance, which is the only space in which
       "these two surfaces match" is a statement about the same quantity.

   WHY PLATE_EXPOSURE IS A CONSTANT AND NOT `toneMappingExposure`.
   Feeding the LIVE exposure into the inverse would make the round trip cancel
   at every exposure, i.e. the plate would be frozen while the CG moved — the
   decoupling this exists to remove, in a subtler form. A photograph has ONE
   scene-referred interpretation, fixed at capture, so the inverse uses a fixed
   reference and the exposure slider then moves the photo and the CG together.
   The constant is 1.0 because that is what the assets measure: pushing each
   scene's `sky.jpg` through this inverse at exposure 1 and dividing by the
   matching `sky.hdr` gives a median ratio of 0.98 on `rodovia` and 1.03 on
   `urbano` over ~2 M mid-tone pixels (10th-90th percentile 0.81-1.07). The
   backgrounds ARE ACES tone maps of the HDRIs at exposure 1, so decoding at 1
   lands the plate in the same radiometric units as the IBL that lights the CG.
   The naive display-space reading of the same pixels gives 1.09/1.15 with a
   wider spread — wrong, and wrong by an amount that varies with brightness,
   which is exactly the "flatter" error.
   The consequence worth having: `tintRgb` is then EXPOSURE-INDEPENDENT, so the
   near band still matches the plate after a preset or hour change instead of
   only at the exposure it was authored against.

   THE CURVE IS THREE'S, NOT THE TEXTBOOK ONE. The usual quoted ACES fit is
   Narkowicz's `(x(2.51x+0.03))/(x(2.43x+0.59)+0.14)`. three does NOT use it:
   `ACESFilmicToneMapping` (r0.179.1) is Stephen Hill's fit — an sRGB→AP1
   matrix, RRTAndODTFit, an AP1→sRGB matrix, and a 1/0.6 exposure scale. The
   inverse below is the inverse of THAT, or the round trip would not cancel and
   this would be a second grade rather than a decode. RRTAndODTFit is a ratio of
   quadratics, so its inverse is the positive root of

       (1 − 0.983729y)·v² + (0.0245786 − 0.432951y)·v − (0.000090537 + 0.238081y) = 0

   The pole is at y = 1/0.983729 = 1.01655, so clamping y into [0, 1] — where a
   display-referred plate lives anyway — keeps the leading coefficient at
   0.0163 or more and the division safe. Verified numerically: the round trip is
   exact to 1e-15 over the whole range, and the matrices map the sRGB cube
   corners into [0, 1.00001], so the clamp costs nothing but bounds everything.
   Input 1.0 decodes to 25.7 in AP1, ~14 in linear sRGB: the sky CLIPS, which is
   correct and unavoidable — an LDR plate genuinely carries no highlight
   information above white. */
const PLATE_EXPOSURE = 1.0;

/* Column-major, three's own convention — `mat3(c0,c1,c2)*v` is the row-major
   product. These are numeric inverses of ACESOutputMat and ACESInputMat. */
const PLATE_FRAG_HEAD = /* glsl */`
const mat3 tsAcesOutInv = mat3(
  vec3(  0.64303825,  0.05926869,  0.00596190 ),
  vec3(  0.31118675,  0.93143649,  0.06392902 ),
  vec3(  0.04577546,  0.00929492,  0.93011838 )
);
const mat3 tsAcesInInv = mat3(
  vec3(  1.76474097, -0.14702785, -0.03633683 ),
  vec3( -0.67577768,  1.16025151, -0.16243644 ),
  vec3( -0.08896329, -0.01322366,  1.19877327 )
);
uniform float tsPlateExposure;

/* Positive root of the quadratic RRTAndODTFit inverts to. The clamp keeps the
   input off the 1.01655 pole; max() guards the discriminant against float
   noise at the ends of the range. */
vec3 tsRRTInv( vec3 y ) {
  y = clamp( y, 0.0, 1.0 );
  vec3 a = 1.0 - 0.983729 * y;
  vec3 b = 0.0245786 - 0.432951 * y;
  vec3 c = -0.000090537 - 0.238081 * y;
  return ( -b + sqrt( max( b * b - 4.0 * a * c, 0.0 ) ) ) / ( 2.0 * a );
}

/* Display-referred linear sRGB -> scene-referred linear sRGB.
   NEGATIVE COMPONENTS ARE CORRECT HERE AND MUST NOT BE CLAMPED AWAY. ACES
   desaturates on the way out (RRT_SAT / ODT_SAT), so recovering the scene
   colour behind a saturated display colour needs a MORE saturated primary than
   sRGB can hold, and that comes back as a negative channel — an ordinary
   wide-gamut value. Clamping it at 0 is a gamut clip, and it breaks the round
   trip by up to 0.85 in display units (measured over a 33³ sweep of the sRGB
   cube: exact to 1e-5 without the clamp, 8.4e-1 with it). Nothing downstream
   minds: three's ACESFilmicToneMapping ends in saturate(), so the sRGB encode
   after it never sees a negative. The -8 rail is a NaN backstop only — the true
   minimum over the whole cube is -4.23. */
vec3 tsPlateToScene( vec3 p ) {
  vec3 v = tsAcesOutInv * clamp( p, 0.0, 1.0 );
  v = tsRRTInv( v );
  v = tsAcesInInv * v;
  return max( v, -8.0 ) * ( 0.6 / tsPlateExposure );
}
`;

/* Replaces <map_fragment> wholesale rather than appending after it, and the
   difference matters: `diffuse` (i.e. material.color, the day/night gain) is
   multiplied in by that chunk, and the inverse is NOT linear — inverting
   `gain * texel` is not `gain * inverse(texel)`. The decode has to land on the
   texel alone, and the gain then multiplies a scene-referred radiance, which is
   what makes it an exposure change instead of a display-space dim. */
const PLATE_MAP_FRAG = /* glsl */`
#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, vMapUv );
  sampledDiffuseColor.rgb = tsPlateToScene( sampledDiffuseColor.rgb );
  diffuseColor *= sampledDiffuseColor;
#endif
`;

const plateExposureU = { value: PLATE_EXPOSURE };

/**
 * Prepare the projected plate's material so it shares the renderer's ONE tone
 * map with every CG surface. Idempotent per material.
 *
 * @param {THREE.Material} material  the GroundedSkybox's MeshBasicMaterial
 * @param {{inverse?: boolean, exposure?: number}} [opts]
 *        `inverse: true` for a DISPLAY-REFERRED source (a tonemapped .jpg):
 *          decode it back to scene-referred first, then let ACES re-apply.
 *        `inverse: false` for a SCENE-REFERRED source (a raw .hdr): it is
 *          already in the right space and must NOT be decoded — running the
 *          inverse over radiance that was never tone mapped would expand it a
 *          second time. Either way `toneMapped` ends up TRUE, which is the
 *          whole point: one curve for the photo and the CG alike.
 *        `exposure` overrides PLATE_EXPOSURE for a plate graded at some other
 *          level; the shipped backgrounds all measure at 1.0.
 * @returns {THREE.Material} the same material, for chaining
 */
export function preparePlateMaterial(
  material: THREE.Material,
  opts?: { inverse?: boolean; exposure?: number },
): THREE.Material {
  if (!material) return material;
  const o = opts || {};
  const inverse = o.inverse !== false;
  /* Scene-referred either way — see the section header. */
  material.toneMapped = true;
  if (!inverse) return material;

  /* Written BEFORE the idempotence guard, not after: a re-prepared material
     must still be able to change its reference exposure. One uniform object
     shared by every plate, because the domes are cached per environment and
     exactly one is ever mounted — a per-material value would be state to keep
     in sync for no benefit. */
  const wantExposure = Number(o.exposure);
  plateExposureU.value = Number.isFinite(wantExposure) && wantExposure > 0
    ? THREE.MathUtils.clamp(wantExposure, 0.05, 8) : PLATE_EXPOSURE;
  if (material.userData.tsPlate) return material;

  material.onBeforeCompile = (shader: THREE.WebGLProgramParametersWithUniforms) => {
    shader.uniforms.tsPlateExposure = plateExposureU;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>' + PLATE_FRAG_HEAD)
      .replace('#include <map_fragment>', PLATE_MAP_FRAG);
  };
  /* Programs are shared by cache key and the default one knows nothing about
     onBeforeCompile: without this an unpatched MeshBasicMaterial with the same
     parameters could be handed the patched program, or the reverse. */
  material.customProgramCacheKey = () => 'ts-plate-inv';
  material.userData.tsPlate = true;
  material.needsUpdate = true;
  return material;
}

/** The plate's reference exposure, for getEnvironmentObjects()'s debug handle. */
export function getPlateExposure() { return plateExposureU.value; }
