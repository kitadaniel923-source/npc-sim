# Everglen 1.0 Test Plan

## Launch

Open `index.html` normally for the game.

For diagnostics, open `index.html?test=1`. The runtime readiness panel reports core systems, scheduler registration, required UI surfaces, and basic world population.

The same diagnostics are available in the browser console with:

```js
EVERGLEN_1_0_TESTS.test()
EVERGLEN_1_0_TESTS.show()
```

## Core playtest

1. Start a new world and confirm the canvas, world stats, factions and simulation log appear.
2. Pause and resume the simulation. Change speed and confirm the tick/year advance rate changes.
3. Select NPCs and confirm the inspector, needs and social information update without duplicating panels.
4. Let the world run through multiple seasons and confirm population, settlements, food and stability continue changing.
5. Trigger Festival, Storm, Plague, Border War and Meteor. Confirm each produces visible state changes and log entries.
6. Open God Mode and verify player interventions alter the world and are recorded by the intervention/event systems.
7. Inspect kingdom borders and diplomacy. Confirm claims, wars and diplomatic changes affect the world state.
8. Open Chronicle and verify new events appear as the simulation advances.
9. Save, reload the page, and confirm the persistent world returns with the same major entities and player interventions.
10. Run a long simulation and watch for runaway population, wealth, debt, food, stability, or development values.

## Release gate

Everglen is ready for 1.0 playtesting when:

- the readiness panel reports `READY FOR PLAYTEST`
- the simulation advances without repeated console exceptions
- pause/resume and speed controls work
- NPC selection and inspection work
- major player interventions visibly affect the world
- wars, diplomacy, economy, climate and history produce observable consequences
- save/load restores the same world rather than rebuilding a different one
- no architecture gate regression is introduced
