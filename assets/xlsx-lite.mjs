// Minimaler XLSX-Schreiber ohne Bibliothek: ZIP ohne Kompression (STORED), Inline-Strings, Zahlen als Zahlen.
// Nur für Exporte aus dem Atlas; liest keine Dateien. Gleiche Eingabe und gleiches Datum ergeben dieselben Bytes.
const enc=new TextEncoder();
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
const crc32=b=>{let c=0xffffffff;for(let i=0;i<b.length;i++)c=CRC[(c^b[i])&255]^(c>>>8);return (c^0xffffffff)>>>0};
const xml=v=>String(v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
const col=i=>{let s='';for(i++;i>0;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s};

function sheetXml(rows){
 const body=rows.map((r,ri)=>`<row r="${ri+1}">${r.map((v,ci)=>{const ref=col(ci)+(ri+1);
  if(typeof v==='number'&&Number.isFinite(v))return `<c r="${ref}"${ri===0?' s="1"':''}><v>${v}</v></c>`;
  return `<c r="${ref}" t="inlineStr"${ri===0?' s="1"':''}><is><t xml:space="preserve">${xml(v??'')}</t></is></c>`}).join('')}</row>`).join('');
 return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>${body}</sheetData></worksheet>`;
}

// sheets: [{name, rows:[[header...],[...]...]}]; liefert Uint8Array.
export function xlsx(sheets,date=new Date(0)){
 const safeName=n=>String(n).replace(/[\[\]:*?\/\\]/g,' ').slice(0,31);
 const files=[
  ['[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
  ['_rels/.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
  ['xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s,i)=>`<sheet name="${xml(safeName(s.name))}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`],
  ['xl/_rels/workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
  ['xl/styles.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`],
  ...sheets.map((s,i)=>[`xl/worksheets/sheet${i+1}.xml`,sheetXml(s.rows)])];
 const d=date,dosTime=(d.getUTCHours()<<11)|(d.getUTCMinutes()<<5)|(d.getUTCSeconds()>>1),dosDate=Math.max(0,d.getUTCFullYear()-1980)<<9|(d.getUTCMonth()+1)<<5|d.getUTCDate();
 const parts=[],central=[];let off=0;
 for(const [name,text] of files){
  const n=enc.encode(name),data=enc.encode(text),c=crc32(data),h=new DataView(new ArrayBuffer(30));
  h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(8,0,true);h.setUint16(10,dosTime,true);h.setUint16(12,dosDate,true);
  h.setUint32(14,c,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,n.length,true);h.setUint16(28,0,true);
  parts.push(new Uint8Array(h.buffer),n,data);
  const e=new DataView(new ArrayBuffer(46));
  e.setUint32(0,0x02014b50,true);e.setUint16(4,20,true);e.setUint16(6,20,true);e.setUint16(8,0x0800,true);e.setUint16(10,0,true);e.setUint16(12,dosTime,true);e.setUint16(14,dosDate,true);
  e.setUint32(16,c,true);e.setUint32(20,data.length,true);e.setUint32(24,data.length,true);e.setUint16(28,n.length,true);e.setUint32(42,off,true);
  central.push(new Uint8Array(e.buffer),n);off+=30+n.length+data.length;
 }
 const csize=central.reduce((m,b)=>m+b.length,0),end=new DataView(new ArrayBuffer(22));
 end.setUint32(0,0x06054b50,true);end.setUint16(8,files.length,true);end.setUint16(10,files.length,true);end.setUint32(12,csize,true);end.setUint32(16,off,true);
 const all=[...parts,...central,new Uint8Array(end.buffer)],out=new Uint8Array(all.reduce((m,b)=>m+b.length,0));let p=0;for(const b of all){out.set(b,p);p+=b.length}
 return out;
}

// RFC-4180-CSV mit UTF-8-BOM (Komma, Punkt als Dezimaltrenner).
export function csv(rows){
 const cell=v=>{const s=v==null?'':String(v);return /[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
 return '﻿'+rows.map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n';
}
