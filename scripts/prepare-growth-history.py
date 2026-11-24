"""Retain OSM way direction and start dates; do not date a whole modern route from one tunnel."""
import json,pathlib,re,collections
ROOT=pathlib.Path(__file__).resolve().parent.parent
raw=json.loads((ROOT/'scripts/osm-raw.json').read_text())['elements']
def key(name,coords):return (name,tuple(tuple(round(v,6) for v in p) for p in coords))
index={key(e.get('tags',{}).get('name',''),[(p['lon'],p['lat']) for p in e.get('geometry',[])]):e for e in raw if 'geometry' in e}
p=ROOT/'dist/data/routes.geojson';data=json.loads(p.read_text());counts=collections.Counter()
for f in data['features']:
 pr=f['properties'];e=index.get(key(pr.get('name',''),f['geometry']['coordinates']))
 if not e:continue
 t=e['tags'];pr.update(osmId=e['id'],oneway=t.get('oneway',''),openingDate=t.get('start_date') or t.get('opening_date',''))
 m=re.match(r'^(\d{4})(?:\b|[-~/])',pr['openingDate'])
 if m and 1850<=int(m[1])<=2026 and pr['status']!='construction':pr['openingYear']=int(m[1]);pr['dateEvidence']='OSM start_date';counts['dated']+=1
 else:pr.pop('openingYear',None);pr.pop('dateEvidence',None)
 counts['matched']+=1
p.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
history={
 'note':'按通車里程碑與 OSM 年代標記演繹，採用現今線形；不是逐年工程復原。未核定年代與建造中路段最後補全。',
 'sources':[{'name':'運輸署橋隧資料','url':'https://www.td.gov.hk/tc/transport_in_hong_kong/tunnels_and_bridges_n/location_map/index.html'},{'name':'路政署屯門公路沿革','url':'https://www.hyd.gov.hk/tc/information_corner/trivia/first_expressway/index.html'},{'name':'OpenStreetMap snapshot 2026-11-21','url':'https://www.openstreetmap.org/copyright'}],
 'chapters':[
 {'until':1966,'label':'早期道路','title':'城市，從街道開始'},
 {'until':1971,'label':'1967—1971','title':'獅子山隧道，穿山連接沙田'},
 {'until':1977,'label':'1972—1977','title':'海底隧道，兩岸接通'},
 {'until':1981,'label':'1978—1981','title':'屯門公路首階段，走向新市鎮'},
 {'until':1988,'label':'1982—1988','title':'香港仔與啟德隧道，城市向外延伸'},
 {'until':1996,'label':'1989—1996','title':'東隧、城門與大老山，連成新網絡'},
 {'until':1997,'label':'1997','title':'青嶼幹線與西隧，跨越山海'},
 {'until':2006,'label':'1998—2006','title':'汀九橋與大欖隧道，西岸接通'},
 {'until':2009,'label':'2007—2009','title':'深圳灣與青沙公路，新的連繫'},
 {'until':2018,'label':'2010—2018','title':'延伸、改建，路網逐漸緊密'},
 {'until':2021,'label':'2019—2021','title':'中環及灣仔繞道，沿海岸穿行'},
 {'until':2026,'label':'2022—2026','title':'將藍隧道與新連接，繼續生長'}
 ]}
(ROOT/'dist/data/history.json').write_text(json.dumps(history,ensure_ascii=False,indent=2));print(dict(counts))
