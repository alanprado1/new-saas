import { parsePath } from '../geometry/path.js';
import { getStrokeStyle } from '../styles/geometry-style.js';
const fail = message => {throw new TypeError(`Invalid kanji data: ${message}`);};
const object=(v,name,keys)=> {
  if (!v || typeof v!=='object' || Array.isArray(v)) fail(name);
  if (Object.keys(v).some(k=>!keys.includes(k)) || keys.some(k=>!(k in v))) fail(`${name} fields`);
};
const finite=(v,min,max)=>typeof v==='number' && Number.isFinite(v) && v>=min && v<=max;
const point=v=>Array.isArray(v) && v.length===2 && v.every(n=>finite(n,-10,119));
const equal=(a,b)=>a.every((n,i)=>Math.abs(n-b[i])<=0.001);
const closedPath=(path,name,coordinateMax=119)=>{
  if(typeof path!=='string'||path.length>500000||!/^[MLCQZ0-9.,\s-]+$/.test(path)||!path.startsWith('M')||!path.endsWith('Z'))fail(name);
  let open=false,segments=0;
  for(const group of path.match(/[MLCQZ][^MLCQZ]*/g)||[]){
    const command=group[0],nums=group.slice(1).trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if(nums.length!==({M:2,L:2,C:6,Q:4,Z:0})[command]||nums.some(n=>!finite(n,-10,coordinateMax)))fail(`${name} command`);
    if(command==='M'){if(open)fail(`${name} open ring`);open=true;segments=0;}
    else if(command==='Z'){if(!open||segments<2)fail(`${name} ring`);open=false;}
    else{if(!open)fail(`${name} order`);segments++;}
  }
  if(open)fail(`${name} open ring`);
};
export function validateKanji(d) {
  object(d,'root',['schemaVersion','character','unicode','strokeCount','source','style','viewBox','strokes','animation','glyph']);
  if(d.schemaVersion!==3 || typeof d.character!=='string' || [...d.character].length!==1) fail('character/version');
  if(d.unicode!==d.character.codePointAt(0).toString(16).toUpperCase().padStart(4,'0')) fail('unicode');
  if(!Number.isInteger(d.strokeCount) || d.strokeCount<1 || d.strokeCount>64 || !Array.isArray(d.strokes) || d.strokes.length!==d.strokeCount) fail('strokeCount');
  if(typeof d.style!=='string')fail('style');getStrokeStyle(d.style);
  const brush=d.style==='animcjk-brush-v1';
  {
    object(d.glyph,'glyph',['path','source']);
    closedPath(d.glyph.path,'glyph outline');
    const source=d.glyph.source;object(source,'font source',['name','weight','repository','revision','file','sha256','license']);
    if(!(/^[a-f0-9]{40}$/).test(source.revision)||!(/^[a-f0-9]{64}$/).test(source.sha256))fail('glyph source hash');
    if(brush){
      if(source.name!=='AnimCJK Japanese'||source.weight!==null||source.repository!=='https://github.com/parsimonhi/animCJK'||source.file!==`svgsJa/${d.character.codePointAt(0)}.svg`||source.license!=='Arphic-1999')fail('brush source attribution');
    }else if(source.name!=='Noto Sans JP'||source.weight!==400||source.repository!=='https://github.com/notofonts/noto-cjk'||source.file!=='Sans/SubsetOTF/JP/NotoSansJP-Regular.otf'||source.license!=='OFL-1.1')fail('font source attribution');
  }
  if(JSON.stringify(d.viewBox)!=='[0,0,109,109]') fail('style/viewBox');
  object(d.source,'source',['name','repository','revision','file','sha256','copyright','license','licenseUrl','modifications']);
  if(!/^[a-f0-9]{40}$/.test(d.source.revision)||!/^[a-f0-9]{64}$/.test(d.source.sha256))fail('source hash');
  if(brush){
    if(d.source.name!=='AnimCJK'||d.source.repository!=='https://github.com/parsimonhi/animCJK'||d.source.license!=='Arphic-1999'||d.source.licenseUrl!==`https://github.com/parsimonhi/animCJK/blob/${d.source.revision}/licenses/APL/english/ARPHICPL.TXT`||d.source.file!==`svgsJa/${d.character.codePointAt(0)}.svg`)fail('brush source attribution');
    if(d.glyph.source.revision!==d.source.revision||d.glyph.source.sha256!==d.source.sha256)fail('brush provenance mismatch');
  }else if(d.source.name!=='KanjiVG'||d.source.repository!=='https://github.com/KanjiVG/kanjivg'||d.source.license!=='CC-BY-SA-3.0'||d.source.licenseUrl!=='https://creativecommons.org/licenses/by-sa/3.0/'||d.source.file!==`kanji/${d.unicode.toLowerCase().padStart(5,'0')}.svg`)fail('source attribution');
  if(typeof d.source.copyright!=='string'||!d.source.copyright||typeof d.source.modifications!=='string'||!d.source.modifications)fail('source fields');
  object(d.animation,'animation',['strokeDurationMs','strokeDelayMs','outlineDelayMs']);
  for(const [k,v] of Object.entries(d.animation)) if(!finite(v,k==='strokeDurationMs'?1:0,60000)) fail(k);
  d.strokes.forEach((s,i)=> {
    object(s,'stroke',['id','order','type','guidePath','silhouettePath','direction','reveal']);
    if(s.id!==(brush?`acjk:${d.character.codePointAt(0)}-s${i+1}`:`kvg:${d.unicode.toLowerCase().padStart(5,'0')}-s${i+1}`)||s.order!==i+1||typeof s.type!=='string')fail('stroke ID/order/type');
    const curves=parsePath(s.guidePath);
    if(typeof s.silhouettePath!=='string' || s.silhouettePath.length>500000) fail('closed silhouette');
    const coordinate='-?(?:\\d+(?:\\.\\d+)?)';
    const pair=`${coordinate},${coordinate}`;
    // Each closed ring must contain at least three complete vertices, with no orphan commands.
    // Bézier controls may lie beyond the canvas while the curve stays inside it.
    // The pinned brush corpus reaches 122.519 units at a control, not visible ink.
    if(brush)closedPath(s.silhouettePath,'stroke silhouette',130);
    else{
      if(!new RegExp(`^(?:M${pair}(?:L${pair}){2,}Z)+$`).test(s.silhouettePath)) fail('closed polygon syntax');
      const values=s.silhouettePath.match(/-?\d+(?:\.\d+)?/g).map(Number);
      if(values.length<6 || values.some(n=>!finite(n,-10,119))) fail('silhouette coordinates');
    }
    object(s.direction,'direction',['mode','start','end']);
    object(s.reveal,'reveal',['method','length','samples','fontGuidePath']);
    const samples=s.reveal.samples;
    if(s.direction.mode!=='path-forward' || !point(s.direction.start) || !point(s.direction.end) || !equal(s.direction.start,curves[0][0]) || !equal(s.direction.end,curves.at(-1)[3])) fail('source direction');
    if(s.reveal.method!=='font-sweep' || !finite(s.reveal.length,0.01,2000) || !Array.isArray(samples) || samples.length<2 || samples.length>10000) fail('reveal');
    const fillCurves=parsePath(s.reveal.fontGuidePath);
    samples.forEach((p,j)=> {
      object(p,'sample',['point','distance','radius']);
      if(!point(p.point) || !finite(p.radius,0.05,24) || !finite(p.distance,0,s.reveal.length) || (j===0?p.distance!==0:p.distance<=samples[j-1].distance)) fail('reveal sample');
    });
    if(!equal(samples[0].point,fillCurves[0][0]) || !equal(samples.at(-1).point,fillCurves.at(-1)[3]) || samples.at(-1).distance!==s.reveal.length) fail('reveal endpoints');
  });
  return d;
}
