import {cumulativeGroup,structurePlan,historyPlan,pathFrame,partialFeature,createGrowthPlayer} from './growth.js';
import {createSheet} from './sheet.js';
import {fitZoom} from './camera.js';
import {facilityFeatures,createTraffic} from './traffic.js';
import {mapDetailLevel,searchEntries} from './discovery.js';
import {structureGroups,inStructureGroup,automaticStructure,visibleFacility,blocksStructureDiscovery} from './layers.js';
import {MAP_LIMITS,pickRoad} from './interaction.js';
import {createPlaceLabels} from './places.js';
import {openRoute,openDetail,emptyMap,sceneHash,parseScene} from './scene.js';
import {colorConnections,rampLabel,movementKey,midpoint} from './connections.js';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kinds={bridge:{name:'橋梁',color:'#6cbdf9'},tunnel:{name:'隧道',color:'#edb86b'},interchange:{name:'互通立交',color:'#c0ced8'}};
const state={routes:[],geo:null,structures:[],interchanges:{features:[]},places:[],view:'overview',route:null,structure:null,lastRoute:null,movement:null,autoStructure:null,layer:'all',ready:false};
let map,sheet,traffic,contextLabels,mapLabels,resizeFrame,toastTimer,mapClickTimer;
let growthPlayer,growthSession=null,growthLabels=[],growthStartTimer=0;
let overviewCamera=null,detailReturn=null,autoDismissed=null,suppressAutoUntil=0,gestureUntil=0;
const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
const route=()=>state.routes.find(r=>r.id===state.route),structure=()=>state.structures.find(s=>s.id===(state.structure||state.autoStructure));
const collection=features=>({type:'FeatureCollection',features});
const facilityGeometry=new Map();
function message(text,error=false){$('#map-message').textContent=text;$('#map-message').classList.toggle('error',error);$('#map-message').hidden=false;}
function toast(text){$('.toast')?.remove();clearTimeout(toastTimer);const el=document.createElement('div');el.className='toast';el.setAttribute('role','status');el.textContent=text;$('.map-stage').append(el);toastTimer=setTimeout(()=>el.remove(),3000);}
function padding(visible=sheet?.visibleHeight||0){return {top:65,bottom:state.view==='overview'?0:Math.min(visible+10,$('#map').clientHeight-1),left:0,right:0};}
function syncOcclusion(visible){if(map&&state.ready){const p=padding(visible),old=map.getPadding();if(Math.abs(old.bottom-p.bottom)>.5||old.top!==p.top)map.jumpTo({padding:p});contextLabels?.refresh();mapLabels?.refresh();positionGrowthCaption();}}
function stopGrowth({finish=false}={}){
 clearTimeout(growthStartTimer);growthStartTimer=0;
 if(!growthSession)return;
 if(finish){if(growthPlayer?.active)growthPlayer.skip();else completeGrowth();return;}
 growthPlayer?.cancel();growthSession=null;clearGrowthGraphics();
}
function cameraSnapshot(){if(!state.ready)return null;map.stop();return {center:map.getCenter().toArray(),zoom:map.getZoom()};}
function sceneSnapshot(){return {view:state.view,route:state.route,structure:state.structure,lastRoute:state.lastRoute,movement:null};}
function navigate(center,zoom,animate=true){
 if(!map||!state.ready)return;clearTimeout(mapClickTimer);map.stop();
 suppressAutoUntil=performance.now()+850;
 map.easeTo({center,zoom,padding:padding(),bearing:0,pitch:0,duration:animate&&!reduced?500:0});
}
function fit(id=null,animate=true){
 if(!state.ready)return;map.resize();
 const cs=state.geo.features.filter(f=>!id||f.properties.route===id).flatMap(f=>f.geometry.coordinates);
 const c=fitZoom(cs,$('#map').clientWidth,$('#map').clientHeight,{top:55,bottom:(id?sheet.peekHeight:0)+55,left:40,right:40,maxZoom:12.7});navigate(c.center,c.zoom,animate);
}
function fitFacility(animate=true){
 const s=structure();if(!state.ready||!s)return;map.resize();
 const cs=(facilityGeometry.get(s.id)||[]).flatMap(f=>f.geometry.coordinates);
 if(!cs.length){navigate(s.coordinates,13.2,animate);return;}
 const narrow=$('#map').clientWidth<600;
 const c=fitZoom(cs,$('#map').clientWidth,$('#map').clientHeight,{top:80,bottom:sheet.peekHeight+80,left:narrow?55:150,right:narrow?55:150,maxZoom:s.kind==='interchange'?16:14.1});navigate(c.center,c.zoom,animate);
}
function writeHash(){history.replaceState(null,'',location.pathname+location.search+sceneHash(state));}
function clearAuto(){state.autoStructure=null;state.layer='all';state.movement=null;}
function selectRoute(id){
 if(!state.ready)return;stopGrowth();
 if(state.view==='route'&&state.route===id){if(state.autoStructure){autoDismissed=state.autoStructure;clearAuto();updateMap();}return;}
 const before=cameraSnapshot();if(state.view==='overview')overviewCamera=before;
 detailReturn=null;autoDismissed=null;clearAuto();Object.assign(state,openRoute(state,id));render();writeHash();fit(id);
}
function selectStructure(id,{preserveCamera=false,animateGrowth=true}={}){
 const s=state.structures.find(s=>s.id===id);if(!state.ready||!s)return;
 if(state.view==='detail'&&state.structure===id){if(animateGrowth)playStructure();return;}
 stopGrowth();
 const camera=cameraSnapshot();
 if(state.view!=='detail')detailReturn={scene:sceneSnapshot(),camera};
 autoDismissed=null;clearAuto();Object.assign(state,openDetail(state,s));render();writeHash();
 if(preserveCamera&&camera)navigate(camera.center,camera.zoom,false);else fitFacility();
 if(animateGrowth&&structureGroups(s,facilityGeometry.get(s.id)||[]).length&&!reduced)playStructure({delay:preserveCamera?80:540});
}
function back(){
 if(!state.ready)return;stopGrowth();clearTimeout(mapClickTimer);suppressAutoUntil=performance.now()+850;
 if(state.autoStructure&&state.view!=='detail'){autoDismissed=state.autoStructure;clearAuto();updateMap();return;}
 if(state.view==='overview')return;
 const previous=state.view==='detail'?detailReturn:null;map.stop();clearAuto();
 if(previous){Object.assign(state,previous.scene);detailReturn=null;render();writeHash();if(previous.camera)navigate(previous.camera.center,previous.camera.zoom);return;}
 const next=emptyMap(state);Object.assign(state,next);render();writeHash();
 if(state.view==='overview'&&overviewCamera)navigate(overviewCamera.center,overviewCamera.zoom);else if(state.view==='route')fit(state.route);else fit();
}
function routeLink(id){const r=state.routes.find(r=>r.id===id);return `<button class="text-route" data-route="${id}" style="--route:${r.color}">${id} 號幹線 <small>${esc(r.endpoints)}</small></button>`;}
function render(){
 suppressAutoUntil=Math.max(suppressAutoUntil,performance.now()+850);
 document.body.dataset.view=state.view;
 clearAuto();
 const r=route(),s=structure();
 $('#scene-caption').textContent=s?`${kinds[s.kind].name} · ${s.routes.join(' / ')} 號幹線`:r?`${r.id} 號幹線 · ${r.endpoints}`:'香港的道路與山海';
 $('#back-view').hidden=state.view==='overview'&&!state.autoStructure;
 $('#home-view').setAttribute('aria-current',state.view==='overview'?'page':'false');
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
 const f=state.interchanges.features.find(f=>f.properties.structure===(state.structure||state.autoStructure)&&movementKey(f.properties)===state.movement);if(!f)return '';
 const p=f.properties;return `<h3>${esc(rampLabel(p))}</h3><p>${p.role==='ramp'?`${esc(p.fromName)}接${esc(p.toName)}`:esc(p.roadName)} · ${esc(p.direction)}${p.lanes?` · ${esc(p.lanes)} 車道`:''}</p>${p.destination?`<p>來源目的地標記：${esc(p.destination)}</p>`:''}<small>${p.connectionConfirmed?'依道路節點與單行方向連接':'連接資料未完整確認，僅供結構探索'}；非行車指引</small>`;
}
function renderStructure(s){
 const k=kinds[s.kind];
 $('#panel-content').innerHTML=`<div class="parent-routes"><span>同一節點 · 所屬幹線</span>${s.routes.map(routeLink).join('')}</div><p class="detail-description">${esc(s.summary)}</p>${s.deckNote?`<p class="layer-note">${esc(s.deckNote)} <a href="${s.deckSource}" target="_blank" rel="noopener">管制區指引</a></p>`:''}<div id="movement-info" class="movement-info" ${state.movement?'':'hidden'}>${movementInfo()}</div>${s.kind==='interchange'?'<p class="layer-note">主線沿用幹線色；轉接匝道由來源色漸變至去向色，灰色端連接地區道路或未編號路段。點選任一匝道，查看連接用途。</p>':''}<figure class="photo"><img class="${s.kind==='interchange'?'structure-diagram':''}" src="./${s.image}" alt="${esc(s.imageCaption)}"><figcaption>${esc(s.imageCaption)}<br>圖片：<a href="${s.imageSource}" target="_blank" rel="noopener">${esc(s.imageCredit)}</a></figcaption></figure><dl class="metrics" style="--kind:${k.color}">${s.metrics.map(([label,value])=>`<div class="metric"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl><a class="detail-link" href="${s.source}" target="_blank" rel="noopener">查看資料來源</a>`;
}
function selectMovement(key){
 stopGrowth({finish:true});state.movement=state.movement===key?null:key;applyMovement();mapLabels?.rebuild();
 startTraffic();
 const el=$('#movement-info');if(el){el.hidden=!state.movement;el.innerHTML=movementInfo();}
}
function selectedGroup(){const s=structure();return structureGroups(s,s?facilityGeometry.get(s.id)||[]:[]).find(g=>g.id===state.layer);}
function applyMovement(){
 if(!map||!state.ready)return;
 map.setPaintProperty('structure-context','line-opacity',state.layer==='all'?.55:.82);
 const fs=structure()?facilityGeometry.get(structure().id)||[]:[],group=selectedGroup();
 const groups=structureGroups(structure(),fs);
 const visible=fs.filter(f=>cumulativeGroup(f.properties,groups,group)).map(f=>movementKey(f.properties));
 const included=['in',['get','movement'],['literal',[...new Set(visible)]]];
 const selected=state.movement?['==',['get','movement'],state.movement]:true;
 for(let i=-2;i<=5;i++){
  map.setPaintProperty(`junction-deck-${i}`,'line-opacity',growthSession?1:['case',included,['case',selected,1,.3],.07]);
  map.setPaintProperty(`junction-shadow-${i}`,'line-opacity',growthSession?1:['case',included,1,.03]);
 }
}
function startTraffic(){
 if(growthSession){traffic.stop();return;}
 const s=structure(),local=s&&(state.view==='detail'||state.layer!=='all'||state.movement);
 map.setPaintProperty('traffic-glow','line-color',local?kinds[s.kind].color:state.view==='route'?route().color:['get','color']);
 if(local){const group=selectedGroup();traffic.start((facilityGeometry.get(s.id)||[]).filter(f=>f.properties.status!=='conditional'&&cumulativeGroup(f.properties,structureGroups(s,facilityGeometry.get(s.id)||[]),group)&&(!state.movement||movementKey(f.properties)===state.movement)));}
 else if(state.view==='route')traffic.start(state.geo.features.filter(f=>f.properties.route===state.route),{prominence:1.3});
 else traffic.start(state.geo.features,{prominence:.85,density:.65,speed:.65,colors:Object.fromEntries(state.routes.map(r=>[r.id,r.color]))});
}
function paintFeatures(features,connections=false,forceLevel=false){
 const colored=connections?colorConnections(features):features;
 return colored.map(f=>{
  const p=f.properties,color=p.lineColor||state.routes.find(r=>r.id===p.route)?.color||'#a6c1d1';
  return {type:'Feature',properties:{route:p.route,role:p.role||'mainline',...(p.level!==undefined||forceLevel?{level:p.level??0}:{}),lineColor:color,movement:movementKey(p),deck:p.deck,status:p.status||'mapped'},geometry:f.geometry};
 });
}
function clearGrowthGraphics(){
 growthLabels.forEach(m=>m.remove());growthLabels=[];$('#growth-caption').hidden=true;
 for(const id of ['growth','growth-head','history-built'])map?.getSource(id)?.setData(collection([]));
}
function positionGrowthCaption(){if(growthSession)$('#growth-caption').style.bottom=`${state.view==='overview'?25:sheet.visibleHeight+22}px`;}
function completeGrowth(){
 const ctx=growthSession;if(!ctx)return;growthSession=null;clearGrowthGraphics();
 if(ctx.kind==='structure'&&structure()?.id===ctx.facilityId)state.layer=ctx.target;
 updateMap();suppressAutoUntil=performance.now()+400;
}
function setupGrowth(){
 growthPlayer=createGrowthPlayer({
  onStage(stage,index,total){
   const ctx=growthSession;if(!ctx)return;ctx.index=index;ctx.active=stage;ctx.frameFull=false;
   $('#growth-caption').hidden=false;$('#growth-caption').dataset.kind=ctx.kind;
   $('#growth-kicker').textContent=stage.label;$('#growth-title').textContent=stage.title;
   $('#growth-subtitle').textContent=ctx.kind==='history'?'按通車里程碑與 OSM 年代演繹 · 現今線形':`${index+1} / ${total} · 前層保留，這一段正在接上`;
   positionGrowthCaption();growthLabels.forEach(m=>m.remove());growthLabels=[];
   if(ctx.kind==='structure')stage.paths.slice(0,4).forEach(path=>{
    const p=path.properties,el=document.createElement('div');el.className='growth-map-label';
    el.textContent=p.role==='ramp'?rampLabel(p):`${p.route?`${p.route} 號 · `:''}${p.roadName||structure()?.name||''}${p.direction?' · '+p.direction:''}`;el.style.opacity='0';
    growthLabels.push(new maplibregl.Marker({element:el,offset:[0,-22]}).setLngLat(path.anchor).addTo(map));el.setAttribute('aria-hidden','true');el.setAttribute('role','presentation');el.tabIndex=-1;
   });
   renderLayerControl();
  },
  onFrame(stage,features,p,holdProgress){
   const ctx=growthSession;if(!ctx)return;
   if(!ctx.frameFull){
    map.getSource('growth').setData(collection(paintFeatures(features,ctx.kind==='structure'&&structure()?.kind==='interchange',true)));
    const mpp=156543.03392*Math.cos(map.getCenter().lat*Math.PI/180)/2**map.getZoom();
    const heads=stage.paths.slice(0,ctx.kind==='history'?20:4).flatMap((path,i)=>{
     const progress=stage.historical?Math.max(0,Math.min(1,((1-(1-p)**1.2)-(i%7)*.035)/.79)):1-(1-p)**1.2;
     const f=pathFrame(path,progress).at(-1);if(!f||progress>=1)return [];
     const cs=f.geometry.coordinates,rev={...f,geometry:{type:'LineString',coordinates:[...cs].reverse()}},n=cs.reduce((sum,c,j)=>j?sum+Math.hypot((c[0]-cs[j-1][0])*.925,c[1]-cs[j-1][1])*111195:0,0);
     const tail=partialFeature(rev,Math.min(1,mpp*12/(n||1)));if(!tail)return [];
     return [{...tail,geometry:{type:'LineString',coordinates:[...tail.geometry.coordinates].reverse()}}];
    });
    map.getSource('growth-head').setData(collection(paintFeatures(heads,false,true)));if(p>=1)ctx.frameFull=true;
   }
   const alpha=p<.62?0:holdProgress>.65?Math.max(0,(1-holdProgress)/.35):Math.min(1,(p-.62)/.25);
   growthLabels.forEach(m=>m.getElement().style.opacity=String(alpha));
   $('#growth-progress').style.width=`${(ctx.index+p)/ctx.stages.length*100}%`;
  },
  onCommit(stage){
   const ctx=growthSession;if(!ctx)return;ctx.built.push(...stage.paths.flatMap(path=>path.edges.map(e=>e.f)));
   map.getSource(ctx.kind==='history'?'history-built':'facility').setData(collection(paintFeatures(ctx.built,ctx.kind==='structure'&&structure()?.kind==='interchange')));
   map.getSource('growth').setData(collection([]));map.getSource('growth-head').setData(collection([]));
   if(ctx.kind==='structure'&&stage.lastInGroup){ctx.available=Math.max(ctx.available,stage.groupIndex);state.layer=stage.group.id;renderLayerControl();}
  },
  onDone:completeGrowth
 });
}
function playStructure({target='all',delay=0}={}){
 const s=structure();if(!s||!state.ready)return;
 const features=facilityGeometry.get(s.id)||[],groups=structureGroups(s,features);if(!groups.length)return;
 stopGrowth();state.layer=target;state.movement=null;
 if(reduced){updateMap();return;}
 const targetIndex=groups.findIndex(g=>g.id===target),prior=target==='all'?[]:groups.slice(1,targetIndex);
 const stages=structurePlan(s,features,groups,{target}),built=features.filter(f=>prior.some(g=>inStructureGroup(f.properties,g)));
 growthSession={kind:'structure',facilityId:s.id,target,groups,stages,built,available:target==='all'?0:groups.length-1,index:0};
 map.getSource('facility').setData(collection(paintFeatures(built,s.kind==='interchange')));updateMap();positionGrowthCaption();
 growthStartTimer=setTimeout(()=>{growthStartTimer=0;if(growthSession?.facilityId===s.id)growthPlayer.play(stages);},delay);
}
function playOverview(){
 if(!state.ready)return;stopGrowth();map.stop();clearAuto();autoDismissed=null;detailReturn=null;overviewCamera=null;
 Object.assign(state,{view:'overview',route:null,structure:null,movement:null});render();writeHash();fit();
 if(reduced)return;
 const stages=state.historyStages||(state.historyStages=historyPlan(state.geo.features,state.history));
 growthSession={kind:'history',target:'all',stages,built:[],index:0};updateMap();
 growthStartTimer=setTimeout(()=>{growthStartTimer=0;if(growthSession?.kind==='history')growthPlayer.play(stages);},540);
}
function renderLayerControl(){
 const s=structure(),groups=structureGroups(s,s?facilityGeometry.get(s.id)||[]:[]),el=$('#structure-layers');el.hidden=!groups.length;
 if(!groups.length){$('#back-view').hidden=state.view==='overview'&&!state.autoStructure;return;}
 $('#layers-title').textContent=s.name;
 const choices=groups.filter((g,i)=>!growthSession||growthSession.kind!=='structure'||i<=growthSession.available),container=$('#layer-options');
 el.dataset.growing=String(growthSession?.kind==='structure');
 for(const b of [...container.children])if(!choices.some(g=>g.id===b.dataset.layer))b.remove();
 choices.forEach((g,i)=>{
  let b=[...container.children].find(b=>b.dataset.layer===g.id);
  if(!b){b=document.createElement('button');b.dataset.layer=g.id;b.textContent=g.label;container.insertBefore(b,container.children[i]||null);}
  b.setAttribute('aria-pressed',String(state.layer===g.id));
 });
 $('#layers-note').textContent=growthSession?.kind==='structure'?'依次長出，已成形的道路保留':s.kind==='bridge'?'下層為備用通道，非日常開放':'逐層累加 · 前層保留';
 $('#layers-details').hidden=state.view==='detail';
 $('#back-view').hidden=state.view==='overview'&&!state.autoStructure;
}
function updateMap(){
 if(!state.ready)return;
 const detail=state.view==='detail',focused=state.view==='route',r=route(),s=structure();
 const original=['match',['get','route'],...state.routes.flatMap(r=>[r.id,r.color]),'#87949f'];
 const selected=['==',['get','route'],state.route??-1];
 const context=s?['in',['get','route'],['literal',s.routes]]:selected;
 const growing=Boolean(growthSession);
 for(const layer of ['routes-line','routes-construction']){
  map.setPaintProperty(layer,'line-color',growing?'#45525d':detail?['case',context,original,'#45525d']:focused?['case',selected,original,'#45525d']:original);
  map.setPaintProperty(layer,'line-opacity',growing?(growthSession.kind==='history'?.045:.16):detail?['case',context,.86,.22]:focused?['case',selected,1,.35]:.82);
  map.setPaintProperty(layer,'line-width',['interpolate',['linear'],['zoom'],8,focused||detail?['case',context,2.2,1]:1.7,12,focused||detail?['case',context,4.2,1]:3,16,focused||detail?['case',context,7,1]:5]);
 }
 map.setPaintProperty('routes-casing','line-opacity',growing?.06:detail?.4:.6);
 map.setPaintProperty('scene-veil','fill-opacity',['interpolate',['linear'],['zoom'],9,detail?.45:focused?.3:.15,16,detail?.24:focused?.13:.06]);
 // Native map labels supply streets, parks and neighbourhoods at their natural zoom levels.
 const features=s?(facilityGeometry.get(s.id)||[]):[];
 if(!growthSession)map.getSource('facility').setData(collection(paintFeatures(features,s?.kind==='interchange')));
 const color=s?kinds[s.kind].color:r?.color||'#87949f';
 map.setLayoutProperty('facility-line','visibility',structureGroups(s,features).length?'none':'visible');
 map.setPaintProperty('facility-glow','line-opacity',structureGroups(s,features).length?.04:.24);
 for(const layer of ['facility-line','facility-glow','traffic-glow'])map.setPaintProperty(layer,'line-color',color);
 map.setFilter('route-glow',focused?selected:['==',['get','route'],-1]);map.setPaintProperty('route-glow','line-color',color);
 map.setPaintProperty('traffic-head','line-width',focused?1.8:detail?1.5:1.25);
 map.setPaintProperty('traffic-head','line-opacity',['*',['get','alpha'],focused||detail?1:.7]);
 map.setPaintProperty('traffic-glow','line-width',focused?6:detail?5:4);
 map.setPaintProperty('traffic-glow','line-color',s||focused?color:['get','color']);
 applyMovement();contextLabels?.refresh();mapLabels?.rebuild();renderLayerControl();
 startTraffic();
 $('#back-view').hidden=state.view==='overview'&&!state.autoStructure;
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
 map.addSource('history-built',{type:'geojson',data:collection([])});
 map.addLayer({id:'history-built-glow',type:'line',source:'history-built',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':['get','lineColor'],'line-width':8,'line-blur':4,'line-opacity':.15}});
 map.addLayer({id:'history-built-line',type:'line',source:'history-built',filter:['!=',['get','status'],'construction'],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':['get','lineColor'],'line-width':2.8,'line-opacity':1}});
 map.addLayer({id:'history-built-construction',type:'line',source:'history-built',filter:['==',['get','status'],'construction'],paint:{'line-color':['get','lineColor'],'line-width':2.8,'line-dasharray':[2,2]}});
 map.addSource('growth',{type:'geojson',data:collection([])});
 map.addSource('growth-head',{type:'geojson',data:collection([])});
 map.addSource('facility',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
 map.addLayer({id:'route-glow',type:'line',source:'hk-routes',filter:['==',['get','route'],-1],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#7aafff','line-width':['interpolate',['linear'],['zoom'],9,10,14,24],'line-blur':8,'line-opacity':.18}},'routes-line');
 map.addLayer({id:'facility-glow',type:'line',source:'facility',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#6cbdf9','line-width':22,'line-blur':10,'line-opacity':.24}});
 map.addLayer({id:'facility-line',type:'line',source:'facility',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#6cbdf9','line-width':['interpolate',['linear'],['zoom'],10,4,14,7],'line-opacity':1}});

 map.addLayer({id:'structure-context',type:'line',source:'facility',filter:['has','level'],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#0b1721','line-width':['case',['==',['get','role'],'ramp'],6,11],'line-opacity':.55}});
 for(let level=-2;level<=5;level++){
  const filter=['==',['get','level'],level];
  const ramp=['==',['get','role'],'ramp'];
  map.addLayer({id:`junction-shadow-${level}`,type:'line',source:'facility',filter,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#050d15','line-width':['interpolate',['linear'],['zoom'],12,['case',ramp,6,8],16,['case',ramp,8,11]],'line-opacity':1}});
  map.addLayer({id:`junction-deck-${level}`,type:'line',source:'facility',filter,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':['coalesce',['get','lineColor'],'#87949f'],'line-width':['interpolate',['linear'],['zoom'],12,['case',ramp,1.8,2.8],16,['case',ramp,2.8,4.2]],'line-opacity':1}});
  map.addLayer({id:`growth-shadow-${level}`,type:'line',source:'growth',filter,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#05111c','line-width':['case',ramp,7,10],'line-opacity':.92}});
  map.addLayer({id:`growth-glow-${level}`,type:'line',source:'growth',filter,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':['get','lineColor'],'line-width':10,'line-blur':5,'line-opacity':.3}});
  map.addLayer({id:`growth-deck-${level}`,type:'line',source:'growth',filter:['all',filter,['!=',['get','status'],'construction']],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':['get','lineColor'],'line-width':['interpolate',['linear'],['zoom'],9,2.6,14,['case',ramp,3.2,5]],'line-opacity':1}});
  map.addLayer({id:`growth-construction-${level}`,type:'line',source:'growth',filter:['all',filter,['==',['get','status'],'construction']],paint:{'line-color':['get','lineColor'],'line-width':3,'line-dasharray':[2,2]}});
 }
 map.addLayer({id:'facility-hit',type:'line',source:'facility',paint:{'line-color':'#fff','line-width':20,'line-opacity':0}});
 map.addSource('traffic',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
 map.addLayer({id:'traffic-glow',type:'line',source:'traffic',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#7aafff','line-width':6,'line-blur':3,'line-opacity':['*',['get','alpha'],.55]}});
 map.addLayer({id:'traffic-head',type:'line',source:'traffic',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#f4fcff','line-width':1.5,'line-opacity':['get','alpha']}});
 map.addLayer({id:'growth-front-glow',type:'line',source:'growth-head',layout:{'line-cap':'round'},paint:{'line-color':['get','lineColor'],'line-width':10,'line-blur':4,'line-opacity':.65}});
 map.addLayer({id:'growth-front',type:'line',source:'growth-head',layout:{'line-cap':'round'},paint:{'line-color':'#edfaff','line-width':2.5,'line-opacity':.95}});
 traffic=createTraffic(map,reduced);setupGrowth();
 function tapAction(e){
  const p={x:e.point.x,y:e.point.y};
  if(structure()){
   const rows=map.queryRenderedFeatures([p.x,p.y],{layers:['facility-hit']});
   const fs=rows.filter(f=>inStructureGroup(f.properties,selectedGroup()));
   if(fs.length)return ()=>{if(structure()?.kind==='interchange')selectMovement(fs[0].properties.movement);};
   if(state.view==='detail')return back;
  }
  const rows=map.queryRenderedFeatures([[p.x-5,p.y-5],[p.x+5,p.y+5]],{layers:['routes-hit']});
  const id=pickRoad(rows,p,c=>map.project(c),{route:state.route,tolerance:12});
  return id?()=>selectRoute(id):back;
 }
 map.on('click',e=>{
  clearTimeout(mapClickTimer);if(performance.now()<gestureUntil||map.isEasing()||e.originalEvent?.detail>1)return;
  const action=tapAction(e);mapClickTimer=setTimeout(action,280);
 });
 map.on('dblclick',()=>clearTimeout(mapClickTimer));
 const pointers=new Map();let wasMultiple=false;
 const canvas=map.getCanvas();
 canvas.addEventListener('wheel',()=>stopGrowth({finish:true}),{passive:true});
 canvas.addEventListener('pointerdown',e=>{clearTimeout(mapClickTimer);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size>1){wasMultiple=true;gestureUntil=performance.now()+500;}},{passive:true});
 canvas.addEventListener('pointermove',e=>{const a=pointers.get(e.pointerId);if(a&&Math.hypot(e.clientX-a.x,e.clientY-a.y)>8){clearTimeout(mapClickTimer);gestureUntil=performance.now()+400;}},{passive:true});
 const release=e=>{pointers.delete(e.pointerId);if(wasMultiple){gestureUntil=performance.now()+400;if(!pointers.size)wasMultiple=false;}};
 window.addEventListener('pointerup',release,{passive:true});window.addEventListener('pointercancel',release,{passive:true});
 window.addEventListener('pointerdown',()=>clearTimeout(mapClickTimer),{passive:true,capture:true});
 map.on('dragstart',()=>{stopGrowth({finish:true});clearTimeout(mapClickTimer);gestureUntil=performance.now()+400;});
 map.on('mousemove',e=>{map.getCanvas().style.cursor=map.queryRenderedFeatures(e.point,{layers:state.view==='detail'?['facility-hit']:['routes-hit']}).length?'pointer':'';});
 contextLabels=createPlaceLabels(map,state.places,()=>({view:state.view,route:state.route,blockedBottom:sheet.visibleHeight+10}));
 mapLabels=createMapLabels();
 map.on('movestart',()=>{clearTimeout(mapClickTimer);document.body.classList.add('camera-moving');});
 map.on('moveend',()=>{document.body.classList.remove('camera-moving');refreshViewport();});
 map.on('dragend',()=>{gestureUntil=performance.now()+350;});
 map.on('zoomstart',e=>{if(e.originalEvent)stopGrowth({finish:true});});
 map.on('zoomend',()=>{gestureUntil=performance.now()+300;contextLabels?.refresh();mapLabels?.rebuild();refreshViewport();});
}
function createMapLabels(){
 let labels=[];
 const positions={1:[114.181,22.337],2:[114.218,22.358],3:[114.057,22.407],4:[114.213,22.292],5:[114.131,22.357],6:[114.19,22.322],7:[114.18,22.343],8:[114.028,22.334],9:[114.159,22.469],10:[113.966,22.451]};
 function add(text,coordinates,{className='',click,color,priority=1,offset=[0,0]}={}){
  const el=document.createElement(click?'button':'div');el.className=`map-annotation ${className}`;el.textContent=text;if(color)el.style.setProperty('--label-color',color);
  if(click){el.setAttribute('aria-label',text);el.addEventListener('click',e=>{e.stopPropagation();if(performance.now()<gestureUntil||map.isMoving())return;click();});}else el.setAttribute('aria-hidden','true');
  const marker=new maplibregl.Marker({element:el,offset}).setLngLat(coordinates).addTo(map);labels.push({el,marker,coordinates,priority,offset,flexible:className.includes('facility-name')||className.includes('road-note')});
 }
 function rebuild(){
  labels.forEach(l=>l.marker.remove());labels=[];
  if(state.view==='overview'&&!growthSession)state.routes.forEach(r=>add(String(r.id),positions[r.id],{className:'route-number',priority:6,click:()=>selectRoute(r.id)}));
  if(!growthSession&&(state.view==='route'||state.view==='overview'&&map.getZoom()>11.2)){
   state.structures.filter(s=>visibleFacility(s,state)&&s.id!==state.autoStructure).forEach(s=>add(s.name,s.coordinates,{className:`facility-name ${s.kind} ${map.getZoom()>=12.1?'facility-button':''}`,priority:s.kind==='interchange'?4:3,click:()=>selectStructure(s.id),color:kinds[s.kind].color,offset:[0,-14]}));
  }
  const s=structure();
  if(!growthSession&&s?.kind==='interchange'){
   const fs=facilityGeometry.get(s.id)||[];
   const grouped=new Map();
   for(const f of fs){
    const p=f.properties;
    const key=p.role==='ramp'?`r:${p.fromRoutes}:${p.toRoutes}:${p.toName}`:`m:${p.route||p.roadName}`;
    const length=cs=>cs.reduce((n,c,i)=>i?n+Math.hypot(c[0]-cs[i-1][0],c[1]-cs[i-1][1]):0,0);
    if(!grouped.has(key)||length(f.geometry.coordinates)>length(grouped.get(key).geometry.coordinates))grouped.set(key,f);
   }
   const selected=fs.find(f=>movementKey(f.properties)===state.movement);
   const candidates=[...grouped.values()].filter(f=>cumulativeGroup(f.properties,structureGroups(s,fs),selectedGroup())&&(!state.movement||f.properties.role==='mainline'));
   if(selected)candidates.unshift(selected);
   const rank=f=>movementKey(f.properties)===state.movement?30:f.properties.role==='mainline'?(f.properties.route?12:4):(f.properties.fromRoutes.length&&f.properties.toRoutes.length&&String(f.properties.fromRoutes)!==String(f.properties.toRoutes)?8:2);
   candidates.sort((a,b)=>rank(b)-rank(a));
   candidates.slice(0,14).forEach(f=>{const p=f.properties,active=movementKey(p)===state.movement;
    const road=p.roadName===s.name?(p.route===3?(s.id==='22'?'汀九橋／長青公路':'西九龍公路'):p.route===8?(s.id==='22'?'青嶼幹線':'青沙公路'):p.route===7?'呈祥道':p.roadName):p.roadName;
    const text=p.role==='mainline'?`${p.route?`${p.route} 號 · `:''}${road} · ${p.direction}`:rampLabel(p)+(active?` · ${p.direction}`:'')+(p.connectionConfirmed?'':' · 示意');
    add(text,midpoint(f.geometry.coordinates),{className:`road-note ${p.role} ${active?'active':''}`,color:p.role==='mainline'?p.lineColor:'#c7d1da',priority:rank(f),click:()=>selectMovement(movementKey(p)),offset:[0,active?-24:-15]});
   });
  }else if(s&&!growthSession){
   const fs=facilityGeometry.get(s.id)||[],cs=fs.flatMap(f=>f.geometry.coordinates);
   add(`${s.name}\n${state.layer==='lower'?'下層備用通道 · 非日常開放':s.metrics[0][0]+' '+s.metrics[0][1]}`,s.coordinates,{className:'detail-name',color:kinds[s.kind].color,priority:10,offset:[0,-34]});
   for(const id of state.layer==='lower'?[]:s.routes){
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
  if(!$('#structure-layers').hidden){const r=$('#structure-layers').getBoundingClientRect();rects.push({left:r.left,right:r.right,top:r.top,bottom:r.bottom});}
  labels.sort((a,b)=>b.priority-a.priority).forEach(l=>{
   const p=map.project(l.coordinates),width=l.el.offsetWidth||l.el.textContent.length*13+16,height=l.el.offsetHeight||30;
   const options=l.flexible?[l.offset,[0,23],[0,-42],[0,46],[0,-65],[0,68]]:[l.offset];let chosen=null,rect=null;
   for(const offset of options){
    const r={left:p.x-width/2+offset[0],right:p.x+width/2+offset[0],top:p.y-height/2+offset[1],bottom:p.y+height/2+offset[1]};
    if(r.left>=8&&r.right<=w-8&&r.top>=84&&r.bottom<=h&&!rects.some(a=>r.left<a.right+8&&r.right>a.left-8&&r.top<a.bottom+5&&r.bottom>a.top-5)){chosen=offset;rect=r;break;}
   }
   l.el.hidden=!chosen;if(chosen){rects.push(rect);l.marker.setOffset(chosen);}

  });
 }
 map.on('move',refresh);map.on('resize',refresh);return {rebuild,refresh};
}
async function initMap(){
 if(!window.maplibregl){message('地圖引擎載入失敗，請重新整理。',true);return;}
 try{
  map=new maplibregl.Map({container:'map',style:'./data/basemap.json',center:[114.09,22.38],zoom:10,...MAP_LIMITS,attributionControl:false,renderWorldCopies:false,locale:{'Map.Title':'香港幹線探索地圖'}});
  map.touchZoomRotate.disableRotation();map.dragRotate.disable();map.touchPitch.disable();map.keyboard.disableRotation();
  map.addControl(new maplibregl.AttributionControl({compact:false}),'bottom-right');
  map.on('load',()=>{state.ready=true;addMapLayers();updateMap();if(state.view==='detail')fitFacility(false);else fit(state.route,false);$('#map-message').hidden=true;});
  map.on('error',e=>console.warn('Map resource:',e.error?.message));
  const resize=new ResizeObserver(()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>map.resize());});resize.observe($('#map'));
  setTimeout(()=>{if(!state.ready){message('底圖連線較慢，切換至簡潔路線圖…');map.setStyle({version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#08131d'}}]});}},18000);
 }catch(e){console.error(e);message('此瀏覽器無法啟用互動地圖，請使用支援 WebGL 的瀏覽器。',true);}
}
function refreshViewport(){
 if(!state.ready)return;document.body.dataset.mapLevel=mapDetailLevel(map.getZoom());
 if(growthSession||growthStartTimer||state.view==='detail'||performance.now()<suppressAutoUntil)return;
 if(blocksStructureDiscovery({view:state.view,panelExpanded:sheet.expanded,searchOpen:$('#search-dialog').open})){if(state.autoStructure){clearAuto();updateMap();}return;}
 const candidates=state.structures.filter(s=>s.kind==='interchange'||s.complex).map(s=>{
  const p=map.project(s.coordinates),cs=(facilityGeometry.get(s.id)||[]).flatMap(f=>f.geometry.coordinates).map(c=>map.project(c));
  const span=cs.length?Math.max(Math.max(...cs.map(c=>c.x))-Math.min(...cs.map(c=>c.x)),Math.max(...cs.map(c=>c.y))-Math.min(...cs.map(c=>c.y))):0;
  return {id:s.id,routes:s.routes,x:p.x,y:p.y,span};
 });
 const opts={zoom:map.getZoom(),width:$('#map').clientWidth,height:$('#map').clientHeight,top:90,bottom:sheet.visibleHeight+12,current:state.autoStructure,route:state.route};
 const id=automaticStructure(candidates,opts);
 if(autoDismissed){if(!automaticStructure(candidates.filter(c=>c.id===autoDismissed),{...opts,current:autoDismissed}))autoDismissed=null;else if(id===autoDismissed)return;}
 if(id===state.autoStructure)return;
 state.autoStructure=id;state.layer='all';state.movement=null;
 updateMap();$('#back-view').hidden=state.view==='overview'&&!id;
}
function openSearch(){
 stopGrowth({finish:true});clearTimeout(mapClickTimer);
 if(!state.routes.length){toast('資料仍在載入');return;}
 $('#search-dialog').showModal();renderSearch();$('#atlas-search').focus();
}
function renderSearch(){
 const rows=searchEntries($('#atlas-search').value,state.routes,state.structures);
 $('#search-results').innerHTML=rows.length?rows.map(r=>`<button data-search-type="${r.type}" data-id="${r.id}" style="--result-color:${r.color||'#8faabd'}"><strong>${esc(r.name)}</strong><small>${esc(r.sub)}</small></button>`).join(''):'<p>沒有相符的地點，試試「青馬」、「8」或「隧道」。</p>';
}
function bind(){
 sheet=createSheet({element:$('#explorer'),handle:$('#sheet-grip'),dragZone:$('#sheet-drag-zone'),content:$('#panel-body'),onChange:syncOcclusion,isHidden:()=>state.view==='overview'});
 $('#explorer').addEventListener('click',e=>{
  const r=e.target.closest('[data-route]'),s=e.target.closest('[data-structure]'),n=e.target.closest('[data-node]');
  if(r)selectRoute(Number(r.dataset.route));else if(s)selectStructure(s.dataset.structure);else if(n){const point=route()?.nodes[Number(n.dataset.node)],f=state.structures.find(s=>s.name===point?.name);if(f)selectStructure(f.id);else if(point){navigate(point.coordinates,13);toast(point.name);}}
 });
 $('#home-view').addEventListener('click',playOverview);
 $('#open-search').addEventListener('click',openSearch);$('#close-search').addEventListener('click',()=>$('#search-dialog').close());
 $('#atlas-search').addEventListener('input',renderSearch);
 $('#atlas-search').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#search-results button')?.click();}});
 $('#search-results').addEventListener('click',e=>{const b=e.target.closest('[data-search-type]');if(!b)return;$('#search-dialog').close();if(b.dataset.searchType==='route')selectRoute(Number(b.dataset.id));else selectStructure(b.dataset.id);});
 $('#search-dialog').addEventListener('close',()=>{mapLabels?.rebuild();refreshViewport();});
 $('#search-dialog').addEventListener('click',e=>{const r=$('#search-dialog').getBoundingClientRect();if(e.target===$('#search-dialog')&&(e.clientY<r.top||e.clientY>r.bottom||e.clientX<r.left||e.clientX>r.right))$('#search-dialog').close();});
 $('#back-view').addEventListener('click',back);
 $('#layer-options').addEventListener('click',e=>{
  const b=e.target.closest('[data-layer]');if(!b)return;const id=b.dataset.layer;stopGrowth();state.layer=id;state.movement=null;
  if(id==='all'||reduced){updateMap();return;}playStructure({target:id,delay:0});
 });
 $('#growth-skip').addEventListener('click',()=>stopGrowth({finish:true}));
 $('#layers-replay').addEventListener('click',()=>playStructure({delay:0}));
 $('#layers-details').addEventListener('click',()=>{if(structure())selectStructure(structure().id,{preserveCamera:true});});
 document.addEventListener('keydown',e=>{if($('#search-dialog').open)return;if(e.key==='Escape')back();if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();openSearch();}});
 window.addEventListener('hashchange',()=>{stopGrowth();clearAuto();Object.assign(state,parseScene(location.hash,state.routes,state.structures));detailReturn=null;render();if(state.view==='detail')fitFacility();else fit(state.route);});
}
async function main(){
 bind();try{
  const load=async url=>{const r=await fetch(url);if(!r.ok)throw Error(url);return r.json();};
  const [r,g,s,j,p,b,h]=await Promise.all(['routes.json','routes.geojson','structures.json','interchanges.geojson','places.json','bridge-decks.geojson','history.json'].map(f=>load('./data/'+f)));
  for(const f of s.structures){const decks=b.features.filter(x=>x.properties.structure===f.id);facilityGeometry.set(f.id,decks.length?decks:facilityFeatures(g.features,f,j.features));}
  Object.assign(state,{routes:r.routes,geo:g,structures:s.structures,interchanges:j,places:p.places,history:h},parseScene(location.hash,r.routes,s.structures));render();await initMap();
 }catch(e){console.error(e);message('資料載入失敗，請重新整理後再試。',true);}
}
main();
