// Everglen Phase 5A: deep medieval production chains.
// Extends the existing economy with staged inputs, bottlenecks and settlement-level industry.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const R=window.NPC_RESOURCES;
  const alive=()=> (state.npcs||[]).filter(n=>n.alive);
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const log=t=>window.SIM_API?.log?.(t);

  const CHAINS={
    agriculture:{input:{},outputs:{grain:.55,food:.22},roles:['farmer','rancher','hunter','fisher','forager'],tier:1},
    milling:{input:{grain:.7},outputs:{food:.9},roles:['baker','cook','brewer'],tier:2},
    textiles:{input:{wool:.5,leather:.25},outputs:{cloth:.65},roles:['weaver'],tier:2},
    carpentry:{input:{wood:1.1,tools:.15},outputs:{tools:.35,boats:.03},roles:['carpenter','builder','furniture_maker'],tier:2},
    smithing:{input:{iron:1,tools:.12},outputs:{weapons:.32,armor:.14,tools:.28},roles:['blacksmith','farrier'],tier:2},
    medicine:{input:{herbs:.8,reagents:.15},outputs:{medicine:.5},roles:['healer','doctor','alchemist','herbalist'],tier:2},
    scholarship:{input:{paper:.35,books:.04},outputs:{books:.06},roles:['scholar','scribe','librarian','teacher'],tier:3},
    shipbuilding:{input:{wood:2.2,iron:.35,tools:.2},outputs:{boats:.08,battle_boats:.018},roles:['shipwright'],tier:3},
    advanced_metal:{input:{iron:1.4,mithril:.03,adamantine:.008,emberite:.01},outputs:{armor:.22,weapons:.18},roles:['blacksmith','enchanter'],tier:4},
    arcane_craft:{input:{reagents:.75,moonstone:.025,voidstone:.01,starsteel:.002},outputs:{medicine:.08,books:.03,armor:.05},roles:['mage','wizard','enchanter','alchemist'],tier:4}
  };

  function ensure(s){
    s.production=s.production||{chains:{},bottlenecks:[],efficiency:50,industry:0,history:[]};
    s.production.chains=s.production.chains||{};s.production.bottlenecks=s.production.bottlenecks||[];s.production.history=s.production.history||[];
    return s;
  }
  function inventory(s){R?.ensureSettlement?.(s);s.resources=s.resources||{};return s.resources;}
  function residents(s,roles){return alive().filter(n=>n.settlementId===s.id&&roles.includes(n.roleId));}
  function tierAvailable(s,tier){return (s.type==='village'?1:s.type==='town'?2:s.type==='city'?3:4)>=tier;}

  function runChain(s,id,chain){
    const p=ensure(s),inv=inventory(s);if(!tierAvailable(s,chain.tier))return {status:'locked'};
    const workers=residents(s,chain.roles);if(!workers.length)return {status:'inactive'};
    let ratio=1;const missing=[];
    for(const [resource,needBase] of Object.entries(chain.input)){
      const need=needBase*workers.length*.012*Math.max(1,state.speed);
      const have=inv[resource]||0;
      const r=have/Math.max(.001,need);ratio=Math.min(ratio,r);
      if(r<.65)missing.push(resource);
    }
    const efficiency=clamp((.65+workers.length*.03)*(1+(p.infrastructure?.workshops||0)/150),.45,1.55);
    ratio=Math.min(1,ratio)*efficiency;
    if(ratio<=.03)return {status:'starved',missing};
    for(const [resource,needBase] of Object.entries(chain.input)){
      const used=needBase*workers.length*.012*ratio;
      inv[resource]=Math.max(0,(inv[resource]||0)-used);
    }
    for(const [resource,outBase] of Object.entries(chain.outputs)){
      const made=outBase*workers.length*.012*ratio;
      inv[resource]=(inv[resource]||0)+made;
    }
    const record=p.production.chains[id]||{runs:0,output:0,efficiency:0};
    record.runs++;record.output+=(chain.outputs.food||chain.outputs.grain||chain.outputs.cloth||0)*workers.length*.012*ratio;record.efficiency=(record.efficiency+ratio*100)/2;p.production.chains[id]=record;
    return {status:'active',ratio,missing};
  }

  function economyFeedback(s){
    const p=ensure(s),chains=Object.entries(p.production.chains);const active=chains.filter(([,c])=>c.runs>0);const bottlenecks=p.production.bottlenecks.length;
    p.production.industry=clamp(active.length*7+(s.infrastructure?.workshops||0)*.45+active.reduce((a,[,c])=>a+c.efficiency,0)*.035,0,100);
    p.production.efficiency=clamp(52+p.production.industry*.45-bottlenecks*4,0,100);
    s.economy&&(s.economy.prosperity=clamp((s.economy.prosperity||0)+p.production.efficiency*.012));
  }

  function step(){
    if(!state.running)return;
    (state.settlements||[]).forEach(s=>{
      const p=ensure(s);p.production.bottlenecks=[];
      for(const [id,chain] of Object.entries(CHAINS)){
        const result=runChain(s,id,chain);if(result.status==='starved'||result.status==='inactive'){
          if(result.status==='starved'&&result.missing?.length)p.production.bottlenecks.push({chain:id,missing:result.missing,year:state.year});
        }
      }
      p.production.bottlenecks=p.production.bottlenecks.slice(-12);economyFeedback(s);
      if(state.tick%180===0&&p.production.bottlenecks.length>=3){
        const text=`${s.name}'s workshops are constrained by shortages in the production chain.`;
        p.production.history.push(`Year ${state.year}: ${text}`);p.production.history=p.production.history.slice(-24);log(text);
      }
    });
  }

  window.EVERGLEN_PRODUCTION={CHAINS,ensure,runChain,step};
  if(state.registerSystem)state.registerSystem({name:'deep-production-chains',step,priority:52});
})();
