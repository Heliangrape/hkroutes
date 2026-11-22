// Zoom reveals context; only explicit selection moves the camera.
export function mapDetailLevel(zoom){return zoom<11.2?'network':zoom<12.4?'places':zoom<14?'structures':'streets';}
export function searchEntries(query,routes,structures){
 const normalize=s=>String(s).toLowerCase().replace(/\s+/g,'').replace(/[幹線橋馬灣嶼獅東門長隧號]/g,c=>({'幹':'干','線':'线','橋':'桥','馬':'马','灣':'湾','嶼':'屿','獅':'狮','東':'东','門':'门','長':'长','隧':'隧','號':'号'}[c]));
 const q=normalize(query.trim());
 const entries=[...routes.map(r=>({type:'route',id:r.id,name:`${r.id} 號幹線`,sub:r.endpoints,color:r.color,search:`route 干线 ${r.id} ${r.endpoints} ${r.nodes.map(n=>n.name).join(' ')}`})),...structures.map(s=>({type:'structure',id:s.id,name:s.name,sub:`${s.routes.join(' / ')} 號幹線 · ${{bridge:'橋梁',tunnel:'隧道',interchange:'互通立交'}[s.kind]}`,search:`${s.name} ${s.english||''} ${s.location||''} ${s.routes.map(n=>n+'号').join(' ')} ${s.kind} ${{bridge:'桥梁',tunnel:'隧道',interchange:'立交'}[s.kind]}`}))];
 const score=e=>normalize(e.name)===q?0:normalize(e.name).includes(q)?1:normalize(e.sub).includes(q)?2:3;
 return q?entries.filter(e=>normalize(e.name+' '+e.sub+' '+e.search).includes(q)).sort((a,b)=>score(a)-score(b)):entries;
}
