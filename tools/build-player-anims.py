# Headless Blender: build public/assets/player/player_anims.glb
#   = Quaternius Universal rig + selected UAL1/UAL2 clips + Mixamo clips retargeted onto that rig.
# usage: blender -b -P tools/build-player-anims.py -- [--out path.glb] [--mixamo-dir dir] [--check]
import bpy, sys, os, glob, math
from mathutils import Matrix, Vector, Quaternion

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def opt(name, default):
    return argv[argv.index(name) + 1] if name in argv else default
OUT = opt("--out", os.path.join(ROOT, "public", "assets", "player", "player_anims.glb"))
MIXAMO_DIR = opt("--mixamo-dir", os.path.join(ROOT, "assets-source", "mixamo", "upload", "animations"))
CHECK = "--check" in argv

Q = os.path.join(ROOT, "assets-source", "quaternius")
UAL1 = glob.glob(os.path.join(Q, "universal-animation-library", "**", "Unreal-Godot", "UAL1_Standard.glb"), recursive=True)[0]
UAL2 = glob.glob(os.path.join(Q, "universal-animation-library-2", "**", "Unreal-Godot", "UAL2_Standard.glb"), recursive=True)[0]

# clip whitelist -> exported name
UAL1_CLIPS = {
    "Idle_Loop": "idle", "Walk_Loop": "walk", "Jog_Fwd_Loop": "jog", "Sprint_Loop": "sprint",
    "Jump_Start": "jump_start", "Jump_Loop": "jump_loop", "Jump_Land": "jump_land", "Roll": "roll",
    "Crouch_Idle_Loop": "crouch_idle", "Crouch_Fwd_Loop": "crouch_fwd", "Dance_Loop": "dance",
    "Death01": "death", "Hit_Chest": "hit",
}
UAL2_CLIPS = {
    "Slide_Start": "slide_start", "Slide_Loop": "slide_loop", "Slide_Exit": "slide_exit",
    "ClimbUp_1m": "climb_up", "Shield_Dash": "dash", "Hit_Knockback": "knockback",
    "NinjaJump_Start": "djump_start", "NinjaJump_Idle_Loop": "djump_loop", "NinjaJump_Land": "djump_land",
}
MIXAMO_CLIPS = {
    "Falling Idle": "fall_loop", "Front Flip": "flip", "Hard Landing": "land_hard", "Jump Over": "vault",
    "Running Dive Roll": "dive_roll", "Stumble Backwards": "stumble", "Swinging": "swing",
    "Victory": "victory", "Wall Run": "wallrun",
}
LOOPS = {"fall_loop", "swing", "wallrun"}

# Mixamo -> Quaternius Universal (UE mannequin names)
BONE_MAP = {
    "mixamorig:Hips": "pelvis",
    "mixamorig:Spine": "spine_01", "mixamorig:Spine1": "spine_02", "mixamorig:Spine2": "spine_03",
    "mixamorig:Neck": "neck_01", "mixamorig:Head": "Head",
    "mixamorig:LeftShoulder": "clavicle_l", "mixamorig:LeftArm": "upperarm_l", "mixamorig:LeftForeArm": "lowerarm_l", "mixamorig:LeftHand": "hand_l",
    "mixamorig:RightShoulder": "clavicle_r", "mixamorig:RightArm": "upperarm_r", "mixamorig:RightForeArm": "lowerarm_r", "mixamorig:RightHand": "hand_r",
    "mixamorig:LeftUpLeg": "thigh_l", "mixamorig:LeftLeg": "calf_l", "mixamorig:LeftFoot": "foot_l", "mixamorig:LeftToeBase": "ball_l",
    "mixamorig:RightUpLeg": "thigh_r", "mixamorig:RightLeg": "calf_r", "mixamorig:RightFoot": "foot_r", "mixamorig:RightToeBase": "ball_r",
}
KEEP_HIPS_XZ = False  # force every clip in place; the controller owns horizontal motion

# ----------------------------------------------------------------------------------------------
def log(*a): print("[anims]", *a)

def armatures(): return [o for o in bpy.data.objects if o.type == "ARMATURE"]

def import_glb(path):
    before = set(bpy.data.objects); acts = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=path)
    new_objs = [o for o in bpy.data.objects if o not in before]
    new_acts = [a for a in bpy.data.actions if a not in acts]
    arm = next(o for o in new_objs if o.type == "ARMATURE")
    return arm, new_objs, new_acts

def delete_objects(objs):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        if o.name in bpy.data.objects: o.select_set(True)
    bpy.ops.object.delete(use_global=True)

