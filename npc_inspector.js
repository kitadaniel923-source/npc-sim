// AI inspector overlay: exposes the internal decision state of the selected NPC.
// This wraps the existing renderer instead of replacing the simulation's rendering code.
(() => {
  const state = window.SIM_STATE;
  const baseRender = window.SIM_RENDER;
  if (!state || typeof baseRender !== 'function') return;

  const esc = value => String(value ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
  const clamp = (v,a=0,b=100) => Math.max(a,Math.min(b,Number(v)||0));
  const score = (npc,key) => window.NPC_PERSONALITY?.score?.(npc,key);
  const selected = () => (state.npcs || []).find(n => n.alive && n.id === state.selected);
  const relationTargets = npc => (npc?.relations || [])
    .map(r => ({...r,target:(state.npcs || []).find(x => x.id === r.targetId)}))
    .filter(r => r.target);

  function personalitySection(n) {
    const keys = ['bravery','curiosity','ambition','kindness','loyalty','sociability','cleverness','greed','recklessness','calmness'];
    const aliases = {bravery:'Bravery',curiosity:'Curiosity',ambition:'Ambition',kindness:'Kindness',loyalty:'Loyalty',sociability:'Sociability',cleverness:'Cleverness',greed:'Greed',recklessness:'Recklessness',calmness:'Calm'};
    const rows = keys.map(k => {
      const v = score(n,k);
      if (v == null) return '';
      return `<div class="need"><div><span>${aliases[k]}</span><b>${Math.round(v)}%</b></div><div class="bar"><i style="width:${clamp(v)}%"></i></div></div>`;
    }).filter(Boolean).join('');
    return rows ? `<h4>Personality drivers</h4><div class="needs-chart">${rows}</div>` : '';
  }

  function decisionSection(n) {
    const d=n.aiDecision;
    if(!d)return `<h4>Decision engine</h4><div class="empty-state">No decision recorded yet.</div>`;
    const influences=Array.isArray(d.influences)?d.influences:[];
    const rows=influences.map(x=>`<div><b>${esc(x.label)}</b> · ${Math.round(Number(x.value)||0)}</div>`).join('');
    return `<h4>Decision engine</h4><div class="goal"><b>Chosen action:</b> ${esc(d.action||n.goal||'None')} · utility ${Math.round(Number(d.score)||0)}</div>`+
      `<div class="goal"><b>Source:</b> ${esc(n.decisionSource||'unknown')} · ${esc(n.decisionReason||'No explanation recorded.')}</div>`+
      (rows?`<div class="memories">${rows}</div>`:'');
  }

  function planSection(n) {
    const p = n.currentPlan;
    if (!p) return `<h4>Current plan</h4><div class="empty-state">No active multi-step plan.</div>`;
    const steps = Array.isArray(p.steps) ? p.steps : [];
    const current = p.currentStep ?? p.stepIndex ?? 0;
    return `<h4>Current plan</h4><div class="goal"><b>${esc(p.name || p.type || 'Plan')}</b>${p.reason ? ` · ${esc(p.reason)}` : ''}</div>` +
      `<div class="memories">${steps.length ? steps.map((step,i) => `<div>${i===current?'▶':'○'} ${esc(typeof step==='string'?step:(step.label||step.action||step.type||'Step'))}</div>`).join('') : '<div>Plan created, steps not exposed.</div>'}</div>`;
  }

  function relationshipsSection(n) {
    const rels = relationTargets(n).sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,8);
    if (!rels.length) return `<h4>Relationships</h4><div class="empty-state">No recorded relationships.</div>`;
    return `<h4>Relationships</h4><div class="memories">${rels.map(r => `<div><b>${esc(r.target.name)}</b> · ${esc(r.type || 'acquaintance')} · ${Math.round(r.score||0)}</div>`).join('')}</div>`;
  }

  function renderInspector() {
    const root = document.getElementById('inspectorContent');
    if (!root) return;
    const n = selected();
    if (!n) return;

    root.querySelector('.ai-inspector-details')?.remove();

    const kingdom = state.kingdoms.find(k => k.id === n.faction);
    const settlement = state.settlements.find(s => s.id === n.settlementId);
    const family = state.families.find(f => f.id === n.familyId);
    const memories = Array.isArray(n.memories) ? n.memories : [];
    const needs = n.needs || {};
    const career = n.careerHistory?.[n.careerHistory.length - 1] || n.career || n.roleName;
    const culture = n.culture || n.cultureId || (kingdom && (kingdom.culture || kingdom.cultureId));

    const political = kingdom?.politics || {};
    const politicalBlock = kingdom ?
      `<div class="goal"><b>Political pressure:</b> Nobles ${Math.round(political.nobles||0)} · Merchants ${Math.round(political.merchants||0)} · Commons ${Math.round(political.commons||0)} · Army ${Math.round(political.army||0)}</div>` : '';

    const crimeBlock = n.crimeHeat > 0 || n.crimes > 0 || n.arrests > 0 ?
      `<div class="goal"><b>Crime:</b> heat ${Math.round(n.crimeHeat||0)} · crimes ${n.crimes||0} · arrests ${n.arrests||0}${n.term ? ` · sentence ${n.term.toFixed?.(1) || n.term}y` : ''}</div>` : '';

    const needSummary = [
      ['Hunger', 100-(n.hunger||0)],
      ['Energy', n.energy],
      ['Safety', needs.safety],
      ['Food', needs.food],
      ['Belonging', needs.belonging],
      ['Wealth', needs.wealth],
      ['Purpose', needs.purpose]
    ].filter(([,v]) => v != null).map(([label,v]) => `${label} ${Math.round(clamp(v))}`).join(' · ');

    root.insertAdjacentHTML('beforeend', `<div class="ai-inspector-details">
      <div class="goal"><b>Why now:</b> ${esc(n.decisionReason || n.planFailure?.reason || n.reason || 'No explicit reason recorded.')}</div>
      <div class="bio-grid">
        <span>Career<b>${esc(typeof career === 'string' ? career : career?.career || n.roleName)}</b></span>
        <span>Culture<b>${esc(culture || 'Unrecorded')}</b></span>
        <span>Generation<b>${esc(n.generation || 1)}</b></span>
        <span>Parents<b>${(n.parents||n.parentIds||[]).length}</b></span>
        <span>Children<b>${(n.childrenIds||[]).length}</b></span>
        <span>Spouse<b>${esc((state.npcs||[]).find(x=>x.id===(n.spouseId||n.partnerId))?.name || 'None')}</b></span>
        <span>Plan failures<b>${n.planFailure ? 1 : 0}</b></span>
        <span>Family members<b>${family?.members?.length || 0}</b></span>
      </div>
      ${needSummary ? `<div class="goal"><b>Need pressure:</b> ${esc(needSummary)}</div>` : ''}
      ${politicalBlock}${crimeBlock}
      ${decisionSection(n)}
      ${personalitySection(n)}
      ${planSection(n)}
      ${relationshipsSection(n)}
      <h4>Recent memory</h4>
      <div class="memories">${memories.slice(0,10).map(m=>`<div>Y${esc(m.year ?? state.year)} · ${esc(m.text || m.kind || 'Memory')}</div>`).join('') || '<div>No consequential memories recorded.</div>'}</div>
      ${n.planHistory?.length ? `<h4>Plan history</h4><div class="memories">${n.planHistory.slice(-5).map(x=>`<div>${esc(typeof x==='string' ? x : x.name || x.type || 'Completed plan')}</div>`).join('')}</div>` : ''}
    </div>`);
  }

  window.SIM_RENDER = () => {
    baseRender();
    try { renderInspector(); } catch (error) { console.error('Inspector render error:', error); }
  };

  window.NPC_INSPECTOR = {render: renderInspector};
})();
