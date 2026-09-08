(() => {
  const TRAITS = {
    brave:{courage:25,risk:12,aggression:8,sociability:0,ambition:4,discipline:2,curiosity:0,kindness:0,loyalty:2,cleverness:2},
    curious:{courage:0,risk:5,aggression:-2,sociability:2,ambition:2,discipline:0,curiosity:25,kindness:1,loyalty:0,cleverness:8},
    ambitious:{courage:3,risk:6,aggression:2,sociability:0,ambition:25,discipline:6,curiosity:3,kindness:-1,loyalty:0,cleverness:4},
    kind:{courage:0,risk:-2,aggression:-10,sociability:8,ambition:-1,discipline:2,curiosity:1,kindness:25,loyalty:5,cleverness:0},
    greedy:{courage:0,risk:7,aggression:3,sociability:-1,ambition:10,discipline:1,curiosity:0,kindness:-8,loyalty:-4,cleverness:2},
    loyal:{courage:2,risk:-1,aggression:0,sociability:5,ambition:1,discipline:7,curiosity:0,kindness:4,loyalty:25,cleverness:0},
    stubborn:{courage:5,risk:3,aggression:4,sociability:-4,ambition:7,discipline:6,curiosity:-6,kindness:-2,loyalty:5,cleverness:-2},
    clever:{courage:0,risk:2,aggression:0,sociability:2,ambition:7,discipline:5,curiosity:12,kindness:0,loyalty:1,cleverness:25},
    reckless:{courage:10,risk:25,aggression:10,sociability:0,ambition:4,discipline:-10,curiosity:6,kindness:-2,loyalty:-2,cleverness:2},
    calm:{courage:2,risk:-8,aggression:-10,sociability:4,ambition:0,discipline:8,curiosity:2,kindness:4,loyalty:3,cleverness:2},
    social:{courage:0,risk:0,aggression:-3,sociability:25,ambition:1,discipline:0,curiosity:4,kindness:6,loyalty:4,cleverness:1},
    hardworking:{courage:0,risk:0,aggression:0,sociability:-2,ambition:7,discipline:25,curiosity:1,kindness:2,loyalty:3,cleverness:2}
  };
  const KEYS=['courage','risk','aggression','sociability','ambition','discipline','curiosity','kindness','loyalty','cleverness'];
  const clamp=v=>Math.max(0,Math.min(100,Math.round(v)));
  const hash=id=>{let h=2166136261;for(const c of String(id))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
  function ensure(n){
    if(!n.personality){const base=35+(hash(n.id)%31),keys=Object.keys(TRAITS);const primary=n.trait||'calm',secondary=keys[hash(String(n.id)+':secondary')%keys.length];n.personality={traits:[primary,secondary===primary?'clever':secondary],base:Object.fromEntries(KEYS.map(k=>[k,k==='ambition'?(n.ambition??base):k==='loyalty'?(n.loyalty??base):base])),courage:base,risk:base,aggression:base,sociability:base,ambition:n.ambition??base,discipline:base,curiosity:base,kindness:base,loyalty:n.loyalty??base,cleverness:base};applyTraits(n);}else{n.personality.base=n.personality.base||Object.fromEntries(KEYS.map(k=>[k,n.personality[k]??50]));n.personality.cleverness=n.personality.cleverness??n.personality.base.cleverness??50;}
    return n.personality;
  }
  function applyTraits(n){const p=ensureBase(n),traits=p.traits||[],values=Object.fromEntries(KEYS.map(k=>[k,p.base[k]??50]));traits.forEach(t=>{const mod=TRAITS[t];if(!mod)return;KEYS.forEach(k=>values[k]+=mod[k]||0);});KEYS.forEach(k=>p[k]=clamp(values[k]));n.ambition=p.ambition;n.loyalty=p.loyalty;return p;}
  function ensureBase(n){if(!n.personality)return ensure(n);if(!n.personality.base)n.personality.base=Object.fromEntries(KEYS.map(k=>[k,n.personality[k]??50]));return n.personality;}
  function addTrait(n,trait){const p=ensure(n);p.traits=p.traits||[];if(!p.traits.includes(trait)&&TRAITS[trait])p.traits.push(trait);applyTraits(n);return p;}
  function has(n,trait){return ensure(n).traits.includes(trait);}
  function score(n,key){return ensure(n)[key]??50;}
  function develop(n,event,amount=1){const p=ensure(n);const map={study:{curiosity:.6,cleverness:1,discipline:.25},work:{discipline:.5,cleverness:.25},explore:{curiosity:.8,courage:.2,risk:.1},combat:{courage:.5,discipline:.25},social:{sociability:.5,kindness:.2},leadership:{ambition:.4,loyalty:.25,cleverness:.2}};const m=map[event];if(!m)return p;Object.entries(m).forEach(([k,v])=>{p.base[k]=clamp((p.base[k]??50)+v*amount);});applyTraits(n);n.personalityGrowth=n.personalityGrowth||{};n.personalityGrowth[event]=(n.personalityGrowth[event]||0)+amount;return p;}
  window.NPC_PERSONALITY={TRAITS,KEYS,ensure,applyTraits,addTrait,has,score,develop};
})();
