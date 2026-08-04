/* Street lamps: a fixed pool of SpotLights, and whatever geometry stands under
   them.
   -------------------------------------------------------------------------
   Split out of scene.ts, which still owns the light rig itself. The seam is
   deliberately one-way and one function wide:

     scene.ts READS   `lampUnits`, `lampModelEmissive`, getLampLensMat() and
                      getLampIntensityScale() inside applyRig(), which stays
                      the single writer of SpotLight.intensity and of the lens
                      emissive.
     this module ASKS scene.ts to re-drive the rig, through the callback
                      registered by setLampRigRefresh(). setLamps() and
                      setLampModel() both need it: intensity is applyRig()'s to
                      write and applyRig() only runs during a tween, so without
                      it a unit one of these calls just parked would stay lit
                      until the next preset change.

   That callback is the ONLY thing this module knows about the rig, and it is
   what lets the pool live here without an import cycle. */
import * as THREE from 'three';

/* Registered by scene.ts at module init; a no-op until then, which is correct —
   before the first tween there is no rig pose to re-drive. */
let rigRefresh = () => {};
export function setLampRigRefresh(fn: () => void) { rigRefresh = fn; }

/* ---------------- street lamps ----------------
   A FIXED pool of LAMP_COUNT identical units. Nothing is ever built, removed or
   hidden at the GROUP level, because a SpotLight's `visible` flag changes
   NUM_SPOT_LIGHTS and recompiles every material in the scene — verified:
   WebGLRenderer gathers lights with traverseVisible(), so hiding a unit's group
   would hide its spot and count as that same flip. setLamps() therefore only
   ever MOVES poles, hides pole MESHES, and marks units inactive; the inactive
   ones are darkened through `intensity` (a uniform, free) inside applyRig().
   The single writer of SpotLight.visible stays setLampsEnabled(), tied to the
   day/night switch — an explicit, infrequent user action. Keeping 8 spotlights
   permanently live would tax every fragment of every material all day.

   Consequence, and it is the point: the spot count is a compile-time constant
   of this module. Switching environment never recompiles anything. The
   manifest's `count` is clamped into the pool rather than resizing it.

   ---------------------------------------------------------------------------
   WHAT STANDS UNDER THE SPOT

   The fixture is now swappable. Each unit carries two mutually exclusive
   fixtures in the same canonical local frame — base at local y = 0, luminaire
   reaching along local −X:

     unit.proc    the built-in primitives. The zero-asset path, and the
                  guaranteed fallback when a GLB is missing or unreadable.
     unit.model   eight clones of a prepared Poly Haven lamp, handed in by
                  setLampModel(). Clones SHARE geometry and materials with the
                  source, which scene/environment.ts owns and caches — this module
                  never disposes either.

   Only the fixture GROUPS are toggled, never the unit group, because the
   SpotLight hangs off the unit and traverseVisible() would count hiding it as
   the NUM_SPOT_LIGHTS flip this whole section exists to avoid.

   HEIGHT IS NORMALISED FIRST AND CHOSEN SECOND, and both halves are lighting
   decisions rather than tidiness ones. Illuminance under a lamp is I/h², so a
   fixture that arrived at 5 m and one at 11 m would differ by 4.8x on identical
   preset data. So every fixture — loaded or procedural — is scaled to
   LAMP_HEIGHT, which is the height the preset `lampIntensity` values are
   authored against; a scene may then ask for a DIFFERENT mounting height
   through `setLamps({ height })`, and the spot intensity is rescaled by
   (h/LAMP_HEIGHT)² so the pool on the ground stays where it was calibrated.
   That second half exists because 9 m is right for a motorway mast and wrong
   for the one CC0 lamp model we have — see makeLampPrimitives().

   THE LENS IS OURS, whatever the fixture. A small emissive disc sits at the
   luminaire's underside carrying `lampEmissive` and `lampColor` from the rig,
   so a lamp reads as ON at night instead of as a lit object, and it does so
   identically on both paths — we do not have to hope a downloaded GLB named its
   glass material something we guessed. Any emissive material the GLB DOES ship
   is taken over as well (see prepareLampModel), because a lens authored with a
   standing emissive would otherwise glow at noon. */
export const LAMP_COUNT = 8;

/* Mounting geometry. A main-road lantern is 8-10 m up on a 2-2.5 m bracket;
   these are the middle of both bands and every fixture is fitted to them. */
export const LAMP_HEIGHT = 9.0;         // metres, ground to the top of the luminaire
const LAMP_OUTREACH = 2.2;       // metres the luminaire reaches over the road
/* The spot is aimed slightly further over the carriageway than the luminaire
   itself. A real cutoff optic puts its peak intensity ~65° off nadir to throw
   light DOWN the road; three's SpotLight is a symmetric cone and cannot, so
   tilting the axis 1.6 m over 9 m (10°) is the cheap stand-in — it slides the
   pool toward the lane instead of parking it in the gutter. */
const LAMP_AIM_OFFSET = 1.6;

