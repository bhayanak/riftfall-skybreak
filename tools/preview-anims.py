# Headless Blender: render contact-sheet frames of clips from player_anims.glb applied to the Superhero mesh.
# usage: blender -b -P tools/preview-anims.py -- <out.png> clip[:t01] clip[:t01] ...
import bpy, sys, os, glob, math
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
argv = sys.argv[sys.argv.index("--") + 1:]
OUT, specs = argv[0], argv[1:]
ANIMS = os.path.join(ROOT, "public", "assets", "player", "player_anims.glb")
MESH = glob.glob(os.path.join(ROOT, "assets-source", "quaternius", "universal-base-characters", "**", "Godot - UE", "Superhero_Male_FullBody.gltf"), recursive=True)[0]

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "BLENDER_WORKBENCH"
sc.display.shading.light = "STUDIO"
sc.display.shading.color_type = "MATERIAL"
sc.render.resolution_x, sc.render.resolution_y = 360, 520
sc.render.fps = 30

before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=MESH)
mesh_arm = next(o for o in bpy.data.objects if o not in before and o.type == "ARMATURE")
before = set(bpy.data.objects); acts0 = set(bpy.data.actions)
bpy.ops.import_scene.gltf(filepath=ANIMS)
for o in [o for o in bpy.data.objects if o not in before]:
    o.hide_render = True
acts = {a.name.split("|")[-1]: a for a in bpy.data.actions if a not in acts0}
print("[preview] clips available:", sorted(acts))

cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
sc.collection.objects.link(cam); sc.camera = cam
cam.location = (0, -5.0, 1.0); cam.rotation_euler = (math.radians(85), 0, 0)
cam.data.lens = 45

light = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); sc.collection.objects.link(light)
light.rotation_euler = (math.radians(50), 0, math.radians(30))

mesh_arm.animation_data_create()
frames_dir = os.path.splitext(OUT)[0] + "_frames"; os.makedirs(frames_dir, exist_ok=True)
outs = []
for spec in specs:
    clip, _, t = spec.partition(":")
    t = float(t) if t else 0.5
    act = acts.get(clip)
    if not act: print("[preview] missing clip", clip); continue
    mesh_arm.animation_data.action = act
    if hasattr(act, "slots") and len(act.slots):
        try: mesh_arm.animation_data.action_slot = act.slots[0]
        except Exception: pass
    f0, f1 = act.frame_range
    sc.frame_set(int(round(f0 + (f1 - f0) * t)))
    # frame the character: camera looks at pelvis height, slight 3/4 angle
    cam.location = (2.2, -4.6, 1.1); cam.rotation_euler = (math.radians(84), 0, math.radians(25))
    path = os.path.join(frames_dir, f"{clip}_{int(t*100):03d}.png")
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    outs.append(path); print("[preview] rendered", path)

# stitch horizontally with Blender's image API
if outs:
    imgs = [bpy.data.images.load(p) for p in outs]
    w, h = imgs[0].size
    sheet = bpy.data.images.new("sheet", w * len(imgs), h)
    px = [0.0] * (w * len(imgs) * h * 4)
    for i, im in enumerate(imgs):
        src = list(im.pixels)
        for y in range(h):
            row = src[y * w * 4:(y + 1) * w * 4]
            off = (y * w * len(imgs) + i * w) * 4
            px[off:off + w * 4] = row
    sheet.pixels = px
    sheet.filepath_raw = OUT; sheet.file_format = "PNG"; sheet.save()
    print("[preview] sheet", OUT)
