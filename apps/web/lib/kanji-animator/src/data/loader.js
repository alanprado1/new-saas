import { validateKanji } from './validate.js';
import { getStrokeStyle, DEFAULT_GEOMETRY_STYLE } from '../styles/geometry-style.js';
export class MissingKanjiError extends Error {constructor(character){super(`No stroke data available for “${character}” in this appearance.`);this.name='MissingKanjiError';this.character=character;}}
function freeze(value){if(value && typeof value==='object' && !Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
function keyFor(character){if(typeof character!=='string' || [...character].length!==1)throw new TypeError('Enter exactly one character');return character.codePointAt(0).toString(16).padStart(5,'0')+'.json';}
export function createKanjiLoader({baseUrl=new URL('../../data/kanji/',import.meta.url).href,fetch:fetcher=globalThis.fetch?.bind(globalThis),maxEntries=64,persistentCache=true,cacheStorage=globalThis.caches,cacheName='kanji-geometry-v1'}={}) {
  if(!Number.isInteger(maxEntries) || maxEntries<1 || maxEntries>10000)throw new TypeError('Invalid cache limit');
  const base=new URL(baseUrl,globalThis.location?.href).href.replace(/\/?$/,'/');
  const memory=new Map(),pending=new Map();
  let storageQueue=Promise.resolve();
  const remember=(character,data)=> {memory.delete(character);memory.set(character,freeze(data));while(memory.size>maxEntries)memory.delete(memory.keys().next().value);return data;};
  const valid=(data,character,geometryStyle)=> {validateKanji(data);if(data.character!==character || data.style!==geometryStyle)throw new TypeError('Loaded character or stroke style does not match request');return data;};
  async function load(character,{geometryStyle=DEFAULT_GEOMETRY_STYLE}={}) {
    getStrokeStyle(geometryStyle);
    const filename=keyFor(character),file=geometryStyle+'/'+filename;
    const key=`${geometryStyle}:${character}`;
    if(memory.has(key)){const data=memory.get(key);memory.delete(key);memory.set(key,data);return data;}
    if(pending.has(key))return pending.get(key);
    const request=(async()=> {
      const url=new URL(file,base).href;let cache;
      if(persistentCache && cacheStorage) {
        try {cache=await cacheStorage.open(cacheName);const cached=await cache.match(url);if(cached){try{return remember(key,valid(await cached.json(),character,geometryStyle));}catch{await cache.delete(url);}}}catch{cache=undefined;}
      }
      if(!fetcher)throw new Error('No fetch implementation available');
      const response=await fetcher(url);
      if(response.status===404)throw new MissingKanjiError(character);
      if(!response.ok)throw new Error(`Unable to load ${character}: HTTP ${response.status}`);
      const data=valid(await response.json(),character,geometryStyle);
      if(cache) {
        // Serialise persistent writes/eviction so parallel lesson preloads stay bounded.
        storageQueue=storageQueue.then(async()=> {await cache.put(url,Response.json(data));const keys=await cache.keys();for(const key of keys.slice(0,Math.max(0,keys.length-maxEntries)))await cache.delete(key.url);}).catch(()=>{});
        await storageQueue;
      }
      return remember(key,data);
    })();
    pending.set(key,request);
    try{return await request;}finally{pending.delete(key);}
  }
  return {load,preloadKanji:(characters,options)=>Promise.all(characters.map(character=>load(character,options))),
    register:data=> {validateKanji(data);return remember(`${data.style}:${data.character}`,data);},
    get size(){return memory.size;},
    async clear({persistent=false}={}){await Promise.allSettled([...pending.values()]);memory.clear();if(persistent && cacheStorage){await storageQueue;const cache=await cacheStorage.open(cacheName);for(const key of await cache.keys())await cache.delete(key.url);}}
  };
}
export const kanjiLoader=createKanjiLoader();
export const preloadKanji=(characters,options)=>kanjiLoader.preloadKanji(characters,options);
