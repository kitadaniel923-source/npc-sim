# Everglen Phase 3 Roadmap

## World Politics, Diplomacy & Geopolitics

Phase 3 turns kingdoms from passive containers into strategic actors. A kingdom should develop interests, evaluate threats, choose diplomatic positions, prepare for conflict, pursue objectives, and adapt after wars.

### Core strategic loop

```text
Kingdom Identity
      ↓
Interests
      ↓
Strategic Goals
      ↓
Threat Assessment
      ↓
Power & Opportunity Analysis
      ↓
Diplomatic Decisions
      ↓
Military Decisions
      ↓
War / Peace
      ↓
Territory / Occupation / Treaties
      ↓
Economic + Social Consequences
      ↓
Kingdom learns and changes
```

## Phase 3A — Kingdom Strategic AI

**Foundation. Implement first.**

Add a persistent strategic state to every kingdom:

- strategic personality: cautious, expansionist, mercantile, militarist, isolationist, diplomatic
- interests: survival, land, gold, trade, prestige, security, faith, culture, succession
- strategic goals with priority and progress
- perceived threats and opportunities
- military readiness and mobilization willingness
- diplomatic posture
- war appetite and peace appetite
- memory of strategic outcomes

The AI should consume existing civilization, society, economy, dynasty, border, army and diplomacy systems instead of creating parallel versions of them.

**Definition of done:** kingdoms make explainable strategic choices without direct player commands.

## Phase 3B — Diplomatic Decision Engine

Upgrade the existing relation/treaty layer into decision-making:

- improve relations
- issue trade proposals
- form alliances
- request military assistance
- guarantee borders
- threaten rivals
- break treaties
- seek peace
- recognize independence
- support a claimant

Every diplomatic action gets a reason and is recorded in diplomatic history.

**Definition of done:** diplomacy changes because kingdoms have interests, not because of random relation drift alone.

## Phase 3C — Geopolitical Map Intelligence

Build strategic awareness from the existing territorial system:

- shared borders
- border length
- chokepoints
- nearby settlements
- capital distance
- resource value
- fertile land
- strategic terrain
- exposed territory
- vulnerable allies
- regional power balance

Generate a strategic map model without creating a second territory owner system.

**Definition of done:** kingdom decisions can identify why a region matters.

## Phase 3D — War Planning & Objectives

Replace generic war behavior with kingdom-level objectives:

- defend homeland
- seize a border province
- capture a capital
- secure a resource region
- punish a rival
- support an ally
- enforce a treaty
- install a claimant
- break an alliance
- force concessions

Wars receive persistent objectives, participants and progress.

**Definition of done:** wars have reasons, targets and outcomes.

## Phase 3E — Military Strategy

Feed kingdom strategy into the existing army/battle layer:

- mobilization decisions
- army concentration
- invasion routes
- defensive fronts
- reserve forces
- siege priorities
- retreat decisions
- reinforcement priorities
- naval/transport priorities where available

Do not replace `npc_war.js`; provide strategic commands/targets to it.

**Definition of done:** armies behave according to kingdom strategy instead of always selecting the nearest target.

## Phase 3F — Occupation, Vassalage & Border Settlement

After conquest, decide what happens politically:

- direct annexation
- occupation
- client/vassal kingdom
- tribute arrangement
- border settlement
- liberation
- restoration of a previous ruler

Occupation creates resistance pressure and feeds existing society/unrest systems.

**Definition of done:** winning a war does not automatically equal permanent stable ownership.

## Phase 3G — Succession & Dynastic Geopolitics

Connect dynasty politics to international politics:

- marriage alliances
- claimant backing
- succession wars
- rival heirs
- foreign intervention
- dynastic legitimacy
- restoration wars

**Definition of done:** a ruler's death can alter international relations and trigger strategic reactions.

## Phase 3H — Espionage & Covert Politics

Add non-military competition:

- spies
- scouting
- sabotage
- intelligence gathering
- political influence
- stolen plans
- assassination attempts as a rare high-risk event
- counter-intelligence

Keep outcomes tied to NPC skills, memory, relationships and existing crime systems.

**Definition of done:** kingdoms can compete without open war.

## Phase 3I — Great Powers & Regional Blocs

Calculate dynamic international influence:

- military power
- economic strength
- population
- territory
- technology
- diplomatic reach
- prestige

Generate:

- great powers
- regional powers
- minor powers
- blocs
- spheres of influence

No fixed superpower list. Status must emerge from the simulation.

## Phase 3J — International History

Create a durable geopolitical history stream:

- alliances formed/broken
- treaties signed
- wars declared/ended
- territories transferred
- rulers supported
- kingdoms liberated
- vassals created/released
- major diplomatic betrayals
- regional power shifts

History must influence future decisions through memory and strategic evaluation.

## Phase 3K — Player Geopolitics

Expose the strategic layer to God Mode and world interaction:

- inspect kingdom strategy
- see allies and rivals
- inspect war objectives
- influence diplomacy
- force treaties
- trigger political pressure
- support a claimant
- recognize independence

Player-caused changes must use the existing player-event pipeline and persist through save/load.

## Architecture gates

Before each major Phase 3 subsystem is marked complete:

1. No direct world-canvas listeners.
2. No independent render loop or timer.
3. Strategic systems use `state.registerSystem(...)` where tick ownership applies.
4. Territory queries reuse the canonical territory/border systems.
5. War execution reuses the existing war layer.
6. Player mutations use the shared player-event pipeline.
7. Persistent strategic data is compatible with the existing world save schema.
8. New systems must not create parallel economy, society, diplomacy, army, or territory authorities.

## Implementation order

```text
3A Kingdom Strategic AI
 ↓
3B Diplomatic Decisions
 ↓
3C Geopolitical Intelligence
 ↓
3D War Objectives
 ↓
3E Military Strategy
 ↓
3F Occupation + Vassalage
 ↓
3G Dynastic Geopolitics
 ↓
3H Espionage
 ↓
3I Great Powers
 ↓
3J International History
 ↓
3K Player Geopolitics
```

## Phase 3 completion condition

Phase 3 is complete only when kingdoms can independently pursue strategic interests, form and break relationships, choose war objectives, conduct wars through the existing military layer, respond to the political consequences, and retain the resulting geopolitical history across saved worlds.
