# Truck Studio — from HDRI + procedural to real 3D sets

Status: research + plan. No code changed yet.

---

## 1. Why the current scene reads as fake

This is not a "the HDRI is bad" problem. Poly Haven HDRIs are photographs — they are
photoreal by definition. Four specific things in the current pipeline break the illusion,
all of them in the **transition** between the photo and the CG:

| # | What happens now | Why the eye rejects it |
|---|---|---|
| 1 | `nearGround` builds a **procedural disc** of asphalt + a grass verge, radius 26 m, fade 18 m, blended into the backplate (`environment.ts`, `environments.json`) | A perfectly circular, perfectly flat ground with a radial alpha fade. Real ground has kerbs, drains, joints, painted lines, a horizon that is *occluded by objects*, not faded by alpha. |
| 2 | The `tintRgb` machinery — a whole calibration essay in `environments.json` — exists to force CG asphalt to match photo asphalt | The fact that this is needed at all is the tell: two different renderers are being reconciled by a colour multiplier. It fixes the average and cannot fix the texture. |
| 3 | `scatter` places 420 + 280 + … grass instances, procedural lamps, procedural road mast | Scattered instances have no *arrangement logic*. Real sites have tyre tracks, oil stains, pallets left by the door, cars parked in painted bays. |
| 4 | Nothing occludes the horizon | The truck sits on a disc in an infinite photo. There is no mid-ground. **This is the biggest one** — and it is exactly what your reference image has and your scene does not. |

Your reference image (the drone scan of a distribution centre) works because every one of
those four is solved *for free*: the geometry is real, the lighting is real, the arrangement
is real, and the building occludes the horizon.

---

## 2. The architecture: three shells

Do **not** try to model a city. You never see more than ~40 m around the truck. Split the
scene by distance and use a different technique in each band — this is how Porsche/Polestar-class
web configurators are actually built.

```
        camera orbit ~8-25 m
              |
   [ NEAR  0-40 m ]   real modelled PBR geometry, fully lit by your rig, casts/receives shadows
   [ MID  40-250 m ]  aerial photogrammetry, UNLIT/baked, reconciled by fog + per-preset tint
   [ FAR  250 m+   ]  the HDRI — but re-baked in Blender FROM shells 1+2, not a stock photo
```

### Why photogrammetry goes in the MID band, never the near band

Photogrammetry albedo = `real albedo × the sun that was shining that day`. Drop a sunny scan
into your `chuvoso/noite` preset and it glows. Two mitigations, and the second is the elegant one:

1. **Only pick overcast/soft-light scans.** Under a cloud deck the baked term is near-constant,
   so `albedo × k` relights believably by just multiplying. (Your reference image is exactly
   this — hazy, soft shadows.)
2. **Let your existing fog do the work.** `THREE.FogExp2` gives `1 - exp(-(d·density)²)`.
   At 150 m with `nublado` density 0.0046 that is **38 % fog**; at `chuvoso/noite` (0.0090)
   it is **84 %**. Anything past ~120 m is majority fog colour, and fog colour is already
   tweened per preset. **The band that is hardest to relight is the band your rig already
   overwrites.** Put photogrammetry at 100–300 m and the conflict mostly disappears.

You already have the runtime hook for the residual: `tintRgb` in `environments.json` is a
linear multiplier resolved in scene-referred radiance. Reuse that exact mechanism as a
per-preset uniform on the photogrammetry material.

### The step that buys the most realism per hour: re-bake the HDRI

Once shells 1 and 2 are assembled in Blender, render an **equirect 4K HDR from the truck's
pivot position** and ship it as that scenario's `sky.hdr`. Nothing in the engine changes —
`environments.json` already has an `hdri` slot. But now the truck's chrome, glass and paint
reflect *the actual warehouse it is parked in front of*, and background/geometry/reflection
all agree. This is the single highest-impact change in the whole document and it is free
architecturally.

---

## 3. Licensing — the filter that decides everything

Researched, because it eliminates most of what you asked about:

