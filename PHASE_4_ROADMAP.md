# Everglen Phase 4: Living World

Phase 4 turns Everglen from a collection of intelligent individuals and political systems into a continuously evolving medieval world.

## Core loop

**Family & Generation → Settlement → Migration → Culture & Faith → Economy → Regional identity → Kingdom behavior → individual behavior**

The existing Phase 1–3 systems remain authoritative. Phase 4 extends them through shared state and registered simulation systems rather than parallel simulation loops.

## 4A Family & Generations

- Birth, childhood, adolescence, adulthood and elder stages.
- Parent/child and sibling relationships.
- Family reputation, wealth, prestige and traditions.
- Inheritance of wealth, land, buildings and titles.
- Dynastic succession pressure and family disputes.
- Trait and cultural inheritance.
- Generational memories and family history.

Existing `families.js` and `npc_lifecycle.js` form the foundation. Lifecycle/family integration must use the canonical `NPC_FAMILIES` API.

## 4B Settlement Evolution

- Population and household growth.
- Village → town → city progression.
- Settlement prosperity, security and infrastructure thresholds.
- Resource specialization and local production identity.
- Markets, districts and settlement-level institutions.
- Abandonment and decline when population, security or food collapse.

## 4C Migration & Demographic Change

- Economic migration.
- War refugees and displacement.
- Famine and disaster migration.
- Religious/cultural migration.
- Frontier settlement and colonization.
- Diasporas that preserve memories, culture and grievances.

## 4D Culture & Religion Evolution

- Regional dialect/tradition drift.
- Culture splitting and merging.
- Cultural assimilation and resistance.
- Religious spread and local adoption.
- Religious reform, schism and holy sites.
- Tolerance, persecution and religious migration.

## 4E Trade & Regional Economy

- Persistent trade routes.
- Merchant hubs and market specialization.
- Supply shortages and surpluses.
- Price pressure and economic dependency.
- Roads, ports and strategic trade corridors.
- Trade disruption caused by war, unrest and borders.

## 4F Exploration & Frontier Growth

- Exploration missions.
- Discovery of distant resources and settlements.
- Frontier outposts.
- New routes and strategic chokepoints.
- Contact with previously isolated kingdoms.

## 4G World History

Every major world event should create durable historical consequences:

- wars and treaties
- rulers and dynasties
- migrations
- disasters
- cultural changes
- religious conflicts
- city foundations and collapses
- legendary individuals

History should feed back into NPC memory, culture, diplomacy, claims and future decisions.

## Architecture gates

Before each Phase 4 milestone:

1. No raw world-canvas DOM listeners outside `input_dispatcher.js`.
2. No independent render loops/timers.
3. Simulation systems use `state.registerSystem` where tick ownership applies.
4. Territory queries use the canonical border/territory layer.
5. War decisions use the existing war layer.
6. Player-caused changes use the player event pipeline.
7. New persistent state remains save-compatible.
8. No duplicate authority is introduced for families, lifecycle, economy, migration, culture or settlement state.

## Completion condition

Phase 4 is complete when an observer can start a medieval world and watch multiple generations produce visible changes in families, settlements, demographics, culture, religion, trade and regional history without direct player scripting.