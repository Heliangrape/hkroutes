import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openRoute,openDetail,emptyMap,sceneHash,parseScene} from '../dist/scene.js';
import {colorConnections,movementKey} from '../dist/connections.js';
const routes=JSON.parse(fs.readFileSync(new URL('../dist/data/routes.json',import.meta.url))).routes;
const structures=JSON.parse(fs.readFileSync(new URL('../dist/data/structures.json',import.meta.url))).structures;
const all=JSON.parse(fs.readFileSync(new URL('../dist/data/interchanges.geojson',import.meta.url))).features;
const initial=parseScene('',routes,structures);
test('Blank space returns to overview and never reopens a hidden selection',()=>{
 assert.equal(initial.view,'overview');assert.equal(emptyMap(initial),initial);
 const r=openRoute(initial,8),o=emptyMap(r);assert.equal(o.view,'overview');assert.equal(o.route,null);
 assert.equal(emptyMap(o),o);
});
test('A shared interchange returns to the route from which this visit started',()=>{
 const facility=structures.find(s=>s.id==='23');
 for(const id of [3,8]){
  const d=openDetail(openRoute(initial,id),facility);assert.equal(d.view,'detail');assert.equal(d.structure,'23');
  assert.equal(emptyMap(d).route,id);assert.equal(emptyMap(d).view,'route');
  const parsed=parseScene(sceneHash(d),routes,structures);assert.equal(parsed.structure,'23');assert.equal(parsed.route,id);
 }
 assert.deepEqual(facility.routes,[3,8]);
});
test('A direct facility visit returns to overview; invalid or unrelated parent routes are ignored',()=>{
 assert.equal(emptyMap(openDetail(initial,structures[0])).view,'overview');
 assert.equal(parseScene('#structure=23&route=1',routes,structures).route,null);
 assert.equal(parseScene('#mode=structures&structure=23',routes,structures).view,'detail');
 assert.equal(parseScene('#route=999',routes,structures).view,'overview');
});
test('Interchange mainlines retain their own route colours, and connecting ramps blend between routes',()=>{
 const colors=new Map(routes.map(r=>[r.id,r.color]));
 for(const sid of ['22','23','24']){
  const fs=all.filter(f=>f.properties.structure===sid),colored=colorConnections(fs);
  for(const f of colored){const p=f.properties;assert.match(p.lineColor,/^#[a-f0-9]{6}$/i);if(p.role==='mainline'&&colors.has(p.route))assert.equal(p.lineColor,colors.get(p.route));}
  const connector=fs.find(f=>f.properties.role==='ramp'&&f.properties.fromRoutes.length===1&&f.properties.toRoutes.length===1&&f.properties.fromRoutes[0]!==f.properties.toRoutes[0]);
  assert.ok(connector,`Route-to-route connector at ${sid}`);
  const parts=colorConnections([connector]);assert.ok(new Set(parts.map(f=>f.properties.lineColor)).size>5);
  assert.equal(parts[0].properties.startColor,colors.get(connector.properties.fromRoutes[0]));
  assert.equal(parts[0].properties.endColor,colors.get(connector.properties.toRoutes[0]));
  assert.deepEqual(parts[0].geometry.coordinates[0],connector.geometry.coordinates[0]);
  assert.deepEqual(parts.at(-1).geometry.coordinates.at(-1),connector.geometry.coordinates.at(-1));
  for(let i=1;i<parts.length;i++)assert.deepEqual(parts[i-1].geometry.coordinates.at(-1),parts[i].geometry.coordinates[0]);
  assert.equal(new Set(parts.map(f=>f.properties.movement)).size,1);
 }
});
test('Ramp metadata distinguishes local roads and retains OSM direction, identity and uncertainty',()=>{
 const ramp=all.filter(f=>f.properties.role==='ramp');assert.ok(ramp.some(f=>!f.properties.fromRoutes.length||!f.properties.toRoutes.length));
 for(const f of ramp){const p=f.properties;assert.ok(p.direction);assert.ok(p.fromName);assert.ok(p.toName);assert.equal(typeof p.connectionConfirmed,'boolean');assert.match(movementKey(p),/^2[2-7]:\d+$/);}
});
test('One physical ramp movement retains all of its split way segments',()=>{
 const groups=new Map();
 for(const f of all.filter(f=>f.properties.role==='ramp')){
  const key=movementKey(f.properties);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(f);
 }
 const split=[...groups.values()].filter(fs=>new Set(fs.map(f=>f.properties.osmId)).size>1);
 assert.ok(split.length>=6);
 for(const fs of split){
  assert.equal(new Set(fs.map(f=>f.properties.structure)).size,1);
  assert.equal(new Set(fs.map(f=>JSON.stringify([f.properties.fromRoutes,f.properties.toRoutes]))).size,1);
  const colored=colorConnections(fs);assert.equal(new Set(colored.map(f=>f.properties.movement)).size,1);
 }
});
