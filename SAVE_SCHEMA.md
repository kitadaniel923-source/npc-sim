# Everglen Save Schema

## Scope

Persistence is a foundation feature. It restores the simulated world as data without attempting deeper causal propagation between systems.

Player actions are part of the saved world through `state.playerInterventions`. Each entry is a normal world-history record with `actor: "player"` and `playerCaused: true`.

## Format

Current format:

- `schema`: `everglen-world`
- `version`: `3`
- `savedAt`: ISO timestamp
- `meta`: compact world summary
- `state`: serialized simulation data

Future incompatible changes require a new schema version and a migration path.

## Serialization rules

### Runtime-only state

The following are excluded from saves because they are live runtime infrastructure rather than world data:

`running`, `dragging`, `dragStart`, `systems`, `_cache`, `registerSystem`, `getNpc`, `getSettlement`, `getKingdom`, `getFamily`, `saveWorld`, `loadWorld`, `hasSave`.

System registrations are therefore not deserialized as functions. The normal boot process owns system registration, and loading refreshes caches after data restoration.

### Typed arrays

Typed arrays are encoded explicitly as objects with `__everglenType` and `data` fields. This preserves the concrete type instead of relying on JSON's object conversion.

Important current fields:

- `state.territory` → `Int16Array`
- `state.territoryCost` → `Float32Array`

The loader reconstructs these types and also normalizes compatible legacy v2 saves that stored them as numeric-key objects.

### Relationships

NPC relationships reference other NPCs by stable `targetId` values. They must remain ID references, not embedded NPC objects. This is the save-schema invariant that prevents circular object graphs and keeps relationship data portable across reloads.

### Player interventions

`state.playerInterventions` is authoritative history for player-caused world changes. Current records contain an ID, actor/source marker, simulation time, action/tool, explicit `type`, target, optional world position, details, consequences, and affected entity ID.

Territory interaction state is also ordinary world data and is persisted automatically:

- `state.territoryClaims` → tile-id keyed player claim overrides. These are inputs to `recomputeTerritory()`, not direct ownership writes. Removing a claim deletes the override and recomputes organic ownership.
- `state.borderWars` → targeted kingdom-pair wars created by contextual border actions. These are distinct from the global `state.war` toggle.

### Civilization and diplomacy state

Phase 2 civilization data is additive to the same v3 snapshot and requires no separate serialization format. Current persistent structures include settlement education/identity data, kingdom civilization identity, and inter-kingdom diplomacy:

- `settlement.society.education` → schools, teachers, literacy, knowledge, prestige and history.
- `settlement.society.identity` → dominant culture/belief, diversity, tolerance and identity history.
- `kingdom.society.identity` → civilization culture, belief, law, literacy, education, knowledge, tolerance, prosperity, historical era and evolution history.
- `state.diplomacy` → bilateral relations, treaties and diplomatic history.
- `kingdom.diplomacy` → kingdom-local mirrors of bilateral relations, treaties and history.

These fields remain ordinary data and are automatically included by the recursive serializer. They can therefore survive save/load alongside populations, settlements, wars, institutions and player interventions.

This phase records civilization evolution and diplomacy as persistent world history. The simulation still keeps runtime system registrations and DOM infrastructure out of the save.

## Migration policy

When a future schema cannot safely load an older version directly:

1. Keep the old version readable where practical.
2. Transform it into the current schema in memory.
3. Validate critical invariants.
4. Only then replace the live `SIM_STATE` data.
5. Save again using the current version.

Never silently interpret an incompatible save as a current-format save.
