export const filterParams={search:'q',kind:'typ',status:'status',country:'land',commodity:'rohstoff',quality:'daten'};
export function readResourceFilters(url){
 const u=new URL(url),values={};
 for(const [field,param] of Object.entries(filterParams))values[field]=u.searchParams.get(param)??(field==='search'?'':'all');
 if(!u.searchParams.has('typ'))values.kind=({'/verarbeitung/':'processor','/logistik/':'terminal'}[u.pathname]||'all');
 return values;
}
export function writeResourceFilters(url,values){
 const u=new URL(url);
 for(const [field,param] of Object.entries(filterParams)){const value=values[field];if(value&&value!=='all')u.searchParams.set(param,value);else if(field==='kind'&&['/verarbeitung/','/logistik/'].includes(u.pathname))u.searchParams.set(param,'all');else u.searchParams.delete(param)}
 return u;
}
