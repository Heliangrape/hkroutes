import {createSheet} from './sheet.js';
import {fitZoom,isSmall} from './camera.js';
import {facilityFeatures,createTraffic} from './traffic.js';
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=(s)=>`<svg viewBox="0 0 20 20" aria-hidden="true">${s}</svg>`;
const icons={bridge:icon('<path d="M2 15h16M5 17V4m10 13V4M2 9l3-4 5 5 5-5 3 4M5 10v5m10-5v5"/>'),tunnel:icon('<path d="M3 17V9a7 7 0 0 1 14 0v8M6 17V9a4 4 0 0 1 8 0v8M10 13v4"/>'),play:icon('<path d="m6 3 10 7-10 7Z"/>'),share:icon('<rect x="5" y="7" width="10" height="10" rx="2"/><path d="M8 4h8a1 1 0 0 1 1 1v8"/>'),search:icon('<circle cx="8" cy="8" r="5.5"/><path d="m12 12 5 5"/>')};
const kinds={bridge:{name:'橋梁',color:'#6cbdf9'},tunnel:{name:'隧道',color:'#edb86b'}};
const state={routes:[],geo:null,structures:[],mode:'routes',view:'browse',route:null,structure:null,node:null,query:'',ready:false,tour:null};
let map,sheet,traffic,badges=[],structureMarkers=[],resizeFrame,toastTimer;
const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
const route=()=>state.routes.find(r=>r.id===state.route);
const structure=()=>state.structures.find(s=>s.id===state.structure);
const shield=n=>`<span class="shield" aria-hidden="true">${n}</span>`;
function message(text,error=false){$('#map-message').textContent=text;$('#map-message').classList.toggle('error',error);$('#map-message').hidden=false;}
function toast(text){$('.toast')?.remove();clearTimeout(toastTimer);const el=document.createElement('div');el.className='toast';el.setAttribute('role','status');el.textContent=text;$('.map-stage').append(el);toastTimer=setTimeout(()=>el.remove(),3200);}
function padding(visible=sheet?.visibleHeight||0){
 const h=$('#map').clientHeight;
 if(state.view==='overview')return {top:20,bottom:20,left:25,right:25};
 return sheet?.overlay?{top:0,bottom:Math.min(visible+(state.view==='focus'?10:0),h-1),left:25,right:25}:{top:75,bottom:40,left:45,right:45};
}
function syncOcclusion(visible){
 if(map&&state.ready)map.jumpTo({padding:padding(visible)});
 $('#tour-bar').style.bottom=isSmall()?`${visible+14}px`:'44px';
 $('#map').style.setProperty('--map-bottom',isSmall()?`${visible+5}px`:'0px');
}
function navigate(center,zoom,animate=true){
 if(!map||!state.ready)return;
 map.easeTo({center,zoom,padding:padding(),pitch:0,bearing:0,duration:animate&&!reduced&&!sheet.animating?650:0});
}
function fit(id=null,animate=true){
 if(!state.ready)return;
 map.resize();
 const coords=state.geo.features.filter(f=>!id||f.properties.route===id).flatMap(f=>f.geometry.coordinates);
 // Zoom always uses the collapsed panel's available space. Expanded state affects only visual center.
 const p=state.view==='overview'?{top:45,bottom:45,left:45,right:45}:sheet.overlay?{top:45,bottom:sheet.peekHeight+45,left:30,right:30}:padding(0);
 const camera=fitZoom(coords,$('#map').clientWidth,$('#map').clientHeight,{...p,maxZoom:12.7});
 navigate(camera.center,camera.zoom,animate);
}
function fitFacility(animate=true){
 if(!state.ready||!structure())return;
 map.resize();const features=facilityFeatures(state.geo.features,structure());
 const coords=features.flatMap(f=>f.geometry.coordinates);
 if(!coords.length){navigate(structure().coordinates,13.2,animate);return;}
 const p={top:65,bottom:sheet.peekHeight+65,left:65,right:65};
 const camera=fitZoom(coords,$('#map').clientWidth,$('#map').clientHeight,{...p,maxZoom:14.1});
 navigate(camera.center,camera.zoom,animate);
}
function hash(){
 const value=state.view==='overview'?'#overview=1':state.mode==='structures'?`#mode=structures${state.structure?`&structure=${state.structure}`:''}`:state.route?`#route=${state.route}`:'';
 history.replaceState(null,'',location.pathname+location.search+value);
}
function selectRoute(id,{zoom=true,writeHash=true}={}){
 stopTour();state.mode='routes';state.route=id;state.structure=null;state.node=null;state.view=id?'focus':'browse';render({focusReset:Boolean(id)});if(writeHash)hash();if(zoom)fit(id);
}
function selectStructure(id,{zoom=true,writeHash=true}={}){
 stopTour();state.mode='structures';state.structure=id;state.view=id?'focus':'browse';render({focusReset:Boolean(id)});if(writeHash)hash();if(zoom)fitFacility();
}
function setMode(mode){stopTour();state.mode=mode;state.view='browse';state.route=null;state.structure=null;state.node=null;render();hash();fit();}
function browseAll(mode='routes'){stopTour();state.mode=mode;state.view='browse';state.route=null;state.structure=null;state.node=null;render();hash();fit();}
function clearSelection(){browseAll(state.mode);}
function enterOverview(){stopTour();state.mode='routes';state.view='overview';state.route=null;state.structure=null;state.node=null;render();hash();fit();}
function render({focusReset=false}={}){
 document.body.dataset.view=state.view;
 document.body.classList.toggle('view-focus',state.view==='focus');document.body.classList.toggle('view-overview',state.view==='overview');
 document.querySelectorAll('[data-mode]').forEach(b=>{const active=b.dataset.mode===state.mode;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
 const r=route(),s=structure();
 $('#panel-eyebrow').textContent=state.mode==='routes'?'HONG KONG ROUTES':'BRIDGES & TUNNELS';
 $('#panel-title').textContent=state.mode==='routes'?(r?`${r.id} 號幹線`:'全部幹線'):(s?s.name:'橋梁與隧道');
 $('#focus-label').textContent=state.mode==='routes'&&r?`${r.id} 號幹線 · ${r.endpoints}`:s?.name||'查看詳情';
 if(state.mode==='routes'){
  $('#quick-select').innerHTML=state.routes.map(r=>`<button data-route="${r.id}" class="${state.route===r.id?'active':state.route?'desaturated':''}" aria-label="${r.id}號幹線，${esc(r.endpoints)}" aria-pressed="${state.route===r.id}">${shield(r.id)}</button>`).join('');
  $('#quick-select').setAttribute('aria-label','選擇幹線編號');renderRoutes();
  $('#map-legend').innerHTML=r?`<span class="route-legend-swatch" style="--route:${r.color}"></span>${r.id} 號幹線`:'10 條主要幹線';
 }else{
  const counts=kind=>state.structures.filter(s=>s.kind===kind).length;
  $('#quick-select').innerHTML=`<div class="structure-counts"><span class="legend-key" style="--kind:${kinds.bridge.color}"><i class="legend-dot"></i>橋梁 ${counts('bridge')}</span><span class="legend-key" style="--kind:${kinds.tunnel.color}"><i class="legend-dot"></i>隧道 ${counts('tunnel')}</span></div>`;
  $('#quick-select').setAttribute('aria-label','橋隧顏色圖例');renderStructures();
  $('#map-legend').innerHTML=Object.values(kinds).map(k=>`<span class="legend-key" style="--kind:${k.color}"><i class="legend-dot"></i>${k.name}</span>`).join('');
 }
 sheet.contextChanged(focusReset);$('#panel-body').scrollTop=0;updateMap();
}
function renderRoutes(){
 const r=route();
 if(!r){
  $('#panel-content').innerHTML=`<p class="content-intro">十條幹線，串起香港。<br>選一條路線，看看它經過哪裡。</p><label class="search-wrap">${icons.search}<input id="search" type="search" aria-label="搜尋幹線或地區" placeholder="搜尋幹線、地區或橋隧" value="${esc(state.query)}"></label><div id="catalog"></div>`;
  renderCatalog();$('#search').addEventListener('input',e=>{state.query=e.target.value;renderCatalog();});return;
 }
 $('#panel-content').innerHTML=`<button class="back-button" data-action="back">全部幹線</button><div style="--route:${r.color}"><h2 class="detail-tagline">${esc(r.tagline)}</h2><div class="detail-endpoints">${esc(r.endpoints)}</div><p class="detail-description">${esc(r.description)}</p>${r.hasConstruction?'<p class="construction-note">虛線路段為建造中，請以官方通車安排為準。</p>':''}<div class="detail-actions"><button class="primary-button" id="start-tour">${icons.play}沿線探索</button><button class="icon-button" id="share-route" aria-label="複製路線連結">${icons.share}</button></div><h3 class="section-label">沿線地點</h3><ol class="node-list">${r.nodes.map((n,i)=>`<li class="${state.node===i?'current':''}"><button data-node="${i}" aria-label="定位${esc(n.name)}"><span>${esc(n.name)}</span><small>${n.kind}</small></button></li>`).join('')}</ol><a class="detail-link" href="${r.source}" target="_blank" rel="noopener">運輸署路線圖</a></div>`;
 $('#start-tour').addEventListener('click',startTour);$('#share-route').addEventListener('click',share);
}
function renderCatalog(){
 const q=state.query.trim().toLowerCase();const rows=state.routes.filter(r=>!q||`${r.id}號幹線 ${r.endpoints} ${r.nodes.map(n=>n.name).join(' ')}`.toLowerCase().includes(q));
 $('#catalog').innerHTML=rows.length?rows.map(r=>`<button class="route-row" data-route="${r.id}" style="--route:${r.color}">${shield(r.id)}<span><span class="row-title">${r.id} 號幹線<span class="row-color"></span></span><span class="row-endpoints">${esc(r.endpoints)}</span></span></button>`).join(''):'<p class="empty-results">找不到相符的路線。試試「沙田」或「青馬」。</p>';
}
function renderStructures(){
 const s=structure();
 if(!s){
  $('#panel-content').innerHTML=`<p class="content-intro">跨海，穿山。<br>點選地圖上的藍色橋梁、琥珀色隧道，或從下方瀏覽。</p><div class="structure-list">${state.structures.map(s=>`<button class="structure-row" data-structure="${s.id}"><img src="./${s.image}" alt="" loading="lazy" width="66" height="60"><span><strong>${esc(s.name)}</strong><small><span style="color:${kinds[s.kind].color}">${kinds[s.kind].name}</span> · ${esc(s.metrics[0][1])}</small></span></button>`).join('')}</div>`;return;
 }
 const k=kinds[s.kind];
 $('#panel-content').innerHTML=`<button class="back-button" data-action="back">全部橋隧</button><div class="parent-routes"><span>所屬幹線</span><div class="related-route">${s.routes.map(id=>`<button data-route="${id}">${shield(id)}返回 ${id} 號幹線</button>`).join('')}</div></div><figure class="photo"><img src="./${s.image}" alt="${esc(s.imageCaption)}"><figcaption>${esc(s.imageCaption)}<br>圖片：<a href="${s.imageSource}" target="_blank" rel="noopener">${esc(s.imageCredit)}</a></figcaption></figure><div class="structure-type" style="--kind:${k.color}">${icons[s.kind]}${k.name}</div><p class="detail-description">${esc(s.summary)}</p><dl class="metrics" style="--kind:${k.color}">${s.metrics.map(([label,value])=>`<div class="metric"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl><a class="detail-link" href="${s.source}" target="_blank" rel="noopener">查看官方資料</a>`;
}
function updateMap(){
 if(!state.ready)return;
 const focused=state.view==='focus',allGray=state.mode==='structures';
 const original=['match',['get','route'],...state.routes.flatMap(r=>[r.id,r.color]),'#89918b'];
 const selected=['==',['get','route'],state.route??-1];
 const color=focused?(allGray?'#29404b':['case',selected,original,'#29404b']):allGray?'#687873':original;
 const width=['interpolate',['linear'],['zoom'],8,1.8,10,2.8,12,4.3,16,8];
 for(const layer of ['routes-line','routes-construction']){
  map.setPaintProperty(layer,'line-color',color);
  map.setPaintProperty(layer,'line-opacity',focused?(allGray?.22:['case',selected,1,.22]):.9);
  const w=n=>focused?(allGray?1.1:['case',selected,n,1.1]):n;
  map.setPaintProperty(layer,'line-width',['interpolate',['linear'],['zoom'],8,w(1.8),10,w(2.8),12,w(4.3),16,w(8)]);
 }
 map.setPaintProperty('scene-veil','fill-opacity',focused?.78:state.view==='overview'?.48:0);
 for(const layer of map.getStyle().layers)if(layer.type==='symbol')map.setLayoutProperty(layer.id,'visibility',state.view==='browse'?'visible':'none');
 const facility=focused&&allGray?structure():null;
 const features=facility?facilityFeatures(state.geo.features,facility):[];
 map.getSource('facility').setData({type:'FeatureCollection',features});
 const activeColor=facility?kinds[facility.kind].color:route()?.color||'#d6edaa';
 for(const layer of ['facility-line','facility-glow','traffic-glow'])map.setPaintProperty(layer,'line-color',activeColor);
 map.setFilter('route-glow',focused&&!allGray?selected:['==',['get','route'],-1]);map.setPaintProperty('route-glow','line-color',activeColor);
 badges.forEach(({id,marker})=>{const b=marker.getElement();b.classList.toggle('desaturated',allGray||Boolean(state.route&&id!==state.route));b.classList.toggle('selected',!allGray&&id===state.route);b.disabled=allGray;});
 renderStructurePins();
 if(focused)traffic.start(facility?features:state.geo.features.filter(f=>f.properties.route===state.route));else traffic.stop();
}
function renderStructurePins(){
 structureMarkers.forEach(m=>m.remove());structureMarkers=[];if(state.mode!=='structures'||state.view!=='browse'||!state.ready)return;
 state.structures.forEach(s=>{
  const b=document.createElement('button');b.className=`structure-pin ${s.id===state.structure?'selected':''}`;b.style.setProperty('--kind',kinds[s.kind].color);b.setAttribute('aria-label',`${s.name}，${kinds[s.kind].name}`);b.innerHTML=`${icons[s.kind]}<span class="pin-name">${esc(s.name)}</span>`;b.addEventListener('click',e=>{e.stopPropagation();selectStructure(s.id);});
  structureMarkers.push(new maplibregl.Marker({element:b}).setLngLat(s.coordinates).addTo(map));
 });
}
function focusNode(i,{tour=false}={}){
 const r=route(),n=r?.nodes[i];if(!n)return;
 const facility=state.structures.find(s=>s.name===n.name);
 if(!tour&&facility){selectStructure(facility.id);return;}
 if(!tour)stopTour();state.node=i;
 $('#panel-content').querySelectorAll('[data-node]').forEach(b=>b.closest('li').classList.toggle('current',Number(b.dataset.node)===i));
 navigate(n.coordinates,tour?13:13.3);if(!tour)toast(n.name);
}
function startTour(){
 if(!state.ready){toast('地圖仍在載入');return;}const r=route();if(!r)return;stopTour();
 sheet.contextChanged(true);state.tour={index:0,timer:null};$('#tour-bar').hidden=false;
 const step=()=>{if(!state.tour)return;const i=state.tour.index;if(i>=r.nodes.length){stopTour();return;}$('#tour-label').textContent=`${i+1} / ${r.nodes.length}　${r.nodes[i].name}`;focusNode(i,{tour:true});state.tour.index++;state.tour.timer=setTimeout(step,5500);};step();
}
function stopTour(){if(state.tour)clearTimeout(state.tour.timer);state.tour=null;$('#tour-bar').hidden=true;}
async function share(){try{await navigator.clipboard.writeText(location.href);toast('路線連結已複製');}catch{toast('可從網址列複製此路線連結');}}
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
 map.addLayer({id:'facility-hit',type:'line',source:'facility',paint:{'line-color':'#fff','line-width':20,'line-opacity':0}});
 map.addSource('traffic',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
 map.addLayer({id:'traffic-glow',type:'line',source:'traffic',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#7aafff','line-width':6,'line-blur':3,'line-opacity':['*',['get','alpha'],.55]}});
 map.addLayer({id:'traffic-head',type:'line',source:'traffic',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#f4fcff','line-width':1.5,'line-opacity':['get','alpha']}});
 traffic=createTraffic(map,reduced);
 map.on('click',e=>{
  if(state.view==='focus'&&state.structure&&map.queryRenderedFeatures(e.point,{layers:['facility-hit']}).length)return;
  const routes=map.queryRenderedFeatures(e.point,{layers:['routes-hit']});
  if(routes.length)selectRoute(Number(routes[0].properties.route));else browseAll();
 });
 map.on('mousemove',e=>{map.getCanvas().style.cursor=map.queryRenderedFeatures(e.point,{layers:['routes-hit','facility-hit']}).length?'pointer':'';});
 const positions={1:[114.181,22.337],2:[114.218,22.358],3:[114.057,22.407],4:[114.213,22.292],5:[114.131,22.357],6:[114.19,22.322],7:[114.18,22.343],8:[114.028,22.334],9:[114.159,22.469],10:[113.966,22.451]};
 state.routes.forEach(r=>{const b=document.createElement('button');b.className='map-badge';b.setAttribute('aria-label',`探索${r.id}號幹線`);b.innerHTML=shield(r.id);b.addEventListener('click',()=>selectRoute(r.id));badges.push({id:r.id,marker:new maplibregl.Marker({element:b}).setLngLat(positions[r.id]).addTo(map)});});
 const places=[['大嶼山','LANTAU ISLAND',113.996,22.275,true],['香港島','HONG KONG ISLAND',114.204,22.247,true],['九龍','KOWLOON',114.181,22.307,true],['新界','NEW TERRITORIES',114.118,22.44,true],['深圳','SHENZHEN',114.028,22.547,true],['屯門','TUEN MUN',113.96,22.397],['元朗','YUEN LONG',114.028,22.463],['大埔','TAI PO',114.168,22.453],['沙田','SHA TIN',114.208,22.378],['荃灣','TSUEN WAN',114.113,22.386],['赤鱲角','CHEK LAP KOK',113.915,22.323],['青衣','TSING YI',114.091,22.349],['維多利亞港','VICTORIA HARBOUR',114.187,22.294]];
 places.forEach(([name,en,x,y,region])=>{const el=document.createElement('div');el.className=`place-label ${region?'region':''}`;el.innerHTML=`${name}<small>${en}</small>`;new maplibregl.Marker({element:el}).setLngLat([x,y]).addTo(map);el.setAttribute('role','presentation');el.setAttribute('aria-hidden','true');el.tabIndex=-1;});
 function badgeSize(){$('#map').style.setProperty('--badge-scale',String(Math.max(.8,Math.min(1.18,1+(map.getZoom()-10)*.065))));}map.on('zoom',badgeSize);badgeSize();
}
async function initMap(){
 if(!window.maplibregl){message('地圖引擎載入失敗，請重新整理。',true);return;}
 try{
  map=new maplibregl.Map({container:'map',style:'./data/basemap.json',center:[114.09,22.38],zoom:10,minZoom:6,maxZoom:17,attributionControl:false,renderWorldCopies:false,locale:{'Map.Title':'香港幹線探索地圖','AttributionControl.ToggleAttribution':'顯示地圖來源'}});
  map.addControl(new maplibregl.AttributionControl({compact:false}),'bottom-right');
  map.on('load',()=>{state.ready=true;addMapLayers();updateMap();fit(state.mode==='routes'?state.route:null,false);if(state.mode==='structures'&&structure())fitFacility(false);$('#map-message').hidden=true;});
  map.on('dragstart',stopTour);
  map.on('error',e=>console.warn('Map resource:',e.error?.message));
  const resize=new ResizeObserver(()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{map.resize();});});resize.observe($('#map'));
  setTimeout(()=>{if(!state.ready){message('底圖連線較慢，切換至簡潔路線圖…');map.setStyle({version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#102630'}}]});}},18000);
 }catch(e){console.error(e);message('此瀏覽器無法啟用互動地圖，仍可從面板瀏覽路線與橋隧。',true);}
}
function bind(){
 sheet=createSheet({element:$('#explorer'),handle:$('#sheet-grip'),dragZone:$('#sheet-drag-zone'),content:$('#panel-body'),onChange:syncOcclusion,isFocus:()=>state.view==='focus',isHidden:()=>state.view==='overview'});
 document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
 $('#explorer').addEventListener('click',e=>{const r=e.target.closest('[data-route]'),s=e.target.closest('[data-structure]'),n=e.target.closest('[data-node]');if(r)selectRoute(Number(r.dataset.route));else if(s)selectStructure(s.dataset.structure);else if(n)focusNode(Number(n.dataset.node));else if(e.target.closest('[data-action="back"]'))clearSelection();});
 $('#overview').addEventListener('click',enterOverview);$('#tour-stop').addEventListener('click',stopTour);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){browseAll();}if(e.key==='/'&&$('#search')&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();if(!$('#panel-body').inert)$('#search').focus();}});
 window.addEventListener('hashchange',()=>readHash(true));document.addEventListener('visibilitychange',()=>{if(document.hidden)stopTour();});
}
function readHash(update=false){
 const h=new URLSearchParams(location.hash.slice(1)),id=Number(h.get('route')),sid=h.get('structure');
 state.mode=h.get('mode')==='structures'||sid?'structures':'routes';state.route=state.routes.some(r=>r.id===id)?id:null;state.structure=state.structures.some(s=>s.id===sid)?sid:null;
 state.view=h.get('overview')==='1'?'overview':state.structure||state.route?'focus':'browse';
 if(update){stopTour();render({focusReset:state.view==='focus'});if(state.mode==='structures'&&structure())fitFacility();else fit(state.mode==='routes'?state.route:null);}
}
async function main(){
 bind();try{
  const load=async url=>{const r=await fetch(url);if(!r.ok)throw Error(url);return r.json();};const [r,g,s]=await Promise.all([load('./data/routes.json'),load('./data/routes.geojson'),load('./data/structures.json')]);state.routes=r.routes;state.geo=g;state.structures=s.structures;readHash();render({focusReset:state.view==='focus'});await initMap();
 }catch(e){console.error(e);message('資料載入失敗，請重新整理後再試。',true);}
}
main();
