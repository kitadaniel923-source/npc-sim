(() => {
  const api = window.SIM_API;
  if (!api?.state) return;

  const state = api.state;
  const wrapCollection = (key, blockedNames, blockedStackTerms) => {
    let raw = state[key];
    let wrapped = null;

    const makeProxy = (value) => {
      if (!value || typeof value.forEach !== 'function') return value;
      return new Proxy(value, {
        get(target, prop, receiver) {
          if (prop !== 'forEach') return Reflect.get(target, prop, receiver);
          const nativeForEach = target.forEach;
          return function(callback, thisArg) {
            const name = callback?.name || '';
            const stack = new Error().stack || '';
            const blocked = blockedNames.includes(name) || blockedStackTerms.some(term => stack.includes(term));
            return blocked ? undefined : nativeForEach.call(target, callback, thisArg);
          };
        }
      });
    };

    Object.defineProperty(state, key, {
      configurable: true,
      enumerable: true,
      get() { return wrapped; },
      set(value) {
        raw = value;
        wrapped = makeProxy(value);
      }
    });

    wrapped = makeProxy(raw);
  };

  // The old core still contains legacy production/settlement/army loops.
  // Suppress only those legacy callbacks so the dedicated systems are the owners.
  wrapCollection('settlements', ['produce'], ['hierarchy']);
  wrapCollection('armies', ['moveArmy', 'supplyArmy'], ['moveArmies', 'supplyArmies']);

  // Runtime migration for worlds created before armoring became a blacksmith specialization.
  api.registerSystem({
    name: 'core-role-normalizer',
    priority: 110,
    step(s) {
      s.npcs.forEach(n => {
        if (!n || !n.alive || n.roleId !== 'armorer') return;
        n.roleId = 'blacksmith';
        n.roleName = 'Blacksmith';
        n.career = n.career || {};
        n.career.id = 'blacksmith';
        n.career.name = 'Blacksmith';
        n.career.specialization = 'smithing + armoring';
      });
    }
  });

  window.CORE_OWNERSHIP = {
    legacyProductionBlocked: true,
    legacySettlementGrowthBlocked: true,
    legacyArmyMovementBlocked: true,
    legacyArmySupplyBlocked: true,
    armorerMigratedToBlacksmith: true
  };
})();
