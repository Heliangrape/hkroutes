// Use the same colours and geometry as the interactive detail scene.
import fs from 'node:fs';
import {colorConnections} from '../dist/connections.js';
const root=new URL('../',import.meta.url),read=p=>JSON.parse(fs.readFileSync(new URL(p,root)));
const data=read('dist/data/interchanges.geojson'),info=read('dist/data/structures.json'),routes=read('dist/data/routes.json').routes;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
for(const s of info.structures.filter(s=>s.kind==='interchange')){
 const features=colorConnections(data.features.filter(f=>f.properties.structure===s.id));
 const cs=features.flatMap(f=>f.geometry.coordinates),xs=cs.map(c=>c[0]),ys=cs.map(c=>c[1]);
 const xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys),cx=(xmin+xmax)/2,cy=(ymin+ymax)/2;
 const scale=Math.min(790/((xmax-xmin)*.925),570/(ymax-ymin));
 const d=cs=>'M'+cs.map(([x,y])=>`${(450+(x-cx)*.925*scale).toFixed(2)},${(370-(y-cy)*scale).toFixed(2)}`).join(' L');
 const svg=[`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="800" viewBox="0 0 900 800"><rect width="900" height="800" fill="#08121c"/><g font-family="sans-serif"><text x="45" y="43" fill="#c5d2dc" font-size="20">${esc(s.name)}</text>`];
 for(let level=-2;level<=5;level++){
  const fs=features.filter(f=>f.properties.level===level);
  for(const f of fs)svg.push(`<path d="${d(f.geometry.coordinates)}" fill="none" stroke="#030a12" stroke-width="${f.properties.role==='ramp'?7:10}" stroke-linecap="round" stroke-linejoin="round"/>`);
  for(const f of fs)svg.push(`<path d="${d(f.geometry.coordinates)}" fill="none" stroke="${f.properties.lineColor}" stroke-width="${f.properties.role==='ramp'?2.5:4}" stroke-linecap="round" stroke-linejoin="round"/>`);
 }
 svg.push(s.routes.map((id,i)=>`<text x="${45+i*180}" y="720" fill="${routes.find(r=>r.id===id).color}" font-size="18">${id} 號幹線</text>`).join(''));
 svg.push('<text x="45" y="751" fill="#7f94a5" font-size="15">匝道由來源色漸變至去向色 · 灰色連接地區道路 / 未編號路段</text><text x="45" y="780" fill="#536c7e" font-size="12">© OpenStreetMap contributors · ODbL · 結構示意，非行車指引</text></g></svg>');
 fs.writeFileSync(new URL('dist/'+s.image,root),svg.join(''));
 s.imageCaption=s.name+'連接結構示意（幹線原色與匝道漸變）';
}
fs.writeFileSync(new URL('dist/data/structures.json',root),JSON.stringify(info,null,2));