/**
 * One pole. Every unit is built in the SAME canonical local frame — base at
 * local y = 0, arm and head reaching along local −X — so aiming one is a single
 * rotation.y. `proc` and `model` are the two mutually exclusive fixtures and
 * exactly one is ever visible; `active` is read by applyRig() in scene.ts, which
 * darkens the parked units through `intensity` rather than through `visible`.
 */
export interface LampUnit {
  group: THREE.Group;
  proc: THREE.Group;
  model: THREE.Group;
  lens: THREE.Mesh;
  spot: THREE.SpotLight;
  active: boolean;
}

/** Where the lens and the spot sit in a unit's local frame, per fixture. */
interface LampGeo {
  outreach: number;
  lensY: number;
  lensR: number;
}

/** The pole layout a scene asks for; see setLamps(). */
export interface LampLayout {
  enabled: boolean;
  layout: 'roadside' | 'yard';
  spacing: number;
  offset: number;
  count: number;
  height: number;
}

export const lampUnits: LampUnit[] = [];
let lampLensMat: THREE.MeshStandardMaterial | null = null;
let lampPoleMat: THREE.MeshStandardMaterial | null = null;

/* Fixture state. `lampProto` is a prepared, scaled, oriented template that is
   cloned into each unit; `lampModelSrc` is the object scene/environment.ts handed us,
   kept only so a repeated call with the same model is a no-op. */
let lampModelSrc: THREE.Object3D | null = null;
let lampProto: THREE.Object3D | null = null;
let lampFixture: 'proc' | 'model' = 'proc';
/* Emissive materials found inside a loaded fixture, with the intensity they
   arrived with, so setLampModel(null) can hand them back unchanged. */
export const lampModelEmissive = new Map<THREE.Material & { emissive: THREE.Color; emissiveIntensity: number }, number>();
/* Sources that could not be fitted. Weak, because the caller owns them and its
   own LRU decides when they die. */
const lampModelRejected = new WeakSet<THREE.Object3D>();

/* The luminaire's own dimensions. A flat-glass cutoff lantern is a shallow
   downward-tapering box roughly 0.8 m along the arm and 0.4 m across it, and it
   is mounted HORIZONTAL — that is what "flat glass cutoff" means, and it is why
   nothing here tilts the housing. */
const LAMP_HOUSING_L = 0.78, LAMP_HOUSING_W = 0.40, LAMP_HOUSING_H = 0.20;
const LAMP_HOUSING_TAPER = 0.87;
const LAMP_TRAY_H = 0.09;                      // the gear-tray hump on top
/* The TALLEST point of the fixture is exactly LAMP_HEIGHT, so the constant
   means what its comment says — which matters beyond tidiness, because
   prepareLampModel() measures a loaded GLB by its bounding box and normalises
   THAT to LAMP_HEIGHT. If the primitives disagreed, swapping fixtures would
   change the mounting height. The tray is what reaches the top, so the housing
   sits 0.07 m below it and everything else hangs off the housing. */
const LAMP_HOUSING_TOP = LAMP_HEIGHT - LAMP_TRAY_H + 0.02;
const LAMP_HOUSING_MID = LAMP_HOUSING_TOP - LAMP_HOUSING_H / 2;
const LAMP_MAST_TOP = LAMP_HEIGHT - 1.15;      // where the outreach arm leaves

/* Where the lens and the spot sit in the unit's local frame, per fixture.
   Measured for a loaded model, constant for the primitives. `lensR` is the half
   LENGTH along the bracket axis; the lens is scaled to 55 % of that across it,
   because a real lantern bowl is an ellipse elongated along its outreach.
   `lensY` is 2 cm below the housing's underside so the lens hangs just proud of
   it instead of z-fighting inside it, and `lensR` is inside the tapered bottom
   face (0.34 x 0.17 half-extent against 0.30 x 0.165). */
const LAMP_PROC_GEO: LampGeo = {
  outreach: LAMP_OUTREACH,
  lensY: LAMP_HOUSING_TOP - LAMP_HOUSING_H - 0.02,
  lensR: 0.30,
};
const LAMP_LENS_ASPECT = 0.55;
let lampModelGeo: LampGeo | null = null;

/* MOUNTING HEIGHT IS DATA NOW, and the intensity has to follow it.
   Illuminance under a lamp is I/h², so a fixture dropped from 9 m to 5 m
   without compensation lights the ground 3.24x too hard. The preset
   `lampIntensity` values are authored against LAMP_HEIGHT, so the scale below
   is (h/9)² and applyRig() multiplies by it — which keeps applyRig() the single
   writer of SpotLight.intensity and setLampsEnabled() the single writer of
   SpotLight.visible. The beam ANGLE is deliberately NOT rescaled: a cutoff
   optic's cone is a property of the reflector, not of the pole, so a 5 m lamp
   correctly throws a smaller pool. */
let lampHeight = LAMP_HEIGHT;
let lampIntensityScale = 1;

/* The built-in arrangement is exactly what this module has always shown: poles
   alternating sides every 25 m along Z at x = ±7.9. setLamps(null) restores it,
   which is what the procedural fallback gets. */
const LAMP_DEFAULTS: LampLayout = {
  enabled: true, layout: 'roadside', spacing: 25, offset: 7.9,
  count: LAMP_COUNT, height: LAMP_HEIGHT,
};
let lampLayout: LampLayout = { ...LAMP_DEFAULTS };

