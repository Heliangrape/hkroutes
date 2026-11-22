"""Resolve ramp movements by shared OSM nodes and legal way direction, never crossings.

Run after prepare-interchanges.py. This is an editorial map, not turn-by-turn routing.
"""
import json, math, heapq, collections, pathlib, re
ROOT=pathlib.Path(__file__).resolve().parent.parent
raw=json.loads((ROOT/'scripts/interchanges-ways.json').read_text())['elements']
ways={e['id']:e for e in raw}
incoming=collections.defaultdict(list);outgoing=collections.defaultdict(list)
def name(t):
 return t.get('name:zh') or t.get('street:name:zh') or t.get('alt_name:zh') or (t.get('name','').split(' ')[0]) or '地區道路'
def refs(t):return sorted({int(n) for n in re.split(r'[;,]',t.get('ref','')) if n.isdigit() and 1<=int(n)<=10})
for e in raw:
 ns=e.get('nodes',[]);t=e['tags'];g=e.get('geometry',[])
 length=sum(math.hypot((b['lon']-a['lon'])*.925,b['lat']-a['lat'])*111195 for a,b in zip(g,g[1:]))
 directions=[(ns[0],ns[-1])] if ns else []
 if t.get('oneway')=='-1':directions=[(ns[-1],ns[0])]
 elif t.get('oneway') not in ['yes','1'] and t.get('highway')!='motorway' and ns:directions.append((ns[-1],ns[0]))
 for a,b in directions:
  outgoing[a].append((e['id'],b,length));incoming[b].append((e['id'],a,length))
def terminal(node,reverse,skip):
 graph=incoming if reverse else outgoing
 q=[(0,node)];seen=set();found=[];best=None
 while q:
  d,n=heapq.heappop(q)
  if n in seen or d>2200 or best is not None and d>best+15:continue
  seen.add(n)
  for wid,other,length in graph[n]:
   if wid==skip:continue
   t=ways[wid]['tags']
   if not t['highway'].endswith('_link'):
    best=d if best is None else min(best,d)
    found.append((d,refs(t),name(t)))
   elif other not in seen:heapq.heappush(q,(d+length,other))
 if not found:return [],'連接路段',False,0
 found=[f for f in found if f[0]<=min(x[0] for x in found)+15]
 rr=sorted({r for _,rs,_ in found for r in rs});names=sorted({n for _,_,n in found})
 return rr,'／'.join(names),len({tuple(rs) for _,rs,_ in found})==1,min(x[0] for x in found)

def bearing(cs):
 a,b=cs[0],cs[-1];x=(b[0]-a[0])*.925;y=b[1]-a[1]
 return ['北','東北','東','東南','南','西南','西','西北'][round(math.atan2(x,y)/math.pi*4)%8]+'行'
p=ROOT/'dist/data/interchanges.geojson';data=json.loads(p.read_text())
for f in data['features']:
 p1=f['properties'];e=ways[p1['osmId']];t=e['tags'];ns=e['nodes'];reverse=t.get('oneway')=='-1'
 a,b=(ns[-1],ns[0]) if reverse else (ns[0],ns[-1])
 if reverse:f['geometry']['coordinates'].reverse()
 p1.update(roadName=name(t),direction=bearing(f['geometry']['coordinates']),oneway=t.get('oneway','no'),lanes=t.get('lanes',''),destination=t.get('destination:zh') or t.get('destination',''),source='OSM directed node connectivity')
 if p1['role']=='ramp':
  fr,fn,fc,fd=terminal(a,True,e['id']);tr,tn,tc,td=terminal(b,False,e['id'])
  p1.update(fromRoutes=fr,toRoutes=tr,fromName=fn,toName=tn,connectionConfirmed=fc and tc)
  original=[[p['lon'],p['lat']] for p in e['geometry']]
  if reverse:original.reverse()
  def meters(a,b):return math.hypot((b[0]-a[0])*.925,b[1]-a[1])*111195
  distances=[0]
  for x,y in zip(original,original[1:]):distances.append(distances[-1]+meters(x,y))
  start=f['geometry']['coordinates'][0];best=(float('inf'),0)
  for i,(x,y) in enumerate(zip(original,original[1:])):
   dx=(y[0]-x[0])*.925;dy=y[1]-x[1];vx=(start[0]-x[0])*.925;vy=start[1]-x[1]
   t=max(0,min(1,(vx*dx+vy*dy)/(dx*dx+dy*dy or 1)))
   gap=math.hypot(vx-t*dx,vy-t*dy)
   if gap<best[0]:best=(gap,distances[i]+(distances[i+1]-distances[i])*t)
  length=sum(meters(x,y) for x,y in zip(f['geometry']['coordinates'],f['geometry']['coordinates'][1:]))
  total=fd+distances[-1]+td or 1
  p1.update(rampStart=(fd+best[1])/total,rampEnd=min(1,(fd+best[1]+length)/total))
 else:p1.update(fromRoutes=refs(t),toRoutes=refs(t),fromName=name(t),toName=name(t),connectionConfirmed=True)
# Join split OSM ramp ways into one physical movement, using shared nodes only.
for sid in ['22','23','24']:
 ramps=[f for f in data['features'] if f['properties']['structure']==sid and f['properties']['role']=='ramp']
 parent={f['properties']['osmId']:f['properties']['osmId'] for f in ramps}
 def find(x):
  while parent[x]!=x:parent[x]=parent[parent[x]];x=parent[x]
  return x
 def signature(p):return (tuple(p['fromRoutes']) or p['fromName'],tuple(p['toRoutes']) or p['toName'])
 nodes=collections.defaultdict(list)
 for f in ramps:
  p1=f['properties'];wid=p1['osmId']
  for n in ways[wid]['nodes']:nodes[n].append((wid,signature(p1)))
 for entries in nodes.values():
  for a,sa in entries:
   for b,sb in entries:
    if sa==sb:parent[max(find(a),find(b))]=min(find(a),find(b))
 groups=collections.defaultdict(list)
 for f in ramps:
  p1=f['properties'];p1['movementId']=f"{sid}:{find(p1['osmId'])}";groups[p1['movementId']].append(f)
 for fs in groups.values():
  start=min(fs,key=lambda f:f['properties']['rampStart'])['geometry']['coordinates'][0]
  end=max(fs,key=lambda f:f['properties']['rampEnd'])['geometry']['coordinates'][-1]
  for f in fs:f['properties']['segmentDirection']=f['properties']['direction'];f['properties']['direction']=bearing([start,end])
# Colour every small segment by distance along each actual clipped ramp, maintaining deck order.
colors={r['id']:r['color'] for r in json.loads((ROOT/'dist/data/routes.json').read_text())['routes']}
def color(rs):return colors[rs[0]] if len(rs)==1 else '#87949f'
def mix(a,b,t):
 return '#'+''.join(f'{round(int(a[i:i+2],16)*(1-t)+int(b[i:i+2],16)*t):02x}' for i in (1,3,5))
for f in data['features']:
 p1=f['properties'];p1['startColor']=color(p1['fromRoutes']);p1['endColor']=color(p1['toRoutes']);p1['lineColor']=colors.get(p1['route'],'#87949f')
p.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
print('Enriched',len(data['features']),'segments')
for sid in ['22','23','24']:
 fs=[f for f in data['features'] if f['properties']['structure']==sid and f['properties']['role']=='ramp']
 print(sid,collections.Counter((tuple(f['properties']['fromRoutes']),tuple(f['properties']['toRoutes'])) for f in fs))
