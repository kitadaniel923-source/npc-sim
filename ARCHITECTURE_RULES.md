# Everglen Architecture Rules

## Ownership gate

Everglen uses one world-input owner and one world-render owner.

### Input
`input_dispatcher.js` owns DOM listeners for world interaction and routes them to registered handlers.

Handlers are ordered by priority. Current world handlers include:

- God Mode
- Border inspection
- NPC selection
- Camera pan/zoom
- Final world-click capture

Feature files must not add a second world-canvas listener.

### Rendering
`render_registry.js` owns the canonical render stage list.

The canonical `SIM_RENDER` path executes the simulation renderer and then registered renderer stages in deterministic priority order.

Current registered stages include:

- `art_2d.js`
- `npc_visuals.js`
- `border_recognition.js`

Feature files must not create an independent render timer or loop.

## Mechanical definition of done

Before any architecture or player-facing phase is marked complete, check the codebase for:

```text
canvas.addEventListener
setInterval(...draw
```

The intended end state is that world-canvas DOM listeners exist only in `input_dispatcher.js`, and world rendering is triggered through the canonical render path with renderer stages registered through `render_registry.js`.

A future feature fails the gate when it introduces a new direct world-canvas listener or independent renderer loop instead of using the existing registries.

## Player causality gate

When a player action changes NPC, settlement, kingdom, resource, or related world state:

1. The required world mutation may happen in the tool that owns that operation.
2. Player attribution and intervention history must use the shared player event pipeline.
3. Player-caused memory must use the shared memory seam where appropriate.

## Migration rule

Save/Load, God Mode, border inspection, the 2D renderer, and NPC visuals are existing shipped systems. Moving them onto the dispatcher/renderer registry is a migration and ownership cleanup, not permission to rebuild their gameplay behavior from scratch.

Event feedback expansion, goals/stakes, and deeper causality propagation remain paused until this architecture gate passes.
