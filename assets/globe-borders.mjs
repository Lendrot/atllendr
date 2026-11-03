/** Country border segments for the globe (analysis/LEISTUNG.md, Punkt 7).
 *  Same vertices and the same segment order as before (topojson.feature, then one line segment per ring edge), but built
 *  straight into a Float32Array. The function is self-contained on purpose: globe-scene.js also runs its source text in a
 *  Web Worker, so parsing world.json and building ~100,000 segments no longer blocks the page. */
export function borderPositions(topology,radius){
  const rad=Math.PI/180,t=topology.transform,sx=t?t.scale[0]:1,sy=t?t.scale[1]:1,tx=t?t.translate[0]:0,ty=t?t.translate[1]:0;
  const arcs=topology.arcs.map(arc=>{
    if(!t)return arc.map(p=>[p[0],p[1]]);
    let x=0,y=0;return arc.map(p=>[(x+=p[0])*sx+tx,(y+=p[1])*sy+ty]);
  });
  const rings=[];
  const ring=indices=>{
    const points=[];
    for(const i of indices){
      if(points.length)points.pop();
      const arc=arcs[i<0?~i:i],start=points.length;
      for(const p of arc)points.push(p);
      if(i<0)for(let a=start,b=points.length-1;a<b;a++,b--){const s=points[a];points[a]=points[b];points[b]=s;}
    }
    if(points.length<2)points.push(points[0]);
    while(points.length<4)points.push(points[0]);
    rings.push(points);
  };
  for(const g of topology.objects.countries.geometries){
    if(g.type==='Polygon')g.arcs.forEach(ring);
    else if(g.type==='MultiPolygon')g.arcs.forEach(polygon=>polygon.forEach(ring));
  }
  let n=0;for(const r of rings)n+=r.length-1;
  const out=new Float32Array(n*6);let o=0;
  const put=(lat,lon)=>{const c=Math.cos(lat*rad);out[o++]=radius*c*Math.cos(lon*rad);out[o++]=radius*Math.sin(lat*rad);out[o++]=-radius*c*Math.sin(lon*rad);};
  for(const r of rings)for(let i=1;i<r.length;i++){put(r[i-1][1],r[i-1][0]);put(r[i][1],r[i][0]);}
  return out;
}
