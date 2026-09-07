(() => {
  const state=window.SIM_STATE;if(!state)return;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
  const trait=(n,t)=>Array.isArray(n.traits)&&n.traits.includes(t) || n.trait===t;
  const role=(n,r)=>n.roleId===r;
  function personality(n){
    const t=n.traits||[];return {
      aggression:(trait(n,'reckless')?25:0)+(trait(n,'brave')?8:0)+(trait(n,'ambitious')?6:0)+(trait(n,'calm')?-12:0),
      sociability:(trait(n,'kind')?14:0)+(trait(n,'loyal')?8:0)+(trait(n,'curious')?8:0)+(trait(n,'stubborn')?-6:0),
      risk:(trait(n,'reckless')?22:0)+(trait(n,'greedy')?8:0)+(trait(n,'calm')?-15:0),
      ambition:(trait(n,'ambitious')?28:0)+(n.ambition||0)*.25,
      discipline:(trait(n,'clever')?5:0)+(trait(n,'calm')?8:0)+(n.workEthic||50)*.35
    };
  }
  function choose(n){
    if(!n.alive||n.age<13)return;
    const p=personality(n),q=n.needPressure||{};
    const options=[
      ['eat','Find food',q.hunger*1.8+(n.roleId==='farmer'?8:0)],
      ['drink','Find water',q.thirst*1.5],
      ['rest','Rest and recover',q.rest*1.2],
      ['socialize','Spend time with others',q.social+(p.sociability*.5)],
      ['belong','Visit family',q.belonging+(n.familyId?12:0)],
      ['work','Work as '+(n.roleName||'Citizen'),q.purpose+(n.workEthic||50)*.35],
      ['wealth','Earn wealth',q.wealth+p.ambition*.35],
      ['safety','Seek safety',q.safety+(state.war?25:0)],
      ['explore','Explore',18+(trait(n,'curious')?22:0)],
      ['govern','Govern',role(n,'mayor')||role(n,'king')||role(n,'duke')||role(n,'count')?65+p.ambition:0],
      ['train','Train for combat',state.war&&n.age>=16?55+p.aggression:trait(n,'brave')?18:0],
      ['study','Study',trait(n,'curious')?42+(n.education||0)*.1:12]
    ];
    const viable=options.filter(x=>x[2]>0);viable.forEach(x=>x[2]*=(.8+Math.random()*.4));viable.sort((a,b)=>b[2]-a[2]);
    const pick=viable[0]; if(!pick)return;
    n.aiDecision={action:pick[0],score:Math.round(pick[2]),at:state.tick};n.goal=pick[1];n.decisionReason=`${pick[0]} has the highest current utility`;
  }
  window.NPC_DECISIONS={choose,personality};
})();
