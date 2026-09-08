# Everglen Finalization Roadmap

Everglen now has the core living-world simulation stack: NPC AI, society, civilization, geopolitics, history, ecology, climate, trade, finance, economic development, demography and regional inequality.

The remaining work is focused on making the simulation coherent, observable, performant and playable rather than endlessly adding parallel subsystems.

## Finish Order

### F1 — Architecture Closure
- Close deferred inspector DOM ownership.
- Close deferred simulation-tick ownership.
- Verify one owner for world input, rendering and simulation scheduling.
- Keep player-caused mutations on the shared player-event pipeline.
- Run the architecture gate after each structural change.

### F2 — Unified World State
- Audit duplicated kingdom/settlement fields.
- Normalize identifiers and ownership references.
- Ensure derived values are recalculated from canonical systems.
- Verify save/load compatibility for all persistent phase state.

### F3 — Player-Facing Simulation Controls
- Kingdom inspection.
- Settlement inspection.
- Population and demographic inspection.
- Economy/development inspection.
- War/diplomacy inspection.
- Climate and ecology inspection.
- Historical cause/effect inspection.

### F4 — Asset Pipeline Integration
- Asset registry.
- Sprite-sheet manifests.
- Terrain rendering.
- Building rendering.
- NPC appearance composition.
- Equipment overlays.
- Weather layers.
- Effects and map overlays.
- LOD and tiny-resolution optimization.

### F5 — Simulation Feedback
- Important events become visible without overwhelming the player.
- Kingdoms, settlements and NPCs expose explainable decisions.
- Historical consequences visibly propagate into present behavior.
- Player interventions leave durable records.

### F6 — Performance & Stability
- Large-population stress testing.
- Long-run simulation testing.
- Save/load stress testing.
- Memory growth checks.
- Expensive-system scheduling audit.
- Graceful degradation for distant simulation layers.

### F7 — Balance & Emergent World Testing
- Run centuries-long simulations.
- Check that kingdoms can rise, stagnate, fragment and recover.
- Check that economies can boom and crash without permanent runaway states.
- Check war, rebellion, famine, migration and development feedback.
- Fix runaway loops, dead states and impossible values.

### F8 — Release Pass
- UI polish.
- Settings and gameplay preferences.
- Error-safe initialization.
- Reset/new-world reliability.
- Save/load reliability.
- Final asset validation.
- Final architecture and performance audit.

## Completion Condition

Everglen is considered feature-complete when a new world can run for centuries without manual intervention, kingdoms and NPCs develop explainable lives and histories, player actions persist, the world remains performant, and the player can understand what is happening through the interface and visual asset system.
