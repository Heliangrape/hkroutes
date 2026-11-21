"""Curated official bridge/tunnel facts and original government photographs."""
import json,pathlib,re,html,ssl,urllib.request,concurrent.futures,shutil,tempfile,subprocess
ROOT=pathlib.Path(__file__).resolve().parent.parent
TD='https://www.td.gov.hk/en/transport_in_hong_kong/tunnels_and_bridges_n/location_map/index_t.html'
HYD='https://www.hyd.gov.hk/en/information_corner/hyd_factsheets/doc/'
# name, English photo label, length/span label, value, year, road layout, original summary
rows=[
('青馬大橋','Tsing Ma Bridge and Kap Shui Mun Bridge','主跨','1,377 m','1997','雙向三線，上下雙層','跨越馬灣海峽，將青衣接上馬灣；橋面同時承載道路與機場鐵路。'),
('汲水門大橋','Kap Shui Mun Bridge','全長','820 m','1997','雙向三線，公鐵兩用','連接馬灣與大嶼山的斜拉橋，與青馬大橋一起構成青嶼幹線。'),
('昂船洲大橋','Stonecutters Bridge','全長','1,596 m','2009','雙向三線','跨過藍巴勒海峽的雙塔斜拉橋，是青衣往西九龍路線的一部分。'),
('汀九橋','Ting Kau Bridge','全長','1,177 m','1998','雙向三線','以三座橋塔跨越海峽，連接青衣、屯門公路與大欖隧道方向。'),
('深圳灣公路大橋','Shenzhen Bay Bridge','全長','5.5 km','2007','雙向三線','橫跨后海灣的跨境道路，北接深圳灣口岸，南連港深西部公路。'),
('紅磡海底隧道','Cross Harbour Tunnel','隧道長度','1.9 km','1972','雙管，每方向兩線','香港首條行車過海隧道，連接紅磡與銅鑼灣。'),
('東區海底隧道','Eastern Harbour Crossing','隧道長度','2.29 km','1989','雙管，每方向兩線','在維港東部連接鰂魚涌與茶果嶺，串起港島東與東九龍。'),
('西區海底隧道','Western Harbour Crossing','隧道長度','2.0 km','1997','雙管，每方向三線','由西營盤通往西九龍，接續西九龍公路與3號幹線。'),
('香港仔隧道','Aberdeen Tunnel','隧道長度','1.9 km','1982','雙管，每方向兩線','穿越港島山體，連接跑馬地與黃竹坑。'),
('中環及灣仔繞道','Central - Wan Chai Bypass Tunnel','隧道長度','3.7 km','2019','主要為雙向三線','沿港島北岸地下連接中環、灣仔北與北角，屬4號幹線。'),
('啟德隧道','Kai Tak Tunnel','隧道長度','1.3 km','1982','雙管，每方向兩線','建於舊啟德機場跑道下方，連接九龍灣與馬頭角。'),
('獅子山隧道','Lion Rock Tunnel','隧道長度','1.4 km','1967 / 1978','雙管，每方向兩線','穿越獅子山，連接九龍塘與大圍；兩條管道先後通車。'),
('城門隧道','Shing Mun Tunnels','隧道總長','2.6 km','1990','雙管，每方向兩線','越過新界中部山嶺，連接荃灣梨木樹與大圍，屬9號幹線。'),
('大老山隧道',"Tate's Cairn Tunnel",'隧道長度','4.0 km','1991','雙管，每方向兩線','穿越九龍山嶺，將鑽石山連到沙田小瀝源。'),
('大欖隧道','Tai Lam Tunnel','隧道長度','3.8 km','1998','雙管，每方向三線','連接荃灣汀九與元朗，是3號幹線穿越大欖山區的路段。'),
('長青隧道','Cheung Tsing Tunnel','隧道長度','1.6 km','1997','雙管，每方向三線','穿越青衣，連接長青公路與青葵公路。'),
('南灣隧道','Nam Wan Tunnel','隧道長度','1.2 km','2009','雙管，每方向三線','位於青衣南部，銜接長青公路與昂船洲大橋。'),
('尖山隧道',"Eagle's Nest Tunnel",'隧道長度','2.1 km','2008','雙管，每方向三線','青沙公路的穿山路段，連接西九龍與沙田方向。'),
('將軍澳隧道','Tseung Kwan O Tunnel','隧道長度','0.9 km','1990','雙管，每方向兩線','穿越山體連接觀塘與將軍澳，屬7號幹線。'),
('將軍澳—藍田隧道','Tseung Kwan O – Lam Tin Tunnel','隧道長度','2.2 km','2022','雙管，每方向兩線','連接將軍澳與藍田、觀塘方向，構成6號幹線東段。'),
('中九龍繞道','Central Kowloon Bypass (Yau Ma Tei Section Tunnel)','油麻地段隧道','約 3.9 km','2025（油麻地段）','雙向三線','由西九龍經九龍中部通往啟德與九龍灣；參數為已通車的油麻地段隧道。')]
text=(ROOT/'scripts/structures-source.html').read_text()
photos={html.unescape(label.strip('[]')):'https://www.td.gov.hk'+url for url,label in re.findall(r'<a[^>]+href="([^"]+)"[^>]*>(\[[^<]+\])</a>',text)}
features=json.loads((ROOT/'dist/data/routes.geojson').read_text())['features']
routes=json.loads((ROOT/'dist/data/routes.json').read_text())['routes']
def anchor(name):
 match={'紅磡海底隧道':'海底隧道','中環及灣仔繞道':'繞道','將軍澳—藍田隧道':'將軍澳－藍田隧道'}.get(name,name)
 fs=[f for f in features if match in f['properties']['name']]
 if name=='中環及灣仔繞道':fs=[f for f in fs if f['properties']['route']==4]
 if name=='紅磡海底隧道':fs=[f for f in fs if f['properties']['route']==1]
 if not fs:return next(n['coordinates'] for r in routes for n in r['nodes'] if n['name']==name)
 cs=[c for f in fs for c in f['geometry']['coordinates']];cx=(min(c[0] for c in cs)+max(c[0] for c in cs))/2;cy=(min(c[1] for c in cs)+max(c[1] for c in cs))/2
 best=None
 for f in fs:
  for a,b in zip(f['geometry']['coordinates'],f['geometry']['coordinates'][1:]):
   dx=b[0]-a[0];dy=b[1]-a[1];t=max(0,min(1,((cx-a[0])*dx+(cy-a[1])*dy)/(dx*dx+dy*dy))) if dx*dx+dy*dy else 0
   p=[a[0]+t*dx,a[1]+t*dy];d=(cx-p[0])**2+(cy-p[1])**2
   if best is None or d<best[0]:best=(d,p)
 return [round(x,6) for x in best[1]]
