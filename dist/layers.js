// Structural groups partition real road features. OSM level is relative, not elevation in metres.
export function structureGroups(facility,features){
 if(!facility)return [];
 if(facility.kind==='bridge'&&features.some(f=>f.properties.deck))return [{id:'all',label:'總覽'},{id:'upper',label:'上層主橋'},{id:'lower',label:'下層備用'}];
 if(facility.kind!=='interchange')return [];
 const levels=[...new Set(features.filter(f=>f.properties.role==='ramp').map(f=>f.properties.level))].sort((a,b)=>a-b);
 const count=levels.length>=4&&features.filter(f=>f.properties.role==='ramp').length>=70?3:levels.length>=2?2:1;
 const groups=[{id:'all',label:'總覽'},{id:'main',label:'主幹道'}];
 for(let i=0;i<count;i++){
  const values=levels.filter((_,j)=>Math.min(count-1,Math.floor(j*count/levels.length))===i);
  groups.push({id:'ramp-'+i,label:count===1?'轉接匝道':count===2?(i===0?'低層匝道':'高層匝道'):['低層匝道','中層匝道','高層匝道'][i],levels:values});
 }return groups;
}
export function inStructureGroup(properties,group){
 if(!group||group.id==='all')return true;
 if(group.id==='main')return properties.role!=='ramp';
 if(group.id==='upper'||group.id==='lower')return properties.deck===group.id;
 return properties.role==='ramp'&&group.levels.includes(properties.level);
}
export function automaticStructure(candidates,{zoom,width,height,top=90,bottom=0,current=null,route=null,blocked=false}){
 if(blocked)return null;
 const cy=(top+height-bottom)/2,cx=width/2;
 const eligible=candidates.filter(c=>(!route||c.routes.includes(route))&&zoom>=(c.id===current?13.25:14)&&c.x>12&&c.x<width-12&&c.y>top&&c.y<height-bottom-15&&c.span>=(c.id===current?70:110)).map(c=>({...c,score:Math.hypot((c.x-cx)/Math.max(80,width*.42),(c.y-cy)/Math.max(80,(height-top-bottom)*.4))-(c.id===current?.15:0)})).filter(c=>c.score<1);
 eligible.sort((a,b)=>a.score-b.score);return eligible[0]?.id||null;
}
export function visibleFacility(facility,{view,route}){return view==='overview'||view==='route'&&facility.routes.includes(route);}
