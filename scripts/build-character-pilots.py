#!/usr/bin/env python3
"""Build visual-only Carla/Bruno rigged pilot GLBs from pinned Quaternius CC0 sources.

This script is intended for the character-pilot GitHub Actions workflow. It does
not download anything itself. Source acquisition stays explicit in the workflow
so provenance and exact revisions are reviewable.
"""
from __future__ import annotations

import argparse
import math
from pathlib import Path
import sys

import bpy
import bmesh
from mathutils import Vector

TARGET_HEIGHT = 1.42


def reset_scene() -> None:
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.images,
        bpy.data.armatures,
        bpy.data.actions,
    ):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def imported_objects_before() -> set[str]:
    return set(bpy.data.objects.keys())


def import_asset(path: Path) -> list[bpy.types.Object]:
    before = imported_objects_before()
    bpy.ops.import_scene.gltf(filepath=str(path))
    return [obj for name, obj in bpy.data.objects.items() if name not in before]


def find_armature(objects: list[bpy.types.Object]) -> bpy.types.Object:
    armatures = [obj for obj in objects if obj.type == 'ARMATURE']
    if len(armatures) != 1:
        raise RuntimeError(f'Expected one armature, found {len(armatures)}')
    return armatures[0]


def mesh_objects(objects: list[bpy.types.Object]) -> list[bpy.types.Object]:
    return [obj for obj in objects if obj.type == 'MESH']


def world_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points = []
    for obj in objects:
        if obj.type != 'MESH':
            continue
        points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not points:
        raise RuntimeError('No mesh bounds available')
    lo = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    hi = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    return lo, hi


def normalize_rig_height(rig: bpy.types.Object, objects: list[bpy.types.Object], height: float = TARGET_HEIGHT) -> float:
    lo, hi = world_bounds(objects)
    measured = hi.z - lo.z
    if measured <= 0:
        raise RuntimeError('Invalid imported height')
    scale = height / measured
    rig.scale *= scale
    bpy.context.view_layer.update()
    lo2, _ = world_bounds(objects)
    rig.location.z -= lo2.z
    bpy.context.view_layer.update()
    return scale


def flat_material(name: str, color: tuple[float, float, float, float], roughness: float = .72):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = color
    principled = material.node_tree.nodes.get('Principled BSDF')
    principled.inputs['Base Color'].default_value = color
    principled.inputs['Roughness'].default_value = roughness
    principled.inputs['Metallic'].default_value = 0
    for node in list(material.node_tree.nodes):
        if node.type == 'TEX_IMAGE':
            material.node_tree.nodes.remove(node)
    return material


def clear_texture_inputs(material: bpy.types.Material, keep_base_color: bool = True) -> None:
    if not material or not material.use_nodes:
        return
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    principled = nodes.get('Principled BSDF')
    if principled:
        for socket_name in ('Normal', 'Roughness', 'Metallic'):
            socket = principled.inputs.get(socket_name)
            if socket and socket.is_linked:
                for link in list(socket.links):
                    links.remove(link)
        principled.inputs['Roughness'].default_value = .78
        principled.inputs['Metallic'].default_value = 0
        if not keep_base_color:
            socket = principled.inputs.get('Base Color')
            if socket and socket.is_linked:
                for link in list(socket.links):
                    links.remove(link)
    for image in list(bpy.data.images):
        if image.users == 0:
            bpy.data.images.remove(image)


def weighted_vertex_indices(obj: bpy.types.Object, group_names: tuple[str, ...], min_weight: float = .12) -> set[int]:
    wanted = {
        group.index for group in obj.vertex_groups
        if group.name in set(group_names)
    }
    if not wanted:
        return set()
    return {
        vertex.index
        for vertex in obj.data.vertices
        if any(
            assignment.group in wanted and assignment.weight >= min_weight
            for assignment in vertex.groups
        )
    }


