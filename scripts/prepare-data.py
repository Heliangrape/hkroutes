"""Create the distributable route snapshot from Overpass data (ODbL)."""
import json, pathlib, datetime

ROOT = pathlib.Path(__file__).resolve().parent.parent
raw = json.loads((ROOT / 'scripts/osm-raw.json').read_text())
colors = ['#b39aff','#57c8f1','#73d79b','#e6bd6b','#ff9d62','#4ad3c1','#ee8fbe','#7aafff','#f1757d','#b2d376']
# Coordinates are editorial landmark anchors; project to each route's actual road geometry below.
definitions = [
 (1,'香港仔 · 沙田','穿過海港，翻越獅子山','南北','由香港仔出發，穿過香港仔隧道與紅磡海底隧道，再經九龍塘、獅子山隧道連接沙田。',[
  ('香港仔','地區',114.155,22.249),('香港仔隧道','隧道',114.179,22.269),('紅磡海底隧道','隧道',114.181,22.293),('九龍塘','地區',114.181,22.337),('獅子山隧道','隧道',114.181,22.354),('沙田','地區',114.19,22.377)]),
 (2,'鰂魚涌 · 馬料水','從港島東，走向吐露港','南北','連接港島東與新界東，途經東區海底隧道、觀塘繞道及大老山隧道。',[
  ('鰂魚涌','地區',114.219,22.293),('東區海底隧道','隧道',114.229,22.295),('觀塘繞道','道路',114.222,22.314),('大老山隧道','隧道',114.216,22.358),('馬料水','地區',114.211,22.411)]),
 (3,'西營盤 · 元朗','西岸的南北脈絡','南北','由西區海底隧道跨越維港，沿西九龍、青衣及汀九，經大欖隧道通往元朗。',[
  ('西營盤','地區',114.144,22.289),('西區海底隧道','隧道',114.146,22.302),('西九龍公路','道路',114.156,22.323),('長青隧道','隧道',114.113,22.342),('汀九橋','橋梁',114.08,22.368),('大欖隧道','隧道',114.061,22.393),('元朗','地區',114.045,22.446)]),
 (4,'堅尼地城 · 柴灣','沿著港島北岸向東','東西','沿港島北岸連接西區、中環、灣仔與港島東，中環及灣仔繞道是沿線的重要隧道。',[
  ('堅尼地城','地區',114.134,22.288),('中環','地區',114.16,22.289),('中環及灣仔繞道','隧道',114.176,22.286),('銅鑼灣','地區',114.189,22.285),('鰂魚涌','地區',114.21,22.293),('柴灣','地區',114.242,22.267)]),
 (5,'牛頭角 · 荃灣','穿行九龍的城市走廊','東西','由牛頭角經啟德隧道、紅磡及西九龍走廊，沿葵涌道與荃灣路接上新界路網。',[
  ('牛頭角','地區',114.216,22.321),('啟德隧道','隧道',114.196,22.321),('紅磡','地區',114.184,22.311),('油麻地','地區',114.167,22.31),('荔枝角','地區',114.146,22.337),('葵涌','地區',114.132,22.354),('荃灣','地區',114.109,22.372)]),
 (6,'西九龍 · 將軍澳','九龍中部的東西連繫','東西','連接西九龍與將軍澳的幹線，包含中九龍繞道及將軍澳—藍田隧道。資料中的建造中路段以虛線表示。',[
  ('油麻地','地區',114.164,22.311),('中九龍繞道','隧道',114.184,22.321),('九龍灣','地區',114.21,22.317),('茶果嶺','地區',114.233,22.303),('將軍澳—藍田隧道','隧道',114.249,22.302),('將軍澳','地區',114.262,22.301)]),
 (7,'葵涌 · 將軍澳','沿九龍山麓，走進東岸','東西','由葵涌經呈祥道、龍翔道及觀塘，穿過將軍澳隧道抵達將軍澳。',[
  ('葵涌','地區',114.133,22.343),('呈祥道','道路',114.148,22.342),('龍翔道','道路',114.187,22.343),('觀塘','地區',114.224,22.313),('將軍澳隧道','隧道',114.244,22.319),('將軍澳','地區',114.263,22.319)]),
 (8,'赤鱲角 · 沙田','跨海，連山，通往機場','東西','從大嶼山跨過汲水門大橋、青馬大橋與昂船洲大橋，再經尖山隧道連接沙田。',[
  ('赤鱲角','地區',113.946,22.301),('北大嶼山公路','道路',114.003,22.326),('汲水門大橋','橋梁',114.06,22.33),('青馬大橋','橋梁',114.075,22.351),('南灣隧道','隧道',114.105,22.336),('昂船洲大橋','橋梁',114.119,22.324),('尖山隧道','隧道',114.158,22.35),('沙田','地區',114.18,22.373)]),
 (9,'新界環迴','繞新界一圈，讀懂香港','環迴','環繞新界的環迴幹線，串連沙田、大埔、北區、元朗、屯門與荃灣，並經城門隧道閉合成環。',[
  ('城門隧道','隧道',114.145,22.379),('沙田','地區',114.198,22.393),('吐露港公路','道路',114.205,22.442),('大埔','地區',114.172,22.462),('粉嶺','地區',114.145,22.493),('上水','地區',114.123,22.5),('新田','地區',114.071,22.493),('元朗','地區',114.024,22.441),('屯門','地區',113.984,22.393),('深井','地區',114.063,22.365),('荃灣','地區',114.112,22.375)]),
 (10,'藍地 · 深圳灣口岸','越過后海灣的跨境連線','東西','由藍地接上港深西部公路，經深圳灣公路大橋通往深圳灣口岸。',[
  ('藍地','地區',113.981,22.424),('港深西部公路','道路',113.966,22.443),('深圳灣公路大橋','橋梁',113.955,22.473),('深圳灣口岸','地區',113.949,22.503)])
]
features=[]
for e in raw['elements']:
 t=e['tags']
 if t.get('highway') not in ('motorway','trunk','primary','construction'): continue
 coords=[[round(p['lon'],6),round(p['lat'],6)] for p in e.get('geometry',[])]
 if len(coords)<2: continue
 features.append({'type':'Feature','properties':{'route':int(t['ref']),'name':t.get('name',''),'status':'construction' if t['highway']=='construction' else 'mapped','tunnel':t.get('tunnel')=='yes','bridge':t.get('bridge')=='yes'},'geometry':{'type':'LineString','coordinates':coords}})

