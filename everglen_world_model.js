// Everglen authoritative world model.
// One spatial truth for terrain, climate, ecology, resources, movement and settlement logic.
(() => {
  'use strict';
  const state = window.SIM_STATE;
  if (!state) return;

  const WIDTH = 1400;
  const HEIGHT = 1000;
  const TILE = 10;
  const COLS = WIDTH / TILE;
  const ROWS = HEIGHT / TILE;

  const clamp = (v,a,b) => Math.max(a, Math.min(b,v));
  const key = (c,r) => `${c}:${r}`;

  function build(api) {
    const tiles = new Array(COLS * ROWS);
    const resourcesByTile = new Map();
    const source = state.worldGen?.resources || [];
    source.forEach(r => resourcesByTile.set(key(Math.floor((r.x + WIDTH/2) / TILE), Math.floor((r.y + HEIGHT/2) / TILE)), r));

    for (let row=0; row<ROWS; row++) {
      for (let col=0; col<COLS; col++) {
        const x = -WIDTH/2 + col*TILE + TILE/2;
        const y = -HEIGHT/2 + row*TILE + TILE/2;
        const elevation = clamp(Number(api.elevationAt(x,y)) || 0, -1, 1);
        const moisture = clamp(Number(api.moistureAt(x,y)) || 0, 0, 1);
        const temperature = clamp(Number(api.temperatureAt(x,y)) || 0, 0, 1);
        const water = !api.landAt(x,y) || !!api.riverAt(x,y);
        const biome = water ? 'water' : String(api.biomeAt(x,y) || 'plains');
        const fertility = water ? 0 : clamp(.72 + moisture*.32 - Math.max(0,elevation-.62)*.8 - Math.abs(temperature-.58)*.3, .08, 1);
        const walkable = !water && elevation < .9;
        const resource = resourcesByTile.get(key(col,row)) || null;
        tiles[row*COLS+col] = { id:row*COLS+col, col,row,x,y,elevation,moisture,temperature,biome,water,fertility,walkable,resourceId:resource?.id||null };
      }
    }

    state.worldMap = { width:WIDTH,height:HEIGHT,tileSize:TILE,cols:COLS,rows:ROWS,tiles,version:1 };
    window.EVERGLEN_WORLD_MODEL = {
      width:WIDTH,height:HEIGHT,tileSize:TILE,cols:COLS,rows:ROWS,
      tiles,
      tileAt(x,y) {
        const col=Math.floor((x+WIDTH/2)/TILE), row=Math.floor((y+HEIGHT/2)/TILE);
        if(col<0||col>=COLS||row<0||row>=ROWS)return null;
        return tiles[row*COLS+col] || null;
      },
      isWalkable(x,y) { return !!this.tileAt(x,y)?.walkable; },
      fertilityAt(x,y) { return this.tileAt(x,y)?.fertility || 0; },
      biomeAt(x,y) { return this.tileAt(x,y)?.biome || 'water'; },
      rebuild: () => build(api)
    };
    return state.worldMap;
  }

  window.EVERGLEN_WORLD_MODEL_BUILDER = { build };
})();
