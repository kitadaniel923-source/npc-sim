# Everglen 3D build sources

Place licensed project-owned `.blend`, `.fbx`, or `.obj` source files here when running the 3D bake workflow.

The public runtime repository intentionally stores **derived sprite atlases**, not third-party source packs. This avoids redistributing original source packages when their licenses do not permit standalone redistribution.

Pipeline:

1. Blender 4.5 LTS opens/imports the source.
2. Each mesh object is exported as a GLB build intermediate.
3. Blender renders transparent orthographic views.
4. `tools/pack_3d_atlas.py` creates the runtime mega atlas.
5. `everglen_3d_asset_stage.js` selects assets from the manifest at runtime.
