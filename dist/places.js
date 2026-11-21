// Quiet, non-interactive geographical context; collision rules keep narrow maps uncluttered.
export function createPlaceLabels(map,places,getContext){
 const labels=places.map(place=>{
  const el=document.createElement('div');el.className=`place-label context-label context-${place.kind}`;el.textContent=place.name;
  new maplibregl.Marker({element:el,offset:[0,9]}).setLngLat(place.coordinates).addTo(map);
  el.setAttribute('aria-hidden','true');el.setAttribute('role','presentation');el.tabIndex=-1;
  return {place,el};
 });
 function refresh(){
  const state=getContext(),focus=state.view==='focus'&&state.mode==='routes';
  const candidates=labels.filter(({place})=>focus?place.routes.includes(state.route):state.view==='browse'&&place.browse);
  const selected=new Set(candidates);for(const label of labels)if(!selected.has(label))label.el.hidden=true;
  const rectangles=[],width=map.getContainer().clientWidth,height=map.getContainer().clientHeight-(state.blockedBottom||0);
  const rank={area:4,water:3,land:2,region:1};
  candidates.sort((a,b)=>rank[b.place.kind]-rank[a.place.kind]).forEach(({place,el})=>{
   const p=map.project(place.coordinates),w=place.name.length*12+18,h=25;
   const r={left:p.x-w/2,right:p.x+w/2,top:p.y-h/2+9,bottom:p.y+h/2+9};
   const outside=r.left<6||r.right>width-6||r.top<18||r.bottom>height-8;
   const overlap=rectangles.some(a=>r.left<a.right+11&&r.right>a.left-11&&r.top<a.bottom+10&&r.bottom>a.top-10);
   el.hidden=outside||overlap;if(!el.hidden)rectangles.push(r);
  });
 }
 map.on('move',refresh);map.on('resize',refresh);refresh();return {refresh};
}