def duplicate_weighted_region(
    source: bpy.types.Object,
    name: str,
    group_names: tuple[str, ...],
    material: bpy.types.Material,
    *,
    min_weight: float = .12,
    inflate: float = .008,
    max_height_ratio: float | None = None,
    min_height_ratio: float | None = None,
) -> bpy.types.Object:
    keep = weighted_vertex_indices(source, group_names, min_weight)
    if not keep:
        raise RuntimeError(f'{name}: no vertices matched {group_names}')

    clone = source.copy()
    clone.data = source.data.copy()
    clone.name = name
    bpy.context.collection.objects.link(clone)

    lo, hi = world_bounds([source])
    height = max(1e-6, hi.z - lo.z)

    bm = bmesh.new()
    bm.from_mesh(clone.data)
    bm.verts.ensure_lookup_table()
    bm.normal_update()

    doomed = []
    for vertex in bm.verts:
        keep_vertex = vertex.index in keep
        if keep_vertex and (min_height_ratio is not None or max_height_ratio is not None):
            world_z = (clone.matrix_world @ vertex.co).z
            ratio = (world_z - lo.z) / height
            if min_height_ratio is not None and ratio < min_height_ratio:
                keep_vertex = False
            if max_height_ratio is not None and ratio > max_height_ratio:
                keep_vertex = False
        if not keep_vertex:
            doomed.append(vertex)

    bmesh.ops.delete(bm, geom=doomed, context='VERTS')
    bm.normal_update()
    for vertex in bm.verts:
        vertex.co += vertex.normal * inflate
    bm.to_mesh(clone.data)
    bm.free()
    clone.data.update()

    clone.data.materials.clear()
    clone.data.materials.append(material)
    return clone


def style_teen_base(objects, character: str):
    meshes = mesh_objects(objects)
    body = max(meshes, key=lambda obj: len(obj.data.vertices))
    # Keep Quaternius' authored skin/eye/brow textures. The previous flat
    # material pass erased most facial information and made the pilot look
    # mannequin-like.
    for obj in meshes:
        for material in obj.data.materials:
            if not material:
                continue
            material.diffuse_color = (1, 1, 1, 1)
            if material.use_nodes:
                principled = material.node_tree.nodes.get('Principled BSDF')
                if principled:
                    principled.inputs['Roughness'].default_value = .78
                    principled.inputs['Metallic'].default_value = 0
    return body


def build_teen_clothes(body: bpy.types.Object, character: str):
    if character == 'carla':
        shirt = flat_material('GF_Carla_Shirt', (.78, .30, .22, 1), .82)
        vest = flat_material('GF_Carla_Vest', (.15, .29, .40, 1), .76)
        pants = flat_material('GF_Carla_Pants', (.20, .34, .46, 1), .82)
        boots = flat_material('GF_Carla_Boots', (.19, .105, .055, 1), .66)
    else:
        shirt = flat_material('GF_Bruno_Shirt', (.88, .66, .20, 1), .80)
        vest = flat_material('GF_Bruno_Vest', (.10, .26, .48, 1), .74)
        pants = flat_material('GF_Bruno_Pants', (.12, .21, .34, 1), .84)
        boots = flat_material('GF_Bruno_Boots', (.14, .085, .05, 1), .66)

    upper = (
        'spine_01', 'spine_02', 'spine_03',
        'clavicle_l', 'clavicle_r',
        'upperarm_l', 'upperarm_r',
        'lowerarm_l', 'lowerarm_r',
    )
    torso = ('spine_01', 'spine_02', 'spine_03', 'clavicle_l', 'clavicle_r')
    lower = ('pelvis', 'thigh_l', 'thigh_r', 'calf_l', 'calf_r')
    feet = ('calf_l', 'calf_r', 'foot_l', 'foot_r', 'ball_l', 'ball_r')

    pieces = [
        duplicate_weighted_region(
            body, f'{character.title()}_Shirt', upper, shirt,
            min_weight=.10, inflate=.006, min_height_ratio=.43,
        ),
        duplicate_weighted_region(
            body, f'{character.title()}_Vest', torso, vest,
            min_weight=.10, inflate=.016, min_height_ratio=.52, max_height_ratio=.82,
        ),
        duplicate_weighted_region(
            body, f'{character.title()}_Pants', lower, pants,
            min_weight=.10, inflate=.009, min_height_ratio=.15, max_height_ratio=.58,
        ),
        duplicate_weighted_region(
            body, f'{character.title()}_Boots', feet, boots,
            min_weight=.10, inflate=.014, max_height_ratio=.28,
        ),
    ]
    return pieces


def bone_depth(pose_bone) -> int:
    depth = 0
    parent = pose_bone.parent
    while parent is not None:
        depth += 1
        parent = parent.parent
    return depth


