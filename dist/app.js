const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const svg = (content) => `<svg viewBox="0 0 20 20" aria-hidden="true">${content}</svg>`;
const icons = {
 play: svg('<path d="m6 3 10 7-10 7Z"/>'),
 share: svg('<rect x="5" y="7" width="10" height="10" rx="2"/><path d="M8 4h8a1 1 0 0 1 1 1v8"/>'),
 node: svg('<circle cx="10" cy="10" r="3"/><circle cx="10" cy="10" r="7"/>')
};
const state = {routes:[],geo:null,selected:null,filter:'全部',query:'',landmarkLayer:null,node:null,mapReady:false,tour:null};
let map, badgeMarkers=[], nodeMarkers=[], placeMarkers=[], hoverPopup, toastTimer, mapErrorShown=false;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function message(text,error=false) {
 const el=$('#map-message');el.textContent=text;el.classList.toggle('error',error);el.hidden=false;
}
function toast(text) {
 document.querySelector('.toast')?.remove();clearTimeout(toastTimer);
 const el=document.createElement('div');el.className='toast';el.setAttribute('role','status');el.textContent=text;$('.map-stage').append(el);
 toastTimer=setTimeout(()=>el.remove(),3500);
}
function listRoutes() {
 const q=state.query.toLowerCase().trim();
 const routes=state.routes.filter(r=>(state.filter==='全部'||r.orientation===state.filter)&&(!q||`${r.id}號幹線 ${r.endpoints} ${r.nodes.map(n=>n.name).join(' ')} route ${r.id}`.toLowerCase().includes(q)));
 $('#route-count').textContent=`${routes.length} 條路線`;
 $('#route-list').innerHTML=routes.length?routes.map(r=>`<button class="route-row ${r.id===state.selected?'selected':''}" data-route="${r.id}" style="--route:${r.color}" aria-pressed="${r.id===state.selected}" aria-label="${r.id}號幹線，${esc(r.endpoints)}"><span class="shield" aria-hidden="true">${r.id}</span><span class="route-row-content"><span class="route-row-title">${r.id} 號幹線<span class="route-swatch"></span></span><span class="route-row-endpoints">${esc(r.endpoints)}${r.hasConstruction?'<small>含建造中</small>':''}</span></span></button>`).join(''):'<p class="empty-results">暫時找不到相符的幹線。<br>試試「青馬」、「沙田」或路線號碼。</p>';
 $('#route-list').querySelectorAll('[data-route]').forEach(el=>el.addEventListener('click',()=>selectRoute(Number(el.dataset.route))));
}
function setSidebar(open) {
 const sidebar=$('.sidebar');sidebar.classList.toggle('open',open);
 sidebar.inert=innerWidth<=760&&!open;
 $('#mobile-routes').setAttribute('aria-expanded',String(open));
}
function renderDetail() {
 const r=state.routes.find(r=>r.id===state.selected);
 const el=$('#detail');
 if(!r){
  el.classList.add('overview-detail');el.innerHTML=`<div class="eyebrow">EXPLORE HONG KONG</div><h2>沿著幹線，<br>看見城市的連繫。</h2><p>跨海的橋、穿山的隧道，<br>每一條路線，都是認識香港的新視角。</p><div class="overview-stat"><strong>10</strong><span>條主要幹線</span></div><div class="detail-divider"></div><p>點選地圖上的路線或左側列表，<br>開始你的沿線探索。</p><button class="tour-button" id="featured-route">探索 8 號幹線</button>`;
  $('#featured-route').addEventListener('click',()=>selectRoute(8));return;
 }
 el.classList.remove('overview-detail');el.style.setProperty('--selected',r.color);
 el.innerHTML=`<div class="detail-topline"><div class="detail-route-label"><span class="shield" aria-hidden="true">${r.id}</span><span>${r.id} 號幹線</span></div><span class="detail-direction">${r.orientation==='環迴'?'新界環迴':r.orientation+'走向'}</span></div><h2>${esc(r.tagline)}</h2><div class="detail-endpoints">${esc(r.endpoints)}</div><p class="detail-description">${esc(r.description)}</p><div class="detail-meta">${icons.node}<span>${r.nodes.length} 個精選沿線節點</span><a href="${r.source}" target="_blank" rel="noopener">官方路線圖</a></div>${r.hasConstruction?'<p class="construction-note">含建造中路段，地圖以虛線顯示。請以官方最新通車安排為準。</p>':''}<div class="detail-divider"></div><div class="node-header">沿線節點<span>點選定位</span></div><ol class="node-list">${r.nodes.map((n,i)=>`<li class="${i===state.node?'current':''}"><button data-node="${i}" aria-label="定位${esc(n.name)}"><span>${esc(n.name)}</span><small>${n.kind}</small></button></li>`).join('')}</ol><div class="detail-actions"><button class="tour-button" id="start-tour">${icons.play}沿線探索</button><button class="share-button" id="share-route" aria-label="複製此幹線連結" title="複製此幹線連結">${icons.share}</button></div>`;
 el.querySelectorAll('[data-node]').forEach(b=>b.addEventListener('click',()=>focusNode(Number(b.dataset.node))));
 $('#start-tour').addEventListener('click',startTour);$('#share-route').addEventListener('click',shareRoute);
}
function fitRoute(id,animate=true) {
 if(!map||!state.mapReady)return;
 const coords=state.geo.features.filter(f=>!id||f.properties.route===id).flatMap(f=>f.geometry.coordinates);
 const bounds=new maplibregl.LngLatBounds();coords.forEach(c=>bounds.extend(c));
 const mobile=innerWidth<=760;
 const right=mobile?35:Math.min(395,map.getContainer().clientWidth*.4);
 const bottom=mobile?$('#detail').getBoundingClientRect().height+80:90;
 map.fitBounds(bounds,{padding:{top:mobile?100:110,right,bottom,left:mobile?35:65},maxZoom:12.7,duration:animate&&!reducedMotion?900:0,bearing:0,pitch:0,retainPadding:false});
}
function selectRoute(id,{fit=true,hash=true}={}) {
 stopTour(false);hoverPopup?.remove();state.selected=id;state.node=null;
 if(hash)history.replaceState(null,'',id?`#route=${id}`:location.pathname+location.search);
 listRoutes();renderDetail();updateMap();
 if(fit)fitRoute(id);setSidebar(false);
}
function updateMap() {
 if(!state.mapReady)return;
 const selected=state.selected;
 map.setPaintProperty('routes-line','line-opacity',selected?['case',['==',['get','route'],selected],1,.22]:.9);
 map.setPaintProperty('routes-construction','line-opacity',selected?['case',['==',['get','route'],selected],1,.2]:.9);
 map.setFilter('routes-selected',selected?['==',['get','route'],selected]:['==',['get','route'],-1]);
 badgeMarkers.forEach(({marker,id})=>{const el=marker.getElement();el.classList.toggle('muted',Boolean(selected&&id!==selected));el.classList.toggle('selected',id===selected);});
 renderNodes();
}
function renderNodes() {
 nodeMarkers.forEach(m=>m.remove());nodeMarkers=[];
 if(!state.mapReady)return;
 const route=state.routes.find(r=>r.id===state.selected);
 const routes=state.landmarkLayer?state.routes:(route?[route]:[]);
 const points=new Set();
 routes.forEach(r=>r.nodes.forEach((n,i)=>{
  if(state.landmarkLayer&&n.kind!==state.landmarkLayer)return;
  const key=n.name;if(points.has(key))return;points.add(key);
  const b=document.createElement('button');b.className=`landmark-marker ${r.id===state.selected&&i===state.node?'current':''}`;b.style.setProperty('--route',r.color);b.setAttribute('aria-label',`${n.name}，${n.kind}，${r.id}號幹線`);
  const label=document.createElement('span');label.className='landmark-name';label.textContent=n.name;b.append(label);
  b.addEventListener('click',e=>{e.stopPropagation();if(state.selected!==r.id)selectRoute(r.id,{fit:false});focusNode(i);});
  const marker=new maplibregl.Marker({element:b}).setLngLat(n.coordinates).addTo(map);nodeMarkers.push(marker);
 }));
}
function focusNode(index,{tour=false}={}) {
 const r=state.routes.find(r=>r.id===state.selected);if(!r?.nodes[index])return;
 if(!tour)stopTour(false);state.node=index;renderDetail();renderNodes();
 if(state.mapReady){
  const offset=innerWidth<=760?[0,-Math.min(innerHeight*.13,100)]:[-105,0];
  map.flyTo({center:r.nodes[index].coordinates,zoom:tour?13:13.4,padding:0,pitch:0,bearing:0,offset,duration:reducedMotion?0:1600,essential:false});
 }
}
async function shareRoute() {
 try{await navigator.clipboard.writeText(location.href);toast('幹線連結已複製');}
 catch{const input=document.createElement('input');input.value=location.href;input.style.position='fixed';input.style.top='-999px';document.body.append(input);input.select();const copied=document.execCommand('copy');input.remove();toast(copied?'幹線連結已複製':'目前網址已包含此幹線，可從網址列複製。');}
}
function startTour() {
 const r=state.routes.find(r=>r.id===state.selected);if(!r)return;
 if(!state.mapReady){toast('地圖尚未就緒，請稍後開始沿線探索。');return;}
 stopTour(false);state.landmarkLayer=null;
 ['roads','bridges','tunnels'].forEach(name=>{const b=$(`#layer-${name}`);b.classList.toggle('active',name==='roads');b.setAttribute('aria-pressed',name==='roads');});
 state.tour={index:0,timer:null};$('.map-stage').classList.add('touring');$('#tour-bar').hidden=false;
 const step=()=>{
  if(!state.tour)return;
  const i=state.tour.index;
  if(i>=r.nodes.length){stopTour();toast(`${r.id} 號幹線探索完成`);return;}
  $('#tour-label').textContent=`${i+1} / ${r.nodes.length}　${r.nodes[i].name}`;
  $('#tour-progress').style.width=`${(i+1)/r.nodes.length*100}%`;
  focusNode(i,{tour:true});state.tour.index++;state.tour.timer=setTimeout(step,reducedMotion?6500:5500);
 };step();
}
function stopTour(refit=true) {
 if(!state.tour)return;
 clearTimeout(state.tour.timer);state.tour=null;$('.map-stage').classList.remove('touring');$('#tour-bar').hidden=true;
 if(map)map.stop();if(refit)fitRoute(state.selected);
}
function addMapLayers() {
 const color=['match',['get','route'],...state.routes.flatMap(r=>[r.id,r.color]),'#ffffff'];
 map.addSource('hk-routes',{type:'geojson',data:state.geo});
 map.addLayer({id:'routes-casing',type:'line',source:'hk-routes',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#081e26','line-width':['interpolate',['linear'],['zoom'],8,3,12,7,16,14],'line-opacity':.9}});
 map.addLayer({id:'routes-selected',type:'line',source:'hk-routes',filter:['==',['get','route'],-1],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':color,'line-width':['interpolate',['linear'],['zoom'],8,7,12,13,16,22],'line-opacity':.16,'line-blur':3}});
 map.addLayer({id:'routes-line',type:'line',source:'hk-routes',filter:['!=',['get','status'],'construction'],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':color,'line-width':['interpolate',['linear'],['zoom'],8,1.7,10,2.7,12,4.3,16,8.5],'line-opacity':.9}});
 map.addLayer({id:'routes-construction',type:'line',source:'hk-routes',filter:['==',['get','status'],'construction'],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':color,'line-width':['interpolate',['linear'],['zoom'],8,2,12,4,16,8],'line-dasharray':[2,2],'line-opacity':.9}});
 map.addLayer({id:'routes-hit',type:'line',source:'hk-routes',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#fff','line-width':['interpolate',['linear'],['zoom'],8,14,14,22],'line-opacity':0}});
 map.on('click','routes-hit',e=>{if(e.features?.length)selectRoute(e.features[0].properties.route);});
 map.on('mouseenter','routes-hit',()=>map.getCanvas().style.cursor='pointer');
 map.on('mouseleave','routes-hit',()=>{map.getCanvas().style.cursor='';hoverPopup?.remove();});
 map.on('mousemove','routes-hit',e=>{
  if(!e.features?.length||state.tour)return;
  const r=state.routes.find(r=>r.id===e.features[0].properties.route);if(!r)return;
  const box=document.createElement('div');const h=document.createElement('h3');h.textContent=`${r.id} 號幹線`;const p=document.createElement('p');p.textContent=r.endpoints;box.append(h,p);
  if(!hoverPopup)hoverPopup=new maplibregl.Popup({closeButton:false,closeOnClick:true,offset:12});
  hoverPopup.setLngLat(e.lngLat).setDOMContent(box).addTo(map);
 });
 addBadges();addPlaceLabels();
}
function addBadges() {
 const positions={1:[114.181,22.337],2:[114.218,22.358],3:[114.057,22.407],4:[114.213,22.292],5:[114.131,22.357],6:[114.19,22.322],7:[114.18,22.343],8:[114.028,22.334],9:[114.159,22.469],10:[113.966,22.451]};
 state.routes.forEach(r=>{
  const b=document.createElement('button');b.className='map-badge';b.setAttribute('aria-label',`探索${r.id}號幹線`);b.innerHTML=`<span class="shield">${r.id}</span>`;b.addEventListener('click',()=>selectRoute(r.id));
  const marker=new maplibregl.Marker({element:b}).setLngLat(positions[r.id]).addTo(map);badgeMarkers.push({marker,id:r.id});
 });
}
function addPlaceLabels() {
 const places=[['大嶼山','LANTAU ISLAND',113.996,22.275,true],['香港島','HONG KONG ISLAND',114.204,22.247,true],['九龍','KOWLOON',114.181,22.307,true],['新界','NEW TERRITORIES',114.118,22.44,true],['深圳','SHENZHEN',114.028,22.547,true],['屯門','TUEN MUN',113.96,22.397],['元朗','YUEN LONG',114.028,22.463],['大埔','TAI PO',114.168,22.453],['沙田','SHA TIN',114.208,22.378],['荃灣','TSUEN WAN',114.113,22.386],['赤鱲角','CHEK LAP KOK',113.915,22.323],['青衣','TSING YI',114.091,22.349],['維多利亞港','VICTORIA HARBOUR',114.187,22.294],['后海灣','DEEP BAY',113.971,22.494]];
 places.forEach(([name,en,x,y,region])=>{
  const el=document.createElement('div');el.className=`place-label ${region?'region':''}`;el.innerHTML=`${name}<small>${en}</small>`;
  const marker=new maplibregl.Marker({element:el}).setLngLat([x,y]).addTo(map);
  el.setAttribute('role','presentation');el.setAttribute('aria-hidden','true');el.tabIndex=-1;placeMarkers.push(marker);
 });
}
async function initMap() {
 if(!window.maplibregl){message('地圖引擎載入失敗，請重新整理。你仍可使用左側列表閱讀路線。',true);return;}
 try{
  map=new maplibregl.Map({container:'map',style:'./data/basemap.json',center:[114.09,22.38],zoom:10.25,minZoom:8,maxZoom:17,maxBounds:[[113.65,22.05],[114.65,22.75]],attributionControl:false,renderWorldCopies:false,locale:{'Map.Title':'香港幹線探索地圖','AttributionControl.ToggleAttribution':'顯示地圖來源'}});
  map.addControl(new maplibregl.AttributionControl({compact:true}),'bottom-right');map.addControl(new maplibregl.ScaleControl({maxWidth:90,unit:'metric'}),'bottom-left');
  map.on('load',()=>{state.mapReady=true;addMapLayers();updateMap();fitRoute(state.selected,false);$('#map-message').hidden=true;});
  map.on('error',e=>{
   console.warn('Map resource:',e.error?.message);
   if(!mapErrorShown){mapErrorShown=true;setTimeout(()=>{if(!map.areTilesLoaded()){message('部分底圖暫未載入，請檢查網絡。幹線資料仍可探索。',true);}},8000);}
  });
  map.on('idle',()=>{if(state.mapReady&&map.areTilesLoaded())$('#map-message').hidden=true;});
  setTimeout(()=>{
   if(!state.mapReady){message('底圖連線較慢，正在切換簡潔地圖…');map.setStyle({version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#10272d'}}]});}
  },18000);
 }catch(e){console.error(e);message('此瀏覽器暫時無法啟用互動地圖。你仍可從列表閱讀十條幹線與沿線節點。',true);}
}
function bindUI() {
 $('#search').addEventListener('input',e=>{state.query=e.target.value;listRoutes();});
 document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{
  state.filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>{const active=x===b;x.classList.toggle('active',active);x.setAttribute('aria-pressed',active);});listRoutes();
 }));
 $('#overview').addEventListener('click',()=>selectRoute(null));
 $('#zoom-in').addEventListener('click',()=>{if(state.mapReady)map.zoomIn({duration:reducedMotion?0:300});});
 $('#zoom-out').addEventListener('click',()=>{if(state.mapReady)map.zoomOut({duration:reducedMotion?0:300});});
 $('#north').addEventListener('click',()=>{if(state.mapReady)map.easeTo({bearing:0,pitch:0,duration:reducedMotion?0:600});});
 $('#tour-stop').addEventListener('click',()=>stopTour());
 const layerButtons=[['#layer-roads',null],['#layer-bridges','橋梁'],['#layer-tunnels','隧道']];
 layerButtons.forEach(([selector,kind])=>$(selector).addEventListener('click',()=>{
  state.landmarkLayer=kind;layerButtons.forEach(([s,k])=>{$(s).classList.toggle('active',k===kind);$(s).setAttribute('aria-pressed',k===kind);});renderNodes();
  if(kind){stopTour(false);fitRoute(null);toast(`顯示全港幹線的精選${kind}節點`);}
 }));
 const dialog=$('#about-dialog');$('#about-button').addEventListener('click',()=>{stopTour(false);dialog.showModal();});$('#about-close').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',e=>{const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});
 setSidebar(false);$('#mobile-routes').addEventListener('click',()=>setSidebar(!$('.sidebar').classList.contains('open')));
 $('#mobile-close').addEventListener('click',()=>{setSidebar(false);$('#mobile-routes').focus();});
 document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)&&!dialog.open){e.preventDefault();if(innerWidth<=760)setSidebar(true);$('#search').focus();}if(e.key==='Escape'){stopTour();setSidebar(false);}});
 window.addEventListener('hashchange',()=>{const id=Number(new URLSearchParams(location.hash.slice(1)).get('route'));selectRoute(state.routes.some(r=>r.id===id)?id:null,{hash:false});});
 let resizeTimer;window.addEventListener('resize',()=>{setSidebar($('.sidebar').classList.contains('open'));if(map)map.resize();clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(map&&!state.tour)fitRoute(state.selected,false);},120);});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopTour(false);});
}
async function main() {
 bindUI();
 try{
  const [data,geo]=await Promise.all([fetch('./data/routes.json').then(r=>{if(!r.ok)throw Error('Route metadata unavailable');return r.json();}),fetch('./data/routes.geojson').then(r=>{if(!r.ok)throw Error('Route geometry unavailable');return r.json();})]);
  state.routes=data.routes;state.geo=geo;
  const id=Number(new URLSearchParams(location.hash.slice(1)).get('route'));state.selected=state.routes.some(r=>r.id===id)?id:null;
  listRoutes();renderDetail();await initMap();
 }catch(e){console.error(e);message('路線資料載入失敗，請重新整理後再試。',true);$('#route-list').innerHTML='<p class="empty-results">路線資料暫時無法載入。<br>請檢查網絡後重新整理。</p>';}
}
main();