/* A shallow box that is smaller at the BOTTOM than at the top — the silhouette
   of every flat-glass cutoff luminaire. BoxGeometry is indexed with four
   UNIQUE vertices per face, so pulling the lower ring in and recomputing gives
   exact flat normals on all six faces; a generic taper built from a cylinder
   with four radial segments would give a diamond, not a rectangle. */
function taperedBox(w: number, h: number, d: number, taper: number) {
  const g = new THREE.BoxGeometry(w, h, d);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) < 0) { p.setX(i, p.getX(i) * taper); p.setZ(i, p.getZ(i) * taper); }
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/* THE BUILT-IN FIXTURE IS A MOTORWAY MAST, and that is a deliberate choice
   against the only CC0 lamp we have. Poly Haven's `street_lamp_01` is a 3.87 m
   ORNATE CAST-IRON POST — a park lantern. Normalised to a 9 m mounting height
   it becomes a Victorian lamp post three storeys tall standing beside a
   motorway, which is what the user was looking at. `street_lamp_02` is
   wall-mounted and there is no third candidate, so the honest options were a
   wrong model or a right primitive, and a right primitive wins.

   "Bare" was the verdict on what used to be here — a cylinder, a box arm and a
   blob — and every part of that is answered by shape rather than by texture:

     TAPER. A real 9 m lighting column is ~0.19 m in diameter at the base and
       ~0.09 m at the top, i.e. a 1:70-ish swage over its length. The old one
       was a straight-sided cylinder 0.30 m across at the bottom and 0.15 m at
       the top — half as fat again as a real column and every bit of that
       readable, because the eye judges a familiar object by its PROPORTION
       long before it judges its material. Built as a LatheGeometry, whose
       profile can carry the slight barrel a swaged column has and a plain
       CylinderGeometry cannot.
     THE ARM IS A CURVE. This is the single most recognisable thing about a
       street light and the old one got it wrong: a straight tube rotated about
       Z leaves the mast at an angle and arrives at the luminaire at the same
       angle. A real outreach bracket leaves the column VERTICALLY and arrives
       at the lantern HORIZONTALLY. That is a cubic Bezier with its control
       handles along those two tangents, swept as a TubeGeometry.
     A FLAT CUTOFF HOUSING, not a box. Downward-tapering, mounted horizontal,
       with the lens on its underside — see LAMP_HOUSING_*.
     THE BASE COMPARTMENT. Real columns have a door section: a fatter sleeve
       for the first 0.6 m over a cast flange. Two more primitives, and it is
       what stops the pole reading as a stick pushed into the ground.

   Geometry is built ONCE and the group is cloned per unit (clone shares
   BufferGeometry and Material), so the eight fixtures cost one upload. */
function makeLampPrimitives(mats: { pole: THREE.Material; housing: THREE.Material }) {
  const g = new THREE.Group();
  const R = LAMP_OUTREACH, mastTop = LAMP_MAST_TOP;

  /* cast flange + door compartment */
  const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.06, 16), mats.pole);
  flange.position.y = 0.03;
  const shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.125, 0.60, 16), mats.pole);
  shroud.position.y = 0.36;

  /* The column. LatheGeometry revolves a Vector2 profile (x = radius) about +Y;
     the radii run 0.098 → 0.048 over 7.25 m — 0.196 m to 0.096 m in diameter,
     the 1:72 swage a real 9 m column has — with the knuckle just under the
     bracket. Open at both ends on purpose: the bottom is inside the door
     shroud and the top is inside the collar, both of which are capped
     cylinders, so neither hole is ever visible. */
  const prof = [
    new THREE.Vector2(0.098, 0.60),
    new THREE.Vector2(0.094, 1.60),
    new THREE.Vector2(0.081, 3.60),
    new THREE.Vector2(0.066, 5.80),
    new THREE.Vector2(0.052, mastTop - 0.25),
    new THREE.Vector2(0.048, mastTop),
  ];
  const mast = new THREE.Mesh(new THREE.LatheGeometry(prof, 14), mats.pole);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.064, 0.12, 14), mats.pole);
  collar.position.y = mastTop - 0.04;

  /* THE OUTREACH ARM. p0/p1 share an x of 0 so the tube leaves the column dead
     vertical; p2/p3 share a y so it arrives at the lantern dead horizontal.
     It ends 0.25 m short of the luminaire's centre, i.e. 0.14 m past the
     housing's inboard face (half-length 0.39), so the joint is covered rather
     than butted. */
  const curve = new THREE.CubicBezierCurve3(
    new THREE.Vector3(0, mastTop, 0),
    new THREE.Vector3(0, mastTop + 0.70, 0),
    new THREE.Vector3(-R * 0.60, LAMP_HOUSING_MID, 0),
    new THREE.Vector3(-R + 0.25, LAMP_HOUSING_MID, 0)
  );
  const arm = new THREE.Mesh(new THREE.TubeGeometry(curve, 18, 0.045, 8, false), mats.pole);

  const housing = new THREE.Mesh(
    taperedBox(LAMP_HOUSING_L, LAMP_HOUSING_H, LAMP_HOUSING_W, LAMP_HOUSING_TAPER),
    mats.housing);
  housing.position.set(-R, LAMP_HOUSING_MID, 0);
  /* The gear-tray hump on top, which is most of what reads as "luminaire" in
     silhouette against the sky — the part of the lamp the camera sees most.
     Its top IS LAMP_HEIGHT; see the constants. */
  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.44, LAMP_TRAY_H, 0.26), mats.housing);
  tray.position.set(-R + 0.05, LAMP_HEIGHT - LAMP_TRAY_H / 2, 0);

  /* A CG pole standing on a photographed ground with no shadow at its foot
     reads as a sticker. Set once at construction and never touched again —
     castShadow on a MESH is a render-list flag, not a shader define; the
     expensive one is the LIGHT's, and that stays nailed to true. */
  for (const m of [flange, shroud, mast, collar, arm, housing, tray]) {
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  }
  return g;
}