def pose_outfit_rig_to_target_bind(source_rig, target_rig) -> None:
    source_rig.data.pose_position = 'POSE'
    target_rig.data.pose_position = 'REST'
    for pose_bone in sorted(source_rig.pose.bones, key=bone_depth):
        target_bone = target_rig.data.bones.get(pose_bone.name)
        if target_bone is None:
            continue
        # PoseBone.matrix is armature-space. Matching it to the target's bind
        # matrix lets Blender's existing Armature modifier perform the exact
        # weighted adult→Teen bind-space reprojection for us.
        pose_bone.matrix = target_bone.matrix_local.copy()
        bpy.context.view_layer.update()


def outfit_piece_key(name: str) -> str | None:
    lower = name.lower()
    if 'peasant_body' in lower:
        return 'body'
    if 'peasant_arms' in lower:
        return 'arms'
    if 'peasant_legs' in lower:
        return 'legs'
    if 'peasant_feet' in lower or 'peasant_boot' in lower:
        return 'feet'
    return None


def retarget_peasant_outfit(path: Path, target_rig, character: str):
    imported = import_asset(path)
    source_rig = find_armature(imported)
    pose_outfit_rig_to_target_bind(source_rig, target_rig)
    depsgraph = bpy.context.evaluated_depsgraph_get()

    if character == 'carla':
        palette = {
            'body': flat_material('GF_Carla_Jacket', (.20, .34, .43, 1), .78),
            'arms': flat_material('GF_Carla_Sleeves', (.76, .30, .23, 1), .82),
            'legs': flat_material('GF_Carla_Jeans', (.18, .31, .43, 1), .84),
            'feet': flat_material('GF_Carla_Boots', (.19, .105, .055, 1), .66),
        }
    else:
        palette = {
            'body': flat_material('GF_Bruno_Vest', (.10, .28, .50, 1), .76),
            'arms': flat_material('GF_Bruno_Shirt', (.88, .66, .20, 1), .82),
            'legs': flat_material('GF_Bruno_Pants', (.13, .23, .36, 1), .84),
            'feet': flat_material('GF_Bruno_Boots', (.14, .085, .05, 1), .66),
        }

    result = []
    for source in mesh_objects(imported):
        piece = outfit_piece_key(source.name)
        if piece is None:
            continue

        evaluated = source.evaluated_get(depsgraph)
        baked_mesh = bpy.data.meshes.new_from_object(
            evaluated,
            preserve_all_data_layers=True,
            depsgraph=depsgraph,
        )
        baked_mesh.name = f'{character.title()}_{piece.title()}_TeenFit'

        clone = source.copy()
        clone.data = baked_mesh
        clone.name = baked_mesh.name
        bpy.context.collection.objects.link(clone)

        # Keep source vertex groups (topology is unchanged by the armature
        # modifier), but replace the source-rig modifier with the Teen rig.
        for modifier in list(clone.modifiers):
            clone.modifiers.remove(modifier)

        source_relative = source_rig.matrix_world.inverted() @ source.matrix_world
        clone.parent = target_rig
        clone.matrix_world = target_rig.matrix_world @ source_relative

        modifier = clone.modifiers.new('GridfallTeenRig', 'ARMATURE')
        modifier.object = target_rig
        clone.data.materials.clear()
        clone.data.materials.append(palette[piece])
        result.append(clone)

    # Remove every source outfit object and its adult rig after baking.
    for obj in imported:
        if obj.name in bpy.data.objects:
            bpy.data.objects.remove(obj, do_unlink=True)

    if len(result) < 4:
        raise RuntimeError(
            f'Expected Peasant body/arms/legs/feet, baked {len(result)} pieces'
        )
    return result


