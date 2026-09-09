(() => {
  const state=window.SIM_STATE;if(!state)return;
  const W=1400,H=1000;
  let seed=Math.floor(Math.random()*2147483647);
  const cultures=[
    {id:'highland',name:'Highland',architecture:'stone'},
    {id:'riverland',name:'Riverland',architecture:'timber'},
    {id:'coastal',name:'Coastal',architecture:'plaster'},
    {id:'forest',name:'Forest',architecture:'wood'},
    {id:'steppe',name:'Steppe',architecture:'mud'}
  ];
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const hash=(x,y,s=0)=>{let n=Math.sin(x*127.1+y*311.7+seed*0.000013+s*74.3)*43758.5453123;return n-Math.floor(n);};
  const smooth=t=>t*t*(3-2*t);
  const valueNoise=(x,y,s=0)=>{const ix=Math.floor(x),iy=Math.floor(y),fx=smooth(x-ix),fy=smooth(y-iy),a=hash(ix,iy,s),b=hash(ix+1,iy,s),c=hash(ix,iy+1,s),d=hash(ix+1,iy+1,s);return a+(b-a)*fx+((c+(d-c)*fx)-(a+(b-a)*fx))*fy;};
  const fbm=(x,y)=>valueNoise(x,y,1)*.52+valueNoise(x*2,y*2,2)*.28+valueNoise(x*4,y*4,3)*.14+valueNoise(x*8,y*8,4)*.06;
  function makeIslands(){
    const jitter=(v,s)=>v+(hash(s,91,7)-.5)*120;
    return[
      {x:jitter(-180,1),y:jitter(-40,2),rx:500+hash(1,3,8)*90,ry:330+hash(2,4,8)*70},
      {x:jitter(430,3),y:jitter(-95,4),rx:280+hash(3,5,8)*70,ry:205+hash(4,6,8)*55},
      {x:jitter(-470,5),y:jitter(300,6),rx:190+hash(5,7,8)*65,ry:125+hash(6,8,8)*45},
      {x:jitter(455,7),y:jitter(315,8),rx:125+hash(7,9,8)*55,ry:85+hash(8,10,8)*35},
      {x:jitter(-10,9),y:jitter(405,10),rx:80+hash(9,11,8)*45,ry:55+hash(10,12,8)*25}
    ];
  }
  let islands=makeIslands();
  function islandScore(x,y){let best=-1;for(const p of islands){const dx=(x-p.x)/p.rx,dy=(y-p.y)/p.ry,d=dx*dx+dy*dy;best=Math.max(best,1-d);}return best;}
  function elevationAt(x,y){const base=islandScore(x,y),n=fbm(x/190,y/190),detail=fbm(x/72+17,y/72-9);return base*.72+(n-.5)*.42+(detail-.5)*.18;}
  function moistureAt(x,y){return clamp(.62-fbm(x/260+31,y/260-7)*.55+Math.sin((x+y)/410)*.08,0,1);}
  function temperatureAt(x,y){return clamp(.72-Math.abs(y)/1000*.46+Math.sin(x/370)*.08,0,1);}
  let riverSources=[];
  function makeRivers(){return islands.slice(0,3).map((p,i)=>({x:p.x-p.rx*.35,y:p.y-p.ry*.55,dx:(i===1?-0.25:0.25),dy:.9,len:Math.min(650,p.ry*2.1)}));}
  riverSources=makeRivers();
  function riverAt(x,y){for(const r of riverSources){for(let t=0;t<r.len;t+=14){const px=r.x+r.dx*t+Math.sin(t/43+r.x)*18,py=r.y+r.dy*t+Math.cos(t/51+r.y)*14;if((x-px)**2+(y-py)**2<28**2&&elevationAt(x,y)>.18)return true;}}return false;}
  function landAt(x,y){return elevationAt(x,y)>.34;}
  function biomeAt(x,y){if(!landAt(x,y))return'water';if(riverAt(x,y))return'water';const e=elevationAt(x,y),m=moistureAt(x,y),t=temperatureAt(x,y);if(e>.78)return'highlands';if(t<.28)return'tundra';if(m>.70)return'forest';if(m<.22&&t>.58)return'steppe';return'plains';}
  function nearestLand(x,y){if(landAt(x,y))return{x,y};for(let r=18;r<700;r+=18)for(let a=0;a<Math.PI*2;a+=Math.PI/16){const px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;if(landAt(px,py))return{x:px,y:py};}return{x:islands[0].x,y:islands[0].y};}
  function buildWorld(){
    islands=makeIslands();riverSources=makeRivers();
    state.worldGen={seed,biomes:[],resources:[],landmarks:[],rivers:riverSources.map(r=>({...r})),islands:islands.map(p=>({...p}))};
    const resourceKinds={iron:['highlands','forest'],gold:['highlands','steppe'],stone:['highlands'],wood:['forest'],food:['plains','forest'],cloth:['plains'],medicine:['forest'],reagents:['forest','highlands']};
    for(let x=-680;x<=680;x+=70)for(let y=-480;y<=480;y+=70){const b=biomeAt(x,y);if(b!=='water')state.worldGen.biomes.push({x,y,biome:b,elevation:elevationAt(x,y),moisture:moistureAt(x,y)});}
    let id=0;for(let x=-650;x<=650;x+=105)for(let y=-450;y<=450;y+=105){const b=biomeAt(x,y),choices=Object.keys(resourceKinds).filter(k=>resourceKinds[k].includes(b));if(choices.length&&hash(x,y,9)>.62)state.worldGen.resources.push({id:`node-${id++}`,type:choices[Math.floor(hash(x,y,10)*choices.length)],x,y,amount:40+Math.floor(hash(x,y,11)*100),depleted:false});}
    const names=['Ancient Ruins','Fallen Watchtower','Sacred Grove','Old Quarry','Bandit Hollow','Stone Circle','Forgotten Shrine','Crystal Grotto'];
    names.forEach((name,i)=>{const p=nearestLand(-570+hash(i,4)*1140,-390+hash(i,7)*780);state.worldGen.landmarks.push({name,x:p.x,y:p.y,discovered:false,type:i%3});});
  }
  function sync(){
    (state.kingdoms||[]).forEach((k,i)=>{k.cultureId=k.cultureId||cultures[i%cultures.length].id;const c=cultures.find(x=>x.id===k.cultureId)||cultures[0];k.cultureName=c.name;k.architecture=c.architecture;k.culture=k.culture&&typeof k.culture==='object'?k.culture:{id:c.id,name:c.name,tradition:c.name.toLowerCase(),dominant:c.id,values:{},traditions:[],history:[]};});
    (state.settlements||[]).forEach((s,i)=>{if(!landAt(s.x,s.y)){const p=nearestLand(s.x,s.y);s.x=p.x;s.y=p.y;}const k=state.kingdoms?.find(x=>x.id===s.kingdomId),c=cultures.find(x=>x.id===k?.cultureId)||cultures[i%cultures.length];s.cultureId=c.id;s.cultureName=c.name;s.architecture=c.architecture;s.environment=biomeAt(s.x,s.y);s.culture=s.culture&&typeof s.culture==='object'?s.culture:{id:c.id,name:c.name,tradition:c.name.toLowerCase(),dominant:c.id,values:{},traditions:[],history:[]};});
    (state.npcs||[]).forEach(n=>{if(!landAt(n.x,n.y)){const p=nearestLand(n.x,n.y);n.x=p.x;n.y=p.y;}n.visual=n.visual||{};n.visual.bodyScale=n.visual.bodyScale??(0.92+(n.status||0)*.0015+(n.sex==='M'?.03:0));n.visual.skin=n.visual.skin||['#6b4226','#8c5a36','#b97950','#d49b72','#f0c39d'][Math.floor(hash(n.id,2)*5)];n.visual.hair=n.visual.hair||['#251a16','#3a261b','#5a3524','#241f22','#7a5436'][Math.floor(hash(n.id,3)*5)];n.visual.hairStyle=n.visual.hairStyle||['short','long','braided','cropped'][Math.floor(hash(n.id,4)*4)];});
  }
  function rebuild(){seed=Math.floor(Math.random()*2147483647);buildWorld();sync();window.EVERGLEN_WORLD.seed=seed;window.EVERGLEN_WORLD.islands=islands;}
  buildWorld();sync();
  window.EVERGLEN_WORLD={seed,cultures,biomeAt,landAt,elevationAt,moistureAt,temperatureAt,riverAt,islands,rebuild};
  document.addEventListener('click',e=>{const b=e.target.closest?.('[data-event="reset"]');if(b)setTimeout(rebuild,0);});
  setInterval(()=>{if(state.running)sync();},1200);
})();
