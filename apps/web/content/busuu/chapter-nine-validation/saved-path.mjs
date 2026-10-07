// Actual registered API/client/evaluator; only the established RPC storage is disposable memory.
// Reuses PostgreSQL/ownership/transport baselines. No database or owner progress writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadCourseModule} from '../../../lib/busuu-test-helpers.mjs';
import {chapterNineResponses,chapterNineActions} from '../../../lib/busuu-chapter-nine-responses.mjs';
const server=loadCourseModule('lib/busuu/attempt-server.ts'),Client=loadCourseModule('lib/busuu/attempt-client.ts').CourseAttemptSession;
const owner='10000000-0000-4000-8000-000000000009',rows=[],events=[];
const storageMap=new Map(),storage={get length(){return storageMap.size;},key:i=>[...storageMap.keys()][i]??null,getItem:k=>storageMap.get(k)??null,setItem:(k,v)=>storageMap.set(k,v),removeItem:k=>storageMap.delete(k)};
const clone=structuredClone;
const adapter={auth:{getUser:async()=>({data:{user:{id:owner}},error:null})},async rpc(name,p){
 let row;
 if(name==='course_start_attempt'){
  row=rows.find(r=>r.user_id===p.p_user&&r.record_id===p.p_record&&r.content_version===p.p_version&&r.active);
  if(p.p_restart&&row){row.active=false;row=null;}
  if(!row){row={id:p.p_id,user_id:p.p_user,record_id:p.p_record,content_version:p.p_version,content_hash:p.p_hash,revision:0,state:clone(p.p_state),result:clone(p.p_result),completed_at:null,active:true};rows.push(row);}
 }else if(name==='course_save_event'){
  row=rows.find(r=>r.id===p.p_attempt&&r.user_id===p.p_user);assert.ok(row&&row.revision+1===p.p_sequence,'established RPC sequence');
  events.push({attempt_id:row.id,user_id:p.p_user,request_id:p.p_request,sequence:p.p_sequence,action:clone(p.p_action)});
  Object.assign(row,{state:clone(p.p_state),result:clone(p.p_result),revision:p.p_sequence,completed_at:p.p_complete?'2026-10-06T00:00:00Z':null});
 }else throw Error(`Unexpected RPC ${name}`);
 return{data:clone(row),error:null};
},from(table){const filters=[];const q={select(){return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},async maybeSingle(){const values=table==='course_attempts'?rows:events;return{data:clone(values.find(r=>filters.every(f=>f(r)))??null),error:null};}};return q;}};
const previousKey=process.env.SUPABASE_SERVICE_ROLE_KEY;process.env.SUPABASE_SERVICE_ROLE_KEY='disposable-memory-contract';
const route=loadCourseModule('app/api/course/attempts/route.ts',{'@/utils/supabase/server':{createClient:async()=>adapter},'@supabase/supabase-js':{createClient:()=>adapter}});
const transport=async(url,body,expectedOwner)=>{const response=await route.POST(new Request(`http://localhost${url}`,{method:'POST',headers:{'Content-Type':'application/json','X-Course-Owner':expectedOwner,Origin:'http://localhost'},body:JSON.stringify(body)}));const result=await response.json();if(!response.ok)throw Error(result.error);return result;};
let assertions=0;const equal=(a,b,label)=>{assert.deepEqual(a,b,label);assertions++;},verify=(v,label)=>{assert.ok(v,label);assertions++;},report=[];
try{
 for(const id of Object.keys(chapterNineResponses)){
  const p=server.coursePack(id).pack,target=p.retryPolicy?p.screens.findIndex(s=>s.screenId===p.retryPolicy.screenIds[0]):p.screens.findIndex(s=>['choice','truth'].includes(s.renderer));
  for(const retryCorrect of p.retryPolicy?[false,true]:[null]){
   const make=()=>new Client(p,owner,storage,transport,()=>{},`${id}:${retryCorrect}`);let session=make();await session.open();if(retryCorrect===true)await session.restart();
   verify(session.snapshot().ready,`${id} registered saved start`);
   if(p.completion?.optionalSurfaces.length){
    const a=session.snapshot().confirmed,beforeEvents=events.length,beforeRow=clone(a),surface=p.completion.optionalSurfaces[0];
    const response=await route.POST(new Request(`http://localhost/api/course/attempts?attempt=${a.id}`,{method:'POST',headers:{'Content-Type':'application/json','X-Course-Owner':owner,Origin:'http://localhost'},body:JSON.stringify({contentVersion:p.contentVersion,contentHash:a.content_hash,sequence:a.revision+1,requestId:'90000000-0000-4000-8000-000000000009',action:{type:'typed_draft',screenId:surface.screenId,text:'ラテにする。'}})}));
    equal(response.status,409,'optional endpoint rejected by real evaluator');equal(events.length,beforeEvents,'optional writing emits no events');equal(rows.find(r=>r.id===a.id),beforeRow,'optional rejection preserves saved state');
   }
   const send=async a=>{session.dispatch({...a,screenId:p.screens[session.snapshot().state.index].screenId});await session.retry();verify(session.snapshot().status==='saved','acknowledged response');};
   const reopen=async()=>{const before=clone(session.snapshot().state);session.dispose();session=make();await session.open();equal(session.snapshot().state,before,'account-owned saved reload');};
   const wrong=s=>s.renderer==='truth'?!chapterNineResponses[id][target][0]:s.answer.options.find(o=>!s.answer.acceptedOptionIds.includes(o.id)).id;
   const respond=async(i,error=false)=>{
    const s=p.screens[i];if(!session.snapshot().state.audioReady)await send({type:'audio_ready'});
    for(const [j,v]of(error?[wrong(s)]:chapterNineResponses[id][i]).entries())for(const a of chapterNineActions(s,v,j,session.snapshot().state))await send(a);
    if(s.renderer==='typed')await send({type:'typed_check'});if(s.renderer==='multi_choice')await send({type:'selection_check'});
   };
   let retryCount=0;
   for(const [i,s]of p.screens.entries()){
    equal(session.snapshot().state.index,i,'canonical base order');if(s.screenId.includes('.A02.S01'))await reopen();
    await respond(i,i===target);if(s.answer)equal(session.snapshot().state.outcomes[i]?.correct,i!==target,'independent first accuracy');
    if(i===p.baseScreenCount-1)verify(!session.snapshot().confirmed.completed_at,'completion waits for Continue');await send({type:'continue'});
    if(session.snapshot().state.retry){
     retryCount++;const boundary=id==='B2.C09.L02'?9:p.baseScreenCount;
     equal(i+1,boundary,'only documented activity boundary');equal(session.snapshot().state.index,target,'named retry only');
     equal(session.snapshot().state.retry.returnIndex,boundary,'retry return address');equal(session.snapshot().state.visited.length,boundary,'unique base counts');
     verify(!session.snapshot().state.audioReady,'fresh retry listening required');await reopen();const first=clone(session.snapshot().state.outcomes);
     await respond(target,!retryCorrect);equal(session.snapshot().state.outcomes,first,'first outcomes immutable');await send({type:'continue'});
     equal(session.snapshot().state.retryOutcomes[target].correct,retryCorrect,'saved retry result separate');
     if(id==='B2.C09.L02'){equal(session.snapshot().state.index,9,'resume A02 after either retry outcome');await reopen();}
    }
   }
   equal(retryCount,p.retryPolicy?1:0,'no inferred retries');await reopen();const a=session.snapshot().confirmed,graded=p.screens.filter(s=>s.answer).length;
   verify(a.user_id===owner&&a.completed_at&&a.result.completionEligible,'completion saved to owner');equal(a.result.percent,Math.round((graded-1)/graded*100),'accuracy distinct from completion');
   equal(new Set(a.state.visited).size,p.baseScreenCount,'unique required surfaces');if(id.endsWith('.CP'))equal(loadCourseModule('lib/busuu/runner.ts').getPassOutcome(p,a.result),null,'explicit no-pass-policy');
   report.push({recordId:id,requiredScreens:p.baseScreenCount,accuracy:a.result.percent,retryCorrect,saved:true,reloaded:true,retryCount});session.dispose();
  }
 }
 const progress=loadCourseModule('lib/busuu/progress.ts'),saved=progress.savedCourseProgress([...rows,...rows]);equal(Object.keys(saved).length,9,'unique map entries despite duplicate attempts');
 equal(progress.chapterCompletion(loadCourseModule('lib/busuu/inventory.ts').getLevelInventory('B2').chapters[8],saved),100,'chapter completion independent of accuracy');
 verify(Object.values(saved).every(p=>p.accuracy<100),'completion is not first accuracy');
 fs.writeFileSync(new URL('./saved-path.json',import.meta.url),JSON.stringify({date:'2026-10-06',assertions,storage:'disposable memory RPC adapter; actual registered API/client/evaluator',existingDatabaseBaselineReused:true,uniqueCompletedEntries:9,chapterCompletion:100,optionalWritingEventsExcluded:true,packs:report,liveDatabaseWrites:false},null,2)+'\n');
 console.log(`${assertions} saved API/client/evaluator assertions passed; nine entries reload, both outcomes of all three retries complete, L02 resumes A02; nine unique completed map entries /100%.`);
}finally{if(previousKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=previousKey;}