def keep_exposed_teen_skin(body: bpy.types.Object) -> None:
    # Full Peasant clothing covers the torso and legs. Keep only head/neck and
    # hands from the Teen body to avoid z-fighting and to reduce duplicate
    # geometry while retaining the authored face.
    exposed = {
        'Head', 'neck_01', 'hand_l', 'hand_r',
        'thumb_01_l', 'thumb_02_l', 'thumb_03_l', 'thumb_04_leaf_l',
        'index_01_l', 'index_02_l', 'index_03_l', 'index_04_leaf_l',
        'middle_01_l', 'middle_02_l', 'middle_03_l', 'middle_04_leaf_l',
        'ring_01_l', 'ring_02_l', 'ring_03_l', 'ring_04_leaf_l',
        'pinky_01_l', 'pinky_02_l', 'pinky_03_l', 'pinky_04_leaf_l',
        'thumb_01_r', 'thumb_02_r', 'thumb_03_r', 'thumb_04_leaf_r',
        'index_01_r', 'index_02_r', 'index_03_r', 'index_04_leaf_r',
        'middle_01_r', 'middle_02_r', 'middle_03_r', 'middle_04_leaf_r',
        'ring_01_r', 'ring_02_r', 'ring_03_r', 'ring_04_leaf_r',
        'pinky_01_r', 'pinky_02_r', 'pinky_03_r', 'pinky_04_leaf_r',
    }
    group_ids = {
        group.index for group in body.vertex_groups
        if group.name in exposed
    }
    bm = bmesh.new()
    bm.from_mesh(body.data)
    bm.verts.ensure_lookup_table()
    doomed = []
    for vertex in bm.verts:
        source_vertex = body.data.vertices[vertex.index]
        keep = any(
            assignment.group in group_ids and assignment.weight >= .08
            for assignment in source_vertex.groups
        )
        if not keep:
            doomed.append(vertex)
    bmesh.ops.delete(bm, geom=doomed, context='VERTS')
    bm.to_mesh(body.data)
    bm.free()
    body.data.update()


def weighted_region_bounds(obj: bpy.types.Object, group_names: tuple[str, ...]):
    group_ids = {
        group.index for group in obj.vertex_groups
        if group.name in set(group_names)
    }
    points = []
    for vertex in obj.data.vertices:
        if any(
            assignment.group in group_ids and assignment.weight >= .15
            for assignment in vertex.groups
        ):
            points.append(obj.matrix_world @ vertex.co)
    if not points:
        return None
    lo = Vector((
        min(point.x for point in points),
        min(point.y for point in points),
        min(point.z for point in points),
    ))
    hi = Vector((
        max(point.x for point in points),
        max(point.y for point in points),
        max(point.z for point in points),
    ))
    return lo, hi


def strip_armature(objects, keep=None):
    for obj in list(objects):
        if obj.type == 'ARMATURE' and obj is not keep:
            bpy.data.objects.remove(obj, do_unlink=True)


def make_rigid(obj: bpy.types.Object, rig, bone_name: str) -> None:
    for modifier in list(obj.modifiers):
        if modifier.type == 'ARMATURE':
            obj.modifiers.remove(modifier)
    world = obj.matrix_world.copy()
    obj.parent = rig
    obj.parent_type = 'BONE'
    obj.parent_bone = bone_name
    obj.matrix_world = world


def attach_hair(path: Path, rig, body, color, *, fullness: float = 1.12):
    imported = import_asset(path)
    source_rig = find_armature(imported)
    source_bone = source_rig.data.bones.get('Head')
    target_bone = rig.data.bones.get('Head')
    if not source_bone or not target_bone:
        raise RuntimeError('Hair asset and target rig both need a Head bone')

    source_head_world = source_rig.matrix_world @ source_bone.matrix_local
    target_head_world = rig.matrix_world @ target_bone.matrix_local
    align = target_head_world @ source_head_world.inverted()

    hair_mat = flat_material('GF_Hair', color, .82)
    result = []
    for obj in mesh_objects(imported):
        obj.matrix_world = align @ obj.matrix_world
        result.append(obj)

    head_bounds = weighted_region_bounds(body, ('Head', 'neck_01'))
    if head_bounds and result:
        head_lo, head_hi = head_bounds
        hair_lo, hair_hi = world_bounds(result)
        head_center = (head_lo + head_hi) * .5
        hair_center = (hair_lo + hair_hi) * .5
        head_width = max(.001, head_hi.x - head_lo.x)
        hair_width = max(.001, hair_hi.x - hair_lo.x)
        fit = max(.62, min(1.08, (head_width * fullness) / hair_width))

        desired = head_center.copy()
        desired.z += (head_hi.z - head_lo.z) * .10
        for obj in result:
            world = obj.matrix_world.copy()
            world.translation = desired + (world.translation - hair_center) * fit
            obj.matrix_world = world
            obj.scale *= fit

    for obj in result:
        make_rigid(obj, rig, 'Head')
        obj.data.materials.clear()
        obj.data.materials.append(hair_mat)

    strip_armature(imported, keep=rig)
    return result


