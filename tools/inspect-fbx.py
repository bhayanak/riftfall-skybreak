# Headless Blender: summarise every FBX in a folder (armature bones, actions, frame range, meshes, root travel).
# usage: blender -b -P tools/inspect-fbx.py -- <folder-or-file> [...]
import bpy, sys, os, glob
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
files = []
for a in args:
    files += sorted(glob.glob(os.path.join(a, "*.fbx"))) if os.path.isdir(a) else [a]

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

for f in files:
    reset()
    try:
        bpy.ops.import_scene.fbx(filepath=f, automatic_bone_orientation=False, ignore_leaf_bones=False)
    except Exception as e:
        print(f"\n== {os.path.basename(f)}  IMPORT FAILED: {e}")
        continue
    arms = [o for o in bpy.data.objects if o.type == "ARMATURE"]
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    print(f"\n== {os.path.basename(f)}")
    print(f"   armatures={len(arms)} meshes={len(meshes)} actions={[a.name for a in bpy.data.actions]}")
    for m in meshes:
        print(f"   mesh '{m.name}' verts={len(m.data.vertices)} mats={[ms.material.name if ms.material else None for ms in m.material_slots]}")
    for a in arms:
        bones = [b.name for b in a.data.bones]
        print(f"   armature '{a.name}' scale={tuple(round(s,3) for s in a.scale)} bones={len(bones)} first={bones[:6]}")
        root = next((b for b in a.data.bones if b.parent is None), None)
        hips = next((b for b in a.data.bones if "hips" in b.name.lower() or b.name.lower().endswith("pelvis")), None)
        act = a.animation_data.action if a.animation_data else None
        if act:
            fr = act.frame_range
            fps = bpy.context.scene.render.fps
            # Blender 5 layered actions: fcurves live under layers[].strips[].channelbags[]
            n_fc = sum(len(cb.fcurves) for l in act.layers for s in l.strips for cb in s.channelbags) if hasattr(act, "layers") else len(act.fcurves)
            print(f"   action '{act.name}' frames {int(fr[0])}-{int(fr[1])} ({(fr[1]-fr[0])/fps:.2f}s @ {fps}fps) fcurves={n_fc}")
            if hips:
                pb = a.pose.bones[hips.name]
                sc = bpy.context.scene
                sc.frame_set(int(fr[0])); p0 = (a.matrix_world @ pb.matrix).to_translation().copy()
                sc.frame_set(int(fr[1])); p1 = (a.matrix_world @ pb.matrix).to_translation().copy()
                d = p1 - p0
                print(f"   hips '{hips.name}' start={tuple(round(x,3) for x in p0)} travel(XYZ)={tuple(round(x,3) for x in d)}  -> {'IN PLACE' if Vector((d.x, d.y, 0)).length < 0.05 else 'ROOT MOTION'}")
