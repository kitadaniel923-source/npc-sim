# Everglen 1.0 Test Plan

Phase 1-9 is the current implementation boundary. Phase 10 UI/polish does not begin until this playtest passes.

## Runtime diagnostics

Open `index.html` normally for the game.

For basic readiness diagnostics, open `index.html?test=1`.

Browser console commands:

```js
EVERGLEN_1_0_TESTS.test()
EVERGLEN_1_0_TESTS.show()
EVERGLEN_PHASE1_9.phaseStatus()
EVERGLEN_PHASE1_9.playtestReadiness()
EVERGLEN_PHASE1_9.snapshot()
EVERGLEN_PHASE1_9.stressSnapshot()
EVERGLEN_DEEP_AUDIT.test()
```

`everglen_phase1_9_closure.js` is a scheduler-owned integration layer. It normalizes invalid world links/numeric values, maintains derived population/economic profiles, compacts repetitive historical records, collects performance telemetry, and exposes the playtest gate. It does not create a second simulation, render loop, or canvas listener.

## Phase 1 — NPC intelligence

- NPC personality, needs, goals, planning, careers, decisions, behavior, memory and learning initialize.
- Deep causality records outcomes and changes future action preferences.
- Career and decision reasons remain explainable.

## Phase 2 — Society & civilization

- Social classes and institutions evolve.
- Education, culture, belief, law, unrest and regime pressure change over time.
- Families, clans and demographic relationships remain internally consistent.

## Phase 3 — Politics, diplomacy & war

- Kingdoms develop strategic interests and postures.
- Diplomacy, alliances, treaties and hostility change.
- Wars have strategic consequences and feed territory, economy and society.
- Succession, occupation, espionage and great-power systems can affect geopolitics.

## Phase 4 — World assets

- Imported terrain and world assets render through the canonical render registry.
- NPCs use the Pixel Crawler body/animation path.
- Race/profession identity cues use the imported race-profession atlas.
- Military NPCs receive equipment overlays.
- No duplicate legacy NPC body is visible.
- Camera pan and zoom remain functional.

## Phase 5 — Economy & infrastructure

- Production, workshops, markets, prices, trade and taxation interact.
- Roads, logistics, infrastructure and construction affect settlement performance.
- Economic geography creates specialization and comparative advantage.
- Crises can propagate through trade and finance.

## Phase 6 — Performance & stability

- `EVERGLEN_PERF.perf` reports tick/system timing and population telemetry.
- Spatial indexing remains populated.
- Population scaling skips expensive systems at higher populations without starving critical systems.
- No runaway memory growth is observed during long runs.

## Phase 7 — Emergent-world balance

Let the simulation run for multiple centuries where practical.

Verify:

- kingdoms can rise, stagnate, fragment and recover;
- population can grow and decline rather than monotonically exploding;
- food shortages and economic crises can recover;
- migration and unrest respond to pressure;
- wars can end rather than remaining permanently active;
- no major numeric field becomes `NaN`, `Infinity`, or an impossible negative value;
- historical consequences remain visible in later behavior.

## Phase 8 — Persistence & release reliability

- Reset creates a valid new world.
- Save/load restores major NPCs, families, settlements, kingdoms, civilization state, economy, diplomacy, history and player interventions.
- Reload does not create duplicate systems or duplicate entities.
- The world can resume simulation after loading.

## Phase 9 — Final performance gate

Before playtest approval:

1. Start a fresh world.
2. Run normally until the simulation has progressed through several seasons.
3. Run at high speed for a sustained period.
4. Use `EVERGLEN_PHASE1_9.stressSnapshot()` at low and high populations.
5. Run the deep audit.
6. Inspect the console for repeated exceptions.
7. Confirm rendering remains responsive and NPCs do not multiply visually.
8. Confirm `EVERGLEN_PHASE1_9.playtestReadiness().ok === true`.

The exact performance numbers are intentionally hardware-dependent. The gate is stability, bounded degradation and absence of catastrophic simulation/render failures, not one universal FPS target.

## Player playtest checklist

1. Start a new world and confirm canvas, world stats, factions and simulation log.
2. Pause/resume and change simulation speed.
3. Select NPCs and inspect identity, needs, family, relationships, career and decisions.
4. Confirm visually distinct races/professions and military equipment.
5. Let the world advance through multiple seasons.
6. Trigger Festival, Storm, Plague, Border War and Meteor.
7. Inspect settlements, kingdoms, borders, diplomacy, economy and war state.
8. Open Chronicle and confirm important history accumulates without obvious duplicate spam.
9. Save and reload; verify continuity.
10. Run a long simulation and inspect population, food, wealth, debt, stability, development, war and migration behavior.
11. Run the Phase 1-9 readiness and deep audits.

## Release gate

Phase 1-9 passes only when:

- `EVERGLEN_1_0_TESTS.test()` reports all required runtime foundations;
- `EVERGLEN_PHASE1_9.playtestReadiness().ok` is `true`;
- deep invariants pass or any failures are explicitly diagnosed and fixed;
- the architecture ownership gate has no regression;
- no repeated runtime exception blocks normal play;
- the simulation survives the long-run/performance portion of the playtest;
- the visual pipeline remains canonical and duplicate-free.

**Phase 10 is blocked until this gate passes.**