def add_blonde_streak(rig):
    mat = flat_material('GF_Carla_Streak', (0.95, 0.76, 0.43, 1), .78)
    curve = bpy.data.curves.new('Carla_Blonde_Fringe_Curve', type='CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 2
    curve.bevel_depth = .008
    curve.bevel_resolution = 2
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(2)
    for point, co in zip(
        spline.bezier_points,
        ((.035, -.102, .105), (.054, -.119, .045), (.040, -.105, -.015)),
    ):
        point.co = co
        point.handle_left_type = 'AUTO'
        point.handle_right_type = 'AUTO'

    streak = bpy.data.objects.new('Carla_Blonde_Fringe_Streak', curve)
    bpy.context.collection.objects.link(streak)
    streak.data.materials.append(mat)
    streak.parent = rig
    streak.parent_type = 'BONE'
    streak.parent_bone = 'Head'


def add_whip_handle(rig):
    wood = flat_material('GF_Whip_Handle', (0.22, 0.09, 0.035, 1), .62)
    metal = flat_material('GF_Whip_Collar', (0.36, 0.32, 0.26, 1), .35)
    for radius, depth, z, material in ((.025, .19, .095, wood), (.034, .035, .19, metal)):
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=radius, depth=depth)
        obj = bpy.context.object
        obj.name = 'Carla_Whip_Handle'
        obj.data.materials.append(material)
        obj.parent = rig
        obj.parent_type = 'BONE'
        obj.parent_bone = 'hand_r'
        obj.location = (0, -.025, z)
        obj.rotation_euler = (math.radians(90), 0, 0)


def create_soccer_ball() -> bpy.types.Object:
    white = flat_material('GF_Ball_White', (0.9, 0.9, 0.84, 1), .72)
    dark = flat_material('GF_Ball_Dark', (0.025, 0.03, 0.04, 1), .68)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=.095)
    ball = bpy.context.object
    ball.name = 'Bruno_Soccer_Ball_Preview'
    ball.data.materials.append(white)
    # A small dark patch creates a soccer read without expensive texturing.
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=.035)
    patch = bpy.context.object
    patch.name = 'Bruno_Ball_Patch'
    patch.data.materials.append(dark)
    patch.location = (.0, -.083, .035)
    patch.parent = ball
    return ball


def attach_ball_preview(rig):
    ball = create_soccer_ball()
    ball.parent = rig
    ball.parent_type = 'BONE'
    ball.parent_bone = 'hand_l'
    ball.location = (0, -.09, -.07)


def canonical_action_name(name: str) -> str:
    # Blender's glTF importer changes Quaternius action names depending on
    # importer/version. Observed forms include:
    #   Armature|Armature|Idle_Loop
    #   Idle_Loop_Armature
    #   Idle_Loop_Armature.001
    # Three.js exposes the canonical GLB clip name, so collapse every Blender
    # variant back to the semantic final clip name.
    canonical = name.split('|')[-1].strip()
    if len(canonical) > 4 and canonical[-4] == '.' and canonical[-3:].isdigit():
        canonical = canonical[:-4]
    if canonical.endswith('_Armature'):
        canonical = canonical[:-len('_Armature')]
    return canonical or name


def collect_actions_from_library(path: Path, wanted: tuple[str, ...]):
    before_actions = set(bpy.data.actions.keys())
    imported = import_asset(path)
    imported_actions = [
        action for name, action in bpy.data.actions.items()
        if name not in before_actions
    ]

    actions = {}
    for action in imported_actions:
        canonical = canonical_action_name(action.name)
        if canonical in wanted and canonical not in actions:
            action.name = canonical
            actions[canonical] = action

    missing = [name for name in wanted if name not in actions]
    if missing:
        available = sorted(canonical_action_name(action.name) for action in imported_actions)
        raise RuntimeError(
            f'Animation library is missing required clips: {missing}; '
            f'available clips: {available}'
        )

    # Animation-library render meshes/rig are never exported.
    for obj in imported:
        bpy.data.objects.remove(obj, do_unlink=True)

    # Do not let the full Universal Animation Library leak into the shipping
    # pilot. Keep only the small locomotion subset referenced by NLA tracks.
    keep = set(actions.values())
    for action in imported_actions:
        if action not in keep:
            bpy.data.actions.remove(action)

    return actions


def stash_actions(rig, actions: dict[str, bpy.types.Action]):
    if not actions:
        return
    rig.animation_data_create()
    rig.animation_data.action = None
    for name, action in actions.items():
        track = rig.animation_data.nla_tracks.new()
        track.name = name
        start = int(action.frame_range[0])
        strip = track.strips.new(name, start, action)
        strip.action_frame_start = action.frame_range[0]
        strip.action_frame_end = action.frame_range[1]


