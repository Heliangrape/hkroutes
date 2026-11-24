import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {partialFeature,directedPaths,pathFrame,cumulativeGroup,structurePlan,historyPlan} from '../dist/growth.js';
import {structureGroups} from '../dist/layers.js';
const read=n=>JSON.parse(fs.readFileSync(new URL('../dist/data/'+n,import.meta.url)));
test('A directed path grows continuously across split ways and keeps its final geometry',()=>{
 const f=(a,b)=>({type:'Feature',properties:{route:3,name:'main'},geometry:{type:'LineString',coordinates:[a,b]}});
 const a=f([114,22],[114.01,22]),b=f([114.01,22],[114.02,22]);
 const path=directedPaths([a,b])[0];assert.equal(path.edges.length,2);assert.equal(pathFrame(path,0).length,0);
 const halfway=pathFrame(path,.75);assert.equal(halfway.length,2);assert.deepEqual(halfway[0].geometry.coordinates,a.geometry.coordinates);
 assert.ok(Math.abs(halfway[1].geometry.coordinates.at(-1)[0]-114.015)<1e-9);
 assert.deepEqual(pathFrame(path,1).map(f=>f.geometry.coordinates),[a.geometry.coordinates,b.geometry.coordinates]);
 const ramp={...a,properties:{rampStart:.2,rampEnd:.8}};assert.ok(Math.abs(partialFeature(ramp,.5).properties.rampEnd-.5)<1e-9);
});
test('Structure stages cover each physical feature once in batches of at most four, and layer choices accumulate',()=>{
 const all=read('interchanges.geojson').features;
 for(const s of read('structures.json').structures.filter(s=>s.kind==='interchange')){
  const fs=all.filter(f=>f.properties.structure===s.id).map((f,i)=>({...f,properties:{...f.properties,testId:i}})),groups=structureGroups(s,fs),plan=structurePlan(s,fs,groups);
  const ids=plan.flatMap(s=>s.paths.flatMap(p=>p.edges.map(e=>e.f.properties.testId)));assert.equal(ids.length,fs.length);assert.equal(new Set(ids).size,fs.length);
  assert.ok(plan.every(s=>s.paths.length>=1&&s.paths.length<=4));
  let previous=new Set();for(const g of groups.slice(1)){const current=new Set(fs.filter(f=>cumulativeGroup(f.properties,groups,g)));for(const f of previous)assert.ok(current.has(f));previous=current;}assert.equal(previous.size,fs.length);
 }
});
test('The history sequence neither omits roads nor assigns construction or undated roads to a dated era',()=>{
 const fs=read('routes.geojson').features.map((f,i)=>({...f,properties:{...f.properties,testId:i}})),plan=historyPlan(fs,read('history.json'));
 const ids=plan.flatMap(s=>s.paths.flatMap(p=>p.edges.map(e=>e.f.properties.testId)));assert.equal(ids.length,fs.length);assert.equal(new Set(ids).size,fs.length);
 const finalIds=new Set(plan.at(-1).paths.flatMap(p=>p.edges.map(e=>e.f.properties.testId)));
 for(const f of fs)if(!f.properties.openingYear||f.properties.status==='construction')assert.ok(finalIds.has(f.properties.testId));
 assert.ok(plan[0].duration>plan.at(-2).duration);
});
