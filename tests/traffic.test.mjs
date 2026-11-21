import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {facilityFeatures,buildTracks,trafficFrame} from '../dist/traffic.js';
const features=JSON.parse(fs.readFileSync(new URL('../dist/data/routes.geojson',import.meta.url))).features;
const structures=JSON.parse(fs.readFileSync(new URL('../dist/data/structures.json',import.meta.url))).structures;
for(const s of structures)test(`${s.name} has its own drawable geometry and traffic tracks`,()=>{
 const own=facilityFeatures(features,s);assert.ok(own.length>0);assert.ok(own.every(f=>s.routes.includes(f.properties.route)));
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
