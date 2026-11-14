/** Länder auf dem Globus (Eddie 2026-11-14): Land unter der Maus hebt sich hervor; Klick öffnet die Länderansicht, die die
 *  Weltkarte ersetzt: Karte des Landes (NASA-Bild), Inlandsverbindungen, größte Aus- und Einfuhren je Ware mit bis zu fünf
 *  Unternehmen, Ort im Land, Transportweg und Ziel-/Herkunftsländern. Doku: analysis/LAENDERANSICHT.md.
 *  Datenregel Hauptatlas: nur, was im Atlas mit Quelle steht. Fehlt etwas, steht "unbekannt"; nichts wird geschätzt. */
import {escapeHtml as esc} from './map-logic.mjs';
import {countriesFrom,nameIndex,makeLocator,countryAt,countryReport,wrap} from './country-logic.mjs';
import {material,status,nameKurz} from './verbindung-klartext.mjs';
import {tonnenText} from './menge-wert.mjs';
import {TILE_SOURCE,FINE_SOURCE,FINE_LEVEL,tileSpan} from './globe-tiles.mjs';

const num=n=>new Intl.NumberFormat('de-DE').format(n);
const rad=Math.PI/180;
const rowKey=r=>(r?.group||r?.dataset?.id||'')+'|'+(r?.id||'');
// Ware: Angabe der Quelle (link_info m); sonst der Rohstoff des Fachatlas (Kupferkette, Lithium ...); Rohstoffwelt, Standorte,
// Abfall und Anlagen nennen keine Ware -> unbekannt.
const OHNE_ROHSTOFF=new Set(['rohstoffwelt','standorte','abfall','anlagen']);
const wareVon=(l,x)=>x.m?material(x.m,l.dataset?.short):OHNE_ROHSTOFF.has(l.dataset?.id)?null:(l.dataset?.short?`${l.dataset.short} (genaue Ware nicht genannt)`:null);

