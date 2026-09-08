// Phase 2 feedback bridge: civilization institutions feed the existing political engine.
// This is intentionally state-only: no DOM listeners, no render loop, no duplicate elections.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const alive=()=>state.npcs.filter(n=>n.alive);
  const byKingdom=kid=>alive().filter(n=>n.faction===kid);
  function institutionTotals(kid){
    const out={guild:0,council:0,court:0,military:0,academy:0,faith:0};
    (state.settlements||[]).filter(s=>s.kingdomId===kid).forEach(s=>Object.entries(s.society?.institutions||{}).forEach(([id,inst])=>{if(out[id]!=null)out[id]+=inst.power||0;}));
    return out;
  }
  function step(){
    if(!state.running)return;
    state.kingdoms?.forEach(k=>{
      const p=byKingdom(k.id),t=institutionTotals(k.id);
      k.politics=k.politics||{nobles:20,merchants:20,commons:50,clergy:10,army:0};
      const shares={
        nobles:p.filter(n=>['nobility','royalty'].includes(n.society?.class)).length,
        merchants:p.filter(n=>['merchant'].includes(n.society?.class)).length,
        commons:p.filter(n=>['peasant','artisan'].includes(n.society?.class)).length,
        clergy:p.filter(n=>n.society?.class==='clergy').length,
        army:p.filter(n=>n.society?.class==='soldier').length
      };
      const total=Math.max(1,p.length);
      const normalize=v=>Math.round((v/total)*100);
      k.politics.nobles=clamp(normalize(shares.nobles*.9+t.court*.08),0,100);
      k.politics.merchants=clamp(normalize(shares.merchants*.9+t.guild*.06),0,100);
      k.politics.commons=clamp(normalize(shares.commons*.9+t.council*.05),0,100);
      k.politics.clergy=clamp(normalize(shares.clergy*.9+t.faith*.08),0,100);
      k.politics.army=clamp(normalize(shares.army*.9+t.military*.07),0,100);
      k.society=k.society||{};
      k.society.institutionalPolitics={...k.politics,year:state.year};

      // Society feeds individual motivations without replacing Phase 1 goal planning.
      p.forEach(n=>{
        n.society=n.society||{};
        const c=n.society.class;
        const pressure=c==='merchant'?t.guild*.025:c==='soldier'?t.military*.025:c==='clergy'?t.faith*.025:c==='nobility'||c==='royalty'?t.court*.025:t.council*.018;
        n.society.ambitionPressure=clamp((n.society.ambitionPressure||0)*.96+pressure);
        if(n.society.ambitionPressure>40)n.influence=Math.min(100,(n.influence||0)+.015);
      });
    });
  }
  window.SOCIETY_POLITICAL_FEEDBACK={step};
  state.registerSystem?.({name:'society-political-feedback',step,priority:96});
})();
