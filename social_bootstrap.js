(async () => {
  try {
    const loadScript = src => new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.body.appendChild(script);
    });

    const response = await fetch('simulation.js', {cache:'no-store'});
    if (!response.ok) throw new Error(`simulation.js returned ${response.status}`);
    const source = await response.text();
    const marker = source.lastIndexOf('})();');
    if (marker < 0) throw new Error('simulation.js bootstrap marker not found');

    const patched = source.slice(0, marker) +
      '\nwindow.SIM_STATE=state; window.SIM_RENDER=render;\n' +
      source.slice(marker);

    const simulationScript = document.createElement('script');
    simulationScript.textContent = patched;
    document.body.appendChild(simulationScript);

    await loadScript('logistics.js');
    await loadScript('social_traits.js');
  } catch (error) {
    console.error('Everglen bootstrap failed:', error);
    const banner = document.createElement('div');
    banner.style.cssText='position:fixed;left:16px;bottom:16px;z-index:9999;padding:10px 14px;border-radius:10px;background:#421b24;color:#fff;font:12px Segoe UI,sans-serif;border:1px solid rgba(255,255,255,.15)';
    banner.textContent='Simulation bootstrap failed. Check the console for details.';
    document.body.appendChild(banner);
  }
})();
