// V30.1: zeigt je Kauf-/Lieferverbindung, ob Käufer, Verkäufer, Produkt und Jahr belegt sind. Reine Anzeige.
const box=document.getElementById('tx-status'),sum=document.getElementById('tx-summary'),tb=document.getElementById('tx-rows');
const LBL={buyer:'Käufer fehlt','buyer.identity':'Käufer nicht eindeutig identifiziert',seller:'Verkäufer fehlt','seller.identity':'Verkäufer nicht eindeutig identifiziert',product:'Produkt fehlt','product.identity':'Zielunternehmen nicht eindeutig identifiziert','product.stake':'Anteil in % fehlt',year:'Jahr fehlt',event_completed:'nicht abgeschlossen',quantity:'Menge fehlt',buyer_dependency:'Abhängigkeit Käufer unbekannt',seller_dependency:'Abhängigkeit Verkäufer unbekannt'};
const EV={COMPLETED:'abgeschlossen',SIGNED:'unterzeichnet',ANNOUNCED:'angekündigt',INTENT:'Absicht',REPORTED:'gemeldet',FAILED:'gescheitert'};
const names=a=>(a||[]).map(p=>p.name||p.id).filter(Boolean).join(', ')||'—';
try{const r=await fetch('/assets/transactions-v30.json');if(!r.ok)throw Error(r.status);const d=await r.json(),tx=d.transactions;
 const ma=tx.filter(t=>t.type==='TRANSACTION_MA'),su=tx.filter(t=>t.type==='TRANSACTION_SUPPLY');const c=a=>a.filter(t=>t.completeness==='COMPLETE').length;
 sum.textContent=`Regel V30.1: Jede Kauf- oder Lieferverbindung braucht Käufer, Verkäufer, Produkt und Jahr. Vollständig belegt sind ${c(ma)} von ${ma.length} Unternehmenskäufen und ${c(su)} von ${su.length} Kupfer-Lieferstrecken (Escondida). Fehlende Angaben werden nicht geschätzt. Nichts davon ist freigegeben.`;
 for(const t of tx){const tr=document.createElement('tr');const cells=[t.type==='TRANSACTION_MA'?'Kauf':'Lieferung (Kupfer)',names(t.buyer),names(t.seller)+(String(t.seller_source||'').startsWith('candidate:')?' (Kandidat, ungeprüft)':''),t.product.target?.name||t.product.label||'—',t.year??'—',EV[t.event]||t.event,t.missing.length?t.missing.map(m=>LBL[m]||m).join(' · '):'vollständig'];
  for(const v of cells){const td=document.createElement('td');td.textContent=String(v);tr.appendChild(td)}tb.appendChild(tr)}
 box.hidden=false}catch(e){console.error(e)}
