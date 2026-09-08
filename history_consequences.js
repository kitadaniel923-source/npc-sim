// Phase 4H: historical consequences.
// Turns accumulated world history into persistent regional, family, cultural and
// strategic modifiers. Reads existing history; does not replace the history engine.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const alive=()=>state.npcs.filter(n=>n.alive);
  const remember=(n,text,type='history',importance=3,subjectId=null,mood='pride')=>window.NPC_MEMORY?.remember?.(n,text,type,importance,subjectId,mood);
  const log=text=>window.SIM_API?.log?.(text);
  const pushUnique=(arr,value,max=12)=>{arr=Array.isArray(arr)?arr:[];if(!arr.includes(value))arr.push(value);return arr.slice(-max);};

  function ensureRegion(s){
    s.historyEffects=s.historyEffects||{warMemory:0,disasterMemory:0,prosperityMemory:0,discoveryMemory:0,migrationMemory:0,recovery:0,identityTags:[],famousEvents:[]};
    return s.historyEffects;
  }
  function ensureKingdom(k){
    k.historyEffects=k.historyEffects||{grudges:{},prestige:0,legacy:[],historicalClaims:[],victoryMemory:0,defeatMemory:0};
    return k.historyEffects;
  }
  function ensureFamily(f){
    f.historicalLegacy=f.historicalLegacy||{prestige:0,grudges:[],honors:[],legends:[]};
    return f.historicalLegacy;
  }

  function classify(text){
    const t=String(text||'').toLowerCase();
    if(/war|battle|siege|raid|conquer|occupation|rebellion|civil war/.test(t))return'war';
    if(/famine|plague|storm|meteor|disaster|fire|drought/.test(t))return'disaster';
    if(/trade|market|prosper|harvest|rich|wealth|guild/.test(t))return'prosperity';
    if(/discover|explor|academy|knowledge|found|new land|resource/.test(t))return'discovery';
    if(/migrat|refugee|arrived|left for/.test(t))return'migration';
    if(/king|queen|ruler|dynast|succession|heir|title/.test(t))return'ruler';
    return'other';
  }

  function regionEvents(s){
    return (s.history||[]).slice(-60).map((text,i)=>({text,kind:classify(text),key:`${state.year}-${i}-${text}`}));
  }

  function applyRegional(s){
    const e=ensureRegion(s);const events=regionEvents(s);e.warMemory=clamp(e.warMemory+(events.filter(x=>x.kind==='war').length*.018-e.warMemory*.002));e.disasterMemory=clamp(e.disasterMemory+(events.filter(x=>x.kind==='disaster').length*.022-e.disasterMemory*.002));e.prosperityMemory=clamp(e.prosperityMemory+(events.filter(x=>x.kind==='prosperity').length*.016-e.prosperityMemory*.002));e.discoveryMemory=clamp(e.discoveryMemory+(events.filter(x=>x.kind==='discovery').length*.014-e.discoveryMemory*.002));e.migrationMemory=clamp(e.migrationMemory+(events.filter(x=>x.kind==='migration').length*.02-e.migrationMemory*.002));e.recovery=clamp(e.recovery+((e.disasterMemory<20&&e.prosperityMemory>10)?0.06:-0.01));
    const tags=[];if(e.warMemory>3)tags.push('war-scarred');if(e.disasterMemory>3)tags.push('disaster-hardened');if(e.prosperityMemory>3)tags.push('prosperous-tradition');if(e.discoveryMemory>2.5)tags.push('explorer-hub');if(e.migrationMemory>3)tags.push('migrant-region');if(e.recovery>60)tags.push('resilient');e.identityTags=tags;
    if(e.warMemory>45)s.stability=clamp((s.stability||60)-.012);if(e.prosperityMemory>45)s.wealth=(s.wealth||0)+.018;if(e.discoveryMemory>35)s.infrastructure&&(s.infrastructure.knowledge=clamp((s.infrastructure.knowledge||0)+.012));if(e.recovery>65)s.stability=clamp((s.stability||60)+.014);
    return e;
  }

  function kingdomConsequences(k){
    const ef=ensureKingdom(k);const people=alive().filter(n=>n.faction===k.id);const settlements=(state.settlements||[]).filter(s=>s.kingdomId===k.id||people.some(n=>n.settlementId===s.id));let wars=0,victories=0,defeats=0,trade=0,discoveries=0;
    settlements.forEach(s=>{const e=ensureRegion(s);wars+=e.warMemory;trade+=e.prosperityMemory;discoveries+=e.discoveryMemory;});
    const recent=(k.history||[]).slice(-40);recent.forEach(text=>{const t=String(text).toLowerCase();if(/victor|won|captured|conquer/.test(t))victories++;if(/lost|defeat|surrender|fell/.test(t))defeats++;});
    ef.victoryMemory=clamp(ef.victoryMemory+victories*.04-defeats*.025);ef.defeatMemory=clamp(ef.defeatMemory+defeats*.05-victories*.018);ef.prestige=clamp(ef.prestige+(victories*.015+trade*.002-discoveries*.001));
    const rivals=new Set();if(k.strategy?.threats)Object.keys(k.strategy.threats).slice(0,8).forEach(id=>rivals.add(id));
    rivals.forEach(id=>{ef.grudges[id]=clamp((ef.grudges[id]||0)+(ef.defeatMemory>25?.03:0)+(ef.victoryMemory>30?.006:0));});
    if(ef.victoryMemory>65){ef.legacy=pushUnique(ef.legacy,`Year ${state.year}: ${k.name} is remembered for repeated victories.`);}
    if(ef.defeatMemory>65){ef.legacy=pushUnique(ef.legacy,`Year ${state.year}: ${k.name} carries the memory of severe defeats.`);}
    return ef;
  }

  function dynastyConsequences(){
    (state.families||[]).forEach(f=>{
      const l=ensureFamily(f);const members=alive().filter(n=>n.familyId===f.id);if(!members.length)return;
      const rulers=members.filter(n=>['king','queen','emperor','empress','duke','count','baron','lord'].includes(n.roleId));
      const high=(f.prestige||0)+members.length*.8+rulers.length*5+(f.successionDisputes?Math.max(0,20-f.successionDisputes):0);
      l.prestige=clamp(l.prestige*.995+high*.02);
      if(rulers.length&&l.prestige>55)l.honors=pushUnique(l.honors,`House of ${f.name}: ruling bloodline`);
      if((f.successionDisputes||0)>2)l.grudges=pushUnique(l.grudges,`Succession disputes in the house of ${f.name}`);
      if((f.reputation||50)>80)l.legends=pushUnique(l.legends,`${f.name} is remembered as an influential family.`);
      members.slice(0,8).forEach(n=>{n.familyPrestige=clamp((n.familyPrestige||0)*.99+l.prestige*.03);if(l.prestige>70)remember(n,`My family, ${f.name}, carries a powerful historical legacy.`,'family_history',3.1,f.id,'pride');});
    });
  }

  function culturalConsequences(){
    const byCulture=new Map();alive().forEach(n=>{const id=n.culture?.id||'tradition';if(!byCulture.has(id))byCulture.set(id,[]);byCulture.get(id).push(n)});
    (state.settlements||[]).forEach(s=>{const e=ensureRegion(s);const residents=alive().filter(n=>n.settlementId===s.id);if(!residents.length)return;const dominant=[...byCulture.entries()].filter(([,p])=>p.some(n=>n.settlementId===s.id)).sort((a,b)=>b[1].filter(n=>n.settlementId===s.id).length-a[1].filter(n=>n.settlementId===s.id).length)[0];if(!dominant)return;const id=dominant[0];const influence=s.culture?.influences||{};influence[id]=(influence[id]||0)+.01*(1+e.warMemory*.01);if(s.culture)s.culture.influences=influence;if(e.warMemory>50&&s.culture) s.culture.traditions=pushUnique(s.culture.traditions,'Remembrance Day',8);if(e.migrationMemory>50&&s.culture)s.culture.traditions=pushUnique(s.culture.traditions,'Migrant Feast',8);});
  }

  function npcConsequences(){
    alive().slice(0,Math.min(1200,alive().length)).forEach(n=>{const s=state.settlements.find(x=>x.id===n.settlementId);if(!s)return;const e=ensureRegion(s);n.historicalPressure=n.historicalPressure||{};n.historicalPressure.war=e.warMemory;n.historicalPressure.disaster=e.disasterMemory;n.historicalPressure.prosperity=e.prosperityMemory;n.historicalPressure.discovery=e.discoveryMemory;n.historicalPressure.migration=e.migrationMemory;if(e.warMemory>60){n.conflictCount=(n.conflictCount||0)+.002;if(['honor','strength'].includes(n.culture?.id)&&Math.random()<.01)remember(n,`Our region remembers years of war.`,'regional_history',2.7,s.id,'pride');}if(e.disasterMemory>60){n.grievance=clamp((n.grievance||0)+.006);if(Math.random()<.006)remember(n,`My people endured disasters here.`,'regional_history',2.8,s.id,'fear');}if(e.discoveryMemory>45&&n.age>=13)n.education=clamp((n.education||0)+.006);if(e.prosperityMemory>50)n.reputation=clamp((n.reputation||50)+.004);});
  }

  function step(){
    if(!state.running||state.tick%30!==0)return;
    (state.settlements||[]).forEach(applyRegional);(state.kingdoms||[]).forEach(kingdomConsequences);dynastyConsequences();culturalConsequences();npcConsequences();
    if(state.regionalHistory?.events){const recent=state.regionalHistory.events.slice(-4);recent.forEach(x=>{const s=state.settlements.find(v=>String(v.id)===String(x.settlementId||x.ref));if(s){const e=ensureRegion(s);e.famousEvents=pushUnique(e.famousEvents,x.text||x.description||x.event||'Historical event',10);}});}
  }
  window.EVERGLEN_HISTORY_CONSEQUENCES={step,applyRegional,kingdomConsequences};
  if(state.registerSystem)state.registerSystem({name:'history-consequences',step,priority:113});
})();
