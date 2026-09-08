// Phase 3I/3J: dynamic international power, blocs and durable geopolitical history.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const kingdoms=()=>state.kingdoms.filter(k=>!k.civilWarRebel);
  const pop=k=>state.npcs.filter(n=>n.alive&&String(n.faction||n.kingdomId)===String(k.id)).length;
  const hist=event=>{state.internationalHistory=state.internationalHistory||[];state.internationalHistory.unshift({year:state.year,...event});state.internationalHistory=state.internationalHistory.slice(0,300);};
  function ensure(k){k.international=k.international||{powerScore:0,rank:'minor',influence:0,blocId:null,sphere:[],history:[]};return k.international;}
  function score(k){const ss=state.settlements.filter(s=>String(s.kingdomId)===String(k.id));const military=(k.power||25)*1.4+(state.armies||[]).filter(a=>String(a.kingdomId)===String(k.id)).reduce((n,a)=>n+(a.soldiers||0),0)*.35;const economy=ss.reduce((n,s)=>n+(s.wealth||0)+(s.resources?.gold||0)*4,0)*.04+(k.society?.prosperity||50)*1.1;const territory=Math.max(1,ss.length)*4;const tech=k.society?.identity?.knowledge||0;const diplomacy=(k.international?.influence||0)*.7;return Math.round(military+economy+pop(k)*.3+territory+tech+diplomacy+(k.society?.identity?.education||0)*.2);}
  function step(){if(!state.running)return;if(state.tick%120!==0)return;const ks=kingdoms();const ranked=ks.map(k=>({k,s:score(k)})).sort((a,b)=>b.s-a.s);ranked.forEach((x,i)=>{const k=x.k,e=ensure(k);e.powerScore=x.s;e.rank=i<2?'great-power':i<5?'regional-power':'minor-power';e.influence=clamp(x.s*.45+(k.society?.diplomaticTrust||35)*.35);e.history=e.history||[];const old=e._lastScore||x.s;e._lastScore=x.s;if(Math.abs(x.s-old)>Math.max(10,old*.18))hist({type:'power-shift',kingdomId:k.id,from:old,to:x.s,rank:e.rank});});
    ks.forEach((k,i)=>{const e=ensure(k), allies=(state.diplomacy?.treaties||[]).filter(t=>t.status==='active'&&t.type==='alliance'&&(String(t.a)===String(k.id)||String(t.b)===String(k.id)));const partner=allies.map(t=>String(t.a)===String(k.id)?t.b:t.a)[0];e.blocId=partner?`bloc-${[k.id,partner].sort().join('-')}`:null;e.sphere=(k.geopolitics?.neighbors||[]).filter(id=>(state.kingdoms.find(o=>String(o.id)===String(id))?.international?.powerScore||0)<e.powerScore*.65).slice(0,5);if(i===0)ks.forEach(o=>{if(o.id!==k.id&&(!ensure(o).sphere||!ensure(o).sphere.includes(k.id))&&Math.random()<.04){} });});
  }
  window.GREAT_POWERS_HISTORY={step,ensure,score,hist};state.registerSystem?.({name:'great-powers-history',step,priority:112});
})();
