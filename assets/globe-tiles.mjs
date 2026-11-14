// Scharfe Erde beim Heranzoomen (Eddie 2026-11-10: "so nah auf den Globus schauen können und die Schärfe").
// The base Earth is one 4K texture (~10 km per texel), so it blurs at close range. When the camera comes close,
// this layer drapes NASA Blue Marble tiles (same imagery as the base model, up to ~500 m per texel) over the part
// of the Earth that is in view. Tiles follow the NASA GIBS EPSG:4326 grid: 512 px tiles, level 0 spans 288 degrees,
// every level halves it, origin top left (-180, 90). Nothing is requested at the default distance; if the tile
// server fails, the base Earth simply stays. ?kacheln=aus switches the layer off.
// Pure grid math is exported for tests; createTileLayer() needs three.js.
export const TILE_PX=512,LEVEL0_SPAN=288,MAX_LEVEL=11,MIN_LEVEL=3,MAX_TILES=40,BASE_TEXELS_PER_DEG=4096/360;
// Zwei Bildquellen im selben GIBS-Raster (Eddie 2026-11-14 "schärfer, weiter ranzoomen"): bis Stufe 7 Blue Marble
// (~500 m), ab Stufe 8 Landsat WELD (Jahresmosaik 2000, Matrixsatz 31.25m, bis ~30 m). Landsat hat über dem Meer und in
// Aufnahmelücken schwarze Flächen ohne Daten; dort wird nichts gezeichnet und die Blue-Marble-Kachel darunter bleibt sichtbar.
export const FINE_LEVEL=8;
const GIBS='https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/';
export const TILE_SOURCE={
  name:'NASA Blue Marble (GIBS, 500 m)',
  url:(level,x,y)=>`${GIBS}wmts.cgi?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=BlueMarble_ShadedRelief_Bathymetry&STYLE=default&TILEMATRIXSET=500m&TILEMATRIX=${level}&TILEROW=${y}&TILECOL=${x}&FORMAT=image%2Fjpeg`
};
export const FINE_SOURCE={
  name:'NASA GIBS: Landsat WELD 2000 (30 m) und Blue Marble (500 m)',
  url:(level,x,y)=>`${GIBS}Landsat_WELD_CorrectedReflectance_TrueColor_Global_Annual/default/2000-12-01/31.25m/${level}/${y}/${x}.jpeg`
};
export const sourceFor=(level,source=TILE_SOURCE,fine=FINE_SOURCE)=>fine&&level>=FINE_LEVEL?fine:source;
const rad=Math.PI/180;
export const tileSpan=level=>LEVEL0_SPAN/2**level;
export const gridSize=level=>({cols:Math.ceil(360/tileSpan(level)),rows:Math.ceil(180/tileSpan(level))});
// Geographic extent of a tile, clipped to the world (edge tiles of the grid are partly empty).
export function tileBounds(level,x,y){
  const span=tileSpan(level),west=-180+x*span,north=90-y*span;
  return {west,east:Math.min(180,west+span),north,south:Math.max(-90,north-span),span};
}
// Finest useful level: one texel per screen pixel at the centre of the view. -1 = the base Earth is sharp enough.
export function levelFor(distance,fovDeg,heightPx,radius=100,base=BASE_TEXELS_PER_DEG,maxLevel=MAX_LEVEL){
  const altitude=Math.max(1e-3,distance-radius);
  const pxPerDeg=heightPx/(2*altitude*Math.tan(fovDeg*rad/2))*(radius*rad);
  // The base Earth carries 4096 texels per 360 degrees (Annahmen-Atlas: 2048); below that the tiles add nothing.
  if(pxPerDeg<=base)return -1;
  return Math.max(MIN_LEVEL,Math.min(maxLevel,Math.ceil(Math.log2(.5625*pxPerDeg))));
}
// Angular radius (degrees, from the Earth's centre) of the surface patch seen by a camera that looks at the centre.
export function viewCap(distance,fovDeg,aspect,radius=100){
  const half=Math.atan(Math.tan(fovDeg*rad/2)*Math.hypot(1,aspect));
  const s=distance*Math.sin(half)/radius;
  return (s>=1?Math.acos(radius/distance):Math.asin(s)-half)/rad;
}
const angle=(lat1,lon1,lat2,lon2)=>Math.acos(Math.max(-1,Math.min(1,Math.sin(lat1*rad)*Math.sin(lat2*rad)+Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.cos((lon2-lon1)*rad))))/rad;
const wrap=lon=>((lon+540)%360)-180;
// Tiles of one level that touch the cap around (lat, lon), nearest first.
export function tilesInView(lat,lon,capDeg,level){
  const {cols,rows}=gridSize(level),span=tileSpan(level),out=[];
  const north=lat+capDeg,south=lat-capDeg,pole=north>=90||south<=-90;
  const dLon=pole?180:Math.asin(Math.min(1,Math.sin(capDeg*rad)/Math.cos(lat*rad)))/rad;
  const y0=Math.max(0,Math.floor((90-Math.min(90,north))/span)),y1=Math.min(rows-1,Math.floor((90-Math.max(-90,south))/span-1e-9));
  for(let y=y0;y<=y1;y++)for(let x=0;x<cols;x++){
    const b=tileBounds(level,x,y);if(b.west>=180)continue;
    // Closest point of the tile to the centre: clamp latitude, clamp longitude in the wrapped frame.
    const mid=(b.west+b.east)/2,half=(b.east-b.west)/2,dl=wrap(lon-mid);
    if(!pole&&Math.abs(dl)>half+dLon)continue;
    const cLat=Math.max(b.south,Math.min(b.north,lat)),cLon=mid+Math.max(-half,Math.min(half,dl));
    const d=angle(lat,lon,cLat,cLon);
    if(d<=capDeg)out.push({level,x,y,d});
  }
  return out.sort((a,b)=>a.d-b.d);
}
// Level and tiles for a camera view; steps down a level while more than MAX_TILES would be needed.
export function planView({lat,lon,distance,fov,aspect,height,radius=100,base=BASE_TEXELS_PER_DEG,maxLevel=MAX_LEVEL}){
  let level=levelFor(distance,fov,height,radius,base,maxLevel);
  if(level<0)return {level:-1,tiles:[]};
  const cap=viewCap(distance,fov,aspect,radius);
  let tiles=tilesInView(lat,lon,cap,level);
  while(tiles.length>MAX_TILES&&level>MIN_LEVEL){level--;tiles=tilesInView(lat,lon,cap,level);}
  return {level,tiles:tiles.slice(0,MAX_TILES)};
}

