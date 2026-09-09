// Everglen supplemental asset registry.
// Loads the project-owned compressed atlas/manifest bundle and exposes deterministic,
// tag-aware sprite selection so supplemental assets are reachable by world context.
(() => {
  'use strict';
  const root = 'assets/everglen/';
  const registry = {
    ready:false,
    loading:false,
    error:null,
    image:null,
    sprites:[],
    categories:{},
    stats:{draws:0,selected:0,byCategory:{},loadedSprites:0},
    pick(tags=[],seed=0){
      const wanted = (Array.isArray(tags)?tags:[tags]).map(x=>String(x||'').toLowerCase()).filter(Boolean);
      const pool = wanted.length ? this.sprites.filter(s => wanted.some(t => s.tags.includes(t) || s.label.includes(t))) : this.sprites;
      if (!pool.length) return null;
      return pool[Math.abs(Math.floor(seed)) % pool.length];
    },
    draw(ctx,tags,x,y,w,h,seed=0,flip=false){
      if(!this.ready || !this.image || !ctx) return false;
      const s=this.pick(tags,seed); if(!s) return false;
      ctx.save();
      if(flip){ctx.translate(x+w,y);ctx.scale(-1,1);x=0;}
      ctx.drawImage(this.image,s.x,s.y,s.w,s.h,x,y,w,h);
      ctx.restore();
      this.stats.draws++;
      this.stats.selected++;
      const cat=s.category||'misc';
      this.stats.byCategory[cat]=(this.stats.byCategory[cat]||0)+1;
      s.used=(s.used||0)+1;
      return true;
    }
  };
  window.EVERGLEN_ASSET_REGISTRY=registry;

  const bytesFromB64=b64=>{
    let value=String(b64).trim().replace(/^data:[^,]+,/,'').replace(/[^A-Za-z0-9+/_=-]/g,'').replace(/-/g,'+').replace(/_/g,'/');
    value=value.padEnd(value.length+((4-value.length%4)%4),'=');
    const raw=atob(value);
    const out=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++) out[i]=raw.charCodeAt(i);
    return out;
  };
  const textFromBytes=bytes=>new TextDecoder().decode(bytes);
  const inflate=async bytes=>{
    if(typeof DecompressionStream!=='function') throw new Error('DecompressionStream unavailable');
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  };
  const isFrame=v=>v&&Number.isFinite(Number(v.x))&&Number.isFinite(Number(v.y))&&Number(v.w)>0&&Number(v.h)>0;

  function flatten(node,path=[],out=[]){
    if(Array.isArray(node)){node.forEach((v,i)=>flatten(v,path.concat(i),out));return out;}
    if(!node||typeof node!=='object')return out;
    if(isFrame(node)){
      const label=String(node.name||node.key||node.id||node.path||path.join('/')).toLowerCase();
      const tokens=label.split(/[^a-z0-9]+/).filter(Boolean);
      const category = tokens.some(t=>['tree','bush','rock','plant','flower','grass','cactus','nature'].includes(t))?'nature'
        : tokens.some(t=>['market','tavern','blacksmith','village','house','wall','castle','building','prop','fixture','architecture'].includes(t))?'settlement'
        : tokens.some(t=>['ore','gold','iron','copper','coal','diamond','emerald','amethyst','lapis','redstone','mineral'].includes(t))?'resource'
        : tokens.some(t=>['boat','ship','raft','sail','dock','vessel','port'].includes(t))?'maritime'
        : tokens.some(t=>['armor','armour','weapon','sword','shield','helmet','axe','bow','equipment'].includes(t))?'equipment'
        : tokens.some(t=>['knight','soldier','warrior','character','npc'].includes(t))?'character':'misc';
      out.push({x:Number(node.x),y:Number(node.y),w:Number(node.w),h:Number(node.h),label,tags:tokens,category,path:path.join('/'),used:0});
      return out;
    }
    Object.entries(node).forEach(([k,v])=>flatten(v,path.concat(k),out));
    return out;
  }

  async function load(){
    if(registry.loading||registry.ready)return;
    registry.loading=true;
    try{
      const [atlasText,manifestText]=await Promise.all([
        fetch(root+'supplemental_asset_atlas.b64').then(r=>r.text()),
        fetch(root+'supplemental_asset_manifest.json.gz.b64').then(r=>r.text())
      ]);
      const manifest=JSON.parse(textFromBytes(await inflate(bytesFromB64(manifestText))));
      const sprites=flatten(manifest);
      if(!sprites.length) throw new Error('supplemental manifest contained no sprite frames');
      const blob=new Blob([bytesFromB64(atlasText)],{type:'image/webp'});
      const url=URL.createObjectURL(blob);
      const image=new Image();
      await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url;});
      registry.image=image;
      registry.sprites=sprites;
      registry.stats.loadedSprites=sprites.length;
      sprites.forEach(s=>{registry.categories[s.category]=(registry.categories[s.category]||0)+1;});
      registry.ready=true;
      registry.error=null;
      console.log('Everglen supplemental assets ready:',sprites.length);
    }catch(error){
      registry.error=String(error?.stack||error);
      console.warn('Everglen supplemental assets unavailable:',registry.error);
    }finally{registry.loading=false;}
  }
  registry.load=load;
  load();
})();
