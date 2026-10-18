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
    # island bodies: kit platforms with the sloping rim pulled up flat so the whole footprint is walkable
    "world/island_large.glb": f"{USN}/Nature/glTF/RockPlatforms_Large.gltf",
    "world/island_medium.glb": f"{USN}/Nature/glTF/RockPlatforms_Medium.gltf",
}

# which outputs get a post-import fix-up
FLAT_TOP = {"world/island_large.glb": 0.75, "world/island_medium.glb": 0.5}   # rim band depth (model units)

def flatten_top(band):
    """Pull every vertex within `band` of the top plane up to the top (Blender is Z-up after import), then give
    the whole top a grass material so the walkable surface reads as meadow, not sand."""
    for o in bpy.data.objects:
        if o.type != "MESH": continue
        me = o.data
        top = max(v.co.z for v in me.vertices)
        n = 0
        for v in me.vertices:
            if top - v.co.z < band: v.co.z = top; n += 1
        grass = bpy.data.materials.new("IslandGrass")
        grass.use_nodes = True
        bsdf = next(nd for nd in grass.node_tree.nodes if nd.type == "BSDF_PRINCIPLED")
        bsdf.inputs["Base Color"].default_value = (0.36, 0.60, 0.24, 1.0)
        bsdf.inputs["Roughness"].default_value = 0.9
        me.materials.append(grass)
        slot = len(me.materials) - 1
        tops = 0
        for p in me.polygons:
            if all(top - me.vertices[i].co.z < 1e-4 for i in p.vertices): p.material_index = slot; tops += 1
        me.update()
        log(f"  flattened {n}/{len(me.vertices)} verts to top {top:.2f}; {tops} top faces -> grass")

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

    # Runner suit: the base character is a bare mannequin. Split the body polygons by dominant bone into
    # skin (head/neck) / suit (torso, legs) / accent (gloves, forearms, boots) and give each its own material
    # (same normal + roughness maps, different base colour). Exports as 3 primitives of one skinned mesh.
    body = next(o for o in bpy.data.objects if o.type == "MESH"
                and any(ms.material and "Superhero" in ms.material.name for ms in o.material_slots))
    me = body.data
    skin_slot = next(i for i, ms in enumerate(body.material_slots) if ms.material and "Superhero" in ms.material.name)
    skin_mat = body.material_slots[skin_slot].material
    gname = {g.index: g.name for g in body.vertex_groups}

    def bone_class(n):
        l = n.lower()
        if l in ("head", "neck_01") or l.startswith(("face", "eye", "jaw")): return 0
        if any(k in l for k in ("hand", "index", "middle", "ring", "pinky", "thumb", "lowerarm", "foot", "ball")): return 2
        return 1

    vclass = []
    for v in me.vertices:
        best = max(v.groups, key=lambda g: g.weight, default=None)
        vclass.append(bone_class(gname[best.group]) if best else 1)

    def flat_variant(name, rgb, rough):
        m = skin_mat.copy(); m.name = name
        nt = m.node_tree
        bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
        for l in list(nt.links):
            if l.to_socket == bsdf.inputs["Base Color"]: nt.links.remove(l)
        bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
        for l in list(nt.links):
            if l.to_socket == bsdf.inputs["Roughness"]: nt.links.remove(l)
        bsdf.inputs["Roughness"].default_value = rough
        return m

    suit = flat_variant("MI_Suit", (0.055, 0.075, 0.16), 0.55)       # deep navy
    accent = flat_variant("MI_Suit_Accent", (0.10, 0.62, 0.66), 0.35)  # teal, matches UI / rift
    me.materials.append(suit); suit_slot = len(me.materials) - 1
    me.materials.append(accent); accent_slot = len(me.materials) - 1
    slot_for = {0: skin_slot, 1: suit_slot, 2: accent_slot}
    counts = [0, 0, 0]
    for p in me.polygons:
        if p.material_index != skin_slot: continue
        votes = [0, 0, 0]
        for vi in p.vertices: votes[vclass[vi]] += 1
        c = max(range(3), key=lambda i: votes[i])
        p.material_index = slot_for[c]; counts[c] += 1
    log(f"suit split: skin {counts[0]}  suit {counts[1]}  accent {counts[2]} polys")

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
            if rel in FLAT_TOP: flatten_top(FLAT_TOP[rel])
            resize_images(512)
            export_glb(dst, export_animations=False, export_skins=False, export_materials="EXPORT",
                       export_texcoords=True, export_normals=True, export_image_format="JPEG", export_jpeg_quality=80)
        except Exception as e:
            log("FAIL", rel, e)
log("done")
