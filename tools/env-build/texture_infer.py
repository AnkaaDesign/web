# Recover material -> texture bindings that a download lost.
#
# THE PROBLEM. Some scenes arrive as a .gltf with `images: []` — the geometry
# and the material NAMES are there, the texture files are on disk next to it,
# but nothing connects them. (Nicholas3D Vol.1 and Zeps3D shipped a companion
# `*_Textured.gltf` with the bindings; Race.Track and animod did not.)
#
# THE RULE. The downloader writes every texture as
#
#     <32-hex-hash>_<PREFIX>_<body>.<ext>
#     PREFIX ∈ { RGB = colour, R = data/linear, N = normal }
#     body   = <MaterialName>_<MapKind>[@channels=X]
#
# so both the owning material and the map kind are recoverable from the
# filename alone.
#
# WHY YOU CAN TRUST IT. Vol.1 shipped BOTH the loose files and the real
# bindings, so it is ground truth. Running this rule against Vol.1 reproduces
# all 15 of its bindings exactly (see validate_against()). That is the whole
# reason this is inference and not guesswork.
#
# THE ONE TRAP, and it is why `_tokens` splits instead of substring-matching:
# "MetalTrim" is a prefix of "MetalTrim2". A substring test binds MetalTrim's
# three maps to MetalTrim2's files — which was exactly the 3 of 15 that failed
# on the first attempt. Material names must match a WHOLE token.
import os
import re

_HASH = re.compile(r"^[0-9a-f]{32}_")
_PFX = re.compile(r"^(RGB|R|N)_(.*)$")
_CHAN = re.compile(r"@channels=([RGBA])")
_SPLIT = re.compile(r"[_\-\s]+")

# Material names that do not literally appear in their own filenames.
# Kept explicit and tiny — every entry here is a place the convention broke.
ALIASES = {
    "ArrowsEmissive": "Arrows",
    "HDRI": "OvercastClouds",
}


def _norm(s):
    return s.replace("_", "").replace(" ", "").lower()


def scan(folder):
    """Parse every texture file in `folder` into a descriptor."""
    out = []
    for f in os.listdir(folder):
        if not f.lower().endswith((".png", ".jpg", ".jpeg")):
            continue
        stem = os.path.splitext(_HASH.sub("", f))[0]
        m = _PFX.match(stem)
        if not m:
            continue
        pfx, rest = m.group(1), m.group(2)
        chan = _CHAN.search(rest)
        body = _CHAN.sub("", rest)
        out.append({
            "file": f,
            "path": os.path.join(folder, f),
            "pfx": pfx,
            "body": body,
            "chan": chan.group(1) if chan else None,
            "tokens": [t for t in _SPLIT.split(body) if t],
            "norm": _norm(body),
        })
    return out


def infer(folder, material_names):
    """material name -> {base, metal, rough, normal, ao, directx}

    `directx` flags a normal map authored in DirectX convention (inverted green).
    glTF expects OpenGL, so the caller must flip G — Race.Track ships exactly one
    of these (`N_WetConcrete_Normal_DirectX.png`).
    """
    files = scan(folder)
    out = {}
    for name in material_names:
        key = ALIASES.get(name, name)
        mine = [p for p in files if key in p["tokens"]]
        # Fall back to a normalised whole-body prefix for names carrying spaces
        # or stray underscores ("Water 0236normal", "WetConcrete_Base_color").
        if not mine:
            k = _norm(key)
            mine = [p for p in files if p["norm"].startswith(k)]

        def pick(pred):
            for p in mine:
                if pred(p):
                    return p
            return None

        base = pick(lambda p: p["pfx"] == "RGB" and "basecolor" in _norm(p["body"]))
        if base is None:
            base = pick(lambda p: p["pfx"] == "RGB")
        # A file whose body names BOTH maps is a PACKED one
        # ("Container_Metallic-Container_Roughness@channels=G"), and then the
        # name cannot tell the two apart — only the channel can. glTF packs
        # roughness in G and metallic in B, so the channel is authoritative and
        # has to be tested BEFORE the name. Getting this backwards binds
        # Container's roughness to its metallic map, which is the one binding
        # out of 15 the first version of this rule got wrong.
        def _has(p, w):
            return w in _norm(p["body"])

        def _pure(w, other):
            return lambda p: p["pfx"] == "R" and _has(p, w) and not _has(p, other)

        metal = (pick(_pure("metallic", "roughness"))
                 or pick(lambda p: p["pfx"] == "R" and _has(p, "metallic") and p["chan"] == "B"))
        rough = (pick(_pure("roughness", "metallic"))
                 or pick(lambda p: p["pfx"] == "R" and _has(p, "roughness") and p["chan"] == "G"))
        if rough is None and metal is None:
            rough = pick(lambda p: p["pfx"] == "R" and not _has(p, "ao"))
        nrm = pick(lambda p: p["pfx"] == "N")
        ao = pick(lambda p: "ao" in _norm(p["body"]))

        out[name] = {
            "base": base and base["path"],
            "metal": metal and metal["path"],
            "rough": rough and rough["path"],
            "normal": nrm and nrm["path"],
            "ao": ao and ao["path"],
            "directx": bool(nrm and "directx" in _norm(nrm["body"])),
            "found": len(mine),
        }
    return out


def validate_against(folder, textured_gltf):
    """Re-derive a scene whose real bindings are known and diff them.

    Returns (matched, [mismatch strings]). Vol.1 must come back (15, []).
    """
    import json
    with open(textured_gltf, "r", encoding="utf-8") as fh:
        g = json.load(fh)

    def uri(ref):
        if not ref:
            return None
        tex = g["textures"][ref["index"]]
        return g["images"][tex["source"]].get("uri")

    names = [m.get("name", "") for m in g.get("materials", [])]
    guess = infer(folder, names)
    ok, bad = 0, []
    for m in g.get("materials", []):
        n = m.get("name", "")
        p = m.get("pbrMetallicRoughness", {})
        want = {"base": uri(p.get("baseColorTexture")),
                "rough": uri(p.get("metallicRoughnessTexture")),
                "normal": uri(m.get("normalTexture"))}
        for k, v in want.items():
            if v is None:
                continue
            got = guess[n][k]
            got = os.path.basename(got) if got else None
            if got == v:
                ok += 1
            else:
                bad.append("%s.%s truth=%s guess=%s" % (n, k, v, got))
    return ok, bad