export function makeLamps() {
  const g = new THREE.Group();
  /* THE LENS MATERIAL. `color` is nearly black so the disc is invisible by day
     and the emissive term is the whole of it at night; applyRig() drives both
     emissiveIntensity (from `lampEmissive`) and emissive (from `lampColor`, so
     the cold-LED `estudio` preset does not show a sodium-orange lens). */
  lampLensMat = new THREE.MeshStandardMaterial({
    color: 0x14130f, emissive: 0xffc66b, emissiveIntensity: 0,
    roughness: 0.35, metalness: 0,
  });
  lampPoleMat = new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.7, metalness: 0.6 });
  const housingMat = new THREE.MeshStandardMaterial({ color: 0x26282c, roughness: 0.55, metalness: 0.5 });
  const mats = { pole: lampPoleMat, housing: housingMat };
  /* Unit lens: radius 1, height 0.5, so scale.xz IS the lens radius in metres
     and a fixture with a small lantern gets a small lens. Slightly conical, the
     way a real bowl is, and visible from the side as well as from below —
     a flat downward plane vanishes the moment the camera orbits above it. */
  const lensGeo = new THREE.CylinderGeometry(0.8, 1.0, 0.5, 14);
  /* ONE prototype, cloned eight times. Object3D.clone() copies the transforms
     and SHARES geometry and material, so the mast, the swept arm and the
     luminaire are uploaded once for the whole pool. */
  const procProto = makeLampPrimitives(mats);

  for (let i = 0; i < LAMP_COUNT; i++) {
    /* Every unit is built in the SAME canonical local frame — base at local
       y = 0, arm and head reaching along local −X — so aiming one is a single
       rotation.y and no geometry has to be rebuilt when the layout changes. */
    const lamp = new THREE.Group();
    const proc = procProto.clone(true);
    const model = new THREE.Group();
    model.visible = false;
    const lens = new THREE.Mesh(lensGeo, lampLensMat);
    lamp.add(proc, model, lens);

    /* Beam shape, from a real luminaire rather than from taste:
         angle 0.85 rad (48.7° half, 97° full) — a 9 m mount lighting a ~20 m
           pool wants atan(10/9) = 48°, and 70-100° full is the band cutoff
           optics actually cover.
         penumbra 0.65 — a reflector with a physically large source has no hard
           cone edge; 0 would draw a visible disc rim on the asphalt.
         decay 2 — inverse square, which is what three's photometric path
           expects since r155. The 1.6 it had was a fudge for a 5 m mount.
         distance 55 — the window term is (1 − (d/D)⁴)², so 55 leaves the pool
           untouched (0.999 at 9 m) and just closes the tail off cleanly.
       Everything about the spot's PLACEMENT is written by updateLampFixtures(),
       because it follows the fixture. */
    const spot = new THREE.SpotLight(0xffb45e, 0, 55, 0.85, 0.65, 2);
    spot.castShadow = false;                     // perf: light pools only
    lamp.add(spot, spot.target);

    lampUnits.push({ group: lamp, proc, model, lens, spot, active: true });
    g.add(lamp);
  }
  return g;
}

/* Put the lens and the spot where the ACTIVE fixture's luminaire is, and show
   exactly one fixture. The unit group itself is never hidden — the spot lives
   on it, and hiding it would flip NUM_SPOT_LIGHTS. */
