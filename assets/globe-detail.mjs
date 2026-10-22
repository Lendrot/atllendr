/** Display grouping only: every marker remains at an actual member's coordinate. */
export function clusterProjected(records,project,cellSize=16,groupBy=()=>null){
 const cells=new Map();
 for(const record of records){
  const p=project(record);if(!p?.visible)continue;
  const key=String(groupBy(record))+':'+Math.floor(p.x/cellSize)+':'+Math.floor(p.y/cellSize);
  if(!cells.has(key))cells.set(key,[]);
  cells.get(key).push(record);
 }
 return [...cells.values()];
}
export function detailScale(altitude){return Math.max(.008,Math.min(1,altitude/210));}
export function markerPixels(altitude){return Math.max(2.5,Math.min(5,2.5+altitude/100));}
