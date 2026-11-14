import {clusterProjected,markerPixels} from './globe-detail.mjs';
import {statuses,hasPoint} from './market-logic.mjs';
import * as THREE from 'three';
import {GlobeNavigation,MIN_DISTANCE_NO_TILES} from './globe-navigation.js';
import {borderPositions} from './globe-borders.mjs';
import {geoVector,vectorGeo,arcSample,frontVisible,greatCircleAngle} from './globe-math.mjs';
import {createTileLayer} from './globe-tiles.mjs';

const vec=coordinates=>new THREE.Vector3(...coordinates);
const up=new THREE.Vector3(0,1,0);
// Adaptive Qualität (analysis/LEISTUNG.md): schwache Geräte (Datensparmodus, wenig Speicher/Kerne, Handy mit <=4 GB
// oder <=4 Kernen) laden die 2K-Erde, zeichnen mit höchstens 1,25-facher Pixeldichte ohne Kantenglättung und animieren
// mit 20 statt 30 Bildern/s. ?qualitaet=hoch|niedrig erzwingt eine Stufe. Daten, Bögen und Klickziele sind gleich.
export function performanceProfile(){
  const forced=new URLSearchParams(location.search).get('qualitaet');
  const mem=navigator.deviceMemory||8,cores=navigator.hardwareConcurrency||8,save=navigator.connection?.saveData===true;
  const touch=matchMedia('(pointer: coarse)').matches;
  const weak=forced==='niedrig'||(forced!=='hoch'&&(save||mem<=2||cores<=2||(touch&&(mem<=4||cores<=4))));
  return {weak,maxPixelRatio:weak?1.25:1.75,antialias:!weak,fps:weak?20:30};
}
export function createGlobe(host,callbacks={}){
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const quality=performanceProfile();
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(42,1,.1,5200);
  camera.position.copy(vec(geoVector(25,-35,310)));
  const renderer=new THREE.WebGLRenderer({antialias:quality.antialias,alpha:true,powerPreference:'default'});
  let pixelRatio=Math.min(devicePixelRatio,quality.maxPixelRatio);
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.setClearColor(0x050914,0);
  host.appendChild(renderer.domElement);
  renderer.domElement.tabIndex=0;
  renderer.domElement.setAttribute('aria-label','3D-Erde: Ziehen zum Drehen, Mausrad oder zwei Finger zum Zoomen. Pfeiltasten drehen; Plus und Minus zoomen. Alle Einträge sind auch in der Liste erreichbar.');
  const controls=new GlobeNavigation(camera,renderer.domElement,{
    onStart:()=>{flight=null;stopRotation();callbacks.onHover?.(null);},
    onHover:event=>{if(introHidden)return;if(!event){callbacks.onHover?.(null);callbacks.onSurfaceHover?.(null);return;}const hit=pick(event,false);renderer.domElement.style.cursor=hit?'pointer':'grab';callbacks.onHover?.(hit?.deal||null,event.clientX,event.clientY);let l=null;if(!hit&&callbacks.onSiteLinkHover){l=pickLink(event);if(l)renderer.domElement.style.cursor='pointer';callbacks.onSiteLinkHover(l,event.clientX,event.clientY);}
      // Land unter der Maus (Eddie 2026-11-14): hebt sich immer hervor; busy = Punkt oder Verbindung getroffen (deren Klick hat Vorrang).
      if(callbacks.onSurfaceHover){const at=surfaceAt(event),busy=!!(hit||l);callbacks.onSurfaceHover(at,event,busy);if(at&&!busy&&callbacks.surfaceClickable?.(at))renderer.domElement.style.cursor='pointer';}},
    onTap:event=>{if(introHidden)return;const hit=pick(event,true);if(hit?.deal)callbacks.onDealClick?.(hit.deal.id);else if(hit?.companies)callbacks.onCompanyClick?.(hit.companies);else if(hit?.sites)callbacks.onSiteClick?.(hit.sites);else if(hit?.links)callbacks.onSiteLinkClick?.(hit.links);callbacks.onSurfaceTap?.(surfaceAt(event),event,!!hit);}
 
  },host.parentElement);
  controls.autoRotate=false;
  scene.add(new THREE.AmbientLight(0xabc5ef,1.45));
  const sun=new THREE.DirectionalLight(0xfff8e9,2.0);
  sun.position.set(300,220,260);
  scene.add(sun);
  const earthMaterial=new THREE.MeshPhongMaterial({color:0xc5dcff,shininess:12,specular:0x1d354b});
  const earth=new THREE.Mesh(new THREE.SphereGeometry(100,96,64),earthMaterial);
  scene.add(earth);
  // NASA-Erdmodell mit JPEG-Texturen (scripts/analysis/leistung/erdmodell_komprimieren.py): 4K 1,7 MB statt 12,6 MB,
  // 2K 0,6 MB für schwache Geräte oder GPUs ohne 4096er-Texturen. Geometrie und Material sind unverändert.
  const earthModel=quality.weak||renderer.capabilities.maxTextureSize<4096?'/assets/earth-nasa-2k.glb':'/assets/earth-nasa-4k.glb';
  // The browser may abort a large download, so retry before falling back.
  // GLTFLoader (+BufferGeometryUtils, 150 KB) is split off and loaded only for the model, after the globe is drawn.
  const loadEarth=attempt=>import('./three/GLTFLoader.js').then(({GLTFLoader})=>new GLTFLoader().load(earthModel,gltf=>{
    const model=gltf.scene;
    // NASA asset: equatorial radius 500, Y north. Its -Z axis is Greenwich;
    // our geographic layer uses +X for Greenwich and -Z for 90 degrees east.
    model.scale.setScalar(.2);model.rotation.y=-Math.PI/2;
    model.traverse(object=>{if(object.isMesh){
      if(object.material.map)object.material.map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
      object.material.needsUpdate=true;
    }});
    scene.add(model);earth.visible=false;invalidate();
    callbacks.onEarth?.('NASA Earth 3D');
  },undefined,()=>attempt<2?setTimeout(()=>loadEarth(attempt+1),500*(attempt+1)):callbacks.onNotice?.('Das NASA-3D-Modell konnte nicht geladen werden. Als Ersatz wird das bisherige NASA-Satellitenmosaik angezeigt.'))).catch(()=>attempt<2?setTimeout(()=>loadEarth(attempt+1),500*(attempt+1)):callbacks.onNotice?.('Das NASA-3D-Modell konnte nicht geladen werden. Als Ersatz wird das bisherige NASA-Satellitenmosaik angezeigt.'));
  loadEarth(0);
  // Satellite mosaic decoded off the main thread (ImageBitmap) where supported: an <img> upload blocked ~0.9 s on a phone.
  const mosaicLoader=typeof createImageBitmap==='function'&&!/^((?!chrome|android).)*safari/i.test(navigator.userAgent)&&!/firefox/i.test(navigator.userAgent)
    ?{load:(url,done,_,fail)=>new THREE.ImageBitmapLoader().setOptions({imageOrientation:'flipY',premultiplyAlpha:'none'}).load(url,bitmap=>{const texture=new THREE.Texture(bitmap);texture.flipY=false;texture.needsUpdate=true;done(texture);},undefined,fail)}
    :new THREE.TextureLoader();
  mosaicLoader.load('/assets/earth-blue-marble.jpg',texture=>{
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    earthMaterial.map=texture;earthMaterial.needsUpdate=true;invalidate();
  },undefined,()=>callbacks.onNotice?.('Das Satellitenmosaik ist nicht verfügbar. Die Länderumrisse bleiben sichtbar.'));
  const atmosphereMaterial=new THREE.ShaderMaterial({
    uniforms:{glow:{value:new THREE.Color(0x65b9ff)}},
    vertexShader:'varying vec3 vNormal; varying vec3 vView; void main(){vec4 p=modelViewMatrix*vec4(position,1.0);vNormal=normalize(normalMatrix*normal);vView=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',
    fragmentShader:'uniform vec3 glow;varying vec3 vNormal;varying vec3 vView;void main(){float i=pow(1.0-max(dot(normalize(vNormal),normalize(vView)),0.0),3.0);gl_FragColor=vec4(glow,i*0.55);}',
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(102,80,56),atmosphereMaterial));
  // Scharfe Erde beim Heranzoomen: NASA-Kacheln nur für den sichtbaren Ausschnitt (assets/globe-tiles.mjs).
  const tiles=createTileLayer(THREE,scene,renderer,{invalidate:()=>invalidate(),host});
  if(tiles.state().disabled)controls.minDistance=MIN_DISTANCE_NO_TILES;
  // Weltraum: the sky is one group (stars, with callbacks.space also Milky Way and nebulae) that turns against the
  // Earth's rotation while the Earth spins (Eddie 2026-11-08). Without callbacks.space the plain star dots as before.
  const sky=new THREE.Group();sky.matrixAutoUpdate=false;scene.add(sky);
  let seed=731;
  const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const skyMaterials=[];
  if(callbacks.space){
    // Milky Way plane (tilted like seen from the Earth) and ~5,000 stars: half evenly spread, half gathered in the band.
    const normal=new THREE.Vector3(.36,.86,.36).normalize(),e1=new THREE.Vector3(1,0,0).cross(normal).normalize(),e2=normal.clone().cross(e1);
    const gauss=()=>{let s=0;for(let k=0;k<4;k++)s+=rand();return (s-2)/.58;};
    const band=(spread,out)=>{const a=rand()*Math.PI*2,e=gauss()*spread;return out.copy(e1).multiplyScalar(Math.cos(a)*Math.cos(e)).addScaledVector(e2,Math.sin(a)*Math.cos(e)).addScaledVector(normal,Math.sin(e));};
    const n=5200,pos=new Float32Array(n*3),col=new Float32Array(n*3),size=new Float32Array(n),v=new THREE.Vector3();
    const tints=[[.82,.89,1],[.82,.89,1],[.82,.89,1],[1,.9,.76],[.66,.78,1],[1,.97,.9]];
    for(let i=0;i<n;i++){
      if(i<2500){const y=rand()*2-1,a=rand()*Math.PI*2,s=Math.sqrt(1-y*y);v.set(s*Math.cos(a),y,s*Math.sin(a));}else band(.11,v);
      v.multiplyScalar(2600+rand()*450).toArray(pos,i*3);
      const t=tints[Math.floor(rand()*tints.length)],b=.55+.45*Math.pow(rand(),1.4);
      col.set([t[0]*b,t[1]*b,t[2]*b],i*3);
      size[i]=i<2500?2+5.5*Math.pow(rand(),6):1.6+2.4*Math.pow(rand(),4);
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(pos,3));geometry.setAttribute('aColor',new THREE.BufferAttribute(col,3));geometry.setAttribute('aSize',new THREE.BufferAttribute(size,1));
    const material=new THREE.ShaderMaterial({uniforms:{uPixel:{value:1},uTime:{value:0}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      vertexShader:'attribute float aSize;attribute vec3 aColor;uniform float uPixel;uniform float uTime;varying vec3 vColor;void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mv;float tw=.78+.22*sin(uTime*1.7+position.x*.31+position.z*.17);vColor=aColor*tw;gl_PointSize=aSize*uPixel;}',
      fragmentShader:'varying vec3 vColor;void main(){float d=length(gl_PointCoord-.5);float core=smoothstep(.5,.12,d);float glow=exp(-d*d*14.0)*.45;gl_FragColor=vec4(vColor,max(core,glow));}'});
    skyMaterials.push(material);sky.add(new THREE.Points(geometry,material));
    // Nebulae and the glow of the Milky Way: soft blobs painted once into a texture on a far sphere (after first paint).
    const paint=()=>{
      if(disposed)return;
      const W=1024,H=512,canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const g=canvas.getContext('2d');
      const blob=(dir,radius,color,alpha)=>{
        const theta=Math.acos(THREE.MathUtils.clamp(dir.y,-1,1)),phi=(Math.atan2(dir.z,-dir.x)+Math.PI*2)%(Math.PI*2);
        const x=phi/(Math.PI*2)*W,y=theta/Math.PI*H,stretch=1/Math.max(.25,Math.sin(theta));
        for(const dx of [-W,0,W]){g.save();g.translate(x+dx,y);g.scale(stretch,1);const grad=g.createRadialGradient(0,0,0,0,0,radius);
          grad.addColorStop(0,`rgba(${color},${alpha})`);grad.addColorStop(1,`rgba(${color},0)`);g.fillStyle=grad;g.fillRect(-radius,-radius,radius*2,radius*2);g.restore();}
      };
      const glow=['120,140,220','150,120,210','90,150,200','200,170,150'];
      for(let i=0;i<320;i++)blob(band(.08,v),14+rand()*40,glow[Math.floor(rand()*glow.length)],.06+rand()*.08);
      const clouds=[['150,70,190',.24],['50,130,210',.22],['190,80,120',.18],['70,170,180',.18],['120,90,220',.2]];
      for(const [color,alpha] of clouds){const y=rand()*1.6-.8,a=rand()*Math.PI*2,s=Math.sqrt(1-y*y),dir=new THREE.Vector3(s*Math.cos(a),y,s*Math.sin(a));
        for(let k=0;k<9;k++)blob(dir.clone().addScaledVector(new THREE.Vector3(rand()-.5,rand()-.5,rand()-.5),.12).normalize(),18+rand()*42,color,alpha*(.4+rand()*.6));}
      const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
      const nebula=new THREE.Mesh(new THREE.SphereGeometry(3400,48,24),new THREE.MeshBasicMaterial({map:texture,side:THREE.BackSide,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
      nebula.renderOrder=-2;sky.add(nebula);invalidate();
    };
    (window.requestIdleCallback||(f=>setTimeout(f,200)))(paint,{timeout:2500});
  }else{
    const stars=[];
    for(let i=0;i<1300;i++){const a=rand()*Math.PI*2,y=rand()*2-1,s=Math.sqrt(1-y*y),r=2600+rand()*450;stars.push(r*s*Math.cos(a),r*y,r*s*Math.sin(a));}
    const starGeometry=new THREE.BufferGeometry();starGeometry.setAttribute('position',new THREE.Float32BufferAttribute(stars,3));
    sky.add(new THREE.Points(starGeometry,new THREE.PointsMaterial({color:0xd5e0fa,size:1.15,sizeAttenuation:false,transparent:true,opacity:.53,depthWrite:false})));
  }
  // Country borders are parsed and built in a Web Worker (globe-borders.mjs); main thread only if workers fail.
  fetch('/assets/world.json').then(r=>{if(!r.ok)throw new Error('world');return r.text();}).then(text=>new Promise(resolve=>{
    const main=()=>resolve(borderPositions(JSON.parse(text),100.08));
    try{
      const url=URL.createObjectURL(new Blob([`const borderPositions=${borderPositions};onmessage=e=>{const p=borderPositions(JSON.parse(e.data),100.08);postMessage(p,[p.buffer]);close();};`],{type:'text/javascript'}));
      const worker=new Worker(url);
      worker.onmessage=e=>{URL.revokeObjectURL(url);resolve(e.data);};worker.onerror=e=>{e.preventDefault?.();URL.revokeObjectURL(url);worker.terminate();main();};worker.postMessage(text);
    }catch{main();}
  })).then(positions=>{
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    scene.add(new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0x8cb2c1,transparent:true,opacity:.18,depthWrite:false})));invalidate();
  }).catch(()=>{});
  const pointMaterial=new THREE.PointsMaterial({vertexColors:true,size:1,sizeAttenuation:false,transparent:true,opacity:.95,depthWrite:false});
  // Render on demand: a frame is drawn only when the camera moved, a flow marker animates or the scene changed (invalidate()).
  // The loop sleeps when nothing changes (no rAF at all) and wakes on input, invalidate(), flights or rotation.
  // It also stops while the tab is hidden or the globe is scrolled/covered out of view (IntersectionObserver).
  let dirty=true,frame=0,onScreen=true,disposed=false;
  const wake=()=>{if(!frame&&!disposed)frame=requestAnimationFrame(animate);};
  const invalidate=()=>{dirty=true;wake();};
  let companies=[],pointGroups=[],companyPoints=null,companiesVisible=true,lastClusterKey='',lastClusterTime=0,dealEntries=[],selected=null,flight=null,lastRender=0,lastFrame=0,paused=false,lastRenderKey='',lastScaleDistance=-1,layers={points:true,lines:true};
  const dealGroup=new THREE.Group();scene.add(dealGroup);
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  const size={width:1,height:1};
  let firstSize=true;
  function homeDistance(){const halfFov=Math.min(camera.fov*Math.PI/360,Math.atan(Math.tan(camera.fov*Math.PI/360)*camera.aspect));return Math.min(580,Math.max(310,110/Math.sin(halfFov)));}
  function resize(){size.width=host.clientWidth;size.height=host.clientHeight;if(!size.width||!size.height)return;camera.aspect=size.width/size.height;camera.updateProjectionMatrix();renderer.setSize(size.width,size.height,false);invalidate();if(firstSize){camera.position.copy(vec(geoVector(25,-35,homeDistance())));firstSize=false;}}
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);resize();
  const visibility=new IntersectionObserver(entries=>{onScreen=entries[entries.length-1].isIntersecting;host.dataset.render=onScreen?'aktiv':'pausiert';if(onScreen)invalidate();});visibility.observe(host);
  const onVisibility=()=>{if(!document.hidden)invalidate();};document.addEventListener('visibilitychange',onVisibility);
  const inputHost=host.parentElement||host,inputs=['pointerdown','pointermove','wheel','keydown','touchstart','touchmove'];
  for(const type of inputs)inputHost.addEventListener(type,wake,{passive:true,capture:true});

  function stopRotation(){controls.autoRotate=false;callbacks.onRotation?.(false);}
  function setCompanies(records){companies=records.filter(c=>c.location);lastClusterKey='';updateCompanyClusters();}
  function updateCompanyClusters(){
    pointGroups=clusterProjected(companies,c=>{
      const world=geoVector(c.location.lat,c.location.lon,100.28),p=vec(world).project(camera);
      return {x:(p.x+1)*size.width/2,y:(1-p.y)*size.height/2,visible:frontVisible(world,camera.position.toArray())&&p.z<1&&Math.abs(p.x)<1&&Math.abs(p.y)<1};
    },camera.position.length()<120?10:18,c=>c.markerCategory||null);
    if(companyPoints){scene.remove(companyPoints);companyPoints.geometry.dispose();}
    const positions=pointGroups.flatMap(group=>geoVector(group[0].location.lat,group[0].location.lon,100.28));
    const colors=pointGroups.flatMap(group=>new THREE.Color(group[0].pointColor||0x85caff).toArray());
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    // One shared material: disposing it per update released the shader program and recompiled it on every cluster pass.
    pointMaterial.size=markerPixels(camera.position.length()-100)*(callbacks.markerScale||1);
    companyPoints=new THREE.Points(geometry,pointMaterial);
    companyPoints.visible=companiesVisible;scene.add(companyPoints);invalidate();
  }
  // Verbindungen als Band (Eddie 2026-11-08: "nicht zwei Punkte verbinden, sondern die Verbindung sein"): every
  // relation is one band along its arc, without end-point markers; light pulses run along it in its direction
  // (buyer -> target, origin -> destination).
  // Sender und Empfänger (Eddie 2026-11-10): the band starts thin and faint at the sender (from/buyer) and ends in a solid,
  // brighter arrowhead at the receiver (to/target), so the direction reads without motion too (reduced motion, screenshots).
  // The head length follows the band width (zoom), at most 30 % of the arc; dashes never cut the head. All bands of a set are one mesh and one draw call; the shader does the
  // width (follows the zoom), dashes (open/pending, money), dimming on selection, filter visibility and the pulses.
  // Picking still uses an invisible thin line per relation, so clicks and tooltips work as before.
  const RIBBON_STEPS=48,pickMaterial=new THREE.LineBasicMaterial({visible:false}),ribbonUniforms={uTime:{value:0},uScale:{value:1}};
  const ribbonVertex='attribute vec3 aSide;attribute float aT;attribute float aAcross;attribute vec3 aColor;attribute float aEntry;attribute float aStyle;attribute float aFlow;attribute float aVisible;attribute float aLen;attribute float aWidth;'+
    'uniform float uScale;uniform float uSelected;varying float vT;varying float vAcross;varying vec3 vColor;varying float vStyle;varying float vFlow;varying float vAlpha;varying float vLen;varying float vPhase;varying float vHead;'+
    'void main(){float sel=uSelected<0.0?0.0:(abs(aEntry-uSelected)<0.5?1.0:-1.0);float H=clamp(22.0*uScale/max(aLen,.001),.08,.3);'+
    'float w=(aT<1.0-H?.35+.65*smoothstep(0.0,.3,aT/(1.0-H)):3.2*(1.0-aT)/H)*uScale*aWidth*(sel>.5?1.8:1.0);vHead=aT>1.0-H+.001?1.0:0.0;'+
    'vT=aT;vAcross=aAcross;vColor=aColor;vStyle=aStyle;vFlow=aFlow;vLen=aLen;vPhase=fract(aEntry*.173);vAlpha=aVisible*(sel<-.5?.13:1.0);'+
    'gl_Position=projectionMatrix*modelViewMatrix*vec4(position+aSide*aAcross*w,1.0);}';
  const ribbonFragment='uniform float uTime;uniform float uFlowOn;uniform float uBase;varying float vT;varying float vAcross;varying vec3 vColor;varying float vStyle;varying float vFlow;varying float vAlpha;varying float vLen;varying float vPhase;varying float vHead;'+
    'void main(){if(vAlpha<.01)discard;float along=vT*vLen;'+
    'if(vStyle>.5&&vHead<.5){float period=vStyle>2.5?.9:vStyle>1.5?2.6:2.2;if(mod(along,period)>period*(vStyle>2.5?.55:vStyle>1.5?.65:.55))discard;}'+
    'float head=fract(vT*max(1.0,vLen/70.0)-uTime*.16+vPhase);float pulse=vFlow*uFlowOn*pow(head,10.0);'+
    'float edge=1.0-smoothstep(.45,1.0,abs(vAcross));'+
    'gl_FragColor=vec4(mix(vColor,vec3(1.0),max(pulse*.6,vHead*.22)),vAlpha*edge*(.45+.55*vT)*(uBase+(1.0-uBase)*max(pulse,vHead*.6)));}';
  function ribbonMesh(items){
    // items: {points (RIBBON_STEPS+1 Vector3), color, style 0 solid | 1 dashed | 2 money, flow 0|1, width (factor, default 1; Bogenstärke nach Menge, menge-wert.mjs)}
    const n=items.length*(RIBBON_STEPS+1)*2,f3=()=>new Float32Array(n*3),f1=()=>new Float32Array(n);
    const pos=f3(),side=f3(),color=f3(),t=f1(),across=f1(),entry=f1(),style=f1(),flow=f1(),visible=f1().fill(1),len=f1(),width=f1();
    const index=new Uint32Array(items.length*RIBBON_STEPS*6),c=new THREE.Color(),tangent=new THREE.Vector3(),normal=new THREE.Vector3(),s=new THREE.Vector3();
    let v=0,k=0;
    items.forEach((item,e)=>{
      const p=item.points;let length=0;for(let i=1;i<p.length;i++)length+=p[i].distanceTo(p[i-1]);
      c.setHex(item.color,THREE.LinearSRGBColorSpace);item.start=v;item.count=p.length*2;
      for(let i=0;i<p.length;i++){
        tangent.subVectors(p[Math.min(i+1,p.length-1)],p[Math.max(i-1,0)]);normal.copy(p[i]).normalize();s.crossVectors(tangent,normal).normalize();
        for(const a of [-1,1]){pos.set(p[i].toArray(),v*3);side.set(s.toArray(),v*3);c.toArray(color,v*3);t[v]=i/(p.length-1);across[v]=a;entry[v]=e;style[v]=item.style;flow[v]=item.flow;len[v]=length;width[v]=item.width??1;v++;}
        if(i)index.set([v-4,v-3,v-2,v-3,v-1,v-2],(k++)*6);
      }
    });
    const geometry=new THREE.BufferGeometry();
    for(const [name,array,size] of [['position',pos,3],['aSide',side,3],['aColor',color,3],['aT',t,1],['aAcross',across,1],['aEntry',entry,1],['aStyle',style,1],['aFlow',flow,1],['aVisible',visible,1],['aLen',len,1],['aWidth',width,1]])geometry.setAttribute(name,new THREE.BufferAttribute(array,size));
    geometry.setIndex(new THREE.BufferAttribute(index,1));
    const material=new THREE.ShaderMaterial({uniforms:{...ribbonUniforms,uSelected:{value:-1},uFlowOn:{value:reduced?0:1},uBase:{value:.62}},vertexShader:ribbonVertex,fragmentShader:ribbonFragment,transparent:true,depthWrite:false,side:THREE.DoubleSide});
    const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.raycast=()=>{};return mesh;
  }
  function ribbonVisibility(mesh,items,isVisible){
    const attribute=mesh.geometry.attributes.aVisible;
    for(const item of items)attribute.array.fill(isVisible(item)?1:0,item.start,item.start+item.count);
    attribute.needsUpdate=true;
  }
  let dealRibbon=null,visualScale=1;
  // Site layer (assets/globe-sites.json, analysis/FACHATLANTEN.md): every site of every Fachatlas, ~40,000 points.
  // Positions are computed once into typed arrays; the cluster pass projects them with one matrix and reuses the buffers.
  // Display grouping only: every drawn point sits at an actual member's coordinate.
  const siteMaterial=new THREE.PointsMaterial({vertexColors:true,size:1,sizeAttenuation:false,transparent:true,opacity:.9,depthWrite:false});
  const siteMatrix=new THREE.Matrix4();
  let siteData=null,siteGroups=[],sitePoints=null,sitesVisible=true,lastSiteKey='',lastSiteTime=0;
  function setSites(records){
    const n=records.length,pos=new Float32Array(n*3),color=new Float32Array(n*3),group=new Int32Array(n),groupIds=new Map(),c=new THREE.Color();
    records.forEach((r,i)=>{pos.set(geoVector(r.lat,r.lon,100.22),i*3);c.set(r.color??0x85caff).toArray(color,i*3);if(!groupIds.has(r.group))groupIds.set(r.group,groupIds.size);group[i]=groupIds.get(r.group);});
    if(sitePoints){scene.remove(sitePoints);sitePoints.geometry.dispose();sitePoints=null;}
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(Math.max(3,n*3)),3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color',new THREE.BufferAttribute(new Float32Array(Math.max(3,n*3)),3).setUsage(THREE.DynamicDrawUsage));
    geometry.setDrawRange(0,0);
    sitePoints=new THREE.Points(geometry,siteMaterial);sitePoints.frustumCulled=false;sitePoints.renderOrder=-1;sitePoints.visible=sitesVisible&&n>0;scene.add(sitePoints);
    siteData={records,pos,color,group,n};lastSiteKey='';updateSiteClusters();
  }
  function updateSiteClusters(){
    if(!siteData)return;
    camera.updateMatrixWorld();siteMatrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
    const m=siteMatrix.elements,{pos,color,group,n}=siteData,cx=camera.position.x,cy=camera.position.y,cz=camera.position.z;
    const cell=camera.position.length()<120?8:14,cells=new Map(),w=size.width,h=size.height;
    for(let i=0;i<n;i++){
      const x=pos[i*3],y=pos[i*3+1],z=pos[i*3+2];
      if(x*(cx-x)+y*(cy-y)+z*(cz-z)<=0)continue;
      const cw=m[3]*x+m[7]*y+m[11]*z+m[15];if(cw<=0)continue;
      const px=(m[0]*x+m[4]*y+m[8]*z+m[12])/cw,py=(m[1]*x+m[5]*y+m[9]*z+m[13])/cw;
      if(px<-1||px>1||py<-1||py>1)continue;
      const key=group[i]*1e8+Math.floor((px+1)*w/2/cell)*1e4+Math.floor((1-py)*h/2/cell);
      const members=cells.get(key);if(members)members.push(i);else cells.set(key,[i]);
    }
    siteGroups=[...cells.values()];
    const geometry=sitePoints.geometry,outPos=geometry.attributes.position.array,outColor=geometry.attributes.color.array;
    siteGroups.forEach((members,k)=>{const i=members[0];outPos[k*3]=pos[i*3];outPos[k*3+1]=pos[i*3+1];outPos[k*3+2]=pos[i*3+2];outColor[k*3]=color[i*3];outColor[k*3+1]=color[i*3+1];outColor[k*3+2]=color[i*3+2];});
    geometry.setDrawRange(0,siteGroups.length);
    geometry.attributes.position.addUpdateRange(0,siteGroups.length*3);geometry.attributes.color.addUpdateRange(0,siteGroups.length*3);
    geometry.attributes.position.needsUpdate=true;geometry.attributes.color.needsUpdate=true;geometry.boundingSphere=null;
    siteMaterial.size=markerPixels(camera.position.length()-100)*.85;
    invalidate();
  }
  // Fachatlas connections between two placed sites (schematic great-circle arcs): one LineSegments batch, one draw call.
  // Fachatlas connections between two placed sites: bands like the relations (ribbonMesh, one draw call); an invisible
  // LineSegments batch of the same arcs stays for picking.
  const LINK_STEPS=32;
  let siteLinks=null,siteLinkRecords=[],siteRibbon=null;
  function setSiteLinks(records){
    if(siteLinks){scene.remove(siteLinks);siteLinks.geometry.dispose();siteRibbon.geometry.dispose();siteRibbon.material.dispose();siteLinks=null;siteRibbon=null;}
    siteLinkRecords=records;if(!records.length){invalidate();return;}
    const pos=new Float32Array(records.length*LINK_STEPS*6);
    const items=records.map((r,k)=>{
      const points=Array.from({length:RIBBON_STEPS+1},(_,i)=>vec(arcSample(r.from,r.to,i/RIBBON_STEPS,0,.55)));
      for(let i=0;i<LINK_STEPS;i++){const o=(k*LINK_STEPS+i)*6;pos.set(arcSample(r.from,r.to,i/LINK_STEPS,0,.55),o);pos.set(arcSample(r.from,r.to,(i+1)/LINK_STEPS,0,.55),o+3);}
      return {points,color:r.color??0x85caff,style:0,flow:1,width:r.width??1};
    });
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(pos,3));
    siteLinks=new THREE.LineSegments(geometry,pickMaterial);siteLinks.visible=sitesVisible;
    siteRibbon=ribbonMesh(items);siteLinks.add(siteRibbon);scene.add(siteLinks);invalidate();
  }
  function filterDeals(ids){const allowed=new Set(ids);dealEntries.forEach(e=>{e.visible=allowed.has(e.deal.id);e.line.visible=e.visible;});if(dealRibbon)ribbonVisibility(dealRibbon,dealEntries,e=>e.visible);invalidate();}
  function setDeals(records,entities){
    for(const entry of dealEntries)entry.line.geometry.dispose();
    if(dealRibbon){dealRibbon.geometry.dispose();dealRibbon.material.dispose();dealRibbon=null;}
    dealGroup.clear();dealEntries=[];selected=null;
    const corridors=new Map();
    records.flatMap(deal=>(deal.buyerIds||[deal.buyerId]).map(buyerId=>({...deal,buyerId}))).forEach((deal,index)=>{
      const buyer=entities[deal.buyerId],target=entities[deal.targetId];
      if(!hasPoint(buyer)||!hasPoint(target))return;
      const key=[deal.buyerId,deal.targetId].join('|'),parallel=corridors.get(key)||0;corridors.set(key,parallel+1);
      const lift=(parallel%10)*1.35;
      const statusColor=deal.flowColor??statuses[deal.status]?.color??0xd6f391;
      const points=Array.from({length:RIBBON_STEPS+1},(_,i)=>vec(arcSample(buyer,target,i/RIBBON_STEPS,lift,.55)));
      const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),pickMaterial);line.userData.dealId=deal.id;
      dealGroup.add(line);
      // Line style as in the legend: company relation solid when completed, dashed while open; material flow dotted; money long dashes.
      const style=deal.area==='money'?2:deal.flowKind?3:deal.status==='completed'?0:1;
      dealEntries.push({deal,buyer,target,line,index,lift,visible:true,points,color:statusColor,style,flow:deal.staticRelation?0:1});
    });
    if(dealEntries.length){dealRibbon=ribbonMesh(dealEntries);dealGroup.add(dealRibbon);}
    for(const e of dealEntries)e.points=null;
    lastScaleDistance=-1;invalidate();
  }
  function focusLocation(lat,lon,distance=250){
    stopRotation();const from=camera.position.clone();const to=vec(geoVector(lat,lon,Math.min(controls.maxDistance,Math.max(controls.minDistance,distance))));
    flight={from,to,started:performance.now(),duration:reduced?0:1050};wake();
  }
  function selectDeal(id,focus=true){
    selected=dealEntries.find(e=>e.deal.id===id)||null;
    if(dealRibbon)dealRibbon.material.uniforms.uSelected.value=selected?dealEntries.indexOf(selected):-1;
    invalidate();
    if(selected&&focus){const center=vectorGeo(arcSample(selected.buyer,selected.target,.5));const angle=greatCircleAngle(selected.buyer,selected.target);focusLocation(center.lat,center.lon,Math.max(145,Math.min(325,155+angle*120))*Math.max(1,.9/camera.aspect));}
  }
  function germany(){camera.up.set(0,1,0);controls.update();selectDeal(null,false);focusLocation(51,10,130);}
  function home(){camera.up.set(0,1,0);controls.update();selectDeal(null,false);focusLocation(25,-35,homeDistance());}
  function zoom(factor){stopRotation();flight=null;controls.zoom(factor);invalidate();}
  function toggleRotation(){flight=null;controls.autoRotate=!controls.autoRotate;callbacks.onRotation?.(controls.autoRotate);wake();return controls.autoRotate;}
  const canvas=renderer.domElement;
  function pick(event,includeCompanies){
    const rect=canvas.getBoundingClientRect();pointer.x=(event.clientX-rect.left)/rect.width*2-1;pointer.y=-(event.clientY-rect.top)/rect.height*2+1;
    raycaster.setFromCamera(pointer,camera);
    const groundPoint=raycaster.ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(),100),new THREE.Vector3());
    const ground=groundPoint?{distance:camera.position.distanceTo(groundPoint)}:null;
    const threshold=(camera.position.length()-100)*Math.tan(camera.fov*Math.PI/360)*2/size.height*(event.pointerType==='touch'?13:8);
    raycaster.params.Line.threshold=Math.max(.025,threshold);
    // Layers (Standorte / Verbindungen): a switched-off layer is not drawn and cannot be hit.
    const candidates=layers.lines?dealEntries.filter(e=>e.visible).map(e=>e.line):[];
    const dealOf=hit=>hit.object.userData.dealId?dealEntries.find(e=>e.line===hit.object)?.deal:null;
    const found=raycaster.intersectObjects(candidates,false).find(h=>dealOf(h)&&(!ground||h.distance<ground.distance+1));
    if(found)return {deal:dealOf(found)};
    if(!includeCompanies)return null;
    raycaster.params.Points.threshold=Math.max(.02,threshold);
    const nearest=object=>raycaster.intersectObject(object).filter(h=>!ground||h.distance<ground.distance+1).sort((a,b)=>(a.distanceToRay??0)-(b.distanceToRay??0))[0];
    const company=layers.points&&companyPoints?.visible?nearest(companyPoints):null;
    if(company)return {companies:pointGroups[company.index]};
    const site=layers.points&&sitePoints?.visible&&siteGroups.length?nearest(sitePoints):null;
    if(site)return {sites:siteGroups[site.index].map(i=>siteData.records[i])};
    const link=layers.lines&&siteLinks?.visible?raycaster.intersectObject(siteLinks).find(h=>!ground||h.distance<ground.distance+1):null;
    if(link)return {links:[siteLinkRecords[Math.floor(link.index/2/LINK_STEPS)]]};
    return null;
  }
  // Überfahren einer Fachatlas-Verbindung (Eddie 2026-11-11: Menge und Wert direkt am Bogen): höchstens alle 80 ms ein Treffertest.
  let linkPickAt=0,linkPickLast=null;
  // Erdoberfläche unter dem Zeiger als Breite/Länge (Kugel mit Radius 100, Achsen wie geoVector); null = daneben.
  const surfaceSphere=new THREE.Sphere(new THREE.Vector3(),100),surfaceRay=new THREE.Raycaster(),surfacePointer=new THREE.Vector2();
  function surfaceAt(event){
    const rect=canvas.getBoundingClientRect();surfacePointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    surfaceRay.setFromCamera(surfacePointer,camera);const p=surfaceRay.ray.intersectSphere(surfaceSphere,new THREE.Vector3());
    return p?{lat:Math.asin(Math.max(-1,Math.min(1,p.y/100)))*180/Math.PI,lon:Math.atan2(-p.z,p.x)*180/Math.PI}:null;
  }
  function pickLink(event){
    const now=performance.now();if(now-linkPickAt<80)return linkPickLast;linkPickAt=now;
    if(!layers.lines||!siteLinks?.visible){linkPickLast=null;return null;}
    const rect=canvas.getBoundingClientRect();pointer.x=(event.clientX-rect.left)/rect.width*2-1;pointer.y=-(event.clientY-rect.top)/rect.height*2+1;
    raycaster.setFromCamera(pointer,camera);
    const groundPoint=raycaster.ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(),100),new THREE.Vector3()),ground=groundPoint?camera.position.distanceTo(groundPoint):null;
    raycaster.params.Line.threshold=Math.max(.025,(camera.position.length()-100)*Math.tan(camera.fov*Math.PI/360)*2/size.height*8);
    const hit=raycaster.intersectObject(siteLinks,false).find(h=>ground==null||h.distance<ground+1);
    linkPickLast=hit?siteLinkRecords[Math.floor(hit.index/2/LINK_STEPS)]:null;return linkPickLast;
  }
  canvas.addEventListener('keydown',event=>{
    if(introHidden)return;
    const step=Math.max(.12,Math.min(8,(camera.position.length()-100)*.035));
    const direction={ArrowLeft:[0,-step],ArrowRight:[0,step],ArrowUp:[step,0],ArrowDown:[-step,0]}[event.key];
    if(direction){event.preventDefault();const p=vectorGeo(camera.position.toArray());focusLocation(Math.max(-85,Math.min(85,p.lat+direction[0])),p.lon+direction[1],camera.position.length());}
    if(['+','='].includes(event.key)){event.preventDefault();zoom(.85);}
    if(event.key==='-'){event.preventDefault();zoom(1.18);}
  });
  canvas.addEventListener('webglcontextrestored',()=>{paused=false;invalidate();});
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();paused=true;callbacks.onError?.('Die 3D-Darstellung wurde vom Gerät unterbrochen. Lade die Seite neu oder nutze die 2D-Karte.');});
  // Adaptive Bildrate: läuft das Zeichnen dauerhaft unter ~60 % der Zielrate, sinkt die Pixeldichte in 0,25-Schritten
  // bis 1, danach die Animationsrate auf 20 Bilder/s. Nur abwärts, damit das Bild nicht pendelt.
  let fps=quality.fps,lastMove=0,slowSamples=[];
  function adapt(interval){
    if(interval>250){slowSamples=[];return;}
    slowSamples.push(interval);if(slowSamples.length<24)return;
    const mean=slowSamples.reduce((a,b)=>a+b,0)/slowSamples.length;slowSamples=[];
    if(mean<1000/fps/.6)return;
    if(pixelRatio>1){pixelRatio=Math.max(1,pixelRatio-.25);renderer.setPixelRatio(pixelRatio);resize();}
    else if(fps>20)fps=20;
  }
  // Weltraum-Anflug (globe-intro.mjs, Eddie 2026-11-08): the Earth circles on an orbit through space, a click flies
  // the camera in. The scene (Earth, borders, data) is moved and spun as one; the stars get the inverse transform, so
  // they stay put. When the approach starts, the spin is handed to the camera, so after the intro the scene is at the
  // origin again and every geographic calculation (picking, navigation, focusLocation) is unchanged.
  const viewListeners=[],starWorld=new THREE.Matrix4(),skyBase=new THREE.Matrix4(),introOffset=new THREE.Vector3(),sceneInverse=new THREE.Matrix4();
  let intro=null,introHidden=false,skySpin=0;
  function updateSky(){starWorld.makeRotationY(skySpin).multiply(skyBase);sky.matrix.copy(sceneInverse).multiply(starWorld);sky.matrixWorldNeedsUpdate=true;}
  function orbitDepth(){const h=Math.atan(Math.tan(camera.fov*Math.PI/360)*camera.aspect);return THREE.MathUtils.clamp(330/Math.tan(h),1000,1500);}
  function placeScene(offset,spin){
    scene.position.copy(offset);scene.rotation.set(0,spin,0);scene.updateMatrix();
    sceneInverse.copy(scene.matrix).invert();
    updateSky();
  }
  // While the intro runs, the sun stands behind the viewer (upper right), so the side facing the screen is in daylight.
  function sunFromCamera(){
    const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion),upward=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
    sun.position.copy(camera.position).setLength(400).addScaledVector(right,170).addScaledVector(upward,140).applyMatrix4(sceneInverse);
  }
  function stepIntro(time){
    const s=(time-intro.started)/1000;
    if(intro.mode==='orbit'){
      const depth=orbitDepth(),half=depth*Math.tan(Math.atan(Math.tan(camera.fov*Math.PI/360)*camera.aspect));
      const radius=Math.max(60,Math.min(300,half-135)),angle=intro.angle+s*.3;
      camera.position.setLength(depth);
      introOffset.copy(intro.right).multiplyScalar(radius*Math.cos(angle)).addScaledVector(intro.toward,radius*.75*Math.sin(angle)).addScaledVector(intro.up,radius*.2*Math.sin(angle));
      intro.spin=s*.22;skySpin=-s*.05;placeScene(introOffset,intro.spin);
    }else{
      const t=reduced?1:Math.min(1,(time-intro.started)/intro.duration),ease=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
      camera.position.copy(intro.fromDirection).applyQuaternion(new THREE.Quaternion().slerp(intro.turn,ease)).setLength(THREE.MathUtils.lerp(intro.fromDepth,homeDistance(),ease));
      placeScene(introOffset.copy(intro.from).multiplyScalar(1-ease),0);
      if(t===1){const done=intro.done;intro=null;controls.locked=false;done?.();}
    }
  }
  function introOrbit(){
    flight=null;stopRotation();introHidden=true;controls.locked=true;
    controls.update();
    const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion),upward=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
    intro={mode:'orbit',started:performance.now(),angle:-.6,spin:0,right,up:upward,toward:camera.position.clone().normalize()};
    camera.position.setLength(orbitDepth());invalidate();
  }
  function handOverSpin(){
    // Turn the camera instead of the Earth: same picture, scene rotation back to zero.
    const q=new THREE.Quaternion().setFromAxisAngle(up,-(intro?.spin||0));
    camera.position.applyQuaternion(q);camera.up.applyQuaternion(q);introOffset.applyQuaternion(q);
    skyBase.premultiply(new THREE.Matrix4().makeRotationFromQuaternion(q));
  }
  function introApproach(done){
    if(!intro||intro.mode!=='orbit'){done?.();return;}
    handOverSpin();
    const fromDirection=camera.position.clone().normalize(),toDirection=vec(geoVector(28,30,1)).normalize();camera.up.set(0,1,0);
    intro={mode:'approach',started:performance.now(),duration:2200,from:introOffset.clone(),fromDepth:camera.position.length(),fromDirection,turn:new THREE.Quaternion().setFromUnitVectors(fromDirection,toDirection),done};invalidate();
  }
  function introEnd(){
    if(intro){handOverSpin();intro=null;placeScene(introOffset.set(0,0,0),0);camera.position.setLength(homeDistance());}
    controls.locked=false;introHidden=false;invalidate();
  }
  function introHit(x,y){
    const rect=canvas.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1),camera);
    return !!raycaster.ray.intersectSphere(new THREE.Sphere(scene.position,118),new THREE.Vector3());
  }
  function project(lat,lon){
    const position=geoVector(lat,lon,101),p=vec(position).project(camera);
    return {x:(p.x+1)*size.width/2,y:(1-p.y)*size.height/2,visible:frontVisible(position,camera.position.toArray())&&p.z<1&&Math.abs(p.x)<1&&Math.abs(p.y)<1};
  }
  function startRotation(){flight=null;controls.autoRotate=true;callbacks.onRotation?.(true);wake();}
  function animate(time){
    frame=0;
    if(document.hidden||paused||!onScreen||disposed)return;
    frame=requestAnimationFrame(animate);
    const dt=Math.min(.05,(time-lastFrame)/1000||.016);lastFrame=time;
    if(intro){stepIntro(time);dirty=true;}
    if(flight){const t=flight.duration?Math.min(1,(time-flight.started)/flight.duration):1;const ease=1-Math.pow(1-t,3);const fromDirection=flight.from.clone().normalize(),toDirection=flight.to.clone().normalize();const quaternion=new THREE.Quaternion().setFromUnitVectors(fromDirection,toDirection);const rotation=new THREE.Quaternion().slerp(quaternion,ease);camera.position.copy(fromDirection.applyQuaternion(rotation)).multiplyScalar(THREE.MathUtils.lerp(flight.from.length(),flight.to.length(),ease));if(t===1)flight=null;}
    if(controls.autoRotate&&!controls.points.size&&!intro){skySpin-=dt*controls.spinRate()*1.6;updateSky();}
    controls.update(dt);
    if(introHidden)sunFromCamera();
    if(time-lastRender<1000/fps)return;
    const interval=time-lastRender;lastRender=time;
    const distance=camera.position.length();
    visualScale=Math.max(.008,Math.min(1.5,Math.pow((distance-100)/210,1.1)));
    const clusterKey=[...camera.position.toArray(),...camera.up.toArray(),size.width,size.height].map(v=>v.toFixed(4)).join(',');
    const moved=clusterKey!==lastRenderKey;lastRenderKey=clusterKey;
    if(clusterKey!==lastClusterKey&&time-lastClusterTime>120){updateCompanyClusters();lastClusterKey=clusterKey;lastClusterTime=time;}
    if(siteData&&clusterKey!==lastSiteKey&&time-lastSiteTime>150){updateSiteClusters();lastSiteKey=clusterKey;lastSiteTime=time;}
    if(siteData&&clusterKey!==lastSiteKey)dirty=true;
    // Cluster pass pending after the camera stopped: keep the loop awake until it ran.
    if(clusterKey!==lastClusterKey)dirty=true;
    const rescale=distance!==lastScaleDistance;lastScaleDistance=distance;
    // Pulses along the bands move every frame (shader time); without visible moving bands the loop may sleep.
    const animating=!reduced&&!introHidden&&layers.lines&&(dealEntries.some(e=>e.visible&&!e.deal.staticRelation&&(!selected||e===selected))||!!(siteLinks?.visible&&siteRibbon));
    ribbonUniforms.uTime.value=time/1000;ribbonUniforms.uScale.value=.38*visualScale;
    if(rescale)dirty=true;
    if(moved)lastMove=time;
    if(!moved&&!animating&&!dirty){
      // Nothing to draw: keep looping only while a camera move may still follow (rotation, flight, pending cluster pass).
      if(!intro&&!flight&&!controls.autoRotate&&!controls.points.size&&time-lastMove>400){cancelAnimationFrame(frame);frame=0;}
      return;
    }
    dirty=false;
    // Measure only while frames are requested back to back (flows, rotation, flight), not during slow manual drags.
    if((animating||flight||controls.autoRotate)&&!controls.points.size)adapt(interval);else slowSamples=[];
    if(selected){
      const projected=[['buyer',selected.buyer],['target',selected.target]].map(([role,entity])=>{const position=geoVector(entity.lat,entity.lon,100.8);const p=vec(position).project(camera);return {role,entity,x:(p.x+1)*size.width/2,y:(1-p.y)*size.height/2,visible:frontVisible(position,camera.position.toArray())&&p.z<1&&Math.abs(p.x)<1&&Math.abs(p.y)<1};});
      callbacks.onLabels?.(projected);
    }else callbacks.onLabels?.([]);
    callbacks.onView?.(distance,vectorGeo(camera.position.toArray()));
    for(const listener of viewListeners)listener(distance);
    for(const m of skyMaterials){m.uniforms.uTime.value=time/1000;m.uniforms.uPixel.value=pixelRatio;}
    // Weltraum-Anflug: only the Earth, its atmosphere and the stars; data layers return when the intro ends.
    const hidden=(introHidden?[dealGroup,companyPoints,sitePoints,siteLinks]:[...(layers.points?[]:[companyPoints,sitePoints]),...(layers.lines?[]:[dealGroup,siteLinks])]).filter(o=>o?.visible);
    for(const o of hidden)o.visible=false;
    tiles.update(camera,size.width,size.height);
    renderer.render(scene,camera);
    for(const o of hidden)o.visible=true;
  }
  wake();
  return {introOrbit,introApproach,introEnd,introHit,project,startRotation,distance:()=>camera.position.length(),homeDistance,onCameraView:fn=>{viewListeners.push(fn);invalidate();},setLayers:next=>{Object.assign(layers,next);invalidate();},getLayers:()=>({...layers}),setCompanies,setSites,setSiteLinks,showSites:visible=>{sitesVisible=visible;if(sitePoints)sitePoints.visible=visible&&siteData?.n>0;if(siteLinks)siteLinks.visible=visible;invalidate();},setDeals,germany,filterDeals,selectDeal,focusLocation,home,zoom,toggleRotation,showCompanies:visible=>{companiesVisible=visible;if(companyPoints)companyPoints.visible=visible;invalidate();},isRotating:()=>controls.autoRotate,minDistance:()=>controls.minDistance,addLayer:build=>build({THREE,scene,camera,renderer,invalidate}),dispose:()=>{disposed=true;tiles.dispose();cancelAnimationFrame(frame);frame=0;visibility.disconnect();document.removeEventListener('visibilitychange',onVisibility);for(const type of inputs)inputHost.removeEventListener(type,wake,{capture:true});pointMaterial.dispose();siteMaterial.dispose();pickMaterial.dispose();resizeObserver.disconnect();controls.dispose();scene.traverse(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();});renderer.dispose();}};
}
