/** Weltraum-Anflug und Kontinent-Knoten auf dem Hauptglobus (Eddie 2026-11-08).
 *  1. Beim Öffnen kreist die Erde auf einer Umlaufbahn durchs All (Vollbild, ohne Datenebenen).
 *  2. Klick auf die Erde (oder "Anfliegen") fliegt heran; die Erde dreht sich bildschirmfüllend, Kontinente sind Knoten.
 *  3. Klick auf einen Knoten fliegt auf den Kontinent und zeigt den Atlas mit allen Standorten.
 *  Die Knoten bleiben im Atlas: wer weit herauszoomt, sieht wieder die ganze Erde mit den Knoten.
 *  Nur Anzeige: Daten, Status und Quellen ändern sich nicht. Ohne Animation (reduzierte Bewegung, Links mit Parametern,
 *  eingebettete Ansichten, automatisierte Tests) startet der Atlas direkt wie bisher; ?intro=1 erzwingt den Anflug. */
const KEY='marktatlas-anflug';
// Mittelpunkte zum Hinfliegen (Breite, Länge, Kameraabstand; Erdradius = 100).
export const CONTINENTS=[
  {id:'europa',label:'Europa',lat:51,lon:12,distance:175},
  {id:'asien',label:'Asien',lat:33,lon:98,distance:215},
  {id:'afrika',label:'Afrika',lat:2,lon:20,distance:210},
  {id:'nordamerika',label:'Nordamerika',lat:43,lon:-100,distance:210},
  {id:'suedamerika',label:'Südamerika',lat:-17,lon:-60,distance:200},
  {id:'ozeanien',label:'Ozeanien',lat:-25,lon:135,distance:190}
];
// Im Atlas erscheinen die Knoten erst, wenn man über die Startansicht hinaus herauszoomt (die Startansicht bleibt wie bisher);
// in der Einleitung immer. Unter HUB_DISTANCE (auf einem Kontinent) nie.
export const HUB_DISTANCE=265;
export const hubThreshold=engine=>Math.min(560,Math.max(HUB_DISTANCE,engine.homeDistance()*1.04));

export function introWanted(){
  const params=new URLSearchParams(location.search);
  if(params.get('intro')==='1')return true;
  if(params.get('intro')==='0'||[...params.keys()].length||location.hash)return false;
  if(navigator.webdriver||window.top!==window||matchMedia('(prefers-reduced-motion: reduce)').matches)return false;
  try{if(sessionStorage.getItem(KEY))return false;}catch{}
  return true;
}

export function installContinentHubs(engine,space,{onPick}={}){
  const layer=document.createElement('div');layer.className='continent-hubs';layer.setAttribute('role','group');layer.setAttribute('aria-label','Kontinente');
  const hubs=CONTINENTS.map(c=>{
    const button=document.createElement('button');button.type='button';button.className='continent-hub';button.dataset.continent=c.id;
    button.innerHTML=`<i aria-hidden="true"></i><span>${c.label}</span>`;button.setAttribute('aria-label',`${c.label} anfliegen`);
    button.onclick=()=>{onPick?.(c);engine.focusLocation(c.lat,c.lon,c.distance);};
    layer.append(button);return {c,button};
  });
  space.append(layer);
  let enabled=true,always=false;
  const place=distance=>{
    const show=enabled&&distance>=(always?HUB_DISTANCE:hubThreshold(engine));layer.hidden=!show;if(!show)return;
    for(const {c,button} of hubs){const p=engine.project(c.lat,c.lon);button.hidden=!p.visible;if(p.visible)button.style.transform=`translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px)`;}
  };
  engine.onCameraView(place);
  return {layer,enable(on,intro=false){enabled=on;always=intro;place(engine.distance());}};
}

/** Call before the globe exists: the space goes full screen at once, so the atlas never flashes up first. */
export function prepareIntro(){document.body.classList.add('globe-intro');}

export function startIntro(engine,space,hubs){
  try{sessionStorage.setItem(KEY,'1');}catch{}
  const canvas=space.querySelector('#globe canvas');
  const ui=document.createElement('div');ui.className='globe-intro-ui';
  ui.innerHTML='<p class="intro-brand">marktatlas<span>.</span></p><button type="button" class="intro-skip">Direkt zum Atlas</button><div class="intro-call"><button type="button" class="intro-go">Anfliegen</button><small>oder auf die Erde klicken</small></div>';
  space.append(ui);
  let phase='orbit';
  hubs.enable(false);
  const call=ui.querySelector('.intro-call'),go=ui.querySelector('.intro-go');
  const approach=()=>{
    if(phase!=='orbit')return;phase='approach';canvas.style.cursor='';call.hidden=true;
    engine.introApproach(()=>{
      phase='globe';hubs.enable(true,true);engine.startRotation();
      call.innerHTML='<small>Kontinent wählen · ziehen zum Drehen</small>';call.hidden=false;
      engine.onCameraView(d=>{if(phase==='globe'&&d<HUB_DISTANCE-35)finish();});
    });
  };
  const finish=()=>{
    if(phase==='done')return;const wasOrbit=phase!=='globe';phase='done';
    engine.introEnd();if(wasOrbit&&engine.isRotating())engine.toggleRotation();
    hubs.enable(true);ui.remove();document.body.classList.remove('globe-intro');
    document.removeEventListener('keydown',onKey);canvas.removeEventListener('click',onClick);canvas.removeEventListener('pointermove',onMove);
  };
  const onClick=e=>{if(phase==='orbit'&&engine.introHit(e.clientX,e.clientY))approach();};
  const onMove=e=>{if(phase==='orbit')canvas.style.cursor=engine.introHit(e.clientX,e.clientY)?'pointer':'default';};
  const onKey=e=>{if(e.key==='Escape')finish();};
  canvas.addEventListener('click',onClick);canvas.addEventListener('pointermove',onMove);document.addEventListener('keydown',onKey);
  go.onclick=approach;ui.querySelector('.intro-skip').onclick=finish;
  // A hub click in the globe phase flies to the continent and shows the atlas.
  hubs.layer.addEventListener('click',()=>{if(phase==='globe')finish();},true);
  engine.introOrbit();go.focus({preventScroll:true});
  return {finish,phase:()=>phase};
}
