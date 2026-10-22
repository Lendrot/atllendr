/** A typed, directed view over the sourced asset records. No geographic edges are inferred. */
import {resourceRestrictions,MATERIAL_CONTAINMENT_POLICY_VERSION} from './safe-unknown.mjs';
export function buildResourceGraph(assets,relationships){
 const nodes=assets.map(asset=>{
  const restrictions=resourceRestrictions(asset);
  const base={id:asset.id,name:asset.name,country:asset.country,commodity:asset.commodity,coordinates:asset.coordinates??null,source_url:asset.source_url??null,audit:asset.audit??'UNKNOWN',asset,analysis_contract:{policy_version:MATERIAL_CONTAINMENT_POLICY_VERSION,fact_status:restrictions.includes('CONFLICT')?'CONFLICT':'UNKNOWN',restriction_reasons:restrictions,quantitative_analysis:restrictions.includes('UNKNOWN_MATERIAL_BASIS')?'BLOCKED':'NOT_VERIFIED'}};
  if(asset.kind==='mine')return {...base,type:'MineNode',mine:{status:asset.status,owner:asset.owner,capacities:asset.capacities??[],observations:asset.observations??[]}};
  if(asset.kind==='processor')return {...base,type:'ProcessingNode',processing:{technology:asset.technology??null,owner:asset.owner,capacities:asset.capacities??[]}};
  if(asset.kind==='terminal')return {...base,type:'LogisticsNode',logistics:{material:asset.commodity,owner:asset.owner,throughput_capacities:asset.capacities??[]}};
  return {...base,type:'OperationGroupNode',group:{observations:asset.observations??[]}};
 });
 const ids=new Set(nodes.map(n=>n.id));
 const edges=relationships.map(rel=>({...rel,id:rel.id,source:rel.from_id,target:rel.to_id,directed:true,endpoint_status:ids.has(rel.from_id)&&ids.has(rel.to_id)?'RESOLVED':'EXTERNAL_REFERENCE'}));
 return {nodes,edges};
}

export function visibleNodes(graph,filteredAssets){
 const ids=new Set(filteredAssets.map(a=>a.id));
 return graph.nodes.filter(node=>ids.has(node.id)&&node.coordinates);
}

export function visibleEdges(graph,visible){
 const ids=new Set(visible.map(n=>n.id));
 return graph.edges.filter(edge=>edge.endpoint_status==='RESOLVED'&&ids.has(edge.source)&&ids.has(edge.target));
}
