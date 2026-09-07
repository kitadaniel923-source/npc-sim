(() => {
  const state = window.SIM_STATE;
  if (!state) return;
  const profiles = window.EverglenSocial?.traits || {};
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

  function paint(){
    const box=document.getElementById('inspectorContent');
    if(!box) return;
    const npc=state.npcs.find(n=>n.id===state.selected);
    if(!npc) return;
    npc.traits=npc.traits||[npc.trait||'calm'];
    npc.reputation=npc.reputation??50;
    npc.honor=npc.honor??50;
    npc.status=npc.status??0;
    npc.education=npc.education??0;
    npc.fortune=npc.fortune??50;
    if(box.querySelector('.social-trait-card')) return;
    const card=document.createElement('div');
    card.className='social-trait-card';
    card.style.cssText='margin-top:10px;padding:10px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(255,255,255,.035);font-size:11px;color:#bfd0eb';
    card.innerHTML=`<div style="display:flex;justify-content:space-between;gap:8px"><strong style="color:#edf2ff">Traits & Fate</strong><span>fortune ${Math.round(clamp(npc.fortune,0,100))}</span></div><div style="display:flex;flex-wrap:wrap;gap:5px;margin:7px 0">${npc.traits.map(t=>`<span style="padding:3px 7px;border-radius:999px;background:rgba(255,255,255,.08);color:#edf2ff">${t}</span>`).join('')}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:5px"><span>Reputation <b>${Math.round(npc.reputation)}</b></span><span>Honor <b>${Math.round(npc.honor)}</b></span><span>Status <b>${Math.round(npc.status)}</b></span><span>Class <b>${npc.classTier||'peasant'}</b></span><span>Education <b>${Math.round(npc.education)}</b></span><span>Crimes <b>${npc.crimes||0}</b></span></div>`;
    box.appendChild(card);
  }

  setInterval(paint,300);
})();
