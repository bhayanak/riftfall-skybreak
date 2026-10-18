# Headless Blender batch: FBX -> GLB (one GLB per FBX, textures embedded, Y-up, metres).
# usage: blender -b -P tools/fbx2glb.py -- <in-dir> <out-dir> [--limit N] [--draco]
import bpy, sys, os, glob, time

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if len(argv) < 2:
    print("usage: blender -b -P tools/fbx2glb.py -- <in-dir> <out-dir> [--limit N] [--draco]"); sys.exit(2)
IN, OUT = argv[0], argv[1]
LIMIT = int(argv[argv.index("--limit") + 1]) if "--limit" in argv else 0
DRACO = "--draco" in argv
os.makedirs(OUT, exist_ok=True)

files = sorted(glob.glob(os.path.join(IN, "**", "*.fbx"), recursive=True))
# Quaternius packs ship duplicate "FBX (Unity)" / "FBX (Unreal Engine)" trees; keep the plain FBX folder only.
files = [f for f in files if "(Unity)" not in f and "(Unreal" not in f]
if LIMIT: files = files[:LIMIT]
print(f"converting {len(files)} fbx from {IN}")

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def fix_image_paths(fbx_path):
    """Quaternius FBX reference textures by bare filename; search the pack's Textures/ folders."""
    pack = IN
    cands = {}
    for root, _, names in os.walk(pack):
        for n in names:
            if n.lower().endswith((".png", ".jpg", ".jpeg", ".tga")):
                cands.setdefault(n.lower(), os.path.join(root, n))
    for img in bpy.data.images:
        if img.packed_file or not img.filepath: continue
        p = bpy.path.abspath(img.filepath)
        if os.path.exists(p): continue
        hit = cands.get(os.path.basename(img.filepath).lower())
        if hit: img.filepath = hit; img.reload()

ok = fail = 0
t0 = time.time()
for f in files:
    name = os.path.splitext(os.path.basename(f))[0]
    out = os.path.join(OUT, name + ".glb")
    if os.path.exists(out):
        continue
    reset()
    try:
        bpy.ops.import_scene.fbx(filepath=f, use_anim=True, ignore_leaf_bones=True, automatic_bone_orientation=False)
        fix_image_paths(f)
        # FBX importer leaves cm-scale (0.01) on objects when files were authored in cm; apply so GLB is metres
        for o in bpy.data.objects:
            if o.parent is None and o.type in {"MESH", "ARMATURE", "EMPTY"}:
                o.select_set(True)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        kw = dict(filepath=out, export_format="GLB", export_yup=True, export_apply=True,
                  export_texcoords=True, export_normals=True, export_materials="EXPORT",
                  export_image_format="AUTO", export_animations=True, export_skins=True,
                  export_morph=False, export_lights=False, export_cameras=False)
        if DRACO: kw.update(export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6)
        bpy.ops.export_scene.gltf(**kw)
        ok += 1
        print(f"  ok  {name}.glb  {os.path.getsize(out)//1024} KB")
    except Exception as e:
        fail += 1
        print(f"  FAIL {name}: {e}")

print(f"done: {ok} ok, {fail} failed, {time.time()-t0:.0f}s -> {OUT}")
