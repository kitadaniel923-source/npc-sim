// Extends the existing runtime audit with the baked 3D atlas contract.
(() => {
  'use strict';
  const audit = window.EVERGLEN_DEEP_AUDIT;
  if (!audit?.test) return;
  const original = audit.test;
  audit.test = () => {
    const report = original();
    const three = window.EVERGLEN_3D_ASSETS;
    const stage = window.EVERGLEN_3D_ASSET_STAGE;
    const ready = !!three?.status?.ready && Number(three?.status?.frames || 0) > 0;
    const draws = Number(three?.status?.draws || 0);
    report.results.push({
      name: 'baked 3D asset atlas',
      ok: ready,
      detail: ready ? `${three.status.frames} frames loaded` : (three?.status?.error || '3D atlas not ready')
    });
    report.results.push({
      name: 'baked 3D asset usage',
      ok: !!stage && draws > 0,
      detail: draws > 0 ? `${draws} baked 3D draws` : 'no baked 3D draws'
    });
    report.ok = report.results.every(r => r.ok);
    report.summary.threeDFrames = Number(three?.status?.frames || 0);
    report.summary.threeDDraws = draws;
    return report;
  };
})();
