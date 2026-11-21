export const isSmall = () => matchMedia('(max-width: 760px)').matches;
export function fitZoom(coords,width,height,{top=76,bottom=160,left=30,right=30,maxZoom=12.7}={}) {
 const mercator=([lon,lat])=>[(lon+180)/360,(1-Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))/Math.PI)/2];
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 for(const c of coords){const [x,y]=mercator(c);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
 const zoom=Math.max(6,Math.min(maxZoom,Math.log2(Math.max(60,width-left-right)/(512*Math.max(maxX-minX,1e-8))),Math.log2(Math.max(60,height-top-bottom)/(512*Math.max(maxY-minY,1e-8)))));
 const y=(minY+maxY)/2;
 return {zoom,center:[(minX+maxX)/2*360-180,Math.atan(Math.sinh(Math.PI*(1-2*y)))*180/Math.PI]};
}