def find_action(acts, clip):
    for a in acts:
        n = a.name
        if n == clip or n.endswith("|" + clip) or n.split("|")[-1] == clip or n.startswith(clip + "."):
            return a
    return None

def rot_of(m: Matrix) -> Matrix:
    return m.to_3x3().normalized().to_4x4()

def ensure_slot(obj, action):
    """Blender 4.4+/5: actions are slotted; make sure obj has an assigned slot for `action`."""
    if obj.animation_data is None: obj.animation_data_create()
    obj.animation_data.action = action
    if hasattr(action, "slots"):
        slot = action.slots[0] if len(action.slots) else action.slots.new(id_type="OBJECT", name=obj.name)
        try: obj.animation_data.action_slot = slot
        except Exception: pass
        return slot
    return None

# ----------------------------------------------------------------------------------------------
def retarget(src, tgt, src_action, out_name):
    """Bake src_action (on Mixamo rig `src`) onto `tgt` as a new action named out_name."""
    scene = bpy.context.scene
    scene.render.fps = 30
    src.animation_data.action = src_action
    if hasattr(src_action, "slots") and len(src_action.slots):
        try: src.animation_data.action_slot = src_action.slots[0]
        except Exception: pass
    f0, f1 = (int(round(x)) for x in src_action.frame_range)

    # rest matrices (world)
    Sw, Tw = src.matrix_world, tgt.matrix_world
    s_rest = {b.name: Sw @ b.matrix_local for b in src.data.bones}
    t_rest = {b.name: Tw @ b.matrix_local for b in tgt.data.bones}
    t_bones = [b for b in tgt.data.bones]  # already parent-before-child order in Blender
    order = []
    def walk(b):
        order.append(b)
        for c in b.children: walk(c)
    for b in t_bones:
        if b.parent is None: walk(b)
    inv_map = {v: k for k, v in BONE_MAP.items()}

    src_hips = "mixamorig:Hips"; tgt_pelvis = "pelvis"
    height_scale = t_rest[tgt_pelvis].translation.z / max(1e-6, s_rest[src_hips].translation.z)

    act = bpy.data.actions.new(out_name)
    ensure_slot(tgt, act)
    for pb in tgt.pose.bones:
        pb.rotation_mode = "QUATERNION"
        pb.matrix_basis = Matrix.Identity(4)

    for f in range(f0, f1 + 1):
        scene.frame_set(f)
        desired = {}  # target bone name -> world matrix
        for b in order:
            name = b.name
            par = b.parent.name if b.parent else None
            rest = t_rest[name]
            if par is None:
                base = rest.copy()
            else:
                base = desired[par] @ t_rest[par].inverted() @ rest  # follow parent rigidly
            sb = inv_map.get(name)
            if sb and sb in src.pose.bones:
                s_pose = Sw @ src.pose.bones[sb].matrix
                r_delta = rot_of(s_pose) @ rot_of(s_rest[sb]).inverted()
                m = r_delta @ rot_of(rest)
                m.translation = base.translation
                if name == tgt_pelvis:
                    d = (s_pose.translation - s_rest[sb].translation) * height_scale
                    if not KEEP_HIPS_XZ: d.x = 0; d.y = 0
                    m.translation = rest.translation + d
                desired[name] = m
            else:
                desired[name] = base

        # world -> armature space -> matrix_basis, parent-first
        Twi = Tw.inverted()
        pose_arm = {n: Twi @ m for n, m in desired.items()}
        for b in order:
            name = b.name; pb = tgt.pose.bones[name]
            if b.parent is None:
                basis = b.matrix_local.inverted() @ pose_arm[name]
            else:
                par = b.parent.name
                basis = (b.parent.matrix_local.inverted() @ b.matrix_local).inverted() @ pose_arm[par].inverted() @ pose_arm[name]
            pb.matrix_basis = basis
            if name in inv_map or name == tgt_pelvis:
                pb.keyframe_insert("rotation_quaternion", frame=f - f0)
                if name == tgt_pelvis:
                    pb.keyframe_insert("location", frame=f - f0)
    tgt.animation_data.action = None
    return act, (f1 - f0) / 30.0

