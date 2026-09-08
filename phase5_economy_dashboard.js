// Small inspection dashboard for Phase 5 economic state.
// DOM-owned UI only; no world-canvas input or independent render loop.
(() => {
  const state=window.SIM_STATE;if(!state)return;
  const esc=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const mount=()=>{
    if(document.getElementById('economyDash'))return;
    const style=document.createElement('style');style.textContent='#economyDash{position:fixed;left:50%;top:72px;transform:translateX(-50%);z-index:1400;display:none;width:min(880px,94vw);max-height:78vh;overflow:auto;background:#0b1513;border:1px solid rgba(180,215,202,.18);border-radius:14px;box-shadow:0 24px 70px rgba(0,0,0,.5);color:#e8f3ee;font:12px Segoe UI,sans-serif;padding:15px}.econ-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.econ-head h2{margin:0;font-size:17px}.econ-close{background:#13221f;color:#dcebe6;border:1px solid rgba(255,255,255,.1);border-radius:7px;padding:6px 9px}.econ-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.econ-card{background:#101e1b;border:1px solid rgba(255,255,255,.06);border-radius:9px;padding:10px}.econ-card span{display:block;color:#789087;font-size:10px}.econ-card strong{display:block;margin-top:3px;font-size:15px}.econ-list{margin-top:12px}.econ-row{display:grid;grid-template-columns:1.5fr .8fr .8fr .9fr;gap:8px;padding:8px 9px;border-bottom:1px solid rgba(255,255,255,.05)}.econ-row b{color:#dce9e4}.econ-muted{color:#83968f}@media(max-width:650px){.econ-grid{grid-template-columns:1fr 1fr}.econ-row{grid-template-columns:1fr 1fr}}';document.head.appendChild(style);
    const dash=document.createElement('section');dash.id='economyDash';dash.innerHTML='<div class="econ-head"><div><h2>💰 Economy</h2><div class="econ-muted">Production, bottlenecks and local prosperity</div></div><button class="econ-close" id="econClose">× Close</button></div><div id="econGrid" class="econ-grid"></div><div id="econList" class="econ-list"></div>';document.body.appendChild(dash);
    const render=()=>{
      const ss=state.settlements||[];const pop=n=>state.npcs.filter(n=>n.alive&&n.settlementId===n.settlementId).length;
      const active=ss.reduce((a,s)=>a+(s.production?.production?.industry||s.production?.industry||0),0)/Math.max(1,ss.length);
      const prosperous=ss.filter(s=>(s.economy?.prosperity||s.prosperity||0)>60).length;
      const bottlenecks=ss.reduce((a,s)=>a+(s.production?.bottlenecks?.length||0),0);
      const routes=window.EVERGLEN_LOGISTICS?.routes?.length||0;
      document.getElementById('econGrid').innerHTML=`<div class="econ-card"><span>Industry</span><strong>${active.toFixed(1)}</strong></div><div class="econ-card"><span>Prosperous settlements</span><strong>${prosperous}</strong></div><div class="econ-card"><span>Bottlenecks</span><strong>${bottlenecks}</strong></div><div class="econ-card"><span>Trade routes</span><strong>${routes}</strong></div><div class="econ-card"><span>Total settlements</span><strong>${ss.length}</strong></div><div class="econ-card"><span>Total population</span><strong>${state.npcs.filter(n=>n.alive).length}</strong></div>`;
      const rows=ss.map(s=>{const p=s.production||{};const industry=(p.industry||0).toFixed(1);const prosperity=(s.economy?.prosperity??s.prosperity??0).toFixed(1);const b=(p.bottlenecks||[]).map(x=>x.missing?.join(', ')||x.chain).slice(-2).join(' • ')||'None';return `<div class="econ-row"><b>${esc(s.name)}</b><span>Industry ${industry}</span><span>Prosperity ${prosperity}</span><span class="econ-muted">${esc(b)}</span></div>`}).join('');document.getElementById('econList').innerHTML=rows||'<div class="econ-muted">No settlements yet.</div>';
    };
    document.getElementById('econClose').onclick=()=>dash.style.display='none';
    window.EVERGLEN_ECONOMY_UI={open:()=>{dash.style.display='block';render();},refresh:render};
    const controls=document.querySelector('.controls');if(controls){const btn=document.createElement('button');btn.id='economyButton';btn.textContent='💰 Economy';controls.insertBefore(btn,controls.querySelector('.danger')||null);btn.onclick=window.EVERGLEN_ECONOMY_UI.open;}
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