def set_preview_pose(rig, name: str = 'Idle_Loop') -> None:
    if not rig.animation_data:
        return
    chosen = None
    for track in rig.animation_data.nla_tracks:
        track.mute = track.name != name
        if track.name == name:
            chosen = track
    if chosen and chosen.strips:
        strip = chosen.strips[0]
        frame = int(min(strip.frame_end - 1, strip.frame_start + 10))
        bpy.context.scene.frame_set(max(int(strip.frame_start), frame))


def restore_export_tracks(rig) -> None:
    if rig.animation_data:
        for track in rig.animation_data.nla_tracks:
            track.mute = False
    bpy.context.scene.frame_set(0)


def author_action(rig, name: str, keys: list[tuple[int, dict[str, tuple[float, float, float]]]]):
    action = bpy.data.actions.new(name)
    rig.animation_data_create()
    rig.animation_data.action = action
    touched = set()
    for frame, bone_values in keys:
        for bone_name, angles in bone_values.items():
            bone = rig.pose.bones.get(bone_name)
            if not bone:
                continue
            touched.add(bone_name)
            bone.rotation_mode = 'XYZ'
            bone.rotation_euler = tuple(math.radians(v) for v in angles)
            bone.keyframe_insert('rotation_euler', frame=frame, group=bone_name)
    for bone_name in touched:
        bone = rig.pose.bones[bone_name]
        bone.rotation_euler = (0, 0, 0)
    rig.animation_data.action = None
    track = rig.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, keys[0][0], action)
    return action


def custom_actions(rig, character: str):
    if character == 'carla':
        author_action(rig, 'attack_whip', [
            (1, {'spine_02': (0, 0, 0), 'upperarm_r': (0, 0, 0), 'lowerarm_r': (0, 0, 0)}),
            (6, {'spine_02': (0, 0, -15), 'upperarm_r': (-28, 8, -42), 'lowerarm_r': (-35, 0, 0)}),
            (11, {'spine_02': (0, 0, 18), 'upperarm_r': (45, -12, 52), 'lowerarm_r': (22, 0, 0)}),
            (18, {'spine_02': (0, 0, 0), 'upperarm_r': (0, 0, 0), 'lowerarm_r': (0, 0, 0)}),
        ])
        author_action(rig, 'super_collie_command', [
            (1, {'spine_02': (0, 0, 0), 'upperarm_l': (0, 0, 0)}),
            (8, {'spine_02': (-7, 0, 8), 'upperarm_l': (12, -28, -64), 'lowerarm_l': (-22, 0, 0)}),
            (22, {'spine_02': (-7, 0, 8), 'upperarm_l': (12, -28, -64), 'lowerarm_l': (-22, 0, 0)}),
            (30, {'spine_02': (0, 0, 0), 'upperarm_l': (0, 0, 0), 'lowerarm_l': (0, 0, 0)}),
        ])
    else:
        author_action(rig, 'attack_kick', [
            (1, {'spine_02': (0, 0, 0), 'thigh_r': (0, 0, 0), 'calf_r': (0, 0, 0)}),
            (7, {'spine_02': (9, 0, -8), 'thigh_r': (-42, 0, 2), 'calf_r': (54, 0, 0)}),
            (12, {'spine_02': (-8, 0, 10), 'thigh_r': (54, 0, -4), 'calf_r': (-8, 0, 0)}),
            (20, {'spine_02': (0, 0, 0), 'thigh_r': (0, 0, 0), 'calf_r': (0, 0, 0)}),
        ])
        author_action(rig, 'super_power_kick', [
            (1, {'spine_02': (0, 0, 0), 'thigh_r': (0, 0, 0), 'calf_r': (0, 0, 0)}),
            (10, {'spine_02': (15, 0, -15), 'thigh_r': (-58, 0, 4), 'calf_r': (68, 0, 0)}),
            (17, {'spine_02': (-15, 0, 16), 'thigh_r': (78, 0, -5), 'calf_r': (-15, 0, 0)}),
            (30, {'spine_02': (0, 0, 0), 'thigh_r': (0, 0, 0), 'calf_r': (0, 0, 0)}),
        ])


