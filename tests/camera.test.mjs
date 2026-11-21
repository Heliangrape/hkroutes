import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fitZoom} from '../dist/camera.js';
const data=JSON.parse(fs.readFileSync(new URL('../dist/data/routes.geojson',import.meta.url)));
const project=([x,y])=>[(x+180)/360,(1-Math.log(Math.tan(Math.PI/4+y*Math.PI/360))/Math.PI)/2];
for(const width of [320,390,600,1000])for(const id of [1,5,8,9,null]){
 test(`Route ${id??'overview'} fits collapsed map at ${width}px`,()=>{
  const coords=data.features.filter(f=>!id||f.properties.route===id).flatMap(f=>f.geometry.coordinates);
  const height=783,p={top:72,bottom:150,left:25,right:25},c=fitZoom(coords,width,height,p),center=project(c.center),scale=512*2**c.zoom;
  const horizontal=(width-p.left-p.right)/2,vertical=(height-p.top-p.bottom)/2;
  for(const coord of coords){const [x,y]=project(coord);assert.ok(Math.abs(x-center[0])*scale<=horizontal+.01);assert.ok(Math.abs(y-center[1])*scale<=vertical+.01);}
 });
}
test('Bridge and tunnel entries all have photo, source and typed measurements',()=>{
 const {structures}=JSON.parse(fs.readFileSync(new URL('../dist/data/structures.json',import.meta.url)));
 assert.equal(structures.length,21);assert.equal(structures.filter(s=>s.kind==='bridge').length,5);assert.equal(structures.filter(s=>s.kind==='tunnel').length,16);
 for(const s of structures){assert.ok(s.metrics.length>=3);assert.ok(s.routes.length>0);assert.ok(s.summary.length>15);assert.match(s.source,/^https:\/\//);assert.ok(fs.statSync(new URL('../dist/'+s.image,import.meta.url)).size>1000);}
});
