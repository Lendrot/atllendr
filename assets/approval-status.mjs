// Zeigt den Freigabestand der Eigentums-/Betriebsbeziehungen. Reine Anzeige, ändert keine Daten.
const t=document.getElementById('approval-text'),box=document.getElementById('approval-status');
try{const r=await fetch('/assets/approval-summary.json');if(!r.ok)throw Error(r.status);const s=await r.json();const n=x=>Number(x).toLocaleString('de-DE');
 t.textContent=`${n(s.approved)} von ${n(s.relationships)} Beziehungen sind freigegeben. ${n(s.review_ready)} sind prüfbar (alle gemeldete Mutterkonzerne), ${n(s.blocked)} sind blockiert, vor allem durch ungeklärte Unternehmensidentität (${n(s.blocker_counts.IDENTITY_UNRESOLVED)}) und unbestimmte Rolle (${n(s.blocker_counts.ROLE_UNDEFINED)}). Kein Eintrag gilt als belegt, solange er nicht freigegeben ist.`;box.hidden=false}
catch(e){console.error(e)}
