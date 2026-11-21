// Browse preferences persist; an explicit selection enters a fresh, collapsed focus view.
export function createSheet({element,handle,dragZone,content,onChange,isFocus=()=>false,isHidden=()=>false}) {
 const small=()=>matchMedia('(max-width:760px)').matches;
 const overlay=()=>small()||isFocus();
 let expanded=false;
 try{expanded=localStorage.getItem('hk-atlas:sheet')==='expanded';}catch{}
 let progress=expanded?1:0,frame=0,drag=null,ignoreClick=false,animating=false;
 const peek=()=>Math.min(element.offsetHeight,isFocus()?handle.offsetHeight:dragZone.offsetHeight+element.querySelector('.quick-select').offsetHeight);
 const visibleHeight=()=>!isHidden()&&overlay()?peek()+(element.offsetHeight-peek())*progress:0;
 function draw(){
  element.style.setProperty('--sheet-shift',`${(element.offsetHeight-peek())*(1-progress)}px`);
  element.dataset.sheet=expanded?'expanded':'collapsed';
  handle.setAttribute('aria-expanded',String(expanded));
  element.querySelector('.sheet-hint').textContent=expanded?'下滑收起':'上滑展開';
  handle.setAttribute('aria-label',expanded?'收起面板（也可向下滑動）':'展開面板（也可向上滑動）');
  element.inert=isHidden();
  content.inert=isHidden()||overlay()&&!expanded;
  onChange(visibleHeight());
 }
 function settle(next){
  cancelAnimationFrame(frame);expanded=next;animating=true;
  if(!isFocus())try{localStorage.setItem('hk-atlas:sheet',next?'expanded':'collapsed');}catch{}
  const from=progress,to=next?1:0,start=performance.now();
  const step=now=>{const t=Math.min(1,(now-start)/260);progress=from+(to-from)*(1-(1-t)**3);draw();if(t<1)frame=requestAnimationFrame(step);else animating=false;};
  if(matchMedia('(prefers-reduced-motion:reduce)').matches){progress=to;animating=false;draw();}else frame=requestAnimationFrame(step);
 }
 handle.addEventListener('click',e=>{if(ignoreClick&&e.detail!==0){ignoreClick=false;return;}ignoreClick=false;settle(!expanded);});
 dragZone.addEventListener('pointerdown',e=>{
  if(!overlay()||e.button!==0||e.target.closest('button')&&e.target.closest('button')!==handle)return;
  cancelAnimationFrame(frame);animating=false;drag={id:e.pointerId,startY:e.clientY,start:progress,lastY:e.clientY,lastTime:e.timeStamp,velocity:0,moved:false,fromHandle:Boolean(e.target.closest('#sheet-grip'))};
 });
 window.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.id)return;
  const delta=e.clientY-drag.startY;
  if(!drag.moved&&Math.abs(delta)<=7)return;
  if(!drag.moved){drag.moved=true;dragZone.setPointerCapture(e.pointerId);}
  const dt=e.timeStamp-drag.lastTime;if(dt>0)drag.velocity=(e.clientY-drag.lastY)/dt;
  drag.lastY=e.clientY;drag.lastTime=e.timeStamp;
  progress=Math.max(0,Math.min(1,drag.start-delta/Math.max(1,element.offsetHeight-peek())));draw();
 });
 function end(e){
  if(!drag||e.pointerId!==drag.id)return;
  const d=drag;drag=null;
  if(!d.moved){if(d.fromHandle&&e.type==='pointerup'){ignoreClick=true;settle(!expanded);}return;}
  ignoreClick=d.fromHandle;settle(e.type==='pointercancel'?expanded:Math.abs(d.velocity)>.45?d.velocity<0:progress>.5);
 }
 window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end);
 window.addEventListener('resize',draw);
 draw();
 return {contextChanged(reset=false){cancelAnimationFrame(frame);animating=false;drag=null;if(reset){expanded=false;}else if(!isFocus()){try{expanded=localStorage.getItem('hk-atlas:sheet')==='expanded';}catch{}}progress=expanded?1:0;draw();},refresh:draw,get overlay(){return overlay();},get visibleHeight(){return visibleHeight();},get peekHeight(){return peek();},get expanded(){return expanded;},get animating(){return animating;}};
}
