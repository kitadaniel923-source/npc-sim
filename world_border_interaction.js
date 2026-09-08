// Everglen world/border interaction: inspect political territory and expose contextual player actions.
(() => {
  const state = window.SIM_STATE;
  const canvas = document.getElementById('worldCanvas');
  if (!state || !canvas || !window.BORDER_RECOGNITION) return;

  let lastInfo = null;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const kingdom = id => (state.kingdoms || []).find(k => String(k.id) === String(id));
  const ownerName = id => kingdom(id)?.name || (id == null ? 'None' : `Kingdom ${id}`);
  const frontierFor = id => (state.borderRecognition?.frontiers || []).find(f => String(f.kingdomId) === String(id)) || null;
  const rulerFor = id => {
    const k = kingdom(id);
    return k?.leaderId ? (state.npcs || []).find(n => String(n.id) === String(k.leaderId) && n.alive) : null;
  };
  const tileId = p => window.SIM_API?.tileId?.(p.x, p.y);
  const organicOwner = p => {
    const id = tileId(p);
    const ki = id == null ? -1 : Number(state.territory?.[id]);
    return ki >= 0 ? state.territoryOwner?.[ki] || state.kingdoms?.[ki]?.id || null : null;
  };
  const claimFor = p => {
    const id = tileId(p);
    return id == null ? null : state.territoryClaims?.[String(id)] || null;
  };
  const sameRealm = (a,b) => String(a) === String(b);
  const borderWarActive = (a,b) => window.SIM_API?.isKingdomAtWar?.(a,b) || !!state.borderWars?.some(w => (sameRealm(w.a,a) && sameRealm(w.b,b)) || (sameRealm(w.a,b) && sameRealm(w.b,a)));

  function nearestBorder(p) {
    let best = null, bd = Infinity;
    for (const b of state.borderRecognition?.borders || []) {
      const vx=b.x2-b.x1, vy=b.y2-b.y1;
      const len2=vx*vx+vy*vy || 1;
      const t=Math.max(0,Math.min(1,((p.x-b.x1)*vx+(p.y-b.y1)*vy)/len2));
      const qx=b.x1+t*vx, qy=b.y1+t*vy;
      const d=Math.hypot(p.x-qx,p.y-qy);
      if(d<bd){bd=d;best={border:b,distance:d};}
    }
    return best;
  }

  function territoryControls(p) {
    const organic = organicOwner(p);
    const playerClaim = claimFor(p);
    const options = (state.kingdoms || []).map(k => `<option value="${esc(k.id)}" ${sameRealm(playerClaim || organic,k.id)?'selected':''}>${esc(k.name)}</option>`).join('');
    return `<div style="margin-top:8px;padding-top:7px;border-top:1px solid rgba(255,255,255,.12)"><div style="color:#aeb8af;margin-bottom:4px">Organic owner: <b style="color:#eee9d6">${esc(ownerName(organic))}</b></div>${playerClaim?`<div style="color:#e6c35d;margin-bottom:5px">Player claim: <b>${esc(ownerName(playerClaim))}</b></div>`:''}<div style="display:flex;gap:4px;align-items:center"><select data-border-action="claim-target" style="max-width:130px;background:#26342e;color:#eee9d6;border:1px solid #53635a;font:10px Segoe UI,sans-serif;padding:3px">${options}</select><button data-border-action="claim" type="button">Claim</button>${playerClaim?'<button data-border-action="revoke" type="button">Revoke</button>':''}</div></div>`;
  }

  function popup(html) {
    let el=document.getElementById('borderInteractionPopup');
    if(!el){
      el=document.createElement('div');
      el.id='borderInteractionPopup';
      el.style.cssText='position:absolute;left:12px;top:12px;z-index:30;min-width:230px;max-width:330px;background:rgba(28,37,34,.97);color:#eee9d6;border:2px solid #17211d;box-shadow:4px 4px #17211d;padding:10px;font:11px Segoe UI,sans-serif;pointer-events:auto;';
      document.getElementById('worldViewport')?.appendChild(el);
      el.addEventListener('click', e => {
        const button = e.target.closest('[data-border-action]');
        if (!button || !lastInfo) return;
        const action = button.dataset.borderAction;
        const input = el.querySelector('[data-border-action="claim-target"]');
        if (action === 'claim') {
          const kid = input?.value;
          if (!kid) return;
          claimTerritory(lastInfo, kid);
        } else if (action === 'revoke') {
          revokeClaim(lastInfo);
        } else if (action === 'force-war' && lastInfo.type === 'border') {
          forceBorderWar(lastInfo);
        }
      });
    }
    el.innerHTML=html;
    el.style.display='block';
    clearTimeout(popup.timer); popup.timer=setTimeout(()=>{el.style.display='none';},7000);
  }

  function playerApply(action, details = {}) {
    try { return window.EVERGLEN_PLAYER_EVENTS?.apply?.(action, {tool:'border-inspection', ...details}) || null; }
    catch (_) { return null; }
  }

  function refreshAfterTerritoryChange(p) {
    window.BORDER_RECOGNITION?.recalculate?.();
    window.SIM_RENDER?.();
    inspect(p);
  }

  function claimTerritory(info, kingdomId) {
    const p = {x:Number(info.x), y:Number(info.y)};
    const target = kingdom(kingdomId);
    const id = tileId(p);
    if (!target || id == null) return false;
    const before = organicOwner(p);
    state.territoryClaims = state.territoryClaims || {};
    state.territoryClaims[String(id)] = target.id;
    const changed = window.SIM_API?.claimTerritoryAt?.(p.x, p.y, target.id) !== false;
    if (!changed) { delete state.territoryClaims[String(id)]; return false; }
    const seized = before && !sameRealm(before,target.id);
    const oldRuler = seized ? rulerFor(before) : null;
    const claimInfo = `Claimed tile ${id} for ${target.name}; organic owner was ${ownerName(before)}.`;
    playerApply('claim-territory', {
      type:'territory-claim', x:p.x, y:p.y,
      target:{kind:'territory-tile',tileId:id,kingdomId:target.id},
      details:claimInfo,
      entityId:target.id,
      entityIds:oldRuler ? [oldRuler.id] : [],
      memoryNpcIds:oldRuler ? [oldRuler.id] : [],
      memory:oldRuler ? {type:'divine',text:`The player seized territory from my realm at tile ${id}.`,importance:84,permanent:true,emotion:'anger'} : null,
      consequences:[`Tile ${id} is now biased toward ${target.name}.`,`Organic territory calculation remains authoritative after the claim is revoked.`]
    });
    state.selectedBorder={...info,territoryClaimed:true,playerClaim:target.id};
    refreshAfterTerritoryChange(p);
    return true;
  }

  function revokeClaim(info) {
    const p = {x:Number(info.x), y:Number(info.y)};
    const id = tileId(p);
    if (id == null || !state.territoryClaims?.[String(id)]) return false;
    const claimedFor = state.territoryClaims[String(id)];
    delete state.territoryClaims[String(id)];
    const changed = window.SIM_API?.revokeTerritoryAt?.(p.x, p.y) !== false;
    if (!changed) { state.territoryClaims[String(id)] = claimedFor; return false; }
    playerApply('revoke-territory-claim', {
      type:'territory-claim-revoked', x:p.x, y:p.y,
      target:{kind:'territory-tile',tileId:id,kingdomId:claimedFor},
      details:`Revoked the player claim at tile ${id}; organic territory calculation is restored.`,
      entityId:claimedFor,
      consequences:[`Removed the player override at tile ${id}.`,`Territory was recomputed organically.`]
    });
    state.selectedBorder={...info,territoryClaimed:false};
    refreshAfterTerritoryChange(p);
    return true;
  }

  function forceBorderWar(info) {
    if (info.type !== 'border' || sameRealm(info.a,info.b)) return false;
    const a = kingdom(info.a), b = kingdom(info.b);
    if (!a || !b) return false;
    const war = window.SIM_API?.forceBorderWar?.(a.id,b.id);
    if (!war) return false;
    const ra = rulerFor(a.id), rb = rulerFor(b.id);
    playerApply('force-border-war', {
      type:'forced-border-war', x:Number(info.x), y:Number(info.y),
      target:{kind:'frontier',a:a.id,b:b.id},
      details:`Forced a border war between ${a.name} and ${b.name}.`,
      entityIds:[ra?.id,rb?.id].filter(Boolean),
      memoryNpcIds:[ra?.id,rb?.id].filter(Boolean),
      memory:{type:'divine',text:`The player forced ${a.name} and ${b.name} into war at their frontier.`,importance:92,permanent:true,emotion:'anger'},
      consequences:[`${a.name} and ${b.name} were placed into a targeted border war.`,`This is distinct from the global War toggle.`]
    });
    state.selectedBorder={...info,forcedWar:true,warId:war.id};
    window.BORDER_RECOGNITION?.recalculate?.();
    window.SIM_RENDER?.();
    inspect({x:Number(info.x),y:Number(info.y)});
    return true;
  }

  function inspect(p) {
    const b=nearestBorder(p);
    const controls=territoryControls(p);
    if(b && b.distance<34){
      const left=kingdom(b.border.a), right=kingdom(b.border.b);
      const aFront=frontierFor(b.border.a), bFront=frontierFor(b.border.b);
      const contested=b.border.contested;
      const activeWar=borderWarActive(b.border.a,b.border.b);
      lastInfo={type:'border',a:b.border.a,b:b.border.b,x:p.x,y:p.y};
      popup(`<strong>⚔ Frontier</strong><div style="margin-top:6px"><b>${esc(ownerName(b.border.a))}</b> ↔ <b>${esc(ownerName(b.border.b))}</b></div><div style="margin-top:5px;color:#aeb8af">${contested?'CONTESTED BORDER':'Recognized border'}${activeWar?' • Targeted war active':''}</div><div style="margin-top:6px">Approx. frontier: ${Math.round((aFront?.borderLength||0))} / ${Math.round((bFront?.borderLength||0))}</div>${controls}<div style="margin-top:7px"><button data-border-action="force-war" type="button" ${activeWar?'disabled':''}>⚔ Force Border War</button></div><div style="margin-top:7px;color:#9eaaa0">This frontier is the exact world location you clicked. Player actions are persistent and attributed.</div>`);
      state.selectedBorder=lastInfo;
      return true;
    }
    const owner=organicOwner(p);
    if(owner){
      const k=kingdom(owner), f=frontierFor(owner);
      lastInfo={type:'territory',kingdomId:owner,x:p.x,y:p.y};
      popup(`<strong>🏰 Territory</strong><div style="margin-top:6px"><b>${esc(k?.name||ownerName(owner))}</b></div><div style="margin-top:5px">Power ${Math.round(k?.power||0)} • Legitimacy ${Math.round(k?.legitimacy||0)} • Tension ${Math.round(k?.tension||0)}</div><div style="margin-top:4px">Neighbors: ${Math.max(0,(f?.neighbors||[]).length)}</div><div style="margin-top:4px">Frontier: ${Math.round(f?.borderLength||0)} world-units</div>${controls}`);
      state.selectedBorder=lastInfo;
      return true;
    }
    state.selectedBorder=null;
    return false;
  }

  function addToggle(){
    const actions=document.querySelector('.toolbar-actions');
    if(!actions || document.getElementById('toggleBorders')) return;
    const b=document.createElement('button');
    b.id='toggleBorders'; b.textContent='◇ Borders';
    b.title='Show or hide recognized kingdom borders';
    b.addEventListener('click',()=>{state.showBorders=state.showBorders===false; b.textContent='◇ Borders'; window.EVERGLEN_RENDER?.run?.({state});});
    actions.appendChild(b);
  }

  const registerInput = () => {
    if (!window.EVERGLEN_INPUT?.register) return;
    window.EVERGLEN_INPUT.register({
      name:'border-inspection',
      priority:20,
      events:['click'],
      hitTest:() => !state.godMode,
      handle:inspect
    });
  };

  window.EVERGLEN_BORDER_INTERACTION={inspect,nearestBorder,get selected(){return lastInfo;},claimTerritory,revokeClaim,forceBorderWar};
  addToggle();
  setTimeout(addToggle,0);
  registerInput();
})();
