"""Clip actual motorway/trunk/primary ramp geometry into three editorial interchange views."""
import json,pathlib,math,html,collections
ROOT=pathlib.Path(__file__).resolve().parent.parent
raw=json.loads((ROOT/'scripts/interchanges-ways.json').read_text())['elements']
sites=[
 dict(id='22',name='青衣西北交匯處',english='North West Tsing Yi Interchange',routes=[3,8],coordinates=[114.0841,22.3545],bbox=[114.0782,22.3498,114.0900,22.3610],location='青衣西北',roads='青嶼幹線 · 汀九橋 · 長青公路',summary='3號與8號幹線在青衣西北角銜接。跨海主線、迴轉匝道與往九龍方向的分支在狹長山坡間分層展開。',source='https://www.info.gov.hk/gia/general/199804/27/0427112.htm'),
 dict(id='23',name='荔灣交匯處',english='Lai Wan Interchange',routes=[3,8],coordinates=[114.1450,22.3320],bbox=[114.1380,22.3274,114.1510,22.3362],location='荔枝角灣',roads='西九龍公路 · 青沙公路 · 連翔道',summary='青沙公路在西九龍公路旁分岔和匯入，長彎匝道穿過市區高架路網。這裡展示主線與多條方向性連接路的上下穿關係。',source='https://www.legco.gov.hk/yr10-11/chinese/brief/ssc10_20110923-c.pdf'),
 dict(id='24',name='蝴蝶谷交匯處',english='Butterfly Valley Interchange',routes=[7,8],coordinates=[114.1415,22.3411],bbox=[114.1374,22.3380,114.1467,22.3442],location='蝴蝶谷',roads='青沙公路 · 呈祥道 · 青山公路',summary='7號與8號幹線在蝴蝶谷一帶銜接。高架青沙公路、呈祥道與地區道路的轉向匝道，在山谷入口形成緊湊的分層路網。',source='https://www.tpb.gov.hk/uploads/page/meetings/MPC/A_K16_44/A_K16_44_Appendix.pdf')]
colors={-2:'#536570',-1:'#657a86',0:'#7f929e',1:'#9bafbc',2:'#b2c4cf',3:'#c9d8df',4:'#dce7eb',5:'#eef5f6'}
def clip(a,b,box):
 xmin,ymin,xmax,ymax=box;dx=b[0]-a[0];dy=b[1]-a[1];lo=0;hi=1
 for p,q in [(-dx,a[0]-xmin),(dx,xmax-a[0]),(-dy,a[1]-ymin),(dy,ymax-a[1])]:
  if abs(p)<1e-15:
   if q<0:return None
  else:
   r=q/p
   if p<0:lo=max(lo,r)
   else:hi=min(hi,r)
   if lo>hi:return None
 return [[round(a[0]+lo*dx,7),round(a[1]+lo*dy,7)],[round(a[0]+hi*dx,7),round(a[1]+hi*dy,7)]]
def clipped(cs,box):
 chunks=[];current=[]
 for a,b in zip(cs,cs[1:]):
  pair=clip(a,b,box)
  if pair is None:
   if len(current)>1:chunks.append(current)
   current=[];continue
  if current and current[-1]!=pair[0]:
   if len(current)>1:chunks.append(current)
   current=[]
  if not current:current.append(pair[0])
  if current[-1]!=pair[1]:current.append(pair[1])
 if len(current)>1:chunks.append(current)
 return chunks
