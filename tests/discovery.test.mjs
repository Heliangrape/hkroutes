import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mapDetailLevel,searchEntries} from '../dist/discovery.js';
import {buildTracks,trafficFrame} from '../dist/traffic.js';
const read=f=>JSON.parse(fs.readFileSync(new URL('../dist/data/'+f,import.meta.url)));
const routes=read('routes.json').routes,structures=read('structures.json').structures,roads=read('routes.geojson').features;
test('One search finds roads, facilities, route parents and simplified Chinese names',()=>{
 assert.equal(searchEntries('青马',routes,structures)[0].name,'青馬大橋');
 assert.ok(searchEntries('桥',routes,structures).some(r=>r.name==='青馬大橋'));
 assert.ok(searchEntries('8号',routes,structures).some(r=>r.type==='route'&&r.id===8));
 assert.ok(searchEntries('8号',routes,structures).some(r=>r.type==='structure'&&r.id==='23'));
 assert.equal(searchEntries('不存在的地點XYZ',routes,structures).length,0);
});
test('Overview traffic represents every mapped route, retains route colours and respects a total particle budget',()=>{
 const tracks=buildTracks(roads),mapped=new Set(roads.filter(f=>f.properties.status!=='construction').map(f=>f.properties.route));
 assert.deepEqual(new Set(tracks.map(t=>t.route)),mapped);
 const colors=Object.fromEntries(routes.map(r=>[r.id,r.color]));
 const frame=trafficFrame(tracks,5,100,{prominence:.85,density:.65,speed:.65,colors});
 assert.ok(frame.features.length>0&&frame.features.length<=360);
 assert.ok(new Set(frame.features.map(f=>f.properties.color)).size>=8);
 assert.ok(frame.features.every(f=>Object.values(colors).includes(f.properties.color)));
});
test('Traffic cannot join different route numbers at a shared node',()=>{
 const f=(route,cs)=>({type:'Feature',properties:{route},geometry:{type:'LineString',coordinates:cs}});
 const tracks=buildTracks([f(3,[[114,22.3],[114.01,22.3]]),f(8,[[114.01,22.3],[114.02,22.3]])]);
 assert.equal(tracks.length,2);assert.deepEqual(new Set(tracks.map(t=>t.route)),new Set([3,8]));
});
