# Phase 3 Complete

Phase 3 upgrades Everglen from kingdom-aware simulation into a strategic medieval geopolitical simulation.

## Included

- Kingdom strategic AI
- Diplomatic decision-making
- Geopolitical intelligence
- War planning and objectives
- Military strategy
- Occupation and conquest settlement
- Dynastic geopolitics
- Espionage and covert politics
- Great powers and regional influence
- International history
- Player geopolitical intervention

## Strategic loop

Civilization → Interests → Strategy → Threats & Opportunities → Diplomacy → Military Planning → War → Occupation/Settlement → Dynastic & Social Consequences → International Power → New Strategy

## Architecture

All Phase 3 modules are state-only simulation systems. No module adds a world-canvas DOM listener or independent render loop. Player-facing geopolitical mutations route through the canonical player event pipeline.

The existing `npc_war.js` remains the battle/siege executor. Phase 3 adds strategic planning around it rather than creating a competing combat engine.
