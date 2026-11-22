// Zoom reveals context; it never changes the selected scene or moves the camera.
export function mapDetailLevel(zoom){return zoom<11.2?'network':zoom<12.4?'places':zoom<14?'structures':'streets';}
export function nearbyFacility(candidates,{zoom,width,height,top=90,bottom=0,current=null,view='overview',blocked=false}){
 if(blocked||view==='detail'||zoom<(current?11.85:12.15))return null;
 const cy=(top+height-bottom)/2,cx=width/2,rx=Math.max(90,width*.42),ry=Math.max(90,(height-top-bottom)*.43);
 const eligible=candidates.filter(c=>zoom>=(c.kind==='interchange'?(c.id===current?12.7:13):(c.id===current?11.85:12.15))&&c.x>20&&c.x<width-20&&c.y>top&&c.y<height-bottom-20&&c.span>=30).map(c=>({...c,score:Math.hypot((c.x-cx)/rx,(c.y-cy)/ry)-(c.id===current? .18:0)})).filter(c=>c.score<1);
 eligible.sort((a,b)=>a.score-b.score);return eligible[0]?.id||null;
}
export function searchEntries(query,routes,structures){
 const normalize=s=>String(s).toLowerCase().replace(/\s+/g,'').replace(/[幹線橋馬灣嶼獅東門長隧號]/g,c=>({'幹':'干','線':'线','橋':'桥','馬':'马','灣':'湾','嶼':'屿','獅':'狮','東':'东','門':'门','長':'长','隧':'隧','號':'号'}[c]));
 const q=normalize(query.trim());
 const entries=[...routes.map(r=>({type:'route',id:r.id,name:`${r.id} 號幹線`,sub:r.endpoints,color:r.color,search:`route 干线 ${r.id} ${r.endpoints} ${r.nodes.map(n=>n.name).join(' ')}`})),...structures.map(s=>({type:'structure',id:s.id,name:s.name,sub:`${s.routes.join(' / ')} 號幹線 · ${{bridge:'橋梁',tunnel:'隧道',interchange:'互通立交'}[s.kind]}`,search:`${s.name} ${s.english||''} ${s.location||''} ${s.routes.map(n=>n+'号').join(' ')} ${s.kind} ${{bridge:'桥梁',tunnel:'隧道',interchange:'立交'}[s.kind]}`}))];
 const score=e=>normalize(e.name)===q?0:normalize(e.name).includes(q)?1:normalize(e.sub).includes(q)?2:3;
 return q?entries.filter(e=>normalize(e.name+' '+e.sub+' '+e.search).includes(q)).sort((a,b)=>score(a)-score(b)):entries;
}
