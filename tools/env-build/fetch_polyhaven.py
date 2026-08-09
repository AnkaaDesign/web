# Fetch Poly Haven models (CC0) into _src_ph/<asset>/.
#
#   python fetch_polyhaven.py jacaranda_tree island_tree_02 searsia_lucida
#
# WHY A SCRIPT AND NOT curl. A Poly Haven glTF is a folder, not a file: the
# `.gltf` references a `.bin` and a textures/ subtree by RELATIVE path, and the
# API returns those in an `include` map keyed by exactly those relative paths.
# Reconstructing that layout by hand is the part that goes wrong.
#
# 1k, not 4k. These are perimeter planting seen from 40 m and further, the build
# downscales embedded textures before export anyway, and the 4k variants are
# several hundred MB each.
import json
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "_src_ph")
API = "https://api.polyhaven.com/files/%s"
RES = "1k"


# The CDN answers urllib's default User-Agent with 403 Forbidden. Not a rate
# limit and not an auth problem — it simply refuses the library's identifier, so
# every request here carries a real one.
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) truck-studio-env-build"}


def _open(url, timeout):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout)


def get_json(url):
    with _open(url, 60) as r:
        return json.loads(r.read().decode("utf-8"))


def fetch(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return os.path.getsize(dest)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with _open(url, 300) as r, open(dest, "wb") as f:
        while True:
            chunk = r.read(1 << 20)
            if not chunk:
                break
            f.write(chunk)
    return os.path.getsize(dest)


def main(assets):
    total = 0
    for a in assets:
        info = get_json(API % a)
        node = (info.get("gltf") or {}).get(RES, {}).get("gltf")
        if not node:
            print("[ph] %s: sem gltf %s" % (a, RES))
            continue
        root = os.path.join(OUT, a)
        n = fetch(node["url"], os.path.join(root, os.path.basename(node["url"])))
        total += n
        for rel, meta in (node.get("include") or {}).items():
            total += fetch(meta["url"], os.path.join(root, rel.replace("/", os.sep)))
        print("[ph] %-18s -> %s" % (a, root))
    print("[ph] total %.1f MB em %s" % (total / 1048576.0, OUT))


main(sys.argv[1:] or ["island_tree_02"])