export function createTileLayer(THREE,scene,renderer,{invalidate,host,source=TILE_SOURCE,fine=FINE_SOURCE,maxLevel=fine?MAX_LEVEL:FINE_LEVEL-1,radius=100,base=BASE_TEXELS_PER_DEG,lit=true}={}){
  const off=new URLSearchParams(location.search).get('kacheln')==='aus';
  const group=new THREE.Group();group.name='erd-kacheln';scene.add(group);
  const cache=new Map();// key -> {state:'loading'|'ready'|'failed', mesh, used, retry}
  let active=0,failures=0,disabled=off,shownKey='',lastPlan=null,tick=0;
  const credit=document.createElement('div');
  credit.className='globe-tile-credit';credit.textContent=`Bild: ${source.name}`;credit.hidden=true;
  credit.style.cssText='position:absolute;right:8px;bottom:2px;font:11px/1.3 system-ui,sans-serif;color:#cfe3ff;opacity:.75;pointer-events:none;text-shadow:0 1px 2px #000;z-index:2';
  if(host){if(getComputedStyle(host).position==='static')host.style.position='relative';host.appendChild(credit);}
  const loader=new THREE.TextureLoader();loader.setCrossOrigin('anonymous');
  const key=(l,x,y)=>`${l}/${x}/${y}`;
  function geometry(level,x,y){
    const b=tileBounds(level,x,y),seg=Math.max(4,Math.min(32,Math.ceil((b.east-b.west)/1.2)));
    const n=(seg+1)**2,pos=new Float32Array(n*3),nor=new Float32Array(n*3),uv=new Float32Array(n*2),index=[];
    for(let j=0,v=0;j<=seg;j++)for(let i=0;i<=seg;i++,v++){
      const lat=b.north+(b.south-b.north)*j/seg,lon=b.west+(b.east-b.west)*i/seg,c=Math.cos(lat*rad);
      const p=[c*Math.cos(lon*rad),Math.sin(lat*rad),-c*Math.sin(lon*rad)];
      nor.set(p,v*3);pos.set(p.map(k=>k*radius),v*3);
      // Texture coordinates inside the full 288/2^level tile (edge tiles are clipped, the image is not).
      uv[v*2]=(lon-b.west)/b.span;uv[v*2+1]=1-(b.north-lat)/b.span;
      if(i<seg&&j<seg){const a=v,c2=v+seg+1;index.push(a,c2,a+1,a+1,c2,c2+1);}
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('normal',new THREE.BufferAttribute(nor,3));g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setIndex(index);
    g.computeBoundingSphere();return g;
  }
  function load(t){
    const k=key(t.level,t.x,t.y),entry={state:'loading',mesh:null,used:tick};cache.set(k,entry);active++;
    loader.load(sourceFor(t.level,source,fine).url(t.level,t.x,t.y),texture=>{
      active--;failures=0;
      texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
      texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;
      // Finer levels win the depth test against coarser ones still shown underneath.
      // lit: same surface as the NASA model of the Hauptatlas; unlit: like the plain mosaic of the Annahmen-Atlas.
      const look={map:texture,polygonOffset:true,polygonOffsetFactor:-1-t.level,polygonOffsetUnits:-4-4*t.level};
      const material=lit?new THREE.MeshStandardMaterial({...look,metalness:.25,roughness:.9}):new THREE.MeshBasicMaterial(look);
      // Landsat: schwarze Bildpunkte (Meer, Aufnahmelücken; JPEG-Rauschen bis ~10/255) nicht zeichnen.
      if(t.level>=FINE_LEVEL)material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include map_fragment','#include map_fragment\n  if(max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b))<0.0035)discard;');};
      entry.mesh=new THREE.Mesh(geometry(t.level,t.x,t.y),material);entry.mesh.visible=false;entry.mesh.renderOrder=-2;
      entry.state='ready';group.add(entry.mesh);shownKey=null;invalidate();
    },undefined,()=>{
      active--;entry.state='failed';entry.retry=performance.now()+30000;
      // Server unreachable (offline, blocked): stop asking and keep the base Earth.
      if(++failures>=6)disabled=true;
      invalidate();
    });
  }
  function evict(){
    if(cache.size<=160)return;
    const old=[...cache.entries()].filter(([,e])=>e.state!=='loading'&&!e.mesh?.visible).sort((a,b)=>a[1].used-b[1].used);
    for(const [k,e] of old.slice(0,cache.size-160)){
      if(e.mesh){group.remove(e.mesh);e.mesh.geometry.dispose();e.mesh.material.map?.dispose();e.mesh.material.dispose();}
      cache.delete(k);
    }
  }
  // Called once per drawn frame with the camera; cheap when the view did not change.
  function update(camera,width,height){
    if(disabled){if(group.visible){group.visible=false;credit.hidden=true;}return;}
    const p=camera.position,distance=p.length();
    const lat=Math.asin(Math.max(-1,Math.min(1,p.y/distance)))/rad,lon=Math.atan2(-p.z,p.x)/rad;
    const plan=planView({lat,lon,distance,fov:camera.fov,aspect:width/Math.max(1,height),height:height*renderer.getPixelRatio(),radius,base,maxLevel});
    tick++;
    const wanted=new Set();
    for(const t of plan.tiles){
      // Show the tile if loaded, otherwise its nearest loaded ancestor (the grid halves exactly per level).
      let l=t.level,x=t.x,y=t.y,shown=null;
      while(l>=MIN_LEVEL){const e=cache.get(key(l,x,y));if(e?.state==='ready'){shown=key(l,x,y);e.used=tick;break;}l--;x>>=1;y>>=1;}
      if(shown)wanted.add(shown);
      const own=cache.get(key(t.level,t.x,t.y));
      if(!own||(own.state==='failed'&&performance.now()>own.retry)){if(active<6)load(t);}
      else own.used=tick;
      // Unter Landsat-Kacheln bleibt die Blue-Marble-Kachel der Stufe 7 liegen (Meer und Datenlücken).
      if(t.level>=FINE_LEVEL){
        const d=t.level-FINE_LEVEL+1,b={level:FINE_LEVEL-1,x:t.x>>d,y:t.y>>d},kb=key(b.level,b.x,b.y),eb=cache.get(kb);
        if(eb?.state==='ready'){wanted.add(kb);eb.used=tick;}else if(!eb||(eb.state==='failed'&&performance.now()>eb.retry)){if(active<6)load(b);}
      }
    }
    const k=[...wanted].sort().join('|');
    if(k!==shownKey){
      shownKey=k;
      for(const [key2,e] of cache)if(e.mesh)e.mesh.visible=wanted.has(key2);
      credit.textContent=`Bild: ${sourceFor(plan.level,source,fine).name}`;credit.hidden=!wanted.size;if(host)host.dataset.kacheln=wanted.size?String(plan.level):'aus';
      evict();invalidate();
    }
    group.visible=wanted.size>0;lastPlan=plan;
  }
  function dispose(){
    for(const e of cache.values())if(e.mesh){e.mesh.geometry.dispose();e.mesh.material.map?.dispose();e.mesh.material.dispose();}
    cache.clear();scene.remove(group);credit.remove();
  }
  return {update,dispose,state:()=>({disabled,level:lastPlan?.level??-1,wanted:lastPlan?.tiles.length??0,shown:[...cache.values()].filter(e=>e.mesh?.visible).length,loading:active,cached:cache.size})};
}
