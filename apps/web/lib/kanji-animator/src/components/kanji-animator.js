import { Timeline } from '../engine/timeline.js';
import { kanjiLoader } from '../data/loader.js';
import { validateKanji } from '../data/validate.js';
import { createReveal } from '../geometry/sweep.js';
import { normalizeStyle } from '../styles/defaults.js';
import { getStrokeStyle, DEFAULT_GEOMETRY_STYLE } from '../styles/geometry-style.js';
let instanceCount=0;
const NS='http://www.w3.org/2000/svg';
function svgElement(document,tag,attributes={}){const node=document.createElementNS(NS,tag);for(const [key,value] of Object.entries(attributes))node.setAttribute(key,String(value));return node;}

/** Mountable framework-neutral component. The host owns its surrounding UI. */
export class KanjiAnimator {
  constructor(container,options={}) {
    if(!container?.ownerDocument)throw new TypeError('KanjiAnimator requires a DOM element');
    this.container=container;this.document=container.ownerDocument;this.view=this.document.defaultView;
    this.options={autoplay:false,showOutline:true,respectReducedMotion:true,autoSchedule:true,geometryStyle:DEFAULT_GEOMETRY_STYLE,...options};
    getStrokeStyle(this.options.geometryStyle);
    this.loader=options.loader||kanjiLoader;this.style=normalizeStyle(options.style);this.speed=options.speed??1;
    if(!Number.isFinite(this.speed)||this.speed<=0||this.speed>20)throw new TypeError('Invalid speed');
    this.id=`kanji-${++instanceCount}`;this.listeners=new Set();this.generation=0;this.destroyed=false;this.frame=null;
    this.svg=svgElement(this.document,'svg',{viewBox:'0 0 109 109',role:'img','aria-label':'Kanji stroke animation',preserveAspectRatio:'xMidYMid meet'});
    this.svg.style.cssText='display:block;max-width:100%;height:auto;';this.container.append(this.svg);this.applyStyle();
    this.ready=options.data ? Promise.resolve(this.setData(options.data)) : options.character ? this.setCharacter(options.character) : Promise.resolve(null);
  }
  assertAlive(){if(this.destroyed)throw new Error('KanjiAnimator has been destroyed');}
  async setCharacter(character,{geometryStyle=this.options.geometryStyle}={}) {
    this.assertAlive();getStrokeStyle(geometryStyle);this.options.geometryStyle=geometryStyle;
    const generation=++this.generation;this.pause();this.container.setAttribute('aria-busy','true');
    try {
      const data=await this.loader.load(character,{geometryStyle});
      if(this.destroyed || generation!==this.generation)return null;
      if(data.style!==geometryStyle)throw new TypeError('Loader returned a different stroke style');
      this.setData(data);return data;
    } catch(error) {
      if(this.destroyed || generation!==this.generation)return null;
      if(this.data)this.options.geometryStyle=this.data.style;
      this.options.onError?.(error);throw error;
    } finally {if(!this.destroyed && generation===this.generation)this.container.removeAttribute('aria-busy');}
  }
  async setGeometryStyle(geometryStyle){
    this.assertAlive();getStrokeStyle(geometryStyle);
    if(!this.data)throw new Error('Wait for a character to load before switching stroke style');
    return this.setCharacter(this.data.character,{geometryStyle});
  }
  setData(data) {
    this.assertAlive();validateKanji(data);
    const timeline=new Timeline(data.strokeCount,{...data.animation,...this.options.animation},{now:this.options.now,speed:this.speed});
    this.generation++;this.options.geometryStyle=data.style;this.container.removeAttribute('aria-busy');this.cancelFrame();this.data=data;this.timeline=timeline;
    this.svg.replaceChildren();this.svg.setAttribute('aria-label',`${data.character}, ${data.strokeCount} strokes`);
    const title=svgElement(this.document,'title');title.textContent=`${data.character} — Japanese stroke order`;this.svg.append(title);
    const defs=svgElement(this.document,'defs'),ink=svgElement(this.document,'g',{'data-layer':'ink'}),outline=svgElement(this.document,'g',{'data-layer':'outline',fill:'none'});
    outline.append(svgElement(this.document,'path',{d:data.glyph.path,'fill-rule':'nonzero','stroke-linejoin':'round'}));
    let fontParts;
    const brush=data.style==='animcjk-brush-v1';
    this.completedFontRegion=null;this.fontCompletedCount=-1;
    {
      const mask=svgElement(this.document,'mask',{id:`${this.id}-font-mask`,maskUnits:'userSpaceOnUse',maskContentUnits:'userSpaceOnUse',x:0,y:0,width:109,height:109,'mask-type':'alpha'});
      // Brush silhouettes may overlap with opposing winding. Separate children
      // compose as opaque ink instead of cancelling inside a compound path.
      this.completedFontRegion=svgElement(this.document,brush?'g':'path',{fill:'white','fill-rule':'nonzero'});
      this.completedBrushPaths=brush?data.strokes.map(stroke=>svgElement(this.document,'path',{d:stroke.silhouettePath,fill:'white','fill-rule':'nonzero'})):null;
      fontParts=svgElement(this.document,'g',{fill:'white'});mask.append(this.completedFontRegion,fontParts);defs.append(mask);
    }
    this.layers=data.strokes.map((stroke,i)=> {
      const id=`${this.id}-mask-${i}`;
      // A direct mask child repaints every frame; nested SVG masks can retain stale rasters.
      const clip=svgElement(this.document,'clipPath',{id,clipPathUnits:'userSpaceOnUse'});
      clip.append(svgElement(this.document,'path',{d:stroke.silhouettePath,'clip-rule':brush?'nonzero':'evenodd'}));defs.append(clip);
      const filled=svgElement(this.document,'path',{fill:'white','fill-rule':'nonzero','clip-path':`url(#${id})`,'data-stroke':i+1});
      fontParts.append(filled);
      return {reveal:filled,filled,buildReveal:createReveal(stroke),progress:-1};
    });
    this.completeGlyph=svgElement(this.document,brush?'g':'path',{...(!brush?{d:data.glyph.path}:{}),'data-font-complete':'true','fill-rule':'nonzero'});
    if(brush)for(const stroke of data.strokes)this.completeGlyph.append(svgElement(this.document,'path',{d:stroke.silhouettePath,'fill-rule':'nonzero'}));
    ink.append(this.completeGlyph);
    this.ink=ink;this.outline=outline;this.svg.append(defs,outline,ink);this.applyStyle();this.render();
    if(this.options.autoplay) {
      if(this.options.respectReducedMotion && this.view.matchMedia?.('(prefers-reduced-motion: reduce)').matches)this.finish();
      else this.play();
    }
    return data;
  }
  applyStyle() {
    this.svg.setAttribute('width',this.style.size);this.svg.setAttribute('height',this.style.size);
    this.svg.style.backgroundColor=this.style.backgroundColor;
    if(this.ink)this.ink.setAttribute('fill',this.style.fillColor);
    if(this.outline){this.outline.setAttribute('stroke',this.style.outlineColor);this.outline.setAttribute('stroke-width',this.style.outlineWidth);this.outline.setAttribute('opacity',this.style.outlineOpacity);this.outline.style.display=this.options.showOutline?'':'none';}
  }
  setStyle(style){this.assertAlive();this.style=normalizeStyle({...this.style,...style});this.applyStyle();}
  setShowOutline(show){this.assertAlive();this.options.showOutline=Boolean(show);this.applyStyle();}
  setSpeed(speed){this.assertAlive();if(!Number.isFinite(speed)||speed<=0||speed>20)throw new TypeError('Invalid speed');this.speed=speed;this.timeline?.setSpeed(speed);this.render();}
  subscribe(callback){this.assertAlive();this.listeners.add(callback);if(this.timeline)callback(this.getState());return ()=>this.listeners.delete(callback);}
  getState(){return this.timeline?.getState()||null;}
  render() {
    if(this.destroyed || !this.timeline)return;
    const state=this.getState();
    const fontComplete=state.completedStrokes===this.data.strokeCount;
    this.layers.forEach((layer,i)=> {
      const progress=state.progress[i];
      layer.filled.style.visibility=progress===0||progress===1?'hidden':'visible';
      if(progress===layer.progress)return;layer.progress=progress;
      layer.reveal.setAttribute('d',progress===1?'':layer.buildReveal(progress));
    });
    if(this.completeGlyph){
      this.completeGlyph.style.visibility=state.progress.some(p=>p>0)?'visible':'hidden';
      if(state.completedStrokes!==this.fontCompletedCount){
        this.fontCompletedCount=state.completedStrokes;
        if(this.completedBrushPaths)this.completedFontRegion.replaceChildren(...this.completedBrushPaths.slice(0,state.completedStrokes));
        else this.completedFontRegion.setAttribute('d',this.data.strokes.slice(0,state.completedStrokes).map(s=>s.silhouettePath).join(''));
      }
      if(fontComplete)this.completeGlyph.removeAttribute('mask');
      else this.completeGlyph.setAttribute('mask',`url(#${this.id}-font-mask)`);
    }
    this.options.onStateChange?.(state);for(const listener of this.listeners)listener(state);
    if(state.status!=='playing')this.cancelFrame();
    return state;
  }
  schedule(){if(!this.options.autoSchedule || this.frame!==null || this.destroyed || this.getState()?.status!=='playing')return;this.frame=this.view.requestAnimationFrame(()=>{this.frame=null;this.render();this.schedule();});}
  cancelFrame(){if(this.frame!==null){this.view.cancelAnimationFrame(this.frame);this.frame=null;}}
  action(name){this.assertAlive();if(!this.timeline)return null;this.timeline[name]();const state=this.render();this.schedule();return state;}
  play(){return this.action('play');}
  pause(){return this.action('pause');}
  resume(){return this.action('resume');}
  restart(){return this.action('restart');}
  step(){return this.action('step');}
  reset(){return this.action('reset');}
  finish(){return this.action('finish');}
  destroy(){if(this.destroyed)return;this.destroyed=true;this.generation++;this.cancelFrame();this.listeners.clear();this.container.removeAttribute('aria-busy');this.svg.remove();this.layers=[];this.data=null;this.timeline=null;}
}
