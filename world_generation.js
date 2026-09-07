(() => {
  const state = window.SIM_STATE;
  if (!state) return;
  const seed = Math.floor(Math.random() * 1e9);
  const rand = (a,b) => a + Math.random()*(b-a);
  const pick = a => a[Math.floor(Math.random()*a.length)];
  const W=1400,H=1000;
  const cultures=[
    {id:'highland',name:'Highland',architecture:'stone'},
    {id:'riverland',name:'Riverland',architecture:'timber'},
    {id:'coastal',name:'Coastal',architecture:'plaster'},
    {id:'forest',name:'Forest',architecture:'wood'},
    {id:'steppe',name:'Steppe',architecture:'mud'}
  ];
  function noise(x,y,s=1){return (Math.sin((x+seed%97)*.011*s)+Math.cos((y-seed%131)*.013*s)+Math.sin((x+y)*.005*s))/3;}
  function biomeAt(x,y){
    const n=noise(x,y),m=noise(x,y,2.2),edge=Math.min(W/2-Math.abs(x),H/2-Math.abs(y));
    if(edge<45)return'coast'; if(n>.42)return'highlands'; if(n<-.4)return'wetlands'; if(m>.42)return'forest'; if(m<-.35)return'steppe'; return'plains';
  }
  function buildWorld(){
    state.worldGen={seed,biomes:[],resources:[],landmarks:[]};
    const kinds={iron:['highlands','forest'],gold:['highlands','steppe'],stone:['highlands'],wood:['forest'],food:['plains','wetlands'],cloth:['plains'],medicine:['forest','wetlands'],reagents:['forest','wetlands']};
    for(let i=0;i<54;i++){
      const x=rand(-W/2+30,W/2-30),y=rand(-H/2+30,H/2-30),biome=biomeAt(x,y);
      state.worldGen.biomes.push({x,y,biome,scale:rand(.7,1.5)});
      if(Math.random()<.65){const e=Object.keys(kinds).filter(r=>kinds[r].includes(biome));if(e.length)state.worldGen.resources.push({id:`node-${i}`,type:pick(e),x,y,amount:Math.floor(rand(30,120)),depleted:false});}
    }
    ['Ancient Ruins','Fallen Watchtower','Sacred Grove','Old Quarry','Bandit Hollow','Stone Circle','Forgotten Shrine','Crystal Grotto'].forEach((name,i)=>state.worldGen.landmarks.push({name,x:rand(-620,620),y:rand(-420,420),discovered:false,type:i%3}));
  }
  function sync(){
    (state.kingdoms||[]).forEach((k,i)=>{k.cultureId=k.cultureId||cultures[i%cultures.length].id;const c=cultures.find(x=>x.id===k.cultureId)||cultures[0];k.culture=c.name;k.architecture=c.architecture;});
    (state.settlements||[]).forEach((s,i)=>{const k=state.kingdoms?.find(x=>x.id===s.kingdomId),c=cultures.find(x=>x.id===k?.cultureId)||cultures[i%cultures.length];s.cultureId=c.id;s.culture=c.name;s.architecture=c.architecture;s.environment=biomeAt(s.x,s.y);});
    (state.npcs||[]).forEach(n=>{n.visual=n.visual||{};n.visual.bodyScale=n.visual.bodyScale??(0.82+(n.status||0)*.0015+(n.sex==='M'?.03:0));n.visual.skin=n.visual.skin||pick(['#6b4226','#8c5a36','#b97950','#d49b72','#f0c39d']);n.visual.hair=n.visual.hair||pick(['#251a16','#3a261b','#5a3524','#241f22','#7a5436']);n.visual.hairStyle=n.visual.hairStyle||pick(['short','long','braided','cropped']);});
  }
  buildWorld();sync();
  window.EVERGLEN_WORLD={seed,cultures,biomeAt,rebuild:()=>{buildWorld();sync();}};
  setInterval(()=>{if(state.running)sync();},1200);
})();
