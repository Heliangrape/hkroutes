export const MAP_BOUNDS=[[113.72,22.08],[114.5,22.67]];
export const MAP_LIMITS={minZoom:9,maxZoom:18,maxBounds:MAP_BOUNDS,dragRotate:false,touchPitch:false,pitchWithRotate:false,maxPitch:0,bearing:0,pitch:0,clickTolerance:6};
export function distanceToLine(point,coordinates,project){
 let best=Infinity;for(let i=1;i<coordinates.length;i++){
  const a=project(coordinates[i-1]),b=project(coordinates[i]),dx=b.x-a.x,dy=b.y-a.y;
  const t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy||1)));
  best=Math.min(best,Math.hypot(point.x-a.x-t*dx,point.y-a.y-t*dy));
 }return best;
}
export function pickRoad(features,point,project,{route=null,tolerance=12}={}){
 const rows=features.map(f=>({id:Number(f.properties.route),distance:distanceToLine(point,f.geometry.coordinates,project)})).filter(r=>r.distance<=tolerance).sort((a,b)=>a.distance-b.distance);
 if(!rows.length)return null;return rows.find(r=>r.id===route&&r.distance<=rows[0].distance+2)?.id||rows[0].id;
}
