// Everglen NPC identity visuals.
// Visual-only stage: deterministic body variation, gender-aware silhouette hints,
// and profession equipment cues. Simulation state remains authoritative.
(() => {
  const state = window.SIM_STATE;
  const registry = window.EVERGLEN_RENDER;
  if (!state || !registry) return;

  const hash = (value, salt = 0) => {
    let h = 2166136261 >>> 0;
    const text = `${value}|${salt}`;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967296;
  };

  const genderOf = n => {
    const raw = String(n.gender ?? n.sex ?? '').toLowerCase();
    if (raw === 'f' || raw === 'female' || raw === 'woman') return 'female';
    if (raw === 'm' || raw === 'male' || raw === 'man') return 'male';
    return hash(n.id || `${n.x}:${n.y}`, 71) < .5 ? 'female' : 'male';
  };

  const bodyProfile = (n, seed) => {
    const g = genderOf(n);
    const variation = .94 + hash(n.id || `${n.x}:${n.y}`, 72) * .12;
    const width = variation * (g === 'female' ? .97 : g === 'male' ? 1.02 : 1);
    return { gender:g, width };
  };

  const professionGroup = role => {
    if (['farmer','rancher','forager','fisher','hunter','beastmaster'].includes(role)) return 'field';
    if (['miner','woodcutter','builder','mason','blacksmith','carpenter','engineer','architect','shipwright','farrier','furniture_maker'].includes(role)) return 'craft';
    if (['merchant','trader','peddler','shopkeeper','innkeeper','banker'].includes(role)) return 'trade';
    if (['healer','doctor','herbalist','alchemist','cleric','priest','druid'].includes(role)) return 'care';
    if (['scholar','teacher','scribe','librarian'].includes(role)) return 'knowledge';
    if (['soldier','militia','archer','spearman','cavalry','knight','paladin','ranger','captain','general','marshal','bodyguard','berserker'].includes(role)) return 'military';
    if (['thief','pickpocket','burglar','bandit','assassin','smuggler','spy','informant'].includes(role)) return 'rogue';
    if (['mage','wizard','sorcerer','warlock','enchanter','necromancer'].includes(role)) return 'magic';
    if (['mayor','governor','baron','count','duke','archduke','prince','princess','king','queen','emperor','empress','heir','royal_advisor','chancellor','judge','lawkeeper','tax_collector'].includes(role)) return 'civic';
    return 'general';
  };

  function drawEquipment(ctx, n, sx, sy, size) {
    const role = n.roleId || n.professionId || 'citizen';
    const group = professionGroup(role);
    const seed = hash(n.id || `${n.x}:${n.y}`, 81);
    const x = Math.round(sx), y = Math.round(sy), h = Math.max(7, Math.round(size));
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.lineWidth = 1;

    if (group === 'field') {
      ctx.strokeStyle = '#8d704b';
      ctx.beginPath(); ctx.moveTo(x + Math.round(h*.28), y - Math.round(h*.45)); ctx.lineTo(x + Math.round(h*.5), y - Math.round(h*.7)); ctx.stroke();
      if (seed > .55) { ctx.fillStyle='#71924f'; ctx.fillRect(x-Math.round(h*.45), y-Math.round(h*.9), 2, 2); }
    } else if (group === 'craft') {
      ctx.fillStyle = '#b9a06b';
      ctx.fillRect(x + Math.round(h*.34), y - Math.round(h*.62), 2, 2);
      if (seed > .45) { ctx.strokeStyle='#c5c5bd'; ctx.beginPath(); ctx.moveTo(x+Math.round(h*.38),y-Math.round(h*.42)); ctx.lineTo(x+Math.round(h*.7),y-Math.round(h*.75)); ctx.stroke(); }
    } else if (group === 'trade') {
      ctx.fillStyle = '#d5b967';
      ctx.fillRect(x + Math.round(h*.35), y - Math.round(h*.55), 2, 2);
      ctx.strokeStyle = '#8b633e';
      ctx.beginPath(); ctx.moveTo(x-Math.round(h*.4),y-Math.round(h*.25)); ctx.lineTo(x-Math.round(h*.62),y+1); ctx.stroke();
    } else if (group === 'care' || group === 'knowledge') {
      ctx.fillStyle = group === 'care' ? '#79b98c' : '#d7c58c';
      ctx.fillRect(x + Math.round(h*.34), y - Math.round(h*.62), 2, 2);
      if (seed > .65) { ctx.fillRect(x + Math.round(h*.5), y - Math.round(h*.7), 1, 3); }
    } else if (group === 'military') {
      ctx.strokeStyle = '#c7c7c0';
      ctx.beginPath(); ctx.moveTo(x+Math.round(h*.35),y-Math.round(h*.25)); ctx.lineTo(x+Math.round(h*.7),y-Math.round(h*.95)); ctx.stroke();
      ctx.fillStyle = seed > .5 ? '#a33f3f' : '#4d657e';
      ctx.fillRect(x-Math.round(h*.55), y-Math.round(h*.72), 2, 3);
    } else if (group === 'rogue') {
      ctx.fillStyle = '#463f4e';
      ctx.fillRect(x-Math.round(h*.55), y-Math.round(h*.75), 2, 3);
      ctx.strokeStyle = '#9a9a94';
      ctx.beginPath(); ctx.moveTo(x+Math.round(h*.25),y-Math.round(h*.2)); ctx.lineTo(x+Math.round(h*.58),y-Math.round(h*.5)); ctx.stroke();
    } else if (group === 'magic') {
      ctx.fillStyle = '#a88ad1';
      ctx.fillRect(x, y-Math.round(h*1.12), 2, 2);
      ctx.globalAlpha = .55; ctx.fillRect(x+2,y-Math.round(h*.98),1,1);
    } else if (group === 'civic') {
      ctx.fillStyle = '#d8bb67';
      ctx.fillRect(x-MMath(h*.18), y-Math.round(h*.98), 3, 1);
    }
    ctx.restore();
  }

  function MMath(v) { return Math.round(v); }

  function draw() {
    if (!state.camera || !Array.isArray(state.npcs)) return;
    const canvas = document.getElementById('worldCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const z = state.camera.zoom || 1;
    const cx = 160 - state.camera.x * z / 8;
    const cy = 90 - state.camera.y * z / 8;
    state.npcs.forEach(n => {
      if (!n.alive) return;
      const sx = cx + n.x * z / 8;
      const sy = cy + n.y * z / 8;
      if (sx < -16 || sx > 336 || sy < -16 || sy > 196) return;
      const military = ['militia','soldier','archer','spearman','cavalry','knight','paladin','captain','general','marshal','berserker','bodyguard'].includes(n.roleId);
      const ageScale = window.EVERGLEN_AGE_VISUALS?.visualScale?.(window.EVERGLEN_AGE_VISUALS.ageBand(n.age)) || 1;
      const raceScale = n.visual?.bodyScale || 1;
      const profile = bodyProfile(n);
      const size = (military ? 16 : 12) * ageScale * raceScale;
      ctx.save();
      ctx.globalAlpha = .72;
      ctx.fillStyle = profile.gender === 'female' ? '#c78fa6' : '#7896b1';
      ctx.fillRect(Math.round(sx - size*.32*profile.width), Math.round(sy-size*.12), Math.max(2,Math.round(size*.64*profile.width)), 1);
      ctx.restore();
      drawEquipment(ctx,n,sx,sy,size);
    });
  }

  window.EVERGLEN_IDENTITY_VISUALS = { genderOf, bodyProfile, professionGroup };
  registry.register({name:'npc-identity-visuals',priority:285,draw});
})();