export async function attachCountries({engine,host,sites}){
  const world=await fetch('/assets/world.json').then(r=>{if(!r.ok)throw Error('world.json '+r.status);return r.json();});
  const list=countriesFrom(world,window.topojson),byKey=new Map(list.map(c=>[c.key,c]));
  const locate=makeLocator(list,nameIndex(list));setNames(list);
  injectCss();

  // --- Hervorhebung auf dem Globus: gefüllte Fläche (Leinwand über dem Umrissrechteck) und heller Umriss. ---
  const glow=engine.addLayer(({THREE,scene,invalidate})=>{
    const group=new THREE.Group();group.name='land-hervorhebung';group.renderOrder=6;scene.add(group);
    let shown=null;
    function clear(){for(const o of [...group.children]){group.remove(o);o.geometry.dispose();o.material.map?.dispose();o.material.dispose();}}
    function show(c){
      if(c===shown)return;shown=c;clear();
      if(c){
        const pos=[];const put=(lon,lat,r)=>{const k=Math.cos(lat*rad);pos.push(r*k*Math.cos(lon*rad),r*Math.sin(lat*rad),-r*k*Math.sin(lon*rad));};
        for(const ring of c.rings)for(let i=1;i<ring.length;i++){put(ring[i-1][0],ring[i-1][1],100.12);put(ring[i][0],ring[i][1],100.12);}
        const lg=new THREE.BufferGeometry();lg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
        const line=new THREE.LineSegments(lg,new THREE.LineBasicMaterial({color:0xffd166,transparent:true,opacity:.95,depthWrite:false}));line.renderOrder=21;group.add(line);
        const [w,s,e,n]=c.bbox,W=Math.min(2048,Math.max(64,Math.round((e-w)*14))),H=Math.min(1024,Math.max(32,Math.round((n-s)*14)));
        const cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d');
        g.fillStyle='rgba(255,201,77,.5)';g.beginPath();
        for(const ring of c.rings)ring.forEach(([lon,lat],i)=>{const x=(lon-w)/(e-w||1)*W,y=(n-lat)/(n-s||1)*H;i?g.lineTo(x,y):g.moveTo(x,y);});
        g.fill('evenodd');
        const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;
        group.add(patch(THREE,c.bbox,100.1,new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-8,polygonOffsetUnits:-64})));
      }
      invalidate();
    }
    return {show};
  });

  // --- Hinweis am Zeiger und fester Knopf unten: über dem Linien-Gewirr Europas trifft ein Klick oft eine Verbindung,
  // deshalb öffnet auch der Knopf "<Land> öffnen" die Länderansicht (Maus, Finger, Tastatur). ---
  const tip=document.createElement('div');tip.className='country-tip';tip.hidden=true;host.append(tip);
  const chip=document.createElement('button');chip.type='button';chip.className='country-chip';chip.hidden=true;host.append(chip);
  let hovered=null,armed=null,chipKey=null,chipTimer=0;
  chip.onclick=()=>{if(chipKey)open(chipKey);};
  function chipFor(c){
    clearTimeout(chipTimer);
    if(c){chipKey=c.key;chip.innerHTML=`<b>${esc(c.name)}</b> Länderansicht öffnen →`;chip.hidden=false;}
    else chipTimer=setTimeout(()=>{chip.hidden=true;chipKey=null;},2500);
  }
  function tipAt(c,event){
    if(!c){tip.hidden=true;return;}
    const r=host.getBoundingClientRect();
    tip.innerHTML=`<strong>${esc(c.name)}</strong><span>Klicken: Länderansicht</span>`;
    tip.style.left=Math.min(r.width-180,Math.max(8,event.clientX-r.left+14))+'px';tip.style.top=Math.max(8,event.clientY-r.top+14)+'px';tip.hidden=false;
  }
  const find=at=>at?countryAt(list,at.lon,at.lat,hovered):null;

  // --- Länderansicht ---
  const view=document.createElement('section');view.className='country-view';view.hidden=true;view.setAttribute('aria-labelledby','country-view-title');
  view.innerHTML=`<header class="cv-head"><button type="button" class="cv-back">← Weltkarte</button><div><h2 id="country-view-title"></h2><p class="cv-sub"></p></div></header>
<div class="cv-body"><div class="cv-map"><canvas aria-label="Karte des Landes: Ziehen verschiebt, Mausrad oder zwei Finger zoomen"></canvas>
<div class="cv-zoom"><button type="button" data-z="in" aria-label="Näher">+</button><button type="button" data-z="out" aria-label="Weiter weg">−</button><button type="button" data-z="fit" aria-label="Ganzes Land">⤢</button></div>
<div class="cv-legend"><span><i style="background:#ff9f43"></i>ins Ausland</span><span><i style="background:#4dd2ff"></i>aus dem Ausland</span><span><i style="background:linear-gradient(90deg,#9fd3ff,#c8f08f)"></i>im Land (Farbe des Datensatzes)</span><span><i style="background:repeating-linear-gradient(90deg,#ffb35c 0 5px,transparent 5px 9px)"></i>Handelspartner (Statistik)</span><span>Linien schematisch</span></div><div class="cv-credit"></div><div class="cv-hover" hidden></div></div><aside class="cv-side"></aside></div>`;
  host.append(view);
  const canvas=view.querySelector('canvas'),ctx=canvas.getContext('2d'),side=view.querySelector('.cv-side'),hoverBox=view.querySelector('.cv-hover');
  view.querySelector('.cv-back').onclick=()=>close(true);
  view.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close(true);}});
  let current=null,report=null,cam=null,raf=0,markers=[],lines=[],pushed=false;
  const allRows=()=>sites.siteRows();
  // Amtliche Handelsstatistik je Land (CEPII BACI, scripts/analysis/laenderhandel/baci_top3.py), erst beim ersten Öffnen geladen.
  let handel=null,handelFehler=false,handelSel=null;
  // Unternehmen je Top-Ware (USGS Minerals Yearbook 2024, scripts/analysis/laenderhandel/usgs_firmen.py); fehlt die Datei, steht "unbekannt".
  let firmen=null,firmenFehler=false;
  const holen=(url,ok,fehler)=>fetch(url).then(r=>{if(!r.ok)throw Error(url+' '+r.status);return r.json();}).then(ok).catch(fehler);
  const handelLaden=()=>handel?Promise.resolve(handel):Promise.all([
    holen('/assets/laender-handel.json',d=>(handel=d),()=>{handelFehler=true;}),
    holen('/assets/laender-firmen.json',d=>(firmen=d),()=>{firmenFehler=true;})]).then(()=>handel);
  function seite(){
    if(!current)return;
    side.innerHTML=statHtml(current,handel,handelFehler,handelSel,{daten:firmen,fehler:firmenFehler})+sideHtml(current,report);
    side.querySelectorAll('[data-werk]').forEach(b=>b.onclick=()=>{const [lat,lon]=b.dataset.werk.split(',').map(Number);cam={cx:lon,cy:lat,k:Math.max(cam.k,600)};schedule();});
    side.querySelectorAll('[data-fokus]').forEach(b=>b.onclick=()=>{const r=report.sites.find(s=>rowKey(s)===b.dataset.fokus)||null;if(r)focus(r);});
    side.querySelectorAll('[data-handel]').forEach(b=>b.onclick=()=>{const v=b.dataset.handel;handelSel=handelSel===v?null:v;seite();schedule();
      if(handelSel)partnerZeigen();});
  }
  // Ausschnitt so weit öffnen, dass Land und gezeigte Partnerländer im Bild sind.
  function partnerZeigen(){
    const ziele=handelLinien().map(l=>l.ziel.center);if(!ziele.length)return;
    let [w,s,e,n]=current.fit;const mid=(w+e)/2;
    for(const [lon,lat] of ziele){const x=mid+wrap(lon-mid);w=Math.min(w,x);e=Math.max(e,x);s=Math.min(s,lat);n=Math.max(n,lat);}
    const W=canvas.clientWidth||600,H=canvas.clientHeight||400,cy=(s+n)/2,kx=Math.cos(Math.min(80,Math.abs(cy))*rad);
    cam={cx:(w+e)/2,cy,k:Math.max(2,Math.min(W*.8/Math.max(.05,(e-w)*kx),H*.8/Math.max(.05,n-s)))};schedule();
  }
  // Linien Land -> Partnerland: ohne Auswahl die 5 größten Partner je Richtung, mit Auswahl die Partner dieser Ware.
  function handelLinien(){
    const d=handel?.laender?.[current?.key];if(!d)return [];
    const out=[];
    const add=(richtung,partner)=>{for(const [k,tsd,anteil] of partner){const ziel=byKey.get(k);if(ziel&&ziel!==current)out.push({richtung,ziel,tsd,anteil});}};
    if(handelSel){const [r,i]=handelSel.split(':');const w=d[r]?.waren?.[+i];if(w)add(r,w.partner);}
    else for(const r of ['aus','ein'])if(d[r])add(r,d[r].partner);
    return out;
  }

  // Werke und Häfen der Top-Waren mit Koordinate; mit Auswahl nur die der gewählten Ware.
  function werkPunkte(){
    const d=handel?.laender?.[current?.key],f=firmen?.laender?.[current?.key];if(!d||!f)return [];
    const out=[],gesehen=new Set();
    for(const r of ['aus','ein'])(d[r]?.waren||[]).forEach((w,i)=>{
      if(handelSel&&handelSel!==`${r}:${i}`)return;const e=f[w.hs4];if(!e)return;
      for(const fi of e.firmen)for(const x of fi.werke){if(x.lat==null||gesehen.has(x.id))continue;gesehen.add(x.id);out.push({art:'werk',r,x,firma:fi,e,hs:w.hs4});}
      for(const h of e.haefen){const k='h'+h.name+h.lat;if(gesehen.has(k))continue;gesehen.add(k);out.push({art:'hafen',r,x:h,e,hs:w.hs4});}
    });
    return out;
  }

  function open(key,{push=true}={}){
    const c=byKey.get(key);if(!c)return;
    tip.hidden=true;armed=null;glow.show(null);hovered=null;chip.hidden=true;delete host.dataset.landHover;
    current=c;report=countryReport(c.key,{rows:allRows(),links:sites.allLinks,info:id=>sites.info(id)||{},locate,ware:wareVon});
    view.querySelector('#country-view-title').textContent=c.name;
    view.querySelector('.cv-sub').textContent=`${num(report.sites.length)} Standorte · ${num(report.inland.length)} Inlandsverbindungen · ${num(report.aus.length)} Lieferungen ins Ausland · ${num(report.ein.length)} aus dem Ausland (im Atlas)`;
    handelSel=null;seite();if(!handel&&!handelFehler)handelLaden().then(()=>{if(current===c){seite();schedule();}});
    view.hidden=false;host.classList.add('country-open');
    fit();resizeCanvas();
    view.querySelector('.cv-back').focus({preventScroll:true});
    if(push){const u=new URL(location.href);u.searchParams.set('land',c.key);if(u.href!==location.href){history.pushState({land:c.key},'',u);pushed=true;}}
    host.dataset.land=c.key;
  }
  function close(fromUi){
    if(view.hidden)return;
    view.hidden=true;host.classList.remove('country-open');current=null;report=null;delete host.dataset.land;
    if(fromUi){if(pushed&&history.state?.land){pushed=false;history.back();return;}const u=new URL(location.href);u.searchParams.delete('land');history.replaceState(history.state,'',u);}
  }
  addEventListener('popstate',()=>{const k=new URLSearchParams(location.search).get('land');if(k&&byKey.has(k))open(k,{push:false});else close(false);});

  // Kamera der Karte: Mitte (Länge darf über ±180 hinaus, Breite) und k = Pixel je Grad Breite (CSS-Pixel).
  function fit(){
    const [w,s,e,n]=current.fit,W=canvas.clientWidth||600,H=canvas.clientHeight||400,cy=(s+n)/2,kx=Math.cos(Math.min(80,Math.abs(cy))*rad);
    const k=Math.min(W*.86/Math.max(.05,(e-w)*kx),H*.86/Math.max(.05,n-s));
    cam={cx:(w+e)/2,cy,k:Math.max(2,Math.min(60000,k))};schedule();
  }
  const kxOf=()=>cam.k*Math.cos(Math.min(80,Math.abs(cam.cy))*rad);
  const project=(lon,lat)=>[canvas.clientWidth/2+wrap(lon-cam.cx)*kxOf(),canvas.clientHeight/2-(lat-cam.cy)*cam.k];
  const unproject=(x,y)=>[cam.cx+(x-canvas.clientWidth/2)/kxOf(),cam.cy-(y-canvas.clientHeight/2)/cam.k];
  function focus(r){cam={cx:r.lon,cy:r.lat,k:Math.max(cam.k,400)};schedule();}
  function resizeCanvas(){const d=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(canvas.clientWidth*d);canvas.height=Math.round(canvas.clientHeight*d);schedule();}
  new ResizeObserver(()=>{if(!view.hidden)resizeCanvas();}).observe(canvas);
  function schedule(){if(!raf)raf=requestAnimationFrame(draw);}

  // NASA-Kacheln (gleiches GIBS-Raster wie der Globus): Blue Marble bis Stufe 7, darüber Landsat (schwarz = keine Daten -> durchsichtig).
  const tiles=new Map();let tileFails=0,active=0;const queue=[];
  function tile(level,x,y){
    const k=`${level}/${x}/${y}`;let t=tiles.get(k);if(t)return t.ready?t.img:null;
    if(tileFails>=6||new URLSearchParams(location.search).get('kacheln')==='aus')return null;
    t={ready:false};tiles.set(k,t);queue.push(()=>{
      active++;const img=new Image();img.crossOrigin='anonymous';
      img.onload=()=>{active--;tileFails=0;
        if(level>=FINE_LEVEL){const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const g=c.getContext('2d');g.drawImage(img,0,0);
          try{const d=g.getImageData(0,0,c.width,c.height),p=d.data;for(let i=0;i<p.length;i+=4)if(p[i]<10&&p[i+1]<10&&p[i+2]<10)p[i+3]=0;g.putImageData(d,0,0);t.img=c;}catch{t.img=img;}}
        else t.img=img;
        t.ready=true;pump();schedule();};
      img.onerror=()=>{active--;tileFails++;pump();};
      img.src=(level>=FINE_LEVEL?FINE_SOURCE:TILE_SOURCE).url(level,x,y);
    });
    pump();return null;
  }
  function pump(){while(active<6&&queue.length)queue.shift()();}
  function drawTiles(level,W,H){
    const span=tileSpan(level),cols=Math.round(360/span),rows=Math.ceil(180/span);
    const [l0,t0]=unproject(0,0),[l1,b1]=unproject(W,H);
    const x0=Math.floor((l0+180)/span),x1=Math.floor((l1+180)/span),y0=Math.max(0,Math.floor((90-t0)/span)),y1=Math.min(rows-1,Math.floor((90-b1)/span));
    if((x1-x0+1)*(y1-y0+1)>140)return false;
    let all=true;
    for(let y=y0;y<=y1;y++)for(let xi=x0;xi<=x1;xi++){
      const x=((xi%cols)+cols)%cols,img=tile(level,x,y);
      if(!img){all=false;continue;}
      // Kachelrand aus der ungewickelten Länge (xi darf über das Raster hinausgehen, Spalte x ist umgebrochen).
      const west=-180+xi*span,north=90-y*span,sx=W/2+(west-cam.cx)*kxOf(),sy=H/2-(north-cam.cy)*cam.k;
      ctx.drawImage(img,sx,sy,span*kxOf()+.5,span*cam.k+.5);
    }
    return all;
  }

  function draw(){
    raf=0;if(view.hidden||!current)return;
    const d=canvas.width/Math.max(1,canvas.clientWidth),W=canvas.clientWidth,H=canvas.clientHeight;
    ctx.setTransform(d,0,0,d,0,0);ctx.fillStyle='#0a1626';ctx.fillRect(0,0,W,H);
    // Bildstufe: ein Bildpunkt je Bildschirmpunkt (wie globe-tiles.mjs levelFor).
    const want=Math.max(2,Math.min(11,Math.ceil(Math.log2(.5625*cam.k*d))));
    const base=Math.min(want,FINE_LEVEL-1);
    let ok=drawTiles(Math.max(2,base-2),W,H);ok=drawTiles(base,W,H)&&ok;
    if(want>=FINE_LEVEL)drawTiles(want,W,H);
    view.querySelector('.cv-credit').textContent=tileFails>=6?'Satellitenbild nicht erreichbar':`Bild: ${(want>=FINE_LEVEL?FINE_SOURCE:TILE_SOURCE).name}`;
    // Umgebung abdunkeln, Grenzen der Nachbarn dünn, das Land hell umrandet.
    ctx.save();ctx.fillStyle='rgba(6,12,24,.55)';ctx.beginPath();ctx.rect(0,0,W,H);for(const ring of current.rings){ring.forEach(([lon,lat],i)=>{const [x,y]=project(lon,lat);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();}
    ctx.fill('evenodd');ctx.restore();
    const [vl,vt]=unproject(0,0),[vr,vb]=unproject(W,H);
    ctx.lineWidth=.8;ctx.strokeStyle='rgba(225,236,248,.45)';
    for(const c of list){if(c===current)continue;const b=c.bbox;if(b[1]>vt||b[3]<vb)continue;if(Math.abs(wrap((b[0]+b[2])/2-cam.cx))>(b[2]-b[0])/2+(vr-vl)/2+1)continue;
      ctx.beginPath();for(const ring of c.rings)ring.forEach(([lon,lat],i)=>{const [x,y]=project(lon,lat);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();}
    ctx.lineWidth=2.2;ctx.strokeStyle='#ffd166';ctx.beginPath();for(const ring of current.rings)ring.forEach(([lon,lat],i)=>{const [x,y]=project(lon,lat);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();
    // Verbindungen: Inland (Farbe des Fachatlas), ins Ausland (orange), aus dem Ausland (blau). Linien schematisch, kein belegter Weg.
    lines=[];markers=[];
    // Handelspartner laut Statistik: gestrichelt vom Landesmittelpunkt zum Partnerland, Name am Ende (oder am Bildrand).
    {const [ax,ay]=project(current.center[0],current.center[1]);ctx.save();ctx.setLineDash([7,6]);ctx.font='600 12px system-ui,sans-serif';ctx.textBaseline='middle';
      // Ein Partner kann Ausfuhr- und Einfuhrpartner sein: zwei leicht versetzte Linien, ein gemeinsames Schild.
      const schilder=[],proZiel=new Map();for(const h of handelLinien()){const e=proZiel.get(h.ziel)||{};e[h.richtung]=h;proZiel.set(h.ziel,e);}
      for(const [ziel,e] of proZiel){const [bx,by]=project(ziel.center[0],ziel.center[1]),len=Math.hypot(bx-ax,by-ay)||1,nx=-(by-ay)/len,ny=(bx-ax)/len;
        const beide=e.aus&&e.ein;
        for(const h of [e.aus,e.ein].filter(Boolean)){const o=beide?(h.richtung==='aus'?2.5:-2.5):0;
          ctx.strokeStyle=h.richtung==='aus'?'#ffb35c':'#7fdcff';ctx.lineWidth=1.5+Math.min(3.5,h.anteil*14);ctx.globalAlpha=.9;
          ctx.beginPath();ctx.moveTo(ax+nx*o,ay+ny*o);ctx.lineTo(bx+nx*o,by+ny*o);ctx.stroke();}
        ctx.globalAlpha=1;const p=amRand(ax,ay,bx,by,W,H);
        const teile=[[ziel.name+' ','#fff'],...(e.aus?[[`→ ${pct(e.aus.anteil)}`,'#ffb35c']]:[]),...(e.aus&&e.ein?[[' · ','#fff']]:[]),...(e.ein?[[`← ${pct(e.ein.anteil)}`,'#7fdcff']]:[])];
        const tw=teile.reduce((s,[t])=>s+ctx.measureText(t).width,0),lx=Math.max(4,Math.min(W-tw-12-(p[1]<150?52:0),p[0]+6)); // rechts oben liegen die Zoomknöpfe
        // Schilder am Bildrand nicht übereinander: so lange um 20 px verschieben, bis frei.
        let ly=Math.max(12,Math.min(H-12,p[1]));const frei=y=>!schilder.some(r=>lx<r[0]+r[2]&&lx+tw+8>r[0]&&Math.abs(y-r[1])<19);
        for(let k=1;!frei(ly)&&k<30;k++){const y=Math.max(12,Math.min(H-12,p[1]+(k%2?1:-1)*Math.ceil(k/2)*20));if(frei(y)){ly=y;break;}}
        schilder.push([lx,ly,tw+8]);
        ctx.fillStyle='rgba(6,12,24,.85)';ctx.fillRect(lx,ly-9,tw+8,18);let x=lx+4;for(const [t,col] of teile){ctx.fillStyle=col;ctx.fillText(t,x,ly);x+=ctx.measureText(t).width;}}
      ctx.restore();}
    const ok2=r=>r&&Number.isFinite(r.lat)&&Number.isFinite(r.lon);
    const line=(it,color,kind)=>{const l=it.link;if(!ok2(l.from)||!ok2(l.to))return;const [ax,ay]=project(l.from.lon,l.from.lat),[bx,by]=project(l.to.lon,l.to.lat);
      ctx.strokeStyle=color;ctx.lineWidth=it.tonnen?Math.min(5,1.4+Math.log10(it.tonnen)/2):1.4;ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.stroke();
      const a=Math.atan2(by-ay,bx-ax),mx=(ax+bx)/2,my=(ay+by)/2;ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(mx+7*Math.cos(a),my+7*Math.sin(a));ctx.lineTo(mx-5*Math.cos(a)+4*Math.sin(a),my-5*Math.sin(a)-4*Math.cos(a));ctx.lineTo(mx-5*Math.cos(a)-4*Math.sin(a),my-5*Math.sin(a)+4*Math.cos(a));ctx.fill();
      lines.push({ax,ay,bx,by,it,kind});};
    ctx.globalAlpha=.85;
    for(const it of report.inland)line(it,'#'+(it.link.color??it.link.from?.color??0x9fd3ff).toString(16).padStart(6,'0'),'inland');
    for(const it of report.aus)line(it,'#ff9f43','aus');
    for(const it of report.ein)line(it,'#4dd2ff','ein');
    ctx.globalAlpha=1;
    // Standorte; Orte der Aus- und Einfuhren größer mit weißem Ring.
    const wichtig=new Set([...report.aus,...report.ein].map(it=>rowKey(it.ort)));
    for(const r of report.sites){if(!ok2(r))continue;const [x,y]=project(r.lon,r.lat);if(x<-10||y<-10||x>W+10||y>H+10)continue;
      const big=wichtig.has(rowKey(r));ctx.fillStyle='#'+(r.color??0x9fd3ff).toString(16).padStart(6,'0');ctx.beginPath();ctx.arc(x,y,big?5:2.6,0,7);ctx.fill();
      if(big){ctx.strokeStyle='#fff';ctx.lineWidth=1.6;ctx.stroke();}markers.push({x,y,r});}
    // Werke (Quadrat) und Häfen (Raute) der Top-Waren laut USGS; orange = Ausfuhrware, blau = Einfuhrware.
    ctx.font='600 11px system-ui,sans-serif';ctx.textBaseline='middle';
    const schildWerk=[];
    for(const p of werkPunkte()){const [x,y]=project(p.x.lon,p.x.lat);if(x<-10||y<-10||x>W+10||y>H+10)continue;
      ctx.fillStyle=p.r==='aus'?'#ff9f43':'#4dd2ff';ctx.strokeStyle='#0a1626';ctx.lineWidth=1.5;ctx.beginPath();
      if(p.art==='hafen'){ctx.moveTo(x,y-7);ctx.lineTo(x+7,y);ctx.lineTo(x,y+7);ctx.lineTo(x-7,y);ctx.closePath();}else ctx.rect(x-5,y-5,10,10);
      ctx.fill();ctx.stroke();
      // Beschriftung nur bei gewählter Ware und nur, wenn sie kein anderes Schild überdeckt (sonst Hinweis beim Überfahren).
      if(handelSel){const t=p.art==='hafen'?'Hafen '+p.x.name:nameKurz(p.firma.name);const w=ctx.measureText(t).width+8;
        if(!schildWerk.some(([sx,sy,sw])=>x+8<sx+sw&&x+8+w>sx&&Math.abs(y-sy)<17)){schildWerk.push([x+8,y,w]);ctx.fillStyle='rgba(6,12,24,.8)';ctx.fillRect(x+8,y-8,w,16);ctx.fillStyle='#fff';ctx.fillText(t,x+12,y);}}
      markers.push({x,y,werk:p});}
    // Partnerländer am Ende der Linien beschriften, wenn das Ende im Bild ist.
    ctx.font='600 12px system-ui,sans-serif';ctx.textBaseline='middle';
    for(const li of lines){if(li.kind==='inland')continue;const p=li.kind==='aus'?[li.bx,li.by]:[li.ax,li.ay];if(p[0]<0||p[1]<0||p[0]>W||p[1]>H)continue;
      const name=byKey.get(li.it.partner)?.name||'Land unbekannt';ctx.fillStyle='rgba(6,12,24,.75)';const w=ctx.measureText(name).width;ctx.fillRect(p[0]+6,p[1]-9,w+8,18);ctx.fillStyle='#fff';ctx.fillText(name,p[0]+10,p[1]);}
    void ok;
  }

  // Bedienung der Karte: ziehen, Mausrad, zwei Finger, Knöpfe; Klick auf Punkt/Linie öffnet das bekannte Fenster.
  const ptr=new Map();let drag=null,moved=false;
  canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);ptr.set(e.pointerId,{x:e.clientX,y:e.clientY});moved=false;drag={cam:{...cam},x:e.clientX,y:e.clientY,dist:pinch()};});
  canvas.addEventListener('pointermove',e=>{
    if(!ptr.has(e.pointerId)){hoverAt(e);return;}
    ptr.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>4)moved=true;
    if(ptr.size===2&&drag.dist){const d=pinch(),r=canvas.getBoundingClientRect(),m=[...ptr.values()],cx=(m[0].x+m[1].x)/2-r.left,cy=(m[0].y+m[1].y)/2-r.top;zoomAt(cx,cy,d/drag.dist,drag.cam);return;}
    if(ptr.size===1){cam.cx=drag.cam.cx-(e.clientX-drag.x)/kxOf();cam.cy=Math.max(-85,Math.min(85,drag.cam.cy+(e.clientY-drag.y)/cam.k));schedule();}
  });
  const end=e=>{ptr.delete(e.pointerId);if(ptr.size===1){const m=[...ptr.values()][0];drag={cam:{...cam},x:m.x,y:m.y,dist:0};}if(!ptr.size&&!moved&&e.type==='pointerup')clickAt(e);};
  canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
  canvas.addEventListener('pointerleave',()=>{hoverBox.hidden=true;});
  function pinch(){const m=[...ptr.values()];return m.length===2?Math.hypot(m[0].x-m[1].x,m[0].y-m[1].y):0;}
  canvas.addEventListener('wheel',e=>{e.preventDefault();const r=canvas.getBoundingClientRect();zoomAt(e.clientX-r.left,e.clientY-r.top,Math.exp(-e.deltaY*(e.deltaMode?0.05:0.0015)));},{passive:false});
  canvas.addEventListener('dblclick',e=>{const r=canvas.getBoundingClientRect();zoomAt(e.clientX-r.left,e.clientY-r.top,2);});
  function zoomAt(x,y,f,from=cam){
    const before={...from};cam={...before};const [lon,lat]=unproject(x,y);
    cam.k=Math.max(2,Math.min(60000,before.k*f));
    const [lon2,lat2]=unproject(x,y);cam.cx+=lon-lon2;cam.cy=Math.max(-85,Math.min(85,cam.cy+lat-lat2));schedule();
  }
  view.querySelectorAll('[data-z]').forEach(b=>b.onclick=()=>{const z=b.dataset.z;if(z==='fit')fit();else zoomAt(canvas.clientWidth/2,canvas.clientHeight/2,z==='in'?2:.5);});
  function nearest(e){
    const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,touch=e.pointerType==='touch'?14:7;
    let best=null,bd=touch;for(const m of markers){const d=Math.hypot(m.x-x,m.y-y);if(d<bd){bd=d;best=m.werk?{werk:m.werk}:{site:m.r};}}
    if(best)return best;
    for(const li of lines){const d=segDist(x,y,li);if(d<bd){bd=d;best={line:li};}}
    return best;
  }
  function hoverAt(e){
    const h=nearest(e);canvas.style.cursor=h?'pointer':'grab';
    if(!h){hoverBox.hidden=true;return;}
    const r=canvas.getBoundingClientRect();
    hoverBox.innerHTML=h.werk?werkHover(h.werk):h.site?`<strong>${esc(h.site.name||'Name unbekannt')}</strong><span>${esc(h.site.kind||'')} · ${esc(h.site.dataset?.short||h.site.dataset?.label||'')}</span>`
      :`<strong>${esc(nameKurz(h.line.it.link.from.name||'?'))} → ${esc(nameKurz(h.line.it.link.to.name||'?'))}</strong><span>${esc(h.line.it.ware||'Ware unbekannt')} · ${esc(h.line.it.tonnen?tonnenText(h.line.it.tonnen)+' pro Jahr':'Menge unbekannt')}</span>`;
    hoverBox.style.left=Math.min(r.width-240,e.clientX-r.left+12)+'px';hoverBox.style.top=(e.clientY-r.top+12)+'px';hoverBox.hidden=false;
  }
  function clickAt(e){const h=nearest(e);if(h?.site)sites.open([h.site]);else if(h?.line)sites.openLinks([h.line.it.link]);}

  // --- Globus-Hooks ---
  const hooks={
    hover(at,event,busy=false){
      if(!view.hidden)return;
      if(event?.pointerType==='touch'||(!event&&armed))return;
      const c=find(at);
      if(c!==hovered){hovered=c;glow.show(c);if(c)host.dataset.landHover=c.key;else delete host.dataset.landHover;chipFor(c);}
      // Über einem Punkt oder einer Verbindung zeigt der Globus deren Hinweis; das Land bleibt hervorgehoben, der Knopf unten öffnet es.
      tipAt(busy?null:c,event||{clientX:0,clientY:0});
    },
    tap(at,event,busy=false){
      const c=find(at),touch=event?.pointerType==='touch';
      if(!c){if(!busy){armed=null;hovered=null;glow.show(null);tip.hidden=true;chipFor(null);}return;}
      // Maus auf freier Fläche: Klick öffnet sofort. Finger: erst hervorheben (Knopf unten), zweiter Tipp auf dasselbe Land öffnet.
      // Traf der Klick einen Punkt oder eine Verbindung (deren Fenster öffnet sich), bleibt das Land nur hervorgehoben mit Knopf.
      if(!busy&&(!touch||armed===c)){open(c.key);return;}
      armed=c;hovered=c;glow.show(c);host.dataset.landHover=c.key;chipFor(c);
    },
    clickable:at=>!!find(at),
    open,close:()=>close(true),countries:list
  };
  const start=new URLSearchParams(location.search).get('land');
  if(start&&byKey.has(start))open(start,{push:false});
  return hooks;
}

const pct=a=>a==null?'':(a*100).toLocaleString('de-DE',{maximumFractionDigits:a<.1?1:0})+' %';
/** tausend US-Dollar -> "168,4 Mrd. US-$" */
export function usdText(tsd){if(tsd==null)return 'unbekannt';const v=tsd*1e3;
  return v>=1e9?(v/1e9).toLocaleString('de-DE',{maximumFractionDigits:1})+' Mrd. US-$':v>=1e6?(v/1e6).toLocaleString('de-DE',{maximumFractionDigits:1})+' Mio. US-$':Math.round(v).toLocaleString('de-DE')+' US-$';}
/** Kurzname einer HS-Position: Text bis zum ersten Semikolon, höchstens 90 Zeichen (voller Name im Aufklapper). */
export function hsKurz(n){if(!n)return 'Name unbekannt';const t=n.split(';')[0].trim();return t.length>90?t.slice(0,88).replace(/\s+\S*$/,'')+' …':t;}
/** Punkt auf der Strecke a->b, der noch im Bild liegt (Ende, sonst Austritt am Rand mit 10 px Abstand). */
function amRand(ax,ay,bx,by,W,H){
  const m=10;if(bx>=m&&by>=m&&bx<=W-m&&by<=H-m)return [bx,by];
  let t=1;const dx=bx-ax,dy=by-ay;
  if(dx>0)t=Math.min(t,(W-m-ax)/dx);if(dx<0)t=Math.min(t,(m-ax)/dx);if(dy>0)t=Math.min(t,(H-m-ay)/dy);if(dy<0)t=Math.min(t,(m-ay)/dy);
  t=Math.max(0,t);return [ax+dx*t,ay+dy*t];
}

function segDist(x,y,{ax,ay,bx,by}){const dx=bx-ax,dy=by-ay,l=dx*dx+dy*dy;let t=l?((x-ax)*dx+(y-ay)*dy)/l:0;t=Math.max(0,Math.min(1,t));return Math.hypot(x-ax-t*dx,y-ay-t*dy);}

/** Fein unterteiltes Kugelstück über einem Längen/Breiten-Rechteck (wie die Kacheln in globe-tiles.mjs), UV 0..1. */
function patch(THREE,[w,s,e,n],radius,material){
  const segX=Math.max(4,Math.min(160,Math.ceil((e-w)/1.5))),segY=Math.max(4,Math.min(90,Math.ceil((n-s)/1.5)));
  const pos=[],uv=[],index=[];
  for(let j=0;j<=segY;j++)for(let i=0;i<=segX;i++){
    const lat=n+(s-n)*j/segY,lon=w+(e-w)*i/segX,c=Math.cos(lat*rad);
    pos.push(radius*c*Math.cos(lon*rad),radius*Math.sin(lat*rad),-radius*c*Math.sin(lon*rad));uv.push(i/segX,1-j/segY);
    if(i<segX&&j<segY){const a=j*(segX+1)+i,b=a+segX+1;index.push(a,b,a+1,a+1,b,b+1);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(index);
  const m=new THREE.Mesh(g,material);m.renderOrder=20;return m;
}

// ---------------------------------------------------------------------------------------------------------------
// Seitenleiste
const PARTNER_MAX=6;
function sideHtml(c,rep){
  const name=k=>k==='unbekannt'?'Land unbekannt':(LAND_NAMEN.get(k)||k);
  const gruppe=(g,i,richtung)=>{
    const mitMenge=g.mitMenge?`${tonnenText(g.tonnen)} pro Jahr laut Quelle (${num(g.mitMenge)} von ${num(g.items.length)} Verbindungen mit Menge)`:'Menge unbekannt';
    const partner=g.partner.slice(0,PARTNER_MAX).map(([k,n])=>`${esc(name(k))}${n>1?` (${num(n)})`:''}`).join(', ')+(g.partner.length>PARTNER_MAX?` und ${num(g.partner.length-PARTNER_MAX)} weitere`:'');
    const arten=[...new Set(g.items.flatMap(it=>it.weg?.arten||[]))],haefen=[...new Set(g.items.flatMap(it=>it.weg?.hafen||[]))];
    const wie=arten.length||haefen.length?[arten.length?arten.join(', ')+' (laut Quellentext)':'',haefen.length?'über '+haefen.slice(0,3).map(h=>esc(nameKurz(h))).join(', '):''].filter(Boolean).join(' · '):'unbekannt (keine Quelle nennt den Transportweg)';
    const firmen=g.firmen.slice(0,5).map(f=>{
      const orte=[...f.orte.values()].slice(0,2);
      const st=status(f.items[0].link.evidence,f.items[0].link.audit);
      return `<li><b>${esc(f.name)}</b>${f.standort?' <small class="cv-muted">(Standortname; Betreiber im Atlas unbekannt)</small>':f.ueber&&f.ueber!==f.name?` <small class="cv-muted">betreibt/besitzt ${esc(nameKurz(f.ueber))}</small>`:''}<br>
<small>Wo: ${orte.map(o=>`<button type="button" class="cv-link" data-fokus="${esc(rowKey(o))}">${esc(nameKurz(o.name||'Standort'))}</button>`).join(', ')} · ${f.tonnen?esc(tonnenText(f.tonnen))+' pro Jahr':num(f.anzahl)+(f.anzahl===1?' Verbindung':' Verbindungen')+', Menge unbekannt'} · <span data-ton="${st.ton}">${esc(st.text)}</span></small></li>`;}).join('');
    return `<article class="cv-ware"><h4>${i+1}. ${esc(g.ware==='unbekannt'?'Ware unbekannt':g.ware)}</h4>
<dl><div><dt>Menge</dt><dd>${mitMenge}</dd></div><div><dt>${richtung==='aus'?'Wohin':'Woher'}</dt><dd>${partner||'unbekannt'}</dd></div><div><dt>Wie</dt><dd>${wie}</dd></div></dl>
<p class="cv-firmen-titel">Unternehmen${g.firmen.length>5?` (5 von ${num(g.firmen.length)})`:''}</p><ol class="cv-firmen">${firmen}</ol></article>`;
  };
  const block=(titel,gruppen,richtung,leer)=>`<section class="cv-block"><h3>${titel}</h3>
<p class="cv-muted">Einzelne Lieferungen mit Quelle, nach Ware, mit Unternehmen und Ort. Reihenfolge: belegte Jahresmenge, sonst Zahl der Verbindungen. Keine Größenrangliste der Unternehmen.</p>
${gruppen.length?gruppen.slice(0,3).map((g,i)=>gruppe(g,i,richtung)).join('')+(gruppen.length>3?`<p class="cv-muted">${num(gruppen.length-3)} weitere Waren im Atlas.</p>`:''):`<p class="cv-leer">${leer}</p>`}</section>`;
  const inlandWare=rep.inland.filter(it=>it.ware!==null||it.weg).length;
  const inl=rep.inland.slice().sort((a,b)=>(b.tonnen||0)-(a.tonnen||0)).slice(0,6).map(it=>`<li>${esc(nameKurz(it.link.from.name||'?'))} → ${esc(nameKurz(it.link.to.name||'?'))} <small class="cv-muted">${esc(it.ware||(it.weg?'Ware unbekannt':'Eigentum/Betrieb'))}${it.tonnen?' · '+esc(tonnenText(it.tonnen))+' pro Jahr':''}</small></li>`).join('');
  const kinds=new Map();for(const r of rep.sites){const k=r.dataset?.short||r.dataset?.label||'?';kinds.set(k,(kinds.get(k)||0)+1);}
  const kindList=[...kinds.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k,n])=>`${esc(k)} ${num(n)}`).join(' · ');
  return `${block('Belegte Lieferungen ins Ausland (Atlas)',rep.ausfuhr,'aus',`Keine Lieferung aus ${esc(c.name)} ins Ausland im Atlas belegt.`)}
${block('Belegte Lieferungen aus dem Ausland (Atlas)',rep.einfuhr,'ein',`Keine Lieferung aus dem Ausland nach ${esc(c.name)} im Atlas belegt.`)}
<section class="cv-block"><h3>Inlandsverbindungen</h3><p>${num(rep.inland.length)} Verbindungen innerhalb des Landes (${num(inlandWare)} Warenwege, ${num(rep.inland.length-inlandWare)} Eigentum oder Betrieb). Auf der Karte als Linien.</p>${inl?`<ul class="cv-inland">${inl}</ul>`:''}</section>
<section class="cv-block"><h3>Standorte im Atlas</h3><p>${num(rep.sites.length)} Standorte${kindList?': '+kindList:''}. Punkte auf der Karte; Klick öffnet die Angaben mit Quelle.</p></section>`;
}
/** Amtliche Top-3 je Richtung (CEPII BACI). Fehlt das Land in der Statistik, steht "unbekannt". */
function statHtml(c,handel,fehler,sel,fi={}){
  const name=k=>LAND_NAMEN.get(k)||(handel?.meta?.ohne_land?.[k]?`${handel.meta.ohne_land[k]} (Land in der Quelle nicht genannt)`:k);
  const kopf=`<h3>Größte Aus- und Einfuhren (amtliche Statistik)</h3>`;
  if(!handel)return `<section class="cv-block cv-stat">${kopf}<p>${fehler?'Handelsstatistik nicht erreichbar: <b>unbekannt</b>.':'Lädt …'}</p></section>`;
  const m=handel.meta,d=handel.laender[c.key];
  const quelle=`<p class="cv-quelle">Quelle: <a href="${esc(m.url)}" target="_blank" rel="noopener">${esc(m.quelle)}</a>, Jahr ${m.jahr}, Lizenz ${esc(m.lizenz)}. Werte FOB in US-Dollar; Warengruppe = HS-Position (4-stellig), Namen nach Kombinierter Nomenklatur (Eurostat). Nur Waren, keine Dienstleistungen. Die Statistik nennt keine Unternehmen und keinen Transportweg; Unternehmen, Werke und Häfen je Ware stammen aus USGS (Minerals Yearbook 2024, Werktabelle, gemeinfrei, und USGS-GIS).</p>`;
  if(!d)return `<section class="cv-block cv-stat">${kopf}<p>${esc(c.name)} steht nicht in der Statistik: <b>unbekannt</b>.</p>${quelle}</section>`;
  const teil=(r,titel)=>{
    const x=d[r];if(!x)return `<h4 class="cv-stat-h">${titel}</h4><p>unbekannt</p>`;
    const waren=x.waren.map((w,i)=>{const id=`${r}:${i}`;const partner=w.partner.map(([k,,a])=>`${esc(name(k))} ${pct(a)}`).join(', ');
      return `<li${sel===id?' class="aktiv"':''}><div class="cv-hs"><b>${esc(hsKurz(w.name))}</b> <small class="cv-muted">HS ${esc(w.hs4)}</small></div>
<div class="cv-zahl">${esc(usdText(w.tsd_usd))} · ${pct(w.anteil)} aller ${r==='aus'?'Ausfuhren':'Einfuhren'}${w.t!=null?` · ${esc(tonnenText(w.t))}`:' · Menge unbekannt'}</div>
<div><small>${r==='aus'?'Wohin':'Woher'}: ${partner||'unbekannt'}</small> <button type="button" class="cv-link" data-handel="${id}" aria-pressed="${sel===id}">${sel===id?'Alle Partner auf der Karte':'auf der Karte'}</button></div>
${w.name&&w.name!==hsKurz(w.name)?`<details><summary>voller Warenname</summary><small>${esc(w.name)}</small></details>`:''}
${firmenHtml(fi,c.key,w.hs4,r)}</li>`;}).join('');
    const partner=x.partner.map(([k,,a])=>`${esc(name(k))} ${pct(a)}`).join(', ');
    return `<h4 class="cv-stat-h">${titel} · ${esc(usdText(x.tsd_usd))} insgesamt</h4><ol class="cv-top3">${waren}</ol><p class="cv-muted">Wichtigste Partner insgesamt: ${partner||'unbekannt'}</p>`;
  };
  return `<section class="cv-block cv-stat" data-quelle="baci">${kopf}<p class="cv-muted">${esc(c.name)}, ${m.jahr}. Gestrichelte Linien auf der Karte: wichtigste Partnerländer, → Anteil an den Ausfuhren, ← an den Einfuhren.</p>
${teil('aus','Ausfuhren')}${teil('ein','Einfuhren')}${quelle}</section>`;
}
const kapText=(k,einheit)=>k==null?'Kapazität unbekannt':`${num(Math.round(k*10)/10)} ${einheit||''} pro Jahr`.replace(/ +/g,' ');
/** Unternehmen je Top-Ware aus der USGS-Werktabelle: Rang nur nach Jahreskapazität, Ort, Hafen. Fehlt etwas, "unbekannt". */
export function firmenHtml({daten,fehler}={},land,hs,r){
  if(!daten)return fehler?'<p class="cv-firmen-titel">Unternehmen: <b>unbekannt</b> (Werkdaten nicht erreichbar)</p>':'';
  const e=daten.laender?.[land]?.[hs],m=daten.meta;
  if(!e)return '<p class="cv-muted cv-uf">Unternehmen: <b>unbekannt</b>. Für diese Ware nennen weder die Handelsstatistik noch die USGS-Werktabelle Unternehmen.</p>';
  const quelle=`<a href="${esc(m.url)}" target="_blank" rel="noopener">USGS Minerals Yearbook ${m.jahr}</a>`;
  if(!e.firmen.length)return `<p class="cv-muted cv-uf">Unternehmen: <b>unbekannt</b>. Keine aktiven ${esc(e.zuordnung)} im Land in der Werktabelle (${quelle}).</p>`;
  const li=e.firmen.map(f=>{
    const anteil=f.kap&&e.kap_land?` (${pct(f.kap/e.kap_land)} der Landeskapazität laut USGS)`:'';
    const werke=f.werke.slice(0,2).map(w=>{const wo=[w.ort,w.adm1&&w.adm1!=='NA'&&!(w.ort||'').includes(w.adm1)?w.adm1:''].filter(Boolean).join(', ');
      const eig=w.eigner?.length?` · Eigentümer: ${w.eigner.map(([n,a])=>esc(n)+(a!=null?` ${num(a)} %`:'')).join(', ')}`:'';
      const beleg=w.beleg?.[0]?` · <a href="${esc(w.beleg[0])}" target="_blank" rel="noopener">Beleg</a>`:'';
      return `<li>${esc(w.name)} <small class="cv-muted">${esc([...new Set([w.art,w.stufe].filter(Boolean))].join(', '))}${w.geteilt?', Kapazität gemeinsam mit anderen Werken':''}</small><br>
<small>Wo: ${esc(wo||'Ort unbekannt')}${w.lat!=null?` <button type="button" class="cv-link" data-werk="${w.lat},${w.lon}">auf der Karte</button>`:' (kein Kartenpunkt)'} · ${esc(kapText(w.kap,e.einheit&&w.einheit===e.einheit?e.einheit:w.einheit))}${eig}${beleg}</small></li>`;}).join('');
    return `<li><b>${esc(f.name)}</b> <span class="cv-zahl">${f.rang?esc(kapText(f.kap,e.einheit))+anteil:f.gemeinsam?'Kapazität gemeinsam mit anderen Betreibern, ohne Rang':'Kapazität unbekannt, ohne Rang'}</span>
${f.werke_n>2?`<small class="cv-muted"> · ${num(f.werke_n)} Werke, 2 größte gezeigt</small>`:''}<ul class="cv-werke">${werke}</ul></li>`;}).join('');
  const hafen=e.haefen.length?e.haefen.map(h=>`Hafen <b>${esc(h.name)}</b> <button type="button" class="cv-link" data-werk="${h.lat},${h.lon}">auf der Karte</button> <small class="cv-muted">(Umschlag: ${esc(h.ware||'Ware genannt')}${h.werk?`; angebunden: ${esc(h.werk)}`:''}${h.ziel?`; Ziele: ${esc(h.ziel)}`:''}; <a href="${esc(m.gis[h.quelle]?.url||m.url)}" target="_blank" rel="noopener">USGS-GIS ${h.jahr}</a>)</small>`).join('<br>'):'unbekannt (keine Quelle nennt den Transportweg)';
  const titel=r==='aus'?`Größte Erzeuger im Land nach Jahreskapazität`:`Werke dieser Ware im Land nach Jahreskapazität`;
  return `<div class="cv-uf" data-quelle="usgs"><p class="cv-firmen-titel">${titel}${e.firmen_n>5?` (5 von ${num(e.firmen_n)} Betreibern)`:''}</p>
<p class="cv-muted">${esc(e.zuordnung)} laut ${quelle}, Stand ${esc(m.stand)}. Rang = Jahreskapazität der aktiven Werke, nicht ${r==='aus'?'Ausfuhr':'Einfuhr'}menge: wer wie viel ${r==='aus'?'aus':'ein'}führt, nennt keine freie Quelle.</p>
<ol class="cv-firmen">${li}</ol><p><small><b>Wie:</b> ${hafen}</small></p></div>`;
}
function werkHover(p){
  if(p.art==='hafen')return `<strong>Hafen ${esc(p.x.name)}</strong><span>${esc(p.x.ware||'')}${p.x.werk?' · angebunden: '+esc(p.x.werk):''} · USGS-GIS ${p.x.jahr}</span>`;
  return `<strong>${esc(p.x.name)}</strong><span>${esc(p.firma.name)} · ${esc(p.e.zuordnung)} · ${esc(kapText(p.x.kap,p.x.einheit))}${p.x.geteilt?' (gemeinsam mit anderen Werken)':''} · USGS ${p.x.lage_quelle==='Atlas-Standort'?'(Lage: Atlas-Standort)':'(Lage: USGS-GIS)'}</span>`;
}
let LAND_NAMEN=new Map();
export function setNames(list){LAND_NAMEN=new Map(list.map(c=>[c.key,c.name]));}

function injectCss(){
  if(document.getElementById('country-view-css'))return;
  const s=document.createElement('style');s.id='country-view-css';s.textContent=`
.country-tip{position:absolute;z-index:30;display:flex;flex-direction:column;gap:2px;padding:7px 10px;border-radius:8px;background:rgba(10,22,38,.88);color:#fff;font:13px/1.35 system-ui,sans-serif;pointer-events:none;box-shadow:0 4px 16px #0006;max-width:220px}
.country-tip strong{font-size:14px}.country-tip span{color:#cfe0f2;font-size:12px}
.country-chip{position:absolute;z-index:31;left:50%;bottom:14px;transform:translateX(-50%);padding:9px 16px;border:0;border-radius:999px;background:#ffd166;color:#14202b;font:600 14px system-ui,sans-serif;box-shadow:0 4px 18px #0007;cursor:pointer;white-space:nowrap;max-width:calc(100% - 24px);overflow:hidden;text-overflow:ellipsis}.country-chip[hidden]{display:none}.country-chip b{margin-right:4px}.country-chip:hover{background:#ffe08f}
.country-view{position:absolute;inset:0;z-index:40;display:flex;flex-direction:column;background:#0a1626;color:#112a44}
.country-view[hidden]{display:none}
.cv-head{display:flex;align-items:center;gap:14px;padding:10px 16px;background:#fff;border-bottom:1px solid #d8e5ef}
.cv-head h2{margin:0;font-size:22px;line-height:1.2}.cv-sub{margin:2px 0 0;color:#51677f;font-size:13px}
.cv-back{flex:none;padding:8px 12px;border:1px solid #bbd4e3;border-radius:8px;background:#fff;color:#174a72;font:600 14px system-ui,sans-serif;cursor:pointer}
.cv-back:hover{background:#e9f6fd}
.cv-body{flex:1;min-height:0;display:flex}
.cv-map{position:relative;flex:1;min-width:0}
.cv-map canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:grab}
.cv-zoom{position:absolute;right:12px;top:12px;display:flex;flex-direction:column;gap:6px}
.cv-zoom button{width:36px;height:36px;border:1px solid #bbd4e3;border-radius:8px;background:#fff;color:#174a72;font:700 18px system-ui,sans-serif;cursor:pointer}
.cv-credit{position:absolute;right:8px;bottom:4px;font:11px/1.3 system-ui,sans-serif;color:#cfe3ff;opacity:.8;pointer-events:none;text-shadow:0 1px 2px #000}
.cv-legend{position:absolute;left:10px;bottom:10px;display:flex;flex-wrap:wrap;gap:10px;padding:6px 10px;border-radius:8px;background:rgba(10,22,38,.75);color:#fff;font:12px system-ui,sans-serif;pointer-events:none}
.cv-legend i{display:inline-block;width:18px;height:3px;margin-right:5px;vertical-align:middle}
.cv-hover{position:absolute;z-index:3;display:flex;flex-direction:column;gap:2px;max-width:240px;padding:6px 9px;border-radius:7px;background:rgba(10,22,38,.9);color:#fff;font:12px/1.35 system-ui,sans-serif;pointer-events:none}
.cv-hover span{color:#cfe0f2}
.cv-side{flex:none;width:400px;max-width:42%;overflow:auto;background:#f5f9fd;border-left:1px solid #d8e5ef;padding:12px 16px 24px;font:14px/1.5 system-ui,sans-serif}
.cv-block{margin:0 0 18px}.cv-block h3{margin:0 0 4px;font-size:17px}.cv-block p{margin:0 0 8px}
.cv-muted{color:#51677f}.cv-leer{padding:8px 10px;border:1px dashed #c4d8e5;border-radius:8px;color:#51677f;background:#fff}
.cv-ware{margin:8px 0;padding:10px 12px;border:1px solid #d8e5ef;border-radius:10px;background:#fff}
.cv-ware h4{margin:0 0 6px;font-size:15px}
.cv-ware dl{margin:0;display:grid;gap:4px}.cv-ware dl div{display:grid;grid-template-columns:62px 1fr;gap:8px}.cv-ware dt{color:#51677f}.cv-ware dd{margin:0}
.cv-firmen-titel{margin:8px 0 2px!important;font-weight:600}
.cv-uf{margin-top:6px;padding-top:6px;border-top:1px dashed #d8e5ef}.cv-uf p{margin:2px 0}
.cv-werke{margin:2px 0 4px;padding-left:16px;list-style:square}.cv-werke li{margin:0 0 3px}
.cv-firmen{margin:0;padding-left:20px}.cv-firmen li{margin:0 0 6px}
.cv-firmen [data-ton=ok]{color:#1d6b3a}.cv-firmen [data-ton=offen]{color:#8a5a00}.cv-firmen [data-ton=gesperrt]{color:#a32020}
.cv-link{padding:0;border:0;background:none;color:#075a9c;text-decoration:underline;font:inherit;cursor:pointer}
.cv-inland{margin:0;padding-left:18px}
.cv-stat{padding:10px 12px;border-radius:10px;background:#fff;border:1px solid #d8e5ef}
.cv-stat-h{margin:10px 0 4px;font-size:15px}
.cv-top3{margin:0;padding-left:20px}.cv-top3 li{margin:0 0 8px}.cv-top3 li.aktiv{background:#eef7ff;border-radius:6px;outline:4px solid #eef7ff}
.cv-hs b{font-weight:600}.cv-zahl{font-weight:600;color:#174a72}
.cv-top3 details summary{cursor:pointer;color:#075a9c;font-size:12px}
.cv-quelle{margin:8px 0 0!important;font-size:12px;color:#51677f}.cv-quelle a{color:#075a9c}
@media (max-width:760px){
 .country-view{position:fixed;inset:0;z-index:1000;overflow:auto}
 .cv-head{padding:8px 10px;gap:10px}.cv-head h2{font-size:18px}.cv-sub{font-size:12px}
 .cv-body{flex-direction:column;flex:none}
 .cv-map{flex:none;height:56dvh}
 .cv-side{width:auto;max-width:none;border-left:0;border-top:1px solid #d8e5ef;overflow:visible}
}`;
  document.head.append(s);
}
