# Everglen Architecture Rules

## Ownership gate

Everglen uses one world-input owner, one simulation scheduler and one canonical world-render path.

### Input
`input_dispatcher.js` owns DOM listeners for world interaction and routes them to registered handlers.

Feature files must not add a second world-canvas listener.

### Simulation
Simulation systems register through `state.registerSystem(...)`. Feature systems must not create independent simulation timers or tick loops.

### Rendering
`render_registry.js` owns the canonical render stage list.

The canonical `SIM_RENDER` path executes the simulation renderer and then registered renderer stages in deterministic priority order.

Current production rendering ownership is:

- `world_canvas.js` → canvas/context ownership
- `everglen_static_asset_stage.js` → terrain, world props, settlements and static imported assets
- `everglen_asset_integration_stage.js` → supplemental contextual assets
- `everglen_3d_asset_stage.js` → optional 3D asset layer
- `pixel_crawler_npc_renderer.js` → canonical NPC bodies, animation and race/profession identity cues
- `everglen_equipment_stage.js` → military equipment overlays
- `npc_identity_visuals.js` → selection/trait overlays
- `border_recognition.js` → border visualization/recognition

Retired legacy body/world renderers are no longer loaded by `index.html`.

## Mechanical definition of done

Before any architecture or player-facing phase is marked complete, check the codebase for:

```text
canvas.addEventListener
setInterval(...draw
requestAnimationFrame(...draw
```

The acceptance test is that world-canvas DOM listeners exist only in `input_dispatcher.js`, and rendering is triggered only through the canonical render path plus registered renderer stages.

A future feature fails the gate when it introduces a direct world-canvas listener, independent renderer loop, or independent simulation timer instead of using the existing registries.

## Player causality gate

When a player action changes NPC, settlement, kingdom, resource, or related world state:

1. The required world mutation may happen in the tool that owns that operation.
2. Player attribution and intervention history must use the shared player event pipeline.
3. Player-caused memory must use the shared memory seam where appropriate.

## Migration and retirement rules

Superseded production modules and versioned predecessors must not remain loaded beside the active implementation. Retire superseded code to `archive/` when practical and preserve history in git.

## Phase 1-9 gate

Phase 1-9 work must preserve the existing specialist authorities for AI, society, civilization, geopolitics, war, economy, ecology, climate, history and persistence. Integration layers may normalize state, expose derived read models, collect telemetry and enforce invariants, but must not create parallel authorities.

`everglen_phase1_9_closure.js` is an integration/validation layer. It does not own rendering or timing outside the shared scheduler.

## Playtest boundary

Phase 10 UI/polish work must not begin until the Phase 1-9 playtest passes. The playtest must exercise reset/new-world startup, NPC identity and animation, settlement rendering, simulation progression, economy, diplomacy/war, ecology/climate, persistence, long-run stability and performance under increasing population.
