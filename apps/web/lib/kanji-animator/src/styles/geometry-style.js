export const DEFAULT_GEOMETRY_STYLE='animcjk-brush-v1';
export const STROKE_STYLES=Object.freeze([
  Object.freeze({id:DEFAULT_GEOMETRY_STYLE,label:'AnimCJK brush',description:'Japanese brush strokes · all Jōyō kanji',width:8.938,font:false}),
  Object.freeze({id:'noto-sans-jp-regular-v1',label:'Noto Sans JP',description:'Noto Sans Japanese · eleven reviewed examples',width:8.938,font:true})
]);
export function getStrokeStyle(id=DEFAULT_GEOMETRY_STYLE){const style=STROKE_STYLES.find(s=>s.id===id);if(!style)throw new TypeError(`Unknown stroke style: ${id}`);return style;}
