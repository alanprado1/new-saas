// Content-only integration: real registered packs, API/server replay and client controller.
// A disposable memory store substitutes only the established database RPC contract.
// Existing PostgreSQL/ownership/outbox baselines are reused; no new database coverage or live writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadCourseModule} from '../../../lib/busuu-test-helpers.mjs';
import {chapterEightResponses,chapterEightActions} from '../../../lib/busuu-chapter-eight-responses.mjs';
const server=loadCourseModule('lib/busuu/attempt-server.ts'),Client=loadCourseModule('lib/busuu/attempt-client.ts').CourseAttemptSession;
const owner='10000000-0000-4000-8000-000000000008',rows=[],events=[];
const storageMap=new Map(),storage={get length(){return storageMap.size;},key:i=>[...storageMap.keys()][i]??null,getItem:k=>storageMap.get(k)??null,setItem:(k,v)=>storageMap.set(k,v),removeItem:k=>storageMap.delete(k)};
const clone=structuredClone;
const adapter={auth:{getUser:async()=>({data:{user:{id:owner}},error:null})},async rpc(name,p){
 let row;
 if(name==='course_start_attempt'){
  row=rows.find(r=>r.user_id===p.p_user&&r.record_id===p.p_record&&r.content_version===p.p_version&&r.active);
  if(p.p_restart&&row){row.active=false;row=null;}
  if(!row){row={id:p.p_id,user_id:p.p_user,record_id:p.p_record,content_version:p.p_version,content_hash:p.p_hash,revision:0,state:clone(p.p_state),result:clone(p.p_result),completed_at:null,active:true};rows.push(row);}
 }else if(name==='course_save_event'){
  row=rows.find(r=>r.id===p.p_attempt&&r.user_id===p.p_user);
  assert.ok(row&&row.revision+1===p.p_sequence,'established RPC sequence');
  events.push({attempt_id:row.id,user_id:p.p_user,request_id:p.p_request,sequence:p.p_sequence,action:clone(p.p_action)});
  Object.assign(row,{state:clone(p.p_state),result:clone(p.p_result),revision:p.p_sequence,completed_at:p.p_complete?'2026-10-05T00:00:00Z':null});
 }else throw new Error(`Unexpected RPC ${name}`);
 return {data:clone(row),error:null};
},from(table){const filters=[];const q={select(){return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},async maybeSingle(){const values=table==='course_attempts'?rows:events;return{data:clone(values.find(r=>filters.every(f=>f(r)))??null),error:null};}};return q;}};
const previousKey=process.env.SUPABASE_SERVICE_ROLE_KEY;process.env.SUPABASE_SERVICE_ROLE_KEY='disposable-memory-contract';
const route=loadCourseModule('app/api/course/attempts/route.ts',{'@/utils/supabase/server':{createClient:async()=>adapter},'@supabase/supabase-js':{createClient:()=>adapter}});
const transport=async(url,body,expectedOwner)=>{const response=await route.POST(new Request(`http://localhost${url}`,{method:'POST',headers:{'Content-Type':'application/json','X-Course-Owner':expectedOwner,Origin:'http://localhost'},body:JSON.stringify(body)}));const result=await response.json();if(!response.ok)throw new Error(result.error);return result;};
let assertions=0;const equal=(a,b,label)=>{assert.deepEqual(a,b,label);assertions++;},verify=(v,label)=>{assert.ok(v,label);assertions++;},report=[];
try{
 for(const id of Object.keys(chapterEightResponses))for(const retryCorrect of id==='B2.C08.L01'?[false,true]:[null]){
  const p=server.coursePack(id).pack,make=()=>new Client(p,owner,storage,transport,()=>{},`${id}:${retryCorrect}`);
  let session=make();await session.open();if(retryCorrect===true)await session.restart();verify(session.snapshot().ready,`${id} saved start`);
  if(p.completion?.optionalSurfaces.length){
   const a=session.snapshot().confirmed,beforeEvents=events.length,beforeRow=clone(a),surface=p.completion.optionalSurfaces[0];
   const response=await route.POST(new Request(`http://localhost/api/course/attempts?attempt=${a.id}`,{method:'POST',headers:{'Content-Type':'application/json','X-Course-Owner':owner,Origin:'http://localhost'},body:JSON.stringify({contentVersion:p.contentVersion,contentHash:a.content_hash,sequence:a.revision+1,requestId:'90000000-0000-4000-8000-000000000008',action:{type:'typed_draft',screenId:surface.screenId,text:'お腹が空いたのかな。'}})}));
   equal(response.status,409,'optional endpoint rejected by the real evaluator');equal(events.length,beforeEvents,'optional writing emits no saved events');equal(rows.find(r=>r.id===a.id),beforeRow,'optional event rejection preserves saved required state');
  }
  const send=async a=>{session.dispatch({...a,screenId:p.screens[session.snapshot().state.index].screenId});await session.retry();verify(session.snapshot().status==='saved','response acknowledged');};
  const reopen=async()=>{const before=clone(session.snapshot().state);session.dispose();session=make();await session.open();equal(session.snapshot().state,before,'saved account-owned resume');};
  const target=p.retryPolicy?16:p.screens.findIndex(s=>['choice','truth'].includes(s.renderer));
  const wrong=s=>s.renderer==='truth'?!chapterEightResponses[id][target][0]:s.answer.options.find(o=>!s.answer.acceptedOptionIds.includes(o.id)).id;
  const respond=async(i,error=false)=>{const s=p.screens[i];if(!session.snapshot().state.audioReady)await send({type:'audio_ready'});
   for(const [j,v]of (error?[wrong(s)]:chapterEightResponses[id][i]).entries())for(const action of chapterEightActions(s,v,j,session.snapshot().state))await send(action);
   if(s.renderer==='typed')await send({type:'typed_check'});
  };
  for(const [i,s]of p.screens.entries()){
   equal(session.snapshot().state.index,i,'canonical base path');
   if(s.screenId.includes('.A02.S01'))await reopen();await respond(i,i===target);
   if(s.answer)equal(session.snapshot().state.outcomes[i]?.correct,i!==target,'independent first accuracy');
   if(i===p.baseScreenCount-1)verify(!session.snapshot().confirmed.completed_at,'completion waits for final Continue');
   await send({type:'continue'});
  }
  if(p.retryPolicy){
   equal(session.snapshot().state.index,16,'only documented retry after all base screens');equal(session.snapshot().state.visited.length,20,'retry preserves base count');
   verify(!session.snapshot().state.audioReady,'retry fresh listening');await reopen();const first=clone(session.snapshot().state.outcomes);
   await respond(16,!retryCorrect);equal(session.snapshot().state.outcomes,first,'saved first outcomes immutable');await send({type:'continue'});
   equal(session.snapshot().state.retryOutcomes[16].correct,retryCorrect,'saved retry outcome independent');
  }
  await reopen();const a=session.snapshot().confirmed,graded=p.screens.filter(s=>s.answer).length;
  verify(a.user_id===owner&&a.completed_at&&a.result.completionEligible,'required completion saved to correct account');
  equal(a.result.percent,Math.round((graded-1)/graded*100),'one first error still completes');equal(new Set(a.state.visited).size,p.baseScreenCount,'unique required surfaces');
  if(id.endsWith('.CP'))equal(loadCourseModule('lib/busuu/runner.ts').getPassOutcome(p,a.result),null,'explicit no-pass-policy reporting');
  report.push({recordId:id,requiredScreens:p.baseScreenCount,accuracy:a.result.percent,retryCorrect,saved:true,reloaded:true});session.dispose();
 }
 const progress=loadCourseModule('lib/busuu/progress.ts'),saved=progress.savedCourseProgress([...rows,...rows]);
 equal(Object.keys(saved).length,8,'eight unique saved entries despite duplicate attempts/rows');
 equal(progress.chapterCompletion(loadCourseModule('lib/busuu/inventory.ts').getLevelInventory('B2').chapters[7],saved),100,'chapter completion independent of accuracy');
 verify(Object.values(saved).every(p=>p.accuracy<100),'map completion is not an accuracy score');
 fs.writeFileSync(new URL('./saved-path.json',import.meta.url),JSON.stringify({date:'2026-10-05',assertions,storage:'disposable memory RPC adapter; actual API/client/evaluator',existingDatabaseBaselineReused:true,uniqueCompletedEntries:8,chapterCompletion:100,optionalWritingEventsExcluded:true,packs:report,liveDatabaseWrites:false},null,2)+'\n');
 console.log(`${assertions} registered API/client/evaluator saved-path assertions passed; all eight entries reload, both retry outcomes complete, unique chapter completion 100%. No database run.`);
}finally{if(previousKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=previousKey;}

