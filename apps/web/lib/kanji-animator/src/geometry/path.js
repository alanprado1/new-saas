/** Strict single-subpath KanjiVG cubic parser. Coordinates retain source direction. */
export function parsePath(d) {
  if (typeof d !== 'string' || !d.trim()) throw new TypeError('Empty SVG guide');
  const tokens = d.match(/[MmCcSs]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) || [];
  if (d.replace(/[MmCcSs]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?|[\s,]/g,'')) throw new TypeError('Unsupported SVG command or number');
  let i=0, command, current=[0,0], previousControl, moved=false;
  const curves=[];
  const number = () => { const n=Number(tokens[i++]); if (!Number.isFinite(n)) throw new TypeError('Invalid cubic coordinate'); return n; };
  const point = relative => { const p=[number(),number()]; return relative ? p.map((v,j)=>v+current[j]) : p; };
  while (i<tokens.length) {
    if (/^[MmCcSs]$/.test(tokens[i])) command=tokens[i++];
    else if (!command || /[Mm]/.test(command)) throw new TypeError('Expected cubic command');
    const relative=command===command.toLowerCase();
    if (/[Mm]/.test(command)) {
      if (moved) throw new TypeError('Multiple subpaths are not supported');
      current=point(relative); moved=true; command=null;
    } else {
      if (!moved) throw new TypeError('Guide must begin with moveto');
      const start=current.slice();
      const c1=/[Cc]/.test(command) ? point(relative) : previousControl ? current.map((v,j)=>2*v-previousControl[j]) : start.slice();
      const c2=point(relative), end=point(relative);
      curves.push([start,c1,c2,end]); current=end; previousControl=c2;
    }
  }
  if (!curves.length) throw new TypeError('Guide has no cubic segments');
  return curves;
}
const midpoint=(a,b)=>a.map((v,i)=>(v+b[i])/2);
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function flatten(curve, out, depth=0) {
  const [a,b,c,d]=curve;
  const chord=distance(a,d);
  const deviation=p=>chord ? Math.abs((d[0]-a[0])*(p[1]-a[1])-(d[1]-a[1])*(p[0]-a[0]))/chord : distance(a,p);
  // Bound perpendicular error as well as polygon excess: long shallow curves still matter.
  if (depth>=18 || (Math.max(deviation(b),deviation(c))<0.015 && distance(a,b)+distance(b,c)+distance(c,d)-chord<0.008)) { out.push(d); return; }
  const ab=midpoint(a,b),bc=midpoint(b,c),cd=midpoint(c,d),abc=midpoint(ab,bc),bcd=midpoint(bc,cd),m=midpoint(abc,bcd);
  flatten([a,ab,abc,m],out,depth+1); flatten([m,bcd,cd,d],out,depth+1);
}
export function samplePath(d, spacing=0.7) {
  if (!(spacing>0) || !Number.isFinite(spacing)) throw new TypeError('Invalid sample spacing');
  const curves=parsePath(d), poly=[curves[0][0]];
  curves.forEach(c=>flatten(c,poly));
  const result=[{point:poly[0].slice(),distance:0}];
  let length=0, next=spacing;
  for (let i=1;i<poly.length;i++) {
    const a=poly[i-1],b=poly[i],segment=distance(a,b);
    if (segment===0) continue;
    while (next<length+segment) {
      const t=(next-length)/segment;
      result.push({point:a.map((v,j)=>v+(b[j]-v)*t),distance:next}); next+=spacing;
    }
    length+=segment;
  }
  if (length<0.01) throw new TypeError('Degenerate guide');
  result.push({point:poly.at(-1).slice(),distance:length});
  return result;
}