function updateLampFixtures() {
  const useModel = lampFixture === 'model' && !!lampProto;
  const geo = (useModel && lampModelGeo) || LAMP_PROC_GEO;
  /* Our lens stands down when the fixture brought its own emissive: that one is
     modelled to fit its housing and is already following the clock (applyRig
     drives it), so adding a second glow would only be a disc in the wrong
     place. This is why the takeover in prepareLampModel() is worth doing at
     all — it turns "a GLB we cannot light" into "a GLB that lights itself". */
  const ownLens = useModel && lampModelEmissive.size > 0;
  /* MOUNTING HEIGHT. Both fixtures are AUTHORED at LAMP_HEIGHT — the primitives
     by construction, a loaded GLB because prepareLampModel() normalises it —
     so a per-scene height is one uniform scale on the fixture group and the
     same scale on everything derived from it. The AIM offset scales too: it is
     a 10° tilt expressed as a lateral offset at the mounting height, so
     leaving it fixed would make a 5 m lamp squint 18° instead. */
  const s = lampHeight / LAMP_HEIGHT;
  for (const u of lampUnits) {
    u.proc.visible = u.active && !useModel;
    u.model.visible = u.active && useModel;
    u.proc.scale.setScalar(s);
    u.model.scale.setScalar(s);
    u.lens.visible = u.active && !ownLens;
    u.lens.position.set(-geo.outreach * s, geo.lensY * s, 0);
    u.lens.scale.set(geo.lensR * s, 0.22 * s, geo.lensR * LAMP_LENS_ASPECT * s);
    /* The spot originates AT THE LENS — 6 cm below it, so the housing is never
       between the source and the ground — and aims at a point on y = 0 pushed
       LAMP_AIM_OFFSET further over the carriageway.
       ONLY IF THERE IS A BRACKET, though. The offset is the stand-in for a
       cutoff optic's asymmetric throw down the road, and a lamp with no
       outreach is not that lamp: prepareLampModel() reports `outreach: 0` for a
       post-top lantern, which is axially symmetric and lights the ground
       AROUND ITSELF. Tilting it 10° there would slide the pool off the pole and
       leave the base of the fixture in a shadow it is standing in the middle
       of. The primitives always have an arm, so this reads true for them. */
    const aim = geo.outreach > 0.01 ? LAMP_AIM_OFFSET : 0;
    u.spot.position.set(-geo.outreach * s, (geo.lensY - 0.06) * s, 0);
    u.spot.target.position.set((-geo.outreach - aim) * s, 0, 0);
  }
}

/* Sample a candidate fixture's vertices ONCE into a flat world-space buffer.
   The statistics below need four passes over the same points, and a street lamp
   is 20-80 k vertices — walking the geometry four times to re-transform them is
   the wasteful version of this. Capped, so a pathological mesh cannot turn a
   scene switch into a stall: a centroid taken from 30 000 points and one taken
   from 300 000 agree to far better than the centimetre this feeds. */
const LAMP_SAMPLE_CAP = 30000;

function sampleLampPoints(root: THREE.Object3D): Float32Array | null {
  let total = 0;
  root.traverse((o) => {
    const pos = (o as THREE.Mesh).geometry?.attributes?.position;
    if ((o as THREE.Mesh).isMesh && pos) total += pos.count;
  });
  if (!total) return null;
  const stride = Math.max(1, Math.ceil(total / LAMP_SAMPLE_CAP));
  const out: number[] = [];
  const v = new THREE.Vector3();
  root.traverse((o) => {
    const p = (o as THREE.Mesh).geometry?.attributes?.position;
    if (!(o as THREE.Mesh).isMesh || !p) return;
    for (let i = 0; i < p.count; i += stride) {
      v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
      out.push(v.x, v.y, v.z);
    }
  });
  return out.length >= 3 ? Float32Array.from(out) : null;
}

/**
 * Where the mast axis is, where the LUMINAIRE is, and how big its lens is —
 * all in the probe frame, all read off the geometry rather than assumed.
 *
 * Finding the luminaire is the only interesting part, and it is done in two
 * cuts because either one alone is wrong:
 *
 *   BY HEIGHT. The lantern is at the top of the model — that is true of a
 *     bracket lamp and of a post-top one alike — so the highest slice that
 *     still holds enough points to average is it. The slice has to be thin, or
 *     the BRACKET joins the average and drags the answer halfway back to the
 *     mast (measured: 1.1 m of error on a 2.2 m outreach).
 *   BY RADIUS. Some brackets rise level with the head and share the slice
 *     anyway. Whatever does is nearer the mast than the lantern is, so keeping
 *     only the outer 30 % of the slice's radial spread isolates it. On a
 *     symmetric post-top lantern the cut keeps a ring, whose centroid is still
 *     on the axis — which is the right answer there.
 */
