# Headless Blender: build the shipped character + world kit GLBs in public/assets/.
# usage: blender -b -P tools/build-world-kit.py -- [player] [world] [all]
import bpy, sys, os, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets-source")
OUT = os.path.join(ROOT, "public", "assets")
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ["all"]
WHAT = set(argv) or {"all"}

Q = os.path.join(SRC, "quaternius")
USN = os.path.join(Q, "ultimate-stylized-nature")
SNM = glob.glob(os.path.join(Q, "stylized-nature-megakit", "*", "FBX"))[0]
RUINS = os.path.join(Q, "ultimate-modular-ruins", "FBX")
UBC = glob.glob(os.path.join(Q, "universal-base-characters", "*", "*", "Base Characters", "Godot - UE"))[0]
HAIR = glob.glob(os.path.join(Q, "universal-base-characters", "*", "*", "Hairstyles", "Rigged to Head Bone", "glTF*"))[0]

# dest (relative to public/assets) -> source
WORLD = {
    # floating-island bodies
    "world/rock_platform_large.glb": f"{USN}/Nature/glTF/RockPlatforms_Large.gltf",
    "world/rock_platform_medium.glb": f"{USN}/Nature/glTF/RockPlatforms_Medium.gltf",
    "world/rock_platform_tall.glb": f"{USN}/Nature/glTF/RockPlatform_Tall.gltf",
    "world/rock_platforms_1.glb": f"{USN}/Nature/glTF/RockPlatforms_1.gltf",
    "world/rock_1.glb": f"{USN}/Nature/glTF/Rock_1.gltf",
    "world/rock_2.glb": f"{USN}/Nature/glTF/Rock_2.gltf",
    "world/rock_medium_1.glb": f"{SNM}/Rock_Medium_1.fbx",
    "world/rock_medium_2.glb": f"{SNM}/Rock_Medium_2.fbx",
    "world/rock_medium_3.glb": f"{SNM}/Rock_Medium_3.fbx",
    # vegetation
    "world/tree.glb": f"{USN}/Nature/glTF/Tree.gltf",
    "world/tree_fruit.glb": f"{USN}/Nature/glTF/Tree_Fruit.gltf",
    "world/bush.glb": f"{USN}/Nature/glTF/Bush.gltf",
    "world/grass_1.glb": f"{USN}/Nature/glTF/Grass_1.gltf",
    "world/grass_2.glb": f"{USN}/Nature/glTF/Grass_2.gltf",
    "world/pine_1.glb": f"{SNM}/Pine_1.fbx",
    "world/pine_3.glb": f"{SNM}/Pine_3.fbx",
    "world/common_tree_2.glb": f"{SNM}/CommonTree_2.fbx",
    "world/twisted_tree_1.glb": f"{SNM}/TwistedTree_1.fbx",
    "world/dead_tree_2.glb": f"{SNM}/DeadTree_2.fbx",
    # sky
    "world/cloud_1.glb": f"{USN}/Nature/glTF/Cloud_1.gltf",
    "world/cloud_2.glb": f"{USN}/Nature/glTF/Cloud_2.gltf",
    "world/cloud_3.glb": f"{USN}/Nature/glTF/Cloud_3.gltf",
    # pickups
    "world/coin.glb": f"{USN}/Powerups and Pickups/glTF/Coin.gltf",
    "world/gem_blue.glb": f"{USN}/Powerups and Pickups/glTF/Gem_Blue.gltf",
    "world/gem_pink.glb": f"{USN}/Powerups and Pickups/glTF/Gem_Pink.gltf",
    "world/star.glb": f"{USN}/Powerups and Pickups/glTF/Star.gltf",
    # ruins
    "world/ruin_arch_round.glb": f"{RUINS}/Arch_Round.fbx",
    "world/ruin_arch_gothic.glb": f"{RUINS}/Arch_Gothic.fbx",
    "world/ruin_column_round.glb": f"{RUINS}/Column_Round.fbx",
    "world/ruin_column_short.glb": f"{RUINS}/Column_Round_Short.fbx",
    "world/ruin_wall_broken.glb": f"{RUINS}/Wall_Broken.fbx",
    "world/ruin_wall_overgrown.glb": f"{RUINS}/Wall_Overgrown.fbx",
    "world/ruin_wall_arch_broken.glb": f"{RUINS}/Wall_ArchRound_Overgrown_Broken.fbx",
    "world/ruin_floor.glb": f"{RUINS}/Floor_Standard.fbx",
    "world/ruin_stairs.glb": f"{RUINS}/Stairs.fbx",
    "world/ruin_statue_stag.glb": f"{RUINS}/Statue_Stag.fbx",
    "world/ruin_torch.glb": f"{RUINS}/Torch.fbx",
    "world/ruin_flag.glb": f"{RUINS}/Flag_Wall.fbx",
    "world/ruin_bridge.glb": f"{RUINS}/BridgeSection.fbx",
}

