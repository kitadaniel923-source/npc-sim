# Everglen asset integration

This directory contains curated runtime atlases built from the project-owned source packs supplied during the Everglen visual integration pass.

The renderer is intentionally separate from simulation logic. `asset_world_renderer.js` registers one render stage with the existing `EVERGLEN_RENDER` registry and reads authoritative positions, settlements, roles, seasons and simulation time from `SIM_STATE`.

Runtime layers currently include:
- Terrain: grass, forest, desert and water.
- Nature: trees, bushes, cactus and seasonal rocks.
- Settlements: wells, markets, taverns, anvils, hay, banners and castle landmarks.
- Characters: civilian Pixel Crawler-style NPC animation plus knight military visuals.
- Wildlife: fox, boar, sheep and piglet animation strips.
- Maritime: raft, boat and large ship represented as a warship.

The atlas files are curated runtime derivatives, not standalone redistribution of the original packs. Refer to `ASSET_CREDITS.md` for source attribution and license handling notes.