def check_retarget(src, tgt, src_action, tgt_action):
    """Compare normalised end-effector positions (relative to hips) between rigs at mid-clip."""
    scene = bpy.context.scene
    f0, f1 = (int(round(x)) for x in src_action.frame_range)
    f = (f0 + f1) // 2
    src.animation_data.action = src_action; scene.frame_set(f)
    def rel(arm, bone, hips, h):
        return ((arm.matrix_world @ arm.pose.bones[bone].matrix).translation - (arm.matrix_world @ arm.pose.bones[hips].matrix).translation) / h
    sh = (src.matrix_world @ src.data.bones["mixamorig:Head"].matrix_local).translation.z
    th = (tgt.matrix_world @ tgt.data.bones["Head"].matrix_local).translation.z
    pairs = [(s, t) for s, t in [("mixamorig:LeftHand", "hand_l"), ("mixamorig:RightFoot", "foot_r"), ("mixamorig:Head", "Head")] if s in src.pose.bones]
    s_vals = {t: rel(src, s, "mixamorig:Hips", sh) for s, t in pairs}
    src.animation_data.action = None
    ensure_slot(tgt, tgt_action); scene.frame_set(f - f0)
    errs = []
    for s, t in pairs:
        tv = rel(tgt, t, "pelvis", th)
        errs.append((t, round((tv - s_vals[t]).length, 3)))
    tgt.animation_data.action = None
    return errs

# ----------------------------------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps = 30

tgt, tgt_objs, ual1_acts = import_glb(UAL1)
tgt.name = "Universal"
log(f"target rig: {len(tgt.data.bones)} bones, UAL1 actions: {len(ual1_acts)}")

ual2_arm, ual2_objs, ual2_acts = import_glb(UAL2)
log(f"UAL2 actions: {len(ual2_acts)}")

export_actions = []  # (name, action, loop)
for clip, out in UAL1_CLIPS.items():
    a = find_action(ual1_acts, clip)
    if a: export_actions.append((out, a, out.endswith("_loop") or out in ("idle", "walk", "jog", "sprint", "dance")))
    else: log("MISSING UAL1 clip", clip)
for clip, out in UAL2_CLIPS.items():
    a = find_action(ual2_acts, clip)
    if a: export_actions.append((out, a, out.endswith("_loop")))
    else: log("MISSING UAL2 clip", clip)
delete_objects(ual2_objs)

# Mixamo
report = []
for clip, out in MIXAMO_CLIPS.items():
    path = os.path.join(MIXAMO_DIR, clip + ".fbx")
    if not os.path.exists(path): log("MISSING mixamo", path); continue
    before = set(bpy.data.objects); acts_before = set(bpy.data.actions)
    # hands are leaf bones on Mixamo's 25-bone LOD -> must not ignore leaves
    bpy.ops.import_scene.fbx(filepath=path, ignore_leaf_bones=False, automatic_bone_orientation=False)
    objs = [o for o in bpy.data.objects if o not in before]
    src = next(o for o in objs if o.type == "ARMATURE")
    src_act = next(a for a in bpy.data.actions if a not in acts_before)
    missing = [k for k in BONE_MAP if k not in src.data.bones]
    if missing: log("mixamo rig missing bones:", missing)
    act, dur = retarget(src, tgt, src_act, out)
    errs = check_retarget(src, tgt, src_act, act) if CHECK else []
    report.append((out, dur, errs))
    export_actions.append((out, act, out in LOOPS))
    delete_objects(objs)
    bpy.data.actions.remove(src_act)
    log(f"retargeted {clip} -> {out} ({dur:.2f}s) {errs}")

# animation-only export: drop meshes, keep the armature
delete_objects([o for o in bpy.data.objects if o.type == "MESH"])

# NLA tracks -> one glTF animation per track
tgt.animation_data_create()
tgt.animation_data.action = None
for tr in list(tgt.animation_data.nla_tracks): tgt.animation_data.nla_tracks.remove(tr)
for name, act, _loop in export_actions:
    tr = tgt.animation_data.nla_tracks.new(); tr.name = name
    strip = tr.strips.new(name, 0, act)
    if hasattr(strip, "action_slot") and hasattr(act, "slots") and len(act.slots):
        try: strip.action_slot = act.slots[0]
        except Exception: pass
    tr.mute = True

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.object.select_all(action="DESELECT")
tgt.select_set(True); bpy.context.view_layer.objects.active = tgt
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format="GLB", use_selection=True, export_yup=True,
    export_animations=True, export_animation_mode="NLA_TRACKS", export_frame_range=False,
    export_optimize_animation_size=True, export_anim_slide_to_zero=True,
    export_skins=True, export_def_bones=False, export_materials="NONE", export_lights=False, export_cameras=False,
)
log(f"wrote {OUT} ({os.path.getsize(OUT)//1024} KB) with {len(export_actions)} clips")
log("clips:", ", ".join(n for n, _, _ in export_actions))
