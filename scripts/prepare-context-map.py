"""Restore graduated geography in the vendored CARTO style; no new map provider."""
import json,pathlib
p=pathlib.Path(__file__).resolve().parent.parent/'dist/data/basemap.json'
s=json.loads(p.read_text())
for l in s['layers']:
 id=l['id'];paint=l.setdefault('paint',{})
 if id=='background':paint['background-color']='#17262d'
 if id=='water':paint['fill-color']='#0b1b27'
 if id=='landcover':paint['fill-color']='#23392f'
 if id.startswith('park_'):paint['fill-color']='#1e3930'
 if id.startswith('landuse'):paint['fill-color']='#233337'
 if id.startswith('building'):paint['fill-color']='#36444b';paint['fill-opacity']=['interpolate',['linear'],['zoom'],13,.35,16,.8]
 if l['type']!='symbol':continue
 layout=l.setdefault('layout',{});layout['visibility']='visible'
 if 'text-field' in layout:layout['text-field']=['coalesce',['get','name:zh-Hant'],['get','name:zh'],['case',['==',['get','script'],'Han'],['get','name'],['==',['get','script2'],'Han'],['get','name2'],['==',['get','script3'],'Han'],['get','name3'],['get','name']],['get','name:en']]
 if 'text-field' in layout:paint.update({'text-color':'#a3b6ba','text-halo-color':'#14252d','text-halo-width':1,'text-halo-blur':.4,'text-opacity':.72})
 # Curated Chinese district names cover wider views, native streets/localities take over at close range.
 if id.startswith('place_'):
  if l.get('maxzoom',24)<=12:layout['visibility']='none';continue
  l['minzoom']=12.25
  if id in ['place_hamlet','place_villages']:l['minzoom']=13
  layout['text-size']=['interpolate',['linear'],['zoom'],12,12,15,15,18,17]
  layout['text-transform']='none'
 if id.startswith('watername') or id=='waterway_label':
  if l.get('maxzoom',24)<=12:layout['visibility']='none';continue
  l['minzoom']=12.25;paint['text-opacity']=.52
 if id.startswith('roadname'):
  l['minzoom']={'roadname_major':12.9,'roadname_pri':13.4,'roadname_sec':14.2,'roadname_minor':15.3}.get(id,14)
  layout['text-size']=['interpolate',['linear'],['zoom'],13,11,16,12,18,13]
  paint['text-opacity']=.64;layout['symbol-spacing']=350
 if id.startswith('poi_'):
  l['minzoom']=14.5;paint['text-opacity']=.58;layout['text-transform']='none';layout['text-size']=12
 if id=='housenumber':layout['visibility']='none'
p.write_text(json.dumps(s,ensure_ascii=False,separators=(',',':')))
