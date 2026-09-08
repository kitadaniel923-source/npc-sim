# Everglen Architecture Rules

## Ownership gate

Everglen uses one world-input owner and one world-render owner.

### Input
`input_dispatcher.js` owns DOM listeners for world interaction and routes them to registered handlers.

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

The literal acceptance test is that world-canvas DOM listeners exist only in `input_dispatcher.js`, and rendering is triggered only through the canonical render path plus registered renderer stages.

A future feature fails the gate when it introduces a new direct world-canvas listener or independent renderer loop instead of using the existing registries.

## Player causality gate

When a player action changes NPC, settlement, kingdom, resource, or related world state:

1. The required world mutation may happen in the tool that owns that operation.
2. Player attribution and intervention history must use the shared player event pipeline.
3. Player-caused memory must use the shared memory seam where appropriate.

## Migration and retirement rules

Save/Load, God Mode, border inspection, the 2D renderer, and NPC visuals are existing shipped systems. Moving them onto the dispatcher/renderer registry is a migration and ownership cleanup, not permission to rebuild their gameplay behavior from scratch.

Superseded production modules and versioned predecessors must not remain loaded or sit beside the active implementation in the live directory. Retire them to `archive/` and preserve their history there or in git history.

## Explicit deferred work

The current architecture gate intentionally does not include:

- inspector-panel DOM ownership consolidation (`simulation.js`, `social_ui.js`, `social_traits.js`)
- simulation-tick timer consolidation for legacy systems that still use independent timers

Those are named follow-up architecture tasks. They are not considered fixed merely because the world-input/render grep gate passes.

Event feedback expansion, goals/stakes, and deeper causality propagation remain paused until the current architecture gate passes.
