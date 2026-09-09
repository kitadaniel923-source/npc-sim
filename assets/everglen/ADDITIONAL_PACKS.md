# Additional Everglen Art Packs

## Added to the asset catalog

### Kingdom Starter v1.0
Useful for Everglen's world terrain layer. It is a 64x64 Wang-tile sampler with eight terrain families: pasture/farm, forest/meadow, desert rock, deep snow/frost rock, cave/moss, bog/mushroom, grave/bone and seabed/coral. The supplied README explicitly permits commercial and non-commercial use and says not to resell the assets as an asset pack.

The four most useful current families are catalogued in `kingdom_core_manifest.json`: `acker`, `lichtung`, `duneveil_fels`, and `frosthold_fels`.

### MysticOres
Useful for future mining/resource-node visuals. The supplied ZIP contains 12 32x32 ore and material icons. They are catalogued in `ores_manifest.json` for later mining, inventory, economy and settlement-production systems. Original pack terms should be verified before public redistribution.

## Reserved for the 3D pipeline

The supplied Medieval Pack `.blend`, `.fbx`, `.obj`, and STL archive appear to be 3D model sources rather than 2D pixel-art runtime assets. They are not injected into the current 2D renderer. They can become useful later if Everglen gains a 3D asset-rendering/export pipeline, for example for rendered building sprites, hero portraits, cinematic scenes, or a future 3D view.

## Vegetation tutorial archive

The supplied `3DPixelArt_Tutorial_Vegetation.7z` is retained as a candidate vegetation source. The current environment could not inspect its internal file list without a 7z extraction library, so it is not blindly imported into the game. This avoids adding unknown or incompatible files to the production asset pipeline.