function lampModelStats(pts: Float32Array, box: THREE.Box3) {
  const h = Math.max(box.max.y - box.min.y, 1e-6);
  const n = pts.length / 3;
  const X = (i: number) => pts[i * 3];
  const Y = (i: number) => pts[i * 3 + 1];
  const Z = (i: number) => pts[i * 3 + 2];

  /* MAST AXIS: the centroid of the bottom 45 %. A mast is vertical and roughly
     symmetric about its own axis, so its centroid IS that axis; the bounding
     box's centre would be dragged sideways by the bracket overhead. */
  let cx = 0, cz = 0, cn = 0;
  const loY = box.min.y + h * 0.45;
  for (let i = 0; i < n; i++) if (Y(i) <= loY) { cx += X(i); cz += Z(i); cn++; }
  if (cn) { cx /= cn; cz /= cn; } else {
    cx = (box.min.x + box.max.x) / 2;
    cz = (box.min.z + box.max.z) / 2;
  }

  let band = NaN;
  for (const f of [0.96, 0.90, 0.80, 0.65]) {
    const y = box.min.y + h * f;
    let c = 0;
    for (let i = 0; i < n; i++) if (Y(i) >= y) c++;
    if (c >= 8) { band = y; break; }
  }
  if (!Number.isFinite(band)) {
    return { cx, cz, hx: cx, hz: cz, found: false, lensBottom: box.max.y, lensR: 0.3 };
  }

  let rMax = 0;
  for (let i = 0; i < n; i++) {
    if (Y(i) >= band) rMax = Math.max(rMax, Math.hypot(X(i) - cx, Z(i) - cz));
  }
  const rCut = rMax * 0.7;
  let hx = 0, hz = 0, hn = 0;
  for (let i = 0; i < n; i++) {
    if (Y(i) < band || Math.hypot(X(i) - cx, Z(i) - cz) < rCut) continue;
    hx += X(i); hz += Z(i); hn++;
  }
  if (!hn) return { cx, cz, hx: cx, hz: cz, found: false, lensBottom: box.max.y, lensR: 0.3 };
  hx /= hn; hz /= hn;

  /* THE LENS. `lensR` is how far the luminaire reaches about its own centroid.
     `lensBottom` is its UNDERSIDE, and it cannot be read off the slice: a box
     lantern only has vertices at its corners, so the minimum inside a thin
     slice is the lantern's TOP and the lens ends up sealed inside an opaque
     housing — contributing nothing, which is the one outcome that fails the
     brief. So the search reaches 3 % of the model's height below the slice,
     which on a 9 m lamp is a 60 cm window: deep enough to find the underside
     of any real lantern, shallow enough to leave the BRACKET out of it.
     Where it is still wrong it errs LOW, and a lens hanging a few centimetres
     proud of the housing is invisible at 9 m while a buried one is the bug. */
  let lensR = 0;
  for (let i = 0; i < n; i++) {
    if (Y(i) >= band) lensR = Math.max(lensR, Math.hypot(X(i) - hx, Z(i) - hz));
  }
  if (!(lensR > 1e-4)) lensR = 0.3;
  let lensBottom = Infinity;
  const floorY = band - h * 0.03;
  for (let i = 0; i < n; i++) {
    if (Y(i) < floorY) continue;
    if (Math.hypot(X(i) - hx, Z(i) - hz) > lensR * 1.15) continue;
    if (Y(i) < lensBottom) lensBottom = Y(i);
  }
  return {
    cx, cz, hx, hz, found: true,
    lensBottom: Number.isFinite(lensBottom) ? lensBottom : band,
    lensR,
  };
}

/**
 * Fit a downloaded lamp into this module's canonical unit frame: base on
 * y = 0, mast on the local Y axis, luminaire reaching along local −X, overall
 * height exactly LAMP_HEIGHT.
 *
 * Nothing about the source is trusted except that it is an Object3D with
 * geometry: the scale comes from its own bounding box (so a model authored in
 * centimetres lands at the same 9 m as one authored in metres) and the yaw from
 * where its mass actually is (so a lamp exported facing +Z ends up facing the
 * road like every other one).
 *
 * @returns {null|{proto: THREE.Object3D, geo: {outreach, lensY, lensR}}}
 */
function prepareLampModel(src: THREE.Object3D): { proto: THREE.Object3D; geo: LampGeo } | null {
  const inner = src.clone(true);
  /* STRIP LIGHTS AND CAMERAS FIRST, and this is not housekeeping. A glTF with
     KHR_lights_punctual makes GLTFLoader build real THREE.Light objects, and
     eight clones of a lamp that ships one would add eight lights to the scene —
     NUM_POINT_LIGHTS / NUM_SPOT_LIGHTS changes, every material in the scene
     recompiles, and the light budget this whole section is built around is
     gone. The fixture contributes GEOMETRY; the pool contributes light. */
  const strip: THREE.Object3D[] = [];
  inner.traverse((o) => {
    if ((o as THREE.Light).isLight || (o as THREE.Camera).isCamera) strip.push(o);
  });
  for (const o of strip) if (o.parent) o.parent.remove(o);

  /* Measured inside an identity parent, so "probe space" and the space the
     centring group works in are the same thing and no transform is guessed. */
  const probe = new THREE.Group();
  probe.add(inner);
  probe.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(inner);
  if (box.isEmpty()) return null;
  const h = box.max.y - box.min.y;
  if (!Number.isFinite(h) || h < 1e-4) return null;
  const s = LAMP_HEIGHT / h;

  const pts = sampleLampPoints(inner);
  if (!pts) return null;
  const st = lampModelStats(pts, box);

  const dx = st.hx - st.cx, dz = st.hz - st.cz;
  const reach = Math.hypot(dx, dz) * s;
  /* Below ~15 cm of outreach there is no bracket to point anywhere — a post-top
     lantern is axially symmetric and any yaw is as right as any other. */
  const hasArm = reach > 0.15;
  /* Ry(θ) takes (x,0,z) to (x·cosθ + z·sinθ, 0, −x·sinθ + z·cosθ), so the yaw
     that lands a direction at angle φ = atan2(dz, dx) on the −X axis is φ + π:
     it makes the z component vanish and the x component −|d|. Cross-checked
     against placeLamp(), which reads the same convention off the same matrix. */
  const yaw = hasArm ? Math.atan2(dz, dx) + Math.PI : 0;

  const centred = new THREE.Group();
  centred.position.set(-st.cx, -box.min.y, -st.cz);
  centred.add(inner);
  const proto = new THREE.Group();
  proto.scale.setScalar(s);
  proto.rotation.y = yaw;
  proto.add(centred);

  lampModelEmissive.clear();
  proto.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    /* A lens material authored with a standing emissive would glow at noon.
       Take it over — the original value goes in the map so setLampModel(null)
       can hand the caller's material back exactly as it arrived. */
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const raw of mats) {
      const mat = raw as THREE.Material & { emissive?: THREE.Color; emissiveIntensity: number };
      if (!mat?.emissive || lampModelEmissive.has(mat as never)) continue;
      const e = mat.emissive;
      if (e.r + e.g + e.b > 0.01) lampModelEmissive.set(mat as never, mat.emissiveIntensity);
    }
  });

  return {
    proto,
    geo: {
      outreach: hasArm ? reach : 0,
      /* The luminaire's underside, dropped 3 cm so the lens hangs just proud of
         the housing instead of z-fighting inside it. */
      lensY: THREE.MathUtils.clamp((st.lensBottom - box.min.y) * s - 0.03, 0.5, LAMP_HEIGHT),
      lensR: THREE.MathUtils.clamp(st.lensR * s * 0.7, 0.12, 0.55),
    },
  };
}