items=[]
for i,(name,en,label,value,year,lanes,summary) in enumerate(rows):
 kind='bridge' if i<5 else 'tunnel';photo=photos.get(en);source=TD;credit='香港運輸署';caption=name+'實景'
 if i==1:
  photo='https://fpf.ccidahk.gov.hk/common/images/location/01533/01533d.jpg';source=HYD+'e_Kap_Shui_Mun_Bridge.pdf';credit='香港文創產業發展處・電影服務統籌科';caption='汲水門大橋近景與青嶼幹線'
 if i==4:
  photo='https://gia.info.gov.hk/general/200706/25/P200706250190_photo_396844.JPG';source='https://www.hyd.gov.hk/en/road_and_railway/road_network/new.html';credit='香港政府新聞處'
 if i==2:source=HYD+'e_Stonecutters_Bridge.pdf'
 if i==3:source=HYD+'e_Ting_Kau_Bridge.pdf'
 assert photo,(name,en)
 ext=photo.rsplit('.',1)[1].lower();path=f'media/photo-{i+1}.jpg'
 routeids=[r['id'] for r in routes if any(n['name']==name for n in r['nodes'])]
 items.append({'id':str(i+1),'name':name,'english':en,'kind':kind,'routes':routeids,'coordinates':anchor(name),'metrics':[[label,value],['通車年份',year],['行車配置',lanes]],'summary':summary,'image':path,'imageSource':photo,'imageCredit':credit,'imageCaption':caption,'source':source})
ctx=ssl.create_default_context(cafile='/etc/ssl/cert.pem')
def download(o):
 p=ROOT/'dist'/o['image']
 if p.exists() and p.stat().st_size>1000:return o['name'],'cached'
 try:
  data=urllib.request.urlopen(o['imageSource'],context=ctx,timeout=35).read()
  with tempfile.NamedTemporaryFile(suffix='.'+o['imageSource'].rsplit('.',1)[-1].lower()) as tmp:
   tmp.write(data);tmp.flush()
   subprocess.run(['sips','-s','format','jpeg','-s','formatOptions','76','-Z','1200',tmp.name,'--out',str(p)],check=True,capture_output=True)
  return o['name'],p.stat().st_size
 except Exception as e:return o['name'],str(e)
for result in concurrent.futures.ThreadPoolExecutor(max_workers=4).map(download,items):print(result,flush=True)
(ROOT/'dist/data/structures.json').write_text(json.dumps({'updated':'2026-11-22','structures':items},ensure_ascii=False,indent=2))
