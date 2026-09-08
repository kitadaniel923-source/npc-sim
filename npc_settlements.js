// Settlement and city simulation layer.
// Turns settlements into living economic and demographic systems.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const resources=window.NPC_RESOURCES;
  const memory=window.NPC_MEMORY;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const alive=()=>state.npcs.filter(n=>n.alive);
  const score=(n,k)=>window.NPC_PERSONALITY?.score(n,k)??50;

  function ensure(s){
    s.infrastructure=s.infrastructure||{roads:0,housing:0,water:0,workshops:0,defenses:0,knowledge:0};
    s.demographics=s.demographics||{births:0,deaths:0,immigrants:0,emigrants:0};
    s.services=s.services||{health:20,education:15,security:15,trade:15};
    s.economy=s.economy||{prosperity:35,employment:60,foodSecurity:60,marketAccess:20};
    s.districts=s.districts||[];
    s.growthPressure=s.growthPressure??0;
    s.crowding=s.crowding??0;
    return s;
  }

  function capacity(s){
    ensure(s);
    const base=s.type==='village'?35:s.type==='city'?140:s.type==='kingdom'?450:35;
    return Math.max(base,Math.floor((s.homes||5)*2.2+(s.infrastructure.housing||0)*10));
  }

  function population(s){return alive().filter(n=>n.settlementId===s.id);}

  function labor(s,p){
    const workers=p.filter(n=>n.age>=16&&n.age<=70);
    const employed=workers.filter(n=>n.roleId&&n.roleId!=='citizen'&&n.roleId!=='refugee'&&n.roleId!=='prisoner').length;
    s.economy.employment=clamp(employed/Math.max(1,workers.length)*100);
    return workers;
  }

  function infrastructureStep(s,p){
    ensure(s);
    const workers=labor(s,p);
    const builders=workers.filter(n=>['builder','engineer','architect','carpenter','mason'].includes(n.roleId));
    const craftsmen=workers.filter(n=>['blacksmith','weaver','builder','engineer','shipwright'].includes(n.roleId));
    const scholars=workers.filter(n=>['scholar','teacher','scribe','librarian'].includes(n.roleId));
    const soldiers=workers.filter(n=>['militia','soldier','archer','spearman','knight','captain','general','marshal'].includes(n.roleId));
    const food=(s.resources?.food||0),wood=(s.resources?.wood||0),stone=(s.resources?.stone||0),tools=(s.resources?.tools||0),gold=(s.resources?.gold||0);
    if(builders.length&&wood>3&&stone>2&&tools>1){
      const work=Math.min(builders.length*.012*state.speed,wood/6,stone/5,tools/2);
      s.infrastructure.housing+=work*.8;s.infrastructure.roads+=work*.25;s.infrastructure.workshops+=work*.15;
      s.resources.wood=Math.max(0,wood-work*2.5);s.resources.stone=Math.max(0,stone-work*2.1);s.resources.tools=Math.max(0,tools-work*.7);
    }
    if(craftsmen.length>2)s.infrastructure.workshops=clamp(s.infrastructure.workshops+craftsmen.length*.002*state.speed,0,100);
    if(s.type!=='village'&&scholars.length>0)s.infrastructure.knowledge=clamp(s.infrastructure.knowledge+scholars.length*.0018*state.speed,0,100);
    if(s.type!=='village'&&soldiers.length>0)s.infrastructure.defenses=clamp(s.infrastructure.defenses+soldiers.length*.0015*state.speed,0,100);
    if(food>25)s.infrastructure.water=clamp(s.infrastructure.water+.008*state.speed,0,100);
    if(gold>1)s.infrastructure.roads=clamp(s.infrastructure.roads+.003*state.speed,0,100);
  }

  function servicesStep(s,p){
    ensure(s);
    const healers=p.filter(n=>['healer','doctor','cleric','druid'].includes(n.roleId)).length;
    const teachers=p.filter(n=>['teacher','scholar','scribe','librarian'].includes(n.roleId)).length;
    const soldiers=p.filter(n=>['militia','soldier','archer','spearman','knight','captain','general','marshal'].includes(n.roleId)).length;
    const merchants=p.filter(n=>['merchant','trader','shopkeeper','peddler'].includes(n.roleId)).length;
    s.services.health=clamp(12+healers*5+s.infrastructure.water*.25+(s.resources?.medicine||0)*.35);
    s.services.education=clamp(8+teachers*5+s.infrastructure.knowledge*.55);
    s.services.security=clamp(8+soldiers*4+s.infrastructure.defenses*.6);
    s.services.trade=clamp(8+merchants*4+s.infrastructure.roads*.55+(s.market?.volume||0)*.5);
  }

  function economyStep(s,p){
    ensure(s);
    const cap=capacity(s),pop=p.length;
    const foodRatio=(s.resources?.food||0)/Math.max(1,pop*.8);
    const goods=['wood','stone','iron','tools','cloth','medicine','weapons','armor'];
    const stockScore=goods.reduce((sum,id)=>sum+clamp((s.resources?.[id]||0)/Math.max(3,pop*.05)*20,0,10),0)/goods.length;
    s.crowding=clamp((pop-cap)/Math.max(1,cap)*100,0,100);
    s.economy.foodSecurity=clamp(foodRatio*70+s.services.health*.1);
    s.economy.marketAccess=clamp(s.infrastructure.roads*.55+s.services.trade*.45);
    s.economy.prosperity=clamp(22+s.economy.employment*.3+s.economy.foodSecurity*.25+s.economy.marketAccess*.2+stockScore*.8-s.crowding*.35);
    s.wealth=Math.max(0,(s.wealth||0)+s.economy.prosperity*.01*state.speed);
    const quality=(s.economy.prosperity+s.stability+s.services.security)/3;
    s.growthPressure=clamp(quality-50 + (cap>pop?8:-12) + (s.economy.foodSecurity>55?8:-15),-100,100);
  }

  function growthStep(s,p){
    ensure(s);
    const cap=capacity(s),pop=p.length;
    const adults=p.filter(n=>n.age>=18).length;
    const old=p.filter(n=>n.age>65).length;
    const net=(s.growthPressure/100)*.015*state.speed;
    s.age=(s.age||0)+.0015*state.speed;
    s.homes=Math.max(s.homes||5,Math.floor((s.infrastructure.housing||0)+pop/2));
    s.buildings=Math.max(s.buildings||2,Math.floor((s.infrastructure.workshops||0)+s.homes*.45));
    if(s.type==='village'&&pop>=28&&adults>=16&&s.economy.foodSecurity>58&&s.infrastructure.housing>=8&&s.infrastructure.workshops>=3&&s.stability>55){
      s.type='city';s.level=2;s.influence=Math.max(s.influence||0,2.8);s.history=s.history||[];s.history.push(`Year ${state.year}: developed into a city.`);logEvent(`${s.name} has grown into a CITY through sustained prosperity.`);
    }
    if(s.type==='city'&&pop>=85&&s.economy.prosperity>68&&s.infrastructure.defenses>12&&s.infrastructure.knowledge>10&&s.stability>62){
      s.type='kingdom';s.level=3;s.influence=Math.max(s.influence||0,4.8);s.history.push(`Year ${state.year}: achieved kingdom-scale development.`);logEvent(`${s.name} has reached kingdom-scale development.`);
    }
    if(s.crowding>80&&s.economy.foodSecurity<45){
      s.stability=clamp(s.stability-.08*state.speed);
      if(state.tick%60===0)logEvent(`${s.name} is struggling under crowding and food pressure.`);
    }else if(net>0){s.stability=clamp(s.stability+.025*state.speed);}
    if(old>adults*.35)s.growthPressure=clamp(s.growthPressure-8,-100,100);
  }

  function districtStep(s,p){
    ensure(s);
    if(s.type==='village')return;
    const roles={industrial:p.filter(n=>['blacksmith','carpenter','weaver','engineer','shipwright','mason'].includes(n.roleId)).length,
      market:p.filter(n=>['merchant','trader','shopkeeper','peddler'].includes(n.roleId)).length,
      scholarly:p.filter(n=>['scholar','teacher','scribe','librarian'].includes(n.roleId)).length,
      military:p.filter(n=>['militia','soldier','archer','spearman','knight','captain','general','marshal'].includes(n.roleId)).length};
    s.districts=[];
    if(roles.industrial>2)s.districts.push({type:'industrial',size:roles.industrial});
    if(roles.market>1)s.districts.push({type:'market',size:roles.market});
    if(roles.scholarly>1)s.districts.push({type:'scholarly',size:roles.scholarly});
    if(roles.military>2)s.districts.push({type:'military',size:roles.military});
    if(s.infrastructure.knowledge>20)s.districts.push({type:'academy',size:Math.round(s.infrastructure.knowledge)});
  }

  function logEvent(text){window.SIM_API?.log?.(text);}

  function step(){
    if(!state.running)return;
    state.settlements.forEach(s=>{const p=population(s);infrastructureStep(s,p);servicesStep(s,p);economyStep(s,p);districtStep(s,p);growthStep(s,p);});
  }

  window.NPC_SETTLEMENTS={step,ensure,capacity,population};
  if(state.registerSystem)state.registerSystem({name:'settlements',step,priority:65});
})();
