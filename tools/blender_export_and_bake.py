"""Blender-side exporter/baker for Everglen 3D assets.

Run with Blender 4.5+:
  blender -b --python tools/blender_export_and_bake.py -- \
    --source "Mediavel Pack (2).blend" --output-dir build/everglen_3d

The script opens/imports Blend/FBX/OBJ sources, isolates mesh objects, renders
8 transparent orthographic views, and exports a GLB intermediate for every
asset. tools/pack_3d_atlas.py then builds the runtime mega atlas.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import bpy
from mathutils import Vector


def blender_args():
    raw = bpy.app.arguments
    return raw[raw.index("--") + 1:] if "--" in raw else []


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--cell", type=int, default=96)
    parser.add_argument("--frames", type=int, default=8)
    parser.add_argument("--max-assets", type=int, default=512)
    return parser.parse_args(blender_args())


def safe_name(name):
    value = re.sub(r"[^a-zA-Z0-9_-]+", "_", name).strip("_").lower()
    return value[:64] or "asset"


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def load_source(source: Path):
    suffix = source.suffix.lower()
    if suffix == ".blend":
        bpy.ops.wm.open_mainfile(filepath=str(source))
    elif suffix == ".fbx":
        clear_scene()
        bpy.ops.import_scene.fbx(filepath=str(source), use_image_search=True)
    elif suffix == ".obj":
        clear_scene()
        bpy.ops.wm.obj_import(filepath=str(source))
    else:
        raise RuntimeError(f"Unsupported 3D source: {suffix}")


def bbox(obj):
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    low = Vector((min(v.x for v in corners), min(v.y for v in corners), min(v.z for v in corners)))
    high = Vector((max(v.x for v in corners), max(v.y for v in corners), max(v.z for v in corners)))
    return low, high


def point_camera(camera, target):
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()


def ensure_camera(scene):
    camera = bpy.data.objects.get("EverglenBakeCamera")
    if camera is None:
        data = bpy.data.cameras.new("EverglenBakeCamera")
        camera = bpy.data.objects.new("EverglenBakeCamera", data)
        scene.collection.objects.link(camera)
    camera.data.type = "ORTHO"
    scene.camera = camera
    return camera


def ensure_lights(scene):
    for obj in list(scene.objects):
        if obj.type == "LIGHT" and obj.name.startswith("EverglenBake"):
            bpy.data.objects.remove(obj, do_unlink=True)

    key_data = bpy.data.lights.new("EverglenBakeKey", "AREA")
    key_data.energy = 700
    key_data.shape = "DISK"
    key_data.size = 5
    key = bpy.data.objects.new("EverglenBakeKey", key_data)
    scene.collection.objects.link(key)
    key.location = (4, -6, 8)

    fill_data = bpy.data.lights.new("EverglenBakeFill", "AREA")
    fill_data.energy = 350
    fill_data.size = 6
    fill = bpy.data.objects.new("EverglenBakeFill", fill_data)
    scene.collection.objects.link(fill)
    fill.location = (-5, 2, 5)


def main():
    args = parse_args()
    source = Path(args.source).resolve()
    output = Path(args.output_dir).resolve()
    frame_root = output / "frames"
    frame_root.mkdir(parents=True, exist_ok=True)

    load_source(source)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = args.cell
    scene.render.resolution_y = args.cell
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = True

    camera = ensure_camera(scene)
    ensure_lights(scene)
    meshes = [obj for obj in scene.objects if obj.type == "MESH" and len(obj.data.vertices) > 0]
    meshes = meshes[:args.max_assets]
    catalog = []

    for index, obj in enumerate(meshes):
        asset_id = f"{index:04d}_{safe_name(obj.name)}"
        asset_dir = frame_root / asset_id
        asset_dir.mkdir(parents=True, exist_ok=True)
        low, high = bbox(obj)
        center = (low + high) / 2
        extent = high - low
        radius = max(float(max(extent)) * 0.62, 0.5)

        for other in meshes:
            other.hide_render = other != obj

        camera.data.ortho_scale = radius * 2.2
        for frame in range(args.frames):
            angle = frame * 2.0 * 3.141592653589793 / args.frames
            camera.location = (
                center.x + radius * 2.6 * __import__("math").cos(angle),
                center.y + radius * 2.6 * __import__("math").sin(angle),
                center.z + radius * 2.0,
            )
            point_camera(camera, center)
            target = asset_dir / f"{frame:02d}.png"
            scene.render.filepath = str(target)
            bpy.ops.render.render(write_still=True)

        for other in meshes:
            other.select_set(False)
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        glb = output / f"{asset_id}.glb"
        try:
            bpy.ops.export_scene.gltf(filepath=str(glb), export_format="GLB", use_selection=True)
        except Exception:
            glb = None

        catalog.append({
            "id": asset_id,
            "name": obj.name,
            "frames": [str((asset_dir / f"{i:02d}.png").relative_to(output)) for i in range(args.frames)],
            "glb": str(glb.relative_to(output)) if glb else None,
        })

    (output / "export_manifest.json").write_text(json.dumps({
        "version": 1,
        "source": source.name,
        "cell": args.cell,
        "frames": args.frames,
        "assets": catalog,
    }, indent=2))
    print(json.dumps({"source": source.name, "assets": len(catalog), "output": str(output)}))


if __name__ == "__main__":
    main()