/**
 * Swap the geometry that stands under each spot for a loaded fixture.
 *
 * `null` (or anything unusable) restores the built-in primitives, which is what
 * the assetless path shows and what a failed download must fall back to — this
 * function never throws and never leaves a unit without a fixture.
 *
 * The pool of LAMP_COUNT SpotLights is NOT touched: the same eight lights stay
 * in the scene at the same visibility, only what is modelled around them
 * changes. `setLampsEnabled()` remains the single writer of SpotLight.visible.
 *
 * The clones share geometry and materials with `src`, which scene/environment.ts owns
 * and caches per prop id; this module disposes neither.
 *
 * @param {THREE.Object3D|null} src  a loaded GLB scene (gltf.scene)
 */
export function setLampModel(src: THREE.Object3D | null) {
  const next = (src?.isObject3D && !lampModelRejected.has(src)) ? src : null;
  if (next === lampModelSrc && (next ? lampFixture === 'model' : lampFixture === 'proc')) return;

  for (const u of lampUnits) u.model.clear();
  /* Hand back every emissive we took over before dropping the reference to it. */
  for (const [mat, intensity] of lampModelEmissive) mat.emissiveIntensity = intensity;
  lampModelEmissive.clear();
  lampProto = null;
  lampModelGeo = null;
  lampModelSrc = next;
  lampFixture = 'proc';

  if (next) {
    let prep = null;
    try {
      prep = prepareLampModel(next);
    } catch (err) {
      /* Manifest-driven external geometry: a malformed GLB must cost us the
         upgrade, not the scene. */
      console.warn('[truck-studio] modelo de poste inválido, usando as primitivas', err);
      prep = null;
    }
    if (prep) {
      lampProto = prep.proto;
      lampModelGeo = prep.geo;
      for (const u of lampUnits) u.model.add(prep.proto.clone(true));
      lampFixture = 'model';
    } else {
      /* Remembered, so a scene the user switches back and forth from does not
         re-clone and re-warn about the same broken GLB every time. */
      lampModelRejected.add(next);
      lampModelSrc = null;
    }
  }

  updateLampFixtures();
  /* The lens material's emissive is applyRig()'s to write and applyRig() only
     runs during a tween, so re-drive it or a fixture swapped in at night sits
     dark until the next preset change. Same pattern as setLamps(). */
  rigRefresh();
}

/** Place one unit at (x, z) on y = 0 and swing its arm toward (aimX, aimZ). */
function placeLamp(unit: LampUnit, x: number, z: number, aimX: number, aimZ: number) {
  unit.group.position.set(x, 0, z);              // bases sit ON the ground, always
  /* three's rotation about +Y maps local (−1, 0, 0) to (−cosθ, 0, sinθ), and
     the arm is the local −X axis, so θ = atan2(aimZ, −aimX) after normalising
     aims it. Verified against the two roadside cases: x > 0 wants aim (−1, 0)
     → θ = 0, x < 0 wants aim (1, 0) → θ = π. */
  const len = Math.hypot(aimX, aimZ) || 1;
  unit.group.rotation.y = Math.atan2(aimZ / len, -aimX / len);
}