def log(*a): print("[kit]", *a)
def reset(): bpy.ops.wm.read_factory_settings(use_empty=True)

def import_any(path):
    if path.lower().endswith(".fbx"):
        bpy.ops.import_scene.fbx(filepath=path, ignore_leaf_bones=True)
    else:
        bpy.ops.import_scene.gltf(filepath=path)

def apply_scale_all():
    bpy.ops.object.select_all(action="DESELECT")
    for o in bpy.data.objects:
        if o.parent is None: o.select_set(True)
    if bpy.context.selected_objects:
        bpy.context.view_layer.objects.active = bpy.context.selected_objects[0]
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

def fix_images(search_root):
    cands = {}
    for root, _, names in os.walk(search_root):
        for n in names:
            if n.lower().endswith((".png", ".jpg", ".jpeg")): cands.setdefault(n.lower(), os.path.join(root, n))
    for img in bpy.data.images:
        if img.packed_file: continue
        p = bpy.path.abspath(img.filepath) if img.filepath else ""
        if p and os.path.exists(p): continue
        hit = cands.get(os.path.basename(img.filepath or "").lower())
        if hit: img.filepath = hit; img.reload()

def resize_images(max_size):
    for img in bpy.data.images:
        w, h = img.size
        if w > max_size or h > max_size:
            s = max_size / max(w, h)
            img.scale(int(w * s), int(h * s))
            log(f"  resized {img.name} {w}x{h} -> {img.size[0]}x{img.size[1]}")

def export_glb(path, **kw):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    base = dict(filepath=path, export_format="GLB", export_yup=True, export_apply=True,
                export_image_format="AUTO", export_lights=False, export_cameras=False, export_morph=False)
    base.update(kw)
    bpy.ops.export_scene.gltf(**base)
    log(f"wrote {os.path.relpath(path, ROOT)}  {os.path.getsize(path)//1024} KB")

# ------------------------------------------------------------------------------------------ player
if WHAT & {"player", "all"}:
    reset()
    bpy.ops.import_scene.gltf(filepath=os.path.join(UBC, "Superhero_Male_FullBody.gltf"))
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    arm.name = "Universal"
    # hair: rigged to head bone, same skeleton -> parent to our armature and reuse its modifier target
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(HAIR, "Hair_SimpleParted.gltf"))
    new = [o for o in bpy.data.objects if o not in before]
    hair_arm = next((o for o in new if o.type == "ARMATURE"), None)
    for o in new:
        if o.type == "MESH":
            o.parent = arm
            for m in o.modifiers:
                if m.type == "ARMATURE": m.object = arm
    if hair_arm:
        bpy.data.objects.remove(hair_arm, do_unlink=True)
    fix_images(UBC)
    resize_images(1024)
    for o in bpy.data.objects:
        if o.type == "MESH":
            for ms in o.material_slots:
                if ms.material: ms.material.blend_method = "OPAQUE"
    export_glb(os.path.join(OUT, "player", "superhero_male.glb"),
               export_animations=False, export_skins=True, export_def_bones=False,
               export_texcoords=True, export_normals=True, export_materials="EXPORT",
               export_image_format="JPEG", export_jpeg_quality=80)

# ------------------------------------------------------------------------------------------- world
if WHAT & {"world", "all"}:
    for rel, src in WORLD.items():
        dst = os.path.join(OUT, rel)
        if not os.path.exists(src):
            log("MISSING", src); continue
        reset()
        try:
            import_any(src)
            fix_images(os.path.dirname(os.path.dirname(src)))
            apply_scale_all()
            resize_images(512)
            export_glb(dst, export_animations=False, export_skins=False, export_materials="EXPORT",
                       export_texcoords=True, export_normals=True, export_image_format="JPEG", export_jpeg_quality=80)
        except Exception as e:
            log("FAIL", rel, e)
log("done")