### Unreal / Fab
Most third-party Fab content is usable outside Unreal, but **Epic-authored content is not** —
Paragon, MetaHumans, City Sample (the Matrix demo), Downtown West, and Quixel Megascans are
engine-restricted. So the "City Sample" look you are imagining is specifically the one asset
you cannot legally use.

**One real exception worth checking your account for:** from the Fab launch (Oct 2024) to
31 Dec 2024, Megascans was free to everyone under the Fab Standard License **for all engines
and tools**, and anything claimed in that window stays licensed forever. If you clicked
"add to library" then, you already own a photoreal library you can legally use in three.js.
Worth checking today.

### Unity Asset Store
Unity's own support article confirms other engines are allowed — **but** the EULA also
forbids delivery where *"users of your project can access or extract the raw asset files."*
A three.js app serves `.glb` over HTTP; anyone can pull it from the Network tab. A web app
is close to the worst case for that clause. Same clause exists in TurboSquid / CGTrader
royalty-free terms. **Treat paid marketplace assets as unusable for a public web build.**

### What that leaves
**CC0 and CC-BY.** CC-BY is completely fine for you — you already ship
`public/environments/CREDITS.md` and a `credit{}` block per environment. Attribution is a
solved problem in this codebase.

### Google Photorealistic 3D Tiles — checked, and it is a trap for *this* use
Tempting (real cities, worldwide, streamed). But the Map Tiles API policy states you
**"must not pre-fetch, index, store, or cache any Content"**. You cannot bake it into a GLB
or into your HDRI — it must stream live, billed per session, and it is unavailable in the
EEA. Viable as a *separate later feature* ("view this truck at our Ibiporã plant"), not as
the foundation. Ground-level photogrammetry also looks mushy up close, so it would only
ever serve the MID/FAR band anyway — which baked scans do for free.

### Your two warehouses
`Zeps3D/01- Warehouse` is the better one: 20 MB, clean 4-set PBR (floor / wall / beams /
details incl. an emissive map for the lights), 2.3 MB glTF. `Giimann/01- Warehouse.2016`
is a 97 MB glTF with embedded buffers — usable but needs heavy reprocessing.
**Before shipping either:** confirm on the Sketchfab page which license they carry and
record it in `CREDITS.md`. These arrived via a bulk downloader, so the license did not come
with them, and this app is a commercial product.

---

## 4. Asset shortlist (all verified via the Sketchfab API: downloadable, licensed, real geometry)

A notable finding: **CC0 returns essentially nothing realistic above 30 k triangles** in
these categories. Everything usable is CC-BY. Plan for attribution, not for avoiding it.

### MID shell — aerial photogrammetry (the reference-image look)

