export const localColor='#87949f';
export function rampLabel(p){
 const road=(rs,name)=>rs?.length?`${rs.join('／')} 號幹線`:(name||'地區道路');
 return p.role==='ramp'?`${road(p.fromRoutes,p.fromName)} → ${road(p.toRoutes,p.toName)}`:`${p.route?`${p.route} 號幹線 · `:''}${p.roadName||p.name} · ${p.direction||''}`;
}
function mix(a,b,t){return '#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('');}
export function movementKey(p){return p.movementId||`${p.structure}:${p.osmId}`;}
// Small physical segments give each ramp a continuous colour transition without flattening bridges.
export function colorConnections(features){
 return features.flatMap(f=>{
  const p=f.properties,key=movementKey(p);if(p.role!=='ramp')return [{...f,properties:{...p,movement:key}}];
  const cs=f.geometry.coordinates,dist=[0];for(let i=1;i<cs.length;i++)dist.push(dist.at(-1)+Math.hypot((cs[i][0]-cs[i-1][0])*.925,cs[i][1]-cs[i-1][1]));
  const length=dist.at(-1);if(!length)return [];
  const out=[];for(let i=1;i<cs.length;i++){
   const count=Math.max(1,Math.ceil((dist[i]-dist[i-1])/length*24));
   for(let k=0;k<count;k++){
    const a=k/count,b=(k+1)/count,point=t=>cs[i-1].map((v,j)=>v+(cs[i][j]-v)*t),t=(dist[i-1]+(dist[i]-dist[i-1])*(a+b)/2)/length;
    out.push({type:'Feature',properties:{...p,movement:key,lineColor:mix(p.startColor||localColor,p.endColor||localColor,(p.rampStart??0)+((p.rampEnd??1)-(p.rampStart??0))*t)},geometry:{type:'LineString',coordinates:[point(a),point(b)]}});
   }
  }return out;
 });
}
export function midpoint(cs){const ds=[0];for(let i=1;i<cs.length;i++)ds.push(ds.at(-1)+Math.hypot((cs[i][0]-cs[i-1][0])*.925,cs[i][1]-cs[i-1][1]));const half=ds.at(-1)/2,i=Math.max(1,ds.findIndex(d=>d>=half)),t=(half-ds[i-1])/(ds[i]-ds[i-1]||1);return cs[i-1].map((v,j)=>v+(cs[i][j]-v)*t);}
