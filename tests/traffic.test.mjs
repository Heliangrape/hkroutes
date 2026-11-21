import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {facilityFeatures,buildTracks,trafficFrame} from '../dist/traffic.js';
const features=JSON.parse(fs.readFileSync(new URL('../dist/data/routes.geojson',import.meta.url))).features;
const interchanges=JSON.parse(fs.readFileSync(new URL('../dist/data/interchanges.geojson',import.meta.url))).features;
const structures=JSON.parse(fs.readFileSync(new URL('../dist/data/structures.json',import.meta.url))).structures;
for(const s of structures)test(`${s.name} has its own drawable geometry and traffic tracks`,()=>{
 const own=facilityFeatures(features,s,interchanges);assert.ok(own.length>0);assert.ok(own.every(f=>s.kind==='interchange'?f.properties.structure===s.id:s.routes.includes(f.properties.route)));
 const typed=own.some(f=>f.properties[s.kind==='bridge'?'bridge':'tunnel']);if(typed)assert.ok(own.every(f=>f.properties[s.kind==='bridge'?'bridge':'tunnel']));
 const tracks=buildTracks(own);assert.ok(tracks.length>0);assert.ok(tracks.every(t=>t.length>65));
});
test('Traffic merges connected segments without crossing physical gaps',()=>{
 const f=coords=>({type:'Feature',properties:{status:'mapped'},geometry:{type:'LineString',coordinates:coords}});
 const tracks=buildTracks([f([[114,22.3],[114.01,22.3]]),f([[114.01,22.3],[114.02,22.3]]),f([[114.1,22.3],[114.11,22.3]])]);
 assert.equal(tracks.length,2);assert.ok(tracks.every(t=>t.length<2500));
});
test('Construction segments never carry animated traffic',()=>{
 const tracks=buildTracks([{type:'Feature',properties:{status:'construction'},geometry:{type:'LineString',coordinates:[[114,22],[114.1,22]]}}]);assert.equal(tracks.length,0);
});
test('Vehicle streaks move along finite road coordinates with a bounded draw cost',()=>{
 const tracks=buildTracks(features.filter(f=>f.properties.route===9));
 const a=trafficFrame(tracks,1,70),b=trafficFrame(tracks,3,70);assert.ok(a.features.length>0);assert.ok(a.features.length<=360);assert.notDeepEqual(a,b);
 for(const f of a.features){assert.ok(f.geometry.coordinates.length>=2);assert.ok(f.geometry.coordinates.every(c=>c.every(Number.isFinite)));assert.ok(f.properties.alpha>0&&f.properties.alpha<=1);}
});

test('Interchanges include clipped ramps and multiple vertical levels',()=>{
 for(const s of structures.filter(s=>s.kind==='interchange')){
  const fs=facilityFeatures(features,s,interchanges),levels=new Set(fs.map(f=>f.properties.level));
  assert.ok(fs.some(f=>f.properties.role==='ramp'));assert.ok(fs.some(f=>f.properties.role==='mainline'));assert.ok(levels.size>=3);
  const [xmin,ymin,xmax,ymax]=s.bbox;
  assert.ok(fs.every(f=>f.geometry.coordinates.every(([x,y])=>x>=xmin-.0000001&&x<=xmax+.0000001&&y>=ymin-.0000001&&y<=ymax+.0000001)));
 }
});
test('Route prominence lengthens traffic tails while keeping draw cost bounded',()=>{
 const tracks=buildTracks(features.filter(f=>f.properties.route===8));const quiet=trafficFrame(tracks,5,60),boost=trafficFrame(tracks,5,60,{prominence:1.35});
 assert.notDeepEqual(quiet,boost);assert.ok(boost.features.length>0&&boost.features.length<=360);
 const length=f=>{const c=f.geometry.coordinates;return Math.hypot(c.at(-1)[0]-c[0][0],c.at(-1)[1]-c[0][1]);};
 assert.ok(Math.max(...boost.features.map(length))>Math.max(...quiet.features.map(length)));
});
test('Every route has quiet area labels and major geographical context',()=>{
 const {places}=JSON.parse(fs.readFileSync(new URL('../dist/data/places.json',import.meta.url)));
 for(let id=1;id<=10;id++){assert.ok(places.filter(p=>p.routes.includes(id)&&p.kind==='area').length>=3);assert.ok(places.some(p=>p.routes.includes(id)&&p.kind!=='area'));}
 assert.ok(places.every(p=>p.coordinates[0]>113.8&&p.coordinates[0]<114.4&&p.coordinates[1]>22.1&&p.coordinates[1]<22.6));
});
