#!/usr/bin/env python3
"""Export a skinned glTF character as a mesh-only OBJ+MTL+textures zip that Mixamo's auto-rigger accepts.

Mixamo rejects FBX/glTF that already carry a non-Mixamo skeleton ("unable to map your existing skeleton").
Stripping the skin and uploading the bind-pose mesh lets its auto-rigger run instead.

usage: tools/export-mixamo-mesh.py <character.gltf> <out.zip>
"""
import json, os, shutil, struct, sys, tempfile, zipfile

src, out = sys.argv[1], sys.argv[2]
base = os.path.dirname(src)
name = os.path.splitext(os.path.basename(src))[0]
g = json.load(open(src))
bufs = [open(os.path.join(base, b["uri"]), "rb").read() for b in g["buffers"]]

CT = {5120: "b", 5121: "B", 5122: "h", 5123: "H", 5125: "I", 5126: "f"}
N = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}

def accessor(i):
    a = g["accessors"][i]; bv = g["bufferViews"][a["bufferView"]]
    n, fmt = N[a["type"]], CT[a["componentType"]]
    size = struct.calcsize(fmt) * n
    stride = bv.get("byteStride", size)
    off = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    data = bufs[bv.get("buffer", 0)]
    return [struct.unpack_from("<" + fmt * n, data, off + k * stride) for k in range(a["count"])]

tmp = tempfile.mkdtemp()
obj, mtl = [f"mtllib {name}.mtl", "o " + name], []
v_off = 0
used_images = set()

for mi, mesh in enumerate(g["meshes"]):
    for pi, prim in enumerate(mesh["primitives"]):
        attrs = prim["attributes"]
        P = accessor(attrs["POSITION"])
        Nn = accessor(attrs["NORMAL"]) if "NORMAL" in attrs else None
        T = accessor(attrs["TEXCOORD_0"]) if "TEXCOORD_0" in attrs else None
        idx = [t[0] for t in accessor(prim["indices"])] if "indices" in prim else list(range(len(P)))
        mat = g["materials"][prim["material"]] if "material" in prim else {}
        mname = mat.get("name", f"mat_{mi}_{pi}").replace(" ", "_")

        obj.append(f"g {mesh.get('name', f'mesh{mi}').replace(' ', '_')}_{pi}")
        obj.append(f"usemtl {mname}")
        obj += [f"v {x:.6f} {y:.6f} {z:.6f}" for x, y, z in P]
        if T: obj += [f"vt {u:.6f} {1.0 - v:.6f}" for u, v in T]   # glTF UV origin is top-left
        if Nn: obj += [f"vn {x:.6f} {y:.6f} {z:.6f}" for x, y, z in Nn]
        for k in range(0, len(idx), 3):
            a, b, c = (i + 1 + v_off for i in idx[k:k + 3])
            if T and Nn: obj.append(f"f {a}/{a}/{a} {b}/{b}/{b} {c}/{c}/{c}")
            elif T:      obj.append(f"f {a}/{a} {b}/{b} {c}/{c}")
            else:        obj.append(f"f {a} {b} {c}")
        v_off += len(P)

        mtl += [f"newmtl {mname}", "Kd 0.8 0.8 0.8", "Ks 0 0 0", "d 1", "illum 2"]
        tex = (mat.get("pbrMetallicRoughness") or {}).get("baseColorTexture")
        if tex is not None:
            img = g["images"][g["textures"][tex["index"]]["source"]]["uri"]
            if os.path.exists(os.path.join(base, img)):
                mtl.append(f"map_Kd {img}")
                used_images.add(img)
        mtl.append("")

open(os.path.join(tmp, f"{name}.obj"), "w").write("\n".join(obj) + "\n")
open(os.path.join(tmp, f"{name}.mtl"), "w").write("\n".join(mtl) + "\n")
for img in used_images:
    shutil.copy(os.path.join(base, img), tmp)

os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for f in sorted(os.listdir(tmp)):
        z.write(os.path.join(tmp, f), f)
shutil.rmtree(tmp)
print(f"wrote {out}  ({v_off} verts, {len(used_images)} textures, {os.path.getsize(out) // 1024} KB)")