def project(point,lines):
 best=None
 for line in lines:
  for a,b in zip(line,line[1:]):
   dx=(b[0]-a[0])*.926;dy=b[1]-a[1]
   t=max(0,min(1,((point[0]-a[0])*.926*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy))) if dx*dx+dy*dy else 0
   p=[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])];d=((p[0]-point[0])*.926)**2+(p[1]-point[1])**2
   if best is None or d<best[0]:best=(d,p)
 return [round(x,6) for x in best[1]]

routes=[]
for n,endpoints,tagline,orientation,description,nodes in definitions:
 lines=[f['geometry']['coordinates'] for f in features if f['properties']['route']==n]
 out=[]
 for name,kind,lon,lat in nodes:
  out.append({'name':name,'kind':kind,'coordinates':project([lon,lat],lines)})
 routes.append({'id':n,'color':colors[n-1],'endpoints':endpoints,'tagline':tagline,'orientation':orientation,'description':description,'nodes':out,'source':f'https://www.td.gov.hk/tc/transport_in_hong_kong/hk_strategic_route_and_exit_number_system/map/r{n}/index.html','hasConstruction':any(f['properties']['status']=='construction' for f in features if f['properties']['route']==n)})
(ROOT/'dist/data/routes.geojson').write_text(json.dumps({'type':'FeatureCollection','features':features},ensure_ascii=False,separators=(',',':')))
(ROOT/'dist/data/routes.json').write_text(json.dumps({'snapshot':'2026-11-21','source':'OpenStreetMap contributors / Overpass API','routes':routes},ensure_ascii=False,separators=(',',':')))
print(f'Prepared {len(routes)} routes, {len(features)} road segments, {sum(len(r["nodes"]) for r in routes)} editorial landmarks.')
