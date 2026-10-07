// Real registered packs, client/API/evaluator and isolated PostgreSQL only.
// No live connection. Reuse released ownership/event mechanics and established baselines.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {PGlite} from '../persistence-validation/runtime/node_modules/@electric-sql/pglite/dist/index.js';
import {loadCourseModule} from '../../../lib/busuu-test-helpers.mjs';
import {chapterSixResponses,chapterSixAction} from '../../../lib/busuu-chapter-six-responses.mjs';
const server=loadCourseModule('lib/busuu/attempt-server.ts'),evaluator=loadCourseModule('lib/busuu/attempt.ts');
const Client=loadCourseModule('lib/busuu/attempt-client.ts').CourseAttemptSession;
const packs=Object.keys(chapterSixResponses).map(id=>server.coursePack(id).pack);
const baseline=JSON.parse(fs.readFileSync(new URL('./prior-fingerprints.json',import.meta.url)));
const db=new PGlite(),owner='10000000-0000-4000-8000-000000000001',stranger='10000000-0000-4000-8000-000000000002';
let checks=0,offline=false;
const verify=(v,label)=>{assert.ok(v,label);checks++;},equal=(v,w,label)=>{assert.deepEqual(v,w,label);checks++;};
const storageMap=new Map(),storage={get length(){return storageMap.size;},key:i=>[...storageMap.keys()][i]??null,getItem:k=>storageMap.get(k)??null,setItem:(k,v)=>storageMap.set(k,v),removeItem:k=>storageMap.delete(k)};
const keys={course_start_attempt:['p_id','p_user','p_record','p_version','p_hash','p_restart','p_state','p_result'],course_save_event:['p_attempt','p_user','p_request','p_sequence','p_action','p_version','p_hash','p_state','p_result','p_complete']};
const adapter={auth:{getUser:async()=>({data:{user:{id:owner}},error:null})},async rpc(name,input){
 try{const r=await db.query(`select public.${name}(${keys[name].map((_,i)=>'$'+(i+1)).join(',')}) as attempt`,keys[name].map(k=>input[k]));return{data:r.rows[0].attempt,error:null};}
 catch(e){return{data:null,error:{code:e.code,message:e.message}};}
},from(table){let columns='*';const clauses=[],args=[];const q={select(c){columns=c;return q;},eq(k,v){args.push(v);clauses.push(`${k}=$${args.length}`);return q;},async maybeSingle(){const r=await db.query(`select ${columns} from public.${table} where ${clauses.join(' and ')}`,args);return{data:r.rows[0]??null,error:null};}};return q;}};
const savedKey=process.env.SUPABASE_SERVICE_ROLE_KEY;process.env.SUPABASE_SERVICE_ROLE_KEY='isolated-test-only';
const route=loadCourseModule('app/api/course/attempts/route.ts',{'@/utils/supabase/server':{createClient:async()=>adapter},'@supabase/supabase-js':{createClient:()=>adapter}});
const post=(url,body,expectedOwner=owner)=>route.POST(new Request(`http://localhost${url}`,{method:'POST',headers:{'Content-Type':'application/json','X-Course-Owner':expectedOwner,Origin:'http://localhost'},body:JSON.stringify(body)}));
const transport=async(url,body,expectedOwner)=>{if(offline&&url.includes('?attempt='))throw new Error('Isolated offline boundary');const response=await post(url,body,expectedOwner),data=await response.json();if(!response.ok)throw new Error(data.error);return data;};
const sessionFor=p=>new Client(p,owner,storage,transport,()=>{},p.recordId);
const send=async(session,p,a)=>{session.dispatch({...a,screenId:p.screens[session.snapshot().state.index].screenId});await session.retry();};
const report=[];
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 insert into auth.users values ('${owner}'),('${stranger}');`);
 for(const name of ['20261004011140_course_attempts.sql','20261004011331_course_attempt_events_owner_index.sql'])await db.exec(fs.readFileSync(new URL(`../../../../../supabase/migrations/${name}`,import.meta.url),'utf8'));
 await db.exec('set role service_role');
 for(const p of packs){
  let session=sessionFor(p);await session.open();verify(session.snapshot().ready,'real registered API start');
  const target=p.retryPolicy?p.screens.findIndex(s=>s.screenId===p.retryPolicy.screenIds[0]):p.screens.findIndex(s=>s.renderer==='choice');
  const wrongResponse=s=>s.renderer==='truth'?[!chapterSixResponses[p.recordId][target][0]]:[s.answer.options.find(o=>o.id!==chapterSixResponses[p.recordId][target][0]).id];
  const reopen=async label=>{const state=structuredClone(session.snapshot().state);session.dispose();session=sessionFor(p);await session.open();equal(session.snapshot().state,state,label);};
  const answer=async(i,wrong=false)=>{
   const s=p.screens[i];if(!session.snapshot().state.audioReady)await send(session,p,{type:'audio_ready'});
   const values=wrong?wrongResponse(s):chapterSixResponses[p.recordId][i];
   for(const [j,v]of values.entries())await send(session,p,chapterSixAction(s,v,j,session.snapshot().state));
   if(s.renderer==='typed')await send(session,p,{type:'typed_check'});
  };
  for(const [i,s]of p.screens.entries()){
   equal(session.snapshot().state.index,i,'canonical saved path');
   if(s.screenId.includes('.A02.S01'))await reopen('retained internal activity boundary resumes');
   if(p.structuralContract&&i===7){
    if(!session.snapshot().state.audioReady)await send(session,p,{type:'audio_ready'});
    offline=true;await send(session,p,chapterSixAction(s,'甘くて',0,session.snapshot().state));verify(session.snapshot().status==='error','summary response retained offline');
    await reopen('summary partial response restores offline');offline=false;await session.retry();
    equal(session.snapshot().confirmed.state.slots.filter(Boolean).length,1,'summary response saved once');await send(session,p,{type:'remove_token',slot:0});
   }
   await answer(i,i===target);if(s.answer)equal(session.snapshot().state.outcomes[i]?.correct,i!==target,'independent first result');
   if(i===p.screens.length-1)verify(!session.snapshot().confirmed.completed_at,'final core continue required');
   await send(session,p,{type:'continue'});
   if(p.retryPolicy&&i===9){
    equal(session.snapshot().state.index,target,'only retained first-activity target');equal(session.snapshot().state.retry.returnIndex,10,'return to next activity');
    equal(session.snapshot().state.visited.length,10,'retry is not an extra base surface');verify(!session.snapshot().state.audioReady,'fresh retry playback');
    await reopen('boundary retry restores');const first=structuredClone(session.snapshot().state.outcomes);
    const retryCorrect=p.recordId.endsWith('L04');await answer(target,!retryCorrect);equal(session.snapshot().state.outcomes,first,'saved first accuracy immutable');
    await send(session,p,{type:'continue'});equal(session.snapshot().state.index,10,'resume second activity');equal(session.snapshot().state.retryOutcomes[target].correct,retryCorrect,'separate retry outcome');
   }
  }
  await reopen('completed result reload');const complete=session.snapshot().confirmed,graded=p.screens.filter(s=>s.answer).length;
  verify(Boolean(complete.completed_at)&&complete.result.completionEligible,'account-owned core completion saved');
  equal(complete.result.percent,Math.round((graded-1)/graded*100),'one first error still completes');equal(complete.state.visited.length,p.baseScreenCount,'unique saved base count');
  verify(!Object.hasOwn(complete.state,'structuralContract'),'no summary state/event shape change');
  if(p.completion){
   const eventCount=(await db.query('select count(*)::int n from public.course_attempt_events where attempt_id=$1',[complete.id])).rows[0].n;
   const response=await post(`/api/course/attempts?attempt=${complete.id}`,{requestId:crypto.randomUUID(),sequence:complete.revision+1,contentVersion:p.contentVersion,contentHash:complete.content_hash,action:{type:'typed_draft',screenId:p.completion.optionalSurfaces[0].screenId,text:'甘いです。'}});
   equal(response.status,409,'optional writing cannot enter attempt event stream');
   equal((await db.query('select count(*)::int n from public.course_attempt_events where attempt_id=$1',[complete.id])).rows[0].n,eventCount,'optional writing adds no events');
  }
  report.push({recordId:p.recordId,requiredScreens:p.baseScreenCount,authoredTasks:p.structuralContract?p.baseScreenCount:0,accuracy:complete.result.percent,retry:complete.result.retry??null,saved:true});
  if(p.structuralContract){await session.restart();verify(session.snapshot().confirmed.id!==complete.id,'summary restart distinct attempt');equal(session.snapshot().state,evaluator.initialAttemptState(p),'summary restart exact clean state');}
  session.dispose();
 }
 const summary=packs[0],backup=structuredClone(summary);
 try{
  for(const mutate of [p=>p.structuralContract.activities[0].baseScreenCount=10,p=>p.structuralContract.activities[0].ordinal=2,p=>p.structuralContract.activities[0].activityId='invented',p=>p.structuralContract.tasks[0].responseCount=99,p=>p.screens[0].sourceContract.sourceActivityId='invented']){
   mutate(summary);assert.throws(()=>server.coursePack(summary.recordId));checks++;Object.assign(summary,structuredClone(backup));
  }
 }finally{Object.assign(summary,backup);}
 for(const old of baseline.packs){equal(server.coursePack(old.recordId,old.contentVersion).hash,old.persistenceFingerprint,'35 released save fingerprints');equal(createHash('sha256').update(fs.readFileSync(new URL(`../${old.file}`,import.meta.url))).digest('hex'),old.fileHash,'35 released bytes');}
 const rows=(await db.query('select * from public.course_attempts')).rows,progress=loadCourseModule('lib/busuu/progress.ts');
 const saved=progress.savedCourseProgress([...rows,...rows]);equal(progress.chapterCompletion(loadCourseModule('lib/busuu/inventory.ts').getLevelInventory('B2').chapters[5],saved),100,'seven unique entries complete regardless of accuracy');
 equal(saved['B2.C06.L01'].accuracy,88,'summary accuracy separate from 100% map completion');equal(saved['B2.C06.CP'].accuracy,95,'checkpoint accuracy separate');
 const events=(await db.query('select attempt_id,count(*)::int n from public.course_attempt_events group by attempt_id')).rows;verify(events.every(e=>e.n===rows.find(r=>r.id===e.attempt_id).revision),'offline event replay idempotent');
 const completed=rows.find(r=>r.record_id===summary.recordId&&r.completed_at);
 equal((await post(`/api/course/attempts?attempt=${completed.id}`,{},stranger)).status,409,'switched owner rejected');
 await assert.rejects(()=>server.saveAttemptEvent(adapter,stranger,completed.id,{requestId:crypto.randomUUID(),sequence:completed.revision+1,contentVersion:completed.content_version,contentHash:completed.content_hash,action:{type:'continue',screenId:summary.screens[0].screenId}}));checks++;
 await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${stranger}',false);`);
 equal((await db.query('select count(*)::int n from public.course_attempts')).rows[0].n,0,'foreign account sees no attempts');equal((await db.query('select count(*)::int n from public.course_attempt_events')).rows[0].n,0,'foreign account sees no events');
}finally{if(savedKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=savedKey;await db.close();}
fs.writeFileSync(new URL('./database.json',import.meta.url),JSON.stringify({date:'2026-10-05',checks,isolated:true,packs:report,liveDatabaseWrites:false},null,2)+'\n');
console.log(`${checks} isolated PostgreSQL/API/client assertions passed: all seven saves, summary 11+8 offline/resume/restart/malformed registration, both retry outcomes, optional exclusion, 35 fingerprints, unique map and ownership.`);
