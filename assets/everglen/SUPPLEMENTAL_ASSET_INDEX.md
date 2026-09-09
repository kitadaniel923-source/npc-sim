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

## Storage

- `supplemental_asset_atlas.part1.b64`
- `supplemental_asset_atlas.part2.b64`
- `supplemental_asset_manifest.part1.gz.b64`
- `supplemental_asset_manifest.part2.gz.b64`

The atlas is decoded into a browser image at runtime. The original source ZIP/3D files are not redistributed by this runtime bundle.

## 3D source packs

The supplied Blend, OBJ, FBX and STL files are intentionally not flattened into the 2D atlas. They require a separate 3D-to-sprite rendering pipeline before they can be represented faithfully in the current 2D renderer.
