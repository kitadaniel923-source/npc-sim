# Everglen Supplemental Mega Asset Index

The runtime mega atlas is reconstructed from the checked-in base64 atlas parts and gzip-compressed manifest parts. This avoids relying on external files at runtime.

## Imported source packs

- Overworld biomes: terrain, fills, blend tiles and nature props
- Medieval Town & Fantasy Mega Props: village props, fixtures, market, blacksmith, tavern, architecture, adventure and nature
- Nature rocks: unique rock variants
- Kingdom Starter: 32px kingdom tile families
- Mystic Ores: ore and material icons
- Roguey Arms & Armor: equipment sheet
- Vessels: boat, sailboat and sailship strips
- Craftpix knight pack: knight animation sheets

## Runtime coverage

- 643 source sprite records are catalogued in the mega manifest.
- 7,716 deterministic runtime variants are generated from those source records.
- The contextual renderer selects assets from settlement, nature, resource, maritime, equipment and character categories.
- A slow catalog sweep traverses the source records so imported sprites remain reachable instead of becoming dead files.

## 3D baked runtime layer

- `medieval_3d_atlas.webp` contains eight orthographic baked views from the supplied Medieval Pack OBJ/STL geometry.
- `medieval_3d_manifest.json` defines the atlas contract and source provenance.
- `everglen_3d_asset_stage.js` loads the baked atlas through the canonical render registry and places variants around settlements and ports.
- `tools/bake_3d_assets.py` provides a reproducible OBJ/STL bake path for future revisions.
- Blend and FBX sources remain source-only until a Blender export step is available. They are not silently treated as runtime-ready 2D assets.

The 3D layer is intentionally baked to sprites so the current lightweight 2D renderer does not need a runtime 3D engine.
