import {inStructureGroup} from './layers.js';
import {movementKey,rampLabel,midpoint} from './connections.js';
const distance=(a,b)=>Math.hypot((b[0]-a[0])*.925,b[1]-a[1])*111195;
const node=c=>c.map(n=>n.toFixed(6)).join(',');
const length=cs=>cs.reduce((n,c,i)=>i?n+distance(cs[i-1],c):0,0);
const oriented=f=>f.properties.oneway==='-1'&&!f.properties.direction?{...f,geometry:{...f.geometry,coordinates:[...f.geometry.coordinates].reverse()}}:f;
export function cumulativeGroup(properties,groups,target){
 if(!target||target.id==='all')return true;const end=groups.findIndex(g=>g.id===target.id);
 return groups.slice(1,end+1).some(g=>inStructureGroup(properties,g));
}
export function directedPaths(features){
 const edges=features.map(oriented).map((f,i)=>({f,i,a:node(f.geometry.coordinates[0]),b:node(f.geometry.coordinates.at(-1)),length:length(f.geometry.coordinates)}));
 const bins=new Map();
 for(const e of edges){const p=e.f.properties,key=p.role==='ramp'?movementKey(p):`${p.route??''}:${p.level??''}:${p.deck??''}:${p.roadName||p.name||''}`;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(e);}
 const paths=[];
 for(const bin of bins.values()){
  const outgoing=new Map(),incoming=new Map(),used=new Set();
  for(const e of bin){if(!outgoing.has(e.a))outgoing.set(e.a,[]);outgoing.get(e.a).push(e);if(!incoming.has(e.b))incoming.set(e.b,[]);incoming.get(e.b).push(e);}
  function walk(first){const chain=[];let e=first;
   while(e&&!used.has(e.i)){used.add(e.i);chain.push(e);const next=outgoing.get(e.b)||[];e=next.length===1&&(incoming.get(e.b)||[]).length===1?next[0]:null;}
   const coords=chain.flatMap((e,i)=>i?e.f.geometry.coordinates.slice(1):e.f.geometry.coordinates),total=chain.reduce((n,e)=>n+e.length,0);
   if(total>0)paths.push({edges:chain,coords,length:total,properties:first.f.properties,anchor:midpoint(coords)});
  }
  bin.filter(e=>(incoming.get(e.a)||[]).length!==1||(outgoing.get(e.a)||[]).length!==1).forEach(e=>{if(!used.has(e.i))walk(e);});
  bin.forEach(e=>{if(!used.has(e.i))walk(e);});
 }return paths.sort((a,b)=>b.length-a.length);
}
function direction(path){const a=path.coords[0],b=path.coords.at(-1),x=(b[0]-a[0])*.925,y=b[1]-a[1],d=Math.hypot(x,y)||1;return [x/d,y/d];}
function mirrored(a,b){const x=direction(a),y=direction(b),ratio=a.length/b.length;return ratio>.35&&ratio<2.8&&x[0]*y[0]+x[1]*y[1]<-.55;}
export function pathBatches(paths,{main=false}={}){
 const remaining=[...paths],batches=[];
 while(remaining.length){const first=remaining.shift(),batch=[first];
  let i=remaining.findIndex(p=>(main?p.properties.route===first.properties.route:true)&&mirrored(first,p));
  if(i>=0)batch.push(remaining.splice(i,1)[0]);
  const capacity=main?2:remaining.length>12?4:remaining.length>4?3:2;
  while(batch.length<capacity&&remaining.length){
   i=remaining.findIndex(p=>main?p.properties.route===first.properties.route:(p.length<Math.max(450,first.length*1.4)));
   if(i<0)break;batch.push(remaining.splice(i,1)[0]);
  }batches.push(batch);
 }return batches;
}
export function structurePlan(facility,features,groups,{target='all'}={}){
 const stages=[];let order=0;
 for(let i=1;i<groups.length;i++){
  if(target!=='all'&&groups[i].id!==target)continue;
  const batches=pathBatches(directedPaths(features.filter(f=>inStructureGroup(f.properties,groups[i]))),{main:groups[i].id==='main'||groups[i].id==='upper'});
  batches.forEach((paths,j)=>{const early=order++<2;stages.push({group:groups[i],groupIndex:i,lastInGroup:j===batches.length-1,paths,label:groups[i].label,title:paths.map(p=>p.properties.role==='ramp'?rampLabel(p.properties):`${p.properties.route?`${p.properties.route} 號 · `:''}${p.properties.roadName||facility.name} · ${p.properties.direction||''}`).filter((v,i,a)=>a.indexOf(v)===i).join(' ／ '),duration:early?1800:Math.max(620,1100-order*22),hold:early?650:360});});
 }return stages;
}
export function historyPlan(features,history){
 const pools=history.chapters.map(c=>({...c,features:[]})),unknown=[];
 for(const f of features){const y=f.properties.openingYear,p=pools.find(c=>y&&y<=c.until);if(p)p.features.push(f);else unknown.push(f);}
 const stages=pools.filter(c=>c.features.length).map((c,i)=>({label:c.label,title:c.title,paths:directedPaths(c.features),duration:Math.max(650,3100-i*230),hold:Math.max(200,650-i*40),historical:true,sourceNote:history.note}));
 if(unknown.length)stages.push({label:'現今路網',title:'補全其餘道路與建造中路段',paths:directedPaths(unknown),duration:1600,hold:700,historical:true,sourceNote:'未核定年代路段不指定通車年份；虛線仍表示資料中的建造中路段。'});
 return stages;
}
export function partialFeature(feature,progress){
 if(progress>=1)return feature;if(progress<=0)return null;
 const cs=feature.geometry.coordinates,total=length(cs),target=total*progress,coords=[cs[0]];let walked=0;
 for(let i=1;i<cs.length;i++){const d=distance(cs[i-1],cs[i]);if(walked+d<target){coords.push(cs[i]);walked+=d;continue;}const t=Math.min(1,Math.max(0,(target-walked)/(d||1)));coords.push(cs[i-1].map((v,j)=>v+(cs[i][j]-v)*t));break;}
 if(coords.length<2)return null;const p=feature.properties;
 return {...feature,properties:{...p,rampEnd:p.rampStart!==undefined?p.rampStart+((p.rampEnd??1)-p.rampStart)*progress:p.rampEnd},geometry:{type:'LineString',coordinates:coords}};
}
export function pathFrame(path,progress){
 const out=[];let remaining=path.length*Math.max(0,Math.min(1,progress));
 for(const e of path.edges){if(remaining<=0)break;const f=partialFeature(e.f,Math.min(1,remaining/(e.length||1)));if(f)out.push(f);remaining-=e.length;}return out;
}
// A single interruptible clock. Frames update only the current batch (1–4 structure paths).
export function createGrowthPlayer({onStage,onFrame,onCommit,onDone}){
 let raf=0,run=null,last=0;
 function tick(now){
  if(!run)return;raf=requestAnimationFrame(tick);const dt=Math.min(100,now-last);last=now;if(document.hidden)return;
  run.elapsed+=dt;const s=run.stages[run.index];if(!s){finish();return;}
  if(!run.announced){run.announced=true;onStage(s,run.index,run.stages.length);}
  const p=Math.min(1,run.elapsed/s.duration),eased=1-(1-p)**1.2;
  if(now-run.frameAt>=48){run.frameAt=now;onFrame(s,s.paths.flatMap((path,i)=>pathFrame(path,s.historical?Math.max(0,Math.min(1,(eased-(i%7)*.035)/.79)):eased)),p,Math.max(0,(run.elapsed-s.duration)/s.hold));}
  if(run.elapsed>=s.duration+s.hold){onCommit(s);run.index++;run.elapsed=0;run.announced=false;if(run.index>=run.stages.length)finish();}
 }
 function finish(){cancelAnimationFrame(raf);const done=run;run=null;if(done)onDone();}
 return {play(stages){cancelAnimationFrame(raf);run={stages,index:0,elapsed:0,announced:false,frameAt:0};last=performance.now();if(!stages.length){finish();return;}raf=requestAnimationFrame(tick);},cancel(){cancelAnimationFrame(raf);run=null;},skip(){finish();},get active(){return Boolean(run);}};
}
