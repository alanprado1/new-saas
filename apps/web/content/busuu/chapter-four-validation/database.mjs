// Actual six registered packs through real client/API/server and isolated PostgreSQL.
// Focus new event/state mechanics; unchanged typed/TTS/transport baselines remain in chapter 3.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { PGlite } from '../persistence-validation/runtime/node_modules/@electric-sql/pglite/dist/index.js';
import { loadCourseModule } from '../../../lib/busuu-test-helpers.mjs';
import { chapterFourResponses, chapterFourAction } from '../../../lib/busuu-chapter-four-responses.mjs';
const server=loadCourseModule('lib/busuu/attempt-server.ts'), evaluator=loadCourseModule('lib/busuu/attempt.ts');
const Client=loadCourseModule('lib/busuu/attempt-client.ts').CourseAttemptSession;
const packs=Object.keys(chapterFourResponses).map(id=>server.coursePack(id).pack);
const baseline=JSON.parse(fs.readFileSync(new URL('./prior-fingerprints.json',import.meta.url)));
const db=new PGlite(),owner='10000000-0000-4000-8000-000000000001',stranger='10000000-0000-4000-8000-000000000002';
let checks=0,offline=false;
const verify=(value,label)=>{assert.ok(value,label);checks++;};
const equal=(value,expected,label)=>{assert.deepEqual(value,expected,label);checks++;};
const storageMap=new Map(),storage={get length(){return storageMap.size;},key:i=>[...storageMap.keys()][i]??null,getItem:k=>storageMap.get(k)??null,setItem:(k,v)=>storageMap.set(k,v),removeItem:k=>storageMap.delete(k)};
const keys={course_start_attempt:['p_id','p_user','p_record','p_version','p_hash','p_restart','p_state','p_result'],course_save_event:['p_attempt','p_user','p_request','p_sequence','p_action','p_version','p_hash','p_state','p_result','p_complete']};
const adapter={auth:{getUser:async()=>({data:{user:{id:owner}},error:null})},async rpc(name,input){
 try{const r=await db.query(`select public.${name}(${keys[name].map((_,i)=>'$'+(i+1)).join(',')}) as attempt`,keys[name].map(k=>input[k]));return {data:r.rows[0].attempt,error:null};}
 catch(e){return {data:null,error:{code:e.code,message:e.message}};}
},from(table){let columns='*';const clauses=[],args=[];const q={select(c){columns=c;return q;},eq(k,v){args.push(v);clauses.push(`${k}=$${args.length}`);return q;},async maybeSingle(){const r=await db.query(`select ${columns} from public.${table} where ${clauses.join(' and ')}`,args);return {data:r.rows[0]??null,error:null};}};return q;}};
const savedKey=process.env.SUPABASE_SERVICE_ROLE_KEY;process.env.SUPABASE_SERVICE_ROLE_KEY='isolated-test-only';
const route=loadCourseModule('app/api/course/attempts/route.ts',{'@/utils/supabase/server':{createClient:async()=>adapter},'@supabase/supabase-js':{createClient:()=>adapter}});
const post=(url,body,expectedOwner=owner)=>route.POST(new Request(`http://localhost${url}`,{method:'POST',headers:{'Content-Type':'application/json','X-Course-Owner':expectedOwner,Origin:'http://localhost'},body:JSON.stringify(body)}));
const transport=async(url,body,expectedOwner)=>{if(offline&&url.includes('?attempt='))throw new Error('Isolated offline boundary');const response=await post(url,body,expectedOwner),data=await response.json();if(!response.ok)throw new Error(data.error);return data;};
const sessionFor=p=>new Client(p,owner,storage,transport,()=>{},p.recordId);
const send=async(session,p,a)=>{session.dispatch({...a,screenId:p.screens[session.snapshot().state.index].screenId});await session.retry();};
const report=[];
try {
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 insert into auth.users values ('${owner}'),('${stranger}');`);
 for(const name of ['20261004011140_course_attempts.sql','20261004011331_course_attempt_events_owner_index.sql'])await db.exec(fs.readFileSync(new URL(`../../../../../supabase/migrations/${name}`,import.meta.url),'utf8'));
 await db.exec('set role service_role');
 for(const p of packs) {
  let session=sessionFor(p);await session.open();verify(session.snapshot().ready,`${p.recordId}: actual registered API start`);
  const wrongIndex=p.recordId==='B2.C04.L01'?1:p.recordId==='B2.C04.L03'?8:p.recordId==='B2.C04.L05'?11:p.recordId.endsWith('CP')?1:null;
  const reopen=async label=>{const before=structuredClone(session.snapshot().state);session.dispose();session=sessionFor(p);await session.open();equal(session.snapshot().state,before,label);verify(session.snapshot().ready,'resumed ready');};
  const invalid=async(action,status)=>{const a=session.snapshot().confirmed;const r=await post(`/api/course/attempts?attempt=${a.id}`,{requestId:crypto.randomUUID(),sequence:a.revision+1,contentVersion:p.contentVersion,contentHash:a.content_hash,action});verify(r.status===status,`API rejects ${JSON.stringify(action)}`);verify((await db.query('select revision from public.course_attempts where id=$1',[a.id])).rows[0].revision===a.revision,'invalid action writes no revision');};
  const answer=async(i,wrong=false)=>{
   const s=p.screens[i];if(!session.snapshot().state.audioReady)await send(session,p,{type:'audio_ready'});
   const values=[...chapterFourResponses[p.recordId][i]];
   if(wrong) {
    if(s.renderer==='gaps')values[0]='つ';
    else if(s.renderer==='choice')values[0]='o1';
    else if(s.renderer==='typed')values[0]='行く';
    else if(s.renderer==='multi_choice')values[1]='o1';
   }
   for(const [j,v]of values.entries())await send(session,p,chapterFourAction(s,v,j,session.snapshot().state));
   if(s.renderer==='typed')await send(session,p,{type:'typed_check'});
   if(s.renderer==='multi_choice')await send(session,p,{type:'selection_check'});
  };
  for(const [i,s]of p.screens.entries()) {
   verify(session.snapshot().state.index===i,'canonical base path');
   if(s.screenId.includes('.A02.S01'))await reopen('internal activity continuation resumes');
   if(s.renderer==='multi_choice') {
    await invalid({type:'selection_check',screenId:s.screenId},409);
    await invalid({type:'selection_check',screenId:s.screenId,correct:true},400);
    await invalid({type:'toggle_option',screenId:s.screenId,id:[]},400);
    await invalid({type:'toggle_option',screenId:s.screenId,id:'forged'},409);
    await invalid({type:'choice',screenId:s.screenId,id:'o0'},409);
    await invalid({type:'toggle_option',screenId:p.screens[i-1].screenId,id:'o0'},409);
    if(!session.snapshot().state.audioReady)await send(session,p,{type:'audio_ready'});
    offline=true;await send(session,p,{type:'toggle_option',id:'o0'});verify(session.snapshot().status==='error','multi draft remains in offline outbox');
    verify(Object.keys(session.snapshot().state.outcomes).length===i-2,'multi draft never grades');
    await reopen('partial multi selection survives offline reload');offline=false;await session.retry();
    equal(session.snapshot().confirmed.state.selectedOptionIds,['o0'],'server confirms one selection');
    await invalid({type:'selection_check',screenId:s.screenId},409);
    await send(session,p,{type:'toggle_option',id:'o2'});
    await invalid({type:'toggle_option',screenId:s.screenId,id:'o3'},409);
    await send(session,p,{type:'toggle_option',id:'o2'});await send(session,p,{type:'toggle_option',id:'o1'});
    await reopen('edited exact-count multi draft resumes');
    await send(session,p,{type:'selection_check'});
    verify(session.snapshot().state.outcomes[i].correct===false,'exact-set grading gives no partial credit');
    await invalid({type:'toggle_option',screenId:s.screenId,id:'o0'},409);await invalid({type:'selection_check',screenId:s.screenId},409);
    await reopen('multi feedback remains locked after reload');
   } else {
    if(s.renderer==='typed') {
     await send(session,p,{type:'typed_draft',text:''});await invalid({type:'typed_check',screenId:s.screenId},409);
     await send(session,p,{type:'typed_draft',text:'こ'});await reopen('typed supplied-suffix draft resumes');
    }
    await answer(i,i===wrongIndex);
   }
   if(s.answer)verify(session.snapshot().state.outcomes[i]?.correct===(i!==wrongIndex),'independent expected first outcome');
   await send(session,p,{type:'continue'});
   if(session.snapshot().state.retry) {
    const retryIndex=session.snapshot().state.index,original=structuredClone(session.snapshot().state.outcomes);
    verify(s.screenId.includes('.A01.'),'retry occurs at first activity boundary');
    verify(session.snapshot().state.visited.length===p.screens.filter(x=>x.screenId.includes('.A01.')).length,'retry adds no base rows');
    verify(!session.snapshot().confirmed.completed_at,'activity retry cannot complete lesson prematurely');
    await reopen('activity retry launch survives reload');
    const target=p.screens[retryIndex];
    if(target.audio.required) {
     verify(!session.snapshot().state.audioReady,'retry requires fresh playback');
     await invalid(chapterFourAction(target,chapterFourResponses[p.recordId][retryIndex][0],0,session.snapshot().state),400);
     await invalid({...chapterFourAction(target,chapterFourResponses[p.recordId][retryIndex][0],0,session.snapshot().state),screenId:target.screenId},409);
     await send(session,p,{type:'audio_ready'});
    }
    const responses=chapterFourResponses[p.recordId][retryIndex];
    for(const [j,v]of responses.entries()) {
     if(j===0)offline=true;
     await send(session,p,chapterFourAction(target,v,j,session.snapshot().state));
     if(j===0) {
      verify(session.snapshot().status==='error','boundary retry response retained offline');await reopen('boundary retry outbox reload');offline=false;await session.retry();
      if(target.renderer==='gaps') {
       await invalid({type:'token',screenId:target.screenId,id:session.snapshot().state.slots[0]},409);
       await send(session,p,{type:'remove_token',slot:0});verify(session.snapshot().state.slots.every(x=>x===null),'retry removal restores all empty slots');
       await send(session,p,chapterFourAction(target,v,j,session.snapshot().state));await reopen('partial token retry resumes');
      }
     }
    }
    equal(session.snapshot().state.outcomes,original,'retry preserves immutable first outcomes');
    verify(session.snapshot().state.retry.outcomes[retryIndex].correct,'retry saves separate correct mastery');
    await reopen('retry feedback resumes');await send(session,p,{type:'continue'});
    verify(session.snapshot().state.index===i+1&&!session.snapshot().state.retry,'retry resumes exact next activity');
    equal(session.snapshot().state.retryOutcomes,{[retryIndex]:{correct:true}},'retry history persists outside active pass');
   }
  }
  await reopen('saved chapter4 result restores');const complete=session.snapshot().confirmed,graded=p.screens.filter(s=>s.answer).length;
  verify(complete.completed_at&&complete.result.completionEligible,'actual API saves core completion');
  verify(complete.result.percent===Math.round((graded-Number(wrongIndex!==null))/graded*100),'first accuracy independent of retry/selection drafts');
  equal(complete.state.visited.length,p.baseScreenCount,'base result counts only required screens');
  verify(Object.hasOwn(complete.result,'retry')===Boolean(p.retryPolicy),'conditional retry result compatibility');
  report.push({recordId:p.recordId,baseScreens:p.baseScreenCount,accuracy:complete.result.percent,retry:complete.result.retry??null,saved:true});
  await session.restart();verify(session.snapshot().confirmed.id!==complete.id,'restart creates distinct attempt');
  verify(!session.snapshot().state.retry&&!session.snapshot().state.retryOutcomes&&!session.snapshot().state.selectedOptionIds,'restart clears new conditional response/remediation state');
  verify(!(await db.query('select active from public.course_attempts where id=$1',[complete.id])).rows[0].active,'retired completed attempt retained');
  if(p.retryPolicy) {
   // Wrong retry is still a single review pass; no correctness loop or changed base score.
   for(let i=0;i<p.screens.length;i++) {
    await answer(i,i===wrongIndex);await send(session,p,{type:'continue'});
    if(session.snapshot().state.retry) {await answer(wrongIndex,true);await send(session,p,{type:'continue'});await reopen('wrong retry continues next activity once');}
   }
   verify(session.snapshot().confirmed.completed_at,'wrong retry still saves completion');
   equal(session.snapshot().confirmed.result.retry,{attempted:1,correct:0,total:1,complete:true},'one wrong retry report');
   verify(session.snapshot().confirmed.result.percent===complete.result.percent,'retry correctness never alters first accuracy');
  }
  if(p.recordId==='B2.C04.L05') {
   // Second attempt: saved correct exact set in reverse click order.
   for(let i=0;i<p.screens.length;i++) {
    if(i===11) {
     await send(session,p,{type:'audio_ready'});await send(session,p,{type:'toggle_option',id:'o2'});await reopen('new multi attempt has independent selection');
     await send(session,p,{type:'toggle_option',id:'o0'});await send(session,p,{type:'selection_check'});verify(session.snapshot().state.outcomes[i].correct,'reverse selection order is accepted');
    } else await answer(i);
    await send(session,p,{type:'continue'});
   }
   verify(session.snapshot().confirmed.result.percent===100,'correct multi attempt saves full accuracy');
  }
  session.dispose();
 }
 for(const old of baseline.packs) {
  const {pack:p,hash}=server.coursePack(old.recordId,old.contentVersion);
  verify(hash===old.persistenceFingerprint,'all 23 old registered fingerprints preserved');
  verify(createHash('sha256').update(fs.readFileSync(new URL(`../${old.file}`,import.meta.url))).digest('hex')===old.fileHash,'all old exact pack bytes preserved');
  if(!loadCourseModule('lib/busuu/content-readiness.ts').getPackReadiness(p).playable)continue;
  const body={requestId:crypto.randomUUID(),recordId:p.recordId,contentVersion:p.contentVersion,contentHash:hash,restart:false};
  const initial=await server.startAttempt(adapter,owner,body);equal(initial.state,evaluator.initialAttemptState(p),'old version exact initial shape');
  verify(!Object.hasOwn(initial.state,'selectedOptionIds')&&!Object.hasOwn(initial.state,'retryOutcomes'),'old attempts gain no new fields');
  equal(initial.result,evaluator.attemptResult(p,initial.state),'old result retains exact shape including released end policy');
  const first=p.screens[0],answer=first.answer;
  const action={screenId:first.screenId,...(!initial.state.audioReady?{type:'audio_ready'}:initial.state.phase==='presentation'?{type:'continue'}:
   answer.kind==='typed'?{type:'typed_draft',text:'こ'}:answer.kind==='truth'?{type:'truth',value:false}:answer.kind==='choice'?{type:'choice',id:answer.options[0].id}:
   answer.kind==='pairs'?{type:'pair',side:'left',id:first.left[0].id}:{type:'token',id:answer.tokens[0].id})};
  const saved=await server.saveAttemptEvent(adapter,owner,initial.id,{requestId:crypto.randomUUID(),sequence:1,contentVersion:p.contentVersion,contentHash:hash,action});
  const resumed=await server.startAttempt(adapter,owner,body);equal(resumed.state,saved.state,'old version saves/resumes compatible event');
 }
 const rows=(await db.query('select * from public.course_attempts')).rows,progress=loadCourseModule('lib/busuu/progress.ts');
 const saved=progress.savedCourseProgress([...rows,...rows]);
 equal(progress.chapterCompletion(loadCourseModule('lib/busuu/inventory.ts').getLevelInventory('B2').chapters[3],saved),100,'six unique entries give chapter map 100 percent');
 verify(saved['B2.C04.CP'].accuracy===95,'CP accuracy independent of map completion');
 const events=(await db.query('select attempt_id,count(*)::int n from public.course_attempt_events group by attempt_id')).rows;
 verify(events.every(e=>e.n===rows.find(r=>r.id===e.attempt_id).revision),'offline event replay is idempotent');
 const a=rows.find(r=>r.record_id==='B2.C04.L05'&&r.active);
 verify((await post(`/api/course/attempts?attempt=${a.id}`,{},stranger)).status===409,'API rejects switched owner');
 await assert.rejects(()=>server.saveAttemptEvent(adapter,stranger,a.id,{requestId:crypto.randomUUID(),sequence:a.revision+1,contentVersion:a.content_version,contentHash:a.content_hash,action:{type:'selection_check',screenId:'B2.C04.L05.A02.S04'}}));checks++;
 await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${stranger}',false);`);
 verify((await db.query('select count(*)::int n from public.course_attempts')).rows[0].n===0,'foreign owner sees no attempts');
 verify((await db.query('select count(*)::int n from public.course_attempt_events')).rows[0].n===0,'foreign owner sees no events');
} finally {if(savedKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=savedKey;await db.close();}
fs.writeFileSync(new URL('./database.json',import.meta.url),JSON.stringify({date:'2026-10-05',checks,isolated:true,packs:report,liveDatabaseWrites:false},null,2)+'\n');
console.log(`${checks} isolated chapter-four PostgreSQL/API/client assertions passed. Six real saved packs, multi-selection drafts/Check, activity-boundary gap/audio retries, immutable accuracy, offline/reload/restart, ownership, unique chapter completion and all 23 prior fingerprints.`);
