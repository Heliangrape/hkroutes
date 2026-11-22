import {createSheet} from './sheet.js';
import {fitZoom} from './camera.js';
import {facilityFeatures,createTraffic} from './traffic.js';
import {createPlaceLabels} from './places.js';
import {openRoute,openDetail,emptyMap,sceneHash,parseScene} from './scene.js';
import {colorConnections,rampLabel,movementKey,midpoint} from './connections.js';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kinds={bridge:{name:'橋梁',color:'#6cbdf9'},tunnel:{name:'隧道',color:'#edb86b'},interchange:{name:'互通立交',color:'#c0ced8'}};
const state={routes:[],geo:null,structures:[],interchanges:{features:[]},places:[],view:'overview',route:null,structure:null,lastRoute:null,movement:null,ready:false};
let map,sheet,traffic,contextLabels,mapLabels,resizeFrame,toastTimer;
const cameras=new Map(),reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
const route=()=>state.routes.find(r=>r.id===state.route),structure=()=>state.structures.find(s=>s.id===state.structure);
const collection=features=>({type:'FeatureCollection',features});
const routeName=id=>`${id} 號幹線`;
function message(text,error=false){$('#map-message').textContent=text;$('#map-message').classList.toggle('error',error);$('#map-message').hidden=false;}
function toast(text){$('.toast')?.remove();clearTimeout(toastTimer);const el=document.createElement('div');el.className='toast';el.setAttribute('role','status');el.textContent=text;$('.map-stage').append(el);toastTimer=setTimeout(()=>el.remove(),3000);}
function padding(visible=sheet?.visibleHeight||0){return {top:0,bottom:state.view==='overview'?0:Math.min(visible+10,$('#map').clientHeight-1),left:0,right:0};}
function syncOcclusion(visible){if(map&&state.ready){map.jumpTo({padding:padding(visible)});contextLabels?.refresh();mapLabels?.refresh();}}
function navigate(center,zoom,animate=true){if(map&&state.ready){cameras.set(cameraKey(),{center,zoom});map.easeTo({center,zoom,padding:padding(),bearing:0,pitch:0,duration:animate&&!reduced?650:0});}}
function fit(id=null,animate=true){
 if(!state.ready)return;map.resize();
 const cs=state.geo.features.filter(f=>!id||f.properties.route===id).flatMap(f=>f.geometry.coordinates);
 const c=fitZoom(cs,$('#map').clientWidth,$('#map').clientHeight,{top:55,bottom:(id?sheet.peekHeight:0)+55,left:40,right:40,maxZoom:12.7});navigate(c.center,c.zoom,animate);
}
function fitFacility(animate=true){
 const s=structure();if(!state.ready||!s)return;map.resize();
 const cs=facilityFeatures(state.geo.features,s,state.interchanges.features).flatMap(f=>f.geometry.coordinates);
 if(!cs.length){navigate(s.coordinates,13.2,animate);return;}
 const narrow=$('#map').clientWidth<600;
 const c=fitZoom(cs,$('#map').clientWidth,$('#map').clientHeight,{top:80,bottom:sheet.peekHeight+80,left:narrow?55:150,right:narrow?55:150,maxZoom:s.kind==='interchange'?16:14.1});navigate(c.center,c.zoom,animate);
}
const cameraKey=()=>state.view==='detail'?`detail:${state.structure}`:state.view==='route'?`route:${state.route}`:'overview';
function remember(){if(!state.ready||map.isEasing()&&cameras.has(cameraKey()))return;cameras.set(cameraKey(),{center:map.getCenter().toArray(),zoom:map.getZoom()});}
function moveToScene({restore=false}={}){const c=restore&&cameras.get(cameraKey());if(c)navigate(c.center,c.zoom);else if(state.view==='detail')fitFacility();else fit(state.route);}
function transition(next,{restore=false}={}){remember();Object.assign(state,next);render();history.replaceState(null,'',location.pathname+location.search+sceneHash(state));moveToScene({restore});}
function selectRoute(id){if(state.view==='route'&&state.route===id)return;transition(openRoute(state,id),{restore:true});}
function selectStructure(id){const s=state.structures.find(s=>s.id===id);if(s)transition(openDetail(state,s),{restore:true});}
function back(){const next=emptyMap(state);if(next===state){toast('點選地圖上的幹線，開始探索');return;}transition(next,{restore:true});}
function routeLink(id){const r=state.routes.find(r=>r.id===id);return `<button class="text-route" data-route="${id}" style="--route:${r.color}">${id} 號幹線 <small>${esc(r.endpoints)}</small></button>`;}
function render(){
 document.body.dataset.view=state.view;
 const r=route(),s=structure();
 $('#focus-label').textContent=s?s.name:r?`${r.id} 號幹線 · ${r.endpoints}`:'幹線圖誌';
 $('#panel-eyebrow').textContent=s?'DETAIL / '+kinds[s.kind].name:'HONG KONG ROUTE ATLAS';
 $('#panel-title').textContent=s?s.name:r?`${r.id} 號幹線`:'沿著道路探索香港';
 if(s)renderStructure(s);else if(r)renderRoute(r);else $('#panel-content').innerHTML='';
 sheet.contextChanged();$('#panel-body').scrollTop=0;updateMap();
}
function renderRoute(r){
 const facilities=state.structures.filter(s=>s.routes.includes(r.id));
 $('#panel-content').innerHTML=`<div style="--route:${r.color}"><h2 class="detail-tagline">${esc(r.tagline)}</h2><p class="detail-endpoints">${esc(r.endpoints)}</p><p class="detail-description">${esc(r.description)}</p><h3 class="section-label">沿途，跨海與穿山</h3><div class="place-index">${facilities.map(s=>`<button data-structure="${s.id}"><span>${esc(s.name)}</span><small>${kinds[s.kind].name}</small></button>`).join('')}</div><h3 class="section-label">沿線地點</h3><div class="place-index">${r.nodes.map((n,i)=>`<button data-node="${i}"><span>${esc(n.name)}</span><small>${esc(n.kind)}</small></button>`).join('')}</div>${r.hasConstruction?'<p class="layer-note">虛線路段為資料標示建造中，通車安排以運輸署為準。</p>':''}<a class="detail-link" href="${r.source}" target="_blank" rel="noopener">運輸署路線圖</a></div>`;
}
function movementInfo(){
 const f=state.interchanges.features.find(f=>f.properties.structure===state.structure&&movementKey(f.properties)===state.movement);if(!f)return '';
 const p=f.properties;return `<h3>${esc(rampLabel(p))}</h3><p>${p.role==='ramp'?`${esc(p.fromName)}接${esc(p.toName)}`:esc(p.roadName)} · ${esc(p.direction)}${p.lanes?` · ${esc(p.lanes)} 車道`:''}</p>${p.destination?`<p>來源目的地標記：${esc(p.destination)}</p>`:''}<small>${p.connectionConfirmed?'依道路節點與單行方向連接':'連接資料未完整確認，僅供結構探索'}；非行車指引</small>`;
}
function renderStructure(s){
 const k=kinds[s.kind];
 $('#panel-content').innerHTML=`<div class="parent-routes"><span>同一節點 · 所屬幹線</span>${s.routes.map(routeLink).join('')}</div><p class="detail-description">${esc(s.summary)}</p><div id="movement-info" class="movement-info" ${state.movement?'':'hidden'}>${movementInfo()}</div>${s.kind==='interchange'?'<p class="layer-note">主線沿用幹線色；轉接匝道由來源色漸變至去向色，灰色端連接地區道路或未編號路段。點選任一匝道，查看連接用途。</p>':''}<figure class="photo"><img class="${s.kind==='interchange'?'structure-diagram':''}" src="./${s.image}" alt="${esc(s.imageCaption)}"><figcaption>${esc(s.imageCaption)}<br>圖片：<a href="${s.imageSource}" target="_blank" rel="noopener">${esc(s.imageCredit)}</a></figcaption></figure><dl class="metrics" style="--kind:${k.color}">${s.metrics.map(([label,value])=>`<div class="metric"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl><a class="detail-link" href="${s.source}" target="_blank" rel="noopener">查看資料來源</a>`;
}
function selectMovement(key){
 state.movement=state.movement===key?null:key;applyMovement();mapLabels?.rebuild();
 const fs=facilityFeatures(state.geo.features,structure(),state.interchanges.features);traffic.start(state.movement?fs.filter(f=>movementKey(f.properties)===state.movement):fs);
 const el=$('#movement-info');if(el){el.hidden=!state.movement;el.innerHTML=movementInfo();}
}
function applyMovement(){
 if(!map||!state.ready)return;
 for(let i=-2;i<=5;i++)map.setPaintProperty(`junction-deck-${i}`,'line-opacity',state.movement?['case',['==',['get','movement'],state.movement],1,.24]:1);
}
function updateMap(){
 if(!state.ready)return;
 const detail=state.view==='detail',focused=state.view==='route',r=route(),s=structure();
 const original=['match',['get','route'],...state.routes.flatMap(r=>[r.id,r.color]),'#87949f'];
 const selected=['==',['get','route'],state.route??-1];
 for(const layer of ['routes-line','routes-construction']){
  map.setPaintProperty(layer,'line-color',detail?'#45525d':focused?['case',selected,original,'#45525d']:original);
  map.setPaintProperty(layer,'line-opacity',detail?.14:focused?['case',selected,1,.16]:.72);
  map.setPaintProperty(layer,'line-width',['interpolate',['linear'],['zoom'],8,focused?['case',selected,2.2,1]:1.7,12,focused?['case',selected,4.2,1]:3,16,focused?['case',selected,7,1]:5]);
 }
 map.setPaintProperty('routes-casing','line-opacity',detail?.15:.6);
 map.setPaintProperty('scene-veil','fill-opacity',detail?.75:focused?.7:.48);
 // Our own DOM annotations stay readable without loading a crowded basemap label set.
 for(const l of map.getStyle().layers)if(l.type==='symbol')map.setLayoutProperty(l.id,'visibility','none');
 const features=s?facilityFeatures(state.geo.features,s,state.interchanges.features):[];
 map.getSource('facility').setData(collection(s?.kind==='interchange'?colorConnections(features):features));
 const color=s?kinds[s.kind].color:r?.color||'#87949f';
 map.setLayoutProperty('facility-line','visibility',s?.kind==='interchange'?'none':'visible');
 map.setPaintProperty('facility-glow','line-opacity',s?.kind==='interchange'?.05:.24);
 for(const layer of ['facility-line','facility-glow','traffic-glow'])map.setPaintProperty(layer,'line-color',color);
 map.setFilter('route-glow',focused?selected:['==',['get','route'],-1]);map.setPaintProperty('route-glow','line-color',color);
 map.setPaintProperty('traffic-head','line-width',focused?1.95:1.5);
 applyMovement();contextLabels?.refresh();mapLabels?.rebuild();
 if(focused||detail)traffic.start(s?features:state.geo.features.filter(f=>f.properties.route===state.route),{prominence:focused?1.35:1});else traffic.stop();
}
function addMapLayers(){
 map.addSource('scene',{type:'geojson',data:{type:'Feature',geometry:{type:'Polygon',coordinates:[[[-180,-85],[180,-85],[180,85],[-180,85],[-180,-85]]]}}});
 map.addLayer({id:'scene-veil',type:'fill',source:'scene',paint:{'fill-color':'#020710','fill-opacity':0}});
 map.addSource('hk-routes',{type:'geojson',data:state.geo});
 const width=['interpolate',['linear'],['zoom'],8,1.8,10,2.8,12,4.3,16,8];
 map.addLayer({id:'routes-casing',type:'line',source:'hk-routes',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#0b252b','line-width':['interpolate',['linear'],['zoom'],8,3.8,10,5,12,7,16,12]}});
 map.addLayer({id:'routes-line',type:'line',source:'hk-routes',filter:['!=',['get','status'],'construction'],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#687873','line-width':width,'line-opacity':1}});
 map.addLayer({id:'routes-construction',type:'line',source:'hk-routes',filter:['==',['get','status'],'construction'],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#687873','line-width':width,'line-dasharray':[2,2],'line-opacity':1}});
 map.addLayer({id:'routes-hit',type:'line',source:'hk-routes',paint:{'line-color':'#fff','line-width':18,'line-opacity':0}});
 map.addSource('facility',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
 map.addLayer({id:'route-glow',type:'line',source:'hk-routes',filter:['==',['get','route'],-1],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#7aafff','line-width':['interpolate',['linear'],['zoom'],9,10,14,24],'line-blur':8,'line-opacity':.18}},'routes-line');
 map.addLayer({id:'facility-glow',type:'line',source:'facility',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#6cbdf9','line-width':22,'line-blur':10,'line-opacity':.24}});
 map.addLayer({id:'facility-line',type:'line',source:'facility',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#6cbdf9','line-width':['interpolate',['linear'],['zoom'],10,4,14,7],'line-opacity':1}});

 for(let level=-2;level<=5;level++){
  const filter=['all',['has','interchange'],['==',['get','level'],level]];
  const ramp=['==',['get','role'],'ramp'];
  map.addLayer({id:`junction-shadow-${level}`,type:'line',source:'facility',filter,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#050d15','line-width':['interpolate',['linear'],['zoom'],12,['case',ramp,6,8],16,['case',ramp,8,11]],'line-opacity':1}});
  map.addLayer({id:`junction-deck-${level}`,type:'line',source:'facility',filter,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':['coalesce',['get','lineColor'],'#87949f'],'line-width':['interpolate',['linear'],['zoom'],12,['case',ramp,1.8,2.8],16,['case',ramp,2.8,4.2]],'line-opacity':1}});
 }
 map.addLayer({id:'facility-hit',type:'line',source:'facility',paint:{'line-color':'#fff','line-width':20,'line-opacity':0}});
 map.addSource('traffic',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
 map.addLayer({id:'traffic-glow',type:'line',source:'traffic',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#7aafff','line-width':6,'line-blur':3,'line-opacity':['*',['get','alpha'],.55]}});
 map.addLayer({id:'traffic-head',type:'line',source:'traffic',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#f4fcff','line-width':1.5,'line-opacity':['get','alpha']}});
 traffic=createTraffic(map,reduced);
 map.on('click',e=>{
  if(state.view==='detail'){
   const fs=map.queryRenderedFeatures(e.point,{layers:['facility-hit']});
   if(fs.length){if(structure()?.kind==='interchange')selectMovement(fs[0].properties.movement);return;}
   back();return;
  }
  const nearby=state.structures.filter(s=>state.view==='route'?s.routes.includes(state.route):map.getZoom()>11.2).map(s=>({s,p:map.project(s.coordinates)})).filter(({p})=>Math.hypot(p.x-e.point.x,p.y-e.point.y)<15).sort((a,b)=>Math.hypot(a.p.x-e.point.x,a.p.y-e.point.y)-Math.hypot(b.p.x-e.point.x,b.p.y-e.point.y));
  if(nearby.length){selectStructure(nearby[0].s.id);return;}
  const roads=map.queryRenderedFeatures(e.point,{layers:['routes-hit']});
  const chosen=roads.find(f=>Number(f.properties.route)===state.route)||roads[0];
  if(chosen){selectRoute(Number(chosen.properties.route));return;}back();
 });
 map.on('mousemove',e=>{map.getCanvas().style.cursor=map.queryRenderedFeatures(e.point,{layers:state.view==='detail'?['facility-hit']:['routes-hit']}).length?'pointer':'';});
 contextLabels=createPlaceLabels(map,state.places,()=>({view:state.view,route:state.route,blockedBottom:sheet.visibleHeight+10}));
 mapLabels=createMapLabels();
}
function createMapLabels(){
 let labels=[];
 const positions={1:[114.181,22.337],2:[114.218,22.358],3:[114.057,22.407],4:[114.213,22.292],5:[114.131,22.357],6:[114.19,22.322],7:[114.18,22.343],8:[114.028,22.334],9:[114.159,22.469],10:[113.966,22.451]};
 function add(text,coordinates,{className='',click,color,priority=1,offset=[0,0]}={}){
  const el=document.createElement(click?'button':'div');el.className=`map-annotation ${className}`;el.textContent=text;if(color)el.style.setProperty('--label-color',color);
  if(click){el.setAttribute('aria-label',text);el.addEventListener('click',e=>{e.stopPropagation();click();});}else el.setAttribute('aria-hidden','true');
  const marker=new maplibregl.Marker({element:el,offset}).setLngLat(coordinates).addTo(map);labels.push({el,marker,coordinates,priority,offset,flexible:className.includes('facility-name')||className.includes('road-note')});
 }
 function rebuild(){
  labels.forEach(l=>l.marker.remove());labels=[];
  if(state.view==='overview')state.routes.forEach(r=>add(String(r.id),positions[r.id],{className:'route-number',priority:6,click:()=>selectRoute(r.id)}));
  if(state.view==='route'||state.view==='overview'&&map.getZoom()>11.2){
   state.structures.filter(s=>state.view==='overview'||s.routes.includes(state.route)).forEach(s=>add(s.name,s.coordinates,{className:`facility-name ${s.kind}`,priority:s.kind==='interchange'?4:3,click:()=>selectStructure(s.id),color:kinds[s.kind].color,offset:[0,-14]}));
  }
  const s=structure();
  if(s?.kind==='interchange'){
   const fs=facilityFeatures(state.geo.features,s,state.interchanges.features);
   const grouped=new Map();
   for(const f of fs){
    const p=f.properties;
    const key=p.role==='ramp'?`r:${p.fromRoutes}:${p.toRoutes}:${p.toName}`:`m:${p.route||p.roadName}`;
    const length=cs=>cs.reduce((n,c,i)=>i?n+Math.hypot(c[0]-cs[i-1][0],c[1]-cs[i-1][1]):0,0);
    if(!grouped.has(key)||length(f.geometry.coordinates)>length(grouped.get(key).geometry.coordinates))grouped.set(key,f);
   }
   const selected=fs.find(f=>movementKey(f.properties)===state.movement);
   const candidates=[...grouped.values()].filter(f=>!state.movement||f.properties.role==='mainline');
   if(selected)candidates.unshift(selected);
   const rank=f=>movementKey(f.properties)===state.movement?30:f.properties.role==='mainline'?(f.properties.route?12:4):(f.properties.fromRoutes.length&&f.properties.toRoutes.length&&String(f.properties.fromRoutes)!==String(f.properties.toRoutes)?8:2);
   candidates.sort((a,b)=>rank(b)-rank(a));
   candidates.slice(0,14).forEach(f=>{const p=f.properties,active=movementKey(p)===state.movement;
    const road=p.roadName===s.name?(p.route===3?(s.id==='22'?'汀九橋／長青公路':'西九龍公路'):p.route===8?(s.id==='22'?'青嶼幹線':'青沙公路'):p.route===7?'呈祥道':p.roadName):p.roadName;
    const text=p.role==='mainline'?`${p.route?`${p.route} 號 · `:''}${road} · ${p.direction}`:rampLabel(p)+(active?` · ${p.direction}`:'')+(p.connectionConfirmed?'':' · 示意');
    add(text,midpoint(f.geometry.coordinates),{className:`road-note ${p.role} ${active?'active':''}`,color:p.role==='mainline'?p.lineColor:'#c7d1da',priority:rank(f),click:()=>selectMovement(movementKey(p)),offset:[0,active?-24:-15]});
   });
  }else if(s){
   const fs=facilityFeatures(state.geo.features,s,state.interchanges.features),cs=fs.flatMap(f=>f.geometry.coordinates);
   add(`${s.name}\n${s.metrics[0][0]} ${s.metrics[0][1]}`,s.coordinates,{className:'detail-name',color:kinds[s.kind].color,priority:10,offset:[0,-34]});
   for(const id of s.routes){
    const r=state.routes.find(r=>r.id===id),idx=r.nodes.findIndex(n=>n.name===s.name);
    const destinations=idx>=0?[r.nodes[Math.max(0,idx-1)],r.nodes[Math.min(r.nodes.length-1,idx+1)]]:[r.nodes[0],r.nodes.at(-1)];
    // Anchors sit at the physical ends of the geometry nearest the neighbouring route place.
    destinations.forEach(n=>{
     const c=cs.reduce((best,c)=>!best||Math.hypot(c[0]-n.coordinates[0],c[1]-n.coordinates[1])<Math.hypot(best[0]-n.coordinates[0],best[1]-n.coordinates[1])?c:best,null);
     if(c)add(`${s.kind==='tunnel'?'隧道口':'橋端'} · ${id} 號 往${n.name}`,c,{className:'road-note terminal',color:r.color,priority:8,offset:[0,24]});
    });
   }
  }
  refresh();
 }
 function refresh(){
  const w=$('#map').clientWidth,h=$('#map').clientHeight-sheet.visibleHeight-12,rects=[];
  labels.sort((a,b)=>b.priority-a.priority).forEach(l=>{
   const p=map.project(l.coordinates),width=l.el.offsetWidth||l.el.textContent.length*13+16,height=l.el.offsetHeight||30;
   const options=l.flexible?[l.offset,[0,23],[0,-42],[0,46],[0,-65],[0,68]]:[l.offset];let chosen=null,rect=null;
   for(const offset of options){
    const r={left:p.x-width/2+offset[0],right:p.x+width/2+offset[0],top:p.y-height/2+offset[1],bottom:p.y+height/2+offset[1]};
    if(r.left>=8&&r.right<=w-8&&r.top>=12&&r.bottom<=h&&!rects.some(a=>r.left<a.right+8&&r.right>a.left-8&&r.top<a.bottom+5&&r.bottom>a.top-5)){chosen=offset;rect=r;break;}
   }
   l.el.hidden=!chosen;if(chosen){rects.push(rect);l.marker.setOffset(chosen);}

  });
 }
 map.on('move',refresh);map.on('zoomend',()=>{if(state.view==='overview')rebuild();});map.on('resize',refresh);return {rebuild,refresh};
}
async function initMap(){
 if(!window.maplibregl){message('地圖引擎載入失敗，請重新整理。',true);return;}
 try{
  map=new maplibregl.Map({container:'map',style:'./data/basemap.json',center:[114.09,22.38],zoom:10,minZoom:6,maxZoom:18,attributionControl:false,renderWorldCopies:false,locale:{'Map.Title':'香港幹線探索地圖'}});
  map.addControl(new maplibregl.AttributionControl({compact:false}),'bottom-right');
  map.on('load',()=>{state.ready=true;addMapLayers();updateMap();if(state.view==='detail')fitFacility(false);else fit(state.route,false);$('#map-message').hidden=true;});
  map.on('error',e=>console.warn('Map resource:',e.error?.message));
  const resize=new ResizeObserver(()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>map.resize());});resize.observe($('#map'));
  setTimeout(()=>{if(!state.ready){message('底圖連線較慢，切換至簡潔路線圖…');map.setStyle({version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#08131d'}}]});}},18000);
 }catch(e){console.error(e);message('此瀏覽器無法啟用互動地圖，請使用支援 WebGL 的瀏覽器。',true);}
}
function bind(){
 sheet=createSheet({element:$('#explorer'),handle:$('#sheet-grip'),dragZone:$('#sheet-drag-zone'),content:$('#panel-body'),onChange:syncOcclusion,isHidden:()=>state.view==='overview'});
 $('#explorer').addEventListener('click',e=>{
  const r=e.target.closest('[data-route]'),s=e.target.closest('[data-structure]'),n=e.target.closest('[data-node]');
  if(r)selectRoute(Number(r.dataset.route));else if(s)selectStructure(s.dataset.structure);else if(n){const point=route()?.nodes[Number(n.dataset.node)],f=state.structures.find(s=>s.name===point?.name);if(f)selectStructure(f.id);else if(point){navigate(point.coordinates,13);toast(point.name);}}
 });
 document.addEventListener('keydown',e=>{if(e.key==='Escape')back();});
 window.addEventListener('hashchange',()=>{remember();Object.assign(state,parseScene(location.hash,state.routes,state.structures));render();moveToScene({restore:true});});
}
async function main(){
 bind();try{
  const load=async url=>{const r=await fetch(url);if(!r.ok)throw Error(url);return r.json();};
  const [r,g,s,j,p]=await Promise.all(['routes.json','routes.geojson','structures.json','interchanges.geojson','places.json'].map(f=>load('./data/'+f)));
  Object.assign(state,{routes:r.routes,geo:g,structures:s.structures,interchanges:j,places:p.places},parseScene(location.hash,r.routes,s.structures));render();await initMap();
 }catch(e){console.error(e);message('資料載入失敗，請重新整理後再試。',true);}
}
main();
