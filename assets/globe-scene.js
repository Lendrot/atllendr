import {clusterProjected,markerPixels} from './globe-detail.mjs';
import {statuses,hasPoint} from './market-logic.mjs';
import * as THREE from 'three';
import {GlobeNavigation} from './globe-navigation.js';
import {GLTFLoader} from './three/GLTFLoader.js';
import {geoVector,vectorGeo,arcSample,frontVisible,greatCircleAngle} from './globe-math.mjs';

const vec=coordinates=>new THREE.Vector3(...coordinates);
const up=new THREE.Vector3(0,1,0);
export function createGlobe(host,callbacks={}){
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(42,1,.1,2200);
  camera.position.copy(vec(geoVector(25,-35,310)));
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'default'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.setClearColor(0x050914,0);
  host.appendChild(renderer.domElement);
  renderer.domElement.tabIndex=0;
  renderer.domElement.setAttribute('aria-label','3D-Erde: Ziehen zum Drehen, Mausrad oder zwei Finger zum Zoomen. Pfeiltasten drehen; Plus und Minus zoomen. Alle Einträge sind auch in der Liste erreichbar.');
  const controls=new GlobeNavigation(camera,renderer.domElement,{
    onStart:()=>{flight=null;stopRotation();callbacks.onHover?.(null);},
    onHover:event=>{if(!event){callbacks.onHover?.(null);return;}const hit=pick(event,false);renderer.domElement.style.cursor=hit?'pointer':'grab';callbacks.onHover?.(hit?.deal||null,event.clientX,event.clientY);},
    onTap:event=>{const hit=pick(event,true);if(hit?.deal)callbacks.onDealClick?.(hit.deal.id);else if(hit?.companies)callbacks.onCompanyClick?.(hit.companies);else if(hit?.sites)callbacks.onSiteClick?.(hit.sites);else if(hit?.links)callbacks.onSiteLinkClick?.(hit.links);}
  });
  controls.autoRotate=false;
  scene.add(new THREE.AmbientLight(0xabc5ef,1.45));
  const sun=new THREE.DirectionalLight(0xfff8e9,2.0);
  sun.position.set(300,220,260);
  scene.add(sun);
  const earthMaterial=new THREE.MeshPhongMaterial({color:0xc5dcff,shininess:12,specular:0x1d354b});
  const earth=new THREE.Mesh(new THREE.SphereGeometry(100,96,64),earthMaterial);
  scene.add(earth);
  // Two embedded globes (/) fetch the 12 MB model at once; the browser may abort one download, so retry before falling back.
  const loadEarth=attempt=>new GLTFLoader().load('/assets/earth-nasa.glb',gltf=>{
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
  },undefined,()=>attempt<2?setTimeout(()=>loadEarth(attempt+1),500*(attempt+1)):callbacks.onNotice?.('Das NASA-3D-Modell konnte nicht geladen werden. Als Ersatz wird das bisherige NASA-Satellitenmosaik angezeigt.'));
  loadEarth(0);
  new THREE.TextureLoader().load('/assets/earth-blue-marble.jpg',texture=>{
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
  const stars=[];let seed=731;
  const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<1300;i++){const a=rand()*Math.PI*2,y=rand()*2-1,s=Math.sqrt(1-y*y),r=850+rand()*150;stars.push(r*s*Math.cos(a),r*y,r*s*Math.sin(a));}
  const starGeometry=new THREE.BufferGeometry();starGeometry.setAttribute('position',new THREE.Float32BufferAttribute(stars,3));
  const starMaterial=new THREE.PointsMaterial({color:0xd5e0fa,size:1.15,sizeAttenuation:false,transparent:true,opacity:.53,depthWrite:false});
  scene.add(new THREE.Points(starGeometry,starMaterial));
  fetch('/assets/world.json').then(r=>{if(!r.ok)throw new Error('world');return r.json();}).then(world=>{
    const features=globalThis.topojson.feature(world,world.objects.countries).features;
    const positions=[];
    function addRing(ring){for(let i=1;i<ring.length;i++){positions.push(...geoVector(ring[i-1][1],ring[i-1][0],100.08),...geoVector(ring[i][1],ring[i][0],100.08));}}
    features.forEach(f=>{const polygons=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;polygons.forEach(p=>p.forEach(addRing));});
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    scene.add(new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0x8cb2c1,transparent:true,opacity:.18,depthWrite:false})));invalidate();
  }).catch(()=>{});
  const pointMaterial=new THREE.PointsMaterial({vertexColors:true,size:1,sizeAttenuation:false,transparent:true,opacity:.95,depthWrite:false});
  // Render on demand: a frame is drawn only when the camera moved, a flow marker animates or the scene changed (invalidate()).
  let dirty=true;const invalidate=()=>{dirty=true;};
  let companies=[],pointGroups=[],companyPoints=null,companiesVisible=true,lastClusterKey='',lastClusterTime=0,dealEntries=[],selected=null,flight=null,lastRender=0,lastFrame=0,paused=false,lastRenderKey='',lastScaleDistance=-1,markersDirty=false;
  const dealGroup=new THREE.Group();scene.add(dealGroup);
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  const size={width:1,height:1};
  let firstSize=true;
  function homeDistance(){const halfFov=Math.min(camera.fov*Math.PI/360,Math.atan(Math.tan(camera.fov*Math.PI/360)*camera.aspect));return Math.min(580,Math.max(310,110/Math.sin(halfFov)));}
  function resize(){size.width=host.clientWidth;size.height=host.clientHeight;if(!size.width||!size.height)return;camera.aspect=size.width/size.height;camera.updateProjectionMatrix();renderer.setSize(size.width,size.height,false);invalidate();if(firstSize){camera.position.copy(vec(geoVector(25,-35,homeDistance())));firstSize=false;}}
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);resize();

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
  // Relation markers (arrow heads, flow markers, end points, rings) share one InstancedMesh per geometry and opacity:
  // one draw call per marker kind instead of one per object (before: seven objects per relation, ~1,265 draw calls).
  const markerGeometry={
    cone:new THREE.ConeGeometry(1.05,3.35,10),octa:new THREE.OctahedronGeometry(1.45,0),
    flowSphere:new THREE.SphereGeometry(.43,8,6),flowBox:new THREE.BoxGeometry(.85,.85,.85),
    dotSphere:new THREE.SphereGeometry(.85,12,8),dotBox:new THREE.BoxGeometry(1.25,1.25,1.25),
    ring:new THREE.RingGeometry(1.35,1.65,28),ring4:new THREE.RingGeometry(1.35,1.65,4),wide:new THREE.RingGeometry(3.2,3.55,48)};
  const markerLayers=new Map();let markers=[],markerCapacity=new Map(),selectionApplied=false,visualScale=1;
  const markerMatrix=new THREE.Matrix4(),markerScale=new THREE.Vector3(),markerColor=new THREE.Color();
  function markerLayer(geometry,wireframe,opacity){
    const key=geometry+'|'+wireframe+'|'+opacity;let layer=markerLayers.get(key);
    const capacity=markerCapacity.get(geometry)||1;
    if(layer&&layer.capacity<capacity){dealGroup.remove(layer.mesh);layer.mesh.dispose();layer.mesh.material.dispose();layer=null;}
    if(!layer){
      const ring=geometry==='ring'||geometry==='ring4'||geometry==='wide',transparent=opacity<1||selectionApplied;
      const material=new THREE.MeshBasicMaterial({wireframe,transparent,opacity,side:ring?THREE.DoubleSide:THREE.FrontSide,depthWrite:!ring});
      const mesh=new THREE.InstancedMesh(markerGeometry[geometry],material,Math.max(1,capacity));mesh.frustumCulled=false;
      layer={mesh,capacity:Math.max(1,capacity),items:[]};markerLayers.set(key,layer);dealGroup.add(mesh);
    }
    return layer;
  }
  // Writes every visible marker into its layer; cheap enough to run on each frame that animates flow markers.
  function layoutMarkers(time){
    for(const layer of markerLayers.values())layer.items=[];
    for(const m of markers){
      const e=m.entry;if(!e.visible)continue;
      const active=e.deal.id===selected?.deal.id,dimmed=selected&&!active;
      if(m.role==='flow'&&(e.deal.staticRelation||dimmed))continue;
      if(m.role==='head'&&e.deal.staticRelation)continue;
      const opacity=m.role==='flow'?1:selectionApplied?(dimmed?.22:1):m.opacity;
      markerLayer(m.geometry,m.wireframe,opacity).items.push(m);
    }
    for(const layer of markerLayers.values()){
      layer.items.forEach((m,i)=>{
        if(m.role==='flow')m.position.copy(m.entry.curve.getPoint(reduced ? .6 : (time/8500+m.entry.index*.173)%1));
        markerMatrix.compose(m.position,m.quaternion,markerScale.setScalar(visualScale));
        layer.mesh.setMatrixAt(i,markerMatrix);layer.mesh.setColorAt(i,markerColor.set(m.color));
      });
      layer.mesh.count=layer.items.length;layer.mesh.visible=layer.items.length>0;
      layer.mesh.instanceMatrix.needsUpdate=true;if(layer.mesh.instanceColor)layer.mesh.instanceColor.needsUpdate=true;
      layer.mesh.boundingSphere=null;
    }
  }
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
  const linkMaterial=new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.8,depthWrite:false});
  const LINK_STEPS=32;
  let siteLinks=null,siteLinkRecords=[];
  function setSiteLinks(records){
    if(siteLinks){scene.remove(siteLinks);siteLinks.geometry.dispose();siteLinks=null;}
    siteLinkRecords=records;if(!records.length){invalidate();return;}
    const pos=new Float32Array(records.length*LINK_STEPS*6),color=new Float32Array(records.length*LINK_STEPS*6),c=new THREE.Color();
    records.forEach((r,k)=>{
      c.set(r.color??0x85caff);
      for(let i=0;i<LINK_STEPS;i++){
        const o=(k*LINK_STEPS+i)*6;pos.set(arcSample(r.from,r.to,i/LINK_STEPS,0,.55),o);pos.set(arcSample(r.from,r.to,(i+1)/LINK_STEPS,0,.55),o+3);
        c.toArray(color,o);c.toArray(color,o+3);
      }
    });
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(pos,3));geometry.setAttribute('color',new THREE.BufferAttribute(color,3));
    siteLinks=new THREE.LineSegments(geometry,linkMaterial);siteLinks.visible=sitesVisible;scene.add(siteLinks);invalidate();
  }
  function filterDeals(ids){const allowed=new Set(ids);dealEntries.forEach(e=>{e.visible=allowed.has(e.deal.id);e.line.visible=e.visible;});markersDirty=true;invalidate();}
  function setDeals(records,entities){
    for(const entry of dealEntries){entry.line.geometry.dispose();entry.line.material.dispose();}
    for(const layer of markerLayers.values()){layer.mesh.dispose();layer.mesh.material.dispose();}
    markerLayers.clear();dealGroup.clear();dealEntries=[];markers=[];selected=null;
    const corridors=new Map();
    const facing=position=>new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),position.clone().normalize());
    records.flatMap(deal=>(deal.buyerIds||[deal.buyerId]).map(buyerId=>({...deal,buyerId}))).forEach((deal,index)=>{
      const buyer=entities[deal.buyerId],target=entities[deal.targetId];
      if(!hasPoint(buyer)||!hasPoint(target))return;
      const monetary=deal.area==='money';
      const key=[deal.buyerId,deal.targetId].join('|'),parallel=corridors.get(key)||0;corridors.set(key,parallel+1);
      const lift=(parallel%10)*1.35;
      const statusColor=deal.flowColor??statuses[deal.status]?.color??0xd6f391;
      const points=Array.from({length:101},(_,i)=>vec(arcSample(buyer,target,i/100,lift,.55)));
      const curve=new THREE.CatmullRomCurve3(points);
      const lineMaterial=deal.flowKind
        ? new THREE.LineDashedMaterial({color:statusColor,transparent:true,opacity:.9,depthWrite:false,dashSize:monetary?1.8:.5,gapSize:monetary?.9:.42})
        : deal.status==='completed'
          ? new THREE.LineBasicMaterial({color:statusColor,transparent:true,opacity:.7,depthWrite:false})
          : new THREE.LineDashedMaterial({color:statusColor,transparent:true,opacity:.85,depthWrite:false,dashSize:['interest','intent','rumored','sale_process'].includes(deal.status)?.6:1.8,gapSize:1.0});
      const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),lineMaterial);
      line.computeLineDistances();line.userData.dealId=deal.id;
      dealGroup.add(line);
      const entry={deal,buyer,target,curve,line,index,lift,visible:true};
      const add=(role,geometry,position,quaternion,opacity=1,pickable=true,wireframe=false)=>markers.push({entry,role,geometry,position,quaternion,opacity,pickable,wireframe,color:statusColor});
      add('head',deal.flowKind?'octa':'cone',curve.getPoint(.84),new THREE.Quaternion().setFromUnitVectors(up,curve.getTangent(.84).normalize()),1,true,monetary);
      add('flow',deal.flowKind?'flowBox':'flowSphere',new THREE.Vector3(),new THREE.Quaternion(),1,false);
      for(const entity of [buyer,target]){
        const ringPosition=vec(geoVector(entity.lat,entity.lon,100.7));
        // A national total has no site: a wide faint ring instead of a point marker.
        if(entity.schematic){add('dot','wide',ringPosition,facing(ringPosition),.35);continue;}
        add('dot',deal.flowKind?'dotBox':'dotSphere',vec(geoVector(entity.lat,entity.lon,100.65)),new THREE.Quaternion());
        add('dot',deal.flowKind?'ring4':'ring',ringPosition,facing(ringPosition),.65,false);
      }
      dealEntries.push(entry);
    });
    markerCapacity=new Map();for(const m of markers)markerCapacity.set(m.geometry,(markerCapacity.get(m.geometry)||0)+1);
    markersDirty=true;lastScaleDistance=-1;invalidate();
  }
  function focusLocation(lat,lon,distance=250){
    stopRotation();const from=camera.position.clone();const to=vec(geoVector(lat,lon,Math.min(controls.maxDistance,Math.max(controls.minDistance,distance))));
    flight={from,to,started:performance.now(),duration:reduced?0:1050};
  }
  function selectDeal(id,focus=true){
    selected=dealEntries.find(e=>e.deal.id===id)||null;
    dealEntries.forEach(e=>{const active=e.deal.id===selected?.deal.id;e.line.material.opacity=selected?(active?1:.15):.7;});
    // First selection call switches markers from their resting opacity to the selection scheme (1 or .22), as before.
    if(!selectionApplied){selectionApplied=true;for(const layer of markerLayers.values()){dealGroup.remove(layer.mesh);layer.mesh.dispose();layer.mesh.material.dispose();}markerLayers.clear();}
    markersDirty=true;invalidate();
    if(selected&&focus){const center=vectorGeo(arcSample(selected.buyer,selected.target,.5));const angle=greatCircleAngle(selected.buyer,selected.target);focusLocation(center.lat,center.lon,Math.max(145,Math.min(325,155+angle*120))*Math.max(1,.9/camera.aspect));}
  }
  function germany(){camera.up.set(0,1,0);controls.update();selectDeal(null,false);focusLocation(51,10,130);}
  function home(){camera.up.set(0,1,0);controls.update();selectDeal(null,false);focusLocation(25,-35,homeDistance());}
  function zoom(factor){stopRotation();flight=null;controls.zoom(factor);}
  function toggleRotation(){flight=null;controls.autoRotate=!controls.autoRotate;callbacks.onRotation?.(controls.autoRotate);return controls.autoRotate;}
  const canvas=renderer.domElement;
  function pick(event,includeCompanies){
    const rect=canvas.getBoundingClientRect();pointer.x=(event.clientX-rect.left)/rect.width*2-1;pointer.y=-(event.clientY-rect.top)/rect.height*2+1;
    raycaster.setFromCamera(pointer,camera);
    const groundPoint=raycaster.ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(),100),new THREE.Vector3());
    const ground=groundPoint?{distance:camera.position.distanceTo(groundPoint)}:null;
    const threshold=(camera.position.length()-100)*Math.tan(camera.fov*Math.PI/360)*2/size.height*(event.pointerType==='touch'?13:8);
    raycaster.params.Line.threshold=Math.max(.025,threshold);
    const layers=[...markerLayers.values()].filter(l=>l.mesh.visible&&l.items.some(m=>m.pickable));
    const candidates=[...dealEntries.filter(e=>e.visible).map(e=>e.line),...layers.map(l=>l.mesh)];
    const dealOf=hit=>{if(hit.object.isInstancedMesh){const m=layers.find(l=>l.mesh===hit.object)?.items[hit.instanceId];return m?.pickable?m.entry.deal:null;}return hit.object.userData.dealId?dealEntries.find(e=>e.line===hit.object)?.deal:null;};
    const found=raycaster.intersectObjects(candidates,false).find(h=>dealOf(h)&&(!ground||h.distance<ground.distance+1));
    if(found)return {deal:dealOf(found)};
    if(!includeCompanies)return null;
    raycaster.params.Points.threshold=Math.max(.02,threshold);
    const nearest=object=>raycaster.intersectObject(object).filter(h=>!ground||h.distance<ground.distance+1).sort((a,b)=>(a.distanceToRay??0)-(b.distanceToRay??0))[0];
    const company=companyPoints?.visible?nearest(companyPoints):null;
    if(company)return {companies:pointGroups[company.index]};
    const site=sitePoints?.visible&&siteGroups.length?nearest(sitePoints):null;
    if(site)return {sites:siteGroups[site.index].map(i=>siteData.records[i])};
    const link=siteLinks?.visible?raycaster.intersectObject(siteLinks).find(h=>!ground||h.distance<ground.distance+1):null;
    if(link)return {links:[siteLinkRecords[Math.floor(link.index/2/LINK_STEPS)]]};
    return null;
  }
  canvas.addEventListener('keydown',event=>{
    const step=Math.max(.12,Math.min(8,(camera.position.length()-100)*.035));
    const direction={ArrowLeft:[0,-step],ArrowRight:[0,step],ArrowUp:[step,0],ArrowDown:[-step,0]}[event.key];
    if(direction){event.preventDefault();const p=vectorGeo(camera.position.toArray());focusLocation(Math.max(-85,Math.min(85,p.lat+direction[0])),p.lon+direction[1],camera.position.length());}
    if(['+','='].includes(event.key)){event.preventDefault();zoom(.85);}
    if(event.key==='-'){event.preventDefault();zoom(1.18);}
  });
  canvas.addEventListener('webglcontextrestored',()=>{paused=false;invalidate();});
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();paused=true;callbacks.onError?.('Die 3D-Darstellung wurde vom Gerät unterbrochen. Lade die Seite neu oder nutze die 2D-Karte.');});
  let frame;
  function animate(time){
    frame=requestAnimationFrame(animate);
    if(document.hidden||paused)return;
    const dt=Math.min(.05,(time-lastFrame)/1000||.016);lastFrame=time;
    if(flight){const t=flight.duration?Math.min(1,(time-flight.started)/flight.duration):1;const ease=1-Math.pow(1-t,3);const fromDirection=flight.from.clone().normalize(),toDirection=flight.to.clone().normalize();const quaternion=new THREE.Quaternion().setFromUnitVectors(fromDirection,toDirection);const rotation=new THREE.Quaternion().slerp(quaternion,ease);camera.position.copy(fromDirection.applyQuaternion(rotation)).multiplyScalar(THREE.MathUtils.lerp(flight.from.length(),flight.to.length(),ease));if(t===1)flight=null;}
    controls.update(dt);
    if(time-lastRender<1000/30)return;
    lastRender=time;
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
    const animating=!reduced&&dealEntries.some(e=>e.visible&&!e.deal.staticRelation&&(!selected||e===selected));
    if(rescale||animating||markersDirty){layoutMarkers(time);markersDirty=false;}
    if(!moved&&!animating&&!dirty&&!selected)return;
    dirty=false;
    if(selected){
      const projected=[['buyer',selected.buyer],['target',selected.target]].map(([role,entity])=>{const position=geoVector(entity.lat,entity.lon,100.8);const p=vec(position).project(camera);return {role,entity,x:(p.x+1)*size.width/2,y:(1-p.y)*size.height/2,visible:frontVisible(position,camera.position.toArray())&&p.z<1&&Math.abs(p.x)<1&&Math.abs(p.y)<1};});
      callbacks.onLabels?.(projected);
    }else callbacks.onLabels?.([]);
    callbacks.onView?.(distance,vectorGeo(camera.position.toArray()));
    renderer.render(scene,camera);
  }
  frame=requestAnimationFrame(animate);
  return {setCompanies,setSites,setSiteLinks,showSites:visible=>{sitesVisible=visible;if(sitePoints)sitePoints.visible=visible&&siteData?.n>0;if(siteLinks)siteLinks.visible=visible;invalidate();},setDeals,germany,filterDeals,selectDeal,focusLocation,home,zoom,toggleRotation,showCompanies:visible=>{companiesVisible=visible;if(companyPoints)companyPoints.visible=visible;invalidate();},isRotating:()=>controls.autoRotate,dispose:()=>{cancelAnimationFrame(frame);pointMaterial.dispose();siteMaterial.dispose();linkMaterial.dispose();resizeObserver.disconnect();controls.dispose();scene.traverse(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();});renderer.dispose();}};
}
