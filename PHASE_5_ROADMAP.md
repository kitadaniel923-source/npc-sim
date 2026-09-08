# Everglen Phase 5: Economy & Infrastructure

Phase 5 turns the existing economy into a deeper medieval production, market, infrastructure and wealth simulation.

## Core loop

Resources → Production Chains → Workshops → Markets → Prices → Trade → Wealth → Taxation → Infrastructure → Settlement Power → Kingdom Strategy → NPC Careers and Needs

## 5A Deep Production Chains
- Input-dependent agriculture, milling, textiles, carpentry, smithing, medicine and scholarship.
- Advanced metalworking and arcane crafting consume scarce resources.
- Settlement bottlenecks persist and affect industrial efficiency.

## 5B Markets & Price Discovery
- Local supply/demand curves.
- Regional price differences.
- Shortages, surpluses, inflation and deflation.
- Merchant opportunity selection.

## 5C Businesses & Guild Economies
- Workshops employ workers.
- Business growth, failure and specialization.
- Guild influence over production and prices.
- Competition between merchants and craftsmen.

## 5D Roads, Ports & Infrastructure
- Road quality, bridges, ports, warehouses and market districts.
- Infrastructure investment choices for settlements and kingdoms.
- Logistics capacity and maintenance costs.

## 5E Taxation & Public Finance
- Taxes collected by institutions.
- Treasury budgets for armies, infrastructure, festivals and relief.
- Debt, defaults, corruption and fiscal crises.

## 5F Regional Trade Networks
- Multi-hop trade routes.
- Caravan capacity and route security.
- Trade hubs and strategic chokepoints.
- Blockades and embargoes.

## 5G Economic Classes & Mobility
- Wealth accumulation and poverty traps.
- Merchant, artisan, peasant and noble economic mobility.
- Economic power feeds political power.

## 5H Economic Crises
- Famine, shortages, market crashes, trade disruption, debt crises and recovery.
- Crises feed migration, unrest, diplomacy and war.

## 5I Economic Intelligence UI
- Settlement market inspection.
- Kingdom economic dashboard.
- Resource prices, production bottlenecks and trade routes.

## 5J Optimization & Balance
- Budget-aware economic updates.
- Deterministic persistence compatibility.
- Large-population stress testing.

## Architecture requirements

- No raw world-canvas listeners outside the shared input dispatcher.
- No independent renderer loops or render timers.
- Tick systems use `registerSystem` where applicable.
- Existing resource and economy registries remain canonical.
- Player-created economic changes use the player event pipeline.
- Economy state remains save-compatible with the existing world schema.
