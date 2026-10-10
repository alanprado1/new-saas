export const round = v => Math.round(v*1000)/1000;
/** All primitives have the same winding, so the reveal path uses nonzero union fill. */
export function disc(sample, sides=20) {
  return Array.from({length:sides},(_,i)=> {
    const theta=i*2*Math.PI/sides;
    return [round(sample.point[0]+Math.cos(theta)*sample.radius),round(sample.point[1]+Math.sin(theta)*sample.radius)];
  });
}
export function bridge(a,b) {
  const dx=b.point[0]-a.point[0],dy=b.point[1]-a.point[1],length=Math.hypot(dx,dy);
  if (!length) return disc(a);
  const n=[-dy/length,dx/length];
  return [[a,1],[a,-1],[b,-1],[b,1]].map(([s,sign])=>s.point.map((v,j)=>round(v+n[j]*s.radius*sign)));
}
export function polygonPath(ring) {
  return `M${ring.map(p=>p.map(round).join(',')).join('L')}Z`;
}
export function primitives(samples) {
  return samples.flatMap((sample,i)=>i ? [bridge(samples[i-1],sample),disc(sample)] : [disc(sample)]);
}
/** Monotone half-plane clipping of a fixed convex primitive. */
function clipForward(ring,a,b,t) {
  const dx=b.point[0]-a.point[0],dy=b.point[1]-a.point[1],length=Math.hypot(dx,dy);
  if(!length)return [];
  const axis=[dx/length,dy/length],origin=a.point[0]*axis[0]+a.point[1]*axis[1];
  const threshold=origin-a.radius+t*(length+a.radius+b.radius);
  const dot=p=>p[0]*axis[0]+p[1]*axis[1];
  const result=[];
  for(let i=0;i<ring.length;i++) {
    const from=ring[i],to=ring[(i+1)%ring.length],u=dot(from)-threshold,v=dot(to)-threshold;
    if(u<=0)result.push(from);
    if((u<=0)!==(v<=0)){const fraction=u/(u-v);result.push(from.map((n,j)=>n+(to[j]-n)*fraction));}
  }
  return result;
}
/** A sweep mask grows by directed arc length; visible ink is always a filled silhouette. */
export function createReveal(stroke) {
  if(stroke.id.startsWith('acjk:'))return createBrushReveal(stroke);
  const samples=stroke.reveal.samples;
  const pieces=primitives(samples).map(polygonPath);
  let index=-1,prefix='';
  return progress => {
    if (progress<=0) {index=-1;prefix='';return '';}
    const target=Math.min(1,progress)*stroke.reveal.length;
    let end=0;
    while (end+1<samples.length && samples[end+1].distance<=target) end++;
    if (end<index) {index=-1;prefix='';}
    if (index<0) {prefix=pieces[0];index=0;}
    while (index<end) {index++;prefix+=pieces[index*2-1]+pieces[index*2];}
    if (end===samples.length-1) return prefix;
    const a=samples[end],b=samples[end+1],t=(target-a.distance)/(b.distance-a.distance);
    // Clip fixed sweep primitives rather than moving a cap that can shrink behind tight curves.
    // Every region at a smaller t is a subset of the next, independent of frame history.
    return prefix+[bridge(a,b),disc(b)].map(ring=>clipForward(ring,a,b,t)).filter(ring=>ring.length>=3).map(polygonPath).join('');
  };
}

/** Brush caps enter progressively, including medians shorter than their ink width.
 * Each fixed primitive is clipped by its own forward tangent and a common
 * increasing arc-length front. This also keeps tight turns monotone.
 */
function createBrushReveal(stroke){
  const samples=stroke.reveal.samples,radius=Math.max(...samples.map(s=>s.radius));
  const items=[];
  const add=(ring,a,b)=>{
    const dx=b.point[0]-a.point[0],dy=b.point[1]-a.point[1],length=Math.hypot(dx,dy);
    const axis=length?[dx/length,dy/length]:[1,0],dot=p=>p[0]*axis[0]+p[1]*axis[1],origin=dot(a.point);
    const projections=ring.map(dot),low=Math.min(...projections)-origin+a.distance,high=Math.max(...projections)-origin+a.distance;
    items.push({ring,a,b,axis,origin,low,high,path:polygonPath(ring)});
  };
  samples.forEach((sample,i)=>{
    const a=i===samples.length-1?samples[i-1]:sample,b=i===samples.length-1?sample:samples[i+1];
    add(disc(sample),a,b);
    if(i)add(bridge(samples[i-1],sample),samples[i-1],sample);
  });
  items.sort((a,b)=>a.high-b.high);
  let previous=-Infinity,completed=0,prefix='';
  return progress=>{
    if(progress<=0){previous=-Infinity;completed=0;prefix='';return '';}
    const target=Math.min(1,progress)*(stroke.reveal.length+2*radius)-radius;
    if(target<previous){completed=0;prefix='';}previous=target;
    while(completed<items.length&&items[completed].high<=target)prefix+=items[completed++].path;
    let active='';
    for(let i=completed;i<items.length;i++){
      const item=items[i];if(item.low>=target)continue;
      const threshold=item.origin+target-item.a.distance,result=[];
      const dot=p=>p[0]*item.axis[0]+p[1]*item.axis[1];
      for(let j=0;j<item.ring.length;j++){
        const from=item.ring[j],to=item.ring[(j+1)%item.ring.length],u=dot(from)-threshold,v=dot(to)-threshold;
        if(u<=0)result.push(from);
        if((u<=0)!==(v<=0)){const t=u/(u-v);result.push(from.map((n,k)=>n+(to[k]-n)*t));}
      }
      if(result.length>=3)active+=polygonPath(result);
    }
    return prefix+active;
  };
}
