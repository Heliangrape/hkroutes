"""Named OSM road decks only: no invented rail geometry or operational traffic."""
import json,pathlib
ROOT=pathlib.Path(__file__).resolve().parent.parent
raw=json.loads((ROOT/'scripts/bridge-decks-raw.json').read_text())['elements'];features=[]
for sid,name in [('1','青馬大橋'),('2','汲水門大橋')]:
 for e in raw:
  t=e['tags']
  if name not in t.get('bridge:name',''):continue
  lower=t.get('carriageway:name:zh')=='下層';deck='lower' if lower else 'upper'
  features.append({'type':'Feature','properties':{'structure':sid,'osmId':e['id'],'route':8,'bridge':True,'role':'deck' if lower else 'mainline','deck':deck,'level':2 if lower else 3,'name':name,'roadName':name,'lineColor':'#a2b6c5' if lower else '#7aafff','status':'conditional' if lower else 'mapped','lanes':t.get('lanes',''),'conditional':t.get('motor_vehicle:conditional',''),'direction':'備用通道' if lower else '主橋行車道'},'geometry':{'type':'LineString','coordinates':[[p['lon'],p['lat']] for p in e['geometry']]}})
(ROOT/'dist/data/bridge-decks.geojson').write_text(json.dumps({'type':'FeatureCollection','features':features},ensure_ascii=False,separators=(',',':')))
p=ROOT/'dist/data/structures.json';data=json.loads(p.read_text())
for s in data['structures']:
 if s['id'] in ['1','2']:
  s['complex']=True;s['deckSource']='https://www.td.gov.hk/tc/publications_and_press_releases/publications/free_publications/driving_in_the_tsing_ma_control_area/index.html'
  s['deckNote']='上層為日常主橋道路；下層為有蓋備用通道，受交通管理安排限制，並非日常開放。此處僅展示道路，未繪製鐵路。'
p.write_text(json.dumps(data,ensure_ascii=False,indent=2));print('Bridge deck features:',len(features))
