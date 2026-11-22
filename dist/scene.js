// One continuous map hierarchy. Context belongs to the visit, never to a facility record.
export function openRoute(scene,id){return {...scene,view:'route',route:id,structure:null,lastRoute:id,movement:null};}
export function openDetail(scene,facility){const context=facility.routes.includes(scene.route)?scene.route:null;return {...scene,view:'detail',route:context,structure:facility.id,movement:null};}
export function emptyMap(scene){
 if(scene.view==='detail')return scene.route?openRoute(scene,scene.route):{...scene,view:'overview',structure:null,movement:null};
 if(scene.view==='route')return {...scene,view:'overview',route:null,structure:null,movement:null};
 return scene;
}
export function sceneHash(s){return s.view==='detail'?`#structure=${s.structure}${s.route?`&route=${s.route}`:''}`:s.view==='route'?`#route=${s.route}`:'#overview=1';}
export function parseScene(hash,routes,structures){
 const h=new URLSearchParams(hash.replace(/^#/,'')),id=Number(h.get('route')),f=structures.find(s=>s.id===h.get('structure'));
 const route=routes.some(r=>r.id===id)?id:null;
 return {view:f?'detail':route?'route':'overview',route:f?(f.routes.includes(route)?route:null):route,structure:f?.id||null,lastRoute:route,movement:null};
}