| Asset | Tri | Lic | Role |
|---|---|---|---|
| [Leipzig industrial area](https://sketchfab.com/3d-models/0f7a50194345495984458bb4c5e562ba) — 333DDD | 1.2 M | CC-BY | **Top pick.** Industrial estate, overcast. Exactly the reference. |
| [Factory UAV aerial survey (Pix4d)](https://sketchfab.com/3d-models/a1b5a6df15a34cfda80fc8f57d5f4f05) — KCraw | 1.0 M | CC-BY | Factory + yard + parking |
| [An entire small town scanned by a drone](https://sketchfab.com/3d-models/ebdd505832c745e081f03d8e29d17f84) — Mitko | 2.0 M | CC-BY | Far fill for `urbano` |
| [Industrial Building Model Acquired by Drone](https://sketchfab.com/3d-models/0e93ab7b05944087b4a19fb7262877fa) — TLT | 3.7 M | CC-BY | Single hero building, decimate hard |
| [Queen & Augusta Parking Lot](https://sketchfab.com/3d-models/8e94b413212c450d9ed9ca229b58518e) — J. Bolton | 148 k | CC-BY | Real asphalt + real painted bays + real cars, already light |
| [Isparta City Block, Turkey](https://sketchfab.com/3d-models/411a17538d174009aea949e9fa259008) | 400 k | CC-BY | Urban mid-ground |

### MID/FAR — modelled city (cleaner than photogrammetry, relights properly)

| Asset | Tri | Lic |
|---|---|---|
| [TC City Sections](https://sketchfab.com/3d-models/4abb909bb6c24e47bc683b9bdfc00938) — d880 | 596 k | CC-BY |
| [City Grid Block](https://sketchfab.com/3d-models/3488e40ceca846bb9023f894a749c398) | 285 k | CC-BY |
| [Osaka downtown](https://sketchfab.com/3d-models/53e0980d555a4af6b921cc00c208e4a3) — matousekfoto | 794 k | CC-BY |
| [New York blvd.](https://sketchfab.com/3d-models/ed0701bcb94c4b1692bd97a54df19ad7) — matousekfoto | 748 k | CC-BY |
| [modular kit city builder starter kit](https://sketchfab.com/3d-models/784358d2b44a43398079770d316b6de7) | 199 k | CC-BY |

### NEAR shell — the 40 m bubble that actually sells it

| Asset | Tri | Lic | Role |
|---|---|---|---|
| **Zeps3D warehouse** (local) | — | verify | Hero building for `patio-logistico` |
| [Modular industrial building](https://sketchfab.com/3d-models/4bb58f7548c7464ebdf41a51958f712a) | 55 k | CC-BY | Kitbash neighbours |
| [Container Pack](https://sketchfab.com/3d-models/0d416a9bcfc14978aa50e80281dfe9a5) — drcrazzie | 448 k | CC-BY | Yard filler, huge silhouette value |
| [Shipping Containers](https://sketchfab.com/3d-models/9275fb50cdb2477c9a4778b8ffa41036) — A. Ismailov | 149 k | CC-BY | Cheaper alternative |
| [Modular Urban Fence Pack](https://sketchfab.com/3d-models/1cf3690327bd449881ba6857d8fe7caf) | 39 k | CC-BY | Site perimeter — replaces the procedural fence |
| [Abandoned Warehouse](https://sketchfab.com/3d-models/698a34300af34095ac6593f348585daa) | 198 k | CC-BY | Second warehouse variant |
| [Parking Garage](https://sketchfab.com/3d-models/88c3f49f553f41f59382e0e38781193c) | 34 k | CC-BY | `urbano` |
| [Poly Haven — Industrial](https://polyhaven.com/models/industrial) | — | **CC0** | Barrels, crates, pallets. Already your prop pipeline. |
| [ambientCG](https://ambientcg.com/) | — | **CC0** | Asphalt, concrete, kerb, line-marking **decals** |

### Cars & background traffic

| Asset | Tri | Lic |
|---|---|---|
| [Generic civil service vehicles pack](https://sketchfab.com/3d-models/8ff2a13f30914932a70c7950cfa58465) | 93 k | CC-BY |
| [Truck Trailer FREE](https://sketchfab.com/3d-models/575958a53e3d4e9f8bcfb1ee2cef67bf) — NLM | 637 k | CC-BY |
| [Isuzu Cargo Base Truck](https://sketchfab.com/3d-models/6f5765ef13294287b5d14df4ba64d5bf) | 127 k | CC-BY |
| [Auto mezzanine deck trailer](https://sketchfab.com/3d-models/6ca42681c69845caabe58ddda39ab348) | 406 k | CC-BY |
| [Airport Catering Truck](https://sketchfab.com/3d-models/289f4e2cfa3f4722b0476b1fc37681d8) | 58 k | CC-BY |

> **Cars are the weak spot of the free ecosystem** and always will be — real cars carry
> trademark exposure on top of copyright. Two things save you: (a) parked cars in the MID
> band come *for free inside the aerial scans* (your reference image is full of them), and
> (b) `IbiporImplementosRodovirios/` in your downloads folder is presumably your own
> company's trailers — those are the ones that should be in the near band anyway.

### The road: do NOT buy a road model
Sketchfab road results were the weakest category by far (8 candidates, all poor). Correct
answer: a road is **flat**. Build it from a real 4K asphalt PBR set (ambientCG / Poly Haven,
CC0) + **decal meshes** for lane lines, crosswalks, patches, tyre scrub and oil stains,
plus real modelled kerbs, drains and guardrail. That beats any road mesh you could download
and costs almost nothing in triangles.

---

## 5. Budget (what a browser will actually take)

| | Desktop target | Mobile fallback |
|---|---|---|
| Triangles on screen | 2.5–4 M | ≤ 1 M |
| Draw calls | ≤ 400 (instance the repeats) | ≤ 200 |
| GPU texture (KTX2/BasisU) | ≤ 400 MB | ≤ 150 MB |
| **Wire size per scenario** | **≤ 35 MB** | ≤ 12 MB |

Per shell: NEAR ~800 k tri / 15 MB · MID ~600 k tri decimated / 12 MB · FAR = the HDRI you
already ship. That fits with room to spare. Load NEAR first, stream MID after first paint.

---

## 6. Pipeline (per asset, repeatable)

```bash
npx @gltf-transform/cli dedup in.glb a.glb
npx @gltf-transform/cli weld a.glb b.glb
npx @gltf-transform/cli simplify b.glb c.glb --ratio 0.25 --error 0.001
npx @gltf-transform/cli resize c.glb d.glb --width 2048 --height 2048
npx @gltf-transform/cli uastc d.glb e.glb --level 4 --rdo 4 --zstd
npx @gltf-transform/cli meshopt e.glb out.glb --level high
```

- `simplify --ratio 0.25` is the workhorse for the 1–4 M tri photogrammetry scans.
- **KTX2 (`uastc`/`etc1s`) is not optional** at this asset count — raw PNGs will exhaust
  GPU memory long before triangles do. Your Zeps3D warehouse alone is 16 MB of loose PNG.
- You already ship `/vendor/draco/`; add a `KTX2Loader` + transcoder next to it.

---

## 7. Code changes, mapped to your files

1. **`environments.json`** — add a `set` block beside the existing `nearGround`:
   ```jsonc
   "set": {
     "near": { "url": "/environments/patio-logistico/near.glb", "lightmap": "…" },
     "mid":  { "url": "…/mid.glb", "unlit": true, "tintRgb": [1,1,1], "fadeStart": 90 }
   }
   ```
2. **`scene/environment.ts`** (`applyEnvironment`, line 1816) — load `set.near` / `set.mid`
   alongside the HDRI; when `set` is present, skip `nearGround` and `scatter` entirely.
   Keep both paths so nothing regresses while you migrate one scenario at a time.
3. **`scene/scene.ts`** — apply the per-preset linear tint to the MID material each frame
   (same tween loop the rig already runs). This is the photogrammetry relighting knob.
4. **`scene/scatter.ts`** — becomes optional per scenario, not deleted. Still right for grass
   on `rodovia`.
5. **`scene/lamps.ts`** — the procedural mast can stay; real lamp geometry in the near set is
   better but the mast is genuinely good and cheap.
6. **`core/paths.ts` / `config/assets.ts`** — add a `setsDir`.

---

## 8. Suggested order

| Phase | Work | Payoff |
|---|---|---|
| **0** | Verify licenses on the two local warehouses; check your Fab library for a 2024 Megascans claim | Unblocks everything |
| **1** | `patio-logistico` only: Zeps3D warehouse + containers + fence in the near band, real asphalt + line decals. No photogrammetry yet. | Proves the near shell. Probably 70 % of the perceived gain. |
| **2** | Re-bake `sky.hdr` in Blender from that set | Reflections finally agree. Biggest gain per hour. |
| **3** | Add the Leipzig / Factory scan as the MID shell at 100–250 m | Kills the "floating on a photo" feeling |
| **4** | Repeat for `rodovia` (road decals + guardrail) and `urbano` (city block) | |
| **5** | *Optional, separate:* Google 3D Tiles "view at our plant" mode | Marketing feature |

Do phase 1 on one scenario before touching the others. If the near shell does not look
right, no amount of city behind it will help.
