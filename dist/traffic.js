const normalize=s=>s.replace(/[\s\-–—－]/g,'');
export function facilityFeatures(features,facility,interchanges=[]){
 if(facility.kind==='interchange')return interchanges.filter(f=>f.properties.structure===facility.id);
 const aliases={'紅磡海底隧道':'海底隧道','中環及灣仔繞道':'繞道'};
 const name=normalize(aliases[facility.name]||facility.name);
 const matches=features.filter(f=>facility.routes.includes(f.properties.route)&&normalize(f.properties.name||'').includes(name));
 const typed=matches.filter(f=>f.properties[facility.kind==='bridge'?'bridge':'tunnel']);
 return typed.length?typed:matches;
}
const meters=(a,b)=>Math.hypot((b[0]-a[0])*Math.cos((a[1]+b[1])*Math.PI/360),b[1]-a[1])*111195;
export function buildTracks(features){
 const edges=[],adj=new Map(),key=c=>c.map(n=>n.toFixed(6)).join(',');
 for(const f of features){if(f.properties.status==='construction')continue;const cs=f.geometry.coordinates;if(cs.length<2)continue;const id=edges.length,a=(f.properties.route??'facility')+':'+key(cs[0]),b=(f.properties.route??'facility')+':'+key(cs.at(-1));edges.push({a,b,cs,route:f.properties.route});for(const k of [a,b]){if(!adj.has(k))adj.set(k,[]);adj.get(k).push(id);}}
 const used=new Set(),paths=[];
 function walk(first,from){let id=first,node=from,cs=[];
  while(!used.has(id)){used.add(id);const e=edges[id],forward=e.a===node,p=forward?e.cs:[...e.cs].reverse();cs.push(...(cs.length?p.slice(1):p));node=forward?e.b:e.a;const next=adj.get(node).filter(i=>!used.has(i));if(adj.get(node).length!==2||!next.length)break;id=next[0];}
  const distances=[0];for(let i=1;i<cs.length;i++)distances.push(distances.at(-1)+meters(cs[i-1],cs[i]));if(distances.at(-1)>65)paths.push({coords:cs,distances,length:distances.at(-1),route:edges[first].route});
 }
 for(const [node,ids] of adj)if(ids.length!==2)for(const id of ids)if(!used.has(id))walk(id,node);
 edges.forEach((e,id)=>{if(!used.has(id))walk(id,e.a);});
 const groups=new Map();for(const p of paths.sort((a,b)=>b.length-a.length)){const key=p.route??'facility';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);}
 const balanced=[];while(balanced.length<90&&[...groups.values()].some(g=>g.length))for(const g of groups.values())if(g.length&&balanced.length<90)balanced.push(g.shift());
 return balanced;
}
function position(track,d){const ds=track.distances;let lo=0,hi=ds.length-1;while(lo+1<hi){const m=(lo+hi)>>1;if(ds[m]<=d)lo=m;else hi=m;}const t=(d-ds[lo])/Math.max(.001,ds[hi]-ds[lo]);return {p:track.coords[lo].map((v,i)=>v+(track.coords[hi][i]-v)*t),index:hi};}
function section(track,a,b){const start=position(track,a),end=position(track,b);return [start.p,...track.coords.slice(start.index,end.index),end.p];}
export function trafficFrame(tracks,seconds,metersPerPixel,{prominence=1,density=1,speed=1,colors={}}={}){
 const features=[];let total=0;
 tracks.forEach((track,index)=>{
  const count=Math.max(1,Math.min(10,Math.round(track.length/(metersPerPixel*75/Math.sqrt(prominence))*density)));
  const tail=Math.min(track.length*.3,metersPerPixel*7*prominence);
  for(let i=0;i<count&&total<120;i++,total++){
   const head=((seconds*metersPerPixel*(15+index%4)*speed+track.length*(i+.37)/count)%track.length);
   if(head<tail)continue;
   for(let part=0;part<3;part++){const a=head-tail+tail*part/3,b=a+tail/3;features.push({type:'Feature',properties:{alpha:Math.min(1,[.17,.45,.95][part]*Math.sqrt(prominence)),color:colors[track.route]||'#cde0ee'},geometry:{type:'LineString',coordinates:section(track,a,b)}});}
  }
 });
 return {type:'FeatureCollection',features};
}
export function createTraffic(map,reducedMotion){
 let tracks=[],options={},frame=0,last=0,start=0;
 function tick(now){frame=requestAnimationFrame(tick);if(now-last<48||document.hidden)return;last=now;const mpp=156543.03392*Math.cos(map.getCenter().lat*Math.PI/180)/2**map.getZoom();map.getSource('traffic')?.setData(trafficFrame(tracks,(now-start)/1000,mpp,options));}
 function stop(){cancelAnimationFrame(frame);tracks=[];map.getSource('traffic')?.setData({type:'FeatureCollection',features:[]});}
 return {start(features,profile={}){stop();options=profile;if(reducedMotion)return;tracks=buildTracks(features);start=performance.now();frame=requestAnimationFrame(tick);},stop};
}
