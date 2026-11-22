import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {structureGroups,inStructureGroup,automaticStructure,visibleFacility,blocksStructureDiscovery} from '../dist/layers.js';
import {MAP_LIMITS,pickRoad} from '../dist/interaction.js';
const read=f=>JSON.parse(fs.readFileSync(new URL('../dist/data/'+f,import.meta.url)));
const structures=read('structures.json').structures,features=read('interchanges.geojson').features,decks=read('bridge-decks.geojson').features;
test('Every interchange partitions into 2–4 non-overlapping structural groups, plus overview',()=>{
 assert.equal(structures.filter(s=>s.kind==='interchange').length,6);
 for(const s of structures.filter(s=>s.kind==='interchange')){
  const fs=features.filter(f=>f.properties.structure===s.id),groups=structureGroups(s,fs);assert.equal(groups[0].id,'all');assert.ok(groups.length>=3&&groups.length<=5);
  for(const f of fs)assert.equal(groups.slice(1).filter(g=>inStructureGroup(f.properties,g)).length,1,`${s.name} ${f.properties.osmId}`);
  for(const g of groups)assert.ok(fs.some(f=>inStructureGroup(f.properties,g)),`${s.name} ${g.label}`);
 }
});
test('Complex bridge decks preserve real upper/lower roads and mark standby roads conditional',()=>{
 for(const id of ['1','2']){
  const s=structures.find(s=>s.id===id),fs=decks.filter(f=>f.properties.structure===id),groups=structureGroups(s,fs);
  assert.deepEqual(groups.map(g=>g.id),['all','upper','lower']);assert.ok(s.deckNote.includes('備用'));
  assert.ok(fs.filter(f=>inStructureGroup(f.properties,groups[1])).every(f=>f.properties.status==='mapped'));
  assert.ok(fs.filter(f=>inStructureGroup(f.properties,groups[2])).every(f=>f.properties.status==='conditional'));
  assert.ok(fs.every(f=>Number.isInteger(f.properties.osmId)));
 }
});
const site={id:'23',routes:[3,8],x:500,y:430,span:300},vp={zoom:14.3,width:1000,height:800};
test('Close-up structure discovery respects selected route and releases on zoom out',()=>{
 assert.equal(automaticStructure([site],vp),'23');assert.equal(automaticStructure([site],{...vp,route:1}),null);
 assert.equal(automaticStructure([site],{...vp,route:8}),'23');assert.equal(automaticStructure([site],{...vp,zoom:13}),null);
 assert.equal(automaticStructure([site],{...vp,zoom:13.6,current:'23'}),'23');
 assert.equal(automaticStructure([site],{...vp,zoom:13.2,current:'23'}),null);
 assert.equal(automaticStructure([{...site,x:-20}],vp),null);assert.equal(automaticStructure([site],{...vp,blocked:true}),null);
});
test('A route scene cannot expose another route’s facility entry',()=>{
 const tunnel=structures.find(s=>s.id==='14');assert.equal(visibleFacility(tunnel,{view:'route',route:8}),false);
 assert.equal(visibleFacility(tunnel,{view:'route',route:2}),true);assert.equal(visibleFacility(tunnel,{view:'overview'}),true);
});
test('Road selection uses the nearest physical line, with a narrow tie preference for the active route',()=>{
 const f=(route,y)=>({properties:{route},geometry:{coordinates:[[0,y],[100,y]]}}),project=([x,y])=>({x,y});
 assert.equal(pickRoad([f(3,0),f(8,20)],{x:50,y:19},project,{route:3}),8);
 assert.equal(pickRoad([f(3,0),f(8,2)],{x:50,y:2},project,{route:3}),3);
 assert.equal(pickRoad([f(3,0)],{x:50,y:20},project),null);
});
test('Map bounds cover the network and rotation/tilt are disabled by policy',()=>{
 assert.equal(MAP_LIMITS.dragRotate,false);assert.equal(MAP_LIMITS.touchPitch,false);assert.equal(MAP_LIMITS.maxPitch,0);assert.ok(MAP_LIMITS.minZoom>=9);
 const [[xmin,ymin],[xmax,ymax]]=MAP_LIMITS.maxBounds;
 assert.ok(read('routes.geojson').features.every(f=>f.geometry.coordinates.every(([x,y])=>x>=xmin&&x<=xmax&&y>=ymin&&y<=ymax)));
});

test('A hidden expanded panel cannot block close-up discovery in overview',()=>{assert.equal(blocksStructureDiscovery({view:'overview',panelExpanded:true}),false);assert.equal(blocksStructureDiscovery({view:'route',panelExpanded:true}),true);assert.equal(blocksStructureDiscovery({view:'overview',searchOpen:true}),true);});