export function applyLampLayout() {
  const o = lampLayout;
  const yard = o.layout === 'yard';
  /* The manifest reads `count` as poles PER SIDE for a roadside row, so a
     two-row layout wants twice as many units. Either way it lands in the fixed
     pool: `count: 8` roadside gives 4 poles a side, not 16 spotlights. */
  const n = THREE.MathUtils.clamp(yard ? o.count : o.count * 2, 1, LAMP_COUNT);

  for (let i = 0; i < LAMP_COUNT; i++) {
    const unit = lampUnits[i];
    const on = o.enabled && i < n;
    unit.active = on;                            // read by applyRig(), see there
    if (!on) continue;

    if (yard) {
      /* An open hardstanding is lit from its PERIMETER, not from two rows down
         a centreline. The poles ride an ellipse whose half-width is `offset`
         and half-depth `spacing`, with alternating radii so it reads as the
         sparse scatter the manifest asks for and not a ring of pillars. Every
         arm points back at the origin, i.e. at the truck. */
      const ang = (i + 0.5) / n * Math.PI * 2;
      const k = i % 2 ? 1.0 : 0.68;
      const x = Math.sin(ang) * o.offset * k;
      const z = Math.cos(ang) * o.spacing * k;
      placeLamp(unit, x, z, -x, -z);
    } else {
      /* roadside: staggered rows at x = ±offset, one pole every `spacing`
         metres as you march down Z (so each ROW has a 2·spacing pitch — real
         dual-carriageway lighting is staggered, and it is also exactly the
         arrangement this module shipped before). Arms reach over the lane. */
      const side = i % 2 ? 1 : -1;
      const z = (i - (n - 1) / 2) * o.spacing;
      placeLamp(unit, side * o.offset, z, -side, 0);
    }
  }
  /* The single place fixture visibility is resolved, so `active` cannot drift
     apart from what is on screen. */
  updateLampFixtures();
}

/* ---------------- public API ---------------- */
/**
 * Street-lamp layout. Only ever MOVES the fixed pool of LAMP_COUNT units and
 * flips pole-mesh visibility — never the spotlight count, which is a shader
 * define (see the street-lamps section header). Switching environment is
 * therefore free of recompiles.
 *
 * @param {null|{enabled?: boolean, layout?: 'roadside'|'yard', spacing?: number,
 *               offset?: number, count?: number, height?: number,
 *               modelScale?: number}} opts
 *        'roadside' — `offset` is the distance from the centreline to a pole
 *          base, `spacing` the metres between consecutive poles as you march
 *          down Z (they alternate sides, so each ROW has a 2·spacing pitch),
 *          `count` poles PER SIDE.
 *        'yard' — the poles ring the hardstanding instead: `offset` becomes the
 *          half-WIDTH of that ring and `spacing` its half-DEPTH, `count` is the
 *          total. Author them from where the yard's edges actually are.
 *        `count` is clamped into the fixed pool either way. `null` restores the
 *        built-in roadside row, which is what the procedural fallback shows.
 *        `height` is the MOUNTING HEIGHT in metres, ground to the top of the
 *          luminaire, and is the field to author: it is absolute, so it means
 *          the same thing whether the unit is showing the primitives or a
 *          loaded GLB (both are normalised to LAMP_HEIGHT first). 3-16 m.
 *          `modelScale` is the same knob as a MULTIPLE of LAMP_HEIGHT, kept
 *          because the manifest already carried it; `height` wins.
 *        Changing the height rescales the spot intensity by (h/LAMP_HEIGHT)² so
 *        ground illuminance stays where the preset data was calibrated — see
 *        lampIntensityScale.
 */
export function setLamps(opts: Partial<LampLayout> & { modelScale?: number } | null) {
  const o = opts || {};
  const num = (v: unknown, d: number) => (Number.isFinite(+(v as number)) ? +(v as number) : d);
  lampLayout = {
    enabled: opts ? o.enabled !== false : true,
    layout: o.layout === 'yard' ? 'yard' : 'roadside',
    spacing: Math.max(6, num(o.spacing, LAMP_DEFAULTS.spacing)),
    offset: Math.max(1.5, num(o.offset, LAMP_DEFAULTS.offset)),
    count: Math.max(1, Math.round(num(o.count, LAMP_COUNT))),
    height: THREE.MathUtils.clamp(
      num(o.height, num(o.modelScale, 1) * LAMP_HEIGHT), 3, 16),
  };
  lampHeight = lampLayout.height;
  /* E = I/h². The presets author I against LAMP_HEIGHT, so this is what keeps a
     5 m fixture from lighting the ground 3.2x too hard. */
  lampIntensityScale = (lampHeight / LAMP_HEIGHT) ** 2;
  applyLampLayout();
  /* Spot intensity is applyRig()'s to write and applyRig() only runs during a
     tween, so re-drive it here or a unit this call just parked stays lit until
     the next preset change. Same pattern as setExternalEnvironment(). */
  rigRefresh();
}

/** The lens material, created by makeLamps(). applyRig() drives its emissive. */
export function getLampLensMat() { return lampLensMat; }

/** (h/LAMP_HEIGHT)² — applyRig() multiplies SpotLight.intensity by this. */
export function getLampIntensityScale() { return lampIntensityScale; }

/** Everything getEnvironmentObjects() reports about the pool. */
export function getLampInfo() {
  return {
    lampLayout: { ...lampLayout }, lampPoolSize: LAMP_COUNT,
    lampFixture, lampHeight, lampRefHeight: LAMP_HEIGHT, lampIntensityScale,
    lampGeometry: { ...((lampFixture === 'model' && lampModelGeo) || LAMP_PROC_GEO) },
  };
}
