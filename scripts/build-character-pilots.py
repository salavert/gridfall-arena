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
    for block in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.images):
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


def normalize_height(objects: list[bpy.types.Object], height: float = TARGET_HEIGHT) -> float:
    lo, hi = world_bounds(objects)
    measured = hi.z - lo.z
    if measured <= 0:
        raise RuntimeError('Invalid imported height')
    scale = height / measured
    roots = [obj for obj in objects if obj.parent is None]
    for root in roots:
        root.scale *= scale
    bpy.context.view_layer.update()
    lo2, _ = world_bounds(objects)
    for root in roots:
        root.location.z -= lo2.z
    bpy.context.view_layer.update()
    return scale


def flat_material(name: str, color: tuple[float, float, float, float], roughness: float = .72):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_nodes = True
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


def assign_outfit_palette(objects, *, body, accent, dark, boots):
    mats = {
        'body': flat_material('GF_Cloth_Primary', body),
        'accent': flat_material('GF_Cloth_Accent', accent),
        'dark': flat_material('GF_Cloth_Dark', dark),
        'boots': flat_material('GF_Boots', boots, .64),
    }
    for obj in mesh_objects(objects):
        name = obj.name.lower()
        chosen = mats['body']
        if any(key in name for key in ('boot', 'shoe', 'foot')):
            chosen = mats['boots']
        elif any(key in name for key in ('belt', 'glove', 'strap', 'pouch', 'acc', 'cape')):
            chosen = mats['dark']
        elif any(key in name for key in ('arm', 'shirt', 'inner', 'sleeve')):
            chosen = mats['accent']
        obj.data.materials.clear()
        obj.data.materials.append(chosen)


def retarget_outfit_to_armature(objects, rig):
    for obj in mesh_objects(objects):
        for modifier in obj.modifiers:
            if modifier.type == 'ARMATURE':
                modifier.object = rig
        obj.parent = rig


def strip_armature(objects, keep=None):
    for obj in list(objects):
        if obj.type == 'ARMATURE' and obj is not keep:
            bpy.data.objects.remove(obj, do_unlink=True)


def keep_head_region(obj: bpy.types.Object, ratio: float = .785) -> None:
    bpy.context.view_layer.objects.active = obj
    lo, hi = world_bounds([obj])
    cutoff = lo.z + (hi.z - lo.z) * ratio
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    doomed = [v for v in bm.verts if (obj.matrix_world @ v.co).z < cutoff]
    bmesh.ops.delete(bm, geom=doomed, context='VERTS')
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


def make_rigid(obj: bpy.types.Object, rig, bone_name: str) -> None:
    for modifier in list(obj.modifiers):
        if modifier.type == 'ARMATURE':
            obj.modifiers.remove(modifier)
    world = obj.matrix_world.copy()
    obj.parent = rig
    obj.parent_type = 'BONE'
    obj.parent_bone = bone_name
    obj.matrix_world = world


def extract_teen_head(base_path: Path, rig, hair_color):
    imported = import_asset(base_path)
    meshes = mesh_objects(imported)
    body = max(meshes, key=lambda obj: len(obj.data.vertices))
    keep_head_region(body)
    for obj in meshes:
        make_rigid(obj, rig, 'Head')
        if obj is body:
            for material in obj.data.materials:
                clear_texture_inputs(material, keep_base_color=True)
        else:
            for material in obj.data.materials:
                clear_texture_inputs(material, keep_base_color=True)
    strip_armature(imported)
    return meshes


def attach_hair(path: Path, rig, color):
    imported = import_asset(path)
    hair_mat = flat_material('GF_Hair', color, .82)
    for obj in mesh_objects(imported):
        make_rigid(obj, rig, 'Head')
        obj.data.materials.clear()
        obj.data.materials.append(hair_mat)
    strip_armature(imported)
    return imported


def add_blonde_streak(rig):
    mat = flat_material('GF_Carla_Streak', (0.94, 0.74, 0.39, 1), .76)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=1)
    streak = bpy.context.object
    streak.name = 'Carla_Blonde_Fringe_Streak'
    streak.scale = (0.034, 0.018, 0.105)
    # Head-bone local coordinates. The deliberately small streak remains a graphic
    # read at gameplay distance rather than becoming a floating hair plate.
    streak.location = (0.055, -0.095, 0.09)
    streak.rotation_euler = (math.radians(18), math.radians(-10), math.radians(-14))
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


def collect_actions_from_library(path: Path, wanted: tuple[str, ...]):
    imported = import_asset(path)
    actions = {action.name: action for action in bpy.data.actions if action.name in wanted}
    # Animation-library render meshes/rig are never exported.
    for obj in imported:
        bpy.data.objects.remove(obj, do_unlink=True)
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

    bpy.ops.object.camera_add(location=(2.45, -3.9, 2.15))
    camera = bpy.context.object
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
    scene.display.shading.color_type = 'MATERIAL'
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
        outfit_file = source / 'Female_Ranger.glb'
        head_file = source / 'Teen_Female_FullBody.gltf'
        hair_file = source / 'Hair_Long.glb'
        palette = dict(
            body=(.12, .23, .34, 1),
            accent=(.60, .22, .18, 1),
            dark=(.17, .10, .065, 1),
            boots=(.20, .11, .065, 1),
        )
        hair_color = (.43, .29, .16, 1)
    else:
        outfit_file = source / 'Male_Ranger.glb'
        head_file = source / 'Teen_Male_FullBody.gltf'
        hair_file = source / 'Hair_SimpleParted.glb'
        palette = dict(
            body=(.10, .24, .43, 1),
            accent=(.87, .64, .18, 1),
            dark=(.08, .095, .13, 1),
            boots=(.15, .09, .055, 1),
        )
        hair_color = (.20, .105, .055, 1)

    outfit = import_asset(outfit_file)
    rig = find_armature(outfit)
    rig.name = 'GridfallRig'
    assign_outfit_palette(outfit, **palette)

    # Head and hair are rigid attachments. This avoids silently combining
    # incompatible bind poses while still using the common UBC Head socket.
    extract_teen_head(head_file, rig, hair_color)
    attach_hair(hair_file, rig, hair_color)
    if character == 'carla':
        add_blonde_streak(rig)
        add_whip_handle(rig)
    else:
        attach_ball_preview(rig)

    # Include only the small locomotion set we actually need for the pilot.
    actions = collect_actions_from_library(
        source / 'UAL1.glb',
        ('Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop'),
    )
    stash_actions(rig, actions)
    custom_actions(rig, character)

    all_character_objects = [obj for obj in bpy.context.scene.objects]
    normalize_height(all_character_objects, TARGET_HEIGHT)

    output.mkdir(parents=True, exist_ok=True)
    # Render before export. Preview-only scene objects are removed afterwards.
    setup_preview_camera(all_character_objects, output, character)
    for obj in list(bpy.context.scene.objects):
        if obj.name.startswith(('Plane', 'Area', 'Camera')):
            bpy.data.objects.remove(obj, do_unlink=True)

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
