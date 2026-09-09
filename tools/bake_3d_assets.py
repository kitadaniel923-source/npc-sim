"""Bake supplied 3D sources into small transparent runtime atlases for Everglen.

Supported directly in this environment:
  - OBJ and STL through trimesh + VTK off-screen rendering.

When Blender is installed, .blend and .fbx sources should be exported to OBJ/GLB
first, then passed through this baker. The runtime remains 2D and never needs a
3D engine just to display a baked asset.

Example:
  python tools/bake_3d_assets.py --input "Mediavel Pack(1).obj" --output assets/everglen/medieval_3d_atlas.webp
"""
from __future__ import annotations

import argparse
import math
from pathlib import Path

import numpy as np
import trimesh
from PIL import Image
import vtk
from vtk.util.numpy_support import vtk_to_numpy


def render(mesh: trimesh.Trimesh, angle: float, size: int = 64) -> Image.Image:
    vertices = np.asarray(mesh.vertices)
    faces = np.asarray(mesh.faces)
    center = (mesh.bounds[0] + mesh.bounds[1]) / 2.0
    extent = mesh.bounds[1] - mesh.bounds[0]
    radius = max(float(np.linalg.norm(extent) / 2.0), 1.0)

    points = vtk.vtkPoints()
    points.SetNumberOfPoints(len(vertices))
    for i, point in enumerate(vertices):
        points.SetPoint(i, float(point[0]), float(point[1]), float(point[2]))

    cells = vtk.vtkCellArray()
    for face in faces:
        triangle = vtk.vtkTriangle()
        for j, vertex in enumerate(face):
            triangle.GetPointIds().SetId(j, int(vertex))
        cells.InsertNextCell(triangle)

    poly = vtk.vtkPolyData()
    poly.SetPoints(points)
    poly.SetPolys(cells)

    mapper = vtk.vtkPolyDataMapper()
    mapper.SetInputData(poly)

    actor = vtk.vtkActor()
    actor.SetMapper(mapper)
    actor.SetPosition(-float(center[0]), -float(center[1]), -float(center[2]))
    actor.GetProperty().SetColor(0.55, 0.42, 0.22)
    actor.GetProperty().SetAmbient(0.40)
    actor.GetProperty().SetDiffuse(0.65)
    actor.GetProperty().SetSpecular(0.05)

    renderer = vtk.vtkRenderer()
    renderer.SetBackground(0, 0, 0)
    renderer.SetBackgroundAlpha(0)
    renderer.AddActor(actor)

    camera = renderer.GetActiveCamera()
    distance = radius * 4.0
    camera.SetPosition(distance * math.cos(angle), distance * math.sin(angle), distance * 0.75)
    camera.SetFocalPoint(0, 0, 0)
    camera.SetViewUp(0, 0, 1)
    camera.SetParallelProjection(1)
    camera.SetParallelScale(radius * 1.25)

    window = vtk.vtkRenderWindow()
    window.SetOffScreenRendering(1)
    window.SetAlphaBitPlanes(1)
    window.SetSize(size, size)
    window.AddRenderer(renderer)
    window.Render()

    capture = vtk.vtkWindowToImageFilter()
    capture.SetInput(window)
    capture.SetInputBufferTypeToRGBA()
    capture.ReadFrontBufferOff()
    capture.Update()
    output = capture.GetOutput()
    dimensions = output.GetDimensions()
    rgba = vtk_to_numpy(output.GetPointData().GetScalars()).reshape(dimensions[1], dimensions[0], 4)
    return Image.fromarray(rgba, "RGBA").transpose(Image.Transpose.FLIP_TOP_BOTTOM)


def load_mesh(path: Path) -> trimesh.Trimesh:
    scene = trimesh.load(path, force="scene")
    if isinstance(scene, trimesh.Trimesh):
        return scene
    meshes = [geometry for geometry in scene.geometry.values() if isinstance(geometry, trimesh.Trimesh)]
    if not meshes:
        raise RuntimeError(f"No mesh geometry found in {path}")
    return trimesh.util.concatenate(meshes)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--frames", type=int, default=8)
    parser.add_argument("--cell", type=int, default=64)
    args = parser.parse_args()

    source = Path(args.input)
    output = Path(args.output)
    suffix = source.suffix.lower()
    if suffix in {".blend", ".fbx"}:
        raise SystemExit(".blend/.fbx require a Blender export step before baking; export OBJ or GLB, then rerun this baker.")
    if suffix not in {".obj", ".stl"}:
        raise SystemExit(f"Unsupported 3D source: {suffix}")

    mesh = load_mesh(source)
    atlas = Image.new("RGBA", (args.frames * args.cell, args.cell), (0, 0, 0, 0))
    for index in range(args.frames):
        atlas.paste(render(mesh, index * 2.0 * math.pi / args.frames, args.cell), (index * args.cell, 0))

    output.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(output, format="WEBP", quality=90, method=6)
    print(f"baked {args.frames} frames -> {output}")


if __name__ == "__main__":
    main()
