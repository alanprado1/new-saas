export interface AnimationConfig {strokeDurationMs:number;strokeDelayMs:number;outlineDelayMs:number;}
export interface VisualStyle {outlineColor:string;fillColor:string;outlineOpacity:number;backgroundColor:string;outlineWidth:number;size:number;}
export interface RevealSample {point:[number,number];distance:number;radius:number;}
export type GeometryStyle='animcjk-brush-v1'|'noto-sans-jp-regular-v1';
export interface GeometryOptions {geometryStyle?:GeometryStyle;}
export interface StrokeStyle {id:GeometryStyle;label:string;description:string;width:number;font?:boolean;}
export interface KanjiStroke {id:string;order:number;type:string;guidePath:string;silhouettePath:string;direction:{mode:'path-forward';start:[number,number];end:[number,number]};reveal:{method:'font-sweep';length:number;samples:RevealSample[];fontGuidePath:string};}
export interface KanjiData {schemaVersion:3;character:string;unicode:string;strokeCount:number;source:{name:'KanjiVG'|'AnimCJK';repository:string;revision:string;file:string;sha256:string;copyright:string;license:'CC-BY-SA-3.0'|'Arphic-1999';licenseUrl:string;modifications:string};style:GeometryStyle;viewBox:[0,0,109,109];strokes:KanjiStroke[];animation:AnimationConfig;glyph:{path:string;source:{name:'Noto Sans JP'|'AnimCJK Japanese';weight:400|null;repository:string;revision:string;file:string;sha256:string;license:'OFL-1.1'|'Arphic-1999'}};}
export interface AnimationState {status:'idle'|'playing'|'paused'|'completed';phase:'outline'|'stroke'|'gap'|'completed';elapsedMs:number;durationMs:number;speed:number;strokeCount:number;completedStrokes:number;currentStroke:number;progress:number[];}
export interface KanjiLoader {load(character:string,options?:GeometryOptions):Promise<KanjiData>;preloadKanji(characters:string[],options?:GeometryOptions):Promise<KanjiData[]>;register(data:KanjiData):KanjiData;readonly size:number;clear(options?:{persistent?:boolean}):Promise<void>;}
export interface LoaderOptions {baseUrl?:string|URL;fetch?:typeof fetch;maxEntries?:number;persistentCache?:boolean;cacheStorage?:CacheStorage;cacheName?:string;}
export interface AnimatorOptions {character?:string;data?:KanjiData;geometryStyle?:GeometryStyle;autoplay?:boolean;showOutline?:boolean;speed?:number;style?:Partial<VisualStyle>;animation?:Partial<AnimationConfig>;loader?:Pick<KanjiLoader,'load'>;respectReducedMotion?:boolean;autoSchedule?:boolean;now?:()=>number;onStateChange?:(state:AnimationState)=>void;onError?:(error:Error)=>void;}
export class KanjiAnimator {
  constructor(container:HTMLElement,options?:AnimatorOptions);
  readonly ready:Promise<KanjiData|null>;
  readonly svg:SVGSVGElement;
  readonly data:KanjiData|null;
  readonly timeline:Timeline|null;
  setCharacter(character:string,options?:GeometryOptions):Promise<KanjiData|null>;
  setGeometryStyle(style:GeometryStyle):Promise<KanjiData|null>;
  setData(data:KanjiData):KanjiData;
  setStyle(style:Partial<VisualStyle>):void;
  setShowOutline(show:boolean):void;
  setSpeed(speed:number):void;
  subscribe(callback:(state:AnimationState)=>void):()=>void;
  getState():AnimationState|null;
  render():AnimationState|undefined;
  play():AnimationState|null;pause():AnimationState|null;resume():AnimationState|null;restart():AnimationState|null;step():AnimationState|null;reset():AnimationState|null;finish():AnimationState|null;
  destroy():void;
}
export class Timeline {
  constructor(strokeCount:number,animation?:Partial<AnimationConfig>,options?:{now?:()=>number;speed?:number});
  readonly duration:number;readonly animation:AnimationConfig;
  getState():AnimationState;
  play():AnimationState;pause():AnimationState;resume():AnimationState;restart():AnimationState;step():AnimationState;reset():AnimationState;finish():AnimationState;setSpeed(speed:number):AnimationState;
}
export class MissingKanjiError extends Error {character:string;constructor(character:string);}
export function createKanjiLoader(options?:LoaderOptions):KanjiLoader;
export const kanjiLoader:KanjiLoader;
export function preloadKanji(characters:string[],options?:GeometryOptions):Promise<KanjiData[]>;
export function validateKanji(data:unknown):KanjiData;
export const DEFAULT_STYLE:Readonly<VisualStyle>;
export const DEFAULT_ANIMATION:Readonly<AnimationConfig>;
export const DEFAULT_GEOMETRY_STYLE:GeometryStyle;
export const STROKE_STYLES:ReadonlyArray<Readonly<StrokeStyle>>;