def setup_preview_camera(character_objects, output: Path, name: str):
    bpy.ops.object.select_all(action='DESELECT')
    lo, hi = world_bounds(character_objects)
    center = (lo + hi) * .5
    center.z = lo.z + (hi.z - lo.z) * .55

    bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, 0))
    floor = bpy.context.object
    floor.data.materials.append(flat_material('GF_Preview_Ground', (.055, .065, .08, 1), .9))

    bpy.ops.object.light_add(type='AREA', location=(2.8, -3.6, 4.1))
    key = bpy.context.object
    key.data.energy = 950
    key.data.shape = 'DISK'
    key.data.size = 4.2

    bpy.ops.object.light_add(type='AREA', location=(-3.2, -1.4, 2.4))
    fill = bpy.context.object
    fill.data.energy = 500
    fill.data.size = 3.2

    bpy.ops.object.light_add(type='AREA', location=(1.0, 2.8, 3.2))
    rim = bpy.context.object
    rim.data.energy = 650
    rim.data.size = 2.6

    bpy.ops.object.camera_add(location=(2.0, -3.0, 1.65))
    camera = bpy.context.object
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = 1.72
    bpy.context.scene.camera = camera

    def look_at(obj, target):
        direction = target - obj.location
        obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

    look_at(camera, center)
    for light in (key, fill, rim):
        look_at(light, center)

    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'TEXTURE'
    scene.display.shading.show_shadows = True
    scene.display.shading.show_cavity = True
    scene.display.shading.cavity_type = 'BOTH'
    scene.render.resolution_x = 384
    scene.render.resolution_y = 384
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = str(output / f'{name}-preview.png')
    scene.render.film_transparent = False
    scene.world.color = (.015, .02, .035)
    scene.view_settings.look = 'AgX - Medium High Contrast'
    bpy.ops.render.render(write_still=True)


def build_character(source: Path, output: Path, character: str):
    reset_scene()
    if character == 'carla':
        base_file = source / 'Teen_Female_FullBody.gltf'
        outfit_file = source / 'Female_Peasant.glb'
        hair_file = source / 'Hair_Long.glb'
        hair_color = (.55, .40, .23, 1)
        hair_fullness = 1.13
    else:
        base_file = source / 'Teen_Male_FullBody.gltf'
        outfit_file = source / 'Male_Peasant.glb'
        hair_file = source / 'Hair_SimpleParted.glb'
        hair_color = (.20, .105, .055, 1)
        hair_fullness = 1.10

    base = import_asset(base_file)
    rig = find_armature(base)
    rig.name = 'GridfallRig'
    body = style_teen_base(base, character)

    # Reproject authored Peasant clothing to the Teen bind pose instead of
    # wearing an adult rig or generating skin-tight clothing from the body.
    outfit = retarget_peasant_outfit(outfit_file, rig, character)
    hair = attach_hair(
        hair_file,
        rig,
        body,
        hair_color,
        fullness=hair_fullness,
    )

    # Normalize while the complete Teen body still provides canonical bounds.
    rig.data.pose_position = 'REST'
    bpy.context.view_layer.update()
    normalize_rig_height(rig, [body], TARGET_HEIGHT)

    keep_exposed_teen_skin(body)

    if character == 'carla':
        add_blonde_streak(rig)
        add_whip_handle(rig)
    else:
        attach_ball_preview(rig)

    actions = collect_actions_from_library(
        source / 'UAL1.glb',
        ('Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop'),
    )
    stash_actions(rig, actions)
    custom_actions(rig, character)
    rig.data.pose_position = 'POSE'
    set_preview_pose(rig)

    character_meshes = [
        obj for obj in bpy.context.scene.objects
        if obj.type == 'MESH' and not obj.name.startswith(('Plane', 'Area', 'Camera'))
    ]

    output.mkdir(parents=True, exist_ok=True)
    setup_preview_camera(character_meshes, output, character)
    for obj in list(bpy.context.scene.objects):
        if obj.name.startswith(('Plane', 'Area', 'Camera')):
            bpy.data.objects.remove(obj, do_unlink=True)

    restore_export_tracks(rig)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(
        filepath=str(output / f'{character}-pilot.glb'),
        export_format='GLB',
        export_yup=True,
        export_animations=True,
        export_nla_strips=True,
        export_apply=False,
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-dir', type=Path, required=True)
    parser.add_argument('--output-dir', type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    for character in ('carla', 'bruno'):
        build_character(args.source_dir, args.output_dir, character)


if __name__ == '__main__':
    main()
