export const DEFAULT_STYLE=Object.freeze({outlineColor:'#b3b8bf',fillColor:'#17232b',outlineOpacity:0.65,backgroundColor:'transparent',outlineWidth:0.45,size:420});
export const DEFAULT_ANIMATION=Object.freeze({strokeDurationMs:650,strokeDelayMs:150,outlineDelayMs:400});
export function normalizeStyle(style={}) {
  const result={...DEFAULT_STYLE,...style};
  for(const key of ['outlineColor','fillColor','backgroundColor']) if(typeof result[key]!=='string' || !result[key].trim()) throw new TypeError(`Invalid ${key}`);
  if(!Number.isFinite(result.outlineOpacity) || result.outlineOpacity<0 || result.outlineOpacity>1) throw new TypeError('Invalid outline opacity');
  if(!Number.isFinite(result.outlineWidth) || result.outlineWidth<0 || result.outlineWidth>3) throw new TypeError('Invalid outline width');
  if(!Number.isFinite(result.size) || result.size<16 || result.size>4096) throw new TypeError('Invalid character size');
  return result;
}