allfeatures=[];items=[]
for site in sites:
 core=[e for e in raw if site['name'] in e.get('tags',{}).get('junction:name','') or site['name'] in e.get('tags',{}).get('name','')]
 chosen={e['id']:e for e in core};nodes={n for e in core for n in e.get('nodes',[])}
 for _ in range(3):
  for e in raw:
   t=e['tags'];linked=t.get('highway','').endswith('_link') and any(n in nodes for n in e.get('nodes',[]))
   main=t.get('ref') in [str(r) for r in site['routes']]
   if linked or main:
    if any(site['bbox'][0]<=p['lon']<=site['bbox'][2] and site['bbox'][1]<=p['lat']<=site['bbox'][3] for p in e.get('geometry',[])):
     chosen[e['id']]=e;nodes.update(e.get('nodes',[]))
 fs=[]
 for e in chosen.values():
  t=e['tags'];cs=[[p['lon'],p['lat']] for p in e.get('geometry',[])];level=max(-2,min(5,int(t.get('layer','0').split(';')[0])))
  for segment,coords in enumerate(clipped(cs,site['bbox'])):
   if len(coords)<2:continue
   fs.append({'type':'Feature','properties':{'structure':site['id'],'interchange':site['name'],'osmId':e['id'],'segment':segment,'level':level,'role':'ramp' if t['highway'].endswith('_link') else 'mainline','route':int(t['ref']) if t.get('ref','').isdigit() else None,'name':t.get('name',''),'status':'mapped'},'geometry':{'type':'LineString','coordinates':coords}})
 fs.sort(key=lambda f:f['properties']['level']);allfeatures.extend(fs)
 # A code-native drawing, not a photograph or invented junction diagram.
 cs=[c for f in fs for c in f['geometry']['coordinates']];xmin=min(c[0] for c in cs);xmax=max(c[0] for c in cs);ymin=min(c[1] for c in cs);ymax=max(c[1] for c in cs)
 scale=min(800/((xmax-xmin)*math.cos(22.34*math.pi/180)),600/(ymax-ymin));cx=(xmin+xmax)/2;cy=(ymin+ymax)/2
 def path(coords):return 'M'+' L'.join(f'{450+(x-cx)*math.cos(22.34*math.pi/180)*scale:.2f},{375-(y-cy)*scale:.2f}' for x,y in coords)
 svg=['<svg xmlns="http://www.w3.org/2000/svg" width="900" height="800" viewBox="0 0 900 800"><rect width="900" height="800" fill="#08141d"/>',f'<text x="45" y="43" fill="#bacbd5" font-size="20" font-family="sans-serif">{html.escape(site["name"])}</text>']
 for level in sorted({f['properties']['level'] for f in fs}):
  for f in fs:
   if f['properties']['level']!=level:continue
   w=4 if f['properties']['role']=='mainline' else 2.5;svg.append(f'<path d="{path(f["geometry"]["coordinates"])}" fill="none" stroke="#051019" stroke-width="{w+5}" stroke-linejoin="round" stroke-linecap="round"/>')
  for f in fs:
   if f['properties']['level']!=level:continue
   w=4 if f['properties']['role']=='mainline' else 2.5;svg.append(f'<path d="{path(f["geometry"]["coordinates"])}" fill="none" stroke="{colors[level]}" stroke-width="{w}" stroke-linejoin="round" stroke-linecap="round"/>')
 svg+=['<text x="45" y="752" fill="#8198a5" font-size="16" font-family="sans-serif">深色下穿 · 淺色上跨 · 粗主線 / 細匝道</text><text x="45" y="780" fill="#607987" font-size="13" font-family="sans-serif">© OpenStreetMap contributors · ODbL · 2026-11-22</text></svg>']
 image=f'media/interchange-{site["id"]}.svg';(ROOT/'dist'/image).write_text(''.join(svg))
 items.append({**site,'kind':'interchange','metrics':[['連接幹線',' · '.join(map(str,site['routes']))+' 號'],['所在區域',site['location']],['主要銜接',site['roads']]],'image':image,'imageSource':'https://www.openstreetmap.org/copyright','imageCredit':'OpenStreetMap contributors · ODbL','imageCaption':site['name']+'匝道結構示意（道路上下穿標記）'})
 print(site['name'],len(fs),'segments',sum(f['properties']['role']=='ramp' for f in fs),'ramp segments','levels',sorted({f['properties']['level'] for f in fs}))
(ROOT/'dist/data/interchanges.geojson').write_text(json.dumps({'type':'FeatureCollection','features':allfeatures},ensure_ascii=False,separators=(',',':')))
structures=json.loads((ROOT/'dist/data/structures.json').read_text());structures['structures']=[s for s in structures['structures'] if s['kind']!='interchange']+items
(ROOT/'dist/data/structures.json').write_text(json.dumps(structures,ensure_ascii=False,indent=2))
